import { useState } from "react";
import { Eye, EyeOff, Shield, Trophy, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [familyName, setFamilyName] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmedName = familyName.trim();
    if (trimmedName.length < 3 || trimmedName.length > 24) {
      setError("Nome de família deve ter entre 3 e 24 caracteres");
      setLoading(false);
      return;
    }

    if (mode === "signup" && !/^[0-9]{4}$/.test(pin)) {
      setError("A senha deve ter exatamente 4 dígitos");
      setLoading(false);
      return;
    }

    const fn = mode === "login" ? signIn : signUp;
    const result = await fn(trimmedName, pin);
    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/20 rounded-2xl mb-4 ring-1 ring-amber-500/30">
            <Trophy className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Bolão do Banquete
          </h1>
          <p className="text-amber-400/80 text-sm font-medium mt-1">
            Calpheon 2026 · Black Desert Online
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 ring-1 ring-white/10 shadow-2xl">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-900/50 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setPin("");
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === "login"
                  ? "bg-amber-500 text-slate-900"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setPin("");
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === "signup"
                  ? "bg-amber-500 text-slate-900"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Family Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Nome de Família (BDO)
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="Seu nome de família"
                  maxLength={24}
                  autoComplete="off"
                  className="w-full bg-slate-900/60 text-white rounded-xl pl-11 pr-4 py-3 text-sm border border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* PIN */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Senha {mode === "signup" && "(4 dígitos)"}
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) =>
                    setPin(
                      mode === "signup"
                        ? e.target.value.replace(/[^0-9]/g, "").slice(0, 4)
                        : e.target.value.slice(0, 64)
                    )
                  }
                  placeholder={mode === "signup" ? "••••" : "Sua senha"}
                  maxLength={mode === "signup" ? 4 : 64}
                  inputMode={mode === "signup" ? "numeric" : "text"}
                  autoComplete="off"
                  className="w-full bg-slate-900/60 text-white rounded-xl pl-11 pr-11 py-3 text-sm border border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none transition-all placeholder:text-slate-600 tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPin ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-3 rounded-xl text-sm transition-all active:scale-[0.98]"
            >
              {loading
                ? "Carregando..."
                : mode === "login"
                ? "Entrar no bolão"
                : "Criar minha conta"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-5">
            {mode === "signup"
              ? "Use o nome de família exatamente como aparece no BDO."
              : "Jogadores usam senha de 4 dígitos. O Master usa senha de 6+ caracteres."}
          </p>
        </div>
      </div>
    </div>
  );
}