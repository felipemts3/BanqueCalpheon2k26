export interface Player {
  id: string;
  family_name: string;
  is_master: boolean;
  confirmed_at: string | null;
}

export interface SessionData {
  token: string;
  player: Player;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface Option {
  id: string;
  category_id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
  happened: boolean | null;
}

export interface Prediction {
  option_id: string;
  answer: boolean;
  multiplier?: number;
  updated_at?: string;
}

export interface PickRow {
  player_id: string;
  family_name: string;
  option_id: string;
  answer: boolean;
  multiplier?: number;
}

export interface RankingEntry {
  player_id: string;
  family_name: string;
  total_points: number;
  correct_count: number;
  confirmed_at: string | null;
  booster_option_title?: string | null;
  booster_multiplier?: number | null;
}

export interface AdminPlayer {
  id: string;
  family_name: string;
  is_master: boolean;
  confirmed_at: string | null;
  created_at: string;
  prediction_count: number;
}

export interface AppSettings {
  deadline: string;
  points_correct: string;
  points_wrong: string;
  results_published: string;
  booster_multipliers?: string;
}
