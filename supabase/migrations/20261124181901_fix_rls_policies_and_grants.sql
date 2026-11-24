/*
# Fix RLS Policies and Grants

## Problem
The initial migration enabled RLS on all 7 tables but created NO policies.
Without SELECT policies, the anon-key frontend cannot read public reference
data (categories, options, settings) — those queries return empty results.
Additionally, all tables received full CRUD grants to anon+authenticated,
which is overly permissive for sensitive tables (players, sessions,
login_attempts, predictions).

## Fix
1. Public tables (categories, options, settings):
   - Revoke INSERT/UPDATE/DELETE from anon+authenticated (read-only via Data API)
   - Keep SELECT grant
   - Add SELECT policies (TO anon, authenticated, USING true — intentionally public)

2. Sensitive tables (players, sessions, login_attempts, predictions):
   - Revoke ALL from anon+authenticated
   - No policies needed — all access goes through SECURITY DEFINER RPCs

3. Internal helper functions (_validate_session, _deadline_passed,
   _record_failed_attempt, _compute_ranking):
   - Revoke EXECUTE from authenticated (they should only be called internally
     by other SECURITY DEFINER functions, not directly from the API)
*/

-- ============ PUBLIC TABLES: read-only ============

-- categories
REVOKE INSERT, UPDATE, DELETE ON categories FROM anon, authenticated;
GRANT SELECT ON categories TO anon, authenticated;

DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories"
ON categories FOR SELECT
TO anon, authenticated USING (true);

-- options
REVOKE INSERT, UPDATE, DELETE ON options FROM anon, authenticated;
GRANT SELECT ON options TO anon, authenticated;

DROP POLICY IF EXISTS "public_read_options" ON options;
CREATE POLICY "public_read_options"
ON options FOR SELECT
TO anon, authenticated USING (true);

-- settings
REVOKE INSERT, UPDATE, DELETE ON settings FROM anon, authenticated;
GRANT SELECT ON settings TO anon, authenticated;

DROP POLICY IF EXISTS "public_read_settings" ON settings;
CREATE POLICY "public_read_settings"
ON settings FOR SELECT
TO anon, authenticated USING (true);

-- ============ SENSITIVE TABLES: no direct access ============

REVOKE ALL ON players FROM anon, authenticated;
REVOKE ALL ON sessions FROM anon, authenticated;
REVOKE ALL ON login_attempts FROM anon, authenticated;
REVOKE ALL ON predictions FROM anon, authenticated;

-- ============ INTERNAL HELPERS: revoke from authenticated ============

REVOKE EXECUTE ON FUNCTION _validate_session(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION _deadline_passed() FROM authenticated;
REVOKE EXECUTE ON FUNCTION _record_failed_attempt(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION _compute_ranking() FROM authenticated;
