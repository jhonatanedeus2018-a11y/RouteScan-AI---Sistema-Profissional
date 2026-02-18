
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { User, Admin } from '../types';

// Configuração estrita baseada nas credenciais fornecidas
const SUPABASE_URL = (process.env as any).SUPABASE_URL || 'https://owjcewzpgeplbhfiigyk.supabase.co';
const SUPABASE_ANON_KEY = (process.env as any).SUPABASE_ANON_KEY || 'sb_publishable_KFk8J4FHdk2v0w8FwK_T-g_0vcKxAAU';

let supabaseInstance: SupabaseClient | null = null;

const getSupabase = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  // Previne o uso acidental da chave Gemini (AIza...) na inicialização do Supabase
  if (SUPABASE_ANON_KEY.startsWith('AIza')) {
    console.error("ERRO: SUPABASE_ANON_KEY parece ser uma chave Gemini.");
    return null;
  }
  
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseInstance;
};

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const authService = {
  isConfigured: () => !!getSupabase(),

  getUsers: async (): Promise<User[]> => {
    const sb = getSupabase();
    if (!sb) return [];

    const { data, error } = await sb
      .from('users')
      .select('*')
      .order('data_criacao', { ascending: false });

    if (error) {
      console.error("Erro ao ler PostgreSQL:", error);
      return [];
    }

    const currentMonth = getCurrentMonthKey();

    return data.map((u: any) => {
      const user = {
        id: u.id,
        nome: u.nome,
        email: u.email,
        senha_hash: u.senha_hash,
        email_verificado: u.email_confirmado || false,
        plano: u.plano || 'free',
        pro_expira_em: u.data_fim_plano ? new Date(u.data_fim_plano).getTime() : null,
        criado_em: u.data_criacao ? new Date(u.data_criacao).getTime() : Date.now(),
        bloqueado: u.bloqueado || false,
        prints_neste_mes: u.uploads_usados || 0,
        ultimo_mes_uso: u.ultimo_mes_uso || currentMonth
      } as User;

      // Reset Mensal de Cota
      if (user.ultimo_mes_uso !== currentMonth) {
        sb.from('users').update({ 
          uploads_usados: 0, 
          ultimo_mes_uso: currentMonth 
        }).eq('id', u.id).then();
        user.prints_neste_mes = 0;
        user.ultimo_mes_uso = currentMonth;
      }

      return user;
    });
  },

  signup: async (nome: string, email: string, pass: string): Promise<{ success: boolean; message: string }> => {
    const sb = getSupabase();
    if (!sb) return { success: false, message: "Banco não inicializado." };

    const { data: existing } = await sb.from('users').select('id').eq('email', email.toLowerCase()).single();
    if (existing) return { success: false, message: "E-mail já cadastrado." };

    const newUser = {
      nome,
      email: email.toLowerCase(),
      senha_hash: pass,
      email_confirmado: false,
      plano: 'free',
      uploads_usados: 0,
      ultimo_mes_uso: getCurrentMonthKey(),
      bloqueado: false,
      data_criacao: new Date().toISOString()
    };

    const { error } = await sb.from('users').insert([newUser]);
    if (error) return { success: false, message: "Falha na persistência: " + error.message };
    
    return { success: true, message: "Usuário registrado com sucesso no banco externo!" };
  },

  login: async (email: string, pass: string): Promise<User | null> => {
    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('senha_hash', pass)
      .single();

    if (error || !data) return null;
    if (data.bloqueado) throw new Error("Acesso bloqueado.");

    return {
      id: data.id,
      nome: data.nome,
      email: data.email,
      senha_hash: data.senha_hash,
      email_verificado: data.email_confirmado || false,
      plano: data.plano || 'free',
      pro_expira_em: data.data_fim_plano ? new Date(data.data_fim_plano).getTime() : null,
      criado_em: data.data_criacao ? new Date(data.data_criacao).getTime() : Date.now(),
      bloqueado: data.bloqueado || false,
      prints_neste_mes: data.uploads_usados || 0,
      ultimo_mes_uso: data.ultimo_mes_uso || getCurrentMonthKey()
    } as User;
  },

  adminLogin: async (login: string, pass: string): Promise<Admin | null> => {
    if (login === 'jhonatan.edeus' && pass === 'Soumaiseu1@') {
      return { id: 'admin-master', email: login, senha_hash: pass };
    }
    return null;
  },

  canUserScan: (user: User): boolean => {
    if (user.plano === 'pro') return true;
    return user.prints_neste_mes < 10;
  },

  incrementScanCount: async (userId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.from('users').select('uploads_usados').eq('id', userId).single();
    if (data) {
      await sb.from('users').update({ uploads_usados: (data.uploads_usados || 0) + 1 }).eq('id', userId);
    }
  },

  togglePro: async (userId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.from('users').select('plano').eq('id', userId).single();
    if (data) {
      const isCurrentlyPro = data.plano === 'pro';
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      
      await sb.from('users').update({
        plano: isCurrentlyPro ? 'free' : 'pro',
        data_fim_plano: isCurrentlyPro ? null : thirtyDays.toISOString(),
        data_inicio_plano: isCurrentlyPro ? null : new Date().toISOString()
      }).eq('id', userId);
    }
  },

  toggleBlock: async (userId: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.from('users').select('bloqueado').eq('id', userId).single();
    if (data) {
      await sb.from('users').update({ bloqueado: !data.bloqueado }).eq('id', userId);
    }
  }
};
