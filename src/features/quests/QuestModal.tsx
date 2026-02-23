import { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { questRepository } from '@/database/repositories/questRepository';
import { INITIAL_ATTRIBUTES, XP_REWARDS, GOLD_REWARDS } from '@/features/gamification/constants';
import type { Quest, QuestCategory, QuestDifficulty, QuestRecurrence, ActivityCategory, ActivityConfig, AttributeType } from '@/types';

interface QuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingQuest?: Quest | null;
  allConfigs: Record<string, ActivityConfig>;
  initialScheduledDate?: string | null;
}

export function QuestModal({ isOpen, onClose, editingQuest, allConfigs, initialScheduledDate }: QuestModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<QuestCategory>('daily');
  const [difficulty, setDifficulty] = useState<QuestDifficulty>('medium');
  const [recurrence, setRecurrence] = useState<QuestRecurrence>('once');
  const [relatedActivity, setRelatedActivity] = useState<ActivityCategory | ''>('');
  const [selectedAttributes, setSelectedAttributes] = useState<AttributeType[]>([]);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && editingQuest) {
      setTitle(editingQuest.title);
      setDescription(editingQuest.description || '');
      setCategory(editingQuest.category);
      setDifficulty(editingQuest.difficulty);
      setRecurrence(editingQuest.recurrence);
      setRelatedActivity(editingQuest.relatedActivity || '');
      setSelectedAttributes([]);
      setEstimatedDuration(editingQuest.estimatedDuration ?? null);
      setScheduledDate(editingQuest.scheduledDate || new Date().toISOString().split('T')[0]);
      // Check if duration is custom (not in predefined list)
      const predefinedDurations = [15, 30, 45, 60, 90, 120, 180];
      if (editingQuest.estimatedDuration && !predefinedDurations.includes(editingQuest.estimatedDuration)) {
        setShowCustomDuration(true);
        setCustomDuration(editingQuest.estimatedDuration.toString());
      } else {
        setShowCustomDuration(false);
        setCustomDuration('');
      }
    } else if (isOpen && !editingQuest) {
      setTitle('');
      setDescription('');
      setCategory('daily');
      setDifficulty('medium');
      setRecurrence('once');
      setRelatedActivity('');
      setSelectedAttributes([]);
      setEstimatedDuration(null);
      setShowCustomDuration(false);
      setCustomDuration('');
      setScheduledDate(initialScheduledDate || new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, editingQuest, initialScheduledDate]);

  useEffect(() => {
    if (relatedActivity && allConfigs[relatedActivity]) {
      const config = allConfigs[relatedActivity];
      const attrs = config.attributeImpacts?.map(ai => ai.attribute) || [];
      setSelectedAttributes(attrs as AttributeType[]);
    }
  }, [relatedActivity, allConfigs]);

  // Calcular recompensas com bonus de atributos
  const calculatedRewards = useMemo(() => {
    const baseXP = difficulty === 'easy' ? XP_REWARDS.COMPLETE_QUEST_EASY :
                   difficulty === 'medium' ? XP_REWARDS.COMPLETE_QUEST_MEDIUM :
                   XP_REWARDS.COMPLETE_QUEST_HARD;
    const baseGold = difficulty === 'easy' ? GOLD_REWARDS.COMPLETE_QUEST_EASY :
                     difficulty === 'medium' ? GOLD_REWARDS.COMPLETE_QUEST_MEDIUM :
                     GOLD_REWARDS.COMPLETE_QUEST_HARD;

    // Se tem atividade relacionada, usar os atributos dela
    let attributeCount = selectedAttributes.length;
    if (relatedActivity && allConfigs[relatedActivity]) {
      const config = allConfigs[relatedActivity];
      attributeCount = config.attributeImpacts?.length || 0;
    }

    // Bonus: 1 attr = 1x, 2 attrs = 1.1x, 3 attrs = 1.2x, 4+ attrs = 1.3x
    const attributeBonus = attributeCount >= 4 ? 1.3 :
                           attributeCount >= 3 ? 1.2 :
                           attributeCount >= 2 ? 1.1 : 1.0;

    return {
      xp: Math.floor(baseXP * attributeBonus),
      gold: Math.floor(baseGold * attributeBonus),
      bonus: attributeBonus > 1 ? Math.round((attributeBonus - 1) * 100) : 0,
    };
  }, [difficulty, relatedActivity, selectedAttributes, allConfigs]);

  const toggleAttribute = (attr: AttributeType) => {
    setSelectedAttributes(prev =>
      prev.includes(attr)
        ? prev.filter(a => a !== attr)
        : [...prev, attr]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      if (editingQuest) {
        await questRepository.update(editingQuest.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          difficulty,
          recurrence,
          estimatedDuration,
          scheduledDate,
          relatedActivity: relatedActivity || undefined,
          xpReward: difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 35,
          goldReward: difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 20,
        });
      } else {
        await questRepository.create({
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          difficulty,
          recurrence,
          scheduledDate,
          relatedActivity: relatedActivity || undefined,
          estimatedDuration,
        });
      }
      handleClose();
    } catch (error) {
      console.error('Failed to save quest:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setCategory('daily');
    setDifficulty('medium');
    setRecurrence('once');
    setRelatedActivity('');
    setSelectedAttributes([]);
    setEstimatedDuration(null);
    setShowCustomDuration(false);
    setCustomDuration('');
    setScheduledDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editingQuest ? 'Editar Quest' : 'Nova Quest'}
      subtitle={editingQuest ? 'Atualize os detalhes da quest' : 'Crie uma nova missao'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Titulo"
          placeholder="O que voce precisa fazer?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as QuestCategory)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            >
              <option value="daily">Daily Quest</option>
              <option value="main">Main Quest</option>
              <option value="side">Side Quest</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Dificuldade</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as QuestDifficulty)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            >
              <option value="easy">Facil</option>
              <option value="medium">Media</option>
              <option value="hard">Dificil</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Recorrencia</label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as QuestRecurrence)}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            >
              <option value="once">Sem recorrencia</option>
              <option value="daily">Diaria</option>
              <option value="weekdays">Dias uteis</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Atividade Relacionada</label>
            <select
              value={relatedActivity}
              onChange={(e) => setRelatedActivity(e.target.value as ActivityCategory | '')}
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            >
              <option value="">Nenhuma</option>
              {Object.entries(allConfigs).map(([key, config]) => (
                <option key={key} value={key}>{config.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Duracao Estimada */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Duracao Estimada</label>
          <div className="flex gap-2">
            <select
              value={showCustomDuration ? 'custom' : (estimatedDuration ?? 'na')}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'custom') {
                  setShowCustomDuration(true);
                  setEstimatedDuration(null);
                } else if (value === 'na') {
                  setShowCustomDuration(false);
                  setEstimatedDuration(null);
                  setCustomDuration('');
                } else {
                  setShowCustomDuration(false);
                  setEstimatedDuration(parseInt(value));
                  setCustomDuration('');
                }
              }}
              className="flex-1 px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
            >
              <option value="na">N/A</option>
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">1 hora</option>
              <option value="90">1h 30min</option>
              <option value="120">2 horas</option>
              <option value="180">3 horas</option>
              <option value="custom">Outro...</option>
            </select>
            {showCustomDuration && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="480"
                  placeholder="min"
                  value={customDuration}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomDuration(val);
                    const num = parseInt(val);
                    if (num > 0 && num <= 480) {
                      setEstimatedDuration(num);
                    } else {
                      setEstimatedDuration(null);
                    }
                  }}
                  className="w-20 px-3 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent text-center"
                />
                <span className="text-gray-400 text-sm">min</span>
              </div>
            )}
          </div>
          {showCustomDuration && customDuration && (
            <p className="text-xs text-gray-500 mt-1">
              {parseInt(customDuration) >= 60
                ? `${Math.floor(parseInt(customDuration) / 60)}h ${parseInt(customDuration) % 60 > 0 ? `${parseInt(customDuration) % 60}min` : ''}`
                : `${customDuration} minutos`
              }
            </p>
          )}
        </div>

        {/* Data de Realização */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Data de Realizacao</label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white focus:outline-none focus:border-accent"
          />
          {scheduledDate && scheduledDate !== new Date().toISOString().split('T')[0] && (
            <p className="text-xs text-gray-500 mt-1">
              {(() => {
                const days = Math.ceil((new Date(scheduledDate).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
                return days === 1 ? 'Amanha' : `Em ${days} dias`;
              })()}
            </p>
          )}
        </div>

        {/* Attribute Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Atributos Relacionados
            <span className="text-gray-500 font-normal ml-2">(clique para selecionar)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(INITIAL_ATTRIBUTES).map(([key, attr]) => {
              const isSelected = selectedAttributes.includes(key as AttributeType);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleAttribute(key as AttributeType)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? 'ring-2 ring-offset-2 ring-offset-bg-secondary'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: `${attr.color}20`,
                    color: attr.color,
                  }}
                >
                  {attr.name}
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          placeholder="Descricao (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent resize-none"
        />

        {/* Preview Rewards */}
        <div className="p-4 bg-bg-tertiary rounded-xl border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400">Recompensas</p>
            {calculatedRewards.bonus > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-accent/20 text-accent">
                +{calculatedRewards.bonus}% BONUS
              </span>
            )}
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className="text-accent">⚡</span>
              <span className="text-white font-medium">
                {calculatedRewards.xp}
              </span>
              <span className="text-gray-400 text-sm">XP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400">🪙</span>
              <span className="text-white font-medium">
                {calculatedRewards.gold}
              </span>
              <span className="text-gray-400 text-sm">Gold</span>
            </div>
          </div>
          {selectedAttributes.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {selectedAttributes.map(attr => {
                const attrInfo = INITIAL_ATTRIBUTES[attr];
                return (
                  <span
                    key={attr}
                    className="px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider"
                    style={{
                      backgroundColor: `${attrInfo.color}20`,
                      color: attrInfo.color,
                    }}
                  >
                    {attrInfo.name}
                  </span>
                );
              })}
            </div>
          )}
          {calculatedRewards.bonus > 0 && (
            <p className="text-[10px] text-gray-500 mt-2">
              Bonus aplicado por {selectedAttributes.length} atributos relacionados
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" isLoading={isLoading}>
            {editingQuest ? 'Salvar' : 'Criar Quest'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
