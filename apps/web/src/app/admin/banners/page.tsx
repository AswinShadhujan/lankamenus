'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { FOOD_CATEGORIES } from '@/constants/foodCategories';
import { resolveBannerHref, type BannerCtaType } from '@/lib/banner-cta';
import type { Restaurant, RestaurantsListResponse } from '@/types/restaurant';

type MediaAsset = {
  id: number;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
};

type Banner = {
  id: number;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  cta_type: BannerCtaType | null;
  cta_url: string | null;
  restaurant_id: number | null;
  cuisine_key: string | null;
  overlay_color: string | null;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  media_asset: MediaAsset | null;
  /** Included on admin list from API when banner is linked to a restaurant. */
  restaurant?: BannerRestaurant | null;
};

type BannerRestaurant = {
  id: number;
  name_default: string;
  slug: string | null;
};

type RestaurantOption = Pick<BannerRestaurant, 'id' | 'name_default' | 'slug'>;

function mapToRestaurantOptions(rows: Restaurant[]): RestaurantOption[] {
  return rows.map((r) => ({
    id: r.id,
    name_default: r.name_default ?? '',
    slug: null,
  }));
}

type BannerForm = {
  title: string;
  subtitle: string;
  cta_label: string;
  cta_type: BannerCtaType;
  cta_url: string;
  restaurant_id: string;
  cuisine_key: string;
  overlay_color: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
};

const EMPTY_FORM: BannerForm = {
  title: '',
  subtitle: '',
  cta_label: '',
  cta_type: 'restaurants_list',
  cta_url: '',
  restaurant_id: '',
  cuisine_key: '',
  overlay_color: '#c30017',
  is_active: true,
  starts_at: '',
  ends_at: '',
};

function toFormValues(b: Banner): BannerForm {
  return {
    title: b.title,
    subtitle: b.subtitle ?? '',
    cta_label: b.cta_label ?? '',
    cta_type: b.cta_type ?? (b.cta_url ? 'custom_url' : 'restaurants_list'),
    cta_url: b.cta_url ?? '',
    restaurant_id: b.restaurant_id != null ? String(b.restaurant_id) : '',
    cuisine_key: b.cuisine_key ?? '',
    overlay_color: b.overlay_color ?? '#c30017',
    is_active: b.is_active,
    starts_at: b.starts_at ? b.starts_at.slice(0, 16) : '',
    ends_at: b.ends_at ? b.ends_at.slice(0, 16) : '',
  };
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<BannerForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restaurantQuery, setRestaurantQuery] = useState('');
  const [restaurantPickerLoading, setRestaurantPickerLoading] = useState(false);
  const [restaurantPickerError, setRestaurantPickerError] = useState<string | null>(null);
  /** Name for CTA preview / “selected” line; kept when pick list does not include the row. */
  const [selectedRestaurantLabel, setSelectedRestaurantLabel] = useState<string | null>(null);

  // Image upload
  const [uploading, setUploading] = useState<number | null>(null);

  const loadBanners = useCallback(() => {
    setLoading(true);
    api
      .get<Banner[]>('/banners')
      .then((res) => setBanners(res.data ?? []))
      .catch(() => setError('Failed to load banners'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadBanners();
  }, [loadBanners]);

  /** Debounced server search only while the admin is typing (no idle list). */
  useEffect(() => {
    if (editing === null || form.cta_type !== 'restaurant_detail') return;

    const q = restaurantQuery.trim();
    if (!q) {
      setRestaurants([]);
      setRestaurantPickerLoading(false);
      setRestaurantPickerError(null);
      return;
    }

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setRestaurantPickerLoading(true);
      setRestaurantPickerError(null);
      api
        .get<RestaurantsListResponse>('/restaurants', {
          params: {
            page: 1,
            limit: 50,
            sort: 'popular',
            q,
          },
          signal: ctrl.signal,
        })
        .then((res) => {
          setRestaurants(mapToRestaurantOptions(res.data?.data ?? []));
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return;
          const canceled =
            err &&
            typeof err === 'object' &&
            'code' in err &&
            (err as { code?: string }).code === 'ERR_CANCELED';
          if (canceled) return;
          setRestaurantPickerError('Failed to load restaurants');
          setRestaurants([]);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setRestaurantPickerLoading(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [editing, form.cta_type, restaurantQuery]);

  const openCreate = () => {
    setEditing('new');
    setForm(EMPTY_FORM);
    setSaveError(null);
    setRestaurantQuery('');
    setRestaurants([]);
    setSelectedRestaurantLabel(null);
    setRestaurantPickerError(null);
  };

  const openEdit = (b: Banner) => {
    setEditing(b.id);
    setForm(toFormValues(b));
    setSaveError(null);
    const linkedName = b.restaurant?.name_default?.trim() || null;
    setSelectedRestaurantLabel(linkedName);
    setRestaurantQuery('');
    setRestaurants([]);
    setRestaurantPickerError(null);
  };

  const closeEditor = () => {
    setEditing(null);
    setSaveError(null);
    setRestaurantQuery('');
    setRestaurants([]);
    setSelectedRestaurantLabel(null);
    setRestaurantPickerError(null);
  };

  const updateField = <K extends keyof BannerForm>(key: K, val: BannerForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const previewRestaurantLine =
    form.cta_type === 'restaurant_detail' && form.restaurant_id
      ? selectedRestaurantLabel?.trim() ||
        restaurants.find((r) => String(r.id) === form.restaurant_id)?.name_default?.trim() ||
        `ID ${form.restaurant_id}`
      : null;

  const ctaPreviewHref = resolveBannerHref({
    cta_type: form.cta_type,
    cta_url: form.cta_url,
    restaurant_id: form.restaurant_id ? Number(form.restaurant_id) : null,
    cuisine_key: form.cuisine_key,
  });

  const restaurantSearchActive = restaurantQuery.trim().length > 0;

  const handleSave = async () => {
    if (!form.title.trim()) {
      setSaveError('Title is required');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (form.cta_type === 'restaurant_detail' && !form.restaurant_id) {
        setSaveError('Select a restaurant for restaurant detail CTA');
        return;
      }
      if (form.cta_type === 'cuisine' && !form.cuisine_key.trim()) {
        setSaveError('Select a cuisine for cuisine CTA');
        return;
      }
      if (form.cta_type === 'custom_url' && !form.cta_url.trim()) {
        setSaveError('CTA URL is required for custom URL CTA');
        return;
      }

      const body: Record<string, unknown> = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        cta_label: form.cta_label.trim() || null,
        cta_type: form.cta_type,
        cta_url: form.cta_type === 'custom_url' ? form.cta_url.trim() || null : null,
        restaurant_id:
          form.cta_type === 'restaurant_detail' && form.restaurant_id
            ? Number(form.restaurant_id)
            : null,
        cuisine_key: form.cta_type === 'cuisine' ? form.cuisine_key.trim() || null : null,
        overlay_color: form.overlay_color.trim() || null,
        is_active: form.is_active,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };

      if (editing === 'new') {
        await api.post('/banners', body);
      } else {
        await api.patch(`/banners/${editing}`, body);
      }
      closeEditor();
      loadBanners();
    } catch {
      setSaveError('Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this banner?')) return;
    try {
      await api.delete(`/banners/${id}`);
      loadBanners();
    } catch {
      setError('Failed to delete banner');
    }
  };

  const handleToggle = async (b: Banner) => {
    try {
      await api.patch(`/banners/${b.id}/${b.is_active ? 'deactivate' : 'activate'}`);
      loadBanners();
    } catch {
      setError('Failed to toggle banner');
    }
  };

  const handleImageUpload = async (bannerId: number, file: File) => {
    setUploading(bannerId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/banners/${bannerId}/image`, fd);
      loadBanners();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : null;
      setError(
        Array.isArray(msg) ? msg.join(' ') : msg || 'Failed to upload image',
      );
    } finally {
      setUploading(null);
    }
  };

  const handleMoveUp = async (idx: number) => {
    if (idx === 0) return;
    const ids = banners.map((b) => b.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    try {
      await api.patch('/banners/reorder', { ids });
      loadBanners();
    } catch {
      setError('Failed to reorder');
    }
  };

  const handleMoveDown = async (idx: number) => {
    if (idx >= banners.length - 1) return;
    const ids = banners.map((b) => b.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    try {
      await api.patch('/banners/reorder', { ids });
      loadBanners();
    } catch {
      setError('Failed to reorder');
    }
  };

  if (loading) {
    return <p className="admin-text-muted">Loading banners...</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="admin-heading-1">Homepage Banners</h1>
        <button type="button" onClick={openCreate} className="admin-btn-primary">
          + New banner
        </button>
      </div>

      {error && <p className="admin-text-error mb-4">{error}</p>}

      {/* Editor panel */}
      {editing !== null && (
        <div
          className="mb-6 rounded-xl border p-5"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <h2 className="admin-heading-2 mb-4">
            {editing === 'new' ? 'New Banner' : 'Edit Banner'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="admin-label">Title *</label>
              <input
                className="admin-input"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="admin-label">Subtitle</label>
              <input
                className="admin-input"
                value={form.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
                maxLength={500}
              />
            </div>
            <div>
              <label className="admin-label">CTA Label</label>
              <input
                className="admin-input"
                value={form.cta_label}
                onChange={(e) => updateField('cta_label', e.target.value)}
                placeholder="e.g. Browse restaurants"
                maxLength={100}
              />
            </div>
            <div>
              <label className="admin-label">CTA Destination Type</label>
              <select
                className="admin-select"
                value={form.cta_type}
                onChange={(e) => updateField('cta_type', e.target.value as BannerCtaType)}
              >
                <option value="restaurants_list">All restaurants</option>
                <option value="restaurant_detail">Specific restaurant</option>
                <option value="cuisine">Cuisine/category</option>
                <option value="custom_url">Custom URL</option>
              </select>
            </div>
            {form.cta_type === 'restaurant_detail' && (
              <div className="sm:col-span-2">
                <label className="admin-label">Restaurant</label>
                <input
                  className="admin-input mb-2"
                  placeholder={
                    form.restaurant_id
                      ? 'Type to search for a different restaurant…'
                      : 'Type to search by name…'
                  }
                  value={restaurantQuery}
                  onChange={(e) => setRestaurantQuery(e.target.value)}
                />
                {!restaurantSearchActive && !form.restaurant_id ? (
                  <p className="mb-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Start typing to search and pick a restaurant.
                  </p>
                ) : null}
                {form.restaurant_id ? (
                  <p
                    className="mb-2 rounded border border-[var(--border)] px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span className="font-medium">Selected:</span>{' '}
                    {previewRestaurantLine ?? `Restaurant #${form.restaurant_id}`}
                  </p>
                ) : null}
                {restaurantSearchActive && restaurantPickerError && (
                  <p className="admin-text-error mb-2 text-xs">{restaurantPickerError}</p>
                )}
                {restaurantSearchActive ? (
                  <div className="max-h-52 overflow-auto rounded border border-[var(--border)]">
                    {restaurantPickerLoading ? (
                      <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Loading restaurants…
                      </p>
                    ) : restaurants.length === 0 ? (
                      <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        No matches
                      </p>
                    ) : (
                      restaurants.map((r) => {
                        const selected = form.restaurant_id === String(r.id);
                        const name = (r.name_default ?? '').trim();
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              updateField('restaurant_id', String(r.id));
                              setSelectedRestaurantLabel(name || `Restaurant #${r.id}`);
                              setRestaurantQuery('');
                              setRestaurants([]);
                              setRestaurantPickerError(null);
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-black/5"
                            style={{
                              backgroundColor: selected
                                ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)'
                                : 'transparent',
                            }}
                          >
                            <span className="truncate">{name || `Restaurant #${r.id}`}</span>
                            <span className="ml-2 shrink-0 text-xs" style={{ color: 'var(--text-secondary)' }}>
                              #{r.id}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            )}
            {form.cta_type === 'cuisine' && (
              <div className="sm:col-span-2">
                <label className="admin-label">Cuisine/category</label>
                <select
                  className="admin-select"
                  value={form.cuisine_key}
                  onChange={(e) => updateField('cuisine_key', e.target.value)}
                >
                  <option value="">Select cuisine</option>
                  {FOOD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {form.cta_type === 'custom_url' && (
              <div className="sm:col-span-2">
                <label className="admin-label">Custom URL</label>
                <input
                  className="admin-input"
                  value={form.cta_url}
                  onChange={(e) => updateField('cta_url', e.target.value)}
                  placeholder="https://... or /path or #anchor"
                  maxLength={500}
                />
              </div>
            )}
            <div className="sm:col-span-2 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs">
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                CTA preview
              </p>
              <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                Destination:{' '}
                <code className="rounded bg-black/5 px-1 py-0.5">{ctaPreviewHref}</code>
              </p>
              {form.cta_type === 'restaurant_detail' && (
                <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Restaurant: {previewRestaurantLine ?? 'Not selected'}
                </p>
              )}
              {form.cta_type === 'cuisine' && (
                <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Cuisine: {form.cuisine_key || 'Not selected'}
                </p>
              )}
            </div>
            <div>
              <label className="admin-label">Overlay Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.overlay_color}
                  onChange={(e) => updateField('overlay_color', e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border-0"
                />
                <input
                  className="admin-input flex-1"
                  value={form.overlay_color}
                  onChange={(e) => updateField('overlay_color', e.target.value)}
                  maxLength={30}
                />
              </div>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => updateField('is_active', e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="admin-label !mb-0">Active</span>
              </label>
            </div>
            <div>
              <label className="admin-label">Starts at (optional)</label>
              <input
                type="datetime-local"
                className="admin-input"
                value={form.starts_at}
                onChange={(e) => updateField('starts_at', e.target.value)}
              />
            </div>
            <div>
              <label className="admin-label">Ends at (optional)</label>
              <input
                type="datetime-local"
                className="admin-input"
                value={form.ends_at}
                onChange={(e) => updateField('ends_at', e.target.value)}
              />
            </div>
          </div>

          {saveError && <p className="admin-text-error mt-3">{saveError}</p>}

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="admin-btn-primary"
            >
              {saving ? 'Saving...' : editing === 'new' ? 'Create' : 'Save'}
            </button>
            <button type="button" onClick={closeEditor} className="admin-btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Banner list */}
      {banners.length === 0 ? (
        <p className="admin-text-muted">No banners yet. Create your first banner above.</p>
      ) : (
        <div className="space-y-4">
          {banners.map((b, idx) => (
            <div
              key={b.id}
              className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--surface)',
                opacity: b.is_active ? 1 : 0.6,
              }}
            >
              {/* Thumbnail */}
              <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg">
                {b.media_asset ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.media_asset.secure_url}
                    alt={b.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-xs"
                    style={{
                      background: `linear-gradient(135deg, ${b.overlay_color ?? '#c30017'} 0%, #0e0e0e 100%)`,
                      color: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    No image
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {b.title}
                </p>
                {b.subtitle && (
                  <p className="mt-0.5 truncate text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {b.subtitle}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span>Order: {b.sort_order}</span>
                  <span>CTA: {b.cta_type ?? (b.cta_url ? 'custom_url' : 'restaurants_list')}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: b.is_active
                        ? 'color-mix(in srgb, var(--success-text) 15%, transparent)'
                        : 'color-mix(in srgb, var(--danger-text) 15%, transparent)',
                      color: b.is_active ? 'var(--success-text)' : 'var(--danger-text)',
                    }}
                  >
                    {b.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMoveUp(idx)}
                  disabled={idx === 0}
                  className="admin-btn-ghost px-2 py-1 text-sm disabled:opacity-30"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveDown(idx)}
                  disabled={idx >= banners.length - 1}
                  className="admin-btn-ghost px-2 py-1 text-sm disabled:opacity-30"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(b)}
                  className="admin-btn-ghost px-2 py-1 text-sm"
                >
                  {b.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <label className="admin-btn-secondary cursor-pointer px-3 py-1.5 text-sm">
                  {uploading === b.id ? 'Uploading...' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploading === b.id}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(b.id, f);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => openEdit(b)}
                  className="admin-btn-secondary px-3 py-1.5 text-sm"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(b.id)}
                  className="admin-btn-danger-outline px-3 py-1.5 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Link href="/admin" className="admin-link">
          ← Back to admin
        </Link>
      </div>
    </div>
  );
}
