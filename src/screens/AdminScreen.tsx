import { fetchOptions } from "@/lib/options";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Settings,
  Users,
  Tags,
  Clock,
  CheckSquare,
  Trophy,
  Download,
  Trash2,
  KeyRound,
  Plus,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type {
  AdminPlayer,
  Category,
  Option,
  AppSettings,
  RankingEntry,
} from "@/lib/types";
import { getIcon } from "@/lib/icons";

type AdminTab = "players" | "categories" | "deadline" | "gabarito" | "ranking";

export default function AdminScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const { token, player } = useAuth();
  const [tab, setTab] = useState<AdminTab>("players");

  if (!player?.is_master) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <p className="text-smoke/70 text-sm">Acesso negado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink">
      <header className="sticky top-0 z-20 bg-ink/80 backdrop-blur-xl border-b border-hairline/15">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-button bg-obsidian text-smoke hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-highlighter" />
            <h1 className="text-paper text-subheading sm:text-heading-sm">Painel Admin</h1>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4 pb-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                { key: "players", label: "Jogadores", icon: Users },
                { key: "categories", label: "Categorias", icon: Tags },
                { key: "deadline", label: "Prazo", icon: Clock },
                { key: "gabarito", label: "Gabarito", icon: CheckSquare },
                { key: "ranking", label: "Ranking", icon: Trophy },
              ] as { key: AdminTab; label: string; icon: typeof Users }[]
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-button text-xs font-normal whitespace-nowrap transition-all ${
                    tab === t.key
                      ? "bg-highlighter text-ink"
                      : "bg-obsidian text-smoke/70 hover:text-paper"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {tab === "players" && <PlayersTab token={token} />}
        {tab === "categories" && <CategoriesTab token={token} />}
        {tab === "deadline" && <DeadlineTab token={token} />}
        {tab === "gabarito" && <GabaritoTab token={token} />}
        {tab === "ranking" && <RankingTab token={token} />}
      </div>
    </div>
  );
}

// ============ PLAYERS TAB ============

function PlayersTab({ token }: { token: string | null }) {
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetPlayer, setResetPlayer] = useState<AdminPlayer | null>(null);
  const [newPin, setNewPin] = useState("");
  const [deletePlayer, setDeletePlayer] = useState<AdminPlayer | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const { data } = await supabase.rpc("admin_list_players", {
      p_token: token,
    });
    if (Array.isArray(data)) {
      setPlayers(data as AdminPlayer[]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = players.filter((p) =>
    p.family_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleResetPin = async () => {
    if (!token || !resetPlayer || !/^[0-9]{4}$/.test(newPin)) return;
    const { data } = await supabase.rpc("admin_reset_player_pin", {
      p_token: token,
      p_player_id: resetPlayer.id,
      p_new_pin: newPin,
    });
    const result = data as Record<string, unknown>;
    if (result?.error) {
      setMessage(result.error as string);
    } else {
      setMessage(`Senha de ${resetPlayer.family_name} redefinida com sucesso`);
      setResetPlayer(null);
      setNewPin("");
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async () => {
    if (!token || !deletePlayer) return;
    const { data } = await supabase.rpc("admin_delete_player", {
      p_token: token,
      p_player_id: deletePlayer.id,
    });
    const result = data as Record<string, unknown>;
    if (result?.error) {
      setMessage(result.error as string);
    } else {
      setMessage("Jogador removido");
      setDeletePlayer(null);
      load();
    }
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return <div className="text-smoke/70 text-sm">Carregando jogadores...</div>;
  }

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome de família..."
        className="w-full bg-obsidian text-paper rounded-input px-4 py-2.5 text-sm border border-hairline/15 focus:border-highlighter/50 outline-none mb-4"
      />

      {message && (
        <div className="bg-highlighter/10 border border-highlighter/20 rounded-button px-4 py-2.5 text-sm text-highlighter mb-4">
          {message}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="bg-obsidian/40 rounded-input px-4 py-3 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-paper font-normal text-sm truncate">
                  {p.family_name}
                </p>
                {p.is_master && (
                  <span className="text-[10px] bg-highlighter/20 text-highlighter px-1.5 py-0.5 rounded-tag font-normal">
                    MASTER
                  </span>
                )}
              </div>
              <p className="text-smoke/55 text-xs mt-0.5">
                {p.prediction_count} palpites
                {p.confirmed_at && " · confirmou"}
              </p>
            </div>
            {!p.is_master && (
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setResetPlayer(p)}
                  className="p-2 rounded-button bg-ink/60 text-smoke/70 hover:text-highlighter transition-colors"
                  title="Resetar senha"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletePlayer(p)}
                  className="p-2 rounded-button bg-ink/60 text-smoke/70 hover:text-red-400 transition-colors"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reset Pin Modal */}
      {resetPlayer && (
        <Modal onClose={() => { setResetPlayer(null); setNewPin(""); }}>
          <h3 className="text-paper font-normal text-base mb-2">Resetar senha</h3>
          <p className="text-smoke/70 text-sm mb-4">
            Nova senha de 4 dígitos para {resetPlayer.family_name}
          </p>
          <input
            type="text"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ""))}
            maxLength={4}
            inputMode="numeric"
            placeholder="••••"
            className="w-full bg-ink text-paper rounded-input px-4 py-3 text-sm border border-hairline/15 focus:border-highlighter/50 outline-none tracking-[0.05em] text-center text-lg"
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => { setResetPlayer(null); setNewPin(""); }}
              className="flex-1 bg-obsidian text-smoke py-2.5 rounded-input text-sm font-normal"
            >
              Cancelar
            </button>
            <button
              onClick={handleResetPin}
              disabled={!/^[0-9]{4}$/.test(newPin)}
              className="flex-1 bg-highlighter disabled:opacity-50 text-ink py-2.5 rounded-button text-sm font-normal"
            >
              Confirmar
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {deletePlayer && (
        <Modal onClose={() => setDeletePlayer(null)}>
          <h3 className="text-paper font-normal text-base mb-2">Remover jogador</h3>
          <p className="text-smoke/70 text-sm mb-4">
            Tem certeza que deseja remover <strong className="text-paper">{deletePlayer.family_name}</strong>?
            Todos os palpites deste jogador serão perdidos.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setDeletePlayer(null)}
              className="flex-1 bg-obsidian text-smoke py-2.5 rounded-input text-sm font-normal"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 bg-red-500 hover:bg-red-600 text-paper py-2.5 rounded-input text-sm font-normal"
            >
              Remover
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============ CATEGORIES TAB ============

function CategoriesTab({ token }: { token: string | null }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [editingOpt, setEditingOpt] = useState<Partial<Option> | null>(null);
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [catRes, optRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      fetchOptions(token),
    ]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    setOptions(optRes);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  };

  const saveCat = async () => {
    if (!token || !editingCat) return;
    const { data } = await supabase.rpc("admin_upsert_category", {
      p_token: token,
      p_id: editingCat.id || null,
      p_name: editingCat.name || "",
      p_icon: editingCat.icon || null,
      p_sort_order: editingCat.sort_order ?? 0,
    });
    const result = data as Record<string, unknown>;
    if (result?.error) { flash(result.error as string); return; }
    setEditingCat(null);
    flash("Categoria salva");
    load();
  };

  const deleteCat = async (id: string) => {
    if (!token) return;
    await supabase.rpc("admin_delete_category", { p_token: token, p_id: id });
    flash("Categoria removida");
    load();
  };

  const saveOpt = async () => {
    if (!token || !editingOpt) return;
    const { data } = await supabase.rpc("admin_upsert_option", {
      p_token: token,
      p_id: editingOpt.id || null,
      p_category_id: editingOpt.category_id || "",
      p_title: editingOpt.title || "",
      p_description: editingOpt.description || null,
      p_emoji: editingOpt.emoji || null,
      p_sort_order: editingOpt.sort_order ?? 0,
      p_is_active: editingOpt.is_active ?? true,
    });
    const result = data as Record<string, unknown>;
    if (result?.error) { flash(result.error as string); return; }
    setEditingOpt(null);
    flash("Opção salva");
    load();
  };

  const deleteOpt = async (id: string) => {
    if (!token) return;
    await supabase.rpc("admin_delete_option", { p_token: token, p_id: id });
    flash("Opção removida");
    load();
  };

  return (
    <div>
      {message && (
        <div className="bg-highlighter/10 border border-highlighter/20 rounded-button px-4 py-2.5 text-sm text-highlighter mb-4">
          {message}
        </div>
      )}

      <button
        onClick={() => setEditingCat({ name: "", icon: "", sort_order: 0 })}
        className="flex items-center gap-1.5 bg-highlighter text-ink font-normal px-3 py-2 rounded-button text-sm mb-4"
      >
        <Plus className="w-4 h-4" /> Nova categoria
      </button>

      <div className="space-y-2">
        {categories.map((cat) => {
          const Icon = getIcon(cat.icon);
          const catOpts = options.filter((o) => o.category_id === cat.id);
          const isOpen = expandedCat === cat.id;
          return (
            <div key={cat.id} className="bg-obsidian/40 rounded-input overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <Icon className="w-5 h-5 text-highlighter flex-shrink-0" />
                <span className="text-paper font-normal text-sm flex-1">{cat.name}</span>
                <span className="text-smoke/55 text-xs">{catOpts.length} opções</span>
                <button
                  onClick={() => setExpandedCat(isOpen ? null : cat.id)}
                  className="p-1.5 rounded-button bg-ink/60 text-smoke/70"
                >
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-hairline/15 p-3 space-y-2">
                  <div className="flex gap-1.5 mb-2">
                    <button
                      onClick={() => setEditingCat({ ...cat })}
                      className="text-xs bg-ink/60 text-smoke px-2.5 py-1.5 rounded-button"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteCat(cat.id)}
                      className="text-xs bg-ink/60 text-red-400 px-2.5 py-1.5 rounded-button"
                    >
                      Excluir
                    </button>
                    <button
                      onClick={() =>
                        setEditingOpt({
                          category_id: cat.id,
                          title: "",
                          description: "",
                          emoji: "",
                          sort_order: catOpts.length + 1,
                          is_active: true,
                        })
                      }
                      className="text-xs bg-highlighter/20 text-highlighter px-2.5 py-1.5 rounded-button ml-auto"
                    >
                      + Nova opção
                    </button>
                  </div>
                  {catOpts.map((opt) => (
                    <div
                      key={opt.id}
                      className="flex items-start gap-2 bg-ink/40 rounded-button px-3 py-2"
                    >
                      <span className="text-lg flex-shrink-0">{opt.emoji || "•"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-paper text-sm font-normal">{opt.title}</p>
                        {opt.description && (
                          <p className="text-smoke/55 text-xs mt-0.5">{opt.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {!opt.is_active && (
                            <span className="text-[10px] bg-white/10 text-smoke/70 px-1.5 py-0.5 rounded-tag">
                              oculta
                            </span>
                          )}
                          <button
                            onClick={() => setEditingOpt({ ...opt })}
                            className="text-xs text-smoke/70 hover:text-highlighter"
                          >
                            editar
                          </button>
                          <button
                            onClick={() => deleteOpt(opt.id)}
                            className="text-xs text-smoke/70 hover:text-red-400"
                          >
                            excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Category editor modal */}
      {editingCat && (
        <Modal onClose={() => setEditingCat(null)}>
          <h3 className="text-paper font-normal text-base mb-4">
            {editingCat.id ? "Editar categoria" : "Nova categoria"}
          </h3>
          <div className="space-y-3">
            <Field label="Nome">
              <input
                type="text"
                value={editingCat.name || ""}
                onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                className="modal-input"
              />
            </Field>
            <Field label="Ícone (lucide)">
              <input
                type="text"
                value={editingCat.icon || ""}
                onChange={(e) => setEditingCat({ ...editingCat, icon: e.target.value })}
                placeholder="Sword, Swords, Skull, ChefHat, Sparkles, MoreHorizontal"
                className="modal-input"
              />
            </Field>
            <Field label="Ordem">
              <input
                type="number"
                value={editingCat.sort_order ?? 0}
                onChange={(e) =>
                  setEditingCat({ ...editingCat, sort_order: parseInt(e.target.value) || 0 })
                }
                className="modal-input"
              />
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setEditingCat(null)} className="flex-1 bg-obsidian text-smoke py-2.5 rounded-input text-sm font-normal">
              Cancelar
            </button>
            <button onClick={saveCat} className="flex-1 bg-highlighter text-ink py-2.5 rounded-button text-sm font-normal">
              Salvar
            </button>
          </div>
        </Modal>
      )}

      {/* Option editor modal */}
      {editingOpt && (
        <Modal onClose={() => setEditingOpt(null)}>
          <h3 className="text-paper font-normal text-base mb-4">
            {editingOpt.id ? "Editar opção" : "Nova opção"}
          </h3>
          <div className="space-y-3">
            <Field label="Título">
              <input
                type="text"
                value={editingOpt.title || ""}
                onChange={(e) => setEditingOpt({ ...editingOpt, title: e.target.value })}
                className="modal-input"
              />
            </Field>
            <Field label="Descrição">
              <textarea
                value={editingOpt.description || ""}
                onChange={(e) => setEditingOpt({ ...editingOpt, description: e.target.value })}
                rows={2}
                className="modal-input resize-none"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Emoji">
                <input
                  type="text"
                  value={editingOpt.emoji || ""}
                  onChange={(e) => setEditingOpt({ ...editingOpt, emoji: e.target.value })}
                  className="modal-input"
                />
              </Field>
              <Field label="Ordem">
                <input
                  type="number"
                  value={editingOpt.sort_order ?? 0}
                  onChange={(e) =>
                    setEditingOpt({ ...editingOpt, sort_order: parseInt(e.target.value) || 0 })
                  }
                  className="modal-input"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-smoke">
              <input
                type="checkbox"
                checked={editingOpt.is_active ?? true}
                onChange={(e) => setEditingOpt({ ...editingOpt, is_active: e.target.checked })}
                className="w-4 h-4 accent-highlighter"
              />
              Ativa (visível para jogadores)
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setEditingOpt(null)} className="flex-1 bg-obsidian text-smoke py-2.5 rounded-input text-sm font-normal">
              Cancelar
            </button>
            <button onClick={saveOpt} className="flex-1 bg-highlighter text-ink py-2.5 rounded-button text-sm font-normal">
              Salvar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============ DEADLINE TAB ============

function DeadlineTab({ token }: { token: string | null }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [published, setPublished] = useState(false);
  const [deadlineLocal, setDeadlineLocal] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("get_settings").then(({ data }) => {
      if (data) {
        const s = data as AppSettings;
        setSettings(s);
        setPublished(s.results_published === "true");
        // Convert UTC deadline to local datetime-local format
        const d = new Date(s.deadline);
        const off = d.getTimezoneOffset();
        const local = new Date(d.getTime() - off * 60000);
        setDeadlineLocal(local.toISOString().slice(0, 16));
      }
    });
  }, []);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const saveDeadline = async () => {
    if (!token || !deadlineLocal) return;
    const iso = new Date(deadlineLocal).toISOString();
    const { data } = await supabase.rpc("admin_set_deadline", {
      p_token: token,
      p_deadline: iso,
    });
    const result = data as Record<string, unknown>;
    if (result?.error) { flash(result.error as string); return; }
    flash("Prazo atualizado");
  };

  const togglePublish = async () => {
    if (!token) return;
    const { data } = await supabase.rpc("admin_set_results_published", {
      p_token: token,
      p_published: !published,
    });
    const result = data as Record<string, unknown>;
    if (result?.error) { flash(result.error as string); return; }
    setPublished(!published);
    flash(published ? "Resultados despublicados" : "Resultados publicados");
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="bg-highlighter/10 border border-highlighter/20 rounded-button px-4 py-2.5 text-sm text-highlighter">
          {message}
        </div>
      )}

      {/* Deadline */}
      <div className="bg-obsidian/40 rounded-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-highlighter" />
          <h3 className="text-paper font-normal text-sm">Data/hora limite</h3>
        </div>
        <p className="text-smoke/70 text-xs mb-3">
          Atualmente: {settings?.deadline ? new Date(settings.deadline).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}
        </p>
        <input
          type="datetime-local"
          value={deadlineLocal}
          onChange={(e) => setDeadlineLocal(e.target.value)}
          className="w-full bg-ink text-paper rounded-input px-4 py-3 text-sm border border-hairline/15 focus:border-highlighter/50 outline-none mb-3"
        />
        <button
          onClick={saveDeadline}
          className="w-full bg-highlighter text-ink font-normal py-2.5 rounded-button text-sm"
        >
          Salvar prazo
        </button>
      </div>

      {/* Publish results */}
      <div className="bg-obsidian/40 rounded-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckSquare className="w-5 h-5 text-highlighter" />
          <h3 className="text-paper font-normal text-sm">Publicar resultados</h3>
        </div>
        <p className="text-smoke/70 text-xs mb-4">
          {published
            ? "Os resultados estão públicos. Todos podem ver o ranking."
            : "Os resultados estão ocultos. Marque o gabarito antes de publicar."}
        </p>
        <button
          onClick={togglePublish}
          className={`w-full font-normal py-2.5 rounded-input text-sm transition-all ${
            published
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-highlighter text-ink hover:bg-highlighter/90"
          }`}
        >
          {published ? "Despublicar resultados" : "Publicar resultados"}
        </button>
      </div>
    </div>
  );
}

// ============ GABARITO TAB ============

function GabaritoTab({ token }: { token: string | null }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [catRes, optRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      fetchOptions(token),
    ]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    setOptions(optRes);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const setResult = async (optionId: string, happened: boolean) => {
    if (!token) return;
    const { data } = await supabase.rpc("admin_set_option_result", {
      p_token: token,
      p_option_id: optionId,
      p_happened: happened,
    });
    const result = data as Record<string, unknown>;
    if (result?.error) {
      setMessage(result.error as string);
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    // Update locally
    setOptions((prev) =>
      prev.map((o) => (o.id === optionId ? { ...o, happened } : o))
    );
  };

  return (
    <div>
      {message && (
        <div className="bg-highlighter/10 border border-highlighter/20 rounded-button px-4 py-2.5 text-sm text-highlighter mb-4">
          {message}
        </div>
      )}

      <p className="text-smoke/70 text-xs mb-4">
        Marque cada opção como "Aconteceu" ou "Não aconteceu". É possível corrigir depois.
      </p>

      {categories.map((cat) => {
        const catOpts = options.filter((o) => o.category_id === cat.id);
        if (catOpts.length === 0) return null;
        const Icon = getIcon(cat.icon);
        return (
          <div key={cat.id} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-highlighter" />
              <h3 className="text-paper font-normal text-sm">{cat.name}</h3>
            </div>
            <div className="space-y-2">
              {catOpts.map((opt) => (
                <div
                  key={opt.id}
                  className="bg-obsidian/40 rounded-input px-3 py-2.5 flex items-center gap-3"
                >
                  <span className="text-lg flex-shrink-0">{opt.emoji || "•"}</span>
                  <span className="text-paper text-sm flex-1 truncate">{opt.title}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setResult(opt.id, true)}
                      className={`px-2.5 py-1 rounded-button text-xs font-normal transition-all ${
                        opt.happened === true
                          ? "bg-highlighter text-ink"
                          : "bg-ink/60 text-smoke/70"
                      }`}
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setResult(opt.id, false)}
                      className={`px-2.5 py-1 rounded-button text-xs font-normal transition-all ${
                        opt.happened === false
                          ? "bg-paper text-ink"
                          : "bg-ink/60 text-smoke/70"
                      }`}
                    >
                      Não
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ RANKING TAB ============

function RankingTab({ token }: { token: string | null }) {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    supabase
      .rpc("admin_get_ranking", { p_token: token })
      .then(({ data }) => {
        if (Array.isArray(data)) setRanking(data as RankingEntry[]);
        setLoading(false);
      });
  }, [token]);

  const exportCSV = () => {
    const header = "Posicao,Nome de Familia,Pontos,Acertos,Turbo,Opcao Turbinada,Confirmado em\n";
    const rows = ranking
      .map((r, i) => {
        const booster =
          r.booster_multiplier && r.booster_multiplier > 1
            ? `x${r.booster_multiplier}`
            : "";
        const boosterTitle = r.booster_option_title ?? "";
        const confirmed = r.confirmed_at
          ? new Date(r.confirmed_at).toLocaleString("pt-BR")
          : "—";
        return `${i + 1},${r.family_name},${r.total_points},${r.correct_count},${booster},${boosterTitle},${confirmed}`;
      })
      .join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ranking_calpheon_2026.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="text-smoke/70 text-sm">Carregando ranking...</div>;
  }

  return (
    <div>
      <button
        onClick={exportCSV}
        className="flex items-center gap-1.5 bg-highlighter text-ink font-normal px-3 py-2 rounded-button text-sm mb-4"
      >
        <Download className="w-4 h-4" /> Exportar CSV
      </button>

      {ranking.length === 0 ? (
        <p className="text-smoke/70 text-sm">Nenhum palpite registrado.</p>
      ) : (
        <div className="space-y-2">
          {ranking.map((entry, i) => (
            <div
              key={entry.player_id}
              className="flex items-center gap-3 bg-obsidian/40 rounded-input px-4 py-3"
            >
              <span className="text-smoke/55 font-normal text-sm w-6 text-center">
                {i + 1}
              </span>
              <span className="text-paper font-normal text-sm flex-1 truncate flex items-center gap-1.5">
                {entry.family_name}
                {entry.booster_multiplier && entry.booster_multiplier > 1 && (
                  <span
                    className="flex items-center gap-0.5 bg-highlighter/20 text-highlighter text-[10px] px-1.5 py-0.5 rounded-tag ring-1 ring-highlighter/40 flex-shrink-0"
                    title={entry.booster_option_title ?? ""}
                  >
                    <Zap className="w-3 h-3" /> x{entry.booster_multiplier}
                  </span>
                )}
              </span>
              <span className="text-smoke/55 text-xs">{entry.correct_count} acertos</span>
              <span
                className={`font-normal text-sm tabular-nums ${
                  entry.total_points > 0 ? "text-highlighter" : entry.total_points < 0 ? "text-smoke" : "text-smoke/70"
                }`}
              >
                {entry.total_points > 0 ? "+" : ""}{entry.total_points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ SHARED COMPONENTS ============

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-obsidian rounded-card p-5 w-full max-w-md ring-1 ring-hairline/15 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-normal text-smoke/70 mb-1">{label}</label>
      {children}
    </div>
  );
}
