import { useEffect, useRef, useState } from "react";

// Vídeo de fundo (telas de login e de palpites). Para trocar o vídeo, altere só esta URL.
export const BACKGROUND_VIDEO_URL =
  "https://static.pearlcdn.com/files/portal/bdo_sa/video/2026/11/19/bannervideo_20261119004539ptbr.mp4";

export default function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  // Quem prefere menos movimento no sistema vê só o fundo estático.
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true; // autoplay só é permitido pelo navegador com o vídeo mudo
    v.play().catch(() => {
      /* se o navegador bloquear, fica o fundo estático */
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950"
    >
      {!failed && !reducedMotion && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={BACKGROUND_VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          onError={() => setFailed(true)}
        />
      )}
      {/* Escurece o vídeo para o texto continuar legível */}
      <div className="absolute inset-0 bg-slate-950/65" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40" />
    </div>
  );
}
