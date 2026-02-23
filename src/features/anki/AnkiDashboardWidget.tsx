import { useState, useEffect } from 'react';
import { BookOpen, Wifi, WifiOff, Flame, ArrowRight, PenLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useAnkiDecks, useAnkiTodayReviews } from './ankiHooks';
import { useAnkiSyncStore } from '@/services/ankiSyncService';
import { ankiRepository } from '@/database/repositories/ankiRepository';
import { getAnkiConfig } from './ankiConfig';
import { ManualReviewModal } from './components/ManualReviewModal';

export function AnkiDashboardWidget() {
  const navigate = useNavigate();
  const decks = useAnkiDecks();
  const todayReviews = useAnkiTodayReviews();
  const { isConnected } = useAnkiSyncStore();
  const [streak, setStreak] = useState(0);
  const [showManualModal, setShowManualModal] = useState(false);

  useEffect(() => {
    ankiRepository.getStreak().then(setStreak);
  }, [todayReviews]);

  const totalReviewed = todayReviews?.reduce((sum, r) => sum + r.cardsReviewed, 0) ?? 0;
  const totalDue = decks?.reduce((sum, d) => sum + d.newCount + d.learningCount + d.reviewCount, 0) ?? 0;
  const config = getAnkiConfig();
  const threshold = config.autoQuest.threshold;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-accent" />
            <CardTitle>Anki</CardTitle>
          </div>
          {isConnected ? (
            <Badge variant="accent">
              <Wifi size={10} className="mr-1" />
              On
            </Badge>
          ) : (
            <Badge variant="danger">
              <WifiOff size={10} className="mr-1" />
              Off
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Stats */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Revisados hoje</span>
              <span className="text-white font-bold">{totalReviewed}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Pendentes</span>
              <span className="text-yellow-400 font-bold">{totalDue}</span>
            </div>

            {/* Progress toward threshold */}
            <ProgressBar
              value={totalReviewed}
              max={threshold}
              size="sm"
              label={`Meta: ${totalReviewed}/${threshold} cards`}
            />

            {/* Streak */}
            {streak > 0 && (
              <div className="flex items-center gap-1 text-sm text-orange-400">
                <Flame size={14} />
                <span>{streak} dias de streak</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {!isConnected && (
                <button
                  onClick={() => setShowManualModal(true)}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                >
                  <PenLine size={12} />
                  Manual
                </button>
              )}
              <button
                onClick={() => navigate('/anki')}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-accent hover:bg-accent/10 rounded-lg transition-colors ml-auto"
              >
                Ver detalhes
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ManualReviewModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        decks={decks ?? []}
      />
    </>
  );
}
