'use client';

import { useCallback, useState } from 'react';
import api from '@/lib/api';
import type { Restaurant } from '@/types/restaurant';

type Props = {
  restaurantId: number;
  restaurant: Restaurant;
  onUpdated: (r: Restaurant) => void;
};

export function RestaurantImageSection({ restaurantId, restaurant, onUpdated }: Props) {
  const [externalUrl, setExternalUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await api.get<Restaurant>(`/restaurants/${restaurantId}`);
    onUpdated(res.data);
  }, [restaurantId, onUpdated]);

  const onUpload = async (file: File) => {
    setError(null);
    setOk(null);
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image (JPEG, PNG, WebP, or GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // Do not set Content-Type manually — browser/axios must add the multipart boundary.
      await api.post(`/restaurants/${restaurantId}/image`, fd);
      setOk('Image uploaded.');
      await refresh();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : null;
      setError(
        Array.isArray(msg)
          ? msg.join(' ')
          : msg ||
              'Upload failed. Check Cloudinary on the API server (CLOUDINARY_* env) and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onSaveUrl = async () => {
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      await api.patch(`/restaurants/${restaurantId}/image-url`, {
        imageUrl: externalUrl.trim(),
      });
      setOk('Image URL saved.');
      setExternalUrl('');
      await refresh();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : null;
      setError(
        Array.isArray(msg) ? msg.join(' ') : msg || 'Invalid URL or server error.',
      );
    } finally {
      setBusy(false);
    }
  };

  const displaySrc = restaurant.media_asset?.secure_url?.trim();

  return (
    <div className="admin-divider">
      <h2 className="admin-heading-2 mb-2">Cover image</h2>
      <p className="admin-text-muted mb-4 text-sm">
        Upload to Cloudinary (recommended) or set a manual HTTPS image URL. When unset, a Google Places photo is
        used if available.
      </p>

      {displaySrc ? (
        <div className="mb-4">
          <p className="admin-label mb-1">Preview</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc}
            alt=""
            className="h-36 max-w-md rounded-lg border object-cover"
            style={{ borderColor: 'var(--border)' }}
          />
        </div>
      ) : restaurant.photo_reference ? (
        <p className="admin-text-muted mb-4 text-sm">No uploaded cover — public pages use the Google photo proxy.</p>
      ) : (
        <p className="admin-text-muted mb-4 text-sm">No cover image yet.</p>
      )}

      <div className="mb-4">
        <label className="admin-label">Upload image</label>
        <label className="admin-btn-primary inline-block cursor-pointer">
          {busy ? 'Working…' : 'Choose file'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <div className="max-w-xl space-y-2">
        <label className="admin-label">Or external image URL (https)</label>
        <input
          className="admin-input"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://cdn.example.com/photo.jpg"
          disabled={busy}
        />
        <button type="button" className="admin-btn-secondary" disabled={busy} onClick={() => void onSaveUrl()}>
          Save URL
        </button>
      </div>

      {error ? <p className="admin-text-error mt-3 text-sm">{error}</p> : null}
      {ok ? (
        <p className="mt-2 text-sm font-medium" style={{ color: 'var(--success-text)' }}>
          {ok}
        </p>
      ) : null}
    </div>
  );
}
