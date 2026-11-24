import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { fetchOptions } from "@/lib/options";
import type { Category, Option, AppSettings } from "@/lib/types";

interface PickRow {
  player_id: string;
  family_name: string;
  option_id: string;
  answer: boolean;
}

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
    const m = new Map<string, boolean>();
    picks.filter((p) => p.player_id === current).forEach((p) => m.set(p.option_id, p.answer));
    return m;
  }, [picks, current]);

  const ptsOk = Number(settings?.points_correct ?? 10);
  const ptsBad = Number(settings?.points_wrong ?? -5);

  let total = 0;
  options.forEach((o) => {
    const a = answers.get(o.id);
    if (a === undefined || o.happened === null) return;
    total += a === o.happened ? ptsOk : ptsBad;
  });

  return (
    <div className="min-h-screen bg-slate-900 pb-10">
      <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-white font-bold text-base">Palpites da galera</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 mt-4">
        {loading ? (
          <p className="text-amber-400 animate-pulse text-sm">Carregando...</p>
        ) : !revealed ? (
          <div className="bg-slate-800/60 rounded-2xl p-6 text-center">
            <Lock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-white font-semibold text-sm">
              Os palpites dos outros jogadores ficam visíveis após o encerramento do prazo.
            </p>
          </div>
        ) : picks.length === 0 ? (
          <p className="text-slate-400 text-sm">Ninguém enviou palpites.</p>
        ) : (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar família..."
              className="w-full bg-slate-800 text-white text-sm rounded-xl px-4 py-2.5 mb-3 outline-none ring-1 ring-white/5 focus:ring-amber-500/50"
            />
            <div className="flex gap-2 overflow-x-auto pb-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
                    current === p.id
                      ? "bg-amber-500 text-slate-900"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-400 mt-3">
              {answers.size} palpites
              {options.some((o) => o.happened !== null) && ` · ${total} pontos`}
            </p>

            <div className="mt-3 space-y-5">
              {categories.map((cat) => {
                const opts = options.filter((o) => o.category_id === cat.id && o.is_active);
                if (opts.length === 0) return null;
                return (
                  <section key={cat.id}>
                    <h2 className="text-amber-400 text-xs font-bold uppercase tracking-wide mb-2">
                      {cat.name}
                    </h2>
                    <div className="space-y-2">
                      {opts.map((o) => {
                        const a = answers.get(o.id);
                        const resolved = o.happened !== null;
                        const hit = resolved && a !== undefined && a === o.happened;
                        const miss = resolved && a !== undefined && a !== o.happened;
                        return (
                          <div
                            key={o.id}
                            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ring-1 ${
                              hit
                                ? "bg-green-500/10 ring-green-500/20"
                                : miss
                                ? "bg-red-500/10 ring-red-500/20"
                                : "bg-slate-800/60 ring-white/5"
                            }`}
                          >
                            <span className="text-white">
                              {o.emoji} {o.title}
                            </span>
                            <span
                              className={`font-bold text-xs whitespace-nowrap ${
                                a === undefined
                                  ? "text-slate-500"
                                  : a
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {a === undefined ? "—" : a ? "VAI VIR" : "NÃO VAI VIR"}
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
