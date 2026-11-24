import { supabase } from "./supabase";
import type { Option } from "./types";

// A coluna "happened" (gabarito) NÃO é legível direto pela API: ela só chega via
// get_option_results(), que respeita a publicação do resultado.
export const OPTION_COLUMNS =
  "id,category_id,title,description,emoji,sort_order,is_active";

export async function fetchOptions(token: string | null): Promise<Option[]> {
  const [optRes, resRes] = await Promise.all([
    supabase.from("options").select(OPTION_COLUMNS).order("sort_order"),
    supabase.rpc("get_option_results", { p_token: token }),
  ]);

  const results = new Map<string, boolean>();
  if (Array.isArray(resRes.data)) {
    for (const r of resRes.data as { option_id: string; happened: boolean }[]) {
      results.set(r.option_id, r.happened);
    }
  }

  return ((optRes.data ?? []) as Omit<Option, "happened">[]).map((o) => ({
    ...o,
    happened: results.has(o.id) ? (results.get(o.id) as boolean) : null,
  }));
}
