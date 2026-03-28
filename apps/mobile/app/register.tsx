import { useState } from 'react';
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';

import api from '@/src/lib/api';
import { setAuthToken } from '@/src/lib/auth-storage';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<{
        accessToken: string;
        user: { id: number; email: string; role: string };
      }>('/auth/register', {
        email,
        password,
        name: name.trim() || undefined,
      });
      await setAuthToken(data.accessToken);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const res = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { message?: string | string[] } } }).response : undefined;
      const msg = res?.data?.message;
      const message = Array.isArray(msg) ? msg[0] : msg;
      setError(typeof message === 'string' ? message : 'Registration failed. Please try again.');
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Sign up</Text>

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
            autoComplete="new-password"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Name (optional)"
            value={name}
            onChangeText={setName}
            autoComplete="name"
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
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </Pressable>

          <Link href="/login" asChild>
            <Pressable style={styles.linkWrap}>
              <Text style={styles.link}>Already have an account? Log in</Text>
            </Pressable>
          </Link>
          <Link href="/(tabs)" asChild>
            <Pressable style={styles.linkWrap}>
              <Text style={styles.link}>Back to home</Text>
            </Pressable>
          </Link>
        </ScrollView>
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
  scroll: {
    flexGrow: 1,
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
});
