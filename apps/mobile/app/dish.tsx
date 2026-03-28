import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  View,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import api from '@/src/lib/api';
import { DishDetail } from '@/src/types/menu';

function formatPrice(price: number | string | null | undefined): string | null {
  if (price == null) return null;
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return null;
  return `LKR ${num.toFixed(2)}`;
}

export default function DishScreen() {
  const { id, itemId, menuId } = useLocalSearchParams<{
    id: string;
    itemId: string;
    menuId: string;
  }>();
  const router = useRouter();
  const [dish, setDish] = useState<DishDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!menuId || !itemId) {
      setLoading(false);
      setError('Invalid link');
      return;
    }

    setLoading(true);
    setError(null);
    api
      .get<DishDetail>(`/menus/${menuId}/items/${itemId}`)
      .then((res) => {
        setDish(res.data);
        setImageError(false);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('Dish not found');
        } else {
          setError('Failed to load dish');
        }
        console.error('API error:', err);
      })
      .finally(() => setLoading(false));
  }, [menuId, itemId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error || !dish) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error ?? 'Dish not found'}</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scroll}>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← Back to menu</Text>
        </Pressable>

        <View style={styles.card}>
          {dish.image_url != null && dish.image_url !== '' && !imageError && (
            <View style={styles.imageWrap}>
              <Image
                source={{ uri: dish.image_url }}
                style={styles.image}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            </View>
          )}
          <View style={styles.cardInner}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{dish.name}</Text>
              {dish.price != null && (
                <Text style={styles.price}>{formatPrice(dish.price)}</Text>
              )}
            </View>

            <Text style={styles.meta}>
              {dish.section} · {dish.menu_name}
            </Text>

            {dish.rating != null && (
              <Text style={styles.ratingText}>
                <Text style={styles.ratingValue}>{dish.rating.toFixed(1)}</Text>
                {dish.rating_count > 0 && (
                  <Text style={styles.ratingCount}> ({dish.rating_count} reviews)</Text>
                )}
              </Text>
            )}

            {dish.veg && (
              <View style={styles.vegBadge}>
                <Text style={styles.vegBadgeText}>Vegetarian</Text>
              </View>
            )}

            {dish.description != null && dish.description !== '' && (
              <Text style={styles.description}>{dish.description}</Text>
            )}

            {dish.ingredients.length > 0 ? (
              <View style={styles.ingredientsWrap}>
                <Text style={styles.ingredientsTitle}>Ingredients</Text>
                <View style={styles.ingredientsList}>
                  {dish.ingredients.map((ing) => (
                    <View key={ing} style={styles.ingredientChip}>
                      <Text style={styles.ingredientText}>{ing}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <Pressable
              style={styles.menuLink}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/details',
                  params: { id: String(dish.restaurant_id) },
                })
              }
            >
              <Text style={styles.menuLinkText}>
                View full menu at {dish.restaurant?.name ?? dish.restaurant_name}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#b91c1c',
    textAlign: 'center',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    padding: 16,
  },
  backLink: {
    marginBottom: 16,
  },
  backLinkText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#f3f4f6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cardInner: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  meta: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 12,
  },
  ratingValue: {
    fontWeight: '600',
  },
  ratingCount: {
    color: '#6b7280',
  },
  vegBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    marginBottom: 12,
  },
  vegBadgeText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 16,
  },
  ingredientsWrap: {
    marginBottom: 20,
  },
  ingredientsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  ingredientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingredientChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  ingredientText: {
    fontSize: 14,
    color: '#4b5563',
  },
  menuLink: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  menuLinkText: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '600',
  },
});
