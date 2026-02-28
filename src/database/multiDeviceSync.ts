/**
 * Sistema de sincronização multi-dispositivo
 * Gerencia sincronização offline-first entre local (Dexie) e remoto (Supabase)
 */

import { db } from './db';
import { getSupabaseClient, isSupabaseAvailable } from '@/services/supabaseClient';
import type { SyncMetadata, SyncState } from './syncMetadata';
import {
  generateDeviceId,
  compareVersions,
  incrementLocalVersion,
  createSyncChange,
  createSyncMetadata,
  markAsSynced,
  markAsConflict,
} from './syncMetadata';
import {
  ConflictResolver,
  validateSyncData,
} from './conflictResolver';

export const SYNC_CONFIG = {
  ENABLED: import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true',
  INTERVAL: parseInt(import.meta.env.VITE_SYNC_INTERVAL || '30000', 10),
  CONFLICT_STRATEGY: import.meta.env.VITE_CONFLICT_RESOLUTION || 'last-write-wins',
  BATCH_SIZE: 50,
  MAX_RETRIES: 3,
};

export class MultiDeviceSyncManager {
  private deviceId: string;
  private userId?: string;
  private syncState: SyncState;
  private isOnline: boolean = navigator.onLine;
  private syncIntervalId?: number;
  private conflictResolver: ConflictResolver;
  private syncInProgress: boolean = false;
  private listeners: Map<'syncStart' | 'syncEnd' | 'conflict' | 'error', Set<Function>> = new Map();

  // Tabelas para sincronização
  private tables: string[] = [
    'character',
    'activities',
    'quests',
    'objectives',
    'reflections',
    'achievements',
    'xpEvents',
    'activityGoals',
    'debuffs',
    'customCategories',
    'checkIns',
    'ankiDecks',
    'ankiReviews',
    'subjects',
    'subjectTopics',
  ];

  constructor() {
    this.deviceId = generateDeviceId();
    this.conflictResolver = new ConflictResolver(
      SYNC_CONFIG.CONFLICT_STRATEGY as any
    );
    this.syncState = {
      deviceId: this.deviceId,
      pendingChanges: [],
      isOnline: this.isOnline,
      isSyncing: false,
    };

    if (!SYNC_CONFIG.ENABLED) {
      console.log('🔒 Sincronização multi-dispositivo desabilitada');
      return;
    }

    this.setupNetworkListeners();
    this.startPeriodicSync();
  }

  /**
   * Inicializa o gerenciador com ID de usuário
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    this.syncState.userId = userId;

    if (!isSupabaseAvailable()) {
      console.warn('⚠️ Supabase não disponível, sincronização desabilitada');
      return;
    }

    // Executar sincronização inicial
    await this.sync();
  }

  /**
   * Configura listeners de conectividade
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('🔗 Conectado à internet');
      this.isOnline = true;
      this.syncState.isOnline = true;
      this.sync();
    });

    window.addEventListener('offline', () => {
      console.log('🔌 Desconectado da internet');
      this.isOnline = false;
      this.syncState.isOnline = false;
    });
  }

  /**
   * Inicia sincronização periódica
   */
  private startPeriodicSync(): void {
    if (this.syncIntervalId) clearInterval(this.syncIntervalId);

    this.syncIntervalId = window.setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.sync();
      }
    }, SYNC_CONFIG.INTERVAL);
  }

  /**
   * Para sincronização periódica
   */
  stop(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
    }
  }

  /**
   * Sincronização principal
   */
  async sync(): Promise<boolean> {
    if (!isSupabaseAvailable() || !this.userId || this.syncInProgress) {
      return false;
    }

    this.syncInProgress = true;
    this.emit('syncStart');

    try {
      console.log(`🔄 Iniciando sincronização (dispositivo: ${this.deviceId})`);

      // 1. Enviar mudanças locais para servidor
      await this.pushLocalChanges();

      // 2. Buscar mudanças remotas
      await this.pullRemoteChanges();

      // 3. Resolver conflitos
      await this.resolveConflicts();

      console.log('✅ Sincronização concluída com sucesso');
      this.emit('syncEnd', { success: true });
      return true;
    } catch (error) {
      console.error('❌ Erro durante sincronização:', error);
      this.emit('syncEnd', { success: false, error });
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Envia mudanças locais para servidor
   */
  private async pushLocalChanges(): Promise<void> {
    if (!this.userId) return;

    const client = getSupabaseClient();
    if (!client) return;

    // Buscar mudanças pendentes (filter evita problema com boolean index no IndexedDB)
    const changes = await db.syncChanges
      .filter((c) => !c.synced)
      .toArray();

    if (changes.length === 0) return;

    console.log(`📤 Enviando ${changes.length} mudanças locais...`);

    // Processar em lotes
    for (let i = 0; i < changes.length; i += SYNC_CONFIG.BATCH_SIZE) {
      const batch = changes.slice(i, i + SYNC_CONFIG.BATCH_SIZE);

      for (const change of batch) {
        try {
          // Validar dados
          const validation = validateSyncData(change.data as { id: string });
          if (!validation.valid) {
            console.error(
              `❌ Dados inválidos para ${change.table}:`,
              validation.errors
            );
            await db.syncChanges.update(change.id, { synced: true });
            continue;
          }

          // Buscar metadados
          const metadata = await db.syncMetadata.get([
            change.data.id,
            change.table,
          ]);

          // Enviar para Supabase baseado na operação
          if (change.operation === 'delete') {
            const { error } = await client
              .from(change.table)
              .delete()
              .eq('id', change.data.id)
              .eq('user_id', this.userId);

            if (!error) {
              await db.syncChanges.update(change.id, { synced: true });
              if (metadata)
                await db.syncMetadata.delete([change.data.id, change.table]);
            }
          } else {
            const payload = {
              ...change.data,
              user_id: this.userId,
              updated_at: new Date().toISOString(),
            };

            const { error } = await client
              .from(change.table)
              .upsert(payload, { onConflict: 'id' })
              .select()
              .single();

            if (!error) {
              // Marcar como sincronizado
              await db.syncChanges.update(change.id, { synced: true });

              // Atualizar metadados
              if (metadata) {
                await db.syncMetadata.update(
                  [change.data.id, change.table],
                  markAsSynced(metadata)
                );
              }
            }
          }
        } catch (error) {
          console.error(`Erro ao enviar mudança:`, error);
        }
      }
    }
  }

  /**
   * Busca mudanças remotas
   */
  private async pullRemoteChanges(): Promise<void> {
    if (!this.userId) return;

    const client = getSupabaseClient();
    if (!client) return;

    console.log(`📥 Buscando mudanças remotas...`);

    // Buscar timestamp da última sincronização
    const lastSync = this.syncState.lastFullSyncTimestamp;

    for (const table of this.tables) {
      try {
        let query = client
          .from(table)
          .select('*')
          .eq('user_id', this.userId)
          .order('updated_at', { ascending: false })
          .limit(SYNC_CONFIG.BATCH_SIZE);

        if (lastSync) {
          query = query.gt('updated_at', lastSync);
        }

        const { data, error } = await query;

        if (error) {
          console.error(`Erro ao buscar ${table}:`, error);
          continue;
        }

        if (!data || data.length === 0) continue;

        // Processar cada registro remoto
        for (const remoteRecord of data) {
          await this.mergeRemoteRecord(table, remoteRecord);
        }
      } catch (error) {
        console.error(`Exceção ao buscar ${table}:`, error);
      }
    }

    // Atualizar timestamp
    this.syncState.lastFullSyncTimestamp = new Date().toISOString();
  }

  /**
   * Mescla um registro remoto com o local
   */
  private async mergeRemoteRecord(
    table: string,
    remoteRecord: any
  ): Promise<void> {
    const collection = (db as any)[table];
    if (!collection) return;

    const localRecord = await collection.get(remoteRecord.id);
    const remoteMeta = await db.syncMetadata.get([
      remoteRecord.id,
      table,
    ]);

    if (!localRecord) {
      // Inserir novo registro
      await collection.put({
        ...remoteRecord,
        updatedAt: remoteRecord.updated_at || new Date().toISOString(),
      });

      // Crear metadata
      const meta = createSyncMetadata(remoteRecord.id, table, false);
      await db.syncMetadata.put(meta);
    } else {
      // Verificar conflito
      const localMeta = await db.syncMetadata.get([
        localRecord.id,
        table,
      ]);

      if (
        localMeta &&
        remoteMeta &&
        ConflictResolver.hasConflict(
          localRecord,
          remoteRecord,
          localMeta,
          remoteMeta
        )
      ) {
        // Resolver conflito
        const resolution = this.conflictResolver.resolve({
          entityId: remoteRecord.id,
          table,
          localData: localRecord,
          remoteData: remoteRecord,
          localMeta,
          remoteMeta,
        });

        const mergedData = {
          ...resolution.data,
          updatedAt: new Date().toISOString(),
        };

        await collection.put(mergedData);

        const updatedMeta = markAsConflict(
          localMeta,
          remoteMeta,
          resolution.strategy as any
        );
        await db.syncMetadata.put(updatedMeta);

        this.emit('conflict', {
          table,
          id: remoteRecord.id,
          reason: resolution.reason,
        });
      } else {
        // Sem conflito, usar versão mais recente
        const versionComparison = localMeta && remoteMeta
          ? compareVersions(localMeta, remoteMeta)
          : 1; // Favorecer remoto se não há metadados

        if (versionComparison < 0) {
          // Local é mais novo, não atualizar
          return;
        }

        // Atualizar com versão remota
        await collection.put({
          ...remoteRecord,
          updatedAt: remoteRecord.updated_at || new Date().toISOString(),
        });

        if (!remoteMeta) {
          const meta = createSyncMetadata(remoteRecord.id, table, false);
          await db.syncMetadata.put(meta);
        }
      }
    }
  }

  /**
   * Resolve conflitos pendentes
   */
  private async resolveConflicts(): Promise<void> {
    const conflicts = await db.syncMetadata
      .where('syncStatus')
      .equals('conflict')
      .toArray();

    if (conflicts.length === 0) return;

    console.log(`⚠️ Resolvendo ${conflicts.length} conflito(s)...`);

    for (const meta of conflicts) {
      const collection = (db as any)[meta.table];
      if (!collection) continue;

      const record = await collection.get(meta.entityId);
      if (record) {
        // Aplicar a estratégia de resolução novamente
        const updated = {
          ...record,
          updatedAt: new Date().toISOString(),
        };

        await collection.put(updated);

        const resolved = {
          ...meta,
          syncStatus: 'synced' as const,
        };

        await db.syncMetadata.put(resolved);
      }
    }
  }

  /**
   * Registra uma mudança local
   */
  async recordChange(
    table: string,
    operation: 'create' | 'update' | 'delete',
    data: Record<string, any>
  ): Promise<void> {
    const change = createSyncChange(
      data.id,
      table,
      operation,
      data,
      this.deviceId
    );

    await db.syncChanges.add(change);

    // Incrementar versão local
    const meta = await db.syncMetadata.get([data.id, table]);
    if (meta) {
      await db.syncMetadata.put(incrementLocalVersion(meta));
    } else {
      const newMeta = createSyncMetadata(data.id, table, true);
      await db.syncMetadata.put(incrementLocalVersion(newMeta));
    }

    // Sincronizar se online
    if (this.isOnline) {
      await this.sync();
    }
  }

  /**
   * Obtém estado de sincronização
   */
  getState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Obtém status de um registro específico
   */
  async getRecordSyncStatus(
    table: string,
    id: string
  ): Promise<SyncMetadata | undefined> {
    return db.syncMetadata.get([id, table]);
  }

  /**
   * Limpa mudanças sincronizadas
   */
  async cleanupSyncedChanges(): Promise<number> {
    const toDelete = await db.syncChanges.filter((c) => c.synced).primaryKeys();
    const count = toDelete.length;
    await db.syncChanges.bulkDelete(toDelete);

    console.log(`🗑️ Removidos ${count} registros de sincronização`);
    return count;
  }

  /**
   * Registra listener para eventos de sincronização
   */
  on(
    event: 'syncStart' | 'syncEnd' | 'conflict' | 'error',
    callback: Function
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    // Retornar função para desregistrar
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event as any);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  /**
   * Força sincronização completa
   */
  async forceFullSync(): Promise<boolean> {
    this.syncState.lastFullSyncTimestamp = undefined;
    return this.sync();
  }
}

// Instância global do gerenciador
let syncManager: MultiDeviceSyncManager | null = null;

export function getSyncManager(): MultiDeviceSyncManager {
  if (!syncManager) {
    syncManager = new MultiDeviceSyncManager();
  }
  return syncManager;
}

export function initializeSyncManager(userId: string): Promise<void> {
  const manager = getSyncManager();
  return manager.initialize(userId);
}
