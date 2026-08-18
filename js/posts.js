const POSTS_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Belem"
});

function formatPostDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Data não informada";
    }

    const dateParts = POSTS_DATE_FORMATTER
        .formatToParts(date)
        .reduce((parts, part) => {
            parts[part.type] = part.value;
            return parts;
        }, {});

    return `${dateParts.day} ${dateParts.month.replace(".", "")} ${dateParts.year}`
        .toUpperCase();
}

function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
        element.className = className;
    }

    element.textContent = text;
    return element;
}

function createPublicationCard(post, index) {
    const article = document.createElement("a");
    const meta = document.createElement("div");
    const footer = document.createElement("div");
    const date = document.createElement("time");
    const action = document.createElement("span");

    article.className = "publication-card";
    article.href = `./publicacoes/artigo.html?slug=${encodeURIComponent(post.slug)}`;
    article.setAttribute("aria-label", `Ler artigo: ${post.title}`);
    article.dataset.slug = post.slug;

    meta.className = "publication-card__meta";
    meta.append(
        createTextElement("span", "", String(index + 1).padStart(2, "0")),
        createTextElement("span", "", post.category || "Publicação")
    );

    article.append(
        meta,
        createTextElement("h3", "", post.title)
    );

    if (post.excerpt) {
        article.append(createTextElement("p", "", post.excerpt));
    }

    footer.className = "publication-card__footer";
    date.dateTime = post.published_at || "";
    date.textContent = formatPostDate(post.published_at);

    action.className = "publication-card__action";
    action.append(
        "Ler artigo",
        createTextElement("span", "", "→")
    );

    footer.append(date, action);

    article.append(footer);
    return article;
}

function showPostsStatus(grid, message) {
    const status = createTextElement("p", "publications__status", message);
    grid.replaceChildren(status);
    grid.setAttribute("aria-busy", "false");
}

async function loadLatestPosts() {
    const grid = document.querySelector("[data-posts-grid]");

    if (!grid) {
        return;
    }

    if (!window.supabaseClient) {
        console.error("SUPABASE: cliente indisponível para carregar publicações.");
        showPostsStatus(grid, "Não foi possível carregar as publicações agora.");
        return;
    }

    const { data: posts, error } = await window.supabaseClient
        .from("posts")
        .select("title, slug, category, excerpt, published_at")
        .eq("published", true)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(3);

    if (error) {
        console.error("Erro ao carregar publicações:", error);
        showPostsStatus(grid, "Não foi possível carregar as publicações agora.");
        return;
    }

    if (!posts?.length) {
        showPostsStatus(grid, "Nenhuma publicação disponível no momento.");
        return;
    }

    const cards = posts.map((post, index) => createPublicationCard(post, index));
    grid.replaceChildren(...cards);
    grid.setAttribute("aria-busy", "false");
}

loadLatestPosts();
