import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { XPToast } from '@/components/ui/XPToast';
import { ankiSyncService } from '@/services/ankiSyncService';
import { getAnkiConfig } from '@/features/anki/ankiConfig';

export function MainLayout() {
  useEffect(() => {
    const config = getAnkiConfig();
    if (config.enabled) {
      ankiSyncService.startAutoSync();
    }
    return () => ankiSyncService.stopAutoSync();
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary overflow-x-hidden">
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
      <XPToast />
    </div>
  );
}
