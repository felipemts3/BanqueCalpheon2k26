import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  CheckCircle2,
  HelpCircle,
  X,
  Lock,
  Trophy,
  LogOut,
  Settings,
  Users,
  Zap,
} from "lucide-react";
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

interface PredictionEntry {
  answer: boolean;
  multiplier: number;
}

interface PredictionMap {
  [optionId: string]: PredictionEntry;
}

const MULTIPLIERS = [2, 4, 8];

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
  const [showRules, setShowRules] = useState(() => {
    try {
      return sessionStorage.getItem("rules_seen") !== "1";
    } catch {
      return true;
    }
  });
  const closeRules = useCallback(() => {
    setShowRules(false);
    try {
      sessionStorage.setItem("rules_seen", "1");
    } catch {
      /* sem storage: só não lembra */
    }
  }, []);
  const [boosterPicker, setBoosterPicker] = useState<string | null>(null);
  const [moveConfirm, setMoveConfirm] = useState<{
    optionId: string;
    multiplier: number;
    fromTitle: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Sync confirmed state from auth context (set on page reload)
  useEffect(() => {
    if (player?.confirmed_at) setConfirmed(true);
  }, [player]);

  const loadData = async () => {
    const [catRes, opts, settingsRes, predRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      fetchOptions(token),
      supabase.rpc("get_settings"),
      token ? supabase.rpc("get_my_predictions", { p_token: token }) : Promise.resolve({ data: [] }),
    ]);

    if (catRes.data) setCategories(catRes.data as Category[]);
    setOptions(opts);
    if (settingsRes.data) setSettings(settingsRes.data as AppSettings);

    if (predRes.data && Array.isArray(predRes.data)) {
      const map: PredictionMap = {};
      (predRes.data as Prediction[]).forEach((p) => {
        map[p.option_id] = { answer: p.answer, multiplier: p.multiplier ?? 1 };
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

  useEffect(() => {
    if (!showRules) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRules();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showRules, closeRules]);

  const ptsOk = Number(settings?.points_correct ?? 10);
  const ptsBad = Number(settings?.points_wrong ?? -5);

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

  // Turbo atual do jogador
  const booster = useMemo(() => {
    for (const [optionId, p] of Object.entries(predictions)) {
      if (p.multiplier > 1) {
        const opt = options.find((o) => o.id === optionId);
        return { optionId, title: opt?.title ?? "", multiplier: p.multiplier };
      }
    }
    return null;
  }, [predictions, options]);

  const setSaveStatusTimed = (status: "saved" | "error", ms: number) => {
    setSaveStatus(status);
    setTimeout(() => setSaveStatus("idle"), ms);
  };

  const handlePrediction = useCallback(
    async (optionId: string, answer: boolean) => {
      if (deadlinePassed) return;

      const previous = predictions[optionId];

      // Clicar de novo no botão já selecionado volta para EM BRANCO
      if (previous && previous.answer === answer) {
        await handleClear(optionId);
        return;
      }

      // Optimistic update
      setPredictions((prev) => ({
        ...prev,
        [optionId]: { answer, multiplier: previous?.multiplier ?? 1 },
      }));
      setSaveStatus("saving");

      const { data, error } = await supabase.rpc("save_prediction", {
        p_token: token,
        p_option_id: optionId,
        p_answer: answer,
      });

      const result = data as Record<string, unknown> | null;
      if (error || !result || result.error) {
        setPredictions((prev) => {
          const next = { ...prev };
          if (previous === undefined) delete next[optionId];
          else next[optionId] = previous;
          return next;
        });
        setSaveStatusTimed("error", 2500);
        return;
      }

      setSaveStatusTimed("saved", 1500);
    },
    [token, deadlinePassed, predictions]
  );

  const handleClear = useCallback(
    async (optionId: string) => {
      if (deadlinePassed) return;

      const previous = predictions[optionId];
      if (!previous) return;

      // Optimistic: remove o palpite (e o turbo junto, se havia)
      setPredictions((prev) => {
        const next = { ...prev };
        delete next[optionId];
        return next;
      });
      setSaveStatus("saving");

      const { data, error } = await supabase.rpc("clear_prediction", {
        p_token: token,
        p_option_id: optionId,
      });

      const result = data as Record<string, unknown> | null;
      if (error || !result || result.error) {
        setPredictions((prev) => ({ ...prev, [optionId]: previous }));
        setSaveStatusTimed("error", 2500);
        return;
      }

      setSaveStatusTimed("saved", 1500);
    },
    [token, deadlinePassed, predictions]
  );

  const applyBooster = useCallback(
    async (optionId: string, multiplier: number) => {
      if (deadlinePassed) return;

      const previous = predictions[optionId];
      const hadBoosterHere = previous?.multiplier ?? 1;

      // Optimistic: remove turbo anterior e aplica o novo
      setPredictions((prev) => {
        const next: PredictionMap = {};
        for (const [oid, p] of Object.entries(prev)) {
          next[oid] = oid === optionId ? { ...p, multiplier } : { ...p, multiplier: 1 };
        }
        return next;
      });
      setSaveStatus("saving");

      const { data, error } = await supabase.rpc("set_booster", {
        p_token: token,
        p_option_id: optionId,
        p_multiplier: multiplier,
      });

      const result = data as Record<string, unknown> | null;
      if (error || !result || result.error) {
        // Restaura estado anterior
        setPredictions((prev) => {
          const next: PredictionMap = {};
          for (const [oid, p] of Object.entries(prev)) {
            next[oid] =
              oid === optionId
                ? { ...p, multiplier: hadBoosterHere }
                : p.multiplier > 1
                ? p
                : { ...p, multiplier: booster?.multiplier ?? 1 };
          }
          return next;
        });
        setSaveStatusTimed("error", 2500);
        return;
      }

      setSaveStatusTimed("saved", 1500);
    },
    [token, deadlinePassed, predictions, booster]
  );

  const handleBoosterClick = (optionId: string, multiplier: number) => {
    if (booster && booster.optionId !== optionId) {
      setMoveConfirm({ optionId, multiplier, fromTitle: booster.title });
      return;
    }
    applyBooster(optionId, multiplier);
  };

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-highlighter animate-pulse text-sm">Carregando palpites...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="relative z-20 bg-ink/30 backdrop-blur-md border-b border-hairline/15">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-paper font-normal text-subheading sm:text-heading-sm">
                Bolão do Banquete
              </h1>
              <p className="text-highlighter text-[10px] leading-[2.2] uppercase tracking-[0.018em]">
                {player?.family_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRules(true)}
                className="p-2 rounded-button bg-obsidian text-highlighter hover:bg-white/10 transition-colors"
                title="Como pontua"
                aria-label="Como pontua"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              {player?.is_master && (
                <button
                  onClick={() => onNavigate("admin")}
                  className="p-2 rounded-button bg-obsidian text-highlighter hover:bg-white/10 transition-colors"
                  title="Painel Admin"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}
              {deadlinePassed && (
                <button
                  onClick={() => onNavigate("picks")}
                  className="p-2 rounded-button bg-obsidian text-highlighter hover:bg-white/10 transition-colors"
                  title="Palpites da galera"
                >
                  <Users className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => onNavigate("ranking")}
                className="p-2 rounded-button bg-obsidian text-highlighter hover:bg-white/10 transition-colors"
                title="Ranking"
              >
                <Trophy className="w-5 h-5" />
              </button>
              <button
                onClick={signOut}
                className="p-2 rounded-button bg-obsidian text-smoke/70 hover:bg-white/10 transition-colors"
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
            <div className="flex-1 h-2 bg-obsidian rounded-full overflow-hidden">
              <div
                className="h-full bg-highlighter rounded-full transition-all duration-300"
                style={{ width: `${totalActive > 0 ? (totalAnswered / totalActive) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-smoke/70 tabular-nums whitespace-nowrap">
              {totalAnswered}/{totalActive} palpites
            </span>
          </div>

        </div>
      </header>

      {/* Banner do turbo */}
      {!deadlinePassed && (
        <div className="max-w-4xl mx-auto px-4 mt-3">
          <div
            className={`flex items-center gap-2 rounded-input px-4 py-2.5 text-sm ${
              booster
                ? "bg-highlighter/15 ring-1 ring-highlighter/30 text-highlighter"
                : "bg-obsidian/60 text-smoke/70"
            }`}
          >
            <Zap className={`w-4 h-4 flex-shrink-0 ${booster ? "text-highlighter" : "text-smoke/55"}`} />
            {booster ? (
              <span>
                Seu turbo: <strong>{booster.title}</strong> x{booster.multiplier}
              </span>
            ) : (
              <span>Você ainda não usou seu turbo</span>
            )}
          </div>
        </div>
      )}

      {/* Deadline banner */}
      {deadlinePassed && (
        <div className="bg-paper px-4 py-2.5 text-center mt-3">
          <p className="text-ink text-sm uppercase tracking-[0.05em] flex items-center justify-center gap-1.5">
            <Lock className="w-4 h-4" />
            Palpites encerrados — aguarde o resultado
          </p>
        </div>
      )}

      {/* Save status */}
      <div className="max-w-4xl mx-auto px-4 mt-3 h-5">
        {saveStatus === "saving" && (
          <span className="text-xs text-smoke/55">Salvando...</span>
        )}
        {saveStatus === "error" && (
          <span className="text-xs text-red-400">
            Não foi possível salvar. Verifique sua conexão e tente de novo.
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="text-xs text-highlighter flex items-center gap-1">
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
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-input text-sm font-normal whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-highlighter text-ink"
                    : "bg-obsidian text-smoke/70 hover:text-paper hover:bg-white/10"
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
                <span
                  className={`text-[10px] tabular-nums ${
                    isActive ? "text-ink/60" : "text-ash"
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
        <p className="text-xs text-smoke/55">
          {catAnswered} de {activeOptions.length} respondidas nesta categoria
        </p>
        {activeOptions.map((opt) => {
          const pred = predictions[opt.id];
          const hasAnswer = pred !== undefined;
          const answer = pred?.answer;
          const multiplier = pred?.multiplier ?? 1;
          const hasBooster = multiplier > 1;
          const resolved = opt.happened !== null && opt.happened !== undefined;
          const hit = resolved && hasAnswer && answer === opt.happened;
          const miss = resolved && hasAnswer && answer !== opt.happened;
          return (
            <div
              key={opt.id}
              className={`bg-obsidian/80 rounded-card p-4 ring-1 transition-all ${
                hasBooster
                  ? "ring-highlighter/60"
                  : hasAnswer
                  ? "ring-highlighter/20"
                  : "ring-hairline/15"
              }`}
            >
              <div className="flex items-start gap-3">
                {opt.emoji && (
                  <span className="text-2xl flex-shrink-0 leading-none mt-0.5">
                    {opt.emoji}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-paper text-base leading-snug">
                    {opt.title}
                  </h3>
                  {opt.description && (
                    <p className="text-smoke/70 text-xs mt-1 leading-relaxed">
                      {opt.description}
                    </p>
                  )}
                </div>
                {hasBooster && (
                  <span className="flex-shrink-0 flex items-center gap-1 bg-highlighter/20 text-highlighter text-[11px] font-normal px-2 py-1 rounded-button ring-1 ring-highlighter/40">
                    <Zap className="w-3 h-3" /> x{multiplier}
                  </span>
                )}
              </div>

              {resolved && (
                <div
                  className={`mt-3 text-xs font-normal rounded-button px-3 py-2 ${
                    hit
                      ? "bg-highlighter/15 text-highlighter"
                      : miss
                      ? "bg-white/10 text-smoke"
                      : "bg-ink/60 text-smoke/70"
                  }`}
                >
                  {opt.happened ? "Aconteceu" : "Não aconteceu"}
                  {hit && ` · acertou (+${ptsOk * multiplier})`}
                  {miss && ` · errou (${ptsBad * multiplier})`}
                  {!hasAnswer && " · sem palpite (0)"}
                </div>
              )}

              {/* Toggle 3 estados */}
              <div className="flex gap-2 mt-3">
                <button
                  disabled={deadlinePassed}
                  onClick={() => handlePrediction(opt.id, true)}
                  className={`flex-1 py-3 rounded-button text-xs sm:text-sm uppercase tracking-[0.05em] transition-all ${
                    hasAnswer && answer === true
                      ? "bg-highlighter text-ink"
                      : "bg-ink/60 text-smoke/70 hover:text-highlighter"
                  } ${deadlinePassed ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"}`}
                >
                  VAI VIR
                </button>
                <button
                  disabled={deadlinePassed}
                  onClick={() => handleClear(opt.id)}
                  className={`flex-1 py-3 rounded-button text-xs sm:text-sm uppercase tracking-[0.05em] transition-all ${
                    !hasAnswer
                      ? "bg-white/15 text-paper"
                      : "bg-ink/60 text-smoke/70 hover:text-paper"
                  } ${deadlinePassed ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"}`}
                >
                  EM BRANCO
                </button>
                <button
                  disabled={deadlinePassed}
                  onClick={() => handlePrediction(opt.id, false)}
                  className={`flex-1 py-3 rounded-button text-xs sm:text-sm uppercase tracking-[0.05em] transition-all ${
                    hasAnswer && answer === false
                      ? "bg-paper text-ink"
                      : "bg-ink/60 text-smoke/70 hover:text-paper"
                  } ${deadlinePassed ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"}`}
                >
                  NÃO VAI VIR
                </button>
              </div>

              {/* Turbo */}
              {hasAnswer && !deadlinePassed && (
                <div className="relative mt-2">
                  <button
                    onClick={() =>
                      setBoosterPicker(boosterPicker === opt.id ? null : opt.id)
                    }
                    className={`flex items-center gap-1.5 text-xs font-normal px-3 py-1.5 rounded-button transition-all ${
                      hasBooster
                        ? "bg-highlighter/20 text-highlighter ring-1 ring-highlighter/40"
                        : "bg-ink/60 text-smoke/70 hover:text-highlighter"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {hasBooster ? `Turbinado x${multiplier}` : "Turbinar"}
                  </button>

                  {boosterPicker === opt.id && (
                    <div className="absolute bottom-full left-0 mb-2 z-30 bg-obsidian ring-1 ring-hairline/15 rounded-input p-3 w-64">
                      <p className="text-[11px] text-smoke/70 mb-2">
                        Se acertar / se errar (base +{ptsOk} / {ptsBad})
                      </p>
                      <div className="flex gap-2">
                        {MULTIPLIERS.map((m) => (
                          <button
                            key={m}
                            onClick={() => {
                              setBoosterPicker(null);
                              handleBoosterClick(opt.id, m);
                            }}
                            className={`flex-1 py-2 rounded-button text-xs font-normal transition-all ${
                              hasBooster && multiplier === m
                                ? "bg-highlighter text-ink"
                                : "bg-ink/60 text-highlighter hover:bg-ink"
                            }`}
                          >
                            x{m}
                            <span className="block text-[10px] font-normal text-current opacity-70">
                              +{ptsOk * m} / {ptsBad * m}
                            </span>
                          </button>
                        ))}
                      </div>
                      {hasBooster && (
                        <button
                          onClick={() => {
                            setBoosterPicker(null);
                            applyBooster(opt.id, 1);
                          }}
                          className="w-full mt-2 py-2 rounded-button text-xs font-normal bg-ink/60 text-smoke/70 hover:text-paper"
                        >
                          Remover turbo
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm button */}
      {!deadlinePassed && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-ink/30 backdrop-blur-md border-t border-hairline/15 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            {confirmed && (
              <span className="text-xs text-highlighter flex items-center gap-1 flex-shrink-0">
                <CheckCircle2 className="w-4 h-4" /> Confirmado
              </span>
            )}
            {!booster && !confirmed && (
              <span className="text-[11px] text-smoke/55 flex-shrink-0 hidden sm:block">
                Dica: você ainda não usou seu turbo
              </span>
            )}
            <button
              onClick={handleConfirm}
              className="flex-1 bg-highlighter hover:bg-highlighter/90 text-ink py-3.5 rounded-button text-sm uppercase tracking-[0.05em] transition-all active:scale-[0.98]"
            >
              Confirmar meus palpites
            </button>
          </div>
        </div>
      )}

      {/* Pop-up: Como pontua */}
      {showRules && !loading && (
        <div
          className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeRules}
          role="dialog"
          aria-modal="true"
          aria-label="Como pontua"
        >
          <div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-card bg-obsidian ring-1 ring-hairline/15 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeRules}
              className="absolute top-3 right-3 p-1.5 rounded-button text-smoke/70 hover:text-paper hover:bg-white/10 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <p className="text-[10px] leading-[2.2] uppercase tracking-[0.018em] text-highlighter">
              Antes de começar
            </p>
            <h2 className="text-heading-sm text-paper mb-4">Como pontua</h2>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-input bg-highlighter text-ink px-2 py-3">
                <p className="text-[10px] leading-[2.2] uppercase tracking-[0.018em]">Acertou</p>
                <p className="text-heading leading-none">+{ptsOk}</p>
              </div>
              <div className="rounded-input bg-paper text-ink px-2 py-3">
                <p className="text-[10px] leading-[2.2] uppercase tracking-[0.018em]">Errou</p>
                <p className="text-heading leading-none">{ptsBad}</p>
              </div>
              <div className="rounded-input bg-ink text-paper ring-1 ring-hairline/15 px-2 py-3">
                <p className="text-[10px] leading-[2.2] uppercase tracking-[0.018em] text-smoke/70">Em branco</p>
                <p className="text-heading leading-none">0</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-smoke">
              Deixar em branco = 0 pontos, sem risco.
            </p>

            <p className="mt-3 flex items-start gap-2 rounded-input bg-ink ring-1 ring-highlighter/40 px-3 py-3 text-sm text-smoke leading-snug">
              <Zap className="w-4 h-4 text-highlighter shrink-0 mt-0.5" />
              <span>
                <span className="text-highlighter">Turbo x2 / x4 / x8</span> multiplica acerto e
                erro de <span className="text-highlighter">UMA</span> opção. Ex.: x4 acertando ={" "}
                <span className="text-highlighter">+{ptsOk * 4}</span>, errando ={" "}
                <span className="text-paper">{ptsBad * 4}</span>.
              </span>
            </p>

            <button
              onClick={closeRules}
              className="mt-5 w-full bg-highlighter hover:bg-highlighter/90 text-ink py-3.5 rounded-button text-sm uppercase tracking-[0.05em] transition-all active:scale-[0.98]"
            >
              Entendi
            </button>
            <p className="mt-3 text-center text-xs text-smoke/55">
              Você pode rever estas regras no botão de ajuda, no topo da tela.
            </p>
          </div>
        </div>
      )}

      {/* Modal: mover turbo */}
      {moveConfirm && (
        <div
          className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setMoveConfirm(null)}
        >
          <div
            className="bg-obsidian rounded-card p-5 w-full max-w-md ring-1 ring-hairline/15"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-paper font-normal text-base mb-2">Mover turbo</h3>
            <p className="text-smoke/70 text-sm mb-4">
              Seu turbo está em <strong className="text-paper">{moveConfirm.fromTitle}</strong>.
              Mover para esta?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setMoveConfirm(null)}
                className="flex-1 bg-white/10 text-smoke py-2.5 rounded-input text-sm font-normal"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const { optionId, multiplier } = moveConfirm;
                  setMoveConfirm(null);
                  applyBooster(optionId, multiplier);
                }}
                className="flex-1 bg-highlighter text-ink py-2.5 rounded-button text-sm font-normal"
              >
                Mover turbo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
