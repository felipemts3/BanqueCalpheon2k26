import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import AuthScreen from "@/screens/AuthScreen";
import PredictionsScreen from "@/screens/PredictionsScreen";
import RankingScreen from "@/screens/RankingScreen";
import AdminScreen from "@/screens/AdminScreen";

type Screen = "predictions" | "ranking" | "admin";

function AppContent() {
  const { player, loading } = useAuth();
  const [screen, setScreen] = useState<Screen>("predictions");

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-amber-400 animate-pulse text-sm">Carregando...</div>
      </div>
    );
  }

  if (!player) {
    return <AuthScreen />;
  }

  if (screen === "ranking") {
    return <RankingScreen onBack={() => setScreen("predictions")} />;
  }

  if (screen === "admin" && player.is_master) {
    return <AdminScreen onBack={() => setScreen("predictions")} />;
  }

  return <PredictionsScreen onNavigate={setScreen} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
