const propertyEditor = document.querySelector("[data-property-editor]");
const propertyLoading = document.querySelector("[data-property-loading]");
const propertyForm = document.querySelector("[data-property-form]");
const propertyStatus = document.querySelector("[data-property-status]");
const propertySaveButton = document.querySelector("[data-property-save]");
const propertyEyebrow = document.querySelector("[data-property-eyebrow]");
const propertyTitle = document.querySelector("[data-property-title]");

const params = new URLSearchParams(window.location.search);
const propertyId = params.get("id");

let currentProperty = null;
let isSaving = false;

function setPropertyStatus(message = "", type = "") {
    propertyStatus.textContent = message;

    if (type) {
        propertyStatus.dataset.type = type;
    } else {
        delete propertyStatus.dataset.type;
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
}

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

        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("id", currentProperty.id);
        window.history.replaceState({}, "", nextUrl);
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
