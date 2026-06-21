'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { DishImageEditorSection } from '@/components/admin/DishImageEditorSection';
import { MenuItemPortionsSection } from '@/components/admin/MenuItemPortionsSection';
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
  const [hasPortions, setHasPortions] = useState(false);
  const [minPortionPrice, setMinPortionPrice] = useState<number | null>(null);
  const [veg, setVeg] = useState(false);
  const [sort_order, setSortOrder] = useState(0);
  const [ingredients, setIngredients] = useState('');
  const [rating, setRating] = useState('');
  const [rating_count, setRatingCount] = useState(0);
  const [image_url, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [externalHttpsUrl, setExternalHttpsUrl] = useState('');
  const [extBusy, setExtBusy] = useState(false);
  const [imageUploadVersion, setImageUploadVersion] = useState(0);
  /** File chosen in the picker; uploaded after PATCH on Save changes. */
  const pendingImageRef = useRef<File | null>(null);

  const applyMenuPayload = useCallback((data: Menu) => {
    setMenu(data);
    let found: MenuItem | null = null;
    let sectionId = 0;
    for (const sec of data.menu_sections ?? []) {
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
    }
  }, [itemId]);

  useEffect(() => {
    if (Number.isNaN(menuId) || Number.isNaN(itemId) || menuId < 1 || itemId < 1) {
      setLoadError('Invalid menu or item');
      return;
    }
    setLoadError(null);
    api
      .get<Menu>(`/menus/${menuId}`)
      .then((res) => {
        const hasItem = res.data.menu_sections?.some((sec) =>
          sec.menu_items?.some((it) => it.id === itemId),
        );
        if (!hasItem) {
          setLoadError('Item not found');
          return;
        }
        applyMenuPayload(res.data);
      })
      .catch(() => setLoadError('Failed to load menu'));
  }, [menuId, itemId, applyMenuPayload]);

  const handleImageFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      e.target.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image (JPEG, PNG, WebP, or GIF).');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be 5MB or smaller.');
      e.target.value = '';
      return;
    }
    setUploadError(null);
    pendingImageRef.current = file;
    e.target.value = '';
  };

  const handleApplyExternalUrl = () => {
    const u = externalHttpsUrl.trim();
    if (!u) {
      setUploadError('Enter an https image URL.');
      return;
    }
    setUploadError(null);
    setExtBusy(true);
    api
      .patch(`/menus/${menuId}/items/${itemId}/image-url`, { imageUrl: u })
      .then(() =>
        api.get<Menu>(`/menus/${menuId}`).then((res) => {
          applyMenuPayload(res.data);
          setExternalHttpsUrl('');
        }),
      )
      .catch((err) => {
        const msg = err.response?.data?.message ?? err.message ?? 'Save failed';
        setUploadError(Array.isArray(msg) ? msg.join(', ') : msg);
      })
      .finally(() => {
        setExtBusy(false);
        setImageUploadVersion((n) => n + 1);
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUploadError(null);
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
    try {
      await api.patch(`/menus/${menuId}/items/${itemId}`, payload);
      const pending = pendingImageRef.current;
      if (pending) {
        try {
          const formData = new FormData();
          formData.append('file', pending);
          await api.post(`/menus/${menuId}/items/${itemId}/image`, formData);
          pendingImageRef.current = null;
        } catch (err: unknown) {
          const res = await api.get<Menu>(`/menus/${menuId}`);
          applyMenuPayload(res.data);
          setImageUploadVersion((n) => n + 1);
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
              : null;
          setUploadError(
            Array.isArray(msg)
              ? msg.join(', ')
              : typeof msg === 'string'
                ? msg
                : 'Dish saved, but image upload failed. Try again or use a smaller file.',
          );
          return;
        }
      }
      const res = await api.get<Menu>(`/menus/${menuId}`);
      applyMenuPayload(res.data);
      setImageUploadVersion((n) => n + 1);
      router.push(`/admin/restaurants/${restaurantId}/menu`);
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : null;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to update item');
    } finally {
      setLoading(false);
    }
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
          {hasPortions ? (
            <>
              <input
                id="price"
                type="text"
                readOnly
                disabled
                value={
                  minPortionPrice != null
                    ? minPortionPrice.toFixed(2)
                    : price
                }
                className="admin-input max-w-[8rem] cursor-not-allowed opacity-60"
              />
              <p className="mt-1 text-small text-[var(--text-secondary)]">
                Auto-set to lowest portion price
                {minPortionPrice != null
                  ? ` (LKR ${minPortionPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })})`
                  : ''}
              </p>
            </>
          ) : (
            <input
              id="price"
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 450"
              className="admin-input max-w-[8rem]"
            />
          )}
        </div>
        <MenuItemPortionsSection
          itemId={itemId}
          disabled={loading}
          onMetaChange={({ hasPortions: hp, minPrice }) => {
            setHasPortions(hp);
            setMinPortionPrice(minPrice);
          }}
          onMenuItemPriceSynced={(p) => {
            if (p != null) setPrice(String(p));
          }}
          onError={(msg) => {
            if (msg) setError(msg);
          }}
        />
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
        <DishImageEditorSection
          item={item}
          primaryUrlValue={externalHttpsUrl}
          onPrimaryUrlChange={(v) => {
            setExternalHttpsUrl(v);
            setUploadError(null);
          }}
          onFileChange={handleImageFilePick}
          fileInputDisabled={loading}
          uploadVersion={imageUploadVersion}
          showPrimaryApply
          onApplyPrimaryUrl={handleApplyExternalUrl}
          primaryApplyBusy={extBusy}
          primaryApplyLabel="Apply URL as cover"
          showSecondaryUrl
          secondaryUrlLabel="Legacy image URL (saved with Save changes)"
          secondaryUrlValue={image_url}
          onSecondaryUrlChange={(v) => {
            setImageUrl(v);
            setUploadError(null);
          }}
          errorText={uploadError}
          hint="File upload runs when you click Save changes. Use “Apply URL as cover” to store an https URL immediately."
        />
        <button type="submit" disabled={loading} className="admin-btn-primary">
          {loading ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
