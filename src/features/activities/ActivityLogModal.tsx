import { useState } from 'react';
import { Clock, Zap, Star, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Fireworks } from '@/components/ui/Fireworks';
import { activityRepository } from '@/database/repositories/activityRepository';
import { ACTIVITY_CONFIGS } from '@/features/gamification/constants';
import type { ActivityCategory } from '@/types';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: ActivityCategory;
}

const quickDurations = [15, 30, 45, 60, 90, 120];

export function ActivityLogModal({ isOpen, onClose, category }: ActivityLogModalProps) {
  const [duration, setDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    xpEarned: number;
    goldEarned: number;
    leveledUp: boolean;
    newLevel?: number;
    newTitle?: string;
  } | null>(null);

  const config = ACTIVITY_CONFIGS[category];

  const handleSubmit = async () => {
    const finalDuration = customDuration ? parseInt(customDuration) : duration;

    if (finalDuration <= 0) return;

    setIsLoading(true);

    try {
      const logResult = await activityRepository.logActivity({
        category,
        duration: finalDuration,
        notes: notes || undefined,
        difficulty,
        mood,
      });

      setResult({
        xpEarned: logResult.xpEarned,
        goldEarned: logResult.goldEarned,
        leveledUp: logResult.leveledUp,
        newLevel: logResult.newLevel,
        newTitle: logResult.newTitle,
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setDuration(30);
    setCustomDuration('');
    setNotes('');
    setDifficulty('medium');
    setMood(3);
    onClose();
  };

  // Success state
  if (result) {
    return (
      <>
        {result.leveledUp && <Fireworks isActive={true} duration={3000} />}
        <Modal isOpen={isOpen} onClose={handleClose} size="sm">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-4"
          >
            {result.leveledUp ? (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                  className="w-20 h-20 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center"
                >
                  <Trophy size={40} className="text-accent" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-2">Level Up!</h3>
                <p className="text-accent text-lg font-medium mb-1">Nível {result.newLevel}</p>
                <p className="text-gray-400 mb-6">{result.newTitle}</p>
              </>
            ) : (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center"
              >
                <Star size={32} className="text-accent" />
              </motion.div>
              <h3 className="text-xl font-bold text-white mb-4">Atividade Registrada!</h3>
            </>
          )}

          <div className="flex justify-center gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-accent">+{result.xpEarned}</p>
              <p className="text-xs text-gray-400">XP</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">+{result.goldEarned}</p>
              <p className="text-xs text-gray-400">Gold</p>
            </div>
          </div>

          <Button onClick={handleClose} className="w-full">
            Continuar
          </Button>
        </motion.div>
      </Modal>
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={config.name}
      subtitle="Registrar atividade"
      size="md"
    >
      <div className="space-y-6">
        {/* Duration Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            <Clock size={16} className="inline mr-2" />
            Duração
          </label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {quickDurations.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDuration(d);
                  setCustomDuration('');
                }}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  duration === d && !customDuration
                    ? 'bg-accent text-white'
                    : 'bg-bg-tertiary text-gray-300 hover:bg-bg-hover border border-border'
                }`}
              >
                {d >= 60 ? `${d / 60}h` : `${d}min`}
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="number"
              placeholder="Ou digite a duração em minutos..."
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Dificuldade
          </label>
          <div className="flex gap-2">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                  difficulty === d
                    ? d === 'easy'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : d === 'hard'
                      ? 'bg-red-500/20 border-red-500/50 text-red-400'
                      : 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'bg-bg-tertiary border-border text-gray-400 hover:bg-bg-hover'
                }`}
              >
                {d === 'easy' ? 'Fácil' : d === 'medium' ? 'Médio' : 'Difícil'}
              </button>
            ))}
          </div>
        </div>

        {/* Mood */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Como você está se sentindo?
          </label>
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map((m) => (
              <button
                key={m}
                onClick={() => setMood(m as 1 | 2 | 3 | 4 | 5)}
                className={`flex-1 py-3 rounded-lg text-2xl transition-all ${
                  mood === m
                    ? 'bg-accent/20 border border-accent/50'
                    : 'bg-bg-tertiary border border-border hover:bg-bg-hover'
                }`}
              >
                {m === 1 ? '😫' : m === 2 ? '😕' : m === 3 ? '😐' : m === 4 ? '😊' : '🤩'}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Notas (opcional)
          </label>
          <textarea
            placeholder="O que você fez? Alguma observação?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent resize-none"
          />
        </div>

        {/* Preview */}
        <div className="p-4 bg-bg-tertiary rounded-xl border border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Recompensa estimada:</span>
            <div className="flex items-center gap-3">
              <Badge variant="accent">
                <Zap size={14} className="mr-1" />
                ~{Math.floor(config.baseXP + (customDuration ? parseInt(customDuration) : duration) * config.xpPerMinute)} XP
              </Badge>
              <Badge variant="warning">
                +{config.goldPerSession} Gold
              </Badge>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            isLoading={isLoading}
          >
            Registrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
