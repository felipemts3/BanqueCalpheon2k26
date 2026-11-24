/*
# Correções de segurança e lógica

## Problemas corrigidos
1. GABARITO VAZANDO: a coluna options.happened era legível por qualquer pessoa via API
   (anon key) antes da publicação do resultado. Agora só as colunas públicas são legíveis
   e o gabarito sai por get_option_results() (só após publicar, ou sempre para o master).
2. Palpites dos outros jogadores eram liberados só quando o resultado era publicado.
   Regra correta: liberar após o ENCERRAMENTO DO PRAZO.
3. signup: gravava o nome sem btrim e devolvia erro cru em caso de corrida (unique_violation).
4. Bloqueio de login: depois dos 5 minutos o contador não zerava, então 1 erro já bloqueava de novo.

## Observação (não é migration)
O usuário Master foi criado com PIN "0000", mas o login do master exige 6+ caracteres,
então ele NÃO consegue logar até você definir uma senha nova. Veja o README.
*/

-- ============ 1. options.happened: remover leitura pública ============

REVOKE SELECT ON options FROM anon, authenticated;
GRANT SELECT (id, category_id, title, description, emoji, sort_order, is_active)
  ON options TO anon, authenticated;

CREATE OR REPLACE FUNCTION get_option_results(p_token uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_published boolean;
BEGIN
  SELECT COALESCE((SELECT value::boolean FROM settings WHERE key = 'results_published'), false)
    INTO v_published;

  IF p_token IS NOT NULL THEN
    SELECT * INTO v_player FROM _validate_session(p_token);
  END IF;

  IF v_published OR COALESCE(v_player.is_master, false) THEN
    RETURN COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('option_id', id, 'happened', happened))
         FROM options WHERE happened IS NOT NULL),
      '[]'::jsonb
    );
  END IF;

  RETURN '[]'::jsonb;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_option_results(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_option_results(uuid) TO anon, authenticated;

-- ============ 2. get_all_predictions: liberar após o prazo ============

CREATE OR REPLACE FUNCTION get_all_predictions(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_revealed boolean;
BEGIN
  SELECT * INTO v_player FROM _validate_session(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sessão inválida');
  END IF;

  v_revealed := COALESCE(_deadline_passed(), false);

  RETURN jsonb_build_object(
    'revealed', v_revealed,
    'predictions', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'player_id', pred.player_id,
                'family_name', p.family_name,
                'option_id', pred.option_id,
                'answer', pred.answer))
         FROM predictions pred
         JOIN players p ON p.id = pred.player_id
        WHERE p.is_master = false
          AND (v_revealed OR pred.player_id = v_player.id)),
      '[]'::jsonb
    )
  );
END;
$$;

-- ============ 3. signup ============

CREATE OR REPLACE FUNCTION signup(p_family_name text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_name text := btrim(p_family_name);
  v_family_lower text := lower(btrim(p_family_name));
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

  IF EXISTS (SELECT 1 FROM players WHERE family_name_lower = v_family_lower) THEN
    RETURN jsonb_build_object('error', 'Este nome de família já está cadastrado');
  END IF;

  BEGIN
    INSERT INTO players (family_name, family_name_lower, pin_hash, is_master)
    VALUES (v_name, v_family_lower, crypt(p_pin, gen_salt('bf')), false)
    RETURNING id INTO v_player_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'Este nome de família já está cadastrado');
  END;

  v_token := gen_random_uuid();
  INSERT INTO sessions (token, player_id, expires_at)
  VALUES (v_token, v_player_id, now() + interval '30 days');

  RETURN jsonb_build_object(
    'token', v_token,
    'player', jsonb_build_object(
      'id', v_player_id,
      'family_name', v_name,
      'is_master', false
    )
  );
END;
$$;

-- ============ 4. Bloqueio de login: zerar contador após expirar ============

CREATE OR REPLACE FUNCTION _record_failed_attempt(p_family_lower text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row login_attempts%ROWTYPE;
  v_attempts int;
BEGIN
  SELECT * INTO v_row FROM login_attempts WHERE family_name_lower = p_family_lower;

  IF FOUND AND v_row.locked_until IS NOT NULL AND v_row.locked_until <= now() THEN
    UPDATE login_attempts SET attempts = 0, locked_until = NULL
     WHERE family_name_lower = p_family_lower;
  END IF;

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
