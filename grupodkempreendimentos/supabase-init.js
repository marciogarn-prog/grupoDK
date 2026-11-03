/**
 * Cliente Supabase para o portal DK (browser).
 * Credenciais: meta tags — dk-supabase-url e dk-supabase-anon-key (publishable).
 * Realtime usa cliente efémero com accessToken em memória (nunca service_role).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function readMeta(name) {
  const el = document.querySelector(`meta[name="${name}"]`);
  return el ? String(el.getAttribute("content") || "").trim() : "";
}

const url = readMeta("dk-supabase-url");
const key = readMeta("dk-supabase-anon-key");

window.__DK_SUPABASE_CLIENT__ =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: "dk-supabase-auth-disabled",
        },
      })
    : null;

window.__DK_SUPABASE_CONFIGURED__ = Boolean(window.__DK_SUPABASE_CLIENT__);
window.__DK_SUPABASE_URL__ = url;
window.__DK_SUPABASE_ANON_KEY__ = key;

/**
 * Cliente só para Realtime: JWT curto via callback; sem persistir sessão Auth.
 * @param {() => Promise<string|null>|string|null} getAccessToken
 */
window.__DK_criarClienteRealtime = function dkCriarClienteRealtime(getAccessToken) {
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "dk-realtime-ephemeral",
    },
    global: {
      headers: { "X-DK-Realtime": "1" },
    },
    accessToken: async () => {
      try {
        const t = typeof getAccessToken === "function" ? await getAccessToken() : getAccessToken;
        return t ? String(t) : null;
      } catch {
        return null;
      }
    },
  });
};

try {
  window.dispatchEvent(new CustomEvent("dk-supabase-ready"));
} catch {
  /* ignore */
}
