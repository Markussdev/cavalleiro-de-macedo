document.documentElement.classList.add("js");

const root = document.documentElement;
const body = document.body;
const header = document.querySelector("[data-header]");
const menuButton = document.querySelector("[data-menu-button]");
const nav = document.querySelector("[data-nav]");
const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const setMenu = (isOpen) => {
    menuButton?.setAttribute("aria-expanded", String(isOpen));
    menuButton?.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
    nav?.classList.toggle("is-open", isOpen);
    body.classList.toggle("menu-open", isOpen);
};

menuButton?.addEventListener("click", () => {
    setMenu(menuButton.getAttribute("aria-expanded") !== "true");
});

navLinks.forEach((link) => link.addEventListener("click", () => setMenu(false)));

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        setMenu(false);
        closeAccessibilityPanel();
    }
});

const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 18);
updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

// Reveal only becomes active after JavaScript is available, so content remains
// visible when scripts are blocked or fail to load.
const revealElements = document.querySelectorAll("[data-reveal]");

if (reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
} else {
    const revealObserver = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px" }
    );

    revealElements.forEach((element) => revealObserver.observe(element));
}

// Highlights the section currently visible in the compact desktop navigation.
const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver(
        (entries) => {
            const visibleEntry = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

            if (!visibleEntry) return;

            navLinks.forEach((link) => {
                link.classList.toggle(
                    "is-active",
                    link.getAttribute("href") === `#${visibleEntry.target.id}`
                );
            });
        },
        { rootMargin: "-25% 0px -60%", threshold: [0, 0.25, 0.5] }
    );

    sections.forEach((section) => sectionObserver.observe(section));
}

// Prototype links give feedback instead of opening fake phone numbers or profiles.
const feedback = document.querySelector("[data-contact-feedback]");
let feedbackTimer;

document.querySelectorAll("[data-placeholder-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();
        if (!feedback) return;

        window.clearTimeout(feedbackTimer);
        feedback.textContent = "Este canal será ativado quando os dados profissionais forem confirmados.";
        feedback.classList.add("is-visible");
        feedbackTimer = window.setTimeout(() => feedback.classList.remove("is-visible"), 4200);
    });
});

document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
});

// Accessibility controls
const accessibilityPanel = document.querySelector("[data-accessibility-panel]");
const accessibilityTrigger = document.querySelector("[data-accessibility-trigger]");
const accessibilityClose = document.querySelector("[data-accessibility-close]");
const contrastButton = document.querySelector("[data-contrast]");
const linksButton = document.querySelector("[data-links]");
const motionButton = document.querySelector("[data-motion]");
const fontDecrease = document.querySelector("[data-font-decrease]");
const fontReset = document.querySelector("[data-font-reset]");
const fontIncrease = document.querySelector("[data-font-increase]");

const STORAGE_KEY = "rcm-accessibility";
const fontClasses = ["text-small", "text-large", "text-xlarge"];
let settings = {
    fontLevel: 0,
    contrast: false,
    links: false,
    motion: false
};

try {
    settings = { ...settings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
} catch {
    // Storage may be disabled. Controls still work for the current page view.
}

const persistSettings = () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // No-op when storage is unavailable.
    }
};

const applyAccessibilitySettings = () => {
    root.classList.remove(...fontClasses);
    if (settings.fontLevel === -1) root.classList.add("text-small");
    if (settings.fontLevel === 1) root.classList.add("text-large");
    if (settings.fontLevel >= 2) root.classList.add("text-xlarge");

    root.classList.toggle("a11y-contrast", settings.contrast);
    root.classList.toggle("a11y-links", settings.links);
    root.classList.toggle("reduce-motion", settings.motion);

    contrastButton?.setAttribute("aria-pressed", String(settings.contrast));
    linksButton?.setAttribute("aria-pressed", String(settings.links));
    motionButton?.setAttribute("aria-pressed", String(settings.motion));
    fontDecrease?.setAttribute("aria-pressed", String(settings.fontLevel < 0));
    fontReset?.setAttribute("aria-pressed", String(settings.fontLevel === 0));
    fontIncrease?.setAttribute("aria-pressed", String(settings.fontLevel > 0));
};

const saveAndApply = () => {
    applyAccessibilitySettings();
    persistSettings();
};

const openAccessibilityPanel = () => {
    if (!accessibilityPanel || !accessibilityTrigger) return;
    accessibilityPanel.hidden = false;
    accessibilityTrigger.setAttribute("aria-expanded", "true");
    accessibilityClose?.focus();
};

function closeAccessibilityPanel() {
    if (!accessibilityPanel || !accessibilityTrigger || accessibilityPanel.hidden) return;
    accessibilityPanel.hidden = true;
    accessibilityTrigger.setAttribute("aria-expanded", "false");
    accessibilityTrigger.focus();
}

accessibilityTrigger?.addEventListener("click", () => {
    accessibilityPanel?.hidden ? openAccessibilityPanel() : closeAccessibilityPanel();
});

accessibilityClose?.addEventListener("click", closeAccessibilityPanel);

fontDecrease?.addEventListener("click", () => {
    settings.fontLevel = Math.max(-1, settings.fontLevel - 1);
    saveAndApply();
});

fontReset?.addEventListener("click", () => {
    settings.fontLevel = 0;
    saveAndApply();
});

fontIncrease?.addEventListener("click", () => {
    settings.fontLevel = Math.min(2, settings.fontLevel + 1);
    saveAndApply();
});

contrastButton?.addEventListener("click", () => {
    settings.contrast = !settings.contrast;
    saveAndApply();
});

linksButton?.addEventListener("click", () => {
    settings.links = !settings.links;
    saveAndApply();
});

motionButton?.addEventListener("click", () => {
    settings.motion = !settings.motion;
    saveAndApply();
});

applyAccessibilitySettings();

window.addEventListener("resize", () => {
    if (window.innerWidth > 1060) setMenu(false);
});
