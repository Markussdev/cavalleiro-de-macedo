const editor = document.querySelector("[data-admin-editor]");
const editorLoading = document.querySelector("[data-editor-loading]");
const editorForm = document.querySelector("[data-editor-form]");
const editorStatus = document.querySelector("[data-editor-status]");
const editorEyebrow = document.querySelector("[data-editor-eyebrow]");
const editorTitle = document.querySelector("[data-editor-title]");
const titleInput = document.querySelector("[data-post-title]");
const categoryInput = document.querySelector("[data-post-category]");
const excerptInput = document.querySelector("[data-post-excerpt]");
const contentInput = document.querySelector("[data-post-content]");
const draftButton = document.querySelector("[data-save-draft]");
const publishButton = document.querySelector("[data-publish]");

const editorParams = new URLSearchParams(window.location.search);
const rawPostId = editorParams.get("id");
const postId = rawPostId && /^\d+$/.test(rawPostId)
    ? Number.parseInt(rawPostId, 10)
    : null;

let currentPost = null;
let editorIsSaving = false;

function setEditorStatus(message, type = "") {
    editorStatus.textContent = message;
    editorStatus.dataset.type = type;
}

function setEditorBusy(isBusy, action = "") {
    editorIsSaving = isBusy;
    editorForm.setAttribute("aria-busy", String(isBusy));
    draftButton.disabled = isBusy;
    publishButton.disabled = isBusy;

    draftButton.textContent = isBusy && action === "draft"
        ? "Salvando…"
        : "Salvar rascunho";
    publishButton.textContent = isBusy && action === "publish"
        ? "Publicando…"
        : "Publicar";
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
    contentInput.value = post.content || "";

    editorEyebrow.textContent = post.published ? "Artigo publicado" : "Editar rascunho";
    editorTitle.textContent = "Editar publicação";
    document.title = `Editar ${post.title} | Cavalleiro de Macedo`;
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

    if (shouldPublish && !values.content) {
        return "Escreva o conteúdo antes de publicar.";
    }

    return "";
}

async function savePost(action) {
    const shouldPublish = action === "publish";
    const values = {
        title: titleInput.value.trim(),
        category: categoryInput.value.trim(),
        excerpt: excerptInput.value.trim(),
        content: contentInput.value.trim()
    };
    const validationMessage = validatePost(values, shouldPublish);

    if (validationMessage) {
        setEditorStatus(validationMessage, "error");
        return;
    }

    setEditorBusy(true, action);
    setEditorStatus(shouldPublish ? "Publicando artigo…" : "Salvando rascunho…");

    try {
        const now = new Date().toISOString();
        const payload = {
            title: values.title,
            category: values.category || null,
            excerpt: values.excerpt || null,
            content: values.content || "",
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

        window.location.replace(
            `./painel.html?salvo=${shouldPublish ? "publicado" : "rascunho"}`
        );
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

editorForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (editorIsSaving) {
        return;
    }

    const action = event.submitter?.value === "publish" ? "publish" : "draft";
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

    if (postId) {
        const loaded = await loadExistingPost();

        if (!loaded) {
            return;
        }
    }

    editorLoading.hidden = true;
    editor.hidden = false;
    titleInput.focus();
}

initializeEditor();
