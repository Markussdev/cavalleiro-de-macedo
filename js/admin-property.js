const propertyEditor = document.querySelector("[data-property-editor]");
const propertyLoading = document.querySelector("[data-property-loading]");
const propertyForm = document.querySelector("[data-property-form]");
const propertyStatus = document.querySelector("[data-property-status]");
const propertySaveButton = document.querySelector("[data-property-save]");
const propertyEyebrow = document.querySelector("[data-property-eyebrow]");
const propertyTitle = document.querySelector("[data-property-title]");
const propertyImagesLocked = document.querySelector("[data-property-images-locked]");
const propertyImagesManager = document.querySelector("[data-property-images-manager]");
const propertyImagesInput = document.querySelector("[data-property-images-input]");
const propertyImagesGrid = document.querySelector("[data-property-images-grid]");
const propertyImagesStatus = document.querySelector("[data-property-images-status]");

const params = new URLSearchParams(window.location.search);
const propertyId = params.get("id");

let currentProperty = null;
let isSaving = false;
let propertyImages = [];
let isUploadingImages = false;

const MAX_PROPERTY_IMAGES = 15;
const MAX_PROPERTY_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_PROPERTY_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

function setPropertyStatus(message = "", type = "") {
    propertyStatus.textContent = message;

    if (type) {
        propertyStatus.dataset.type = type;
    } else {
        delete propertyStatus.dataset.type;
    }
}

function setPropertyImagesStatus(message = "", type = "") {
    if (!propertyImagesStatus) {
        return;
    }

    propertyImagesStatus.textContent = message;

    if (type) {
        propertyImagesStatus.dataset.type = type;
    } else {
        delete propertyImagesStatus.dataset.type;
    }
}

function updatePropertyImagesState() {
    const hasProperty = Boolean(currentProperty?.id);

    if (propertyImagesLocked) {
        propertyImagesLocked.hidden = hasProperty;
    }

    if (propertyImagesManager) {
        propertyImagesManager.hidden = !hasProperty;
    }
}

function getPropertyImageUrl(storagePath) {
    const { data } = window.supabaseClient
        .storage
        .from("property-images")
        .getPublicUrl(storagePath);

    return data?.publicUrl || "";
}

function validatePropertyImage(file) {
    if (!ALLOWED_PROPERTY_IMAGE_TYPES.has(file.type)) {
        return "Formato não permitido. Use JPG, PNG ou WebP.";
    }

    if (file.size > MAX_PROPERTY_IMAGE_SIZE) {
        return "A imagem ultrapassa 10 MB.";
    }

    if (file.size <= 0) {
        return "A imagem está vazia.";
    }

    return "";
}

function createPropertyImageCard(image) {
    const article = document.createElement("article");
    const preview = document.createElement("div");
    const img = document.createElement("img");
    const body = document.createElement("div");
    const name = document.createElement("p");
    const actions = document.createElement("div");
    const coverButton = document.createElement("button");
    const removeButton = document.createElement("button");
    const imageName = image.original_name || "Imagem do imóvel";

    article.className = "property-image";
    article.dataset.propertyImageId = image.id;
    preview.className = "property-image__preview";
    body.className = "property-image__body";
    name.className = "property-image__name";
    actions.className = "property-image__actions";

    img.src = getPropertyImageUrl(image.storage_path);
    img.alt = image.alt_text || currentProperty?.title || "Foto do imóvel";
    img.loading = "lazy";

    name.textContent = imageName;
    name.title = imageName;

    preview.append(img);

    if (image.is_cover) {
        const coverLabel = document.createElement("span");

        coverLabel.className = "property-image__cover";
        coverLabel.textContent = "Capa";
        preview.append(coverLabel);

        coverButton.textContent = "Capa atual";
        coverButton.disabled = true;
    } else {
        coverButton.textContent = "Definir como capa";
    }

    coverButton.type = "button";
    coverButton.className = "property-image__action";
    coverButton.setAttribute("aria-label", `Definir ${imageName} como foto de capa`);
    coverButton.addEventListener("click", () => {
        setPropertyCover(image, coverButton);
    });

    removeButton.type = "button";
    removeButton.className = "property-image__action property-image__action--remove";
    removeButton.textContent = "Remover";
    removeButton.setAttribute("aria-label", `Remover ${imageName}`);
    removeButton.addEventListener("click", () => {
        removePropertyImage(image, removeButton);
    });

    actions.append(coverButton, removeButton);
    body.append(name, actions);
    article.append(preview, body);

    return article;
}

function renderPropertyImages() {
    if (!propertyImagesGrid) {
        return;
    }

    if (!propertyImages.length) {
        const empty = document.createElement("p");

        empty.className = "admin-posts__empty";
        empty.textContent = "Nenhuma foto adicionada.";
        propertyImagesGrid.replaceChildren(empty);
        return;
    }

    propertyImagesGrid.replaceChildren(
        ...propertyImages.map(createPropertyImageCard)
    );
}

async function loadPropertyImages() {
    if (!currentProperty?.id) {
        propertyImages = [];
        renderPropertyImages();
        return;
    }

    const { data, error } = await window.supabaseClient
        .from("property_images")
        .select(`
            id,
            property_id,
            storage_path,
            original_name,
            mime_type,
            size_bytes,
            alt_text,
            sort_order,
            is_cover
        `)
        .eq("property_id", currentProperty.id)
        .order("sort_order", { ascending: true });

    if (error) {
        throw error;
    }

    propertyImages = data || [];
    renderPropertyImages();
}

async function uploadPropertyImage(file) {
    if (!currentProperty?.id) {
        throw new Error("Salve o imóvel antes de adicionar fotos.");
    }

    const extension = file.name
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        || "jpg";
    const imageId = crypto.randomUUID();
    const storagePath = `${currentProperty.id}/${imageId}.${extension}`;
    const { error: uploadError } = await window.supabaseClient
        .storage
        .from("property-images")
        .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (uploadError) {
        throw uploadError;
    }

    const shouldBeCover = propertyImages.length === 0;
    const sortOrder = propertyImages.length
        ? Math.max(
            ...propertyImages.map((image) => Number(image.sort_order) || 0)
        ) + 1
        : 0;
    const { data, error: metadataError } = await window.supabaseClient
        .from("property_images")
        .insert({
            property_id: currentProperty.id,
            storage_path: storagePath,
            original_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            sort_order: sortOrder,
            is_cover: shouldBeCover,
            alt_text: currentProperty.title
        })
        .select()
        .single();

    if (metadataError || !data) {
        const { error: cleanupError } = await window.supabaseClient
            .storage
            .from("property-images")
            .remove([storagePath]);

        if (cleanupError) {
            console.error("Erro ao limpar imagem sem metadados:", cleanupError);
        }

        throw metadataError || new Error("Os metadados da imagem não foram salvos.");
    }

    propertyImages.push(data);
    propertyImages.sort(
        (a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
    );
}

async function setPropertyCover(image, button) {
    if (!currentProperty?.id || image.is_cover) {
        return;
    }

    button.disabled = true;
    button.textContent = "Salvando…";
    setPropertyImagesStatus();

    try {
        const { error: clearError } = await window.supabaseClient
            .from("property_images")
            .update({ is_cover: false })
            .eq("property_id", currentProperty.id)
            .select("id");

        if (clearError) {
            throw clearError;
        }

        const { data: updatedCover, error: coverError } = await window.supabaseClient
            .from("property_images")
            .update({ is_cover: true })
            .eq("id", image.id)
            .eq("property_id", currentProperty.id)
            .select("id")
            .maybeSingle();

        if (coverError || !updatedCover) {
            throw coverError || new Error("A foto selecionada não foi encontrada.");
        }

        propertyImages.forEach((item) => {
            item.is_cover = item.id === image.id;
        });

        renderPropertyImages();
        setPropertyImagesStatus("Foto de capa atualizada.", "success");
    } catch (error) {
        console.error("Erro ao definir capa:", error);

        try {
            await loadPropertyImages();
        } catch {
            // Mantém o erro principal da troca de capa.
        }

        setPropertyImagesStatus("Não foi possível alterar a capa.", "error");
    }
}

async function removePropertyImage(image, button) {
    const confirmed = window.confirm(
        `Remover a foto "${image.original_name || "selecionada"}"?`
    );

    if (!confirmed || !currentProperty?.id) {
        return;
    }

    button.disabled = true;
    button.textContent = "Removendo…";
    setPropertyImagesStatus();

    try {
        const { data: deletedImage, error: databaseError } = await window.supabaseClient
            .from("property_images")
            .delete()
            .eq("id", image.id)
            .eq("property_id", currentProperty.id)
            .select("id")
            .maybeSingle();

        if (databaseError || !deletedImage) {
            throw databaseError || new Error("A foto selecionada não foi encontrada.");
        }

        const { error: storageError } = await window.supabaseClient
            .storage
            .from("property-images")
            .remove([image.storage_path]);

        if (storageError) {
            console.error("Arquivo não pôde ser removido do Storage:", storageError);
        }

        const wasCover = Boolean(image.is_cover);
        let coverPromotionError = null;

        propertyImages = propertyImages.filter((item) => item.id !== image.id);

        if (wasCover && propertyImages.length) {
            const nextCover = propertyImages[0];
            const { data: promotedCover, error } = await window.supabaseClient
                .from("property_images")
                .update({ is_cover: true })
                .eq("id", nextCover.id)
                .eq("property_id", currentProperty.id)
                .select("id")
                .maybeSingle();

            coverPromotionError = error || (!promotedCover
                ? new Error("A nova foto de capa não foi encontrada.")
                : null);

            if (!coverPromotionError) {
                nextCover.is_cover = true;
            } else {
                console.error("Erro ao definir nova capa:", coverPromotionError);
            }
        }

        renderPropertyImages();

        if (coverPromotionError) {
            setPropertyImagesStatus(
                "Foto removida, mas não foi possível definir uma nova capa.",
                "error"
            );
        } else if (storageError) {
            setPropertyImagesStatus(
                "Foto removida do painel, mas o arquivo não pôde ser limpo do Storage.",
                "error"
            );
        } else {
            setPropertyImagesStatus("Foto removida.", "success");
        }
    } catch (error) {
        console.error("Erro ao remover foto:", error);
        setPropertyImagesStatus("Não foi possível remover a foto.", "error");
        button.disabled = false;
        button.textContent = "Remover";
    }
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

    const { data: membership, error: membershipError } = await window.supabaseClient
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    return !membershipError && Boolean(membership);
}

function createSlug(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120)
        || "imovel";
}

async function createUniqueSlug(title) {
    const base = createSlug(title);

    for (let suffix = 1; suffix <= 50; suffix += 1) {
        const candidate = suffix === 1 ? base : `${base}-${suffix}`;
        const { data, error } = await window.supabaseClient
            .from("properties")
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

    throw new Error("Não foi possível gerar um endereço para o imóvel.");
}

function optionalNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function getPropertyValues() {
    const formData = new FormData(propertyForm);

    return {
        title: formData.get("title")?.trim(),
        purpose: formData.get("purpose"),
        property_type: formData.get("property_type"),
        price: optionalNumber(formData.get("price")),
        price_on_request: formData.get("price_on_request") === "on",
        city: formData.get("city")?.trim(),
        state: formData.get("state"),
        neighborhood: formData.get("neighborhood")?.trim() || null,
        bedrooms: optionalNumber(formData.get("bedrooms")),
        bathrooms: optionalNumber(formData.get("bathrooms")),
        parking_spots: optionalNumber(formData.get("parking_spots")),
        area_m2: optionalNumber(formData.get("area_m2")),
        description: formData.get("description")?.trim() || null,
        status: formData.get("status") || "draft",
        featured: formData.get("featured") === "on"
    };
}

function validateProperty(values) {
    if (!values.title) {
        return "Informe um título.";
    }

    if (!values.purpose) {
        return "Escolha venda ou locação.";
    }

    if (!values.property_type) {
        return "Escolha o tipo do imóvel.";
    }

    if (!values.city) {
        return "Informe a cidade.";
    }

    if (!values.state) {
        return "Informe o estado.";
    }

    if (!values.price_on_request && values.price === null) {
        return "Informe o preço ou marque “Valor sob consulta”.";
    }

    return "";
}

function setSaving(value) {
    isSaving = value;
    propertyForm.setAttribute("aria-busy", String(value));
    propertySaveButton.disabled = value;
    propertySaveButton.textContent = value ? "Salvando…" : "Salvar imóvel";
}

function fillPropertyForm(property) {
    const fields = [
        "title",
        "purpose",
        "property_type",
        "price",
        "city",
        "state",
        "neighborhood",
        "bedrooms",
        "bathrooms",
        "parking_spots",
        "area_m2",
        "description",
        "status"
    ];

    fields.forEach((field) => {
        if (propertyForm.elements[field]) {
            propertyForm.elements[field].value = property[field] ?? "";
        }
    });

    propertyForm.elements.price_on_request.checked = Boolean(property.price_on_request);
    propertyForm.elements.featured.checked = Boolean(property.featured);
}

function showEditingState(property) {
    propertyEyebrow.textContent = "Editar imóvel";
    propertyTitle.textContent = property.title;
    document.title = `Editar ${property.title} | Cavalleiro de Macedo`;
}

async function loadProperty(id) {
    const { data, error } = await window.supabaseClient
        .from("properties")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        throw new Error("Imóvel não encontrado.");
    }

    currentProperty = data;
    fillPropertyForm(data);
    showEditingState(data);
    updatePropertyImagesState();

    try {
        await loadPropertyImages();
    } catch (imagesError) {
        console.error("Erro ao carregar fotos do imóvel:", imagesError);
        setPropertyImagesStatus("Não foi possível carregar as fotos.", "error");
    }
}

propertyImagesInput?.addEventListener("change", async () => {
    if (isUploadingImages || !currentProperty?.id) {
        return;
    }

    const files = Array.from(propertyImagesInput.files || []);
    propertyImagesInput.value = "";

    if (!files.length) {
        return;
    }

    const availableSlots = MAX_PROPERTY_IMAGES - propertyImages.length;

    if (availableSlots <= 0) {
        setPropertyImagesStatus(
            "Este imóvel já possui o limite de 15 fotos.",
            "error"
        );
        return;
    }

    const acceptedFiles = [];

    for (const file of files) {
        const validationError = validatePropertyImage(file);

        if (validationError) {
            setPropertyImagesStatus(`${file.name}: ${validationError}`, "error");
            continue;
        }

        if (acceptedFiles.length >= availableSlots) {
            continue;
        }

        acceptedFiles.push(file);
    }

    if (!acceptedFiles.length) {
        return;
    }

    const skippedFiles = files.length - acceptedFiles.length;

    isUploadingImages = true;
    propertyImagesInput.disabled = true;
    propertyImagesManager?.setAttribute("aria-busy", "true");

    try {
        for (let index = 0; index < acceptedFiles.length; index += 1) {
            setPropertyImagesStatus(
                `Enviando ${index + 1} de ${acceptedFiles.length}...`
            );

            await uploadPropertyImage(acceptedFiles[index]);
            renderPropertyImages();
        }

        const uploadedMessage = acceptedFiles.length === 1
            ? "Foto adicionada com sucesso."
            : `${acceptedFiles.length} fotos adicionadas com sucesso.`;
        const skippedMessage = skippedFiles
            ? ` ${skippedFiles} ${skippedFiles === 1 ? "arquivo foi ignorado" : "arquivos foram ignorados"}.`
            : "";

        setPropertyImagesStatus(`${uploadedMessage}${skippedMessage}`, "success");
    } catch (error) {
        console.error("Erro ao enviar fotos:", error);
        setPropertyImagesStatus(
            "Não foi possível enviar todas as fotos.",
            "error"
        );
    } finally {
        isUploadingImages = false;
        propertyImagesInput.disabled = false;
        propertyImagesManager?.setAttribute("aria-busy", "false");
    }
});

propertyForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSaving) {
        return;
    }

    const values = getPropertyValues();
    const validationError = validateProperty(values);

    if (validationError) {
        setPropertyStatus(validationError, "error");
        return;
    }

    setSaving(true);
    setPropertyStatus();

    try {
        const slug = currentProperty?.slug || await createUniqueSlug(values.title);
        const payload = {
            ...values,
            slug,
            updated_at: new Date().toISOString()
        };

        const result = currentProperty
            ? await window.supabaseClient
                .from("properties")
                .update(payload)
                .eq("id", currentProperty.id)
                .select()
                .single()
            : await window.supabaseClient
                .from("properties")
                .insert(payload)
                .select()
                .single();

        if (result.error || !result.data) {
            throw result.error || new Error("O imóvel não foi salvo.");
        }

        currentProperty = result.data;
        setPropertyStatus("Imóvel salvo com sucesso.", "success");
        showEditingState(currentProperty);
        updatePropertyImagesState();

        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("id", currentProperty.id);
        window.history.replaceState({}, "", nextUrl);

        try {
            await loadPropertyImages();
        } catch (imagesError) {
            console.error("Erro ao carregar fotos do imóvel:", imagesError);
            setPropertyImagesStatus("Não foi possível carregar as fotos.", "error");
        }
    } catch (error) {
        console.error("Erro ao salvar imóvel:", error);
        setPropertyStatus("Não foi possível salvar o imóvel.", "error");
    } finally {
        setSaving(false);
    }
});

async function initPropertyEditor() {
    try {
        const isAdmin = await requireAdmin();

        if (!isAdmin) {
            window.location.replace("./index.html?erro=acesso");
            return;
        }

        updatePropertyImagesState();

        if (propertyId) {
            await loadProperty(propertyId);
        }

        propertyLoading.hidden = true;
        propertyEditor.hidden = false;
        propertyForm.elements.title.focus();
    } catch (error) {
        console.error("Erro ao iniciar editor de imóvel:", error);
        propertyLoading.textContent = "Não foi possível carregar o editor.";
        propertyLoading.dataset.type = "error";
    }
}

initPropertyEditor();
