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
        setStatus("Revise os campos obrigatórios antes de continuar.", true);
        return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.name = data.name.trim();
    data.whatsapp = data.whatsapp.trim();
    data.email = data.email.trim();
    data.city = data.city.trim();
    data.description = data.description.trim();

    console.log("Solicitação de regularização:", data);
    setStatus("Formulário validado. Integração com o envio em configuração.");
});

form?.elements.whatsapp?.addEventListener("input", (event) => {
    event.currentTarget.setCustomValidity("");
    setStatus("");
});

form?.addEventListener("input", () => setStatus(""));
