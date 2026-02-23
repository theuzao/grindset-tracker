import { useState, useEffect } from 'react';
import {
  BookOpen,
  RefreshCw,
  Wifi,
  WifiOff,
  Flame,
  Clock,
  Target,
  Layers,
  TrendingUp,
  Calendar,
  PenLine,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAnkiDecks, useAnkiTodayReviews } from '@/features/anki/ankiHooks';
import { useAnkiSyncStore, ankiSyncService } from '@/services/ankiSyncService';
import { ankiRepository } from '@/database/repositories/ankiRepository';
import { AnkiDeckCard } from '@/features/anki/components/AnkiDeckCard';
import { AnkiWeeklyChart } from '@/features/anki/components/AnkiWeeklyChart';
import { AnkiHeatmap } from '@/features/anki/components/AnkiHeatmap';
import { ManualReviewModal } from '@/features/anki/components/ManualReviewModal';
import type { AnkiSnapshot } from '@/features/anki/types';

export function Anki() {
  const decks = useAnkiDecks();
  const todayReviews = useAnkiTodayReviews();
  const { isConnected, lastSync, isSyncing } = useAnkiSyncStore();

  const [snapshot, setSnapshot] = useState<AnkiSnapshot | null>(null);
  const [streak, setStreak] = useState(0);
  const [forecast, setForecast] = useState<{ date: string; dueCards: number }[]>([]);
  const [showManualModal, setShowManualModal] = useState(false);
  const [preselectedDeck, setPreselectedDeck] = useState<string | undefined>();

  useEffect(() => {
    ankiRepository.getLatestSnapshot().then(s => setSnapshot(s ?? null));
    ankiRepository.getStreak().then(setStreak);
    setForecast(ankiRepository.getForecast());
  }, [todayReviews, lastSync]);

  const totalReviewed = todayReviews?.reduce((sum, r) => sum + r.cardsReviewed, 0) ?? 0;
  const totalTime = todayReviews?.reduce((sum, r) => sum + r.timeSpent, 0) ?? 0;
  const totalDue = decks?.reduce((sum, d) => sum + d.newCount + d.learningCount + d.reviewCount, 0) ?? 0;
  const totalMature = decks?.reduce((sum, d) => sum + d.matureCards, 0) ?? 0;
  const totalYoung = decks?.reduce((sum, d) => sum + d.youngCards, 0) ?? 0;
  const avgInterval = decks && decks.length > 0
    ? Math.round(decks.reduce((sum, d) => sum + d.averageInterval, 0) / decks.length)
    : 0;

  const handleManualReview = (deckName: string) => {
    setPreselectedDeck(deckName);
    setShowManualModal(true);
  };

  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : 'Nunca';

  const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header
        title="Anki"
        subtitle="Acompanhamento de revisões e estatísticas"
      />

      <div className="p-6 space-y-6">
        {/* Connection status + sync */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <Badge variant="accent">
                <Wifi size={12} className="mr-1" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="danger">
                <WifiOff size={12} className="mr-1" />
                Desconectado
              </Badge>
            )}
            <span className="text-xs text-gray-500">
              Última sync: {lastSyncLabel}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => ankiSyncService.syncNow()}
            isLoading={isSyncing}
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            Sincronizar
          </Button>
        </div>

        {/* Stats Row 1: Hoje */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<BookOpen size={20} />}
            label="Revisados Hoje"
            value={totalReviewed}
            color="text-accent"
          />
          <StatCard
            icon={<Target size={20} />}
            label="Pendentes"
            value={totalDue}
            color="text-yellow-400"
          />
          <StatCard
            icon={<TrendingUp size={20} />}
            label="Precisão"
            value={snapshot?.accuracy ? `${snapshot.accuracy}%` : '—'}
            color="text-green-400"
          />
          <StatCard
            icon={<Clock size={20} />}
            label="Tempo Hoje"
            value={totalTime > 0 ? `${totalTime}min` : '—'}
            color="text-blue-400"
          />
        </div>

        {/* Stats Row 2: Geral */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Flame size={20} />}
            label="Streak"
            value={`${streak}d`}
            color="text-orange-400"
          />
          <StatCard
            icon={<Layers size={20} />}
            label="Maduros"
            value={totalMature}
            color="text-emerald-400"
          />
          <StatCard
            icon={<Layers size={20} />}
            label="Jovens"
            value={totalYoung}
            color="text-purple-400"
          />
          <StatCard
            icon={<Calendar size={20} />}
            label="Intervalo Médio"
            value={avgInterval > 0 ? `${avgInterval}d` : '—'}
            color="text-cyan-400"
          />
        </div>

        {/* Grid principal */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Matérias / Decks */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen size={20} className="text-accent" />
                <CardTitle>Matérias</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreselectedDeck(undefined);
                  setShowManualModal(true);
                }}
              >
                <PenLine size={14} />
                Revisão Manual
              </Button>
            </CardHeader>
            <CardContent>
              {!decks || decks.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  {isConnected
                    ? 'Nenhum deck encontrado. Sincronize para carregar.'
                    : 'Conecte o Anki para ver seus decks.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {decks.map((deck, index) => (
                    <AnkiDeckCard
                      key={deck.name}
                      deck={deck}
                      todayReview={todayReviews?.find(r => r.deckName === deck.name)}
                      colorIndex={index}
                      onManualReview={handleManualReview}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Evolução + Heatmap */}
          <Card>
            <CardContent>
              <div className="space-y-6">
                {/* Evolução Semanal */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-accent" />
                    <h4 className="text-sm font-medium text-white">Evolução Semanal</h4>
                  </div>
                  <AnkiWeeklyChart />
                </div>

                <div className="border-t border-border" />

                {/* Heatmap */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={16} className="text-accent" />
                    <h4 className="text-sm font-medium text-white">Heatmap de Estudo</h4>
                  </div>
                  <AnkiHeatmap />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Previsão 7 dias */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar size={20} className="text-accent" />
                <CardTitle>Previsão de Revisões</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {forecast.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {forecast.map((f, i) => {
                    const d = new Date(f.date + 'T12:00:00');
                    const dayName = DAY_NAMES_SHORT[d.getDay()];
                    const dateLabel = i === 0 ? 'Hoje' : dayName;

                    return (
                      <div
                        key={f.date}
                        className="flex items-center justify-between p-2 rounded-lg bg-bg-tertiary"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400 w-10">{dateLabel}</span>
                          <span className="text-xs text-gray-600">{f.date.slice(5)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 rounded-full bg-accent/50"
                            style={{
                              width: `${Math.min(
                                (f.dueCards / Math.max(forecast[0]?.dueCards || 1, 1)) * 100,
                                100,
                              )}px`,
                            }}
                          />
                          <span className="text-sm text-white font-medium w-12 text-right">
                            {f.dueCards}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Manual Review Modal */}
      <ManualReviewModal
        isOpen={showManualModal}
        onClose={() => {
          setShowManualModal(false);
          setPreselectedDeck(undefined);
        }}
        decks={decks ?? []}
        preselectedDeck={preselectedDeck}
      />
    </div>
  );
}

// Componente auxiliar de stat card
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-bg-secondary border border-border">
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
