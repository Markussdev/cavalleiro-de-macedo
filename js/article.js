const ARTICLE_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Belem"
});

const ARTICLE_ALLOWED_TAGS = [
    "p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em",
    "blockquote", "a", "br", "hr", "figure", "figcaption", "img",
    "code", "pre"
];

const ARTICLE_ALLOWED_ATTRIBUTES = [
    "href", "target", "rel", "src", "alt", "title", "width", "height", "loading"
];

function renderPlainArticleContent(container, content) {
    const paragraphs = content
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

    const elements = paragraphs.map((paragraph) => {
        const element = document.createElement("p");
        element.textContent = paragraph;
        return element;
    });

    container.replaceChildren(...elements);
}

function renderArticleContent(container, content) {
    const value = content?.trim();

    if (!value) {
        renderPlainArticleContent(container, "Conteúdo em preparação.");
        return;
    }

    const containsHtml = /<\/?[a-z][\s\S]*>/i.test(value);

    if (!containsHtml) {
        renderPlainArticleContent(container, value);
        return;
    }

    if (!window.DOMPurify) {
        console.error("ARTIGO: o sanitizador de conteúdo não foi carregado.");
        renderPlainArticleContent(container, value.replace(/<[^>]*>/g, ""));
        return;
    }

    const safeFragment = window.DOMPurify.sanitize(value, {
        RETURN_DOM_FRAGMENT: true,
        ALLOWED_TAGS: ARTICLE_ALLOWED_TAGS,
        ALLOWED_ATTR: ARTICLE_ALLOWED_ATTRIBUTES
    });

    safeFragment.querySelectorAll("a").forEach((link) => {
        link.rel = "noopener noreferrer";

        if (link.origin !== window.location.origin) {
            link.target = "_blank";
        }
    });

    safeFragment.querySelectorAll("img").forEach((image) => {
        image.loading = "lazy";
        image.decoding = "async";
    });

    container.replaceChildren(safeFragment);
}

function showArticleError(message) {
    const root = document.querySelector("[data-article-root]");
    const view = document.querySelector("[data-article-view]");
    const status = document.querySelector("[data-article-status]");

    view.hidden = true;
    status.hidden = false;
    status.querySelector("h1").textContent = "Publicação não encontrada";
    status.querySelector("p").textContent = message;
    root.setAttribute("aria-busy", "false");
    document.title = "Publicação não encontrada | Cavalleiro de Macedo";
}

async function loadArticle() {
    const root = document.querySelector("[data-article-root]");
    const view = document.querySelector("[data-article-view]");
    const status = document.querySelector("[data-article-status]");
    const slug = new URLSearchParams(window.location.search).get("slug")?.trim();

    if (!slug) {
        showArticleError("O endereço desta publicação está incompleto.");
        return;
    }

    if (!window.supabaseClient) {
        showArticleError("Não foi possível carregar esta publicação agora.");
        return;
    }

    const { data: post, error } = await window.supabaseClient
        .from("posts")
        .select("title, slug, category, excerpt, content, published_at")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();

    if (error) {
        console.error("Erro ao carregar publicação:", error);
        showArticleError("Não foi possível carregar esta publicação agora.");
        return;
    }

    if (!post) {
        showArticleError("O artigo informado não existe ou não está publicado.");
        return;
    }

    const category = document.querySelector("[data-article-category]");
    const date = document.querySelector("[data-article-date]");
    const title = document.querySelector("[data-article-title]");
    const excerpt = document.querySelector("[data-article-excerpt]");
    const content = document.querySelector("[data-article-content]");
    const description = document.querySelector('meta[name="description"]');

    category.textContent = post.category || "Publicação";
    date.dateTime = post.published_at || "";
    date.textContent = post.published_at
        ? ARTICLE_DATE_FORMATTER.format(new Date(post.published_at))
        : "Data não informada";
    title.textContent = post.title;

    if (post.excerpt) {
        excerpt.textContent = post.excerpt;
        excerpt.hidden = false;
        description?.setAttribute("content", post.excerpt);
    }

    renderArticleContent(content, post.content);

    document.title = `${post.title} | Cavalleiro de Macedo`;
    status.hidden = true;
    view.hidden = false;
    root.setAttribute("aria-busy", "false");
}

loadArticle();
