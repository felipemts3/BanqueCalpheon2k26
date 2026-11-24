import { useState, useEffect } from "react";
import { ArrowLeft, Trophy, Medal, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { RankingEntry } from "@/lib/types";

export default function RankingScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const { token, player } = useAuth();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notPublished, setNotPublished] = useState(false);

  useEffect(() => {
    loadRanking();
  }, []);

  const loadRanking = async () => {
    setLoading(true);

    // Try public ranking first (works without token)
    const { data: pubData } = await supabase.rpc("get_public_ranking");
    const pubResult = pubData as Record<string, unknown>;

    if (pubResult && !pubResult.error && pubResult.published) {
      setRanking(pubResult.ranking as RankingEntry[]);
      setNotPublished(false);
      setLoading(false);
      return;
    }

    // If not published, try admin ranking (if master)
    if (token && player?.is_master) {
      const { data: admData } = await supabase.rpc("admin_get_ranking", {
        p_token: token,
      });
      if (Array.isArray(admData)) {
        setRanking(admData as RankingEntry[]);
        setNotPublished(false);
        setLoading(false);
        return;
      }
    }

    setNotPublished(true);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-amber-400 animate-pulse text-sm">Carregando ranking...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h1 className="text-white font-bold text-base sm:text-lg">Ranking</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {notPublished ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-2xl mb-4">
              <Lock className="w-8 h-8 text-slate-500" />
            </div>
            <h2 className="text-white font-bold text-lg mb-2">
              Resultados ainda não publicados
            </h2>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">
              O ranking será revelado quando o administrador publicar o gabarito
              após o evento.
            </p>
          </div>
        ) : ranking.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-sm">
              Nenhum palpite registrado ainda.
            </p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {ranking.length >= 1 && (
              <div className="grid grid-cols-3 gap-2 mb-6 items-end">
                {/* 2nd place */}
                {ranking[1] && (
                  <PodiumCard
                    entry={ranking[1]}
                    place={2}
                    height="h-24"
                    icon={<Medal className="w-5 h-5 text-slate-300" />}
                    ring="ring-slate-400/30"
                    bg="bg-slate-800/60"
                  />
                )}
                {/* 1st place */}
                <PodiumCard
                  entry={ranking[0]}
                  place={1}
                  height="h-32"
                  icon={<Trophy className="w-6 h-6 text-amber-400" />}
                  ring="ring-amber-500/40"
                  bg="bg-amber-500/10"
                />
                {/* 3rd place */}
                {ranking[2] && (
                  <PodiumCard
                    entry={ranking[2]}
                    place={3}
                    height="h-20"
                    icon={<Medal className="w-5 h-5 text-amber-700" />}
                    ring="ring-amber-700/30"
                    bg="bg-slate-800/40"
                  />
                )}
              </div>
            )}

            {/* Full list */}
            <div className="space-y-2">
              {ranking.map((entry, i) => (
                <div
                  key={entry.player_id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                    entry.player_id === player?.id
                      ? "bg-amber-500/10 ring-1 ring-amber-500/30"
                      : "bg-slate-800/40"
                  }`}
                >
                  <div className="w-8 text-center flex-shrink-0">
                    <span
                      className={`font-bold text-sm ${
                        i === 0
                          ? "text-amber-400"
                          : i === 1
                          ? "text-slate-300"
                          : i === 2
                          ? "text-amber-700"
                          : "text-slate-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {entry.family_name}
                      {entry.player_id === player?.id && (
                        <span className="text-amber-400 text-xs ml-1.5">(você)</span>
                      )}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {entry.correct_count} acertos
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`font-bold text-base tabular-nums ${
                        entry.total_points > 0
                          ? "text-green-400"
                          : entry.total_points < 0
                          ? "text-red-400"
                          : "text-slate-400"
                      }`}
                    >
                      {entry.total_points > 0 ? "+" : ""}
                      {entry.total_points}
                    </span>
                    <span className="text-slate-500 text-xs ml-1">pts</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PodiumCard({
  entry,
  place,
  height,
  icon,
  ring,
  bg,
}: {
  entry: RankingEntry;
  place: number;
  height: string;
  icon: React.ReactNode;
  ring: string;
  bg: string;
}) {
  return (
    <div
      className={`${bg} ${ring} ring-1 rounded-xl ${height} flex flex-col items-center justify-center px-2`}
    >
      <div className="mb-1">{icon}</div>
      <p className="text-white font-bold text-xs sm:text-sm truncate w-full text-center">
        {entry.family_name}
      </p>
      <p
        className={`font-bold text-base sm:text-lg tabular-nums ${
          entry.total_points > 0
            ? "text-green-400"
            : entry.total_points < 0
            ? "text-red-400"
            : "text-slate-400"
        }`}
      >
        {entry.total_points > 0 ? "+" : ""}
        {entry.total_points}
      </p>
      <span className="text-slate-500 text-[10px]">#{place}</span>
    </div>
  );
}
