'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { District } from '@/types/restaurant';
import RestaurantForm, {
  restaurantFormToBody,
  type RestaurantFormValues,
} from '../RestaurantForm';

export default function NewRestaurantPage() {
  const router = useRouter();
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<District[]>('/districts')
      .then((res) => setDistricts(res.data ?? []))
      .catch(() => setError('Failed to load districts'));
  }, []);

  const handleSubmit = (values: RestaurantFormValues) => {
    setLoading(true);
    setError(null);
    const body = restaurantFormToBody(values);
    api
      .post('/restaurants', body)
      .then(() => {
        router.push('/admin/restaurants');
        router.refresh();
      })
      .catch((err: unknown) => {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
            : null;
        setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to create restaurant');
      })
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/restaurants" className="admin-link">
          ← Back to restaurants
        </Link>
      </div>
      <h1 className="admin-heading-1 mb-6">Add restaurant</h1>
      {error && <p className="admin-text-error mb-4">{error}</p>}
      <RestaurantForm
        districts={districts}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Create restaurant"
      />
    </div>
  );
}
