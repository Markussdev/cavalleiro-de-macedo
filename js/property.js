const propertyPage = document.querySelector("[data-property-page]");
const propertyLoading = document.querySelector("[data-property-loading]");
const propertyNotFound = document.querySelector("[data-property-not-found]");
const propertyTitle = document.querySelector("[data-property-title]");
const propertyPurpose = document.querySelector("[data-property-purpose]");
const propertyLocation = document.querySelector("[data-property-location]");
const propertyPrice = document.querySelector("[data-property-price]");
const propertyMainImage = document.querySelector("[data-property-main-image]");
const propertyThumbnails = document.querySelector("[data-property-thumbnails]");
const propertyFeatures = document.querySelector("[data-property-features]");
const propertyDescription = document.querySelector("[data-property-description]");
const propertyInterest = document.querySelector("[data-property-interest]");
const propertyInterestIntro = document.querySelector("[data-property-interest-intro]");
const propertyInterestForm = document.querySelector("[data-property-interest-form]");
const propertyInterestName = document.querySelector("[data-property-interest-name]");
const propertyInterestWhatsapp = document.querySelector("[data-property-interest-whatsapp]");
const propertyInterestConsent = document.querySelector("[data-property-interest-consent]");
const propertyInterestStatus = document.querySelector("[data-property-interest-status]");
const propertyInterestSubmit = document.querySelector("[data-property-interest-submit]");
const propertyInterestCancel = document.querySelector("[data-property-interest-cancel]");
const propertyInterestSuccess = document.querySelector("[data-property-interest-success]");

const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

let currentProperty = null;
let isSendingInterest = false;

const priceFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

const purposeLabels = {
    sale: "Venda",
    rent: "Locação"
};

function getImageUrl(path) {
    if (!path) {
        return "";
    }

    const { data } = window.supabaseClient
        .storage
        .from("property-images")
        .getPublicUrl(path);

    return data?.publicUrl || "";
}

function formatLocation(property) {
    return [property.neighborhood, property.city, property.state]
        .filter(Boolean)
        .join(" · ");
}

function formatPrice(property) {
    if (
        property.price_on_request
        || property.price === null
        || property.price === undefined
    ) {
        return "Valor sob consulta";
    }

    const value = priceFormatter.format(Number(property.price));

    return property.purpose === "rent" ? `${value} / mês` : value;
}

function normalizeWhatsapp(value) {
    return String(value || "").replace(/\D/g, "");
}

function setInterestStatus(message = "", type = "") {
    if (!propertyInterestStatus) {
        return;
    }

    propertyInterestStatus.textContent = message;

    if (type) {
        propertyInterestStatus.dataset.type = type;
    } else {
        delete propertyInterestStatus.dataset.type;
    }
}

function setInterestFormOpen(open) {
    if (!propertyInterestForm || !propertyInterestIntro) {
        return;
    }

    propertyInterestForm.hidden = !open;
    propertyInterestIntro.hidden = open;
    propertyInterest?.setAttribute("aria-expanded", String(open));

    if (open) {
        setInterestStatus();
        window.setTimeout(() => propertyInterestName?.focus(), 50);
    } else {
        window.setTimeout(() => propertyInterest?.focus(), 50);
    }
}

function setInterestSubmitting(sending) {
    propertyInterestForm?.setAttribute("aria-busy", String(sending));

    if (propertyInterestSubmit) {
        propertyInterestSubmit.disabled = sending;

        if (sending) {
            propertyInterestSubmit.textContent = "Enviando…";
        } else {
            const arrow = document.createElement("span");

            arrow.setAttribute("aria-hidden", "true");
            arrow.textContent = "→";
            propertyInterestSubmit.replaceChildren(
                document.createTextNode("Solicitar informações "),
                arrow
            );
        }
    }

    if (propertyInterestCancel) {
        propertyInterestCancel.disabled = sending;
    }
}

function validateInterestForm() {
    const name = propertyInterestName?.value.trim() || "";
    const whatsapp = normalizeWhatsapp(propertyInterestWhatsapp?.value);
    const consent = Boolean(propertyInterestConsent?.checked);

    if (name.length < 2 || name.length > 120) {
        return {
            error: "Informe seu nome.",
            name,
            whatsapp,
            consent
        };
    }

    if (whatsapp.length < 10 || whatsapp.length > 15) {
        return {
            error: "Informe um WhatsApp válido.",
            name,
            whatsapp,
            consent
        };
    }

    if (!consent) {
        return {
            error: "É necessário autorizar o envio dos dados.",
            name,
            whatsapp,
            consent
        };
    }

    return {
        error: "",
        name,
        whatsapp,
        consent
    };
}

function renderDescription(description) {
    const text = description?.trim()
        || "Entre em contato para mais informações sobre este imóvel.";
    const paragraphs = text
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => {
            const element = document.createElement("p");

            element.textContent = paragraph;
            return element;
        });

    propertyDescription.replaceChildren(...paragraphs);
}

function renderFeatures(property) {
    const features = [];

    if (Number(property.bedrooms) > 0) {
        features.push({
            label: "Quartos",
            value: property.bedrooms
        });
    }

    if (Number(property.bathrooms) > 0) {
        features.push({
            label: "Banheiros",
            value: property.bathrooms
        });
    }

    if (Number(property.parking_spots) > 0) {
        features.push({
            label: "Vagas",
            value: property.parking_spots
        });
    }

    if (Number(property.area_m2) > 0) {
        features.push({
            label: "Área",
            value: `${Number(property.area_m2).toLocaleString("pt-BR")} m²`
        });
    }

    propertyFeatures.replaceChildren(
        ...features.map((feature) => {
            const item = document.createElement("div");
            const label = document.createElement("dt");
            const value = document.createElement("dd");

            value.textContent = feature.value;
            label.textContent = feature.label;
            item.append(value, label);

            return item;
        })
    );
}

function renderGallery(property) {
    const images = Array.isArray(property.property_images)
        ? [...property.property_images]
        : [];

    images.sort(
        (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
    );

    if (!images.length) {
        propertyMainImage.removeAttribute("src");
        propertyMainImage.alt = "Imagem indisponível";
        propertyThumbnails.replaceChildren();
        return;
    }

    const cover = images.find((image) => image.is_cover) || images[0];

    propertyMainImage.src = getImageUrl(cover.storage_path);
    propertyMainImage.alt = cover.alt_text || property.title;
    propertyMainImage.decoding = "async";

    const thumbnails = images.map((image, index) => {
        const button = document.createElement("button");
        const img = document.createElement("img");
        const isCover = image.id === cover.id;

        button.type = "button";
        button.className = "property-gallery__thumb";
        button.setAttribute("aria-label", `Exibir foto ${index + 1} de ${images.length}`);
        button.setAttribute("aria-pressed", String(isCover));

        img.src = getImageUrl(image.storage_path);
        img.alt = image.alt_text || property.title;
        img.loading = "lazy";
        img.decoding = "async";
        button.append(img);

        button.addEventListener("click", () => {
            propertyMainImage.src = img.src;
            propertyMainImage.alt = img.alt;

            propertyThumbnails
                .querySelectorAll(".property-gallery__thumb")
                .forEach((item) => {
                    const active = item === button;

                    item.classList.toggle("is-active", active);
                    item.setAttribute("aria-pressed", String(active));
                });
        });

        if (isCover) {
            button.classList.add("is-active");
        }

        return button;
    });

    propertyThumbnails.replaceChildren(...thumbnails);
}

function renderProperty(property) {
    currentProperty = property;

    propertyTitle.textContent = property.title;
    propertyPurpose.textContent = purposeLabels[property.purpose] || "Imóvel";
    propertyLocation.textContent = formatLocation(property) || "Localização sob consulta";
    propertyPrice.textContent = formatPrice(property);
    renderDescription(property.description);

    document.title = `${property.title} | Cavalleiro de Macedo`;

    renderFeatures(property);
    renderGallery(property);

    propertyLoading.hidden = true;
    propertyNotFound.hidden = true;
    propertyPage.hidden = false;
}

function showNotFound() {
    propertyLoading.hidden = true;
    propertyPage.hidden = true;
    propertyNotFound.hidden = false;
    document.title = "Imóvel indisponível | Cavalleiro de Macedo";
}

async function loadProperty() {
    if (!slug || !window.supabaseClient) {
        showNotFound();
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from("properties")
            .select(`
                id,
                title,
                slug,
                description,
                purpose,
                property_type,
                price,
                price_on_request,
                city,
                state,
                neighborhood,
                bedrooms,
                bathrooms,
                parking_spots,
                area_m2,
                status,
                property_images (
                    id,
                    storage_path,
                    alt_text,
                    sort_order,
                    is_cover
                )
            `)
            .eq("slug", slug)
            .in("status", ["available", "reserved"])
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            showNotFound();
            return;
        }

        renderProperty(data);
    } catch (error) {
        console.error("Erro ao carregar imóvel:", error);
        showNotFound();
    }
}

propertyInterest?.addEventListener("click", () => {
    if (!currentProperty?.id) {
        return;
    }

    setInterestFormOpen(true);
});

propertyInterestCancel?.addEventListener("click", () => {
    if (isSendingInterest) {
        return;
    }

    setInterestFormOpen(false);
});

propertyInterestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (
        isSendingInterest
        || !currentProperty?.id
        || !window.supabaseClient
    ) {
        return;
    }

    const values = validateInterestForm();

    if (values.error) {
        setInterestStatus(values.error, "error");
        return;
    }

    isSendingInterest = true;
    setInterestSubmitting(true);
    setInterestStatus("Enviando solicitação…");

    try {
        const { error } = await window.supabaseClient
            .from("property_leads")
            .insert({
                property_id: currentProperty.id,
                name: values.name,
                whatsapp: values.whatsapp,
                privacy_consent: true
            });

        if (error) {
            throw error;
        }

        propertyInterestForm.reset();
        propertyInterestForm.hidden = true;
        propertyInterestIntro.hidden = true;
        propertyInterestSuccess.hidden = false;
        propertyInterest?.setAttribute("aria-expanded", "false");
        propertyInterestSuccess.focus();
    } catch (error) {
        console.error("Erro ao registrar interesse:", error);
        setInterestStatus(
            "Não foi possível enviar agora. Tente novamente.",
            "error"
        );
    } finally {
        isSendingInterest = false;
        setInterestSubmitting(false);
    }
});

loadProperty();
