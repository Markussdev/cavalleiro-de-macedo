const form = document.querySelector("[data-legal-form]");
const status = document.querySelector("[data-legal-form-status]");
const cityInput = document.querySelector("#cityInput");
const cityToggle = document.querySelector("#cityToggle");
const cityDropdown = document.querySelector("#cityDropdown");
const cityOptions = document.querySelector("#cityOptions");
const whatsappInput = form?.elements.whatsapp;
const cityIndex = new Map();
const CITY_SEARCH_MIN_LENGTH = 2;
let allCities = [];
let citiesLoaded = false;
let citiesRequest = null;
let visibleCities = [];
let activeCityIndex = -1;
let formIsSubmitting = false;

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

    if (normalizedSearch.length < CITY_SEARCH_MIN_LENGTH) {
        setCityDropdown(false);
        return;
    }

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

const formatWhatsApp = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);

    if (digits.length <= 2) {
        return digits;
    }

    if (digits.length <= 7) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    if (digits.length <= 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (formIsSubmitting) return;

    const whatsapp = form.elements.whatsapp;
    validateWhatsApp(whatsapp);
    validateCity();

    if (!form.checkValidity()) {
        form.reportValidity();
        setStatus("Revise os campos obrigatórios.", true);
        return;
    }

    const formData = new FormData(form);
    const payload = {
        name: formData.get("name")?.trim(),
        whatsapp: formData.get("whatsapp")?.replace(/\D/g, ""),
        city: formData.get("city")?.trim(),
        request_type: formData.get("request_type"),
        privacy_consent: formData.get("privacy_consent") === "on"
    };

    const submitButton = form.querySelector('[type="submit"]');
    const originalButtonContent = submitButton?.innerHTML;

    formIsSubmitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";
    setStatus("");

    try {
        if (!window.supabaseClient) {
            throw new Error("Cliente do Supabase indisponível.");
        }

        const { error } = await window.supabaseClient
            .from("legal_requests")
            .insert(payload);

        if (error) {
            throw error;
        }

        form.reset();
        cityInput?.setCustomValidity("");
        setCityDropdown(false);
        setStatus(
            "Solicitação recebida. Entraremos em contato pelos dados informados."
        );
    } catch (error) {
        console.error("Erro ao enviar solicitação:", error);
        setStatus(
            "Não foi possível enviar agora. Tente novamente em alguns instantes.",
            true
        );
    } finally {
        formIsSubmitting = false;
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonContent;
    }
});

whatsappInput?.addEventListener("input", (event) => {
    event.currentTarget.value = formatWhatsApp(event.currentTarget.value);
    event.currentTarget.setCustomValidity("");
});

cityInput?.addEventListener("focus", async () => {
    const loaded = await loadBrazilianCities();

    if (
        loaded
        && document.activeElement === cityInput
        && cityInput.value.trim().length >= CITY_SEARCH_MIN_LENGTH
    ) {
        renderCityOptions(cityInput.value);
    }
});

cityInput?.addEventListener("input", async () => {
    cityInput.setCustomValidity("");

    const typedValue = cityInput.value;

    if (typedValue.trim().length < CITY_SEARCH_MIN_LENGTH) {
        setCityDropdown(false);
        return;
    }

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

    if (cityInput.value.trim().length < CITY_SEARCH_MIN_LENGTH) {
        setCityDropdown(false);
        return;
    }

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
    const search = cityInput?.value.trim() || "";

    if (!cityDropdown?.hidden) {
        setCityDropdown(false);
        return;
    }

    cityInput?.focus();

    if (search.length < CITY_SEARCH_MIN_LENGTH) {
        return;
    }

    const loaded = await loadBrazilianCities();

    if (loaded) {
        renderCityOptions(search);
    }
});

document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".city-autocomplete")) {
        setCityDropdown(false);
    }
});

form?.addEventListener("input", () => setStatus(""));
