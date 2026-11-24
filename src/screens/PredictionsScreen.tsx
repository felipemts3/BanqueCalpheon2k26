import { useState, useEffect, useCallback, useMemo } from "react";
import { Check, CheckCircle2, Lock, Trophy, LogOut, Settings, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type {
  Category,
  Option,
  Prediction,
  AppSettings,
} from "@/lib/types";
import Countdown from "@/components/Countdown";
import { getIcon } from "@/lib/icons";
import { fetchOptions } from "@/lib/options";

interface PredictionMap {
  [optionId: string]: boolean;
}

export default function PredictionsScreen({
  onNavigate,
}: {
  onNavigate: (screen: "ranking" | "admin" | "picks") => void;
}) {
  const { player, token, signOut } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [predictions, setPredictions] = useState<PredictionMap>({});
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeCat, setActiveCat] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  // Sync confirmed state from auth context (set on page reload)
  useEffect(() => {
    if (player?.confirmed_at) setConfirmed(true);
  }, [player]);

  const loadData = async () => {
    const [catRes, optRes, settingsRes, predRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      fetchOptions(token),
      supabase.rpc("get_settings"),
      token ? supabase.rpc("get_my_predictions", { p_token: token }) : Promise.resolve({ data: [] }),
    ]);

    if (catRes.data) setCategories(catRes.data as Category[]);
    setOptions(optRes);
    if (settingsRes.data) setSettings(settingsRes.data as AppSettings);

    if (predRes.data && Array.isArray(predRes.data)) {
      const map: PredictionMap = {};
      (predRes.data as Prediction[]).forEach((p) => {
        map[p.option_id] = p.answer;
      });
      setPredictions(map);
    }

    if (catRes.data && catRes.data.length > 0) {
      setActiveCat((catRes.data as Category[])[0].id);
    }
    setLoading(false);
  };

  const deadlinePassed = useMemo(() => {
    if (!settings?.deadline) return false;
    return Date.now() >= new Date(settings.deadline).getTime();
  }, [settings]);

  const activeOptions = useMemo(
    () => options.filter((o) => o.category_id === activeCat && o.is_active),
    [options, activeCat]
  );

  const totalAnswered = useMemo(
    () => Object.keys(predictions).length,
    [predictions]
  );
  const totalActive = useMemo(
    () => options.filter((o) => o.is_active).length,
    [options]
  );

  const catAnswered = useMemo(
    () => activeOptions.filter((o) => predictions[o.id] !== undefined).length,
    [activeOptions, predictions]
  );

  const handlePrediction = useCallback(
    async (optionId: string, answer: boolean) => {
      if (deadlinePassed) return;

      const previous = predictions[optionId];

      // Optimistic update
      setPredictions((prev) => ({ ...prev, [optionId]: answer }));
      setSaveStatus("saving");

      const { data, error } = await supabase.rpc("save_prediction", {
        p_token: token,
        p_option_id: optionId,
        p_answer: answer,
      });

      const result = data as Record<string, unknown> | null;
      if (error || !result || result.error) {
        // Restaura o valor anterior (não apaga o palpite que já existia)
        setPredictions((prev) => {
          const next = { ...prev };
          if (previous === undefined) delete next[optionId];
          else next[optionId] = previous;
          return next;
        });
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2500);
        return;
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    },
    [token, deadlinePassed, predictions]
  );

  const handleConfirm = async () => {
    if (!token) return;
    const { data } = await supabase.rpc("confirm_predictions", {
      p_token: token,
    });
    const result = data as Record<string, unknown>;
    if (result && !result.error) {
      setConfirmed(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-amber-400 animate-pulse text-sm">Carregando palpites...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-white font-bold text-base sm:text-lg leading-tight">
                Bolão do Banquete
              </h1>
              <p className="text-amber-400/70 text-xs">
                {player?.family_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {player?.is_master && (
                <button
                  onClick={() => onNavigate("admin")}
                  className="p-2 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700 transition-colors"
                  title="Painel Admin"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}
              {deadlinePassed && (
                <button
                  onClick={() => onNavigate("picks")}
                  className="p-2 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700 transition-colors"
                  title="Palpites da galera"
                >
                  <Users className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => onNavigate("ranking")}
                className="p-2 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700 transition-colors"
                title="Ranking"
              >
                <Trophy className="w-5 h-5" />
              </button>
              <button
                onClick={signOut}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Countdown */}
          <Countdown deadline={settings?.deadline || ""} />

          {/* Progress */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${totalActive > 0 ? (totalAnswered / totalActive) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
              {totalAnswered}/{totalActive} palpites
            </span>
          </div>
        </div>
      </header>

      {/* Deadline banner */}
      {deadlinePassed && (
        <div className="bg-red-500/15 border-b border-red-500/20 px-4 py-2 text-center">
          <p className="text-red-400 text-sm font-medium flex items-center justify-center gap-1.5">
            <Lock className="w-4 h-4" />
            Palpites encerrados — aguarde o resultado
          </p>
        </div>
      )}

      {/* Save status */}
      <div className="max-w-4xl mx-auto px-4 mt-3 h-5">
        {saveStatus === "saving" && (
          <span className="text-xs text-slate-500">Salvando...</span>
        )}
        {saveStatus === "error" && (
          <span className="text-xs text-red-400">
            Não foi possível salvar. Verifique sua conexão e tente de novo.
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Salvo
          </span>
        )}
      </div>

      {/* Category chips */}
      <div className="max-w-4xl mx-auto px-4 mt-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {categories.map((cat) => {
            const Icon = getIcon(cat.icon);
            const isActive = activeCat === cat.id;
            const catOpts = options.filter(
              (o) => o.category_id === cat.id && o.is_active
            );
            const catDone = catOpts.filter(
              (o) => predictions[o.id] !== undefined
            ).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-amber-500 text-slate-900"
                    : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
                <span
                  className={`text-[10px] tabular-nums ${
                    isActive ? "text-slate-800/60" : "text-slate-600"
                  }`}
                >
                  {catDone}/{catOpts.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Options */}
      <div className="max-w-4xl mx-auto px-4 mt-3 space-y-3">
        <p className="text-xs text-slate-500">
          {catAnswered} de {activeOptions.length} respondidas nesta categoria
        </p>
        {activeOptions.map((opt) => {
          const pred = predictions[opt.id];
          const hasAnswer = pred !== undefined;
          const resolved = opt.happened !== null && opt.happened !== undefined;
          const hit = resolved && hasAnswer && pred === opt.happened;
          const miss = resolved && hasAnswer && pred !== opt.happened;
          const ptsOk = settings?.points_correct ?? "10";
          const ptsBad = settings?.points_wrong ?? "-5";
          return (
            <div
              key={opt.id}
              className={`bg-slate-800/60 rounded-2xl p-4 ring-1 transition-all ${
                hasAnswer
                  ? "ring-amber-500/20"
                  : "ring-white/5"
              }`}
            >
              <div className="flex items-start gap-3">
                {opt.emoji && (
                  <span className="text-2xl flex-shrink-0 leading-none mt-0.5">
                    {opt.emoji}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm leading-snug">
                    {opt.title}
                  </h3>
                  {opt.description && (
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                      {opt.description}
                    </p>
                  )}
                </div>
              </div>

              {resolved && (
                <div
                  className={`mt-3 text-xs font-semibold rounded-lg px-3 py-2 ${
                    hit
                      ? "bg-green-500/15 text-green-400"
                      : miss
                      ? "bg-red-500/15 text-red-400"
                      : "bg-slate-900/60 text-slate-400"
                  }`}
                >
                  {opt.happened ? "Aconteceu" : "Não aconteceu"}
                  {hit && ` · acertou (+${ptsOk})`}
                  {miss && ` · errou (${ptsBad})`}
                  {!hasAnswer && " · sem palpite (0)"}
                </div>
              )}

              {/* Toggle */}
              <div className="flex gap-2 mt-3">
                <button
                  disabled={deadlinePassed}
                  onClick={() => handlePrediction(opt.id, true)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    hasAnswer && pred === true
                      ? "bg-green-500 text-white"
                      : "bg-slate-900/60 text-slate-400 hover:text-green-400"
                  } ${deadlinePassed ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"}`}
                >
                  VAI VIR
                </button>
                <button
                  disabled={deadlinePassed}
                  onClick={() => handlePrediction(opt.id, false)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    hasAnswer && pred === false
                      ? "bg-red-500 text-white"
                      : "bg-slate-900/60 text-slate-400 hover:text-red-400"
                  } ${deadlinePassed ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"}`}
                >
                  NÃO VAI VIR
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm button */}
      {!deadlinePassed && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-slate-900/90 backdrop-blur-xl border-t border-white/5 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            {confirmed && (
              <span className="text-xs text-green-400 flex items-center gap-1 flex-shrink-0">
                <CheckCircle2 className="w-4 h-4" /> Confirmado
              </span>
            )}
            <button
              onClick={handleConfirm}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 rounded-xl text-sm transition-all active:scale-[0.98]"
            >
              Confirmar meus palpites
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
