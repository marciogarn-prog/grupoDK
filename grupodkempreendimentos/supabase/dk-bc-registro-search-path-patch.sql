-- Patch reproduzível: digest/pgcrypto vive no schema extensions (Supabase).
-- Já aplicado no oficial durante 02/10; mantido no repositório para reinstalação.
-- Não altera dados operacionais.

alter function public.dk_bc_confirmar(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
) set search_path to public, extensions;

alter function public.dk_bc_rejeitar(uuid, text, text, jsonb)
  set search_path to public, extensions;

alter function public.dk_bc_estado()
  set search_path to public, extensions;
