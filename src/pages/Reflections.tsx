import { useState } from 'react';
import { BookOpen, Plus, Pin, Search, X, Edit3, Trash2, Lightbulb, Heart, Calendar, Brain, Tag, Clock } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useReflections } from '@/database/hooks';
import { reflectionRepository } from '@/database/repositories/reflectionRepository';
import { XP_REWARDS } from '@/features/gamification/constants';
import type { Reflection, ReflectionType, MoodLevel } from '@/types';

type TabFilter = 'all' | ReflectionType | 'pinned';

const TYPE_CONFIG: Record<ReflectionType, { label: string; icon: React.ReactNode; color: string }> = {
  daily: { label: 'Diaria', icon: <Calendar size={14} />, color: '#6366F1' },
  weekly: { label: 'Semanal', icon: <Clock size={14} />, color: '#8B5CF6' },
  learning: { label: 'Aprendizado', icon: <Brain size={14} />, color: '#14B8A6' },
  gratitude: { label: 'Gratidao', icon: <Heart size={14} />, color: '#EC4899' },
  insight: { label: 'Insight', icon: <Lightbulb size={14} />, color: '#F59E0B' },
};

const MOOD_OPTIONS: { value: MoodLevel; label: string; emoji: string }[] = [
  { value: 'excellent', label: 'Excelente', emoji: '🌟' },
  { value: 'good', label: 'Bom', emoji: '😊' },
  { value: 'neutral', label: 'Neutro', emoji: '😐' },
  { value: 'challenging', label: 'Desafiador', emoji: '😓' },
  { value: 'difficult', label: 'Dificil', emoji: '😔' },
];

export function Reflections() {
  const reflections = useReflections(50);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingReflection, setEditingReflection] = useState<Reflection | null>(null);
  const [viewingReflection, setViewingReflection] = useState<Reflection | null>(null);

  // Form state
  const [type, setType] = useState<ReflectionType>('insight');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<MoodLevel | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'pinned', label: 'Fixadas' },
    { key: 'insight', label: 'Insights' },
    { key: 'learning', label: 'Aprendizados' },
    { key: 'daily', label: 'Diarias' },
    { key: 'gratitude', label: 'Gratidao' },
  ];

  const filteredReflections = reflections?.filter(r => {
    // Filter by tab
    if (activeTab === 'pinned') {
      if (!r.isPinned) return false;
    } else if (activeTab !== 'all') {
      if (r.type !== activeTab) return false;
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        r.content.toLowerCase().includes(query) ||
        r.title?.toLowerCase().includes(query) ||
        r.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    return true;
  }) ?? [];

  const pinnedReflections = reflections?.filter(r => r.isPinned) ?? [];

  const resetForm = () => {
    setType('insight');
    setTitle('');
    setContent('');
    setMood(undefined);
    setTags([]);
    setNewTag('');
    setIsPinned(false);
    setEditingReflection(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (reflection: Reflection) => {
    setEditingReflection(reflection);
    setType(reflection.type);
    setTitle(reflection.title || '');
    setContent(reflection.content);
    setMood(reflection.mood);
    setTags(reflection.tags);
    setIsPinned(reflection.isPinned || false);
    setShowModal(true);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    try {
      if (editingReflection) {
        await reflectionRepository.update(editingReflection.id, {
          type,
          title: title.trim() || undefined,
          content: content.trim(),
          mood,
          tags,
          isPinned,
        });
      } else {
        await reflectionRepository.create({
          type,
          title: title.trim() || undefined,
          content: content.trim(),
          mood,
          tags,
          isPinned,
        });
      }
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving reflection:', error);
    }
  };

  const handleTogglePin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await reflectionRepository.togglePin(id);
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta reflexao?')) {
      try {
        await reflectionRepository.delete(id);
        setViewingReflection(null);
      } catch (error) {
        console.error('Error deleting reflection:', error);
      }
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Reflexoes"
        subtitle="Notas, aprendizados e insights"
      />

      <div className="p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center p-4">
            <BookOpen size={24} className="mx-auto text-accent mb-2" />
            <div className="text-2xl font-bold text-white">{reflections?.length ?? 0}</div>
            <div className="text-xs text-gray-400">Total</div>
          </Card>
          <Card className="text-center p-4">
            <Pin size={24} className="mx-auto text-amber-400 mb-2" />
            <div className="text-2xl font-bold text-white">{pinnedReflections.length}</div>
            <div className="text-xs text-gray-400">Fixadas</div>
          </Card>
          <Card className="text-center p-4">
            <Lightbulb size={24} className="mx-auto text-yellow-400 mb-2" />
            <div className="text-2xl font-bold text-white">
              {reflections?.filter(r => r.type === 'insight').length ?? 0}
            </div>
            <div className="text-xs text-gray-400">Insights</div>
          </Card>
          <Card className="text-center p-4">
            <Brain size={24} className="mx-auto text-green-400 mb-2" />
            <div className="text-2xl font-bold text-white">
              {reflections?.filter(r => r.type === 'learning').length ?? 0}
            </div>
            <div className="text-xs text-gray-400">Aprendizados</div>
          </Card>
        </div>

        {/* Search & New */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar reflexoes..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-secondary border border-border text-white focus:border-accent focus:outline-none"
            />
          </div>
          <Button onClick={openNewModal}>
            <Plus size={16} className="mr-2" />
            Nova Reflexao
          </Button>
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

        {/* Reflections Grid */}
        {filteredReflections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReflections.map(reflection => {
              const typeConfig = TYPE_CONFIG[reflection.type];
              const isPinned = reflection.isPinned;

              return (
                <Card
                  key={reflection.id}
                  className={`cursor-pointer transition-all hover:border-accent/50 ${
                    isPinned ? 'border-amber-500/30 bg-amber-500/5' : ''
                  }`}
                  onClick={() => setViewingReflection(reflection)}
                >
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="p-1.5 rounded"
                          style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}
                        >
                          {typeConfig.icon}
                        </span>
                        {reflection.title && (
                          <h3 className="font-medium text-white line-clamp-1">{reflection.title}</h3>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleTogglePin(reflection.id, e)}
                        className={`p-1 rounded transition-colors ${
                          isPinned ? 'text-amber-400' : 'text-gray-500 hover:text-amber-400'
                        }`}
                      >
                        <Pin size={14} fill={isPinned ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    {/* Content Preview */}
                    <p className="text-sm text-gray-400 line-clamp-3 mb-3">{reflection.content}</p>

                    {/* Tags */}
                    {reflection.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {reflection.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs bg-bg-primary rounded text-gray-400"
                          >
                            #{tag}
                          </span>
                        ))}
                        {reflection.tags.length > 3 && (
                          <span className="text-xs text-gray-500">+{reflection.tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{formatDate(reflection.date)}</span>
                      <span style={{ color: typeConfig.color }}>{typeConfig.label}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <BookOpen size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400 mb-4">
                  {searchQuery ? 'Nenhuma reflexao encontrada' : 'Nenhuma reflexao registrada'}
                </p>
                <Button onClick={openNewModal}>
                  <Plus size={16} className="mr-2" />
                  Escrever Primeira Reflexao
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* XP Info */}
        <Card variant="glow">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <h3 className="font-medium text-white">Ganhe XP escrevendo</h3>
              <p className="text-sm text-gray-400">Cada reflexao da +{XP_REWARDS.WRITE_REFLECTION} XP</p>
            </div>
            <div className="text-2xl font-bold text-accent">+{XP_REWARDS.WRITE_REFLECTION} XP</div>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            resetForm();
          }}
          title={editingReflection ? 'Editar Reflexao' : 'Nova Reflexao'}
          size="lg"
        >
          <div className="space-y-4">
            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Tipo</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TYPE_CONFIG) as ReflectionType[]).map(t => {
                  const config = TYPE_CONFIG[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        type === t
                          ? 'border-accent bg-accent/10'
                          : 'border-border hover:border-gray-500'
                      }`}
                      style={type === t ? { borderColor: config.color, backgroundColor: `${config.color}15` } : {}}
                    >
                      <span style={{ color: config.color }}>{config.icon}</span>
                      <span className={type === t ? 'text-white' : 'text-gray-400'}>{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Titulo (opcional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titulo da reflexao..."
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border text-white focus:border-accent focus:outline-none"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Conteudo *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escreva sua reflexao..."
                rows={6}
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border text-white focus:border-accent focus:outline-none resize-none"
              />
            </div>

            {/* Mood */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Como voce esta?</label>
              <div className="flex gap-2">
                {MOOD_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setMood(mood === option.value ? undefined : option.value)}
                    className={`flex-1 p-2 rounded-lg border transition-all text-center ${
                      mood === option.value
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-gray-500'
                    }`}
                  >
                    <span className="text-xl">{option.emoji}</span>
                    <p className="text-xs text-gray-400 mt-1">{option.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2 py-1 bg-bg-tertiary rounded text-sm text-gray-300"
                  >
                    <Tag size={12} />
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="text-gray-500 hover:text-red-400">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="Adicionar tag..."
                  className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-white text-sm focus:border-accent focus:outline-none"
                />
                <Button size="sm" onClick={handleAddTag} disabled={!newTag.trim()}>
                  <Plus size={14} />
                </Button>
              </div>
            </div>

            {/* Pin */}
            <label className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="w-4 h-4 rounded border-gray-500 text-accent focus:ring-accent"
              />
              <div>
                <span className="text-white">Fixar no topo</span>
                <p className="text-xs text-gray-500">Aparece no dashboard e no topo da lista</p>
              </div>
            </label>

            {/* XP Preview */}
            {!editingReflection && (
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 text-center">
                <span className="text-accent font-bold">+{XP_REWARDS.WRITE_REFLECTION} XP</span>
                <span className="text-gray-400 text-sm ml-2">ao salvar</span>
              </div>
            )}

            {/* Submit */}
            <Button onClick={handleSubmit} disabled={!content.trim()} className="w-full">
              {editingReflection ? 'Salvar Alteracoes' : 'Criar Reflexao'}
            </Button>
          </div>
        </Modal>
      )}

      {/* View Modal */}
      {viewingReflection && (
        <Modal
          isOpen={true}
          onClose={() => setViewingReflection(null)}
          title={viewingReflection.title || TYPE_CONFIG[viewingReflection.type].label}
          size="lg"
        >
          <div className="space-y-4">
            {/* Type & Date */}
            <div className="flex items-center justify-between">
              <span
                className="flex items-center gap-1 px-2 py-1 rounded text-sm font-medium"
                style={{
                  backgroundColor: `${TYPE_CONFIG[viewingReflection.type].color}20`,
                  color: TYPE_CONFIG[viewingReflection.type].color,
                }}
              >
                {TYPE_CONFIG[viewingReflection.type].icon}
                {TYPE_CONFIG[viewingReflection.type].label}
              </span>
              <span className="text-sm text-gray-500">
                {new Date(viewingReflection.date).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {/* Mood */}
            {viewingReflection.mood && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Humor:</span>
                <span className="text-lg">
                  {MOOD_OPTIONS.find(m => m.value === viewingReflection.mood)?.emoji}
                </span>
                <span className="text-sm text-white">
                  {MOOD_OPTIONS.find(m => m.value === viewingReflection.mood)?.label}
                </span>
              </div>
            )}

            {/* Content */}
            <div className="p-4 rounded-lg bg-bg-tertiary">
              <p className="text-gray-300 whitespace-pre-wrap">{viewingReflection.content}</p>
            </div>

            {/* Tags */}
            {viewingReflection.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {viewingReflection.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-sm bg-bg-tertiary rounded text-gray-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button variant="secondary" className="flex-1" onClick={() => openEditModal(viewingReflection)}>
                <Edit3 size={14} className="mr-2" />
                Editar
              </Button>
              <Button variant="danger" onClick={() => handleDelete(viewingReflection.id)}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
