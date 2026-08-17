const SUPABASE_URL = "https://gsbhcedqqwmafkslhcyk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LfAzgDBSGZv7cw6VzY7K9Q_MvQg6Sfk";

if (!window.supabase?.createClient) {
    console.error("SUPABASE: o SDK não foi carregado.");
} else {
    window.supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );
}

async function testarArtigos() {
    if (!window.supabaseClient) {
        console.error("SUPABASE: cliente indisponível.");
        return;
    }

    const { data, error } = await window.supabaseClient
        .from("posts")
        .select("*")
        .eq("published", true);

    console.log("ARTIGOS:", data);
    console.log("ERRO:", error);
}

testarArtigos();
