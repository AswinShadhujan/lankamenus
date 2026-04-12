'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { setAdminToken } from '@/lib/api';
import { mapAuthApiError, validateRegisterClient, type RegisterFieldErrors } from '@/lib/authForm';
import { AuthFormErrorBanner } from '@/components/auth/AuthFormErrorBanner';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [apiError, setApiError] = useState<string | string[] | null>(null);
  const [loading, setLoading] = useState(false);

  const clearFieldError = (field: keyof RegisterFieldErrors) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setFieldErrors({});

    const client = validateRegisterClient(email, password, name);
    if (client) {
      setFieldErrors(client);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post<{ accessToken: string; user: { id: number; email: string; role: string } }>(
        '/auth/register',
        {
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        },
      );
      setAdminToken(data.accessToken);
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setApiError(mapAuthApiError(err, 'register'));
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
        <h1 className="text-h2 mb-4" style={{ color: 'var(--text-primary)' }}>
          Sign up
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate aria-busy={loading}>
          <AuthFormErrorBanner message={apiError} />

          <div>
            <label htmlFor="email" className="mb-1 block text-small font-medium" style={{ color: 'var(--text-primary)' }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError('email');
                setApiError(null);
              }}
              autoComplete="email"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              disabled={loading}
              className="w-full rounded-lg border px-3 py-2 transition-colors disabled:opacity-60"
              style={{
                borderColor: fieldErrors.email ? 'rgb(220, 38, 38)' : 'var(--border)',
                backgroundColor: 'var(--surface)',
                color: 'var(--text-primary)',
              }}
            />
            {fieldErrors.email ? (
              <p id="email-error" className="mt-1 text-small text-red-600 dark:text-red-400" role="alert">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-small font-medium" style={{ color: 'var(--text-primary)' }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
                setApiError(null);
              }}
              autoComplete="new-password"
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              disabled={loading}
              className="w-full rounded-lg border px-3 py-2 transition-colors disabled:opacity-60"
              style={{
                borderColor: fieldErrors.password ? 'rgb(220, 38, 38)' : 'var(--border)',
                backgroundColor: 'var(--surface)',
                color: 'var(--text-primary)',
              }}
            />
            {fieldErrors.password ? (
              <p id="password-error" className="mt-1 text-small text-red-600 dark:text-red-400" role="alert">
                {fieldErrors.password}
              </p>
            ) : null}
            <p className="mt-1 text-small" style={{ color: 'var(--text-secondary)' }}>
              At least 8 characters.
            </p>
          </div>
          <div>
            <label htmlFor="name" className="mb-1 block text-small font-medium" style={{ color: 'var(--text-primary)' }}>
              Name <span style={{ color: 'var(--text-secondary)' }}>(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearFieldError('name');
                setApiError(null);
              }}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              disabled={loading}
              className="w-full rounded-lg border px-3 py-2 transition-colors disabled:opacity-60"
              style={{
                borderColor: fieldErrors.name ? 'rgb(220, 38, 38)' : 'var(--border)',
                backgroundColor: 'var(--surface)',
                color: 'var(--text-primary)',
              }}
              autoComplete="name"
            />
            {fieldErrors.name ? (
              <p id="name-error" className="mt-1 text-small text-red-600 dark:text-red-400" role="alert">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2 font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-center text-small" style={{ color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-medium transition-opacity hover:opacity-80" style={{ color: 'var(--accent-primary)' }}>
            Log in
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
