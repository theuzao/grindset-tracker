import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Shield, Swords, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/services/supabaseClient';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';


function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('Unable to validate email address')) return 'E-mail inválido.';
  if (msg.includes('Supabase não configurado')) return 'Serviço de login não configurado.';
  return msg;
}

type Mode = 'login' | 'register';

export function Login() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  if (authLoading) return null;
  if (user) return <Navigate to="/" replace />;

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError('Preencha todos os campos.');
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('As senhas não coincidem.');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
    }

    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        setError(translateAuthError(error.message));
      } else {
        // Se não quer ser lembrado, faz logout ao fechar o navegador
        if (!rememberMe) {
          const client = getSupabaseClient();
          const handleUnload = () => client?.auth.signOut();
          window.addEventListener('beforeunload', handleUnload);
        }
        navigate('/', { replace: true });
      }
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        setError(translateAuthError(error.message));
      } else {
        setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      }
    }

    setLoading(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSuccess(null);
    setPassword('');
    setConfirmPassword('');
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      {/* Grid sutil de fundo */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(46,46,209,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(46,46,209,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 mb-4 shadow-glow-sm overflow-hidden">
            <img src="/whitelogo.png" alt="GRINDSET" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-widest uppercase">GRINDSET</h1>
          <p className="text-gray-500 mt-1 text-sm">o cérebro que move o jogo</p>
        </div>

        {/* Card */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-8 shadow-2xl">
          {/* Tabs */}
          <div className="flex bg-bg-tertiary rounded-xl p-1 mb-6">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                mode === 'login'
                  ? 'bg-accent text-white shadow-glow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                mode === 'register'
                  ? 'bg-accent text-white shadow-glow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Criar conta
            </button>
          </div>

          {/* Mensagem de sucesso */}
          {success && (
            <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-5">
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-green-400">{success}</p>
            </div>
          )}

          {/* Mensagem de erro */}
          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="E-mail"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />

            <Input
              id="password"
              type="password"
              label="Senha"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={loading}
            />

            {mode === 'register' && (
              <Input
                id="confirm-password"
                type="password"
                label="Confirmar senha"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
            )}

            {/* Lembrar-se de mim (só no login) */}
            {mode === 'login' && (
              <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center ${
                      rememberMe
                        ? 'bg-accent border-accent'
                        : 'bg-bg-tertiary border-border group-hover:border-gray-500'
                    }`}
                  >
                    {rememberMe && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                  Lembrar-se de mim
                </span>
              </label>
            )}

            <Button
              type="submit"
              className="w-full !mt-5"
              size="lg"
              isLoading={loading}
            >
              {mode === 'login' ? (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Entrar na aventura
                </>
              ) : (
                <>
                  <Swords className="w-4 h-4 mr-2" />
                  Começar jornada
                </>
              )}
            </Button>
          </form>

          {/* Rodapé */}
          <div className="mt-6 pt-5 border-t border-border text-center">
            <p className="text-xs text-gray-500">
              {mode === 'login' ? (
                <>
                  Ainda não tem conta?{' '}
                  <button
                    onClick={() => switchMode('register')}
                    className="text-accent hover:underline"
                  >
                    Cadastre-se grátis
                  </button>
                </>
              ) : (
                <>
                  Já tem uma conta?{' '}
                  <button
                    onClick={() => switchMode('login')}
                    className="text-accent hover:underline"
                  >
                    Entrar
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          Seus dados ficam salvos localmente e sincronizados entre dispositivos via nuvem.
        </p>
      </div>
    </div>
  );
}
