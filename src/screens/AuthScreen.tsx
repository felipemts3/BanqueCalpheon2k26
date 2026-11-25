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

  const inputBase =
    "w-full bg-bone text-ink rounded-input py-3 text-sm border border-hairline focus:border-ink focus:ring-1 focus:ring-ink outline-none transition-all placeholder:text-ash";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8">
          <p className="inline-flex items-center gap-2 text-[10px] leading-[2.2] uppercase tracking-[0.05em] text-highlighter">
            <Trophy className="w-4 h-4" />
            Black Desert Online · Calpheon 2026
          </p>
          <h1 className="mt-2 text-[40px] sm:text-[64px] leading-none text-paper">
            Bolão do
            <br />
            Banquete
          </h1>
          <p className="mt-4 text-base text-smoke/70">
            Escolha o que vem no evento. Acertou, pontua. Errou, perde.
          </p>
        </div>

        {/* Card */}
        <div className="bg-paper text-ink rounded-card p-6 ring-1 ring-hairline">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-bone rounded-input mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setPin("");
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-button text-sm transition-all ${
                mode === "login" ? "bg-highlighter text-ink" : "text-ash hover:text-ink"
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
              className={`flex-1 py-2.5 rounded-button text-sm transition-all ${
                mode === "signup" ? "bg-highlighter text-ink" : "text-ash hover:text-ink"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Family Name */}
            <div>
              <label className="block text-[10px] leading-[2.2] uppercase tracking-[0.05em] text-ash mb-1">
                Nome de Família (BDO)
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ash" />
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="Seu nome de família"
                  maxLength={24}
                  autoComplete="off"
                  className={`${inputBase} pl-11 pr-4`}
                />
              </div>
            </div>

            {/* PIN */}
            <div>
              <label className="block text-[10px] leading-[2.2] uppercase tracking-[0.05em] text-ash mb-1">
                Senha {mode === "signup" && "(4 dígitos)"}
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ash" />
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
                  className={`${inputBase} pl-11 pr-11 tracking-[0.05em]`}
                />
                <button
                  type="button"
                  onClick={() => setShowPin((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ash hover:text-ink transition-colors"
                  aria-label={showPin ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-input px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-highlighter hover:bg-highlighter/90 disabled:opacity-50 disabled:cursor-not-allowed text-ink py-3.5 rounded-button text-sm uppercase tracking-[0.05em] transition-all active:scale-[0.98]"
            >
              {loading
                ? "Carregando..."
                : mode === "login"
                ? "Entrar no bolão"
                : "Criar minha conta"}
            </button>
          </form>

          <p className="text-center text-xs text-ash mt-5">
            {mode === "signup"
              ? "Use o nome de família exatamente como aparece no BDO."
              : "Jogadores usam senha de 4 dígitos. O Master usa senha de 6+ caracteres."}
          </p>
        </div>
      </div>
    </div>
  );
}
