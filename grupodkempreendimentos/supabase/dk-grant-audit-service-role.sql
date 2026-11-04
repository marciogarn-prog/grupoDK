-- Permissões para mutate_with_event / dk_append_event via service_role (PostgREST).
-- Sem UPDATE em dk_audit_state a gravação devolve 403 e a UI parecia «sessão inválida».

grant select, insert, update on table public.dk_audit_state to service_role;
grant select, insert, update on table public.dk_events to service_role;
grant select, insert, update on table public.dk_mutation_receipt to service_role;
grant usage, select on all sequences in schema public to service_role;
