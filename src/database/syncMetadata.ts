/**
 * Sistema de rastreamento de metadados de sincronização
 * Controla versionamento, timestamps e status de sincronização
 */

export interface SyncMetadata {
  entityId: string;
  table: string;
  localVersion: number;
  remoteVersion: number;
  lastLocalChange: string; // ISO timestamp
  lastRemoteChange: string; // ISO timestamp
  lastSyncAttempt?: string;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflict';
  conflictResolution?: 'local-wins' | 'remote-wins' | 'merged';
}

export interface SyncChange {
  id: string;
  table: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, any>;
  timestamp: string;
  synced: boolean;
  deviceId: string;
}

export interface SyncState {
  lastFullSyncTimestamp?: string;
  pendingChanges: SyncChange[];
  deviceId: string;
  userId?: string;
  isOnline: boolean;
  isSyncing: boolean;
}

/**
 * Gera um ID de dispositivo único
 */
export function generateDeviceId(): string {
  const stored = localStorage.getItem('app_device_id');
  if (stored) return stored;

  const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('app_device_id', deviceId);
  return deviceId;
}

/**
 * Compara duas versões de metadados
 * Retorna: -1 (local é mais novo), 0 (iguais), 1 (remoto é mais novo)
 */
export function compareVersions(
  localMeta: SyncMetadata,
  remoteMeta: SyncMetadata
): -1 | 0 | 1 {
  // Comparar versões numéricas
  if (localMeta.localVersion > remoteMeta.remoteVersion) return -1;
  if (localMeta.localVersion < remoteMeta.remoteVersion) return 1;

  // Se versões iguais, comparar timestamps
  const localTime = new Date(localMeta.lastLocalChange).getTime();
  const remoteTime = new Date(remoteMeta.lastRemoteChange).getTime();

  if (localTime > remoteTime) return -1;
  if (localTime < remoteTime) return 1;

  return 0;
}

/**
 * Incrementa versão local
 */
export function incrementLocalVersion(meta: SyncMetadata): SyncMetadata {
  return {
    ...meta,
    localVersion: meta.localVersion + 1,
    lastLocalChange: new Date().toISOString(),
    syncStatus: 'pending',
  };
}

/**
 * Atualiza metadados após sincronização bem-sucedida
 */
export function markAsSynced(meta: SyncMetadata): SyncMetadata {
  return {
    ...meta,
    remoteVersion: meta.localVersion,
    lastRemoteChange: meta.lastLocalChange,
    lastSyncAttempt: new Date().toISOString(),
    syncStatus: 'synced',
  };
}

/**
 * Marca como conflito
 */
export function markAsConflict(
  localMeta: SyncMetadata,
  remoteMeta: SyncMetadata,
  resolution: 'local-wins' | 'remote-wins' | 'merged'
): SyncMetadata {
  return {
    ...localMeta,
    syncStatus: 'conflict',
    conflictResolution: resolution,
    lastSyncAttempt: new Date().toISOString(),
  };
}

/**
 * Cria uma nova entrada de metadados
 */
export function createSyncMetadata(
  entityId: string,
  table: string,
  isNew: boolean = true
): SyncMetadata {
  const now = new Date().toISOString();
  return {
    entityId,
    table,
    localVersion: isNew ? 0 : 1,
    remoteVersion: isNew ? -1 : 1,
    lastLocalChange: now,
    lastRemoteChange: isNew ? '' : now,
    syncStatus: 'pending',
  };
}

/**
 * Cria mudança para rastreamento
 */
export function createSyncChange(
  id: string,
  table: string,
  operation: 'create' | 'update' | 'delete',
  data: Record<string, any>,
  deviceId: string
): SyncChange {
  return {
    id: `${id}_${Date.now()}`,
    table,
    operation,
    data,
    timestamp: new Date().toISOString(),
    synced: false,
    deviceId,
  };
}
