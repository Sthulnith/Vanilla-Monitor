'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf, Building2, MapPin, ShieldCheck } from 'lucide-react';
import { loginWithGoogle, isAuthenticated } from '../lib/authService';

export default function SplashPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleDeveloperLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log('Logging in via Developer Form bypass...');
    localStorage.setItem('google_access_token', 'mock_google_access_token_12345');
    localStorage.setItem('google_token_expiry', String(Date.now() + 3600 * 1000));
    localStorage.setItem('google_user_profile', JSON.stringify({
      name: 'Chaminda Rajapaksa',
      email: email || 'chaminda.r@sapori.lk',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80'
    }));
    window.dispatchEvent(new Event('auth-status-change'));
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      // ClientLayout will automatically react to the auth change event and redirect
    } catch (error) {
      console.error('Sign-in failed:', error);
      alert('Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface font-sans">
      {/* Top Half: Brand Identity */}
      <div className="flex flex-col items-center justify-center bg-primary-container px-6 py-16 text-center text-white md:py-24">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md transition-transform duration-300 hover:rotate-6">
          <Leaf className="h-10 w-10 text-primary-container" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Vanilla Monitor</h1>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-green-light">
          FVP 05 SLKUVP01 • Galagedara Plantation
        </p>
      </div>

      {/* Bottom Half: Context Info & Sign-in */}
      <div className="flex flex-1 flex-col justify-between px-6 py-8">
        {/* Plantation Context Cards */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border-light bg-white p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pale-green text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                  Organisation
                </span>
                <h3 className="text-sm font-semibold text-text-primary">
                  Sapori dal Mondo PVT (Ltd)
                </h3>
              </div>
            </div>
            <div className="my-3 border-t border-border-light/50" />
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pale-green text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                  Location Site
                </span>
                <h3 className="text-sm font-semibold text-text-primary">
                  Galagedara, Kandy District, Sri Lanka
                </h3>
              </div>
            </div>
            <div className="my-3 border-t border-border-light/50" />
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pale-green text-primary">
                <Leaf className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                  Plantation ID
                </span>
                <h3 className="text-sm font-semibold text-text-primary">
                  FVP 05 SLKUVP01
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Forms */}
        <div className="mt-6 flex flex-col gap-4">
          <form onSubmit={handleDeveloperLogin} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-1">
                Supervisor Email
              </label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supervisor@sapori.lk"
                className="w-full px-4 py-2.5 rounded-xl border border-border-light text-sm focus:outline-none focus:border-primary bg-white text-text-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-border-light text-sm focus:outline-none focus:border-primary bg-white text-text-primary"
              />
            </div>
            <button
              type="submit"
              id="submit-login"
              disabled={loading}
              className="w-full bg-[#1B4332] text-white py-3 rounded-full font-bold text-xs shadow-md transition hover:bg-primary active:scale-95 disabled:opacity-50"
            >
              Sign In as Supervisor
            </button>
          </form>

          <div className="relative my-2 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-light/50"></div>
            </div>
            <span className="relative bg-surface px-3 text-[10px] font-bold text-text-secondary uppercase">
              Or SSO
            </span>
          </div>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-white border border-border-light px-6 py-3 text-sm font-bold text-text-primary shadow-xs transition-all hover:bg-gray-50 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
          </button>
          
          <div className="flex items-center gap-1.5 justify-center text-[10px] text-text-secondary leading-normal">
            <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
            <span>Secure connection via Sapori SSO</span>
          </div>
        </div>
      </div>
    </div>
  );
}
