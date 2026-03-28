'use client';

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { setAdminToken } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (res: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, config: { theme?: string; size?: string; type?: string }) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = typeof process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID !== 'undefined'
  ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  : '';

export default function AdminLoginPage() {
  const router = useRouter();
  const { theme, toggleTheme, mounted: themeMounted } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [gsiLoaded, setGsiLoaded] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const handleAuthSuccess = (data: { accessToken: string; user: { role: string } }) => {
    if (data.user?.role !== 'admin') {
      setError('Access denied. Admin role required.');
      return;
    }
    setAdminToken(data.accessToken);
    router.push('/admin/restaurants');
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<{ accessToken: string; user: { role: string } }>('/auth/login', { email, password });
      handleAuthSuccess(data);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setError(msg || 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (idToken: string) => {
    setError(null);
    setGoogleLoading(true);
    try {
      const { data } = await api.post<{ accessToken: string; user: { role: string } }>('/auth/google', { idToken });
      handleAuthSuccess(data);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !gsiLoaded || !googleButtonRef.current || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (res) => {
        if (res.credential) handleGoogleCredential(res.credential);
      },
    });

    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
    });
  }, [gsiLoaded]);

  return (
    <div className="admin-shell flex min-h-screen flex-col items-center justify-center p-4">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGsiLoaded(true)}
      />
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="admin-btn-ghost rounded-lg px-3 py-2 text-lg"
          aria-label={
            themeMounted
              ? theme === 'dark'
                ? 'Switch to light mode'
                : 'Switch to dark mode'
              : 'Toggle color theme'
          }
        >
          <span className="inline-block min-w-[1.25rem] text-center">
            {themeMounted ? (theme === 'dark' ? '☀️' : '🌙') : '🌓'}
          </span>
        </button>
      </div>

      <div className="admin-login-card">
        <h1 className="text-h2 mb-6" style={{ color: 'var(--text-primary)' }}>
          Admin login
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="admin-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="admin-input"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="admin-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="admin-input"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="admin-text-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="admin-btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="admin-divider">
          {GOOGLE_CLIENT_ID ? (
            <>
              <p className="mb-3 text-center text-small">or continue with</p>
              <div className="flex justify-center">
                <div ref={googleButtonRef} />
              </div>
              {googleLoading && (
                <p className="mt-3 text-center text-small">Signing in with Google…</p>
              )}
            </>
          ) : (
            <p className="text-center text-small">
              Sign in with Google is not configured. Set{' '}
              <code className="admin-code">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in{' '}
              <code className="admin-code">.env.local</code> and restart the dev server.
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-small">
          <Link href="/" className="admin-link">
            ← Back to site
          </Link>
        </p>
      </div>
    </div>
  );
}
