import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getLocalDateString } from '@/database/db';
import { ankiRepository } from '@/database/repositories/ankiRepository';
import { ankiAutoQuestService } from '../ankiAutoQuest';
import { getAnkiConfig } from '../ankiConfig';
import type { AnkiDeck } from '../types';

interface ManualReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  decks: AnkiDeck[];
  preselectedDeck?: string;
}

export function ManualReviewModal({
  isOpen,
  onClose,
  decks,
  preselectedDeck,
}: ManualReviewModalProps) {
  const [deckName, setDeckName] = useState(preselectedDeck ?? '');
  const [cardsReviewed, setCardsReviewed] = useState('');
  const [date, setDate] = useState(getLocalDateString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customDeck, setCustomDeck] = useState('');

  const handleSubmit = async () => {
    const finalDeck = deckName === '__custom__' ? customDeck.trim() : deckName;
    const cards = parseInt(cardsReviewed);

    if (!finalDeck || isNaN(cards) || cards <= 0) return;

    setIsSubmitting(true);
    try {
      await ankiRepository.markManualReview(finalDeck, cards, date);

      // Verificar auto quest
      const config = getAnkiConfig();
      if (config.autoQuest.enabled) {
        await ankiAutoQuestService.checkAndComplete();
      }

      onClose();
      setCardsReviewed('');
      setCustomDeck('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Revisão Manual"
      subtitle="Registrar revisão feita fora do Anki"
      size="sm"
    >
      <div className="space-y-4">
        {/* Deck select */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Matéria / Deck</label>
          <select
            value={deckName}
            onChange={e => setDeckName(e.target.value)}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-white text-sm focus:outline-none focus:border-accent"
          >
            <option value="">Selecionar deck...</option>
            {decks.map(d => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
            <option value="__custom__">Outro (digitar nome)</option>
          </select>
        </div>

        {/* Custom deck name */}
        {deckName === '__custom__' && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nome do deck</label>
            <Input
              value={customDeck}
              onChange={e => setCustomDeck(e.target.value)}
              placeholder="Ex: Matemática"
            />
          </div>
        )}

        {/* Cards reviewed */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Cards revisados</label>
          <Input
            type="number"
            value={cardsReviewed}
            onChange={e => setCardsReviewed(e.target.value)}
            placeholder="Ex: 20"
            min={1}
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Data</label>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={getLocalDateString()}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={
              (!deckName || (deckName === '__custom__' && !customDeck.trim())) ||
              !cardsReviewed ||
              parseInt(cardsReviewed) <= 0
            }
            className="flex-1"
          >
            Registrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
