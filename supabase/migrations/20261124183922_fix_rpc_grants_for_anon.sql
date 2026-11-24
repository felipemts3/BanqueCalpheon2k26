/*
# Fix EXECUTE grants: allow anon to call RPCs

## Problem
The app uses custom auth (family name + PIN, NOT Supabase Auth), so the browser
always runs as the `anon` role. But all RPC functions were granted EXECUTE only
to `authenticated`, meaning every call (login, signup, save_prediction, etc.)
fails with a permission error before the function even runs.

## Fix
Grant EXECUTE to `anon` on ALL public-facing RPC functions. The functions
self-validate via session tokens, so this is safe — no sensitive data is exposed
without a valid token. Internal helpers (_validate_session, _deadline_passed,
_record_failed_attempt, _compute_ranking) stay revoked from both anon and
authenticated; they are only called by other SECURITY DEFINER functions.
*/

-- Auth functions
GRANT EXECUTE ON FUNCTION signup(text, text) TO anon;
GRANT EXECUTE ON FUNCTION login(text, text) TO anon;
GRANT EXECUTE ON FUNCTION logout(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_session(uuid) TO anon;
GRANT EXECUTE ON FUNCTION change_pin(uuid, text) TO anon;

-- Prediction functions
GRANT EXECUTE ON FUNCTION save_prediction(uuid, uuid, boolean) TO anon;
GRANT EXECUTE ON FUNCTION confirm_predictions(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_my_predictions(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_all_predictions(uuid) TO anon;

-- Admin functions
GRANT EXECUTE ON FUNCTION admin_list_players(uuid) TO anon;
GRANT EXECUTE ON FUNCTION admin_reset_player_pin(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_player(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION admin_upsert_category(uuid, uuid, text, text, int) TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_category(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION admin_upsert_option(uuid, uuid, uuid, text, text, text, int, boolean) TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_option(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION admin_set_option_result(uuid, uuid, boolean) TO anon;
GRANT EXECUTE ON FUNCTION admin_set_deadline(uuid, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION admin_set_results_published(uuid, boolean) TO anon;
GRANT EXECUTE ON FUNCTION admin_get_ranking(uuid) TO anon;
