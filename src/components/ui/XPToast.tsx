import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';
import { onXPFeedback, type XPFeedbackEvent } from '@/utils/xpFeedback';

interface ToastItem extends XPFeedbackEvent {
  id: number;
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const type = toast.type ?? (toast.xp >= 0 ? 'gain' : 'loss');

  if (type === 'levelup') {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 shadow-xl animate-fade-in min-w-[200px]">
        <div className="flex items-center gap-2 mb-0.5">
          <ChevronUp className="w-4 h-4 text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-500/80 truncate max-w-[160px]">Level Up!</p>
        </div>
        <span className="text-base font-bold text-yellow-400">
          {toast.levelChange
            ? `Nível ${toast.levelChange.from} → ${toast.levelChange.to}`
            : toast.label}
        </span>
        {toast.levelChange && (
          <p className="text-xs text-yellow-500/70 mt-0.5 truncate max-w-[180px]">
            {toast.levelChange.title}
          </p>
        )}
      </div>
    );
  }

  if (type === 'leveldown') {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 shadow-xl animate-fade-in min-w-[200px]">
        <div className="flex items-center gap-2 mb-0.5">
          <ChevronDown className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400/80 truncate max-w-[160px]">Desceu de nível</p>
        </div>
        <span className="text-base font-bold text-red-400">
          {toast.levelChange
            ? `Nível ${toast.levelChange.from} → ${toast.levelChange.to}`
            : toast.label}
        </span>
        {toast.levelChange && (
          <p className="text-xs text-red-400/70 mt-0.5 truncate max-w-[180px]">
            {toast.levelChange.title}
          </p>
        )}
      </div>
    );
  }

  if (type === 'loss') {
    const xpLost = Math.abs(toast.xp);
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 shadow-xl animate-fade-in min-w-[200px]">
        <div className="flex items-center gap-1.5 mb-0.5">
          <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-xs text-gray-400 truncate max-w-[160px]">{toast.label}</p>
        </div>
        <span className="text-lg font-bold text-red-400">-{xpLost} XP</span>
      </div>
    );
  }

  // type === 'gain' (default)
  return (
    <div className="bg-bg-secondary border border-border rounded-xl px-4 py-3 shadow-xl animate-fade-in min-w-[200px]">
      <div className="flex items-center gap-1.5 mb-0.5">
        <TrendingUp className="w-3.5 h-3.5 text-accent shrink-0" />
        <p className="text-xs text-gray-400 truncate max-w-[160px]">{toast.label}</p>
      </div>
      <span className="text-lg font-bold text-accent">+{toast.xp} XP</span>
    </div>
  );
}

export function XPToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return onXPFeedback((data) => {
      const id = Date.now();
      setToasts(prev => [...prev, { ...data, id }]);

      // Level changes ficam um pouco mais tempo
      const duration = data.type === 'levelup' || data.type === 'leveldown' ? 5000 : 3500;
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
