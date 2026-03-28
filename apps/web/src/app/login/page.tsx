'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { setAdminToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<{ accessToken: string; user: { id: number; email: string; role: string } }>(
        '/auth/login',
        { email, password },
      );
      setAdminToken(data.accessToken);
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : null;
      const message = Array.isArray(msg) ? msg[0] : msg;
      setError(message || 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: 'var(--surface)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-6 shadow-sm"
        style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
      >
        <h1 className="text-h2 mb-4" style={{ color: 'var(--text-primary)' }}>Log in</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-small font-medium" style={{ color: 'var(--text-primary)' }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2 transition-colors"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-small font-medium" style={{ color: 'var(--text-primary)' }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2 transition-colors"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-small" style={{ color: 'var(--accent-primary)' }} role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2 font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-small" style={{ color: 'var(--text-secondary)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium transition-opacity hover:opacity-80" style={{ color: 'var(--accent-primary)' }}>
            Sign up
          </Link>
        </p>
        <p className="mt-2 text-center text-small" style={{ color: 'var(--text-secondary)' }}>
          <Link href="/" className="font-medium transition-opacity hover:opacity-80" style={{ color: 'var(--accent-primary)' }}>
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
