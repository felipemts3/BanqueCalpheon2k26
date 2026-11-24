/*
# Reseed options to match new specification

## Problem
The original seed had 4 options per category (24 total). The new spec requires
6 per category (36 total) with different content.

## Approach
1. Delete all existing options (no predictions exist yet, so no data loss).
2. Insert the 36 new options with the exact titles from the spec.
3. Categories remain unchanged (same 6 categories, same IDs).
*/

-- Clear existing options (safe — 0 predictions in the table)
DELETE FROM options;

-- GEAR (category: 11111111-0000-0000-0000-000000000001)
INSERT INTO options (category_id, title, emoji, sort_order, is_active) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Novo tier de equipamento', '⚔️', 1, true),
  ('11111111-0000-0000-0000-000000000001', 'Novo tier de acessórios', '💍', 2, true),
  ('11111111-0000-0000-0000-000000000001', 'Rework do sistema de Failstack/Enhancement', '🔨', 3, true),
  ('11111111-0000-0000-0000-000000000001', 'Aumento do limite de AP/DP', '📈', 4, true),
  ('11111111-0000-0000-0000-000000000001', 'Novo item de boss/equipamento lendário', '🌟', 5, true),
  ('11111111-0000-0000-0000-000000000001', 'Novos sets de outfits de Pearl', '👕', 6, true);

-- PVP (category: 11111111-0000-0000-0000-000000000002)
INSERT INTO options (category_id, title, emoji, sort_order, is_active) VALUES
  ('11111111-0000-0000-0000-000000000002', 'Arena Solare 1v1', '🏟️', 1, true),
  ('11111111-0000-0000-0000-000000000002', 'Rework na Siege', '🏰', 2, true),
  ('11111111-0000-0000-0000-000000000002', 'Rework em Node War', '🏴', 3, true),
  ('11111111-0000-0000-0000-000000000002', 'Novo modo de PvP', '⚔️', 4, true),
  ('11111111-0000-0000-0000-000000000002', 'Rebalanceamento geral de classes', '⚖️', 5, true),
  ('11111111-0000-0000-0000-000000000002', 'Nova temporada de ranking PvP', '🏆', 6, true);

-- PVE (category: 11111111-0000-0000-0000-000000000003)
INSERT INTO options (category_id, title, emoji, sort_order, is_active) VALUES
  ('11111111-0000-0000-0000-000000000003', 'Novo item PVE', '📦', 1, true),
  ('11111111-0000-0000-0000-000000000003', 'Dungeon de 100 andares', '🏯', 2, true),
  ('11111111-0000-0000-0000-000000000003', 'Novo boss mundial', '🐲', 3, true),
  ('11111111-0000-0000-0000-000000000003', 'Nova zona de grind', '🗺️', 4, true),
  ('11111111-0000-0000-0000-000000000003', 'Nova raid/dungeon de grupo', '👥', 5, true),
  ('11111111-0000-0000-0000-000000000003', 'Rework de dungeons antigas', '🔄', 6, true);

-- LIFESKILL (category: 11111111-0000-0000-0000-000000000004)
INSERT INTO options (category_id, title, emoji, sort_order, is_active) VALUES
  ('11111111-0000-0000-0000-000000000004', 'Rework no sistema de Agris', '🌾', 1, true),
  ('11111111-0000-0000-0000-000000000004', 'Novo tipo de LifeSkill', '🌟', 2, true),
  ('11111111-0000-0000-0000-000000000004', 'Rework no Barter', '🚢', 3, true),
  ('11111111-0000-0000-0000-000000000004', 'Rework de Workers', '👷', 4, true),
  ('11111111-0000-0000-0000-000000000004', 'Novos itens/equipamentos de Life', '🛠️', 5, true),
  ('11111111-0000-0000-0000-000000000004', 'Novo evento de pesca', '🎣', 6, true);

-- CONVENIÊNCIA (category: 11111111-0000-0000-0000-000000000005)
INSERT INTO options (category_id, title, emoji, sort_order, is_active) VALUES
  ('11111111-0000-0000-0000-000000000005', 'Melhorias na UI', '✨', 1, true),
  ('11111111-0000-0000-0000-000000000005', 'Rework no sistema de Link', '🔗', 2, true),
  ('11111111-0000-0000-0000-000000000005', 'Rework de Quests para Novos/Jogadores Retornados', '📋', 3, true),
  ('11111111-0000-0000-0000-000000000005', 'Aumento de inventário/armazém', '🎒', 4, true),
  ('11111111-0000-0000-0000-000000000005', 'Melhorias no Marketplace', '🛒', 5, true),
  ('11111111-0000-0000-0000-000000000005', 'Atalhos de conveniência', '⌨️', 6, true);

-- OUTROS (category: 11111111-0000-0000-0000-000000000006)
INSERT INTO options (category_id, title, emoji, sort_order, is_active) VALUES
  ('11111111-0000-0000-0000-000000000006', 'Despertar do Agent', '🎭', 1, true),
  ('11111111-0000-0000-0000-000000000006', 'Vídeo Teaser de Uma Nova Classe', '🎬', 2, true),
  ('11111111-0000-0000-0000-000000000006', 'Vídeo Teaser da Nova Região', '🏜️', 3, true),
  ('11111111-0000-0000-0000-000000000006', 'Novas Montarias', '🐎', 4, true),
  ('11111111-0000-0000-0000-000000000006', 'Novos Pets/rework de Pets', '🐾', 5, true),
  ('11111111-0000-0000-0000-000000000006', 'Colaboração/crossover', '🤝', 6, true);

-- Add the missing "Anúncio de nova expansão" option in Outros
INSERT INTO options (category_id, title, emoji, sort_order, is_active) VALUES
  ('11111111-0000-0000-0000-000000000006', 'Anúncio de nova expansão', '🌍', 7, true);
