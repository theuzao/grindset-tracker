import { useState, useEffect, useRef } from 'react';
import { Bell, Coins, ArrowUp } from 'lucide-react';
import { useCharacter } from '@/database/hooks';
import { getXPProgressInLevel } from '@/features/gamification/constants';
import { StreakBadge } from '@/components/ui/Badge';
import {
  getLevelUpNotifications,
  getUnreadCount,
  markAllAsRead,
  type LevelUpNotification,
} from '@/utils/notifications';

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
}

export function Header({ title, subtitle, rightContent }: HeaderProps) {
  const character = useCharacter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<LevelUpNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const xpProgress = character
    ? getXPProgressInLevel(character.totalXP)
    : { currentLevelXP: 0, requiredXP: 100, percentage: 0 };

  const refreshNotifications = () => {
    setNotifications(getLevelUpNotifications());
    setUnreadCount(getUnreadCount());
  };

  useEffect(() => {
    refreshNotifications();
    window.addEventListener('notifications-updated', refreshNotifications);
    return () => window.removeEventListener('notifications-updated', refreshNotifications);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const handleBellClick = () => {
    if (!showNotifications && unreadCount > 0) {
      markAllAsRead();
    }
    setShowNotifications(!showNotifications);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <header className="h-16 bg-bg-secondary/80 backdrop-blur-sm border-b border-border sticky top-0 z-30">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Title */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
            {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
          </div>
          {rightContent}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {character && (
            <>
              {/* Streak */}
              <StreakBadge streak={character.streak.current} />

              {/* Gold */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Coins size={16} className="text-amber-400" />
                <span className="text-sm font-medium text-amber-400">
                  {character.gold.toLocaleString()}
                </span>
              </div>

              {/* Level & XP Mini */}
              <div className="flex items-center gap-3 px-3 py-1.5 bg-bg-tertiary border border-border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-accent">{character.level}</span>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs text-gray-400">{character.title}</p>
                    <div className="w-20 h-1.5 bg-bg-primary rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${xpProgress.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Notifications */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleBellClick}
              className="p-2 text-gray-400 hover:text-white hover:bg-bg-tertiary rounded-lg transition-colors relative"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-bg-secondary border border-border rounded-xl shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium text-white">Level Ups</p>
                </div>
                <div className="max-h-64 overflow-y-auto scrollbar-thin">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <ArrowUp size={24} className="mx-auto text-gray-600 mb-2" />
                      <p className="text-sm text-gray-500">Nenhum level up ainda</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className="px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-bg-tertiary/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-accent">{n.level}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">
                              Nivel {n.level}
                            </p>
                            <p className="text-xs text-gray-400">{n.title}</p>
                          </div>
                          <span className="text-xs text-gray-500 shrink-0">
                            {formatDate(n.date)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
