import { useState, useEffect } from 'react';
import {
  Text,
  TextInput,
  Pressable,
  View,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { ResponseType } from 'expo-auth-session';

import api from '@/src/lib/api';
import { setAuthToken } from '@/src/lib/auth-storage';

const GOOGLE_CLIENT_ID = typeof process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID !== 'undefined'
  ? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
  : '';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'mobile', path: 'redirect' });
  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'email', 'profile'],
      responseType: ResponseType.Code,
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type !== 'success' || !response.params?.code) return;
    WebBrowser.maybeCompleteAuthSession();
    let cancelled = false;
    setError(null);
    setGoogleLoading(true);
    api.post<{ accessToken: string; user: { id: number; email: string; role: string } }>(
      '/auth/google/code',
      { code: response.params.code, redirectUri },
    )
      .then(async ({ data }) => {
        if (cancelled) return;
        await setAuthToken(data.accessToken);
        router.replace('/(tabs)');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const res = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { message?: string | string[] } } }).response : undefined;
        const msg = res?.data?.message;
        const message = Array.isArray(msg) ? msg[0] : msg;
        setError(typeof message === 'string' ? message : 'Google sign-in failed.');
      })
      .finally(() => {
        if (!cancelled) setGoogleLoading(false);
      });
    return () => { cancelled = true; };
  }, [response?.type, response?.params?.code, redirectUri, router]);

  const handleGooglePress = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Sign-In is not configured (EXPO_PUBLIC_GOOGLE_CLIENT_ID).');
      return;
    }
    setError(null);
    setGoogleLoading(true);
    promptAsync().finally(() => {
      setGoogleLoading(false);
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<{
        accessToken: string;
        user: { id: number; email: string; role: string };
      }>('/auth/login', { email, password });
      await setAuthToken(data.accessToken);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const res = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { message?: string | string[] } } }).response : undefined;
      const msg = res?.data?.message;
      const message = Array.isArray(msg) ? msg[0] : msg;
      setError(typeof message === 'string' ? message : 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <Text style={styles.title}>Log in</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          editable={!loading}
        />

        {error ? (
          <Text style={styles.error} role="alert">
            {error}
          </Text>
        ) : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        {GOOGLE_CLIENT_ID ? (
          <View style={styles.googleSection}>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <Pressable
              style={[styles.googleButton, (googleLoading || !request) && styles.buttonDisabled]}
              onPress={handleGooglePress}
              disabled={googleLoading || !request}
            >
              {googleLoading ? (
                <ActivityIndicator color="#333" />
              ) : (
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <Link href="/register" asChild>
          <Pressable style={styles.linkWrap}>
            <Text style={styles.link}>Don&apos;t have an account? Sign up</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)" asChild>
          <Pressable style={styles.linkWrap}>
            <Text style={styles.link}>Back to home</Text>
          </Pressable>
        </Link>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  inner: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    marginBottom: 12,
    borderRadius: 6,
    fontSize: 16,
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkWrap: {
    marginBottom: 8,
  },
  link: {
    color: '#2563eb',
    fontSize: 14,
  },
  googleSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ccc',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#666',
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    borderRadius: 6,
  },
  googleButtonText: {
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
});
