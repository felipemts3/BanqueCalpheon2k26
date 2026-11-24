import { useState, useEffect } from "react";

interface CountdownProps {
  deadline: string;
}

function formatZero(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function useDeadline(deadline: string | null) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!deadline) return { passed: false, days: 0, hours: 0, minutes: 0, seconds: 0 };

  const target = new Date(deadline).getTime();
  const diff = target - now;

  if (diff <= 0) {
    return { passed: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    passed: false,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

export default function Countdown({ deadline }: CountdownProps) {
  const { passed, days, hours, minutes, seconds } = useDeadline(deadline);

  if (passed) {
    return (
      <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-center">
        <span className="text-red-400 font-bold text-sm">
          Palpites encerrados
        </span>
      </div>
    );
  }

  const units = [
    { label: "Dias", value: days },
    { label: "Horas", value: hours },
    { label: "Min", value: minutes },
    { label: "Seg", value: seconds },
  ];

  return (
    <div className="bg-slate-900/40 rounded-xl px-3 py-2.5">
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        {units.map((u, i) => (
          <div key={u.label} className="flex items-center gap-2 sm:gap-3">
            <div className="text-center">
              <div className="text-lg sm:text-xl font-bold text-amber-400 tabular-nums leading-none">
                {formatZero(u.value)}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">
                {u.label}
              </div>
            </div>
            {i < units.length - 1 && (
              <span className="text-amber-500/30 text-lg font-bold">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
