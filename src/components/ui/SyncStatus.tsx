import React, { useState, useEffect } from 'react';
import {
  useSyncState,
  useOnlineStatus,
  useSyncNow,
  useForceFullSync,
  useSyncManager,
} from '@/database/hooks';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SyncStatusProps {
  /** Mostrar texto descritivo */
  showLabel?: boolean;
  /** Classe CSS personalizada */
  className?: string;
  /** Compact mode (apenas ícone) */
  compact?: boolean;
}

/**
 * Componente que exibe status de sincronização multi-dispositivo
 */
export const SyncStatus: React.FC<SyncStatusProps> = ({
  showLabel = true,
  className = '',
  compact = false,
}) => {
  const syncState = useSyncState();
  const isOnline = useOnlineStatus();
  const { sync, isSyncing: isManualSyncing } = useSyncNow();
  const { forceSync } = useForceFullSync();
  const manager = useSyncManager();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!manager) return;

    const updatePendingCount = async () => {
      const state = manager.getState();
      setPendingCount(state.pendingChanges.length);
    };

    updatePendingCount();

    const unsubscribeSyncStart = manager.on('syncStart', updatePendingCount);
    const unsubscribeSyncEnd = manager.on('syncEnd', updatePendingCount);

    return () => {
      unsubscribeSyncStart();
      unsubscribeSyncEnd();
    };
  }, [manager]);

  const isSyncing = syncState?.isSyncing || isManualSyncing;

  // Determinar status
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: CloudOff,
        label: 'Modo offline',
        color: 'text-gray-500',
        bgColor: 'bg-gray-50',
        description: 'Esperando conexão...',
      };
    }

    if (isSyncing) {
      return {
        icon: RefreshCw,
        label: 'Sincronizando...',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        description: 'Sincronizando dados',
        animate: true,
      };
    }

    if (pendingCount > 0) {
      return {
        icon: AlertCircle,
        label: `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        description: 'Mudanças aguardando sincronização',
      };
    }

    return {
      icon: Cloud,
      label: 'Sincronizado',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Todos os dados sincronizados',
    };
  };

  const status = getStatusInfo();
  const Icon = status.icon;

  if (compact) {
    return (
      <button
        onClick={() => (isOnline && !isSyncing ? sync() : forceSync())}
        disabled={!isOnline || isSyncing}
        title={status.description}
        className={cn(
          'p-2 rounded-lg transition-all hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
      >
        <Icon
          className={cn(
            'w-5 h-5',
            status.color,
            status.animate && 'animate-spin'
          )}
        />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        status.bgColor,
        className
      )}
    >
      <Icon
        className={cn(
          'w-4 h-4 flex-shrink-0',
          status.color,
          status.animate && 'animate-spin'
        )}
      />

      {showLabel && (
        <div className="flex flex-col">
          <span className={cn('text-xs font-medium', status.color)}>
            {status.label}
          </span>
          {!compact && (
            <span className="text-xs text-gray-600">{status.description}</span>
          )}
        </div>
      )}

      {isOnline && !isSyncing && pendingCount > 0 && (
        <button
          onClick={() => sync()}
          className="ml-auto p-1 hover:bg-white rounded transition-colors"
          title="Sincronizar agora"
        >
          <RefreshCw className={cn('w-3 h-3', status.color)} />
        </button>
      )}
    </div>
  );
};

/**
 * Componente que exibe alertas de conflito
 */
export interface ConflictAlertProps {
  /** Callback quando o usuário resolve o conflito */
  onResolve?: () => void;
  className?: string;
}

export const SyncConflictAlert: React.FC<ConflictAlertProps> = ({
  onResolve,
  className = '',
}) => {
  const [conflicts, setConflicts] = React.useState<any[]>([]);
  const manager = useSyncManager();

  React.useEffect(() => {
    if (!manager) return;

    const unsubscribe = manager.on('conflict', (conflict: any) => {
      setConflicts((prev) => [...prev, conflict]);
      console.warn('⚠️ Conflito detectado:', conflict);
    });

    return unsubscribe;
  }, [manager]);

  if (conflicts.length === 0) return null;

  return (
    <div
      className={cn(
        'bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3',
        className
      )}
    >
      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="font-medium text-yellow-900">
          {conflicts.length} conflito{conflicts.length > 1 ? 's' : ''} detectado
          {conflicts.length > 1 ? 's' : ''}
        </h3>
        <p className="text-sm text-yellow-800 mt-1">
          Foram detectadas sincronizações conflitantes. As informações mais
          recentes foram mantidas.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              setConflicts([]);
              onResolve?.();
            }}
            className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Componente de display de atualizações remotas
 */
export interface RemoteUpdateIndicatorProps {
  className?: string;
}

export const RemoteUpdateIndicator: React.FC<RemoteUpdateIndicatorProps> = ({
  className = '',
}) => {
  const syncState = useSyncState();
  const [showUpdate, setShowUpdate] = React.useState(false);

  React.useEffect(() => {
    // Mostrar notificação quando dados remotos forem recebidos
    if (syncState?.isSyncing === false) {
      setShowUpdate(true);
      const timer = setTimeout(() => setShowUpdate(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [syncState?.lastFullSyncTimestamp]);

  if (!showUpdate) return null;

  return (
    <div
      className={cn(
        'bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 animate-in fade-in slide-in-from-top',
        className
      )}
    >
      <Cloud className="w-4 h-4 text-green-600" />
      <span className="text-sm text-green-700 font-medium">
        Dados atualizados de outros dispositivos
      </span>
    </div>
  );
};

export default SyncStatus;
