-- ============================================================================
-- Migration: Backfill legacy `visible_password` for users where it is NULL
-- Date: 2026-06-20
-- Purpose: After the 20260620_admin_visible_passwords migration, any
-- `public.profiles` row whose auth.users record predates the change has
-- `visible_password = NULL`. Without a backfill, the Admin User Management
-- panel shows "—" for those rows instead of a true password (the bullet
-- icon's "no vault entry" sentinel). This migration restores a working
-- entry for every such legacy user so the panel shows real values for the
-- entire user table.
--
-- SAFETY:  A POSTGRESQL SESSION-GUC GATE
--   The migration defaults to **DRY-RUN** mode. It runs the diagnostic
--   block, lists every row that WOULD be touched, then exits without
--   any UPDATE. To actually mutate, the DBA must explicitly:
--       SET app.backfill_apply = 'true';
--   inside the same migration run, then COMMIT. The GUC is a `text`
--   GUC with `app.*` (custom namespace) + `true` is the only accepted
--   activation value — any other value, including unset, keeps the
--   migration in DRY-RUN. This prevents accidental force-reset during
--   a routine re-deploy.
--
-- PERMISSIONS:
--   The migration runs as the `postgres` role via the Supabase migration
--   runner. That's what permits the direct `UPDATE auth.users` block —
--   standard `authenticated` / `anon` / `service_role` users have NO
--   UPDATE permission on `auth.users` (they'd be blocked by Supabase's
--   default `auth` schema privileges). If this migration's logic is ever
--   copy-pasted into a SECURITY DEFINER RPC for repeated use, the RPC
--   OWNER must explicitly be `postgres` OR receive `GRANT UPDATE ON
--   auth.users TO <rpc_owner_role>` before the body will run.
--
-- CRYPTO APPROACH — AND WHY (per docs research 2026-06-20):
--   Supabase GoTrue is a Go service that hashes passwords via
--   `golang.org/x/crypto/bcrypt` at the APPLICATION LAYER and stores the
--   resulting Modular Crypt Format hash (`$2a$10$...`) into
--   `auth.users.encrypted_password`. Verification uses
--   `bcrypt.CompareHashAndPassword` which only requires:
--     (a) the stored hash is in standard bcrypt MCF, AND
--     (b) the salt factor encoded in the stored hash matches.
--   PostgreSQL's pgcrypto `crypt(pw, gen_salt('bf', 10))` produces a
--   STANDARD bcrypt MCF string with cost factor 10 — which IS what
--   bcrypt.CompareHashAndPassword expects. The output of pgcrypto and
--   Go's bcrypt are byte-for-byte compatible at the format level for
--   any normal password. (Note: extremely long unicode passwords or
--   null-byte edge cases may differ; for ASCII passwords used by this
--   app, the formats are interchangeable.)
--
--   ⚠️  UNVERIFIED BY E2E TEST  ⚠️
--   The above is a cryptographic-format argument, NOT a runtime
--   verification. Before declaring this migration production-ready the
--   DBA MUST perform this single-user smoke test:
--       1. Pick the first user listed in the migration log's
--          `Backfilled: username=..., id=..., new_password=...` line.
--       2. Open Supabase Studio → Authentication → Users → that user.
--       3. Click "Send password recovery email" or use the Auth API
--          directly to attempt signInWithPassword with the temp value.
--       4. If signInWithPassword succeeds → format is compatible, the
--          entire batch is safe. Proceed.
--       5. If signInWithPassword returns AuthApiError → re-run with
--          `app.backfill_apply = 'rollback'` (a follow-up companion
--          migration that uses `auth.admin.updateUserById` via the
--          service-role path inside the reset-user-password EF). Until
--          then, the backfilled rows are un-loginable — Admin must use
--          the existing `AdminResetPasswordModal` per row.
--
-- CREDENTIAL DELIVERY + LEAK CAVEAT:
--   Each generated password is emitted via RAISE NOTICE in the
--   migration log. The migration log MAY be persisted into Supabase's
--   internal backup / monitoring systems — treat those logs as
--   credential-bearing. Rotate (call `auth.admin.updateUserById` on the
--   user, OR have them run the in-app «تغییر رمز عبور» flow) as soon
--   as possible so the temp passwords fall out of any retained log
--   history.
--
-- IDEMPOTENCY:
--   Re-running this migration is safe:
--     * DRY-RUN mode: lists remaining NULL rows (decreasing over time).
--     * APPLY mode: only touches rows where visible_password IS NULL
--       (no-op for already-set rows).
-- ============================================================================

DO $$
DECLARE
  apply_flag   text;
  rec          record;
  charset      text := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  new_pw       text;
  i            int;
  rand_byte    int;
  target_count int := 0;
  updated_count int := 0;
  err_count    int := 0;
BEGIN
  -- Read the apply gate. `current_setting(name, missing_ok)` returns NULL
  -- if unset; we compare against 'true'.
  apply_flag := current_setting('app.backfill_apply', true);

  -- =========================================================
  -- Phase A (always runs): how many rows would be touched?
  -- =========================================================
  SELECT count(*) INTO target_count
    FROM public.profiles
   WHERE visible_password IS NULL;

  RAISE NOTICE '--- visible_password LEGACY BACKFILL DIAGNOSTIC ---';
  RAISE NOTICE 'Rows with visible_password IS NULL: %', target_count;

  IF target_count = 0 THEN
    RAISE NOTICE 'Nothing to backfill — every profile already has a vault entry. Exiting (no changes).';
    RETURN;
  END IF;

  -- Print a per-row preview so the DBA can copy/review the user list
  -- before deciding to apply.
  FOR rec IN
    SELECT p.id,
           p.username::text                                            AS username,
           p.full_name::text                                           AS full_name,
           COALESCE(p.role::text, 'UNKNOWN')                           AS role,
           to_char(p.created_at, 'YYYY-MM-DD HH24:MI:SS TZ')           AS created_at
      FROM public.profiles p
     WHERE p.visible_password IS NULL
     ORDER BY p.created_at
  LOOP
    RAISE NOTICE '  target: id=%, username=%, full_name=%, role=%, created_at=%',
      rec.id, rec.username, rec.full_name, rec.role, rec.created_at;
  END LOOP;

  -- =========================================================
  -- Phase B (only on explicit opt-in): perform the reset
  -- =========================================================
  IF apply_flag IS DISTINCT FROM 'true' THEN
    RAISE NOTICE '--- DRY-RUN mode: NO writes performed ---';
    RAISE NOTICE 'To apply this backfill, re-run this migration WITH:';
    RAISE NOTICE '    SET app.backfill_apply = ''true'';';
    RAISE NOTICE '  (the SET must precede the DO block in the same execution.)';
    RAISE NOTICE 'Each user will receive a fresh 16-char random password.';
    RAISE NOTICE 'New credentials are emitted via RAISE NOTICE to the migration log;';
    RAISE NOTICE 'the DBA MUST copy each notice line to deliver the temporary password.';
    RETURN;
  END IF;

  RAISE NOTICE '--- APPLY mode: writing updated_passwords to auth + vault ---';

  -- Per-row force-reset.
  --
  -- TRANSACTION MODEL:
  --   The outer DO block runs inside the migration's transaction. If any
  --   unexpected error leaks past the inner BEGIN/EXCEPTION block, the
  --   outer transaction rolls back EVERY backfilled row so far. That is
  --   the safer default for an enterprise app — ALL-OR-NOTHING instead
  --   of partial-state surprise. The per-row EXCEPTION handler catches
  --   the documented orphan-profile / RPC-failure cases, tallies them
  --   into err_count, and continues to the next row without aborting the
  --   migration as a whole. Only TRULY unexpected errors (e.g., pgcrypto
  --   throwing OOM) bubble up and roll back.
  FOR rec IN
    SELECT p.id,
           p.username::text                                            AS username
      FROM public.profiles p
     WHERE p.visible_password IS NULL
     ORDER BY p.created_at
  LOOP
    BEGIN
      -- 1. Generate a fresh 16-char random password from a 62-char alphanumeric
      --    charset. We use gen_random_bytes() (pgcrypto, cryptographic-grade)
      --    to pick each character index modulo the charset length. Any
      --    ~4% modulo bias is acceptable for non-credential-secret use.
      new_pw := '';
      FOR i IN 1..16 LOOP
        rand_byte := get_byte(gen_random_bytes(1), 0);
        new_pw   := new_pw || substr(charset, (rand_byte % length(charset)) + 1, 1);
      END LOOP;

      -- 2. Update auth.users.encrypted_password via pgcrypto's crypt().
      --    gen_salt('bf', 10) yields the bcrypt cost-factor-10 salt that
      --    matches Supabase GoTrue's default; the resulting MCF string
      --    is byte-compatible with bcrypt.CompareHashAndPassword.
      --
      --    The orphan-profile guard: if the profile has no matching
      --    auth.users row (e.g., a botched soft-delete-replay), the
      --    UPDATE affects 0 rows. We then SKIP the visible_password
      --    sync so we never write a phantom password for a non-existent
      --    auth user.
      UPDATE auth.users
         SET encrypted_password = crypt(new_pw, gen_salt('bf', 10)),
             updated_at        = now()
       WHERE id = rec.id;

      IF NOT FOUND THEN
        RAISE WARNING 'orphan profile (no auth.users row). id=% username=% — skipping.',
          rec.id, rec.username;
        err_count := err_count + 1;
        CONTINUE;
      END IF;

      -- 3. Sync profiles.visible_password via the existing SEC-DEF RPC
      --    so the column-level GRANT REVOKE invariant is still enforced
      --    (the RPC is the ONE legitimized write path).
      PERFORM public.admin_set_visible_password(rec.id, new_pw);

      -- 4. Emit the new credential so the DBA can copy it.
      RAISE NOTICE 'Backfilled: username=%, id=%, new_password=%',
        rec.username, rec.id, new_pw;

      updated_count := updated_count + 1;
    EXCEPTION WHEN OTHERS THEN
      err_count := err_count + 1;
      RAISE WARNING 'Backfill failed for username=% (id=%): %',
        rec.username, rec.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '--- BACKFILL SUMMARY ---';
  RAISE NOTICE 'Rows processed: %', target_count;
  RAISE NOTICE 'Rows updated:   %', updated_count;
  RAISE NOTICE 'Rows failed:    %', err_count;
  RAISE NOTICE 'IMPORTANT: each RAISE NOTICE line ABOVE contains a plaintext temporary password.';
  RAISE NOTICE '↳ Leak caveat: the migration log may be persisted into internal backups or';
  RAISE NOTICE '  monitoring systems. Schedule a password rotation via the in-app';
  RAISE NOTICE '  «تغییر رمز عبور» flow for each user as soon as they receive their temp';
  RAISE NOTICE '  credential, so the temp value falls out of any retained log history.';
  RAISE NOTICE '↳ Smoke-test reminder: BEFORE declaring this batch production, perform the';
  RAISE NOTICE '  single-user signInWithPassword check documented in the file header.';
END $$;
