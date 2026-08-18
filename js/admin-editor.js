const editor = document.querySelector("[data-admin-editor]");
const editorLoading = document.querySelector("[data-editor-loading]");
const editorForm = document.querySelector("[data-editor-form]");
const editorStatus = document.querySelector("[data-editor-status]");
const editorEyebrow = document.querySelector("[data-editor-eyebrow]");
const editorTitle = document.querySelector("[data-editor-title]");
const titleInput = document.querySelector("[data-post-title]");
const categoryInput = document.querySelector("[data-post-category]");
const excerptInput = document.querySelector("[data-post-excerpt]");
const contentEditor = document.querySelector("[data-post-content-editor]");
const saveButton = document.querySelector("[data-save]");
const primaryActionButton = document.querySelector("[data-primary-action]");

const editorParams = new URLSearchParams(window.location.search);
const rawPostId = editorParams.get("id");
const postId = rawPostId && /^\d+$/.test(rawPostId)
    ? Number.parseInt(rawPostId, 10)
    : null;

const allowedContentTags = [
    "p",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "blockquote",
    "a",
    "br"
];
const allowedContentAttributes = ["href", "target", "rel"];

let currentPost = null;
let quill = null;
let editorIsSaving = false;
let editorIsReady = false;
let editorIsDirty = false;

function setEditorStatus(message, type = "") {
    editorStatus.textContent = message;
    editorStatus.dataset.type = type;
}

function getEditorState() {
    if (!currentPost) {
        return "new";
    }

    return currentPost.published ? "published" : "draft";
}

function updateEditorActions() {
    const editorState = getEditorState();

    saveButton.textContent = editorState === "new"
        ? "Salvar rascunho"
        : "Salvar alterações";

    primaryActionButton.classList.toggle(
        "admin-button--danger",
        editorState === "published"
    );
    primaryActionButton.value = editorState === "published"
        ? "unpublish"
        : "publish";
    primaryActionButton.textContent = editorState === "published"
        ? "Despublicar"
        : "Publicar";
}

function setEditorBusy(isBusy, action = "") {
    editorIsSaving = isBusy;
    editorForm.setAttribute("aria-busy", String(isBusy));
    saveButton.disabled = isBusy;
    primaryActionButton.disabled = isBusy;

    if (!isBusy) {
        updateEditorActions();
        return;
    }

    if (action === "save") {
        saveButton.textContent = "Salvando…";
    } else if (action === "publish") {
        primaryActionButton.textContent = "Publicando…";
    } else if (action === "unpublish") {
        primaryActionButton.textContent = "Despublicando…";
    }
}

function sanitizeContent(html) {
    return window.DOMPurify.sanitize(html || "", {
        ALLOWED_TAGS: allowedContentTags,
        ALLOWED_ATTR: allowedContentAttributes
    });
}

function initializeRichEditor() {
    if (!window.Quill || !window.DOMPurify || !contentEditor) {
        return false;
    }

    quill = new window.Quill(contentEditor, {
        theme: "snow",
        placeholder: "Comece a escrever o artigo…",
        modules: {
            toolbar: "#editor-toolbar"
        },
        formats: [
            "header",
            "bold",
            "italic",
            "list",
            "blockquote",
            "link"
        ]
    });

    const editableArea = contentEditor.querySelector(".ql-editor");

    editableArea?.setAttribute("aria-labelledby", "post-content-label");
    editableArea?.setAttribute("aria-describedby", "content-help");
    editableArea?.setAttribute("role", "textbox");
    editableArea?.setAttribute("aria-multiline", "true");

    quill.on("text-change", (_delta, _oldDelta, source) => {
        if (editorIsReady && source === "user") {
            editorIsDirty = true;
        }
    });

    return true;
}

function setRichEditorContent(content) {
    const safeContent = sanitizeContent(content);

    if (safeContent.trim()) {
        quill.clipboard.dangerouslyPasteHTML(safeContent, "api");
    } else {
        quill.setText("", "api");
    }

    quill.getModule("history")?.clear();
}

function getRichEditorValues() {
    const plainContent = quill.getText().trim();
    const content = plainContent
        ? sanitizeContent(quill.getSemanticHTML().trim())
        : "";

    return { content, plainContent };
}

function createSlug(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120)
        .replace(/-+$/g, "") || "artigo";
}

async function createUniqueSlug(title) {
    const baseSlug = createSlug(title);

    for (let suffix = 1; suffix <= 50; suffix += 1) {
        const candidate = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`;
        const { data, error } = await window.supabaseClient
            .from("posts")
            .select("id")
            .eq("slug", candidate)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            return candidate;
        }
    }

    throw new Error("Não foi possível criar um endereço único para o artigo.");
}

async function getAdminMembership(userId) {
    return window.supabaseClient
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
}

async function requireAdmin() {
    if (!window.supabaseClient) {
        return false;
    }

    const {
        data: { user },
        error: userError
    } = await window.supabaseClient.auth.getUser();

    if (userError || !user) {
        return false;
    }

    const { data: membership, error: membershipError } = await getAdminMembership(user.id);
    return !membershipError && Boolean(membership);
}

function addCurrentCategory(category) {
    if (!category) {
        return;
    }

    const categoryExists = Array.from(categoryInput.options)
        .some((option) => option.value === category);

    if (!categoryExists) {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryInput.append(option);
    }
}

function fillEditor(post) {
    currentPost = post;
    titleInput.value = post.title || "";
    addCurrentCategory(post.category);
    categoryInput.value = post.category || "";
    excerptInput.value = post.excerpt || "";
    setRichEditorContent(post.content || "");

    editorEyebrow.textContent = post.published ? "Artigo publicado" : "Editar rascunho";
    editorTitle.textContent = "Editar publicação";
    document.title = `Editar ${post.title} | Cavalleiro de Macedo`;
    updateEditorActions();
}

function showEditorError(message) {
    editorLoading.textContent = message;
    editorLoading.dataset.type = "error";
}

async function loadExistingPost() {
    const { data: post, error } = await window.supabaseClient
        .from("posts")
        .select("id, title, slug, category, excerpt, content, published, published_at")
        .eq("id", postId)
        .maybeSingle();

    if (error) {
        console.error("Erro ao carregar artigo no editor:", error);
        showEditorError("Não foi possível carregar este artigo agora.");
        return false;
    }

    if (!post) {
        showEditorError("O artigo informado não foi encontrado.");
        return false;
    }

    fillEditor(post);
    return true;
}

function validatePost(values, shouldPublish) {
    if (!values.title) {
        return "Informe o título do artigo.";
    }

    if (shouldPublish && !values.category) {
        return "Escolha uma categoria antes de publicar.";
    }

    if (shouldPublish && !values.excerpt) {
        return "Escreva um resumo antes de publicar.";
    }

    if (shouldPublish && !values.plainContent) {
        return "Escreva o conteúdo antes de publicar.";
    }

    return "";
}

function getNextPublishedState(action) {
    if (action === "publish") {
        return true;
    }

    if (action === "unpublish") {
        return false;
    }

    return Boolean(currentPost?.published);
}

function getRedirectState(action) {
    if (action === "publish") {
        return "publicado";
    }

    if (action === "unpublish") {
        return "despublicado";
    }

    return currentPost ? "alteracoes" : "rascunho";
}

function getSavingMessage(action) {
    if (action === "publish") {
        return "Publicando artigo…";
    }

    if (action === "unpublish") {
        return "Retirando publicação do site…";
    }

    return currentPost ? "Salvando alterações…" : "Salvando rascunho…";
}

async function savePost(action) {
    if (action === "unpublish") {
        const confirmed = window.confirm(
            "Deseja retirar esta publicação do site? Ela voltará para os rascunhos."
        );

        if (!confirmed) {
            return;
        }
    }

    const shouldPublish = getNextPublishedState(action);
    const richEditorValues = getRichEditorValues();
    const values = {
        title: titleInput.value.trim(),
        category: categoryInput.value.trim(),
        excerpt: excerptInput.value.trim(),
        ...richEditorValues
    };
    const validationMessage = validatePost(values, shouldPublish);

    if (validationMessage) {
        setEditorStatus(validationMessage, "error");
        return;
    }

    setEditorBusy(true, action);
    setEditorStatus(getSavingMessage(action));

    try {
        const now = new Date().toISOString();
        const payload = {
            title: values.title,
            category: values.category || null,
            excerpt: values.excerpt || null,
            content: values.content,
            published: shouldPublish,
            published_at: shouldPublish
                ? currentPost?.published_at || now
                : null,
            updated_at: now
        };

        let result;

        if (currentPost) {
            result = await window.supabaseClient
                .from("posts")
                .update(payload)
                .eq("id", currentPost.id)
                .select("id, slug, published")
                .single();
        } else {
            payload.slug = await createUniqueSlug(values.title);
            result = await window.supabaseClient
                .from("posts")
                .insert(payload)
                .select("id, slug, published")
                .single();
        }

        if (result.error || !result.data) {
            throw result.error || new Error("A publicação não foi salva.");
        }

        editorIsDirty = false;
        window.location.replace(`./painel.html?salvo=${getRedirectState(action)}`);
    } catch (error) {
        console.error("Erro ao salvar publicação:", error);

        if (error?.code === "23505") {
            setEditorStatus("Já existe um artigo com este endereço. Tente outro título.", "error");
        } else {
            setEditorStatus("Não foi possível salvar agora. Tente novamente.", "error");
        }
    } finally {
        setEditorBusy(false);
    }
}

function markEditorDirty() {
    if (editorIsReady) {
        editorIsDirty = true;
    }
}

[titleInput, categoryInput, excerptInput].forEach((field) => {
    field?.addEventListener("input", markEditorDirty);
    field?.addEventListener("change", markEditorDirty);
});

window.addEventListener("beforeunload", (event) => {
    if (!editorIsDirty || editorIsSaving) {
        return;
    }

    event.preventDefault();
    event.returnValue = "";
});

editorForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (editorIsSaving) {
        return;
    }

    const submittedAction = event.submitter?.value;
    const action = ["save", "publish", "unpublish"].includes(submittedAction)
        ? submittedAction
        : "save";

    savePost(action);
});

async function initializeEditor() {
    if (rawPostId && !postId) {
        showEditorError("O endereço deste artigo é inválido.");
        return;
    }

    const isAdmin = await requireAdmin();

    if (!isAdmin) {
        window.location.replace("./index.html?erro=acesso");
        return;
    }

    if (!initializeRichEditor()) {
        showEditorError("Não foi possível carregar o editor de texto agora.");
        return;
    }

    if (postId) {
        const loaded = await loadExistingPost();

        if (!loaded) {
            return;
        }
    } else {
        updateEditorActions();
    }

    editorLoading.hidden = true;
    editor.hidden = false;
    quill.update("silent");
    editorIsReady = true;
    editorIsDirty = false;
    titleInput.focus();
}

initializeEditor();
