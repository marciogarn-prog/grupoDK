-- Porteiro Supabase: só o servidor (service_role) lê/grava dk_cloud_snapshots.
-- anon e authenticated continuam bloqueados (Fase 1A).
-- Correr no SQL Editor do projeto grupodk-portal. Copiar deste ficheiro, não do chat traduzido.

grant select, insert, update on table public.dk_cloud_snapshots to service_role;

notify pgrst, 'reload schema';
