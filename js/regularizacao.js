const form = document.querySelector("[data-legal-form]");
const status = document.querySelector("[data-legal-form-status]");
const cityInput = document.querySelector("#cityInput");
const cityToggle = document.querySelector("#cityToggle");
const cityDropdown = document.querySelector("#cityDropdown");
const cityOptions = document.querySelector("#cityOptions");
const leadCard = document.querySelector(".lead-card");
const leadHeader = document.querySelector(".lead-card__header");
const leadSuccess = document.querySelector("[data-lead-success]");
const newRequestButton = document.querySelector("[data-new-request]");
const legalDocumentsInput = document.querySelector("[data-legal-documents]");
const uploadDropzone = document.querySelector("[data-upload-dropzone]");
const uploadFilesContainer = document.querySelector("[data-upload-files]");
const uploadButton = document.querySelector("[data-upload-button]");
const uploadStatus = document.querySelector("[data-upload-status]");
const whatsappInput = form?.elements.whatsapp;
const cityIndex = new Map();
const CITY_SEARCH_MIN_LENGTH = 2;
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp"
]);
const FILE_EXTENSION_BY_TYPE = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
};
const uploadButtonContent = uploadButton?.innerHTML;
let allCities = [];
let citiesLoaded = false;
let citiesRequest = null;
let visibleCities = [];
let activeCityIndex = -1;
let formIsSubmitting = false;
let currentRequestId = null;
let uploadedFilesCount = 0;
let selectedLegalFiles = [];
let uploadIsRunning = false;

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

const createUuid = () => {
    if (typeof window.crypto?.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return [
        hex.slice(0, 4).join(""),
        hex.slice(4, 6).join(""),
        hex.slice(6, 8).join(""),
        hex.slice(8, 10).join(""),
        hex.slice(10).join("")
    ].join("-");
};

const setUploadStatus = (message, type = "") => {
    if (!uploadStatus) return;

    uploadStatus.textContent = message;

    if (type) {
        uploadStatus.dataset.type = type;
    } else {
        delete uploadStatus.dataset.type;
    }
};

const formatFileSize = (bytes) => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const validateLegalFile = (file) => {
    if (!ALLOWED_FILE_TYPES.has(file.type)) {
        return "Tipo de arquivo não permitido.";
    }

    if (file.size > MAX_FILE_SIZE) {
        return "O arquivo ultrapassa 10 MB.";
    }

    if (file.size <= 0) {
        return "O arquivo está vazio.";
    }

    return null;
};

const getFileSignature = (file) => (
    `${file.name}:${file.size}:${file.type}:${file.lastModified}`
);

const renderSelectedLegalFiles = () => {
    if (!uploadFilesContainer || !uploadButton) return;

    uploadFilesContainer.replaceChildren();

    selectedLegalFiles.forEach((file, index) => {
        const row = document.createElement("div");
        const info = document.createElement("div");
        const name = document.createElement("strong");
        const size = document.createElement("small");
        const remove = document.createElement("button");

        row.className = "lead-upload-file";
        info.className = "lead-upload-file__info";
        remove.className = "lead-upload-file__remove";
        remove.type = "button";
        remove.disabled = uploadIsRunning;

        name.textContent = file.name;
        size.textContent = formatFileSize(file.size);
        remove.textContent = "Remover";
        remove.setAttribute("aria-label", `Remover arquivo ${file.name}`);

        remove.addEventListener("click", () => {
            if (uploadIsRunning) return;

            selectedLegalFiles.splice(index, 1);
            setUploadStatus(
                selectedLegalFiles.length
                    ? `${selectedLegalFiles.length} arquivo(s) selecionado(s).`
                    : ""
            );
            renderSelectedLegalFiles();
        });

        info.append(name, size);
        row.append(info, remove);
        uploadFilesContainer.append(row);
    });

    const uploadLimitReached = (
        uploadedFilesCount + selectedLegalFiles.length >= MAX_FILES
    );

    uploadButton.hidden = selectedLegalFiles.length === 0;
    uploadButton.disabled = uploadIsRunning;

    if (legalDocumentsInput) {
        legalDocumentsInput.disabled = uploadIsRunning || uploadLimitReached;
    }

    uploadDropzone?.classList.toggle(
        "is-disabled",
        uploadIsRunning || uploadLimitReached
    );
};

const resetLegalUpload = ({ clearRequest = true } = {}) => {
    if (clearRequest) {
        currentRequestId = null;
    }

    uploadedFilesCount = 0;
    selectedLegalFiles = [];
    uploadIsRunning = false;

    if (legalDocumentsInput) {
        legalDocumentsInput.value = "";
    }

    if (newRequestButton) {
        newRequestButton.disabled = false;
    }

    setUploadStatus("");
    renderSelectedLegalFiles();
};

async function uploadLegalFile(file, requestId) {
    const extension = FILE_EXTENSION_BY_TYPE[file.type];
    const fileId = createUuid();
    const storagePath = `${requestId}/${fileId}.${extension}`;

    const { error: uploadError } = await window.supabaseClient
        .storage
        .from("legal-documents")
        .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (uploadError) {
        throw uploadError;
    }

    const { error: metadataError } = await window.supabaseClient
        .from("legal_request_files")
        .insert({
            request_id: requestId,
            storage_path: storagePath,
            original_name: file.name,
            mime_type: file.type,
            size_bytes: file.size
        });

    if (metadataError) {
        throw metadataError;
    }

    return storagePath;
}

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
    const requestId = createUuid();
    const payload = {
        id: requestId,
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

        currentRequestId = requestId;
        resetLegalUpload({ clearRequest: false });

        form.reset();
        cityInput?.setCustomValidity("");
        setCityDropdown(false);
        setStatus("");

        form.hidden = true;

        if (leadHeader) {
            leadHeader.hidden = true;
        }

        leadCard?.classList.add("lead-card--followup");

        if (leadSuccess) {
            leadSuccess.hidden = false;
            leadSuccess.focus();
        }
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

legalDocumentsInput?.addEventListener("change", () => {
    if (!legalDocumentsInput.files || uploadIsRunning) return;

    const incomingFiles = Array.from(legalDocumentsInput.files);
    const selectedSignatures = new Set(selectedLegalFiles.map(getFileSignature));
    const errors = [];

    for (const file of incomingFiles) {
        const validationError = validateLegalFile(file);

        if (validationError) {
            errors.push(`${file.name}: ${validationError}`);
            continue;
        }

        const signature = getFileSignature(file);

        if (selectedSignatures.has(signature)) {
            errors.push(`${file.name}: este arquivo já foi selecionado.`);
            continue;
        }

        if (selectedLegalFiles.length + uploadedFilesCount >= MAX_FILES) {
            errors.push("Você pode enviar no máximo 5 arquivos.");
            break;
        }

        selectedLegalFiles.push(file);
        selectedSignatures.add(signature);
    }

    legalDocumentsInput.value = "";
    renderSelectedLegalFiles();

    if (errors.length) {
        setUploadStatus(errors[0], "error");
    } else if (selectedLegalFiles.length) {
        setUploadStatus(
            selectedLegalFiles.length === 1
                ? "1 arquivo selecionado."
                : `${selectedLegalFiles.length} arquivos selecionados.`
        );
    } else {
        setUploadStatus("");
    }
});

uploadButton?.addEventListener("click", async () => {
    if (
        uploadIsRunning
        || !currentRequestId
        || !selectedLegalFiles.length
    ) {
        return;
    }

    if (!window.supabaseClient) {
        setUploadStatus("Não foi possível iniciar o envio agora.", "error");
        return;
    }

    const requestId = currentRequestId;
    const filesToUpload = [...selectedLegalFiles];
    let uploaded = 0;

    uploadIsRunning = true;

    if (newRequestButton) {
        newRequestButton.disabled = true;
    }

    renderSelectedLegalFiles();
    uploadButton.textContent = "Enviando documentos...";
    setUploadStatus(`Enviando 0 de ${filesToUpload.length}...`);

    try {
        for (const file of filesToUpload) {
            await uploadLegalFile(file, requestId);

            uploaded += 1;
            uploadedFilesCount += 1;
            selectedLegalFiles = selectedLegalFiles.filter(
                (selectedFile) => selectedFile !== file
            );

            renderSelectedLegalFiles();
            setUploadStatus(`Enviando ${uploaded} de ${filesToUpload.length}...`);
        }

        setUploadStatus(
            uploaded === 1
                ? "Documento enviado com sucesso."
                : `${uploaded} documentos enviados com sucesso.`,
            "success"
        );
    } catch (error) {
        console.error("Erro ao enviar documento:", error);
        setUploadStatus(
            uploaded
                ? `${uploaded} arquivo(s) enviado(s). Os demais não puderam ser enviados.`
                : "Não foi possível enviar os documentos. Tente novamente.",
            "error"
        );
    } finally {
        uploadIsRunning = false;

        if (newRequestButton) {
            newRequestButton.disabled = false;
        }

        uploadButton.disabled = false;
        uploadButton.innerHTML = uploadButtonContent;
        renderSelectedLegalFiles();
    }
});

newRequestButton?.addEventListener("click", () => {
    if (uploadIsRunning) return;

    resetLegalUpload();

    if (leadSuccess) {
        leadSuccess.hidden = true;
    }

    if (leadHeader) {
        leadHeader.hidden = false;
    }

    leadCard?.classList.remove("lead-card--followup");

    form.hidden = false;
    form.elements.name?.focus();
});
