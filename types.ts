
export type UserPlan = 'free' | 'pro';

export interface User {
  id: string; // UUID v4 do Postgres
  nome: string;
  email: string;
  senha_hash: string;
  email_verificado: boolean;
  plano: UserPlan;
  pro_expira_em: number | null; 
  criado_em: number;
  bloqueado: boolean;
  prints_neste_mes: number;
  ultimo_mes_uso: string; 
}

export interface Admin {
  id: string;
  email: string;
  senha_hash: string;
}

export type ViewState = 'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD' | 'DASHBOARD' | 'ADMIN_LOGIN' | 'ADMIN_PANEL';

export interface AuthState {
  currentUser: User | null;
  currentAdmin: Admin | null;
  view: ViewState;
}

export interface DeliveryStop {
  id: string;
  stopNumber: string;
  address: string;
  cep: string;
  city: string;
  confidence: number;
}

export interface ExtractionResult {
  stops: DeliveryStop[];
}
