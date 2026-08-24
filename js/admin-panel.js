const panel = document.querySelector("[data-admin-panel]");
const panelStatus = document.querySelector("[data-panel-status]");
const adminName = document.querySelector("[data-admin-name]");
const requestsList = document.querySelector("[data-legal-requests]");
const requestsCount = document.querySelector("[data-requests-count]");
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

let legalRequests = [];

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

    content.append(status, title, meta);
    statusField.append(statusCaption, statusSelect);
    statusControl.append(statusField, statusFeedback);
    contact.append(phone, date, whatsapp, statusControl);
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

    const [requestsResult, postsResult] = await Promise.all([
        window.supabaseClient
            .from("legal_requests")
            .select("id, created_at, name, whatsapp, city, request_type, status")
            .order("created_at", { ascending: false }),
        window.supabaseClient
            .from("posts")
            .select("id, title, slug, category, published, published_at, updated_at")
            .order("updated_at", { ascending: false })
    ]);

    const { data: requests, error: requestsError } = requestsResult;
    const { data: posts, error: postsError } = postsResult;

    if (requestsError) {
        console.error("Erro ao carregar solicitações:", requestsError);
        renderRequestsError();
    } else {
        renderLegalRequests(requests || []);
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
