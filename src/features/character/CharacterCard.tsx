import { User, Flame, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { XPProgressBar } from '@/components/ui/ProgressBar';
import { StreakBadge } from '@/components/ui/Badge';
import { AttributeRadar } from '@/components/charts/AttributeRadar';
import { getXPProgressInLevel } from '@/features/gamification/constants';
import type { Character } from '@/types';

interface CharacterCardProps {
  character: Character;
  showRadar?: boolean;
}

export function CharacterCard({ character, showRadar = true }: CharacterCardProps) {
  const xpProgress = getXPProgressInLevel(character.totalXP);

  return (
    <Card variant="glow" className="overflow-hidden">
      {/* Header com gradiente */}
      <div className="relative h-24 -mx-4 -mt-4 mb-4 bg-gradient-to-r from-accent/20 via-accent/10 to-transparent">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-5" />
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Avatar e Info */}
        <div className="flex-shrink-0">
          <div className="relative">
            {/* Avatar Circle */}
            <div className="w-20 h-20 rounded-full bg-bg-tertiary border-2 border-accent/30 flex items-center justify-center shadow-glow-sm">
              <User size={40} className="text-accent" />
            </div>
            {/* Level Badge */}
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-sm shadow-lg">
              {character.level}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Nome e Título */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h2 className="text-xl font-bold text-white truncate">{character.name}</h2>
              <p className="text-sm text-accent">{character.title}</p>
            </div>
            <StreakBadge streak={character.streak.current} />
          </div>

          {/* XP Progress */}
          <XPProgressBar
            currentXP={xpProgress.currentLevelXP}
            requiredXP={xpProgress.requiredXP}
            level={character.level}
            className="mb-4"
          />

          {/* Stats Row */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp size={16} className="text-accent" />
              <span className="text-gray-400">Total XP:</span>
              <span className="text-white font-medium">{character.totalXP.toLocaleString()}</span>
            </div>
            {character.streak.longest > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Flame size={16} className="text-orange-400" />
                <span className="text-gray-400">Recorde:</span>
                <span className="text-white font-medium">{character.streak.longest} dias</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Radar de Atributos */}
      {showRadar && (
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Attribute Balance</h3>
          <AttributeRadar attributes={character.attributes} size="md" />
        </div>
      )}
    </Card>
  );
}

interface CharacterMiniCardProps {
  character: Character;
}

export function CharacterMiniCard({ character }: CharacterMiniCardProps) {
  const xpProgress = getXPProgressInLevel(character.totalXP);

  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-bg-tertiary border border-accent/30 flex items-center justify-center">
            <User size={24} className="text-accent" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xs">
            {character.level}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white truncate">{character.name}</h3>
            <StreakBadge streak={character.streak.current} />
          </div>
          <p className="text-xs text-accent mb-1">{character.title}</p>
          <div className="w-full h-1 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full"
              style={{ width: `${xpProgress.percentage}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
