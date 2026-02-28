import { createClient, type SupabaseClient, type User, type Session, type AuthChangeEvent } from '@supabase/supabase-js';

export type { User, Session, AuthChangeEvent };

export interface SyncableEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

let supabaseClient: SupabaseClient | null = null;
let isInitialized = false;

/**
 * Inicializa o cliente Supabase
 */
export function initializeSupabase(): SupabaseClient {
  if (supabaseClient && isInitialized) {
    return supabaseClient;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      'Supabase não configurado. Sincronização multi-dispositivo desabilitada.'
    );
    isInitialized = true;
    return null as unknown as SupabaseClient;
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey);
  isInitialized = true;

  return supabaseClient;
}

/**
 * Retorna o cliente Supabase já inicializado
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isInitialized) {
    return initializeSupabase();
  }
  return supabaseClient;
}

/**
 * Verifica se Supabase está disponível
 */
export function isSupabaseAvailable(): boolean {
  const client = getSupabaseClient();
  return client !== null;
}

/**
 * Verifica conectividade com Supabase
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    if (!client) return false;

    const { error } = await client
      .from('_health')
      .select('1')
      .limit(1);

    return !error;
  } catch (error) {
    console.error('Erro ao verificar saúde do Supabase:', error);
    return false;
  }
}

/**
 * Obtém dados de uma tabela remota
 */
export async function getRemoteData<T extends SyncableEntity>(
  table: string,
  userId: string,
  sinceTimestamp?: string
): Promise<T[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    let query = client
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (sinceTimestamp) {
      query = query.gt('updated_at', sinceTimestamp);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Erro ao buscar dados remotos de ${table}:`, error);
      return [];
    }

    return (data as T[]) || [];
  } catch (error) {
    console.error(`Exceção ao buscar ${table}:`, error);
    return [];
  }
}

/**
 * Envia dados para uma tabela remota
 */
export async function upsertRemoteData<T extends SyncableEntity>(
  table: string,
  data: T,
  userId: string
): Promise<T | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const payload = {
      ...data,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await client
      .from(table)
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error(`Erro ao fazer upsert em ${table}:`, error);
      return null;
    }

    return result as T;
  } catch (error) {
    console.error(`Exceção ao fazer upsert em ${table}:`, error);
    return null;
  }
}

/**
 * Deleta um registro remoto
 */
export async function deleteRemoteData(
  table: string,
  id: string,
  userId: string
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from(table)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error(`Erro ao deletar em ${table}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Exceção ao deletar em ${table}:`, error);
    return false;
  }
}

/**
 * Autenticação: cadastro com email/senha
 */
export async function authSignUp(
  email: string,
  password: string
): Promise<{ user: User | null; error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) return { user: null, error: new Error('Supabase não configurado') };

  const { data, error } = await client.auth.signUp({ email, password });
  return { user: data.user, error };
}

/**
 * Autenticação: login com email/senha
 */
export async function authSignIn(
  email: string,
  password: string
): Promise<{ user: User | null; session: Session | null; error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) return { user: null, session: null, error: new Error('Supabase não configurado') };

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  return { user: data.user, session: data.session, error };
}

/**
 * Autenticação: logout
 */
export async function authSignOut(): Promise<{ error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) return { error: null };

  const { error } = await client.auth.signOut();
  return { error };
}

/**
 * Obtém a sessão atual
 */
export async function getSession(): Promise<{ session: Session | null; error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) return { session: null, error: null };

  const { data, error } = await client.auth.getSession();
  return { session: data.session, error };
}

/**
 * Obtém o usuário atual
 */
export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await client.auth.getUser();
  return data.user;
}

/**
 * Escuta mudanças no estado de autenticação
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};

  const { data } = client.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

/**
 * Registra-se em mudanças em tempo real
 */
export function subscribeToTable<T extends SyncableEntity>(
  table: string,
  userId: string,
  onInsert?: (data: T) => void,
  onUpdate?: (data: T) => void,
  onDelete?: (data: T) => void
) {
  const client = getSupabaseClient();
  if (!client) return null;

  return client
    .channel(`public:${table}:user_id=eq.${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table,
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert?.(payload.new as T)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table,
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onUpdate?.(payload.new as T)
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table,
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onDelete?.(payload.old as T)
    )
    .subscribe();
}
