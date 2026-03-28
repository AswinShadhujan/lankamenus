import { useState, useCallback } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';

import api from '@/src/lib/api';
import { getAuthToken, clearAuthToken } from '@/src/lib/auth-storage';

type UserMe = { id: number; email: string; name: string | null; role: string };

export default function AccountScreen() {
  const router = useRouter();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getAuthToken()
        .then((token) => {
          if (cancelled) return;
          setHasToken(!!token);
          if (!token) {
            setUser(null);
            setLoading(false);
            return;
          }
          return api.get<UserMe>('/auth/me').then((res) => {
            if (!cancelled) setUser(res.data);
          });
        })
        .catch(() => {
          if (!cancelled) setUser(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await api.post('/auth/logout');
    } finally {
      await clearAuthToken();
      setLogoutLoading(false);
      setHasToken(false);
      setUser(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.hint}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasToken || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.hint}>Log in to see your account details.</Text>
          <Pressable
            style={styles.button}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.buttonText}>Log in</Text>
          </Pressable>
          <Pressable
            style={styles.linkWrap}
            onPress={() => router.push('/register')}
          >
            <Text style={styles.link}>Sign up</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user.email}</Text>
          </View>
          {user.name ? (
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{user.name}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Role</Text>
            <Text style={styles.value}>{user.role}</Text>
          </View>
        </View>
        <Pressable
          style={[styles.button, logoutLoading && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={logoutLoading}
        >
          {logoutLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log out</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  scroll: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  hint: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    backgroundColor: '#f9fafb',
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 6,
    marginBottom: 12,
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
    marginTop: 8,
  },
  link: {
    color: '#2563eb',
    fontSize: 14,
  },
});
