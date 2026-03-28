import { useState, useCallback } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';

import api from '@/src/lib/api';
import { getAuthToken } from '@/src/lib/auth-storage';
import { Restaurant } from '@/src/types/restaurant';

export default function FavouritesScreen() {
  const router = useRouter();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const fetchFavourites = useCallback(async () => {
    const token = await getAuthToken();
    setHasToken(!!token);
    if (!token) {
      setRestaurants([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<{ data: Restaurant[] }>('/users/me/favourites');
      setRestaurants(res.data.data ?? []);
    } catch {
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchFavourites();
    }, [fetchFavourites]),
  );

  const handleRemove = (restaurantId: number) => {
    setRemovingId(restaurantId);
    api
      .delete(`/users/me/favourites/${restaurantId}`)
      .then(() => setRestaurants((prev) => prev.filter((r) => r.id !== restaurantId)))
      .catch(() => {})
      .finally(() => setRemovingId(null));
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

  if (!hasToken) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={styles.title}>Favourites</Text>
          <Text style={styles.hint}>Log in to see your saved restaurants.</Text>
          <Pressable style={styles.button} onPress={() => router.push('/login')}>
            <Text style={styles.buttonText}>Log in</Text>
          </Pressable>
          <Pressable style={styles.linkWrap} onPress={() => router.push('/register')}>
            <Text style={styles.link}>Sign up</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (restaurants.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.title}>Favourites</Text>
        <Text style={styles.empty}>You haven’t saved any restaurants yet.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.title}>Favourites</Text>
      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable
              style={styles.cardContent}
              onPress={() =>
                router.push({ pathname: './details', params: { id: item.id.toString() } })
              }
            >
              <Text style={styles.cardTitle}>{item.name_default}</Text>
              <Text style={styles.cardSub}>
                {[item.city, item.district].filter(Boolean).join(', ')}
              </Text>
              <Text style={styles.cardSub}>Cuisines: {item.cuisine_tags?.join(', ') ?? '—'}</Text>
            </Pressable>
            <Pressable
              style={[styles.removeBtn, removingId === item.id && styles.removeBtnDisabled]}
              onPress={() => handleRemove(item.id)}
              disabled={removingId === item.id}
            >
              <Text style={styles.removeBtnText}>
                {removingId === item.id ? 'Removing…' : 'Remove'}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
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
    textAlign: 'center',
  },
  empty: {
    color: '#666',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 6,
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardSub: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  removeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
  },
  removeBtnDisabled: {
    opacity: 0.6,
  },
  removeBtnText: {
    fontSize: 14,
    color: '#333',
  },
});
