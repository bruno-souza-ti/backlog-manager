
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_status_check
  CHECK (status IN ('active', 'inactive', 'frozen'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;

CREATE OR REPLACE FUNCTION public.check_client_not_frozen_or_deleted()
RETURNS TRIGGER AS $$
DECLARE
  c_status  text;
  c_deleted timestamptz;
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    SELECT status, deleted_at
      INTO c_status, c_deleted
      FROM public.clients
     WHERE id = NEW.client_id;

    IF c_deleted IS NOT NULL THEN
      RAISE EXCEPTION 'O cliente está excluído. Restaure-o antes de modificar seus dados.';
    END IF;

    IF c_status = 'frozen' THEN
      RAISE EXCEPTION 'O cliente está congelado. Descongele-o antes de modificar seus dados.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tasks_block_frozen_client          ON public.tasks;
DROP TRIGGER IF EXISTS notes_block_frozen_client          ON public.client_notes_history;
DROP TRIGGER IF EXISTS files_block_frozen_client          ON public.client_files;

CREATE TRIGGER tasks_block_frozen_client
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.check_client_not_frozen_or_deleted();

CREATE TRIGGER notes_block_frozen_client
  BEFORE INSERT OR UPDATE ON public.client_notes_history
  FOR EACH ROW EXECUTE FUNCTION public.check_client_not_frozen_or_deleted();

CREATE TRIGGER files_block_frozen_client
  BEFORE INSERT OR UPDATE ON public.client_files
  FOR EACH ROW EXECUTE FUNCTION public.check_client_not_frozen_or_deleted();
