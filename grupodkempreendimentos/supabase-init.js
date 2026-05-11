/**
 * Cliente Supabase para o portal DK (browser).
 * Credenciais: meta tags em index.html — dk-supabase-url e dk-supabase-anon-key (Project URL e anon public key).
 * Sem URL/key vazios o cliente fica null e o sistema continua só com localStorage.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
          persistSession: true,
          storageKey: "dk-supabase-auth",
          flowType: "pkce",
        },
      })
    : null;

window.__DK_SUPABASE_CONFIGURED__ = Boolean(window.__DK_SUPABASE_CLIENT__);

try {
  window.dispatchEvent(new CustomEvent("dk-supabase-ready"));
} catch {
  /* ignore */
}
