import { useEffect, useState } from 'react';
import { Text, StyleSheet, ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import api from '@/src/lib/api';
import { District } from '@/src/types/restaurant';

export default function ExploreScreen() {
  const router = useRouter();
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<District[]>('/districts')
      .then((res) => setDistricts(res.data ?? []))
      .catch((err) => {
        console.error('Failed to load districts', err);
        setError('Failed to load districts.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDistrictPress = (districtName: string) => {
    router.push({
      pathname: '/(tabs)/index',
      params: { district: districtName },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.hint}>Loading districts…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.title}>Explore</Text>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.title}>Explore by district</Text>
      <Text style={styles.subtitle}>Tap a district to see restaurants in that area.</Text>
      <FlatList
        data={districts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.districtCard, pressed && styles.districtCardPressed]}
            onPress={() => handleDistrictPress(item.name)}
          >
            <Text style={styles.districtName}>{item.name}</Text>
            <Text style={styles.districtArrow}>→</Text>
          </Pressable>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  hint: {
    color: '#666',
    fontSize: 14,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
  list: {
    paddingBottom: 24,
  },
  districtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  districtCardPressed: {
    opacity: 0.8,
    backgroundColor: '#f3f4f6',
  },
  districtName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  districtArrow: {
    fontSize: 18,
    color: '#6b7280',
  },
});
