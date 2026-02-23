import { useEffect, useState } from 'react';
import { onXPFeedback, type XPFeedbackEvent } from '@/utils/xpFeedback';

interface ToastItem extends XPFeedbackEvent {
  id: number;
}

export function XPToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return onXPFeedback((data) => {
      const id = Date.now();
      setToasts(prev => [...prev, { ...data, id }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3500);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="bg-bg-secondary border border-border rounded-xl px-4 py-3 shadow-xl animate-fade-in min-w-[200px]"
        >
          <p className="text-xs text-gray-400 mb-1 truncate max-w-[180px]">{toast.label}</p>
          <span className="text-lg font-bold text-accent">+{toast.xp} XP</span>
        </div>
      ))}
    </div>
  );
}
