/*
# Bolão do Banquete de Calpheon 2026 — RPC Functions

## Overview
Creates all SECURITY DEFINER RPC functions. pgcrypto functions (crypt, gen_salt)
live in the `extensions` schema, so all functions set search_path = public, extensions.

## Functions (same as prior attempt — search_path fixed)
- Auth: signup, login, logout, get_session, change_pin
- Predictions: save_prediction, confirm_predictions, get_my_predictions, get_all_predictions
- Public: get_settings, get_public_ranking
- Admin: admin_list_players, admin_reset_player_pin, admin_delete_player,
  admin_upsert_category, admin_delete_category, admin_upsert_option,
  admin_delete_option, admin_set_option_result, admin_set_deadline,
  admin_set_results_published, admin_get_ranking
- Internal helpers: _validate_session, _deadline_passed, _record_failed_attempt, _compute_ranking
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ Helper: validate session ============

CREATE OR REPLACE FUNCTION _validate_session(p_token uuid)
RETURNS players
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT p.*
  FROM players p
  JOIN sessions s ON s.player_id = p.id
  WHERE s.token = p_token
    AND s.expires_at > now()
$$;

-- ============ Helper: deadline passed ============

CREATE OR REPLACE FUNCTION _deadline_passed()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT now() > (value::timestamptz) FROM settings WHERE key = 'deadline'
$$;

-- ============ Helper: record failed attempt ============

CREATE OR REPLACE FUNCTION _record_failed_attempt(p_family_lower text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_attempts int;
BEGIN
  INSERT INTO login_attempts (family_name_lower, attempts)
  VALUES (p_family_lower, 1)
  ON CONFLICT (family_name_lower) DO UPDATE
    SET attempts = login_attempts.attempts + 1;

  SELECT attempts INTO v_attempts FROM login_attempts WHERE family_name_lower = p_family_lower;

  IF v_attempts >= 5 THEN
    UPDATE login_attempts SET locked_until = now() + interval '5 minutes'
    WHERE family_name_lower = p_family_lower;
  END IF;
END;
$$;

-- ============ AUTH: signup ============

CREATE OR REPLACE FUNCTION signup(p_family_name text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_family_lower text := lower(btrim(p_family_name));
  v_existing players%ROWTYPE;
  v_player_id uuid;
  v_token uuid;
BEGIN
  IF length(v_family_lower) < 3 OR length(v_family_lower) > 24 THEN
    RETURN jsonb_build_object('error', 'Nome de família deve ter entre 3 e 24 caracteres');
  END IF;

  IF v_family_lower = 'master' THEN
    RETURN jsonb_build_object('error', 'Este nome de família não está disponível');
  END IF;

  IF p_pin !~ '^[0-9]{4}$' THEN
    RETURN jsonb_build_object('error', 'A senha deve ter exatamente 4 dígitos');
  END IF;

  SELECT * INTO v_existing FROM players WHERE family_name_lower = v_family_lower;
  IF FOUND THEN
    RETURN jsonb_build_object('error', 'Este nome de família já está cadastrado');
  END IF;

  INSERT INTO players (family_name, family_name_lower, pin_hash, is_master)
  VALUES (p_family_name, v_family_lower, crypt(p_pin, gen_salt('bf')), false)
  RETURNING id INTO v_player_id;

  v_token := gen_random_uuid();
  INSERT INTO sessions (token, player_id, expires_at)
  VALUES (v_token, v_player_id, now() + interval '30 days');

  RETURN jsonb_build_object(
    'token', v_token,
    'player', jsonb_build_object(
      'id', v_player_id,
      'family_name', p_family_name,
      'is_master', false
    )
  );
END;
$$;

-- ============ AUTH: login ============

CREATE OR REPLACE FUNCTION login(p_family_name text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_family_lower text := lower(btrim(p_family_name));
  v_player players%ROWTYPE;
  v_token uuid;
  v_attempt login_attempts%ROWTYPE;
  v_pin_pattern text;
BEGIN
  SELECT * INTO v_player FROM players WHERE family_name_lower = v_family_lower;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Nome de família ou senha incorretos');
  END IF;

  SELECT * INTO v_attempt FROM login_attempts WHERE family_name_lower = v_family_lower;
  IF FOUND AND v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > now() THEN
    RETURN jsonb_build_object('error', 'Muitas tentativas. Tente novamente em alguns minutos.');
  END IF;

  IF v_player.is_master THEN
    v_pin_pattern := '^.{6,}$';
  ELSE
    v_pin_pattern := '^[0-9]{4}$';
  END IF;

  IF p_pin !~ v_pin_pattern THEN
    IF NOT v_player.is_master THEN
      PERFORM _record_failed_attempt(v_family_lower);
    END IF;
    RETURN jsonb_build_object('error', 'Nome de família ou senha incorretos');
  END IF;

  IF v_player.pin_hash != crypt(p_pin, v_player.pin_hash) THEN
    PERFORM _record_failed_attempt(v_family_lower);
    RETURN jsonb_build_object('error', 'Nome de família ou senha incorretos');
  END IF;

  DELETE FROM login_attempts WHERE family_name_lower = v_family_lower;

  v_token := gen_random_uuid();
  INSERT INTO sessions (token, player_id, expires_at)
  VALUES (v_token, v_player.id, now() + interval '30 days');

  RETURN jsonb_build_object(
    'token', v_token,
    'player', jsonb_build_object(
      'id', v_player.id,
      'family_name', v_player.family_name,
      'is_master', v_player.is_master
    )
  );
END;
$$;

-- ============ AUTH: logout ============

CREATE OR REPLACE FUNCTION logout(p_token uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  DELETE FROM sessions WHERE token = p_token;
$$;

-- ============ AUTH: get_session ============

CREATE OR REPLACE FUNCTION get_session(p_token uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'token', p_token,
    'player', jsonb_build_object(
      'id', p.id,
      'family_name', p.family_name,
      'is_master', p.is_master,
      'confirmed_at', p.confirmed_at
    )
  )
  FROM players p
  JOIN sessions s ON s.player_id = p.id
  WHERE s.token = p_token
    AND s.expires_at > now()
$$;

-- ============ AUTH: change_pin ============

CREATE OR REPLACE FUNCTION change_pin(p_token uuid, p_new_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_player players%ROWTYPE;
BEGIN
  SELECT * INTO v_player FROM _validate_session(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sessão inválida');
  END IF;

  IF v_player.is_master THEN
    IF p_new_pin !~ '^.{6,}$' THEN
      RETURN jsonb_build_object('error', 'A senha do master deve ter 6 ou mais caracteres');
    END IF;
  ELSE
    IF p_new_pin !~ '^[0-9]{4}$' THEN
      RETURN jsonb_build_object('error', 'A senha deve ter exatamente 4 dígitos');
    END IF;
  END IF;

  UPDATE players SET pin_hash = crypt(p_new_pin, gen_salt('bf')) WHERE id = v_player.id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ PREDICTIONS: save_prediction ============

CREATE OR REPLACE FUNCTION save_prediction(p_token uuid, p_option_id uuid, p_answer boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_player players%ROWTYPE;
BEGIN
  SELECT * INTO v_player FROM _validate_session(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sessão inválida');
  END IF;

  IF _deadline_passed() THEN
    RETURN jsonb_build_object('error', 'O prazo para palpites já foi encerrado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM options WHERE id = p_option_id AND is_active = true) THEN
    RETURN jsonb_build_object('error', 'Opção inválida');
  END IF;

  INSERT INTO predictions (player_id, option_id, answer, updated_at)
  VALUES (v_player.id, p_option_id, p_answer, now())
  ON CONFLICT (player_id, option_id) DO UPDATE
    SET answer = EXCLUDED.answer, updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ PREDICTIONS: confirm_predictions ============

CREATE OR REPLACE FUNCTION confirm_predictions(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_player players%ROWTYPE;
BEGIN
  SELECT * INTO v_player FROM _validate_session(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sessão inválida');
  END IF;

  IF _deadline_passed() THEN
    RETURN jsonb_build_object('error', 'O prazo para palpites já foi encerrado');
  END IF;

  UPDATE players SET confirmed_at = now() WHERE id = v_player.id;
  RETURN jsonb_build_object('success', true, 'confirmed_at', now());
END;
$$;

-- ============ PREDICTIONS: get_my_predictions ============

CREATE OR REPLACE FUNCTION get_my_predictions(p_token uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'option_id', pred.option_id,
        'answer', pred.answer,
        'updated_at', pred.updated_at
      )
    ),
    '[]'::jsonb
  )
  FROM predictions pred
  JOIN players p ON p.id = pred.player_id
  JOIN sessions s ON s.player_id = p.id
  WHERE s.token = p_token AND s.expires_at > now()
$$;

-- ============ PREDICTIONS: get_all_predictions ============

CREATE OR REPLACE FUNCTION get_all_predictions(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_published boolean;
BEGIN
  SELECT * INTO v_player FROM _validate_session(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sessão inválida');
  END IF;

  SELECT value::boolean INTO v_published FROM settings WHERE key = 'results_published';

  RETURN jsonb_build_object(
    'published', v_published,
    'predictions', COALESCE(
      CASE WHEN v_published THEN
        jsonb_agg(
          jsonb_build_object(
            'player_id', pred.player_id,
            'family_name', p.family_name,
            'option_id', pred.option_id,
            'answer', pred.answer
          )
        )
      ELSE
        jsonb_agg(
          jsonb_build_object(
            'option_id', pred.option_id,
            'answer', pred.answer
          )
        )
      END,
      '[]'::jsonb
    )
  )
  FROM predictions pred
  JOIN players p ON p.id = pred.player_id
  WHERE v_published OR pred.player_id = v_player.id;
END;
$$;

-- ============ PUBLIC: get_settings ============

CREATE OR REPLACE FUNCTION get_settings()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) FROM settings
$$;

-- ============ ADMIN: admin_list_players ============

CREATE OR REPLACE FUNCTION admin_list_players(p_token uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'family_name', p.family_name,
        'is_master', p.is_master,
        'confirmed_at', p.confirmed_at,
        'created_at', p.created_at,
        'prediction_count', COALESCE(pred.cnt, 0)
      )
      ORDER BY p.family_name
    ),
    '[]'::jsonb
  )
  FROM players p
  LEFT JOIN (SELECT player_id, count(*) AS cnt FROM predictions GROUP BY player_id) pred
    ON pred.player_id = p.id
  WHERE EXISTS (
    SELECT 1 FROM _validate_session(p_token) vs
    WHERE vs.is_master = true
  )
$$;

-- ============ ADMIN: admin_reset_player_pin ============

CREATE OR REPLACE FUNCTION admin_reset_player_pin(p_token uuid, p_player_id uuid, p_new_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin players%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM _validate_session(p_token);
  IF NOT FOUND OR NOT v_admin.is_master THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  IF p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN jsonb_build_object('error', 'A nova senha deve ter 4 dígitos');
  END IF;

  UPDATE players SET pin_hash = crypt(p_new_pin, gen_salt('bf'))
  WHERE id = p_player_id AND is_master = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Jogador não encontrado');
  END IF;

  DELETE FROM sessions WHERE player_id = p_player_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ ADMIN: admin_delete_player ============

CREATE OR REPLACE FUNCTION admin_delete_player(p_token uuid, p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin players%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM _validate_session(p_token);
  IF NOT FOUND OR NOT v_admin.is_master THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  IF EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND is_master = true) THEN
    RETURN jsonb_build_object('error', 'Não é possível remover o usuário master');
  END IF;

  DELETE FROM players WHERE id = p_player_id AND is_master = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Jogador não encontrado');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ ADMIN: admin_upsert_category ============

CREATE OR REPLACE FUNCTION admin_upsert_category(
  p_token uuid, p_id uuid, p_name text, p_icon text, p_sort_order int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin players%ROWTYPE;
  v_cat_id uuid;
BEGIN
  SELECT * INTO v_admin FROM _validate_session(p_token);
  IF NOT FOUND OR NOT v_admin.is_master THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN jsonb_build_object('error', 'Nome da categoria é obrigatório');
  END IF;

  INSERT INTO categories (id, name, icon, sort_order)
  VALUES (COALESCE(p_id, gen_random_uuid()), p_name, p_icon, COALESCE(p_sort_order, 0))
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order
  RETURNING id INTO v_cat_id;

  RETURN jsonb_build_object('success', true, 'id', v_cat_id);
END;
$$;

-- ============ ADMIN: admin_delete_category ============

CREATE OR REPLACE FUNCTION admin_delete_category(p_token uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin players%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM _validate_session(p_token);
  IF NOT FOUND OR NOT v_admin.is_master THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  DELETE FROM categories WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ ADMIN: admin_upsert_option ============

CREATE OR REPLACE FUNCTION admin_upsert_option(
  p_token uuid, p_id uuid, p_category_id uuid, p_title text, p_description text,
  p_emoji text, p_sort_order int, p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin players%ROWTYPE;
  v_opt_id uuid;
BEGIN
  SELECT * INTO v_admin FROM _validate_session(p_token);
  IF NOT FOUND OR NOT v_admin.is_master THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RETURN jsonb_build_object('error', 'Título é obrigatório');
  END IF;

  INSERT INTO options (id, category_id, title, description, emoji, sort_order, is_active)
  VALUES (
    COALESCE(p_id, gen_random_uuid()), p_category_id, p_title, p_description,
    p_emoji, COALESCE(p_sort_order, 0), COALESCE(p_is_active, true)
  )
  ON CONFLICT (id) DO UPDATE
    SET category_id = EXCLUDED.category_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        emoji = EXCLUDED.emoji,
        sort_order = EXCLUDED.sort_order,
        is_active = EXCLUDED.is_active
  RETURNING id INTO v_opt_id;

  RETURN jsonb_build_object('success', true, 'id', v_opt_id);
END;
$$;

-- ============ ADMIN: admin_delete_option ============

CREATE OR REPLACE FUNCTION admin_delete_option(p_token uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin players%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM _validate_session(p_token);
  IF NOT FOUND OR NOT v_admin.is_master THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  DELETE FROM options WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ ADMIN: admin_set_option_result ============

CREATE OR REPLACE FUNCTION admin_set_option_result(p_token uuid, p_option_id uuid, p_happened boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin players%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM _validate_session(p_token);
  IF NOT FOUND OR NOT v_admin.is_master THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  UPDATE options SET happened = p_happened WHERE id = p_option_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Opção não encontrada');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ ADMIN: admin_set_deadline ============

CREATE OR REPLACE FUNCTION admin_set_deadline(p_token uuid, p_deadline timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin players%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM _validate_session(p_token);
  IF NOT FOUND OR NOT v_admin.is_master THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  UPDATE settings SET value = p_deadline::text WHERE key = 'deadline';
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ ADMIN: admin_set_results_published ============

CREATE OR REPLACE FUNCTION admin_set_results_published(p_token uuid, p_published boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin players%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM _validate_session(p_token);
  IF NOT FOUND OR NOT v_admin.is_master THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  UPDATE settings SET value = p_published::text WHERE key = 'results_published';
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ RANKING: _compute_ranking ============

CREATE OR REPLACE FUNCTION _compute_ranking()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH scored AS (
    SELECT
      p.id AS player_id,
      p.family_name,
      p.confirmed_at,
      COALESCE(SUM(
        CASE
          WHEN opt.happened IS NULL THEN 0
          WHEN pred.answer = opt.happened THEN
            (SELECT value::int FROM settings WHERE key = 'points_correct')
          ELSE
            (SELECT value::int FROM settings WHERE key = 'points_wrong')
        END
      ), 0) AS total_points,
      COALESCE(SUM(
        CASE WHEN opt.happened IS NOT NULL AND pred.answer = opt.happened THEN 1 ELSE 0 END
      ), 0) AS correct_count
    FROM players p
    LEFT JOIN predictions pred ON pred.player_id = p.id
    LEFT JOIN options opt ON opt.id = pred.option_id
    WHERE p.is_master = false
    GROUP BY p.id, p.family_name, p.confirmed_at
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'player_id', player_id,
        'family_name', family_name,
        'total_points', total_points,
        'correct_count', correct_count,
        'confirmed_at', confirmed_at
      )
      ORDER BY total_points DESC, correct_count DESC, confirmed_at ASC NULLS LAST, family_name ASC
    ),
    '[]'::jsonb
  )
  FROM scored
$$;

-- ============ ADMIN: admin_get_ranking ============

CREATE OR REPLACE FUNCTION admin_get_ranking(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin players%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM _validate_session(p_token);
  IF NOT FOUND OR NOT v_admin.is_master THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;

  RETURN _compute_ranking();
END;
$$;

-- ============ PUBLIC: get_public_ranking ============

CREATE OR REPLACE FUNCTION get_public_ranking()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_published boolean;
BEGIN
  SELECT value::boolean INTO v_published FROM settings WHERE key = 'results_published';
  IF NOT v_published THEN
    RETURN jsonb_build_object('error', 'Resultados ainda não publicados', 'published', false);
  END IF;

  RETURN jsonb_build_object('published', true, 'ranking', _compute_ranking());
END;
$$;

-- ============ REVOKE & GRANT EXECUTE ============

REVOKE EXECUTE ON FUNCTION _validate_session(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION _deadline_passed() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION _record_failed_attempt(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION _compute_ranking() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION signup(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION signup(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION login(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION login(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION logout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION logout(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_session(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION change_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION change_pin(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION save_prediction(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION save_prediction(uuid, uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION confirm_predictions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION confirm_predictions(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_my_predictions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_predictions(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_all_predictions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_all_predictions(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_settings() TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION admin_list_players(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_list_players(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_reset_player_pin(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_reset_player_pin(uuid, uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_delete_player(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_delete_player(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_upsert_category(uuid, uuid, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_upsert_category(uuid, uuid, text, text, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_delete_category(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_delete_category(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_upsert_option(uuid, uuid, uuid, text, text, text, int, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_upsert_option(uuid, uuid, uuid, text, text, text, int, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_delete_option(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_delete_option(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_set_option_result(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_set_option_result(uuid, uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_set_deadline(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_set_deadline(uuid, timestamptz) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_set_results_published(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_set_results_published(uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_get_ranking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_get_ranking(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_public_ranking() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_public_ranking() TO anon, authenticated;
