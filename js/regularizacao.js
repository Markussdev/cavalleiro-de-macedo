const form = document.querySelector("[data-legal-form]");
const status = document.querySelector("[data-legal-form-status]");

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

form?.addEventListener("input", () => setStatus(""));
