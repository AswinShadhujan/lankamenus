'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Restaurant, District } from '@/types/restaurant';
import RestaurantForm, {
  restaurantFormToBody,
  restaurantToFormValues,
  type RestaurantFormValues,
} from '../../RestaurantForm';
import { ExtraCostsEditor } from '@/components/admin/ExtraCostsEditor';

export default function EditRestaurantPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (Number.isNaN(id)) {
      setLoadError('Invalid restaurant id');
      return;
    }
    Promise.all([
      api.get<Restaurant>(`/restaurants/${id}`),
      api.get<District[]>('/districts'),
    ])
      .then(([resRest, resDist]) => {
        setRestaurant(resRest.data);
        setDistricts(resDist.data ?? []);
      })
      .catch(() => setLoadError('Failed to load restaurant or districts'));
  }, [id]);

  const handleSubmit = (values: RestaurantFormValues) => {
    setLoading(true);
    setError(null);
    const body = restaurantFormToBody(values);
    api
      .patch(`/restaurants/${id}`, body)
      .then(() => {
        router.push('/admin/restaurants');
        router.refresh();
      })
      .catch((err: unknown) => {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
            : null;
        setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to update restaurant');
      })
      .finally(() => setLoading(false));
  };

  const handleDelete = () => {
    if (!restaurant || !confirm(`Delete "${restaurant.name_default}"? This cannot be undone.`)) return;
    api
      .delete(`/restaurants/${id}`)
      .then(() => {
        router.push('/admin/restaurants');
        router.refresh();
      })
      .catch(() => setError('Failed to delete restaurant'));
  };

  if (loadError) {
    return (
      <div>
        <p className="admin-text-error">{loadError}</p>
        <Link href="/admin/restaurants" className="admin-link mt-3 inline-block">
          Back to restaurants
        </Link>
      </div>
    );
  }

  if (!restaurant) {
    return <p className="admin-text-muted">Loading…</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/restaurants" className="admin-link">
          ← Back to restaurants
        </Link>
      </div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="admin-heading-1">Edit restaurant</h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/restaurants/${id}/menu`} className="admin-btn-secondary">
            Edit menu
          </Link>
          <button type="button" onClick={handleDelete} className="admin-btn-danger-outline">
            Delete restaurant
          </button>
        </div>
      </div>
      {error && <p className="admin-text-error mb-4">{error}</p>}
      <RestaurantForm
        districts={districts}
        initialValues={restaurantToFormValues(restaurant)}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Save changes"
      />

      <div className="admin-divider mt-8">
        <h2 className="admin-heading-2 mb-4">Extra costs</h2>
        <ExtraCostsEditor restaurantId={id} />
      </div>
    </div>
  );
}
