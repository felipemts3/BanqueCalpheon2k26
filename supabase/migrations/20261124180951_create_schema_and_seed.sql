/*
# Bolão do Banquete de Calpheon 2026 — Schema, RLS, and Seed

## Overview
Creates the full database schema for a prediction game ("bolão") about the
Black Desert Online Calpheon Banquet 2026 event. Uses custom authentication
(family name + 4-digit PIN) via SECURITY DEFINER RPC functions — NOT Supabase
Auth. All sensitive data access goes through RPCs; only public reference data
(categories, options, settings) is readable directly.

## Tables

### players
- `id` (uuid, PK) — player identifier
- `family_name` (text, NOT NULL) — BDO family name as typed by user
- `family_name_lower` (text, UNIQUE, NOT NULL) — lowercased for case-insensitive lookup
- `pin_hash` (text, NOT NULL) — bcrypt hash of the PIN (never plaintext)
- `is_master` (boolean, default false) — admin flag
- `confirmed_at` (timestamptz, nullable) — when player confirmed predictions (tiebreak)
- `created_at` (timestamptz, default now())

### sessions
- `token` (uuid, PK) — session token
- `player_id` (uuid, FK → players.id ON DELETE CASCADE)
- `expires_at` (timestamptz, NOT NULL)
- `created_at` (timestamptz, default now())

### login_attempts
- `family_name_lower` (text, PK)
- `attempts` (int, default 0)
- `locked_until` (timestamptz, nullable)

### categories
- `id` (uuid, PK)
- `name` (text, NOT NULL)
- `icon` (text, nullable) — lucide icon name
- `sort_order` (int, default 0)

### options
- `id` (uuid, PK)
- `category_id` (uuid, FK → categories.id ON DELETE CASCADE)
- `title` (text, NOT NULL)
- `description` (text, nullable)
- `emoji` (text, nullable)
- `sort_order` (int, default 0)
- `is_active` (boolean, default true) — hidden if false
- `happened` (boolean, nullable) — null = not yet determined; set by admin

### predictions
- `id` (uuid, PK)
- `player_id` (uuid, FK → players.id ON DELETE CASCADE)
- `option_id` (uuid, FK → options.id ON DELETE CASCADE)
- `answer` (boolean, NOT NULL) — true = "VAI VIR", false = "NÃO VAI VIR"
- `updated_at` (timestamptz, default now())
- UNIQUE (player_id, option_id)

### settings
- `key` (text, PK)
- `value` (text, NOT NULL)

## Security
- RLS enabled on ALL tables.
- Direct SELECT granted to anon, authenticated on: categories, options, settings (public reference data).
- NO direct access granted on: players, sessions, login_attempts, predictions (sensitive — RPC only).
- All mutations and sensitive reads go through SECURITY DEFINER RPC functions.

## Seed Data
- Categories: Gear, PVP, PVE, LifeSkill, Conveniência, Outros
- Options: a starter set of prediction options per category
- Settings: deadline (2026-12-12 02:55 America/Sao_Paulo), points_correct=10, points_wrong=-5, results_published=false
- Master player: family name "Master", PIN "0000" (CHANGE THIS — see notes below)

## Important Notes
1. The master account password is "0000" by default. To change it, run:
   UPDATE players SET pin_hash = crypt('YOUR_NEW_PASSWORD', gen_salt('bf'))
   WHERE family_name_lower = 'master';
2. The master account accepts 6+ character passwords (enforced in RPC logic).
3. The deadline is stored in settings as an ISO timestamp in UTC.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ TABLES ============

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_name text NOT NULL,
  family_name_lower text UNIQUE NOT NULL,
  pin_hash text NOT NULL,
  is_master boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_attempts (
  family_name_lower text PRIMARY KEY,
  attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  emoji text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  happened boolean
);

CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  answer boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, option_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- ============ RLS ============

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Public read-only tables (categories, options, settings)
GRANT SELECT ON categories TO anon, authenticated;
GRANT SELECT ON options TO anon, authenticated;
GRANT SELECT ON settings TO anon, authenticated;

-- Sensitive tables: no direct grants to anon/authenticated.
-- All access is via SECURITY DEFINER RPC functions (service_role bypasses RLS).

-- ============ SEED: Settings ============

INSERT INTO settings (key, value) VALUES
  ('deadline', '2026-12-12T05:55:00Z'),  -- 02:55 America/Sao_Paulo = 05:55 UTC (UTC-3)
  ('points_correct', '10'),
  ('points_wrong', '-5'),
  ('results_published', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============ SEED: Categories ============

INSERT INTO categories (id, name, icon, sort_order) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Gear', 'Sword', 1),
  ('11111111-0000-0000-0000-000000000002', 'PVP', 'CrossedSwords', 2),
  ('11111111-0000-0000-0000-000000000003', 'PVE', 'Skull', 3),
  ('11111111-0000-0000-0000-000000000004', 'LifeSkill', 'ChefHat', 4),
  ('11111111-0000-0000-0000-000000000005', 'Conveniência', 'Sparkles', 5),
  ('11111111-0000-0000-0000-000000000006', 'Outros', 'MoreHorizontal', 6)
ON CONFLICT (id) DO NOTHING;

-- ============ SEED: Options ============

INSERT INTO options (id, category_id, title, description, emoji, sort_order, is_active) VALUES
-- Gear
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Nova linha de equipamentos Boss', 'Anúncio de novos equipamentos Boss (ex: nova armadura/arma)', '⚔️', 1, true),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'Sistema de refinamento reformulado', 'Mudanças no sistema de enhancement/failstacks', '🔨', 2, true),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'Novo tipo de acessório', 'Anúncio de uma nova categoria de acessório', '💍', 3, true),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'Item de transferência de gear', 'Sistema para mover equipamentos entre personagens', '🔄', 4, true),
-- PVP
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000002', 'Novo modo de Guerra de Node', 'Anúncio de mudanças ou novo formato de Node War', '🏴', 1, true),
  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000002', 'Rebalanceamento de classes para PVP', 'Mudanças específicas de balanceamento PVP', '⚖️', 2, true),
  ('22222222-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000002', 'Nova arena ou battleground', 'Anúncio de novo conteúdo PVP instanciado', '🏟️', 3, true),
  ('22222222-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000002', 'Sistema de ranking PVP sazonal', 'Ranking competitivo com recompensas', '🏆', 4, true),
-- PVE
  ('22222222-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000003', 'Novo dungeon endgame', 'Anúncio de uma nova dungeon de alto nível', '🏰', 1, true),
  ('22222222-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000003', 'Novo world boss', 'Anúncio de um novo chefão mundial', '🐲', 2, true),
  ('22222222-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000003', 'Expansão de zona de grind', 'Nova área ou região para grinding', '🗺️', 3, true),
  ('22222222-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000003', 'Sistema de raid em grupo', 'Conteúdo cooperativo para grupos maiores', '👥', 4, true),
-- LifeSkill
  ('22222222-0000-0000-0000-000000000013', '11111111-0000-0000-0000-000000000004', 'Nova life skill', 'Anúncio de uma nova profissão/habilidade de vida', '🌟', 1, true),
  ('22222222-0000-0000-0000-000000000014', '11111111-0000-0000-0000-000000000004', 'Rebalanceamento de coleta/processamento', 'Mudanças no sistema de gathering/processing', '🌾', 2, true),
  ('22222222-0000-0000-0000-000000000015', '11111111-0000-0000-0000-000000000004', 'Novo sistema de cozinha', 'Receitas ou mecânicas novas de culinária', '🍲', 3, true),
  ('22222222-0000-0000-0000-000000000016', '11111111-0000-0000-0000-000000000004', 'Barco/navio novo', 'Anúncio de novo conteúdo marítimo', '⛵', 4, true),
-- Conveniência
  ('22222222-0000-0000-0000-000000000017', '11111111-0000-0000-0000-000000000005', 'Melhorias de QoL na UI', 'Atualizações de interface e qualidade de vida', '✨', 1, true),
  ('22222222-0000-0000-0000-000000000018', '11111111-0000-0000-0000-000000000005', 'Expansão de inventário/banco', 'Aumento de capacidade de armazenamento', '🎒', 2, true),
  ('22222222-0000-0000-0000-000000000019', '11111111-0000-0000-0000-000000000005', 'Novo sistema de montarias', 'Mudanças ou adições no sistema de cavalos/montarias', '🐎', 3, true),
  ('22222222-0000-0000-0000-000000000020', '11111111-0000-0000-0000-000000000005', 'Sistema de pets reformulado', 'Mudanças no sistema de pets/companheiros', '🐾', 4, true),
-- Outros
  ('22222222-0000-0000-0000-000000000021', '11111111-0000-0000-0000-000000000006', 'Nova classe anunciada', 'Anúncio de uma nova classe jogável', '🧙', 1, true),
  ('22222222-0000-0000-0000-000000000022', '11111111-0000-0000-0000-000000000006', 'Evento de aniversário/recompensas', 'Eventos comemorativos com premiação especial', '🎉', 2, true),
  ('22222222-0000-0000-0000-000000000023', '11111111-0000-0000-0000-000000000006', 'Colaboração/cross-promoção', 'Parceria com outra marca ou IP', '🤝', 3, true),
  ('22222222-0000-0000-0000-000000000024', '11111111-0000-0000-0000-000000000006', 'Roadmap revelado', 'Divulgação do roadmap de atualizações futuras', '📋', 4, true)
ON CONFLICT (id) DO NOTHING;

-- ============ SEED: Master Player ============
-- Default PIN: "0000". Change via:
--   UPDATE players SET pin_hash = crypt('YOUR_PASSWORD', gen_salt('bf')) WHERE family_name_lower = 'master';

INSERT INTO players (family_name, family_name_lower, pin_hash, is_master)
SELECT 'Master', 'master', crypt('0000', gen_salt('bf')), true
WHERE NOT EXISTS (SELECT 1 FROM players WHERE family_name_lower = 'master');
