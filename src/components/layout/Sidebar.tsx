import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Swords,
  Activity,
  Calendar,
  Target,
  BarChart3,
  GraduationCap,
  BookOpen,
  User,
  Settings,
  School,
  LogOut,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/contexts/AuthContext';
import { SyncStatus } from '@/components/ui/SyncStatus';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/' },
  { icon: <Swords size={20} />, label: 'Quests', path: '/quests' },
  { icon: <Activity size={20} />, label: 'Atividades', path: '/activities' },
  { icon: <Calendar size={20} />, label: 'Calendário', path: '/calendar' },
  { icon: <Target size={20} />, label: 'Objetivos', path: '/objectives' },
  { icon: <BarChart3 size={20} />, label: 'Analytics', path: '/analytics' },
  { icon: <GraduationCap size={20} />, label: 'Anki', path: '/anki' },
  { icon: <School size={20} />, label: 'Faculdade', path: '/faculdade' },
  { icon: <BookOpen size={20} />, label: 'Reflexões', path: '/reflections' },
];

const bottomNavItems: NavItem[] = [
  { icon: <User size={20} />, label: 'Personagem', path: '/character' },
  { icon: <Settings size={20} />, label: 'Configurações', path: '/settings' },
];

export function Sidebar() {
  const { user, signOut, isConfigured } = useAuth();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-bg-secondary border-r border-border flex flex-col z-40">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <img src="/whitelogo.png" alt="GRINDSET" className="w-10 h-10 rounded-xl" />
          <div>
            <h1 className="text-lg font-bold text-white">GRINDSET</h1>
            <p className="text-xs text-gray-500">o cérebro que move o jogo</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-gray-400 hover:text-white hover:bg-bg-tertiary'
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="p-3 border-t border-border space-y-1">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-gray-400 hover:text-white hover:bg-bg-tertiary'
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        {/* User info + sync + sign out */}
        {isConfigured && user && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="px-4 py-2 flex items-center gap-2 justify-between">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <SyncStatus compact />
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200"
            >
              <LogOut size={16} />
              <span>Sair</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
