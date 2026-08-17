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
