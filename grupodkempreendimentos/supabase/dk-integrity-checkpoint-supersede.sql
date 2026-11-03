-- Permite marcar checkpoint antigo como superseded.
-- Não altera cadastro de negócio.

alter table public.dk_integrity_checkpoints
  drop constraint if exists dk_integrity_checkpoints_kind_chk;

alter table public.dk_integrity_checkpoints
  add constraint dk_integrity_checkpoints_kind_chk
  check (kind in ('current', 'superseded'));

notify pgrst, 'reload schema';
