import { useState } from 'react';
import { User, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { characterRepository } from '@/database/repositories/characterRepository';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Por favor, insira seu nome');
      return;
    }

    if (name.trim().length < 2) {
      setError('O nome deve ter pelo menos 2 caracteres');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await characterRepository.create(name.trim());
      onComplete();
    } catch (err) {
      setError('Erro ao criar personagem. Tente novamente.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} showCloseButton={false} size="md">
      <div className="text-center">
        {/* Logo */}
        <motion.img
          src="/whitelogo.png"
          alt="GRINDSET"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-20 h-20 mx-auto mb-6 rounded-2xl"
        />

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-white mb-2"
        >
          Bem-vindo ao GRINDSET
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-gray-400 mb-8"
        >
          o cerebro que move o jogo
        </motion.p>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <User size={20} />
            </div>
            <input
              type="text"
              placeholder="Como você quer ser chamado?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-bg-tertiary border border-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all text-center"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isLoading}
          >
            Iniciar Jornada
            <ArrowRight size={20} className="ml-2" />
          </Button>
        </motion.form>

        {/* Features Preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 pt-6 border-t border-border"
        >
          <p className="text-xs text-gray-500 mb-3">O que você poderá fazer:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Trackear Atividades', 'Completar Quests', 'Evoluir Atributos', 'Subir de Nível'].map((feature) => (
              <span
                key={feature}
                className="px-3 py-1 text-xs bg-bg-tertiary border border-border rounded-full text-gray-400"
              >
                {feature}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </Modal>
  );
}
