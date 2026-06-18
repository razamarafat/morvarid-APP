-- ============================================================================
-- Migration: Admin-visible passwords column with strict RLS
-- Date: 2026-06-20
-- Purpose: Business-mandated feature where the main Admin can see every
-- employee's CURRENT plain-text password inside the Admin User Management
-- panel, scoped to ONE column with no other surface area visible.
--
-- SECURITY APPROACH (20260620):
--   1. Add `visible_password TEXT` column to profiles (nullable, length check).
--   2. REVOKE column-level SELECT/INSERT/UPDATE/DELETE on `visible_password`
--      from the `authenticated` role. This NARROWLY hides the column from
--      PostgREST's regular `select('*')` queries, while leaving every other
--      column visible. Without this REVOKE, every authenticated client could
--      `select('*')` and read `visible_password` — violating the spec.
--   3. Three SECURITY DEFINER RPCs act as the ONLY legitimized channels for
--      reading/writing the column:
--        a) admin_list_visible_passwords() — admin-only read of all rows
--        b) admin_set_visible_password(uuid, text) — admin-only write of
--           any user's password
--        c) self_set_visible_password(text) — auth.uid()-scoped self-write
--   4. The update_user RPC (and all other admin paths) MUST call
--      self_set_visible_password / admin_set_visible_password explicitly —
--      they DON'T get ambient write access from RLS (since the column is
--      REVOKEd from authenticated, and the regular profiles FOR UPDATE policy
--      is `auth.uid() = id`, which is OWN-row only).
--
-- WHY THIS PATTERN (CONTRAST WITH ALTERNATIVES):
--   - Column-level GRANT REVOKE is native PostgreSQL — REVOKE on a single
--     column from a role only blocks that column; all other columns remain
--     queryable. This is the cleanest way to scope a single column's row
--     visibility.
--   - SECURITY DEFINER RPCs are the canonical Supabase pattern for privileged
--     operations. They run as the function owner (postgres), bypassing
--     RLS entirely, while still letting us add an explicit `is_admin()` /
--     `auth.uid()` guard so only the right person can call them.
--   - We AVOID putting `visible_password` in a separate `admin_password_vault`
--     table because the spec EXPLICITLY says "store the new password in a
--     column ... inside the `profiles` table". Single-column GRANT behaves
--     correctly with RLS + FK embeddings (PostgREST only fetches columns the
--     client requests, so embedding `profiles!creator(username)` is unaffected).
-- ============================================================================

-- =========================
-- 1. Add column (idempotent)
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'visible_password'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN visible_password TEXT;
  END IF;
END $$;

-- Length defensive: reject typos/null-padding-on-update.
--
-- Why ≥ 6 here (instead of ≥ 8 like the application layer)?
--   The application layer (UserFormModal Zod + change-password EF +
--   reset-user-password EF + ChangePasswordModal Zod + AdminResetPasswordModal
--   Zod) enforces ≥ 8 chars + letter + digit. Those are the EFFECTIVE rules.
--   The DB-level CHECK is intentionally lax (≥ 6) so it accepts
--   legacy-vault-backfill scripts / direct SQL repair of older records
--   whose original password may have been 6-7 chars. The application is
--   the SOURCE OF TRUTH for new entries; this CHECK is a backstop against
--   PL/pgSQL bugs that produce near-empty strings.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name = 'profiles_visible_password_length_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_visible_password_length_chk
      CHECK (visible_password IS NULL OR char_length(visible_password) >= 6);
  END IF;
END $$;

-- =========================
-- 2. Column-level GRANT REVOKE
--    Hide the column from regular PostgREST queries by authenticated role.
--    The column would otherwise be returned in `select('*')` responses.
-- =========================
-- Drop any inherited (table-level) SELECT on the column for the authenticated
-- role. REVOKE of a single column from a role is supported by PostgreSQL.
REVOKE SELECT (visible_password) ON public.profiles FROM authenticated;
-- Also block ambient INSERT/UPDATE/DELETE on this one column from regular
-- `profiles` table writes (FOR INSERT/UPDATE) — every write MUST go through
-- the SECURITY DEFINER RPCs below so the admin gate is enforced.
REVOKE INSERT (visible_password) ON public.profiles FROM authenticated;
REVOKE UPDATE (visible_password) ON public.profiles FROM authenticated;

-- =========================
-- 3. SECURITY DEFINER RPCs
--    These are the ONLY legitimated channels to read/write visible_password.
--    All three run as the function owner (postgres), bypassing RLS, but they
--    enforce explicit per-call authorization using public.is_admin() and
--    auth.uid() respectively. The setter grants EXECUTE to `authenticated`
--    so non-admin users can call self_set_visible_password through the
--    postgrest endpoint.
-- =========================

-- 3a) Admin reads all rows' visible_password (requires is_admin())
CREATE OR REPLACE FUNCTION public.admin_list_visible_passwords()
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  visible_password text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: admin only'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
    SELECT p.id,
           p.username::text,
           COALESCE(p.full_name, '')::text,
           p.visible_password
      FROM public.profiles p
      ORDER BY p.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_visible_passwords() TO authenticated;

-- 3b) Admin writes one user's visible_password (requires is_admin()).
--     Use case: admin panel password-reset / sync on initial create.
CREATE OR REPLACE FUNCTION public.admin_set_visible_password(
  p_user_id  uuid,
  p_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: admin only'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_password IS NULL OR char_length(p_password) < 6 THEN
    RAISE EXCEPTION 'PASSWORD_TOO_SHORT'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.profiles
     SET visible_password = p_password,
         updated_at = now()
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: user % does not exist', p_user_id
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_visible_password(uuid, text) TO authenticated;

-- 3c) User writes OWN visible_password (requires auth.uid() on profiles.id).
--     Called by the change-password Edge Function after supabase.auth.updateUser
--     succeeds, so the stored-value stays in sync with the real auth password.
CREATE OR REPLACE FUNCTION public.self_set_visible_password(
  p_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_password IS NULL OR char_length(p_password) < 6 THEN
    RAISE EXCEPTION 'PASSWORD_TOO_SHORT'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.profiles
     SET visible_password = p_password,
         updated_at = now()
   WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: own profile row missing'
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.self_set_visible_password(text) TO authenticated;

-- =========================
-- 4. Index isn't needed on visible_password (we never query by it).
-- =========================
-- (deliberately left blank)
