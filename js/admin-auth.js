const loginForm = document.querySelector("[data-login-form]");
const loginStatus = document.querySelector("[data-login-status]");
const loginSubmit = document.querySelector("[data-login-submit]");

function setLoginStatus(message, type = "") {
    if (!loginStatus) {
        return;
    }

    loginStatus.textContent = message;
    loginStatus.dataset.type = type;
}

function setLoginBusy(isBusy) {
    if (!loginForm || !loginSubmit) {
        return;
    }

    loginForm.setAttribute("aria-busy", String(isBusy));
    loginSubmit.disabled = isBusy;
    loginSubmit.textContent = isBusy ? "Entrando…" : "Entrar";
}

async function getAdminMembership(userId) {
    return window.supabaseClient
        .from("admin_users")
        .select("user_id, display_name")
        .eq("user_id", userId)
        .maybeSingle();
}

async function redirectAuthenticatedAdmin() {
    if (!window.supabaseClient) {
        setLoginStatus("Não foi possível iniciar o acesso administrativo.", "error");
        return;
    }

    const {
        data: { user },
        error
    } = await window.supabaseClient.auth.getUser();

    if (error || !user) {
        return;
    }

    const { data: membership } = await getAdminMembership(user.id);

    if (membership) {
        window.location.replace("./painel.html");
    }
}

loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!window.supabaseClient) {
        setLoginStatus("Não foi possível iniciar o acesso administrativo.", "error");
        return;
    }

    const formData = new FormData(loginForm);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    setLoginBusy(true);
    setLoginStatus("Validando suas credenciais…");

    try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error || !data.user) {
            setLoginStatus("E-mail ou senha inválidos.", "error");
            return;
        }

        const { data: membership, error: membershipError } = await getAdminMembership(
            data.user.id
        );

        if (membershipError || !membership) {
            await window.supabaseClient.auth.signOut();
            setLoginStatus("Este usuário não possui acesso administrativo.", "error");
            return;
        }

        window.location.replace("./painel.html");
    } catch (error) {
        console.error("Erro inesperado no login administrativo:", error);
        setLoginStatus("Não foi possível entrar agora. Tente novamente.", "error");
    } finally {
        setLoginBusy(false);
    }
});

const loginParams = new URLSearchParams(window.location.search);

if (loginParams.get("erro") === "acesso") {
    setLoginStatus("Faça login com uma conta administrativa.", "error");
}

redirectAuthenticatedAdmin();
