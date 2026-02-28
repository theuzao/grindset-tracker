/**
 * Sistema de resolução de conflitos para sincronização multi-dispositivo
 * Implementa várias estratégias de resolução
 */

import type { SyncMetadata } from './syncMetadata';
import { compareVersions } from './syncMetadata';

export type ConflictResolutionStrategy =
  | 'last-write-wins'
  | 'local-wins'
  | 'remote-wins'
  | 'merge'
  | 'manual';

export interface ConflictResolutionResult<T> {
  resolved: boolean;
  strategy: ConflictResolutionStrategy;
  data: T;
  shouldUpdate: boolean;
  reason: string;
}

export interface ConflictDetails<T> {
  entityId: string;
  table: string;
  localData: T;
  remoteData: T;
  localMeta: SyncMetadata;
  remoteMeta: SyncMetadata;
}

/**
 * Resolvedor principal de conflitos
 */
export class ConflictResolver {
  private strategy: ConflictResolutionStrategy;

  constructor(strategy: ConflictResolutionStrategy = 'last-write-wins') {
    this.strategy = strategy;
  }

  /**
   * Detecta se há conflito
   */
  static hasConflict<T>(
    localData: T,
    remoteData: T,
    localMeta: SyncMetadata,
    remoteMeta: SyncMetadata
  ): boolean {
    // Não há conflito se uma versão é claramente mais antiga
    const versionComparison = compareVersions(localMeta, remoteMeta);
    if (versionComparison !== 0) return false;

    // Se versões são iguais mas dados diferem, é conflito
    return JSON.stringify(localData) !== JSON.stringify(remoteData);
  }

  /**
   * Resolve conflito usando estratégia configurada
   */
  resolve<T>(conflict: ConflictDetails<T>): ConflictResolutionResult<T> {
    switch (this.strategy) {
      case 'last-write-wins':
        return this.resolveLastWriteWins(conflict);
      case 'local-wins':
        return this.resolveLocalWins(conflict);
      case 'remote-wins':
        return this.resolveRemoteWins(conflict);
      case 'merge':
        return this.resolveMerge(conflict);
      case 'manual':
        return this.resolveManual(conflict);
      default:
        return this.resolveLastWriteWins(conflict);
    }
  }

  /**
   * Last-write-wins: versão mais recente vence
   */
  private resolveLastWriteWins<T>(
    conflict: ConflictDetails<T>
  ): ConflictResolutionResult<T> {
    const localTime = new Date(conflict.localMeta.lastLocalChange).getTime();
    const remoteTime = new Date(
      conflict.remoteMeta.lastRemoteChange
    ).getTime();

    const isLocalNewer = localTime > remoteTime;

    return {
      resolved: true,
      strategy: 'last-write-wins',
      data: isLocalNewer ? conflict.localData : conflict.remoteData,
      shouldUpdate: !isLocalNewer,
      reason: `Usando versão ${isLocalNewer ? 'local' : 'remota'} (mais recente: ${new Date(
        Math.max(localTime, remoteTime)
      ).toISOString()})`,
    };
  }

  /**
   * Local wins: manter dados locais
   */
  private resolveLocalWins<T>(
    conflict: ConflictDetails<T>
  ): ConflictResolutionResult<T> {
    return {
      resolved: true,
      strategy: 'local-wins',
      data: conflict.localData,
      shouldUpdate: false,
      reason: 'Mantendo versão local conforme política',
    };
  }

  /**
   * Remote wins: usar dados remotos
   */
  private resolveRemoteWins<T>(
    conflict: ConflictDetails<T>
  ): ConflictResolutionResult<T> {
    return {
      resolved: true,
      strategy: 'remote-wins',
      data: conflict.remoteData,
      shouldUpdate: true,
      reason: 'Usando versão remota conforme política',
    };
  }

  /**
   * Merge: tenta mesclar dados (para objetos)
   */
  private resolveMerge<T>(
    conflict: ConflictDetails<T>
  ): ConflictResolutionResult<T> {
    const local = conflict.localData as Record<string, any>;
    const remote = conflict.remoteData as Record<string, any>;

    // Não é um objeto, usar last-write-wins
    if (typeof local !== 'object' || typeof remote !== 'object') {
      return this.resolveLastWriteWins(conflict);
    }

    const merged: Record<string, any> = { ...remote };

    // Priorizar campos locais modificados recentemente
    for (const key in local) {
      if (key.startsWith('_')) continue; // Ignorar campos internos

      const localValue = local[key];
      const remoteValue = remote[key];

      // Se valores são primitivos diferentes, usar valor local
      if (
        typeof localValue !== 'object' &&
        localValue !== remoteValue
      ) {
        merged[key] = localValue;
      }
      // Se são arrays, mesclar
      else if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
        merged[key] = this.mergeArrays(localValue, remoteValue);
      }
      // Se são objetos, fazer merge recursivo
      else if (
        typeof localValue === 'object' &&
        typeof remoteValue === 'object'
      ) {
        merged[key] = this.mergeObjects(localValue, remoteValue);
      }
    }

    return {
      resolved: true,
      strategy: 'merge',
      data: merged as T,
      shouldUpdate: JSON.stringify(merged) !== JSON.stringify(remote),
      reason: 'Versões mescladas',
    };
  }

  /**
   * Manual: requer intervenção do usuário
   */
  private resolveManual<T>(
    conflict: ConflictDetails<T>
  ): ConflictResolutionResult<T> {
    return {
      resolved: false,
      strategy: 'manual',
      data: conflict.localData,
      shouldUpdate: false,
      reason: 'Conflito requer resolução manual',
    };
  }

  private mergeArrays(local: any[], remote: any[]): any[] {
    const merged = [...remote];

    for (const item of local) {
      const index = merged.findIndex((r) =>
        this.isSameItem(item, r)
      );

      if (index === -1) {
        merged.push(item);
      } else {
        merged[index] = item;
      }
    }

    return merged;
  }

  private mergeObjects(
    local: Record<string, any>,
    remote: Record<string, any>
  ): Record<string, any> {
    return { ...remote, ...local };
  }

  private isSameItem(a: any, b: any): boolean {
    if (a.id && b.id) return a.id === b.id;
    return JSON.stringify(a) === JSON.stringify(b);
  }
}

/**
 * Factory para criar resolvedor com estratégia específica
 */
export function createConflictResolver(
  strategy: ConflictResolutionStrategy = 'last-write-wins'
): ConflictResolver {
  return new ConflictResolver(strategy);
}

/**
 * Valida se dados podem ser sincronizados
 */
export function validateSyncData<T extends { id: string }>(
  data: T
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.id) errors.push('ID é obrigatório');
  if (typeof data.id !== 'string')
    errors.push('ID deve ser uma string');

  return {
    valid: errors.length === 0,
    errors,
  };
}
