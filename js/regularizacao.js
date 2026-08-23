const form = document.querySelector("[data-legal-form]");
const status = document.querySelector("[data-legal-form-status]");
const cityInput = document.querySelector("#cityInput");
const cityToggle = document.querySelector("#cityToggle");
const cityDropdown = document.querySelector("#cityDropdown");
const cityOptions = document.querySelector("#cityOptions");
const cityIndex = new Map();
let allCities = [];
let citiesLoaded = false;
let citiesRequest = null;
let visibleCities = [];
let activeCityIndex = -1;

const normalizeCity = (value) => value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();

const getMunicipalityUf = (municipality) => (
    municipality["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla
    || municipality.microrregiao?.mesorregiao?.UF?.sigla
    || ""
);

async function loadBrazilianCities() {
    if (citiesLoaded) return true;
    if (citiesRequest) return citiesRequest;

    citiesRequest = (async () => {
        try {
            const response = await fetch(
                "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome"
            );

            if (!response.ok) {
                throw new Error("Não foi possível carregar os municípios.");
            }

            const municipalities = await response.json();

            allCities = municipalities.map((municipality) => {
                const uf = getMunicipalityUf(municipality);
                const label = uf
                    ? `${municipality.nome} - ${uf}`
                    : municipality.nome;

                cityIndex.set(normalizeCity(label), label);

                return {
                    label,
                    normalizedLabel: normalizeCity(label)
                };
            });

            citiesLoaded = true;
            return true;
        } catch (error) {
            console.error("Erro ao carregar municípios:", error);
            // A falha da API não bloqueia o preenchimento manual do lead.
            return false;
        } finally {
            citiesRequest = null;
        }
    })();

    return citiesRequest;
}

const validateCity = () => {
    if (!cityInput || !citiesLoaded) return true;

    if (!cityInput.value.trim()) {
        cityInput.setCustomValidity("");
        return false;
    }

    const officialCity = cityIndex.get(normalizeCity(cityInput.value));

    if (!officialCity) {
        cityInput.setCustomValidity(
            "Selecione um município brasileiro da lista."
        );
        return false;
    }

    cityInput.value = officialCity;
    cityInput.setCustomValidity("");
    return true;
};

const setCityDropdown = (isOpen) => {
    if (!cityDropdown) return;

    cityDropdown.hidden = !isOpen;
    cityInput?.setAttribute("aria-expanded", String(isOpen));
    cityToggle?.setAttribute("aria-expanded", String(isOpen));

    if (!isOpen) {
        activeCityIndex = -1;
        cityInput?.removeAttribute("aria-activedescendant");
    }
};

const selectCity = (city) => {
    if (!cityInput) return;

    cityInput.value = city.label;
    cityInput.setCustomValidity("");
    setCityDropdown(false);
    cityInput.focus();
};

const setActiveCity = (nextIndex) => {
    if (!visibleCities.length || !cityOptions || !cityInput) return;

    activeCityIndex = (nextIndex + visibleCities.length) % visibleCities.length;

    cityOptions.querySelectorAll(".city-option").forEach((option, index) => {
        const isActive = index === activeCityIndex;
        option.classList.toggle("is-active", isActive);
        option.setAttribute("aria-selected", String(isActive));

        if (isActive) {
            cityInput.setAttribute("aria-activedescendant", option.id);
            option.scrollIntoView({ block: "nearest" });
        }
    });
};

const renderCityOptions = (search = "") => {
    if (!cityOptions || !citiesLoaded) return;

    const normalizedSearch = normalizeCity(search);
    visibleCities = allCities
        .filter((city) => city.normalizedLabel.includes(normalizedSearch))
        .slice(0, 30);
    activeCityIndex = -1;
    cityOptions.replaceChildren();

    if (!visibleCities.length) {
        const empty = document.createElement("p");
        empty.className = "city-option-empty";
        empty.textContent = "Nenhuma cidade encontrada.";
        cityOptions.append(empty);
        setCityDropdown(true);
        return;
    }

    const fragment = document.createDocumentFragment();

    visibleCities.forEach((city, index) => {
        const option = document.createElement("button");
        option.id = `city-option-${index}`;
        option.type = "button";
        option.className = "city-option";
        option.textContent = city.label;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.tabIndex = -1;
        option.addEventListener("click", () => selectCity(city));
        fragment.append(option);
    });

    cityOptions.append(fragment);
    setCityDropdown(true);
};

const setStatus = (message, isError = false) => {
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("is-error", isError);
    status.classList.toggle("is-visible", Boolean(message));
};

const validateWhatsApp = (field) => {
    const number = field.value.replace(/\D/g, "");
    const isValid = number.length >= 10 && number.length <= 13;

    field.setCustomValidity(
        isValid ? "" : "Informe um WhatsApp válido, com DDD."
    );

    return isValid;
};

form?.addEventListener("submit", (event) => {
    event.preventDefault();

    const whatsapp = form.elements.whatsapp;
    validateWhatsApp(whatsapp);
    validateCity();

    if (!form.checkValidity()) {
        form.reportValidity();
        setStatus("Revise os campos obrigatórios.", true);
        return;
    }

    const formData = new FormData(form);
    const data = {
        name: formData.get("name")?.trim(),
        whatsapp: formData.get("whatsapp")?.trim(),
        city: formData.get("city")?.trim() || null,
        request_type: formData.get("request_type"),
        privacy_consent: formData.get("privacy_consent") === "on"
    };

    console.log("Novo lead jurídico:", data);
    setStatus(
        "Dados validados. O envio será conectado ao sistema na próxima etapa."
    );
});

form?.elements.whatsapp?.addEventListener("input", (event) => {
    event.currentTarget.setCustomValidity("");
});

cityInput?.addEventListener("focus", async () => {
    const loaded = await loadBrazilianCities();

    if (loaded && document.activeElement === cityInput) {
        renderCityOptions(cityInput.value);
    }
});

cityInput?.addEventListener("input", async () => {
    cityInput.setCustomValidity("");

    const typedValue = cityInput.value;
    const loaded = await loadBrazilianCities();

    if (loaded && document.activeElement === cityInput && cityInput.value === typedValue) {
        renderCityOptions(typedValue);
    }
});

cityInput?.addEventListener("change", validateCity);

cityInput?.addEventListener("keydown", async (event) => {
    if (event.key === "Escape") {
        setCityDropdown(false);
        return;
    }

    if (event.key === "Enter" && activeCityIndex >= 0) {
        event.preventDefault();
        selectCity(visibleCities[activeCityIndex]);
        return;
    }

    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;

    event.preventDefault();

    const loaded = await loadBrazilianCities();

    if (!loaded) return;

    if (cityDropdown?.hidden) {
        renderCityOptions(cityInput.value);
    }

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const startIndex = activeCityIndex < 0
        ? (direction === 1 ? 0 : visibleCities.length - 1)
        : activeCityIndex + direction;

    setActiveCity(startIndex);
});

cityToggle?.addEventListener("click", async () => {
    if (!cityDropdown?.hidden) {
        setCityDropdown(false);
        return;
    }

    const loaded = await loadBrazilianCities();

    if (loaded) {
        renderCityOptions(cityInput?.value || "");
    }
});

document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".city-autocomplete")) {
        setCityDropdown(false);
    }
});

form?.addEventListener("input", () => setStatus(""));
