import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import api from '@/src/lib/api';
import { getAuthToken } from '@/src/lib/auth-storage';
import { Restaurant } from '@/src/types/restaurant';
import { Menu, MenuListItem } from '@/src/types/menu';

function formatPrice(price: number | string | null | undefined): string | null {
  if (price == null) return null;
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return null;
  return `LKR ${num.toFixed(2)}`;
}

export default function DetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menus, setMenus] = useState<MenuListItem[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const [favouriteLoading, setFavouriteLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getAuthToken().then((t) => setHasToken(!!t));
    }, []),
  );

  useEffect(() => {
    if (!hasToken || !id) return;
    api
      .get<{ data: Restaurant[] }>('/users/me/favourites')
      .then((res) => {
        const list = res.data.data ?? [];
        setIsFavourite(list.some((r) => r.id === parseInt(id, 10)));
      })
      .catch(() => {});
  }, [hasToken, id]);

  const handleToggleFavourite = () => {
    if (!restaurant || favouriteLoading) return;
    const restaurantId = restaurant.id;
    setFavouriteLoading(true);
    if (isFavourite) {
      api
        .delete(`/users/me/favourites/${restaurantId}`)
        .then(() => setIsFavourite(false))
        .catch(() => {})
        .finally(() => setFavouriteLoading(false));
    } else {
      api
        .post('/users/me/favourites', { restaurantId })
        .then(() => setIsFavourite(true))
        .catch(() => {})
        .finally(() => setFavouriteLoading(false));
    }
  };

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError(null);
    Promise.all([
      api.get<Restaurant>(`/restaurants/${id}`),
      api.get<MenuListItem[]>(`/restaurants/${id}/menus`),
    ])
      .then(([restRes, menusRes]) => {
        setRestaurant(restRes.data);
        const menuList = menusRes.data ?? [];
        setMenus(menuList);
        if (menuList.length > 0) {
          return api.get<Menu>(`/menus/${menuList[0].id}`).then((menuRes) => {
            setSelectedMenu(menuRes.data);
          });
        }
      })
      .catch((err) => {
        console.error('API error:', err);
        setError(
          err.response?.status === 404
            ? 'Restaurant not found'
            : 'Failed to load restaurant',
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  const loadMenu = (menuId: number) => {
    api
      .get<Menu>(`/menus/${menuId}`)
      .then((res) => setSelectedMenu(res.data))
      .catch((err) => console.error('API error:', err));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error || !restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error ?? 'Restaurant not found'}</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back to list</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{restaurant.name_default}</Text>
          <View style={styles.favouriteWrap}>
            {hasToken ? (
              <Pressable
                style={[
                  styles.favouriteBtn,
                  isFavourite && styles.favouriteBtnActive,
                  favouriteLoading && styles.favouriteBtnDisabled,
                ]}
                onPress={handleToggleFavourite}
                disabled={favouriteLoading}
              >
                <Text
                  style={[
                    styles.favouriteBtnText,
                    isFavourite && styles.favouriteBtnTextActive,
                  ]}
                >
                  {favouriteLoading ? '…' : isFavourite ? 'Saved' : 'Save'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.favouriteBtn}
                onPress={() => router.push('/login')}
              >
                <Text style={styles.favouriteBtnText}>Log in to save</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Text style={styles.text}>
          {restaurant.city}, {restaurant.district}
        </Text>
        <Text style={styles.text}>{restaurant.address_line1}</Text>
        <Text style={styles.text}>
          Cuisines: {restaurant.cuisine_tags?.join(', ') ?? '—'}
        </Text>
        <Text style={styles.text}>Price Level: {restaurant.price_level ?? '—'}</Text>
        <Text style={styles.text}>
          Veg Friendly: {restaurant.veg_friendly ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.text}>
          Halal: {restaurant.halal_certified ? 'Yes' : 'No'}
        </Text>

        <Text style={styles.sectionTitle}>Menu</Text>
        {menus.length === 0 ? (
          <Text style={styles.muted}>No menu available yet.</Text>
        ) : (
          <>
            {menus.length > 1 && (
              <View style={styles.menuTabs}>
                {menus.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => loadMenu(m.id)}
                    style={[
                      styles.menuTab,
                      selectedMenu?.id === m.id && styles.menuTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.menuTabText,
                        selectedMenu?.id === m.id && styles.menuTabTextActive,
                      ]}
                    >
                      {m.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {selectedMenu != null && (
              <View style={styles.menuContent}>
                <Text style={styles.menuName}>{selectedMenu.name}</Text>
                {selectedMenu.menu_sections?.length === 0 ? (
                  <Text style={styles.muted}>No sections in this menu.</Text>
                ) : (
                  selectedMenu.menu_sections?.map((section) => (
                    <View key={section.id} style={styles.section}>
                      <Text style={styles.sectionName}>{section.name}</Text>
                      {section.menu_items?.map((item) => (
                        <Pressable
                          key={item.id}
                          style={styles.itemRow}
                          onPress={() =>
                            router.push({
                              pathname: '/dish',
                              params: {
                                id: String(restaurant.id),
                                itemId: String(item.id),
                                menuId: String(selectedMenu.id),
                              },
                            })
                          }
                        >
                          <View style={styles.itemLeft}>
                            <Text style={styles.itemName}>
                              {item.name}
                              {item.veg ? (
                                <Text style={styles.vegBadge}> · Veg</Text>
                              ) : null}
                            </Text>
                            {item.description != null && item.description !== '' && (
                              <Text style={styles.itemDesc}>{item.description}</Text>
                            )}
                          </View>
                          {item.price != null && (
                            <Text style={styles.itemPrice}>
                              {formatPrice(item.price)}
                            </Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}
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
    backgroundColor: '#fff',
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  favouriteWrap: {
    shrink: 0,
  },
  favouriteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  favouriteBtnActive: {
    backgroundColor: '#2563eb',
  },
  favouriteBtnDisabled: {
    opacity: 0.6,
  },
  favouriteBtnText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  favouriteBtnTextActive: {
    color: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  text: {
    fontSize: 16,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  muted: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  menuTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  menuTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  menuTabActive: {
    backgroundColor: '#2563eb',
  },
  menuTabText: {
    fontSize: 14,
    color: '#374151',
  },
  menuTabTextActive: {
    color: '#fff',
  },
  menuContent: {
    marginBottom: 24,
  },
  menuName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 12,
  },
  itemLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
  },
  vegBadge: {
    fontSize: 12,
    color: '#059669',
  },
  itemDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    color: '#374151',
  },
});
