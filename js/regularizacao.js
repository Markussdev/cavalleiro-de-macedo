const form = document.querySelector("[data-legal-form]");
const status = document.querySelector("[data-legal-form-status]");
const cityInput = document.querySelector('input[name="city"]');
const cityList = document.querySelector("#municipios-brasil");
const cityIndex = new Map();
let citiesLoaded = false;
let citiesLoading = false;

const normalizeCity = (value) => value
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
    if (citiesLoaded || citiesLoading || !cityList) return;

    citiesLoading = true;

    try {
        const response = await fetch(
            "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome"
        );

        if (!response.ok) {
            throw new Error("Não foi possível carregar os municípios.");
        }

        const municipalities = await response.json();
        const fragment = document.createDocumentFragment();

        municipalities.forEach((municipality) => {
            const uf = getMunicipalityUf(municipality);
            const label = uf
                ? `${municipality.nome} - ${uf}`
                : municipality.nome;

            cityIndex.set(normalizeCity(label), label);

            const option = document.createElement("option");
            option.value = label;
            fragment.append(option);
        });

        cityList.replaceChildren(fragment);
        citiesLoaded = true;
    } catch (error) {
        console.error("Erro ao carregar municípios:", error);
        // A falha da API não bloqueia o preenchimento manual do lead.
    } finally {
        citiesLoading = false;
    }
}

const validateCity = () => {
    if (!cityInput || !citiesLoaded) return true;

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

cityInput?.addEventListener("focus", loadBrazilianCities, { once: true });
cityInput?.addEventListener("change", validateCity);
cityInput?.addEventListener("input", () => cityInput.setCustomValidity(""));

form?.addEventListener("input", () => setStatus(""));
