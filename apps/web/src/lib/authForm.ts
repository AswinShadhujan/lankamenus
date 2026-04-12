import axios from 'axios';

export type AuthFieldErrors = Partial<{ email: string; password: string }>;
export type RegisterFieldErrors = AuthFieldErrors & Partial<{ name: string }>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginClient(emailRaw: string, password: string): AuthFieldErrors | null {
  const email = emailRaw.trim();
  const errors: AuthFieldErrors = {};
  if (!email) errors.email = 'Enter your email address.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Enter your password.';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
  return Object.keys(errors).length ? errors : null;
}

export function validateRegisterClient(emailRaw: string, password: string, nameRaw = ''): RegisterFieldErrors | null {
  const email = emailRaw.trim();
  const name = nameRaw.trim();
  const errors: RegisterFieldErrors = {};
  if (!email) errors.email = 'Enter your email address.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Enter a password.';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
  if (name.length > 100) errors.name = 'Name must be at most 100 characters.';
  return Object.keys(errors).length ? errors : null;
}

function extractApiMessages(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const m = (data as { message?: unknown }).message;
  if (typeof m === 'string' && m.trim()) return [m.trim()];
  if (Array.isArray(m)) {
    return m
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim());
  }
  return [];
}

/** Turn common class-validator / Nest messages into short, friendly copy. */
export function humanizeValidationMessage(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('email') && (lower.includes('email address') || lower.includes('must be an email'))) {
    return 'Enter a valid email address.';
  }
  if (
    lower.includes('password must be at least') ||
    lower.includes('longer than or equal to 8') ||
    (lower.includes('password') && lower.includes('8 characters'))
  ) {
    return 'Password must be at least 8 characters.';
  }
  if (lower.includes('should not exist') || lower.includes('not allowed')) {
    return 'Something in the request was not accepted. Please refresh and try again.';
  }
  if (lower.includes('name') && (lower.includes('100') || lower.includes('shorter than or equal to'))) {
    return 'Name must be at most 100 characters.';
  }
  return msg;
}

/**
 * Maps Axios / network failures to user-facing copy.
 * Returns multiple strings when the API sent several validation messages (400).
 */
export function mapAuthApiError(err: unknown, context: 'login' | 'register'): string | string[] | null {
  if (!axios.isAxiosError(err)) {
    return context === 'login'
      ? 'Something went wrong while signing in. Please try again.'
      : 'Something went wrong while creating your account. Please try again.';
  }

  if (err.code === 'ECONNABORTED') {
    return 'That took too long. Check your connection and try again.';
  }

  if (!err.response) {
    return 'Could not reach the server. Check your internet connection and try again.';
  }

  const status = err.response.status;
  const raw = extractApiMessages(err.response.data);
  const messages = raw.map(humanizeValidationMessage);

  if (status === 401) {
    const joined = messages.join(' ').toLowerCase();
    if (joined.includes('google')) {
      return 'This account uses Google sign-in. Use Google to sign in instead of email and password.';
    }
    return 'That email or password is incorrect. Check for typos and try again.';
  }

  if (status === 409) {
    return 'An account with this email already exists. Sign in instead, or use a different email.';
  }

  if (status === 400) {
    if (messages.length > 1) return messages;
    if (messages.length === 1) {
      const only = messages[0];
      if (only.toLowerCase() === 'bad request') {
        return 'Some information looks invalid. Check the form and try again.';
      }
      return only;
    }
    return 'Some information looks invalid. Check the form and try again.';
  }

  if (status >= 500) {
    return 'Something went wrong on our end. Please try again in a moment.';
  }

  if (messages.length > 1) return messages;
  if (messages.length === 1) return messages[0];

  return context === 'login'
    ? 'Sign in failed. Please try again.'
    : 'Could not create your account. Please try again.';
}
