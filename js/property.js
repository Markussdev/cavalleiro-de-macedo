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

const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

let currentProperty = null;

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
            const value = document.createElement("strong");
            const label = document.createElement("span");

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
    propertyDescription.textContent = property.description
        || "Entre em contato para mais informações sobre este imóvel.";

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

loadProperty();
