const panel = document.querySelector("[data-admin-panel]");
const panelStatus = document.querySelector("[data-panel-status]");
const adminName = document.querySelector("[data-admin-name]");
const publishedList = document.querySelector("[data-published-posts]");
const draftList = document.querySelector("[data-draft-posts]");
const publishedCount = document.querySelector("[data-published-count]");
const draftsCount = document.querySelector("[data-drafts-count]");
const logoutButton = document.querySelector("[data-logout]");

const adminDateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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

function createAdminPost(post) {
    const article = document.createElement("article");
    const content = document.createElement("div");
    const meta = document.createElement("p");
    const title = document.createElement("h3");
    const action = document.createElement("a");

    article.className = "admin-post";
    content.className = "admin-post__content";
    meta.className = "admin-post__meta";
    title.textContent = post.title;

    const dateValue = post.published ? post.published_at : post.updated_at;
    const dateLabel = post.published ? "Publicado em" : "Atualizado em";
    meta.textContent = `${post.category || "Sem categoria"} · ${dateLabel} ${formatAdminDate(dateValue)}`;

    action.className = "admin-post__action";
    action.href = `./editor.html?id=${encodeURIComponent(post.id)}`;
    action.textContent = "Editar →";
    action.setAttribute("aria-label", `Editar artigo: ${post.title}`);

    content.append(title, meta);
    article.append(content, action);
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

    const { data: posts, error: postsError } = await window.supabaseClient
        .from("posts")
        .select("id, title, slug, category, published, published_at, updated_at")
        .order("updated_at", { ascending: false });

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
