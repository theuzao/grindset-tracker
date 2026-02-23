import { useState, useEffect } from 'react';
import { Target, Plus, Check, Calendar, Clock, Trophy, Pause, Play, Trash2, Edit3, X, ChevronDown, ChevronUp, Flag } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useObjectives, useCustomCategories } from '@/database/hooks';
import { objectiveRepository } from '@/database/repositories/objectiveRepository';
import { categoryRepository } from '@/database/repositories/categoryRepository';
import { ACTIVITY_CONFIGS, XP_REWARDS, GOLD_REWARDS, INITIAL_ATTRIBUTES } from '@/features/gamification/constants';
import type { Objective, ObjectiveTimeframe, ObjectiveStatus, ActivityConfig, ActivityCategory, AttributeType } from '@/types';

type TabFilter = 'all' | 'short' | 'medium' | 'long';

const TIMEFRAME_LABELS: Record<ObjectiveTimeframe, string> = {
  short: 'Curto Prazo',
  medium: 'Medio Prazo',
  long: 'Longo Prazo',
};

const TIMEFRAME_DAYS: Record<ObjectiveTimeframe, string> = {
  short: 'ate 30 dias',
  medium: '1-6 meses',
  long: '6+ meses',
};

const STATUS_COLORS: Record<ObjectiveStatus, string> = {
  active: 'bg-accent/20 text-accent',
  completed: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  abandoned: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS: Record<ObjectiveStatus, string> = {
  active: 'Ativo',
  completed: 'Completo',
  paused: 'Pausado',
  abandoned: 'Abandonado',
};

export function Objectives() {
  const objectives = useObjectives();
  const customCategories = useCustomCategories(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [allConfigs, setAllConfigs] = useState<Record<string, ActivityConfig>>(ACTIVITY_CONFIGS);

  // Load all activity configs
  useEffect(() => {
    categoryRepository.getAllActivityConfigs().then(setAllConfigs);
  }, [customCategories]);

  // Modal state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeframe, setTimeframe] = useState<ObjectiveTimeframe>('short');
  const [targetDate, setTargetDate] = useState('');
  const [relatedActivities, setRelatedActivities] = useState<ActivityCategory[]>([]);
  const [milestones, setMilestones] = useState<{ title: string }[]>([]);
  const [newMilestone, setNewMilestone] = useState('');

  const filteredObjectives = objectives?.filter(obj => {
    if (activeTab === 'all') return true;
    return obj.timeframe === activeTab;
  }) ?? [];

  const activeObjectives = filteredObjectives.filter(o => o.status === 'active');
  const completedObjectives = filteredObjectives.filter(o => o.status === 'completed');
  const pausedObjectives = filteredObjectives.filter(o => o.status === 'paused');

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'short', label: 'Curto Prazo' },
    { key: 'medium', label: 'Medio Prazo' },
    { key: 'long', label: 'Longo Prazo' },
  ];

  const resetModal = () => {
    setTitle('');
    setDescription('');
    setTimeframe('short');
    setTargetDate('');
    setRelatedActivities([]);
    setMilestones([]);
    setNewMilestone('');
    setEditingObjective(null);
  };

  const openNewObjectiveModal = () => {
    resetModal();
    // Default target date based on timeframe
    const date = new Date();
    date.setDate(date.getDate() + 30);
    setTargetDate(date.toISOString().split('T')[0]);
    setShowModal(true);
  };

  const openEditModal = (objective: Objective) => {
    setEditingObjective(objective);
    setTitle(objective.title);
    setDescription(objective.description || '');
    setTimeframe(objective.timeframe);
    setTargetDate(objective.targetDate.split('T')[0]);
    setRelatedActivities(objective.relatedActivities || []);
    setMilestones(objective.milestones.map(m => ({ title: m.title })));
    setShowModal(true);
  };

  const handleAddMilestone = () => {
    if (newMilestone.trim()) {
      setMilestones([...milestones, { title: newMilestone.trim() }]);
      setNewMilestone('');
    }
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !targetDate) return;

    try {
      if (editingObjective) {
        await objectiveRepository.update(editingObjective.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          timeframe,
          targetDate: new Date(targetDate).toISOString(),
          relatedActivities: relatedActivities.length > 0 ? relatedActivities : undefined,
        });

        // Handle milestones separately if needed
        // For simplicity, we only update basic fields here
      } else {
        await objectiveRepository.create({
          title: title.trim(),
          description: description.trim() || undefined,
          timeframe,
          targetDate: new Date(targetDate).toISOString(),
          milestones,
          relatedActivities: relatedActivities.length > 0 ? relatedActivities : undefined,
        });
      }

      setShowModal(false);
      resetModal();
    } catch (error) {
      console.error('Error saving objective:', error);
    }
  };

  const handleCompleteMilestone = async (objectiveId: string, milestoneId: string, isCompleted: boolean) => {
    try {
      if (isCompleted) {
        await objectiveRepository.uncompleteMilestone(objectiveId, milestoneId);
      } else {
        await objectiveRepository.completeMilestone(objectiveId, milestoneId);
      }
    } catch (error) {
      console.error('Error toggling milestone:', error);
    }
  };

  const handleAddMilestoneToObjective = async (objectiveId: string, title: string) => {
    try {
      await objectiveRepository.addMilestone(objectiveId, title);
    } catch (error) {
      console.error('Error adding milestone:', error);
    }
  };

  const handleCompleteObjective = async (objectiveId: string) => {
    try {
      const result = await objectiveRepository.complete(objectiveId);
      if (result.leveledUp) {
        alert(`Parabens! Voce subiu para o nivel ${result.newLevel}: ${result.newTitle}`);
      }
    } catch (error) {
      console.error('Error completing objective:', error);
    }
  };

  const handlePauseObjective = async (objectiveId: string) => {
    try {
      await objectiveRepository.pause(objectiveId);
    } catch (error) {
      console.error('Error pausing objective:', error);
    }
  };

  const handleResumeObjective = async (objectiveId: string) => {
    try {
      await objectiveRepository.resume(objectiveId);
    } catch (error) {
      console.error('Error resuming objective:', error);
    }
  };

  const handleDeleteObjective = async (objectiveId: string) => {
    if (confirm('Tem certeza que deseja excluir este objetivo?')) {
      try {
        await objectiveRepository.delete(objectiveId);
      } catch (error) {
        console.error('Error deleting objective:', error);
      }
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedObjectives);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedObjectives(newExpanded);
  };

  const getAttributesFromActivities = (activities?: ActivityCategory[]): AttributeType[] => {
    if (!activities || activities.length === 0) return [];
    const attrs = new Set<AttributeType>();
    activities.forEach(cat => {
      const config = allConfigs[cat];
      if (config?.attributeImpacts) {
        config.attributeImpacts.forEach(ai => attrs.add(ai.attribute));
      }
    });
    return Array.from(attrs);
  };

  const renderObjectiveCard = (objective: Objective) => {
    const isExpanded = expandedObjectives.has(objective.id);
    const daysRemaining = Math.ceil(
      (new Date(objective.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const isOverdue = daysRemaining < 0 && objective.status === 'active';
    const attributes = getAttributesFromActivities(objective.relatedActivities);

    return (
      <div
        key={objective.id}
        className={`p-4 rounded-xl bg-bg-tertiary border transition-all ${
          isOverdue ? 'border-red-500/50' : 'border-border'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-white">{objective.title}</h3>
              <Badge className={STATUS_COLORS[objective.status]}>
                {STATUS_LABELS[objective.status]}
              </Badge>
            </div>
            {objective.description && (
              <p className="text-sm text-gray-400">{objective.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-accent font-medium">
              +{objective.xpReward} XP
            </span>
            <button
              onClick={() => toggleExpanded(objective.id)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>

        {/* Attribute Tags */}
        {attributes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {attributes.map(attr => {
              const attrInfo = INITIAL_ATTRIBUTES[attr];
              return (
                <span
                  key={attr}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${attrInfo.color}20`, color: attrInfo.color }}
                >
                  {attrInfo.name}
                </span>
              );
            })}
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{objective.progress}% completo</span>
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : ''}`}>
              <Calendar size={12} />
              {isOverdue
                ? `${Math.abs(daysRemaining)} dias atrasado`
                : `${daysRemaining} dias restantes`}
            </span>
          </div>
          <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                objective.status === 'completed' ? 'bg-green-500' : 'bg-accent'
              }`}
              style={{ width: `${objective.progress}%` }}
            />
          </div>
        </div>

        {/* Timeframe Badge */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="default">
            <Clock size={12} className="mr-1" />
            {TIMEFRAME_LABELS[objective.timeframe]}
          </Badge>
          <span className="text-xs text-gray-500">{TIMEFRAME_DAYS[objective.timeframe]}</span>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border">
            {/* Milestones */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                <Flag size={14} />
                Milestones ({objective.milestones.filter(m => m.isCompleted).length}/{objective.milestones.length})
              </h4>
              {objective.milestones.length > 0 ? (
                <div className="space-y-2">
                  {objective.milestones.map(milestone => (
                    <div
                      key={milestone.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-bg-secondary"
                    >
                      <button
                        onClick={() => handleCompleteMilestone(objective.id, milestone.id, milestone.isCompleted)}
                        disabled={objective.status !== 'active'}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          milestone.isCompleted
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-500 hover:border-accent'
                        } ${objective.status !== 'active' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {milestone.isCompleted && <Check size={12} />}
                      </button>
                      <span
                        className={`text-sm flex-1 ${
                          milestone.isCompleted ? 'text-gray-500 line-through' : 'text-white'
                        }`}
                      >
                        {milestone.title}
                      </span>
                      {milestone.isCompleted && milestone.completedAt && (
                        <span className="text-xs text-gray-500">
                          {new Date(milestone.completedAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Nenhuma milestone definida</p>
              )}

              {/* Add Milestone (only for active objectives) */}
              {objective.status === 'active' && (
                <div className="mt-2">
                  <MilestoneInput
                    onAdd={(title) => handleAddMilestoneToObjective(objective.id, title)}
                  />
                </div>
              )}
            </div>

            {/* Related Activities */}
            {objective.relatedActivities && objective.relatedActivities.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-white mb-2">Atividades Relacionadas</h4>
                <div className="flex flex-wrap gap-2">
                  {objective.relatedActivities.map(cat => {
                    const config = allConfigs[cat] || { name: cat, color: '#6366F1' };
                    return (
                      <span
                        key={cat}
                        className="px-2.5 py-1 text-sm font-medium rounded-md border"
                        style={{ backgroundColor: `${config.color}20`, color: config.color, borderColor: `${config.color}30` }}
                      >
                        {config.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              {objective.status === 'active' && (
                <>
                  <Button
                    size="sm"
                    className="bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20"
                    onClick={() => handleCompleteObjective(objective.id)}
                  >
                    <Trophy size={14} className="mr-1" />
                    Completar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePauseObjective(objective.id)}
                  >
                    <Pause size={14} className="mr-1" />
                    Pausar
                  </Button>
                </>
              )}
              {objective.status === 'paused' && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleResumeObjective(objective.id)}
                >
                  <Play size={14} className="mr-1" />
                  Retomar
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openEditModal(objective)}
              >
                <Edit3 size={14} className="mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => handleDeleteObjective(objective.id)}
              >
                <Trash2 size={14} className="mr-1" />
                Excluir
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Objetivos"
        subtitle="Metas de curto, medio e longo prazo"
      />

      <div className="p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center p-4">
            <Target size={24} className="mx-auto text-accent mb-2" />
            <div className="text-2xl font-bold text-white">
              {objectives?.filter(o => o.status === 'active').length ?? 0}
            </div>
            <div className="text-xs text-gray-400">Ativos</div>
          </Card>
          <Card className="text-center p-4">
            <Trophy size={24} className="mx-auto text-green-400 mb-2" />
            <div className="text-2xl font-bold text-white">
              {objectives?.filter(o => o.status === 'completed').length ?? 0}
            </div>
            <div className="text-xs text-gray-400">Completos</div>
          </Card>
          <Card className="text-center p-4">
            <Flag size={24} className="mx-auto text-purple-400 mb-2" />
            <div className="text-2xl font-bold text-white">
              {objectives?.reduce((sum, o) => sum + o.milestones.filter(m => m.isCompleted).length, 0) ?? 0}
            </div>
            <div className="text-xs text-gray-400">Milestones</div>
          </Card>
          <Card className="text-center p-4">
            <Clock size={24} className="mx-auto text-orange-400 mb-2" />
            <div className="text-2xl font-bold text-white">
              {objectives?.filter(o => {
                const days = Math.ceil((new Date(o.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return o.status === 'active' && days <= 7 && days >= 0;
              }).length ?? 0}
            </div>
            <div className="text-xs text-gray-400">Vencendo</div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-accent text-white'
                  : 'bg-bg-tertiary text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Objectives */}
        {activeObjectives.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target size={20} className="text-accent" />
                Objetivos Ativos
              </CardTitle>
              <Button size="sm" onClick={openNewObjectiveModal}>
                <Plus size={16} className="mr-1" />
                Novo Objetivo
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeObjectives.map(renderObjectiveCard)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Paused Objectives */}
        {pausedObjectives.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-400">
                <Pause size={20} />
                Objetivos Pausados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pausedObjectives.map(renderObjectiveCard)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed Objectives */}
        {completedObjectives.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-400">
                <Trophy size={20} />
                Objetivos Completos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {completedObjectives.map(renderObjectiveCard)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {filteredObjectives.length === 0 && (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <Target size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400 mb-4">Nenhum objetivo encontrado</p>
                <Button onClick={openNewObjectiveModal}>
                  <Plus size={16} className="mr-2" />
                  Criar Primeiro Objetivo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* XP Rewards Info */}
        <Card variant="glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy size={20} className="text-accent" />
              Recompensas por Objetivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-bg-tertiary text-center">
                <div className="text-lg font-bold text-accent">
                  +{XP_REWARDS.COMPLETE_OBJECTIVE_SHORT} XP
                </div>
                <div className="text-sm text-gray-400">Curto Prazo</div>
                <div className="text-xs text-gray-500 mt-1">
                  +{GOLD_REWARDS.COMPLETE_OBJECTIVE_SHORT} Gold
                </div>
              </div>
              <div className="p-4 rounded-lg bg-bg-tertiary text-center">
                <div className="text-lg font-bold text-purple-400">
                  +{XP_REWARDS.COMPLETE_OBJECTIVE_MEDIUM} XP
                </div>
                <div className="text-sm text-gray-400">Medio Prazo</div>
                <div className="text-xs text-gray-500 mt-1">
                  +{GOLD_REWARDS.COMPLETE_OBJECTIVE_MEDIUM} Gold
                </div>
              </div>
              <div className="p-4 rounded-lg bg-bg-tertiary text-center">
                <div className="text-lg font-bold text-amber-400">
                  +{XP_REWARDS.COMPLETE_OBJECTIVE_LONG} XP
                </div>
                <div className="text-sm text-gray-400">Longo Prazo</div>
                <div className="text-xs text-gray-500 mt-1">
                  +{GOLD_REWARDS.COMPLETE_OBJECTIVE_LONG} Gold
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4 text-center">
              Cada milestone completada da +{XP_REWARDS.COMPLETE_MILESTONE} XP
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto scrollbar-thin">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingObjective ? 'Editar Objetivo' : 'Novo Objetivo'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetModal();
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Titulo *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border text-white focus:border-accent focus:outline-none"
                    placeholder="Ex: Aprender React Native"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Descricao
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border text-white focus:border-accent focus:outline-none resize-none"
                    rows={3}
                    placeholder="Descreva seu objetivo..."
                  />
                </div>

                {/* Timeframe */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Prazo
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['short', 'medium', 'long'] as ObjectiveTimeframe[]).map(tf => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          timeframe === tf
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        <div className="font-medium">{TIMEFRAME_LABELS[tf]}</div>
                        <div className="text-xs opacity-70">{TIMEFRAME_DAYS[tf]}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Data Alvo *
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border text-white focus:border-accent focus:outline-none"
                  />
                </div>

                {/* Related Activities */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Atividades Relacionadas
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(allConfigs).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => {
                          if (relatedActivities.includes(key)) {
                            setRelatedActivities(relatedActivities.filter(a => a !== key));
                          } else {
                            setRelatedActivities([...relatedActivities, key]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                          relatedActivities.includes(key)
                            ? 'ring-2 ring-accent'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: `${config.color}20`,
                          color: config.color,
                        }}
                      >
                        {config.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Milestones (only for new objectives) */}
                {!editingObjective && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Milestones
                    </label>
                    <div className="space-y-2 mb-2">
                      {milestones.map((m, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 rounded-lg bg-bg-tertiary"
                        >
                          <Flag size={14} className="text-accent" />
                          <span className="flex-1 text-sm text-white">{m.title}</span>
                          <button
                            onClick={() => handleRemoveMilestone(index)}
                            className="text-gray-400 hover:text-red-400"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMilestone}
                        onChange={(e) => setNewMilestone(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddMilestone()}
                        className="flex-1 px-4 py-2 rounded-lg bg-bg-tertiary border border-border text-white focus:border-accent focus:outline-none"
                        placeholder="Adicionar milestone..."
                      />
                      <Button onClick={handleAddMilestone} disabled={!newMilestone.trim()}>
                        <Plus size={16} />
                      </Button>
                    </div>
                  </div>
                )}

                {/* XP Preview */}
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Recompensa ao completar:</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-accent">
                        +{XP_REWARDS[`COMPLETE_OBJECTIVE_${timeframe.toUpperCase()}` as keyof typeof XP_REWARDS]} XP
                      </span>
                      <span className="text-sm text-amber-400 ml-2">
                        +{GOLD_REWARDS[`COMPLETE_OBJECTIVE_${timeframe.toUpperCase()}` as keyof typeof GOLD_REWARDS]} Gold
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={!title.trim() || !targetDate}
                  className="w-full"
                >
                  {editingObjective ? 'Salvar Alteracoes' : 'Criar Objetivo'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for adding milestones inline
function MilestoneInput({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-accent hover:text-accent/80 flex items-center gap-1"
      >
        <Plus size={14} />
        Adicionar milestone
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        autoFocus
        className="flex-1 px-3 py-1.5 rounded-lg bg-bg-secondary border border-border text-white text-sm focus:border-accent focus:outline-none"
        placeholder="Nova milestone..."
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm disabled:opacity-50"
      >
        <Plus size={14} />
      </button>
      <button
        onClick={() => {
          setIsOpen(false);
          setValue('');
        }}
        className="px-3 py-1.5 rounded-lg bg-bg-secondary text-gray-400 text-sm hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  );
}
