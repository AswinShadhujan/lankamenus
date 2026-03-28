import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Modal,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

import api from '@/src/lib/api';
import { getAuthToken, clearAuthToken } from '@/src/lib/auth-storage';
import { Restaurant, District } from '@/src/types/restaurant';

const DEFAULT_RADIUS_KM = 10;

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ district?: string }>();
  const [hasToken, setHasToken] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getAuthToken().then((t) => setHasToken(!!t));
    }, []),
  );

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');

  useFocusEffect(
    useCallback(() => {
      if (params.district) setSelectedDistrict(params.district);
    }, [params.district]),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [city, setCity] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [nearMeCoords, setNearMeCoords] = useState<{
    lat: number;
    lng: number;
    radius_km: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchRestaurants = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    const params: Record<string, string | number | undefined> = {
      city: city || undefined,
      cuisine: cuisine || undefined,
      district: selectedDistrict || undefined,
    };
    const q = searchQuery.trim();
    if (q) params.q = q;
    if (nearMeCoords) {
      params.lat = nearMeCoords.lat;
      params.lng = nearMeCoords.lng;
      params.radius_km = nearMeCoords.radius_km;
    }
    api
      .get('/restaurants', { params })
      .then((res) => setRestaurants(res.data.data ?? []))
      .catch((err) => {
        console.error('API error:', err);
        setFetchError('Failed to load restaurants. Tap Apply Filters to retry.');
      })
      .finally(() => setLoading(false));
  }, [selectedDistrict, searchQuery, city, cuisine, nearMeCoords]);

  useEffect(() => {
    api
      .get<District[]>('/districts')
      .then((res) => setDistricts(res.data ?? []))
      .catch((err) => console.error('Failed to load districts', err));
  }, []);

  const fetchRestaurantsRef = useRef(fetchRestaurants);
  fetchRestaurantsRef.current = fetchRestaurants;
  useEffect(() => {
    fetchRestaurantsRef.current();
  }, [selectedDistrict, nearMeCoords]);

  const handleDistrictSelect = (districtName: string) => {
    setSelectedDistrict(districtName);
    setDistrictModalVisible(false);
    setNearMeCoords(null);
    setLocationError(null);
  };

  const handleNearMe = async () => {
    setLocationError(null);
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied.');
        setLocationLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setNearMeCoords({ lat, lng, radius_km: DEFAULT_RADIUS_KM });
    } catch {
      setLocationError('Could not get your location.');
    } finally {
      setLocationLoading(false);
    }
  };

  const clearNearMe = () => {
    setNearMeCoords(null);
    setLocationError(null);
  };

  const handleLogout = async () => {
    await clearAuthToken();
    setHasToken(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Search Restaurants</Text>
        <View style={styles.authRow}>
          {hasToken ? (
            <Pressable onPress={handleLogout}>
              <Text style={styles.authLink}>Log out</Text>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={() => router.push('/login')}>
                <Text style={styles.authLink}>Log in</Text>
              </Pressable>
              <Text style={styles.authDivider}>|</Text>
              <Pressable onPress={() => router.push('/register')}>
                <Text style={styles.authLink}>Sign up</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Search dishes or restaurant name"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <Pressable
        style={styles.selector}
        onPress={() => setDistrictModalVisible(true)}
      >
        <Text style={styles.selectorLabel}>District</Text>
        <Text style={styles.selectorValue}>
          {selectedDistrict || 'All districts'}
        </Text>
      </Pressable>

      <Modal
        visible={districtModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDistrictModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDistrictModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select district</Text>
            <ScrollView style={styles.modalList}>
              <Pressable
                style={styles.modalItem}
                onPress={() => handleDistrictSelect('')}
              >
                <Text>All districts</Text>
              </Pressable>
              {districts.map((d) => (
                <Pressable
                  key={d.id}
                  style={styles.modalItem}
                  onPress={() => handleDistrictSelect(d.name)}
                >
                  <Text>{d.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              style={styles.modalClose}
              onPress={() => setDistrictModalVisible(false)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <TextInput
        style={styles.input}
        placeholder="City (e.g. Colombo)"
        value={city}
        onChangeText={setCity}
      />

      <TextInput
        style={styles.input}
        placeholder="Cuisine (e.g. Sri Lankan)"
        value={cuisine}
        onChangeText={setCuisine}
      />

      <Pressable
        style={[styles.button, locationLoading && styles.buttonDisabled]}
        onPress={handleNearMe}
        disabled={locationLoading}
      >
        <Text style={styles.buttonText}>
          {locationLoading ? 'Getting location…' : 'Near me'}
        </Text>
      </Pressable>
      {nearMeCoords && (
        <Pressable onPress={clearNearMe}>
          <Text style={styles.clearLink}>Clear near me</Text>
        </Pressable>
      )}

      {locationError ? (
        <Text style={styles.errorText} role="alert">
          {locationError}
        </Text>
      ) : null}

      {nearMeCoords ? (
        <Text style={styles.hint}>
          Within {nearMeCoords.radius_km} km of your location.
        </Text>
      ) : null}

      {fetchError ? (
        <Text style={styles.errorText}>
          {fetchError}
        </Text>
      ) : null}

      <Pressable style={styles.button} onPress={fetchRestaurants}>
        <Text style={styles.buttonText}>Apply Filters</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: './details',
                  params: { id: item.id.toString() },
                })
              }
            >
              <Text style={styles.title}>{item.name_default}</Text>
              <Text>{item.city}, {item.district}</Text>
              <Text>Cuisines: {item.cuisine_tags.join(', ')}</Text>
              {item.distance_km != null && (
                <Text style={styles.distance}>
                  {item.distance_km.toFixed(1)} km away
                </Text>
              )}
            </Pressable>
          )}
        />
      )}

      {!loading && !fetchError && restaurants.length === 0 && (
        <Text style={styles.empty}>No restaurants found.</Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  authRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authLink: {
    color: '#2563eb',
    fontSize: 14,
  },
  authDivider: {
    color: '#999',
    fontSize: 14,
  },
  selector: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    marginBottom: 8,
    borderRadius: 6,
  },
  selectorLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  selectorValue: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalClose: {
    backgroundColor: '#2563eb',
    padding: 10,
    borderRadius: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginBottom: 8,
    borderRadius: 6,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  clearLink: {
    fontSize: 14,
    color: '#2563eb',
    marginBottom: 8,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    marginBottom: 8,
  },
  hint: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  loader: {
    marginTop: 24,
  },
  card: {
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  distance: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  empty: {
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
});
