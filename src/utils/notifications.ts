export interface LevelUpNotification {
  id: string;
  level: number;
  title: string;
  date: string; // YYYY-MM-DD
  read: boolean;
}

const STORAGE_KEY = 'levelup_notifications';

function getNotifications(): LevelUpNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: LevelUpNotification[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

export function addLevelUpNotification(level: number, title: string): void {
  const notifications = getNotifications();
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  notifications.unshift({
    id: `lvl-${level}-${Date.now()}`,
    level,
    title,
    date,
    read: false,
  });

  saveNotifications(notifications);
  window.dispatchEvent(new Event('notifications-updated'));
}

export function getLevelUpNotifications(): LevelUpNotification[] {
  return getNotifications();
}

export function getUnreadCount(): number {
  return getNotifications().filter(n => !n.read).length;
}

export function markAllAsRead(): void {
  const notifications = getNotifications();
  notifications.forEach(n => (n.read = true));
  saveNotifications(notifications);
  window.dispatchEvent(new Event('notifications-updated'));
}
