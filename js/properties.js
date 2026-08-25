const propertiesGrid = document.querySelector("[data-properties-grid]");
const propertiesStatus = document.querySelector("[data-properties-status]");
const propertiesEmpty = document.querySelector("[data-properties-empty]");
const filterButtons = Array.from(
    document.querySelectorAll("[data-property-filter]")
);

let properties = [];
let activeFilter = "all";

const purposeLabels = {
    sale: "Venda",
    rent: "Locação"
};

const typeLabels = {
    house: "Casa",
    apartment: "Apartamento",
    commercial: "Comercial",
    land: "Terreno",
    rural: "Imóvel rural",
    other: "Imóvel"
};

const statusLabels = {
    available: "Disponível",
    reserved: "Reservado"
};

const priceFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

function setPropertiesStatus(message = "", type = "") {
    if (!propertiesStatus) {
        return;
    }

    propertiesStatus.textContent = message;

    if (type) {
        propertiesStatus.dataset.type = type;
    } else {
        delete propertiesStatus.dataset.type;
    }
}

function getPublicImageUrl(storagePath) {
    if (!storagePath) {
        return "";
    }

    const { data } = window.supabaseClient
        .storage
        .from("property-images")
        .getPublicUrl(storagePath);

    return data?.publicUrl || "";
}

function getCoverImage(property) {
    const images = Array.isArray(property.property_images)
        ? property.property_images
        : [];

    if (!images.length) {
        return null;
    }

    const cover = images.find((image) => image.is_cover);

    if (cover) {
        return cover;
    }

    return [...images].sort(
        (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
    )[0];
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
        return {
            value: "Valor sob consulta",
            suffix: ""
        };
    }

    return {
        value: priceFormatter.format(Number(property.price)),
        suffix: property.purpose === "rent" ? "/ mês" : ""
    };
}

function getPropertyFeatures(property) {
    const features = [];
    const bedrooms = Number(property.bedrooms);
    const bathrooms = Number(property.bathrooms);
    const parking = Number(property.parking_spots);
    const area = Number(property.area_m2);

    if (Number.isFinite(bedrooms) && bedrooms > 0) {
        features.push(bedrooms === 1 ? "1 quarto" : `${bedrooms} quartos`);
    }

    if (Number.isFinite(bathrooms) && bathrooms > 0) {
        features.push(bathrooms === 1 ? "1 banheiro" : `${bathrooms} banheiros`);
    }

    if (Number.isFinite(parking) && parking > 0) {
        features.push(parking === 1 ? "1 vaga" : `${parking} vagas`);
    }

    if (Number.isFinite(area) && area > 0) {
        features.push(`${area.toLocaleString("pt-BR", {
            maximumFractionDigits: 1
        })} m²`);
    }

    return features;
}

function createPropertyCard(property) {
    const article = document.createElement("article");
    const detailUrl = `./imovel.html?slug=${encodeURIComponent(property.slug)}`;
    const imageLink = document.createElement("a");
    const cover = getCoverImage(property);

    article.className = "property-card";
    imageLink.className = "property-card__image-link";
    imageLink.href = detailUrl;

    if (cover?.storage_path) {
        const image = document.createElement("img");

        image.src = getPublicImageUrl(cover.storage_path);
        image.alt = cover.alt_text || property.title || "Foto do imóvel";
        image.loading = "lazy";
        image.decoding = "async";
        imageLink.append(image);
    } else {
        const placeholder = document.createElement("span");

        placeholder.className = "property-card__placeholder";
        placeholder.textContent = "Imagem em breve";
        imageLink.append(placeholder);
    }

    if (property.status && property.status !== "available") {
        const status = document.createElement("span");

        status.className = `property-card__status property-card__status--${property.status}`;
        status.textContent = statusLabels[property.status] || property.status;
        imageLink.append(status);
    }

    const body = document.createElement("div");
    const eyebrow = document.createElement("div");
    const purpose = document.createElement("span");
    const type = document.createElement("span");
    const title = document.createElement("h2");
    const titleLink = document.createElement("a");
    const location = document.createElement("p");

    body.className = "property-card__body";
    eyebrow.className = "property-card__eyebrow";
    purpose.textContent = purposeLabels[property.purpose] || property.purpose;
    type.textContent = typeLabels[property.property_type] || "Imóvel";
    eyebrow.append(purpose, type);

    titleLink.href = detailUrl;
    titleLink.textContent = property.title;
    title.append(titleLink);

    location.className = "property-card__location";
    location.textContent = formatLocation(property) || "Localização sob consulta";
    body.append(eyebrow, title, location);

    const features = getPropertyFeatures(property);

    if (features.length) {
        const featuresElement = document.createElement("div");

        featuresElement.className = "property-card__features";

        features.forEach((feature) => {
            const span = document.createElement("span");

            span.textContent = feature;
            featuresElement.append(span);
        });

        body.append(featuresElement);
    }

    const footer = document.createElement("div");
    const priceData = formatPrice(property);
    const price = document.createElement("p");
    const link = document.createElement("a");

    footer.className = "property-card__footer";
    price.className = "property-card__price";
    price.append(document.createTextNode(priceData.value));

    if (priceData.suffix) {
        const suffix = document.createElement("small");

        suffix.textContent = priceData.suffix;
        price.append(suffix);
    }

    link.className = "property-card__link";
    link.href = detailUrl;
    link.textContent = "Ver imóvel →";

    footer.append(price, link);
    body.append(footer);
    article.append(imageLink, body);

    return article;
}

function renderProperties() {
    if (!propertiesGrid || !propertiesEmpty) {
        return;
    }

    const filtered = activeFilter === "all"
        ? properties
        : properties.filter((property) => property.purpose === activeFilter);

    if (!filtered.length) {
        propertiesGrid.hidden = true;
        propertiesEmpty.hidden = false;
        return;
    }

    propertiesEmpty.hidden = true;
    propertiesGrid.hidden = false;
    propertiesGrid.replaceChildren(...filtered.map(createPropertyCard));
}

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        activeFilter = button.dataset.propertyFilter || "all";

        filterButtons.forEach((item) => {
            const active = item === button;

            item.classList.toggle("is-active", active);
            item.setAttribute("aria-pressed", String(active));
        });

        renderProperties();
    });
});

async function loadProperties() {
    if (!window.supabaseClient) {
        setPropertiesStatus("Não foi possível carregar os imóveis.", "error");
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from("properties")
            .select(`
                id,
                title,
                slug,
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
                featured,
                updated_at,
                property_images (
                    id,
                    storage_path,
                    alt_text,
                    sort_order,
                    is_cover
                )
            `)
            .in("status", ["available", "reserved"])
            .order("featured", { ascending: false })
            .order("updated_at", { ascending: false });

        if (error) {
            throw error;
        }

        properties = data || [];
        setPropertiesStatus();
        renderProperties();
    } catch (error) {
        console.error("Erro ao carregar imóveis:", error);
        setPropertiesStatus(
            "Não foi possível carregar os imóveis agora.",
            "error"
        );

        if (propertiesGrid) {
            propertiesGrid.hidden = true;
        }

        if (propertiesEmpty) {
            propertiesEmpty.hidden = false;
        }
    }
}

loadProperties();
