/*
# Palpite em Branco + Turbo (Multiplicador)

## Funcionalidade 1 — Palpite em branco
- Nova RPC `clear_prediction(p_token uuid, p_option_id uuid)`: apaga a linha do
  palpite do jogador (volta para EM BRANCO). Valida sessão e prazo no servidor.

## Funcionalidade 2 — Turbo (multiplicador único por jogador)
- Nova coluna `predictions.multiplier smallint NOT NULL DEFAULT 1 CHECK (multiplier IN (1,2,4,8))`.
- Índice único parcial `one_booster_per_player ON predictions(player_id) WHERE multiplier > 1`
  garante no banco que cada jogador tenha no máximo um turbo.
- Nova RPC `set_booster(p_token uuid, p_option_id uuid, p_multiplier int)`:
  valida sessão, prazo e existência de palpite; aceita 1, 2, 4 ou 8 (1 = remover);
  em uma única transação zera o turbo anterior e aplica o novo.
- `save_prediction` reescrito preservando o multiplier no UPDATE (o turbo fica na
  opção quando o jogador só troca VAI VIR ↔ NÃO VAI VIR).
- `get_my_predictions` e `get_all_predictions` agora devolvem `multiplier`.
- `_compute_ranking` calcula pontos = (acerto ? points_correct : points_wrong) × multiplier
  e retorna também `booster_option_title` e `booster_multiplier`.
- Settings: nova chave `booster_multipliers` = '2,4,8' (editável pelo admin).
- Grants: EXECUTE nas novas RPCs para anon + authenticated; revogado de PUBLIC.

## Compatibilidade
- Nenhuma coluna foi removida ou alterada em tipo; dados existentes preservados.
- Multiplier default 1 = comportamento antigo (pontuação normal).
- Formato de retorno das RPCs mantido (mesmas chaves, apenas chaves novas adicionadas).
*/

-- ============ COLUNA E ÍNDICE ============

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS multiplier smallint NOT NULL DEFAULT 1;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'predictions_multiplier_check'
  ) THEN
    ALTER TABLE predictions ADD CONSTRAINT predictions_multiplier_check
      CHECK (multiplier IN (1, 2, 4, 8));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS one_booster_per_player
  ON predictions(player_id) WHERE multiplier > 1;

-- ============ SETTINGS: multiplicadores permitidos ============

INSERT INTO settings (key, value) VALUES ('booster_multipliers', '2,4,8')
ON CONFLICT (key) DO NOTHING;

-- ============ RPC: clear_prediction ============

CREATE OR REPLACE FUNCTION clear_prediction(p_token uuid, p_option_id uuid)
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

  DELETE FROM predictions
  WHERE player_id = v_player.id AND option_id = p_option_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============ RPC: set_booster ============

CREATE OR REPLACE FUNCTION set_booster(p_token uuid, p_option_id uuid, p_multiplier int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_current smallint;
BEGIN
  SELECT * INTO v_player FROM _validate_session(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sessão inválida');
  END IF;

  IF _deadline_passed() THEN
    RETURN jsonb_build_object('error', 'O prazo para palpites já foi encerrado');
  END IF;

  IF p_multiplier NOT IN (1, 2, 4, 8) THEN
    RETURN jsonb_build_object('error', 'Multiplicador inválido (use 1, 2, 4 ou 8)');
  END IF;

  SELECT multiplier INTO v_current
  FROM predictions
  WHERE player_id = v_player.id AND option_id = p_option_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Dê um palpite (VAI VIR ou NÃO VAI VIR) antes de turbinar');
  END IF;

  IF p_multiplier = 1 THEN
    IF v_current = 1 THEN
      RETURN jsonb_build_object('error', 'Esta opção não tem turbo');
    END IF;
    UPDATE predictions SET multiplier = 1
    WHERE player_id = v_player.id AND option_id = p_option_id;
    RETURN jsonb_build_object('ok', true, 'multiplier', 1);
  END IF;

  -- Remove o turbo anterior (se houver) e aplica o novo — única transação (corpo da função)
  UPDATE predictions SET multiplier = 1
  WHERE player_id = v_player.id AND multiplier > 1;

  UPDATE predictions SET multiplier = p_multiplier
  WHERE player_id = v_player.id AND option_id = p_option_id;

  RETURN jsonb_build_object('ok', true, 'multiplier', p_multiplier);
END;
$$;

-- ============ RPC: save_prediction (preserva multiplier) ============

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
    -- multiplier NÃO é alterado: o turbo permanece na opção

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ RPC: get_my_predictions (+multiplier) ============

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
        'multiplier', pred.multiplier,
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

-- ============ RPC: get_all_predictions (+multiplier) ============

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
                'answer', pred.answer,
                'multiplier', pred.multiplier))
         FROM predictions pred
         JOIN players p ON p.id = pred.player_id
        WHERE p.is_master = false
          AND (v_revealed OR pred.player_id = v_player.id)),
      '[]'::jsonb
    )
  );
END;
$$;

-- ============ RANKING: _compute_ranking (multiplier + turbo info) ============

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
          WHEN opt.happened IS NULL OR pred.id IS NULL THEN 0
          WHEN pred.answer = opt.happened THEN
            (SELECT value::int FROM settings WHERE key = 'points_correct') * pred.multiplier
          ELSE
            (SELECT value::int FROM settings WHERE key = 'points_wrong') * pred.multiplier
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
  ),
  boosters AS (
    SELECT pred.player_id, opt.title AS booster_option_title, pred.multiplier AS booster_multiplier
    FROM predictions pred
    JOIN options opt ON opt.id = pred.option_id
    WHERE pred.multiplier > 1
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'player_id', s.player_id,
        'family_name', s.family_name,
        'total_points', s.total_points,
        'correct_count', s.correct_count,
        'confirmed_at', s.confirmed_at,
        'booster_option_title', b.booster_option_title,
        'booster_multiplier', b.booster_multiplier
      )
      ORDER BY s.total_points DESC, s.correct_count DESC, s.confirmed_at ASC NULLS LAST, s.family_name ASC
    ),
    '[]'::jsonb
  )
  FROM scored s
  LEFT JOIN boosters b ON b.player_id = s.player_id
$$;

-- ============ GRANTS ============

REVOKE EXECUTE ON FUNCTION clear_prediction(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clear_prediction(uuid, uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION set_booster(uuid, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_booster(uuid, uuid, int) TO anon, authenticated;
