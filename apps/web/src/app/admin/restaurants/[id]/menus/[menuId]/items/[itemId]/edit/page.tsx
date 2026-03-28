'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Menu, MenuSection, MenuItem } from '@/types/menu';

export default function EditItemPage() {
  const params = useParams();
  const router = useRouter();
  const restaurantId = Number(params.id);
  const menuId = Number(params.menuId);
  const itemId = Number(params.itemId);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [item, setItem] = useState<MenuItem | null>(null);
  const [menu_section_id, setMenuSectionId] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [veg, setVeg] = useState(false);
  const [sort_order, setSortOrder] = useState(0);
  const [ingredients, setIngredients] = useState('');
  const [rating, setRating] = useState('');
  const [rating_count, setRatingCount] = useState(0);
  const [image_url, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (Number.isNaN(menuId) || Number.isNaN(itemId) || menuId < 1 || itemId < 1) {
      setLoadError('Invalid menu or item');
      return;
    }
    setLoadError(null);
    api
      .get<Menu>(`/menus/${menuId}`)
      .then((res) => {
        setMenu(res.data);
        let found: MenuItem | null = null;
        let sectionId = 0;
        for (const sec of res.data.menu_sections ?? []) {
          const i = sec.menu_items?.find((it) => it.id === itemId);
          if (i) {
            found = i;
            sectionId = sec.id;
            break;
          }
        }
        if (found) {
          setItem(found);
          setMenuSectionId(sectionId);
          setName(found.name);
          setDescription(found.description ?? '');
          setPrice(found.price != null ? String(found.price) : '');
          setVeg(found.veg ?? false);
          setSortOrder(found.sort_order ?? 0);
          setIngredients(Array.isArray(found.ingredients) ? found.ingredients.join(', ') : '');
          setRating(found.rating != null ? String(found.rating) : '');
          setRatingCount(found.rating_count ?? 0);
          setImageUrl(found.image_url ?? '');
        } else {
          setLoadError('Item not found');
        }
      })
      .catch(() => setLoadError('Failed to load menu'));
  }, [menuId, itemId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image (JPEG, PNG, WebP, or GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be 5MB or smaller.');
      return;
    }
    setUploadError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    api
      .post<{ url: string }>('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => {
        setImageUrl(res.data.url);
      })
      .catch((err) => {
        const msg = err.response?.data?.message ?? err.message ?? 'Upload failed';
        setUploadError(Array.isArray(msg) ? msg.join(', ') : msg);
      })
      .finally(() => {
        setUploading(false);
        e.target.value = '';
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const priceNum = price.trim() ? parseFloat(price) : NaN;
    const ratingNum = rating.trim() ? parseFloat(rating) : NaN;
    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: Number.isFinite(priceNum) ? priceNum : undefined,
      veg,
      sort_order,
      ingredients: ingredients.trim()
        ? ingredients.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      rating: Number.isFinite(ratingNum) && ratingNum >= 0 && ratingNum <= 5 ? ratingNum : undefined,
      rating_count: Math.max(0, Math.floor(rating_count)),
      image_url: image_url.trim() ? image_url.trim() : null,
    };
    if (menu_section_id) payload.menu_section_id = menu_section_id;
    api
      .patch(`/menus/${menuId}/items/${itemId}`, payload)
      .then(() => {
        router.push(`/admin/restaurants/${restaurantId}/menu`);
        router.refresh();
      })
      .catch((err: unknown) => {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
            : null;
        setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to update item');
      })
      .finally(() => setLoading(false));
  };

  if (loadError) {
    return (
      <div>
        <p className="admin-text-error">{loadError}</p>
        <Link href={`/admin/restaurants/${restaurantId}/menu`} className="admin-link mt-3 inline-block">
          Back to menu
        </Link>
      </div>
    );
  }

  if (!item || !menu) {
    return <p className="admin-text-muted">Loading…</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href={`/admin/restaurants/${restaurantId}/menu`} className="admin-link">
          ← Back to menu
        </Link>
      </div>
      <h1 className="admin-heading-1 mb-6">Edit item</h1>
      {error && <p className="admin-text-error mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="max-w-md space-y-5">
        <div>
          <label htmlFor="section" className="admin-label">
            Section
          </label>
          <select
            id="section"
            value={menu_section_id}
            onChange={(e) => setMenuSectionId(Number(e.target.value))}
            className="admin-select"
          >
            {(menu.menu_sections ?? []).map((s: MenuSection) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="name" className="admin-label">
            Name *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="admin-input"
          />
        </div>
        <div>
          <label htmlFor="description" className="admin-label">
            Description
          </label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="admin-input"
          />
        </div>
        <div>
          <label htmlFor="price" className="admin-label">
            Price
          </label>
          <input
            id="price"
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 450"
            className="admin-input max-w-[8rem]"
          />
        </div>
        <label className="admin-checkbox-label">
          <input type="checkbox" checked={veg} onChange={(e) => setVeg(e.target.checked)} />
          Vegetarian
        </label>
        <div>
          <label htmlFor="sort_order" className="admin-label">
            Sort order
          </label>
          <input
            id="sort_order"
            type="number"
            min={0}
            value={sort_order}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            className="admin-input max-w-[8rem]"
          />
        </div>
        <div>
          <label htmlFor="ingredients" className="admin-label">
            Ingredients
          </label>
          <input
            id="ingredients"
            type="text"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder="e.g. chicken, bun, lettuce, cheese"
            className="admin-input"
          />
          <p className="mt-1 text-small">Comma-separated list</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label htmlFor="rating" className="admin-label">
              Rating (0–5)
            </label>
            <input
              id="rating"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              placeholder="e.g. 4.4"
              className="admin-input max-w-[8rem]"
            />
          </div>
          <div>
            <label htmlFor="rating_count" className="admin-label">
              Review count
            </label>
            <input
              id="rating_count"
              type="number"
              min={0}
              value={rating_count}
              onChange={(e) => setRatingCount(Number(e.target.value) || 0)}
              className="admin-input max-w-[8rem]"
            />
          </div>
        </div>
        <div>
          <span className="admin-label">Dish image</span>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="admin-btn-secondary cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                {uploading ? 'Uploading…' : 'Upload image'}
              </label>
              <span className="text-small">JPEG, PNG, WebP or GIF, max 5MB</span>
            </div>
            {uploadError && <p className="admin-text-error">{uploadError}</p>}
            <input
              id="image_url"
              type="url"
              value={image_url}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setUploadError(null);
              }}
              placeholder="Or paste image URL (https://...)"
              className="admin-input"
            />
            <p className="text-small">Upload stores the image in object storage; or paste an existing http(s) URL.</p>
          </div>
        </div>
        <button type="submit" disabled={loading} className="admin-btn-primary">
          {loading ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
