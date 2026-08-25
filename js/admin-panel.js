const panel = document.querySelector("[data-admin-panel]");
const panelStatus = document.querySelector("[data-panel-status]");
const adminName = document.querySelector("[data-admin-name]");
const requestsList = document.querySelector("[data-legal-requests]");
const requestsCount = document.querySelector("[data-requests-count]");
const propertyLeadsList = document.querySelector("[data-property-leads]");
const propertyLeadsCount = document.querySelector("[data-property-leads-count]");
const propertiesList = document.querySelector("[data-properties]");
const propertiesCount = document.querySelector("[data-properties-count]");
const publishedList = document.querySelector("[data-published-posts]");
const draftList = document.querySelector("[data-draft-posts]");
const publishedCount = document.querySelector("[data-published-count]");
const draftsCount = document.querySelector("[data-drafts-count]");
const logoutButton = document.querySelector("[data-logout]");

const requestLabels = {
    regularizacao: "Regularização de imóvel",
    "escritura-registro": "Escritura ou registro",
    "compra-venda": "Compra e venda",
    contrato: "Contrato imobiliário",
    usucapiao: "Usucapião",
    inventario: "Inventário / sucessão",
    outro: "Outro"
};

const statusLabels = {
    new: "Nova",
    reviewing: "Em análise",
    contacted: "Contato realizado",
    closed: "Concluída"
};

const propertyLeadStatusLabels = {
    new: "Novo",
    contacted: "Contato realizado",
    completed: "Concluído",
    not_attended: "Não atendido"
};

const propertyStatusLabels = {
    draft: "Rascunho",
    available: "Disponível",
    reserved: "Reservado",
    sold: "Vendido",
    rented: "Alugado",
    inactive: "Inativo"
};

const propertyPurposeLabels = {
    sale: "Venda",
    rent: "Locação"
};

let legalRequests = [];
let propertyLeads = [];

const adminDateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Belem"
});

const adminTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Belem"
});

const propertyPriceFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
});

function formatAdminDate(value) {
    if (!value) {
        return "Sem data";
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Sem data"
        : adminDateFormatter.format(date);
}

function formatRequestDate(value) {
    if (!value) {
        return "Data não informada";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Data não informada";
    }

    return `${adminDateFormatter.format(date)} · ${adminTimeFormatter.format(date)}`;
}

function getWhatsappDigits(value) {
    return String(value || "").replace(/\D/g, "");
}

function getInternationalWhatsapp(value) {
    const digits = getWhatsappDigits(value);
    return digits.startsWith("55") && digits.length >= 12
        ? digits
        : `55${digits}`;
}

function formatWhatsapp(value) {
    const digits = getWhatsappDigits(value);
    const localDigits = digits.startsWith("55") && digits.length >= 12
        ? digits.slice(2)
        : digits;

    if (localDigits.length === 11) {
        return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
    }

    if (localDigits.length === 10) {
        return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
    }

    return value || "WhatsApp não informado";
}

function isKnownRequestStatus(status) {
    return Object.prototype.hasOwnProperty.call(statusLabels, status);
}

function getRequestStatusKey(status) {
    if (!status) {
        return "new";
    }

    return isKnownRequestStatus(status) ? status : "unknown";
}

function setRequestStatusAppearance(element, value) {
    const statusKey = getRequestStatusKey(value);
    element.className = `admin-request__status admin-request__status--${statusKey}`;
    element.textContent = statusKey === "unknown"
        ? value
        : statusLabels[statusKey];
}

function isKnownPropertyLeadStatus(status) {
    return Object.prototype.hasOwnProperty.call(
        propertyLeadStatusLabels,
        status
    );
}

function getPropertyLeadStatusKey(status) {
    if (!status) {
        return "new";
    }

    return isKnownPropertyLeadStatus(status) ? status : "unknown";
}

function setPropertyLeadStatusAppearance(element, value) {
    const statusKey = getPropertyLeadStatusKey(value);
    const visualKey = {
        new: "new",
        contacted: "contacted",
        completed: "closed",
        not_attended: "not-attended",
        unknown: "unknown"
    }[statusKey];

    element.className = `admin-request__status admin-request__status--${visualKey}`;
    element.textContent = statusKey === "unknown"
        ? value
        : propertyLeadStatusLabels[statusKey];
}

function updatePropertyLeadsCount() {
    const newLeads = propertyLeads.filter(
        (lead) => getPropertyLeadStatusKey(lead.status) === "new"
    ).length;

    propertyLeadsCount.textContent = newLeads === 1
        ? "1 novo"
        : `${newLeads} novos`;
    propertyLeadsCount.setAttribute(
        "aria-label",
        newLeads === 1
            ? "1 novo interesse em imóvel"
            : `${newLeads} novos interesses em imóveis`
    );
}

function updateRequestsCount() {
    const newRequests = legalRequests.filter(
        (request) => getRequestStatusKey(request.status) === "new"
    ).length;
    const label = newRequests === 1 ? "1 nova" : `${newRequests} novas`;

    requestsCount.textContent = label;
    requestsCount.setAttribute(
        "aria-label",
        newRequests === 1
            ? "1 solicitação nova"
            : `${newRequests} solicitações novas`
    );
}

async function updateLegalRequestStatus({
    request,
    nextStatus,
    select,
    status,
    article,
    feedback
}) {
    const previousStatus = request.status || "new";

    if (nextStatus === previousStatus || !isKnownRequestStatus(nextStatus)) {
        return;
    }

    request.status = nextStatus;
    setRequestStatusAppearance(status, nextStatus);
    updateRequestsCount();

    select.disabled = true;
    article.dataset.saving = "true";
    feedback.textContent = "Salvando status…";
    feedback.dataset.type = "pending";

    try {
        const { data: updatedRequest, error } = await window.supabaseClient
            .from("legal_requests")
            .update({ status: nextStatus })
            .eq("id", request.id)
            .select("id, status")
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!updatedRequest || updatedRequest.status !== nextStatus) {
            throw new Error("A solicitação não foi atualizada.");
        }

        request.status = updatedRequest.status;
        feedback.textContent = "Status atualizado.";
        feedback.dataset.type = "success";
    } catch (error) {
        console.error("Erro ao atualizar status da solicitação:", error);
        request.status = previousStatus;
        select.value = previousStatus;
        setRequestStatusAppearance(status, previousStatus);
        updateRequestsCount();
        feedback.textContent = "Não foi possível salvar. Tente novamente.";
        feedback.dataset.type = "error";
    } finally {
        select.disabled = false;
        delete article.dataset.saving;
    }
}

async function openLegalDocument(file, button) {
    const originalText = button.textContent;
    const newTab = window.open("", "_blank");

    button.disabled = true;
    button.textContent = "Abrindo…";

    if (newTab) {
        newTab.opener = null;
    }

    try {
        const { data, error } = await window.supabaseClient
            .storage
            .from("legal-documents")
            .createSignedUrl(file.storage_path, 300);

        if (error) {
            throw error;
        }

        if (!data?.signedUrl) {
            throw new Error("URL do documento não gerada.");
        }

        if (newTab) {
            newTab.location.href = data.signedUrl;
        } else {
            window.location.href = data.signedUrl;
        }
    } catch (error) {
        console.error("Erro ao abrir documento:", error);
        newTab?.close();
        window.alert("Não foi possível abrir o documento.");
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

async function deleteLegalRequest({ request, article, button }) {
    const confirmed = window.confirm(
        `Remover a solicitação de ${request.name || "este contato"}?\n\n`
        + "Os documentos enviados também serão excluídos. "
        + "Esta ação não pode ser desfeita."
    );

    if (!confirmed) {
        return;
    }

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Removendo…";
    article.dataset.deleting = "true";

    try {
        const storagePaths = (request.files || [])
            .map((file) => file.storage_path)
            .filter(Boolean);

        if (storagePaths.length) {
            const { error: storageError } = await window.supabaseClient
                .storage
                .from("legal-documents")
                .remove(storagePaths);

            if (storageError) {
                throw storageError;
            }
        }

        const { data: deletedRequest, error: requestError } = await window.supabaseClient
            .from("legal_requests")
            .delete()
            .eq("id", request.id)
            .select("id")
            .maybeSingle();

        if (requestError) {
            throw requestError;
        }

        if (!deletedRequest || deletedRequest.id !== request.id) {
            throw new Error("A solicitação não foi removida.");
        }

        legalRequests = legalRequests.filter((item) => item.id !== request.id);
        updateRequestsCount();
        article.classList.add("is-removing");

        window.setTimeout(() => {
            article.remove();

            if (!legalRequests.length) {
                renderLegalRequests([]);
            }
        }, 220);
    } catch (error) {
        console.error("Erro ao remover solicitação:", error);
        window.alert("Não foi possível remover a solicitação. Tente novamente.");
        button.disabled = false;
        button.textContent = originalText;
        delete article.dataset.deleting;
    }
}

function createRequestFiles(request) {
    const files = request.files || [];

    if (!files.length) {
        return null;
    }

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const list = document.createElement("div");

    details.className = "admin-request__files";
    summary.textContent = files.length === 1
        ? "1 documento"
        : `${files.length} documentos`;
    list.className = "admin-request__files-list";

    files.forEach((file) => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "admin-request__file";
        button.textContent = file.original_name || "Documento sem nome";
        button.setAttribute(
            "aria-label",
            `Abrir documento ${file.original_name || "sem nome"} em uma nova aba`
        );

        button.addEventListener("click", () => {
            openLegalDocument(file, button);
        });

        list.append(button);
    });

    details.append(summary, list);
    return details;
}

function createLegalRequest(request) {
    const article = document.createElement("article");
    const content = document.createElement("div");
    const status = document.createElement("span");
    const title = document.createElement("h3");
    const meta = document.createElement("p");
    const contact = document.createElement("div");
    const phone = document.createElement("strong");
    const date = document.createElement("time");
    const whatsapp = document.createElement("a");
    const statusControl = document.createElement("div");
    const statusField = document.createElement("label");
    const statusCaption = document.createElement("span");
    const statusSelect = document.createElement("select");
    const statusFeedback = document.createElement("p");
    const deleteButton = document.createElement("button");
    const files = createRequestFiles(request);

    const rawStatus = request.status || "new";
    const requestType = requestLabels[request.request_type]
        || request.request_type
        || "Assunto não informado";
    const whatsappDigits = getWhatsappDigits(request.whatsapp);

    article.className = "admin-request";
    content.className = "admin-request__content";
    contact.className = "admin-request__contact";
    phone.className = "admin-request__phone";
    date.className = "admin-request__date";
    whatsapp.className = "admin-request__action";
    statusControl.className = "admin-request__status-control";
    statusField.className = "admin-request__status-field";
    statusSelect.className = "admin-request__status-select";
    statusFeedback.className = "admin-request__status-feedback";
    deleteButton.type = "button";
    deleteButton.className = "admin-request__delete";
    deleteButton.textContent = "Remover solicitação";
    deleteButton.setAttribute(
        "aria-label",
        `Remover solicitação de ${request.name || "solicitante"}`
    );

    setRequestStatusAppearance(status, rawStatus);
    title.textContent = request.name || "Nome não informado";
    meta.textContent = `${request.city || "Cidade não informada"} · ${requestType}`;
    phone.textContent = formatWhatsapp(request.whatsapp);
    date.textContent = formatRequestDate(request.created_at);
    statusCaption.textContent = "Status";
    statusFeedback.setAttribute("role", "status");
    statusFeedback.setAttribute("aria-live", "polite");

    if (!isKnownRequestStatus(rawStatus)) {
        const currentOption = document.createElement("option");
        currentOption.value = rawStatus;
        currentOption.textContent = rawStatus;
        currentOption.disabled = true;
        statusSelect.append(currentOption);
    }

    Object.entries(statusLabels).forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        statusSelect.append(option);
    });

    statusSelect.value = rawStatus;
    statusSelect.setAttribute(
        "aria-label",
        `Status da solicitação de ${request.name || "solicitante"}`
    );

    if (request.created_at && !Number.isNaN(new Date(request.created_at).getTime())) {
        date.dateTime = request.created_at;
    }

    if (whatsappDigits) {
        whatsapp.href = `https://wa.me/${getInternationalWhatsapp(request.whatsapp)}`;
        whatsapp.target = "_blank";
        whatsapp.rel = "noopener noreferrer";
        whatsapp.textContent = "Entrar em contato ↗";
        whatsapp.setAttribute(
            "aria-label",
            `Entrar em contato com ${request.name || "solicitante"} pelo WhatsApp`
        );
    } else {
        whatsapp.hidden = true;
    }

    statusSelect.addEventListener("change", () => {
        updateLegalRequestStatus({
            request,
            nextStatus: statusSelect.value,
            select: statusSelect,
            status,
            article,
            feedback: statusFeedback
        });
    });

    deleteButton.addEventListener("click", () => {
        deleteLegalRequest({
            request,
            article,
            button: deleteButton
        });
    });

    content.append(status, title, meta);

    if (files) {
        content.append(files);
    }

    statusField.append(statusCaption, statusSelect);
    statusControl.append(statusField, statusFeedback);
    contact.append(phone, date, whatsapp, statusControl, deleteButton);
    article.append(content, contact);
    return article;
}

function renderLegalRequests(requests) {
    legalRequests = requests;
    updateRequestsCount();

    if (!requests.length) {
        const empty = document.createElement("p");
        empty.className = "admin-posts__empty";
        empty.textContent = "Nenhuma solicitação recebida.";
        requestsList.replaceChildren(empty);
        return;
    }

    requestsList.replaceChildren(...requests.map(createLegalRequest));
}

function renderRequestsError() {
    const error = document.createElement("p");
    error.className = "admin-posts__empty admin-posts__empty--error";
    error.textContent = "Não foi possível carregar as solicitações agora.";
    legalRequests = [];
    requestsCount.textContent = "—";
    requestsCount.setAttribute("aria-label", "Não foi possível contar as solicitações novas");
    requestsList.replaceChildren(error);
}

async function updatePropertyLeadStatus({
    lead,
    nextStatus,
    select,
    status,
    article,
    feedback
}) {
    const previousStatus = lead.status || "new";

    if (
        nextStatus === previousStatus
        || !isKnownPropertyLeadStatus(nextStatus)
    ) {
        return;
    }

    lead.status = nextStatus;
    setPropertyLeadStatusAppearance(status, nextStatus);
    updatePropertyLeadsCount();

    select.disabled = true;
    article.dataset.saving = "true";
    feedback.textContent = "Salvando status…";
    feedback.dataset.type = "pending";

    try {
        const { data: updatedLead, error } = await window.supabaseClient
            .from("property_leads")
            .update({ status: nextStatus })
            .eq("id", lead.id)
            .select("id, status")
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!updatedLead || updatedLead.status !== nextStatus) {
            throw new Error("O interesse não foi atualizado.");
        }

        lead.status = updatedLead.status;
        feedback.textContent = "Status atualizado.";
        feedback.dataset.type = "success";
    } catch (error) {
        console.error("Erro ao atualizar interesse:", error);
        lead.status = previousStatus;
        select.value = previousStatus;
        setPropertyLeadStatusAppearance(status, previousStatus);
        updatePropertyLeadsCount();
        feedback.textContent = "Não foi possível salvar.";
        feedback.dataset.type = "error";
    } finally {
        select.disabled = false;
        delete article.dataset.saving;
    }
}

async function deletePropertyLead({ lead, article, button }) {
    const confirmed = window.confirm(
        `Remover o interesse de ${lead.name || "este contato"}?\n\n`
        + "Esta ação não pode ser desfeita."
    );

    if (!confirmed) {
        return;
    }

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Removendo…";
    article.dataset.deleting = "true";

    try {
        const { data: deletedLead, error } = await window.supabaseClient
            .from("property_leads")
            .delete()
            .eq("id", lead.id)
            .select("id")
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!deletedLead || deletedLead.id !== lead.id) {
            throw new Error("O interesse não foi removido.");
        }

        propertyLeads = propertyLeads.filter((item) => item.id !== lead.id);
        updatePropertyLeadsCount();
        article.classList.add("is-removing");

        window.setTimeout(() => {
            article.remove();

            if (!propertyLeads.length) {
                renderPropertyLeads([]);
            }
        }, 220);
    } catch (error) {
        console.error("Erro ao remover interesse:", error);
        window.alert("Não foi possível remover o interesse.");
        button.disabled = false;
        button.textContent = originalText;
        delete article.dataset.deleting;
    }
}

function createPropertyLead(lead) {
    const article = document.createElement("article");
    const content = document.createElement("div");
    const status = document.createElement("span");
    const title = document.createElement("h3");
    const meta = document.createElement("p");
    const propertyLink = document.createElement("a");
    const contact = document.createElement("div");
    const phone = document.createElement("strong");
    const date = document.createElement("time");
    const whatsapp = document.createElement("a");
    const statusControl = document.createElement("div");
    const statusField = document.createElement("label");
    const statusCaption = document.createElement("span");
    const statusSelect = document.createElement("select");
    const statusFeedback = document.createElement("p");
    const deleteButton = document.createElement("button");

    const rawStatus = lead.status || "new";
    const whatsappDigits = getWhatsappDigits(lead.whatsapp);
    const property = Array.isArray(lead.properties)
        ? lead.properties[0] || null
        : lead.properties || null;

    article.className = "admin-request";
    article.dataset.propertyLeadId = lead.id;
    content.className = "admin-request__content";
    contact.className = "admin-request__contact";
    phone.className = "admin-request__phone";
    date.className = "admin-request__date";
    whatsapp.className = "admin-request__action";
    statusControl.className = "admin-request__status-control";
    statusField.className = "admin-request__status-field";
    statusSelect.className = "admin-request__status-select";
    statusFeedback.className = "admin-request__status-feedback";
    propertyLink.className = "admin-property-lead__property";
    deleteButton.type = "button";
    deleteButton.className = "admin-request__delete";

    setPropertyLeadStatusAppearance(status, rawStatus);
    title.textContent = lead.name || "Nome não informado";
    meta.textContent = property?.title || "Imóvel removido ou indisponível";

    if (property?.id) {
        propertyLink.href = `./imovel.html?id=${encodeURIComponent(property.id)}`;
        propertyLink.textContent = "Abrir imóvel →";
    } else {
        propertyLink.hidden = true;
    }

    phone.textContent = formatWhatsapp(lead.whatsapp);
    date.textContent = formatRequestDate(lead.created_at);

    if (lead.created_at && !Number.isNaN(new Date(lead.created_at).getTime())) {
        date.dateTime = lead.created_at;
    }

    if (whatsappDigits) {
        whatsapp.href = `https://wa.me/${getInternationalWhatsapp(lead.whatsapp)}`;
        whatsapp.target = "_blank";
        whatsapp.rel = "noopener noreferrer";
        whatsapp.textContent = "Entrar em contato ↗";
        whatsapp.setAttribute(
            "aria-label",
            `Entrar em contato com ${lead.name || "interessado"} pelo WhatsApp`
        );
    } else {
        whatsapp.hidden = true;
    }

    statusCaption.textContent = "Status";

    if (!isKnownPropertyLeadStatus(rawStatus)) {
        const currentOption = document.createElement("option");

        currentOption.value = rawStatus;
        currentOption.textContent = rawStatus;
        currentOption.disabled = true;
        statusSelect.append(currentOption);
    }

    Object.entries(propertyLeadStatusLabels).forEach(([value, label]) => {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = label;
        statusSelect.append(option);
    });

    statusSelect.value = rawStatus;
    statusSelect.setAttribute(
        "aria-label",
        `Status do interesse de ${lead.name || "interessado"}`
    );
    statusFeedback.setAttribute("role", "status");
    statusFeedback.setAttribute("aria-live", "polite");

    statusSelect.addEventListener("change", () => {
        updatePropertyLeadStatus({
            lead,
            nextStatus: statusSelect.value,
            select: statusSelect,
            status,
            article,
            feedback: statusFeedback
        });
    });

    deleteButton.textContent = "Remover interesse";
    deleteButton.setAttribute(
        "aria-label",
        `Remover interesse de ${lead.name || "interessado"}`
    );
    deleteButton.addEventListener("click", () => {
        deletePropertyLead({
            lead,
            article,
            button: deleteButton
        });
    });

    content.append(status, title, meta);

    if (!propertyLink.hidden) {
        content.append(propertyLink);
    }

    statusField.append(statusCaption, statusSelect);
    statusControl.append(statusField, statusFeedback);
    contact.append(phone, date, whatsapp, statusControl, deleteButton);
    article.append(content, contact);

    return article;
}

function renderPropertyLeads(leads) {
    propertyLeads = leads;
    updatePropertyLeadsCount();

    if (!leads.length) {
        const empty = document.createElement("p");

        empty.className = "admin-posts__empty";
        empty.textContent = "Nenhum interesse em imóveis recebido.";
        propertyLeadsList.replaceChildren(empty);
        return;
    }

    propertyLeadsList.replaceChildren(...leads.map(createPropertyLead));
}

function renderPropertyLeadsError() {
    const error = document.createElement("p");

    error.className = "admin-posts__empty admin-posts__empty--error";
    error.textContent = "Não foi possível carregar os interesses em imóveis.";
    propertyLeads = [];
    propertyLeadsCount.textContent = "—";
    propertyLeadsCount.setAttribute(
        "aria-label",
        "Não foi possível contar os novos interesses em imóveis"
    );
    propertyLeadsList.replaceChildren(error);
}

function formatPropertyPrice(property) {
    if (property.price_on_request) {
        return "Valor sob consulta";
    }

    const price = Number(property.price);
    return Number.isFinite(price)
        ? propertyPriceFormatter.format(price)
        : "Preço não informado";
}

function createAdminProperty(property) {
    const article = document.createElement("article");
    const content = document.createElement("div");
    const status = document.createElement("span");
    const title = document.createElement("h3");
    const location = document.createElement("p");
    const details = document.createElement("p");
    const actions = document.createElement("div");
    const editAction = document.createElement("a");

    const statusKey = Object.prototype.hasOwnProperty.call(
        propertyStatusLabels,
        property.status
    )
        ? property.status
        : "unknown";
    const statusLabel = statusKey === "unknown"
        ? property.status || "Status não informado"
        : propertyStatusLabels[statusKey];
    const purposeLabel = propertyPurposeLabels[property.purpose]
        || property.purpose
        || "Finalidade não informada";
    const cityState = [property.city, property.state]
        .filter(Boolean)
        .join(" - ") || "Localização não informada";
    const locationLabel = [property.neighborhood, cityState]
        .filter(Boolean)
        .join(" · ");

    article.className = "admin-post admin-property";
    content.className = "admin-post__content";
    status.className = `admin-property__status admin-property__status--${statusKey}`;
    location.className = "admin-post__meta";
    details.className = "admin-post__meta admin-property__details";
    actions.className = "admin-post__actions";
    editAction.className = "admin-post__action";

    status.textContent = statusLabel;
    title.textContent = property.title || "Imóvel sem título";
    location.textContent = locationLabel;
    details.textContent = `${purposeLabel} · ${formatPropertyPrice(property)}`;
    editAction.href = `./imovel.html?id=${encodeURIComponent(property.id)}`;
    editAction.textContent = "Editar →";
    editAction.setAttribute(
        "aria-label",
        `Editar imóvel: ${property.title || "sem título"}`
    );

    content.append(status, title, location, details);
    actions.append(editAction);
    article.append(content, actions);
    return article;
}

function renderProperties(properties) {
    propertiesCount.textContent = String(properties.length);

    if (!properties.length) {
        const empty = document.createElement("p");
        empty.className = "admin-posts__empty";
        empty.textContent = "Nenhum imóvel cadastrado.";
        propertiesList.replaceChildren(empty);
        return;
    }

    propertiesList.replaceChildren(...properties.map(createAdminProperty));
}

function renderPropertiesError() {
    const error = document.createElement("p");
    error.className = "admin-posts__empty admin-posts__empty--error";
    error.textContent = "Não foi possível carregar os imóveis agora.";
    propertiesCount.textContent = "—";
    propertiesList.replaceChildren(error);
}

function createAdminPost(post) {
    const article = document.createElement("article");
    const content = document.createElement("div");
    const meta = document.createElement("p");
    const title = document.createElement("h3");
    const actions = document.createElement("div");
    const editAction = document.createElement("a");

    article.className = "admin-post";
    content.className = "admin-post__content";
    meta.className = "admin-post__meta";
    actions.className = "admin-post__actions";
    title.textContent = post.title;

    const dateValue = post.published ? post.published_at : post.updated_at;
    const dateLabel = post.published ? "Publicado em" : "Atualizado em";
    meta.textContent = `${post.category || "Sem categoria"} · ${dateLabel} ${formatAdminDate(dateValue)}`;

    if (post.published && post.slug) {
        const viewAction = document.createElement("a");
        viewAction.className = "admin-post__action admin-post__action--view";
        viewAction.href = `../publicacoes/artigo.html?slug=${encodeURIComponent(post.slug)}`;
        viewAction.target = "_blank";
        viewAction.rel = "noopener noreferrer";
        viewAction.textContent = "Visualizar ↗";
        viewAction.setAttribute("aria-label", `Visualizar artigo publicado: ${post.title}`);
        actions.append(viewAction);
    }

    editAction.className = "admin-post__action";
    editAction.href = `./editor.html?id=${encodeURIComponent(post.id)}`;
    editAction.textContent = "Editar →";
    editAction.setAttribute("aria-label", `Editar artigo: ${post.title}`);
    actions.append(editAction);

    content.append(title, meta);
    article.append(content, actions);
    return article;
}

function renderPostGroup(container, counter, posts, emptyMessage) {
    counter.textContent = String(posts.length);

    if (!posts.length) {
        const empty = document.createElement("p");
        empty.className = "admin-posts__empty";
        empty.textContent = emptyMessage;
        container.replaceChildren(empty);
        return;
    }

    container.replaceChildren(...posts.map(createAdminPost));
}

async function redirectToLogin() {
    window.location.replace("./index.html?erro=acesso");
}

async function loadAdminPanel() {
    if (!window.supabaseClient) {
        await redirectToLogin();
        return;
    }

    const {
        data: { user },
        error: userError
    } = await window.supabaseClient.auth.getUser();

    if (userError || !user) {
        await redirectToLogin();
        return;
    }

    const { data: membership, error: membershipError } = await window.supabaseClient
        .from("admin_users")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

    if (membershipError || !membership) {
        await window.supabaseClient.auth.signOut();
        await redirectToLogin();
        return;
    }

    adminName.textContent = membership.display_name || "Roberto";
    panel.hidden = false;

    const [
        requestsResult,
        filesResult,
        propertyLeadsResult,
        propertiesResult,
        postsResult
    ] = await Promise.all([
        window.supabaseClient
            .from("legal_requests")
            .select("id, created_at, name, whatsapp, city, request_type, status")
            .order("created_at", { ascending: false }),
        window.supabaseClient
            .from("legal_request_files")
            .select("id, request_id, storage_path, original_name, mime_type, size_bytes, created_at")
            .order("created_at", { ascending: true }),
        window.supabaseClient
            .from("property_leads")
            .select(`
                id,
                created_at,
                property_id,
                name,
                whatsapp,
                privacy_consent,
                status,
                properties (
                    id,
                    title,
                    slug,
                    status
                )
            `)
            .order("created_at", { ascending: false }),
        window.supabaseClient
            .from("properties")
            .select("id, title, purpose, price, price_on_request, city, state, neighborhood, status, updated_at")
            .order("updated_at", { ascending: false }),
        window.supabaseClient
            .from("posts")
            .select("id, title, slug, category, published, published_at, updated_at")
            .order("updated_at", { ascending: false })
    ]);

    const { data: requests, error: requestsError } = requestsResult;
    const { data: requestFiles, error: requestFilesError } = filesResult;
    const {
        data: propertyLeadsData,
        error: propertyLeadsError
    } = propertyLeadsResult;
    const { data: properties, error: propertiesError } = propertiesResult;
    const { data: posts, error: postsError } = postsResult;

    const filesByRequest = new Map();

    if (requestFilesError) {
        console.error("Erro ao carregar documentos:", requestFilesError);
    } else {
        (requestFiles || []).forEach((file) => {
            const currentFiles = filesByRequest.get(file.request_id) || [];
            currentFiles.push(file);
            filesByRequest.set(file.request_id, currentFiles);
        });
    }

    const requestsWithFiles = (requests || []).map((request) => ({
        ...request,
        files: filesByRequest.get(request.id) || []
    }));

    if (requestsError) {
        console.error("Erro ao carregar solicitações:", requestsError);
        renderRequestsError();
    } else {
        renderLegalRequests(requestsWithFiles);
    }

    if (propertyLeadsError) {
        console.error(
            "Erro ao carregar interesses em imóveis:",
            propertyLeadsError
        );
        renderPropertyLeadsError();
    } else {
        renderPropertyLeads(propertyLeadsData || []);
    }

    if (propertiesError) {
        console.error("Erro ao carregar imóveis:", propertiesError);
        renderPropertiesError();
    } else {
        renderProperties(properties || []);
    }

    if (postsError) {
        console.error("Erro ao carregar publicações no painel:", postsError);
        panelStatus.textContent = "Não foi possível carregar as publicações agora.";
        panelStatus.dataset.type = "error";
        return;
    }

    const publishedPosts = (posts || [])
        .filter((post) => post.published)
        .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    const draftPosts = (posts || []).filter((post) => !post.published);

    renderPostGroup(
        publishedList,
        publishedCount,
        publishedPosts,
        "Nenhum artigo publicado."
    );
    renderPostGroup(
        draftList,
        draftsCount,
        draftPosts,
        "Nenhum rascunho no momento."
    );

    const savedState = new URLSearchParams(window.location.search).get("salvo");

    if (savedState === "rascunho") {
        panelStatus.textContent = "Rascunho salvo com sucesso.";
        panelStatus.dataset.type = "success";
    } else if (savedState === "publicado") {
        panelStatus.textContent = "Artigo publicado com sucesso.";
        panelStatus.dataset.type = "success";
    } else if (savedState === "alteracoes") {
        panelStatus.textContent = "Alterações salvas com sucesso.";
        panelStatus.dataset.type = "success";
    } else if (savedState === "despublicado") {
        panelStatus.textContent = "Artigo retirado do site e movido para os rascunhos.";
        panelStatus.dataset.type = "success";
    } else {
        panelStatus.textContent = "";
    }
}

logoutButton?.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Saindo…";

    await window.supabaseClient?.auth.signOut();
    window.location.replace("./index.html");
});

loadAdminPanel();
