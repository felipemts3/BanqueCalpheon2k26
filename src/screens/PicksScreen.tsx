import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Lock, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { fetchOptions } from "@/lib/options";
import type { Category, Option, AppSettings } from "@/lib/types";

import type { PickRow } from "@/lib/types";

export default function PicksScreen({ onBack }: { onBack: () => void }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [catRes, opts, setRes, predRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        fetchOptions(token),
        supabase.rpc("get_settings"),
        supabase.rpc("get_all_predictions", { p_token: token }),
      ]);
      if (catRes.data) setCategories(catRes.data as Category[]);
      setOptions(opts);
      if (setRes.data) setSettings(setRes.data as AppSettings);

      const res = predRes.data as
        | { revealed?: boolean; predictions?: PickRow[]; error?: string }
        | null;
      if (res && !res.error) {
        setRevealed(Boolean(res.revealed));
        setPicks(res.predictions ?? []);
      }
      setLoading(false);
    })();
  }, [token]);

  const players = useMemo(() => {
    const map = new Map<string, string>();
    picks.forEach((p) => map.set(p.player_id, p.family_name));
    return Array.from(map, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [picks, search]);

  const current = selected || players[0]?.id || "";
  const answers = useMemo(() => {
    const m = new Map<string, { answer: boolean; multiplier: number }>();
    picks
      .filter((p) => p.player_id === current)
      .forEach((p) => m.set(p.option_id, { answer: p.answer, multiplier: p.multiplier ?? 1 }));
    return m;
  }, [picks, current]);

  const ptsOk = Number(settings?.points_correct ?? 10);
  const ptsBad = Number(settings?.points_wrong ?? -5);

  let total = 0;
  options.forEach((o) => {
    const a = answers.get(o.id);
    if (a === undefined || o.happened === null) return;
    total += (a.answer === o.happened ? ptsOk : ptsBad) * a.multiplier;
  });

  return (
    <div className="min-h-screen bg-ink pb-10">
      <header className="sticky top-0 z-20 bg-ink/80 backdrop-blur-xl border-b border-hairline/15">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-button bg-obsidian text-highlighter hover:bg-white/10"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-paper text-subheading">Palpites da galera</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 mt-4">
        {loading ? (
          <p className="text-highlighter animate-pulse text-sm">Carregando...</p>
        ) : !revealed ? (
          <div className="bg-obsidian/60 rounded-card p-6 text-center">
            <Lock className="w-6 h-6 text-highlighter mx-auto mb-2" />
            <p className="text-paper font-normal text-sm">
              Os palpites dos outros jogadores ficam visíveis após o encerramento do prazo.
            </p>
          </div>
        ) : picks.length === 0 ? (
          <p className="text-smoke/70 text-sm">Ninguém enviou palpites.</p>
        ) : (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar família..."
              className="w-full bg-obsidian text-paper text-sm rounded-input px-4 py-2.5 mb-3 outline-none ring-1 ring-hairline/15 focus:ring-highlighter/50"
            />
            <div className="flex gap-2 overflow-x-auto pb-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`px-3.5 py-2 rounded-input text-sm font-normal whitespace-nowrap ${
                    current === p.id
                      ? "bg-highlighter text-ink"
                      : "bg-obsidian text-smoke/70 hover:text-paper"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <p className="text-xs text-smoke/70 mt-3">
              {answers.size} palpites
              {options.some((o) => o.happened !== null) && ` · ${total} pontos`}
            </p>

            <div className="mt-3 space-y-5">
              {categories.map((cat) => {
                const opts = options.filter((o) => o.category_id === cat.id && o.is_active);
                if (opts.length === 0) return null;
                return (
                  <section key={cat.id}>
                    <h2 className="text-highlighter text-xs font-normal uppercase tracking-[0.05em] mb-2">
                      {cat.name}
                    </h2>
                    <div className="space-y-2">
                      {opts.map((o) => {
                        const a = answers.get(o.id);
                        const resolved = o.happened !== null;
                        const hit = resolved && a !== undefined && a.answer === o.happened;
                        const miss = resolved && a !== undefined && a.answer !== o.happened;
                        const boosted = (a?.multiplier ?? 1) > 1;
                        return (
                          <div
                            key={o.id}
                            className={`flex items-center justify-between gap-3 rounded-input px-4 py-3 text-sm ring-1 ${
                              hit
                                ? "bg-highlighter/10 ring-highlighter/30"
                                : miss
                                ? "bg-white/5 ring-hairline/15"
                                : boosted
                                ? "bg-obsidian/60 ring-highlighter/40"
                                : "bg-obsidian/60 ring-hairline/15"
                            }`}
                          >
                            <span className="text-paper">
                              {o.emoji} {o.title}
                            </span>
                            <span
                              className={`font-normal text-xs whitespace-nowrap flex items-center gap-1.5 ${
                                a === undefined
                                  ? "text-smoke/55"
                                  : a.answer
                                  ? "text-highlighter"
                                  : "text-paper"
                              }`}
                            >
                              {boosted && (
                                <span className="flex items-center gap-0.5 bg-highlighter/20 text-highlighter px-1.5 py-0.5 rounded-tag ring-1 ring-highlighter/40">
                                  <Zap className="w-3 h-3" /> x{a!.multiplier}
                                </span>
                              )}
                              {a === undefined ? "—" : a.answer ? "VAI VIR" : "NÃO VAI VIR"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
