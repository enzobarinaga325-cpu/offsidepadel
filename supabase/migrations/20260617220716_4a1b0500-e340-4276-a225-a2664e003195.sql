
-- Enforce one-time category selection (only admins can change after set)
DROP TRIGGER IF EXISTS guard_profile_category_trg ON public.profiles;
CREATE TRIGGER guard_profile_category_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_category();

-- updated_at trigger on profiles
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
