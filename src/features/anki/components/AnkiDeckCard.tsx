import { Clock, Layers, PenLine } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { AnkiDeck, AnkiReview } from '../types';

const DECK_COLORS = [
  { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', bar: 'bg-blue-500', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', bar: 'bg-purple-500', dot: 'bg-purple-500' },
  { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', bar: 'bg-amber-500', dot: 'bg-amber-500' },
  { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', bar: 'bg-rose-500', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', bar: 'bg-cyan-500', dot: 'bg-cyan-500' },
  { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400', bar: 'bg-indigo-500', dot: 'bg-indigo-500' },
  { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', bar: 'bg-pink-500', dot: 'bg-pink-500' },
];

interface AnkiDeckCardProps {
  deck: AnkiDeck;
  todayReview?: AnkiReview;
  colorIndex: number;
  onManualReview: (deckName: string) => void;
}

export function AnkiDeckCard({ deck, todayReview, colorIndex, onManualReview }: AnkiDeckCardProps) {
  const dueCards = deck.newCount + deck.learningCount + deck.reviewCount;
  const reviewed = todayReview?.cardsReviewed ?? 0;
  const maturePercent = deck.totalCards > 0
    ? Math.round((deck.matureCards / deck.totalCards) * 100)
    : 0;
  const colors = DECK_COLORS[colorIndex % DECK_COLORS.length];

  return (
    <div className={`p-4 rounded-xl ${colors.bg} border ${colors.border} space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
          <span className={`font-semibold ${colors.text}`}>{deck.name}</span>
        </div>
        <button
          onClick={() => onManualReview(deck.name)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          title="Marcar revisão manual"
        >
          <PenLine size={12} />
          Manual
        </button>
      </div>

      {/* Stats compactos */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-white">{reviewed}</span>
            <span className="text-xs text-gray-500">revisados</span>
          </div>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="text-green-400">{deck.newCount} <span className="text-gray-600">novos</span></span>
          <span className="text-orange-400">{deck.learningCount} <span className="text-gray-600">aprend.</span></span>
          <span className="text-blue-400">{deck.reviewCount} <span className="text-gray-600">revisão</span></span>
        </div>
      </div>

      {/* Progress bar */}
      {(reviewed > 0 || dueCards > 0) && (
        <ProgressBar
          value={reviewed}
          max={Math.max(reviewed + dueCards, 1)}
          size="sm"
          color={colors.bar}
        />
      )}

      {/* Footer stats */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {deck.averageInterval}d intervalo
          </span>
          <span className="flex items-center gap-1">
            <Layers size={11} />
            {maturePercent}% maduros
          </span>
        </div>
        <span className="text-gray-600">{deck.totalCards} total</span>
      </div>
    </div>
  );
}
