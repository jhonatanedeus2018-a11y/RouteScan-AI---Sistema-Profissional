
import React, { useState, useRef, useEffect } from 'react';
import { 
  Rabbit, Mail, Lock, User as UserIcon, LogOut, ShieldCheck, 
  Users, Star, Clock, Ban, CheckCircle2, ArrowLeft, Upload,
  FileSpreadsheet, Download, AlertTriangle, ShieldAlert,
  Calendar, Zap, RefreshCw, ExternalLink, Key, Database
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { authService } from './services/authService';
import { extractAddressesFromImage } from './services/geminiService';
import { User, Admin, ViewState, DeliveryStop } from './types';
import { Button } from './components/Button';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('LOGIN');
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DeliveryStop[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({ nome: '', email: '', password: '' });

  const isConfigured = authService.isConfigured();

  useEffect(() => {
    if (view === 'ADMIN_PANEL' && isConfigured) {
      refreshAdminData();
    }
  }, [view, isConfigured]);

  const refreshAdminData = async () => {
    setLoading(true);
    const latestUsers = await authService.getUsers();
    setAllUsers(latestUsers);
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) {
      setError("Sistema desconectado do banco de dados.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const loggedUser = await authService.login(formData.email, formData.password);
      if (loggedUser) {
        setUser(loggedUser);
        setView('DASHBOARD');
      } else {
        setError('Credenciais inválidas.');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await authService.signup(formData.nome, formData.email, formData.password);
      if (r.success) {
        alert(r.message);
        setFormData({ nome: '', email: '', password: '' });
        setView('LOGIN');
      } else {
        setError(r.message);
      }
    } catch (err: any) {
      setError("Erro no cadastro persistente.");
    }
    setLoading(false);
  };

  // Fix for error in App.tsx: Add logout function to clear session and reset view
  const logout = () => {
    setUser(null);
    setAdmin(null);
    setView('LOGIN');
    setResults([]);
    setError('');
    setFormData({ nome: '', email: '', password: '' });
  };

  // Fix for error in App.tsx: Add handleAdminLogin function to handle admin credentials
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const loggedAdmin = await authService.adminLogin(formData.email, formData.password);
      if (loggedAdmin) {
        setAdmin(loggedAdmin);
        setView('ADMIN_PANEL');
        setFormData({ nome: '', email: '', password: '' });
      } else {
        setError('Credenciais administrativas inválidas.');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  // Fix for error in App.tsx: Add handleFileUpload function to process image with Gemini
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!authService.canUserScan(user)) {
      setError("Limite de scans mensais atingido no plano Free.");
      return;
    }

    setLoading(true);
    setError('');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const extraction = await extractAddressesFromImage(base64);
        setResults(extraction.stops);
        
        await authService.incrementScanCount(user.id);
        
        // Refresh local user state to update print count display
        const latestUser = await authService.login(user.email, user.senha_hash);
        if (latestUser) setUser(latestUser);
      } catch (err: any) {
        setError(err.message || "Falha ao processar imagem.");
      } finally {
        setLoading(false);
        // Reset file input so the same file can be uploaded again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setError("Erro ao ler o arquivo.");
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const renderDashboard = () => {
    if (!user) return null;
    const diasRestantes = user.pro_expira_em ? Math.ceil((user.pro_expira_em - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
    const limiteAtingido = user.plano === 'free' && user.prints_neste_mes >= 10;

    return (
      <div className="w-full max-w-3xl animate-in fade-in zoom-in-95 duration-500 py-8">
        {user.plano === 'free' && (
          <button 
            type="button"
            onClick={() => window.open("https://wa.me/5511994131868", "_blank")}
            className="mb-8 block w-full group text-left cursor-pointer border-none bg-transparent p-0"
          >
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-[2.5rem] text-white flex items-center justify-between shadow-2xl shadow-blue-200 border-2 border-white/20 transform transition-all group-hover:scale-[1.02] group-active:scale-[0.98]">
              <div className="flex items-center gap-5">
                <div className="bg-white/20 p-4 rounded-3xl">
                  <Zap size={32} className="text-yellow-300 animate-pulse" fill="currentColor" />
                </div>
                <div>
                  <h4 className="font-black text-2xl tracking-tight">Liberar Acesso PRO</h4>
                  <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">Clique para falar no WhatsApp</p>
                </div>
              </div>
              <div className="bg-white text-blue-600 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-xl">
                Contratar <ExternalLink size={16} />
              </div>
            </div>
          </button>
        )}

        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-blue-100 border-4 border-white">
              {user.nome[0].toUpperCase()}
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-xl tracking-tight">Console de Rotas</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{user.email}</p>
            </div>
          </div>
          <button onClick={logout} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-300 hover:text-red-500 transition-all hover:shadow-md active:scale-90">
            <LogOut size={22} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className={`p-8 rounded-[2.5rem] border transition-all ${user.plano === 'pro' ? 'bg-blue-600 border-blue-500 text-white shadow-2xl shadow-blue-200' : 'bg-white border-slate-100 text-slate-800 shadow-sm'}`}>
            <div className="flex justify-between items-start mb-4">
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${user.plano === 'pro' ? 'text-blue-200' : 'text-slate-400'}`}>Plano Ativo</span>
              {user.plano === 'pro' ? <Zap size={28} fill="white" /> : <Star size={28} className="text-slate-200" />}
            </div>
            <h2 className="text-4xl font-black tracking-tighter mb-6">{user.plano.toUpperCase()}</h2>
            
            {user.plano === 'free' ? (
              <div>
                <div className="flex justify-between text-[11px] font-black uppercase text-slate-400 mb-2">
                  <span>Cota de Prints</span>
                  <span>{user.prints_neste_mes} / 10</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-50">
                  <div 
                    className={`h-full transition-all duration-700 ${limiteAtingido ? 'bg-red-500' : 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]'}`}
                    style={{ width: `${Math.min((user.prints_neste_mes / 10) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-white/20 p-4 rounded-2xl text-sm font-black border border-white/10">
                <Calendar size={18} /> Validade: {diasRestantes} dias
              </div>
            )}
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col justify-between shadow-xl shadow-slate-200">
            <div>
              <h4 className="font-black text-2xl tracking-tight mb-3">Scanner IA</h4>
              <p className="text-slate-400 text-xs leading-relaxed font-medium">Capture endereços de prints do seu app de logística.</p>
            </div>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <Button 
              disabled={limiteAtingido || loading}
              onClick={() => fileInputRef.current?.click()}
              loading={loading}
              className="mt-8 bg-white text-slate-900 hover:bg-slate-100 w-full py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg"
            >
              <Upload size={20} className="mr-2" /> Iniciar Scan
            </Button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden animate-in slide-in-from-bottom-8 duration-700 shadow-xl shadow-slate-100">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <h3 className="font-black text-slate-800 flex items-center gap-3 text-lg">
                <FileSpreadsheet size={24} className="text-emerald-500" />
                Extração Concluída ({results.length})
              </h3>
              <button onClick={() => { if(results.length > 0) { const ws = XLSX.utils.json_to_sheet(results.map(r => ({ ID: r.stopNumber, Endereco: r.address, CEP: r.cep, Cidade: r.city }))); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Paradas"); XLSX.writeFile(wb, "rotas.xlsx"); } }} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-emerald-100 transition-all border border-emerald-100">
                <Download size={16} /> Baixar Excel
              </button>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10">
                  <tr className="border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Nº</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Endereço</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">CEP/Cidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-8 py-6"><span className="bg-slate-100 text-slate-900 font-black px-3 py-1.5 rounded-lg text-sm group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">{r.stopNumber}</span></td>
                      <td className="px-8 py-6 text-sm font-bold text-slate-700">{r.address}</td>
                      <td className="px-8 py-6"><div className="flex flex-col"><span className="text-xs font-black text-slate-900">{r.cep}</span><span className="text-[10px] font-bold text-slate-400 uppercase">{r.city}</span></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAdminPanel = () => (
    <div className="w-full max-w-7xl animate-in fade-in duration-700 py-8 px-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div className="flex items-center gap-5">
          <div className="bg-slate-900 p-4 rounded-3xl text-white shadow-2xl shadow-slate-200 border-b-4 border-slate-700">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Administração Mestra</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              Controle PostgreSQL: <span className="text-blue-600">{admin?.email}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={refreshAdminData} className={`flex items-center gap-2 bg-white border border-slate-200 px-5 py-3 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95`}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Carregando...' : 'Atualizar Dados'}
          </button>
          <button onClick={logout} className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-red-100 transition-all shadow-sm active:scale-95">
            Sair <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
          <Database className="text-slate-400" />
          <h3 className="font-black text-slate-700 uppercase text-xs tracking-[0.2em]">Usuários Persistentes ({allUsers.length})</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                <th className="px-8 py-6">Nome / E-mail</th>
                <th className="px-8 py-6">Senha Cadastrada</th>
                <th className="px-8 py-6">Consumo</th>
                <th className="px-8 py-6">Status</th>
                <th className="px-8 py-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {allUsers.map(u => (
                <tr key={u.id} className={`hover:bg-slate-50/50 transition-all ${u.bloqueado ? 'opacity-60' : ''}`}>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-800">{u.nome}</span>
                      <span className="text-xs text-blue-500 font-bold">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 w-fit">
                      <Key size={12} className="text-slate-400" />
                      <span className="text-xs font-mono font-black text-slate-700">{u.senha_hash}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-black text-slate-500">{u.prints_neste_mes} scans</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${u.plano === 'pro' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {u.plano}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => authService.togglePro(u.id).then(refreshAdminData)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${u.plano === 'pro' ? 'bg-slate-200 text-slate-600' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'}`}>
                        {u.plano === 'pro' ? 'Free' : 'Pro'}
                      </button>
                      <button onClick={() => authService.toggleBlock(u.id).then(refreshAdminData)} className={`p-2 rounded-xl ${u.bloqueado ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {u.bloqueado ? <ShieldAlert size={16} /> : <Ban size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center p-6 selection:bg-blue-100">
      {view === 'LOGIN' && (
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="flex flex-col items-center mb-10">
            <div className="bg-blue-600 p-5 rounded-[2rem] shadow-2xl shadow-blue-200 mb-6 border-4 border-white">
              <Rabbit size={48} className="text-white" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">RouteScan AI</h2>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em] mt-2">Logística Persistente</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" value={formData.email} placeholder="E-mail" required className="w-full px-6 py-5 bg-white border border-slate-100 rounded-3xl font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none" onChange={e => setFormData({...formData, email: e.target.value})} />
            <input type="password" value={formData.password} placeholder="Senha" required className="w-full px-6 py-5 bg-white border border-slate-100 rounded-3xl font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none" onChange={e => setFormData({...formData, password: e.target.value})} />
            {error && <div className="p-4 bg-red-50 text-red-600 text-xs font-black rounded-2xl border border-red-100 text-center">{error}</div>}
            <Button loading={loading} className="w-full py-5 rounded-3xl">Entrar Agora</Button>
          </form>

          <div className="mt-10 flex flex-col items-center gap-4">
            <button onClick={() => setView('SIGNUP')} className="text-sm font-black text-blue-600 hover:text-blue-700 transition-colors underline decoration-blue-200 decoration-4 underline-offset-4 border-none bg-transparent cursor-pointer">Criar nova conta</button>
            <button onClick={() => setView('ADMIN_LOGIN')} className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] hover:text-slate-900 transition-colors border-none bg-transparent cursor-pointer">Console Master</button>
          </div>
        </div>
      )}

      {view === 'SIGNUP' && (
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-right-8 duration-700">
          <button onClick={() => setView('LOGIN')} className="mb-8 flex items-center gap-2 text-slate-400 font-black text-xs border-none bg-transparent cursor-pointer"><ArrowLeft size={16}/> Voltar</button>
          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Novo Registro</h2>
            <p className="text-slate-400 text-sm font-medium mt-1">Dados salvos no PostgreSQL.</p>
          </div>
          <form onSubmit={handleSignup} className="space-y-4">
            <input type="text" value={formData.nome} placeholder="Seu Nome" required className="w-full px-6 py-5 bg-white border border-slate-100 rounded-3xl font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none" onChange={e => setFormData({...formData, nome: e.target.value})} />
            <input type="email" value={formData.email} placeholder="Seu E-mail" required className="w-full px-6 py-5 bg-white border border-slate-100 rounded-3xl font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none" onChange={e => setFormData({...formData, email: e.target.value})} />
            <input type="password" value={formData.password} placeholder="Sua Senha" required className="w-full px-6 py-5 bg-white border border-slate-100 rounded-3xl font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none" onChange={e => setFormData({...formData, password: e.target.value})} />
            {error && <div className="p-4 bg-red-50 text-red-600 text-xs font-black rounded-2xl border border-red-100">{error}</div>}
            <Button loading={loading} className="w-full py-5 rounded-3xl">Concluir Cadastro</Button>
          </form>
        </div>
      )}

      {view === 'DASHBOARD' && renderDashboard()}
      
      {view === 'ADMIN_LOGIN' && (
        <div className="w-full max-w-sm animate-in slide-in-from-top-12 duration-700">
          <button onClick={() => setView('LOGIN')} className="mb-10 flex items-center gap-2 text-slate-400 font-black text-xs border-none bg-transparent cursor-pointer"><ArrowLeft size={16}/> Voltar</button>
          <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl mb-8 w-fit border-b-8 border-slate-800">
            <ShieldCheck size={40} className="text-white" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">Login Master</h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input type="text" value={formData.email} placeholder="Usuário Admin" required className="w-full px-6 py-5 bg-white border border-slate-100 rounded-3xl font-bold" onChange={e => setFormData({...formData, email: e.target.value})} />
            <input type="password" value={formData.password} placeholder="Senha Admin" required className="w-full px-6 py-5 bg-white border border-slate-100 rounded-3xl font-bold" onChange={e => setFormData({...formData, password: e.target.value})} />
            {error && <p className="text-red-500 text-xs font-black text-center">{error}</p>}
            <Button className="w-full py-5 rounded-3xl bg-slate-900 hover:bg-black text-white">Acessar Banco de Dados</Button>
          </form>
        </div>
      )}

      {view === 'ADMIN_PANEL' && renderAdminPanel()}
    </div>
  );
};

export default App;
