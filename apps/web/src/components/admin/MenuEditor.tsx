'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import {
  formatIngredientsBulletLine,
  formatIngredientsCommaInput,
  parseIngredientsFromCommaInput,
} from '@/lib/menu-ingredients';
import type { Menu, MenuItem, MenuListItem, MenuSection } from '@/types/menu';
import type { Restaurant } from '@/types/restaurant';

type EditorMenuResponse = { menus: MenuListItem[]; menu: Menu };

/** Active menu (highest id) else latest menu by id — matches server editor resolution. */
function pickPrimaryMenuId(menus: MenuListItem[]): number {
  const actives = menus.filter((m) => m.is_active);
  if (actives.length > 0) {
    return [...actives].sort((a, b) => b.id - a.id)[0].id;
  }
  return [...menus].sort((a, b) => b.id - a.id)[0].id;
}

/**
 * When GET /restaurants/:id/menu is missing (older API build), use list + GET /menus/:id.
 */
async function loadEditorMenuLegacy(restaurantId: number): Promise<EditorMenuResponse> {
  const menusRes = await api.get<MenuListItem[]>(`/restaurants/${restaurantId}/menus`, {
    params: { active_only: 'false' },
  });
  let menus = Array.isArray(menusRes.data) ? menusRes.data : [];

  if (menus.length === 0) {
    const { data: created } = await api.post<MenuListItem>(
      `/restaurants/${restaurantId}/menus`,
      { name: 'Menu', is_active: true },
    );
    menus = [created];
  }

  const targetId = pickPrimaryMenuId(menus);
  const menuRes = await api.get<Menu>(`/menus/${targetId}`);
  return { menus, menu: menuRes.data };
}

function parsePrice(p: unknown): number | null {
  if (p == null || p === '') return null;
  if (typeof p === 'number' && !Number.isNaN(p)) return p;
  const n = parseFloat(String(p));
  return Number.isNaN(n) ? null : n;
}

function normalizeMenu(menu: Menu): Menu {
  return {
    ...menu,
    menu_sections: [...(menu.menu_sections ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        ...s,
        menu_items: [...(s.menu_items ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((it) => ({
            ...it,
            price: parsePrice(it.price) as MenuItem['price'],
            is_available: it.is_available !== false,
            is_popular: Boolean(it.is_popular),
            is_recommended: Boolean(it.is_recommended),
          })),
      })),
  };
}

function cloneMenu(m: Menu | null): Menu | null {
  if (!m) return null;
  return JSON.parse(JSON.stringify(m)) as Menu;
}

function formatMoney(price: MenuItem['price'], currency?: string | null) {
  if (price == null) return '—';
  const n = typeof price === 'number' ? price : parseFloat(String(price));
  if (Number.isNaN(n)) return '—';
  const c = currency?.trim() || 'LKR';
  return `${c} ${n.toLocaleString()}`;
}

type MenuEditorProps = {
  restaurantId: number;
};

/** Lazy image preview for admin menu items; resets on URL change. */
function DishImagePreview({
  url,
  variant,
}: {
  url: string;
  variant: 'thumb' | 'editor';
}) {
  const [loadError, setLoadError] = useState(false);
  const trimmed = url.trim();

  useEffect(() => {
    setLoadError(false);
  }, [trimmed]);

  if (!trimmed) return null;

  if (loadError) {
    return (
      <div
        className={
          variant === 'thumb'
            ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded border border-dashed border-[var(--border)] bg-[var(--surface)] text-[8px] leading-tight text-[var(--text-secondary)]'
            : 'flex max-h-32 w-full max-w-md items-center justify-center rounded border border-dashed border-[var(--border)] bg-[var(--surface)] py-6 text-xs text-[var(--text-secondary)]'
        }
        role="img"
        aria-label="Image preview unavailable"
      >
        {variant === 'thumb' ? '—' : 'Could not load image'}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- admin previews arbitrary HTTPS URLs
    <img
      src={trimmed}
      alt=""
      loading="lazy"
      decoding="async"
      className={
        variant === 'thumb'
          ? 'h-10 w-10 shrink-0 rounded border border-[var(--border)] bg-[var(--background)] object-cover'
          : 'max-h-48 w-full max-w-md rounded border border-[var(--border)] bg-[var(--background)] object-contain'
      }
      onError={() => setLoadError(true)}
    />
  );
}

export function MenuEditor({ restaurantId }: MenuEditorProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editSectionDraft, setEditSectionDraft] = useState('');
  const [sectionBusy, setSectionBusy] = useState<number | null>(null);

  const [newItemName, setNewItemName] = useState<Record<number, string>>({});
  const [newItemPrice, setNewItemPrice] = useState<Record<number, string>>({});
  const [newItemVeg, setNewItemVeg] = useState<Record<number, boolean>>({});

  const [itemSearch, setItemSearch] = useState('');

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemIngredients, setEditItemIngredients] = useState('');
  const [editItemImageUrl, setEditItemImageUrl] = useState('');
  const [itemBusy, setItemBusy] = useState<number | null>(null);

  const editNameRef = useRef<HTMLInputElement>(null);
  const editPriceRef = useRef<HTMLInputElement>(null);
  const editIngredientsRef = useRef<HTMLInputElement>(null);

  const loadEditor = useCallback(async () => {
    setInitLoading(true);
    setError(null);
    try {
      const restRes = await api.get<Restaurant>(`/restaurants/${restaurantId}`);

      let payload: EditorMenuResponse;
      try {
        const r = await api.get<EditorMenuResponse>(
          `/restaurants/${restaurantId}/menu`,
        );
        payload = r.data;
      } catch (e: unknown) {
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          payload = await loadEditorMenuLegacy(restaurantId);
        } else {
          throw e;
        }
      }

      setRestaurant(restRes.data);
      setMenu(normalizeMenu(payload.menu));
    } catch {
      setError('Failed to load menu editor');
      setMenu(null);
    } finally {
      setInitLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadEditor();
  }, [loadEditor]);

  useEffect(() => {
    if (editingItemId == null) return;
    const id = window.setTimeout(() => editNameRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [editingItemId]);

  const menuId = menu?.id;

  const patchItemBoolean = async (
    sectionId: number,
    item: MenuItem,
    key: 'veg' | 'is_available' | 'is_popular' | 'is_recommended',
    value: boolean,
  ) => {
    if (!menuId || item.id < 0) return;
    if (itemBusy === item.id) return;
    setItemBusy(item.id);
    let snapshot: Menu | null = null;
    setMenu((m) => {
      if (!m) return m;
      snapshot = cloneMenu(m);
      return normalizeMenu({
        ...m,
        menu_sections: (m.menu_sections ?? []).map((s) =>
          s.id === sectionId
            ? {
                ...s,
                menu_items: (s.menu_items ?? []).map((it) =>
                  it.id === item.id ? { ...it, [key]: value } : it,
                ),
              }
            : s,
        ),
      });
    });
    try {
      await api.patch(`/menus/${menuId}/items/${item.id}`, { [key]: value });
    } catch {
      if (snapshot) setMenu(snapshot);
      setError('Failed to update item');
    } finally {
      setItemBusy(null);
    }
  };

  const toggleCollapsed = (sectionId: number) => {
    setCollapsed((c) => ({ ...c, [sectionId]: !c[sectionId] }));
  };

  const nextSectionSort = useMemo(() => {
    if (!menu?.menu_sections?.length) return 0;
    return Math.max(...menu.menu_sections.map((s) => s.sort_order), -1) + 1;
  }, [menu]);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || !menuId) return;
    setSavingCategory(true);
    const tempId = -Date.now();
    const snapshot = cloneMenu(menu);
    const optimistic: MenuSection = {
      id: tempId,
      name,
      sort_order: nextSectionSort,
      menu_items: [],
    };
    setMenu((m) =>
      m
        ? normalizeMenu({
            ...m,
            menu_sections: [...(m.menu_sections ?? []), optimistic],
          })
        : m,
    );
    setNewCategoryName('');
    setAddingCategory(false);
    try {
      const { data } = await api.post<MenuSection>(`/menus/${menuId}/sections`, {
        name,
        sort_order: nextSectionSort,
      });
      setMenu((m) =>
        m
          ? normalizeMenu({
              ...m,
              menu_sections: (m.menu_sections ?? []).map((s) =>
                s.id === tempId ? { ...data, menu_items: [] } : s,
              ),
            })
          : m,
      );
    } catch {
      setMenu(snapshot);
      setError('Failed to add category');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleRenameSection = async (sectionId: number) => {
    const name = editSectionDraft.trim();
    if (!name || !menuId) return;
    setSectionBusy(sectionId);
    const snapshot = cloneMenu(menu);
    setMenu((m) =>
      m
        ? {
            ...m,
            menu_sections: (m.menu_sections ?? []).map((s) =>
              s.id === sectionId ? { ...s, name } : s,
            ),
          }
        : m,
    );
    setEditingSectionId(null);
    try {
      await api.patch(`/menus/${menuId}/sections/${sectionId}`, { name });
    } catch {
      setMenu(snapshot);
      setError('Failed to rename category');
    } finally {
      setSectionBusy(null);
    }
  };

  const handleDeleteSection = async (sectionId: number, name: string) => {
    if (!menuId) return;
    if (!confirm(`Delete category "${name}" and all its items?`)) return;
    const snapshot = cloneMenu(menu);
    setMenu((m) =>
      m
        ? {
            ...m,
            menu_sections: (m.menu_sections ?? []).filter((s) => s.id !== sectionId),
          }
        : m,
    );
    try {
      await api.delete(`/menus/${menuId}/sections/${sectionId}`);
    } catch {
      setMenu(snapshot);
      setError('Failed to delete category');
    }
  };

  const moveSection = async (sectionId: number, dir: -1 | 1) => {
    if (!menu || !menuId) return;
    const sections = [...(menu.menu_sections ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const idx = sections.findIndex((s) => s.id === sectionId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= sections.length) return;
    const a = sections[idx];
    const b = sections[j];
    const snapshot = cloneMenu(menu);
    const orderA = a.sort_order;
    const orderB = b.sort_order;
    setMenu((m) =>
      m
        ? normalizeMenu({
            ...m,
            menu_sections: (m.menu_sections ?? []).map((s) => {
              if (s.id === a.id) return { ...s, sort_order: orderB };
              if (s.id === b.id) return { ...s, sort_order: orderA };
              return s;
            }),
          })
        : m,
    );
    try {
      await Promise.all([
        api.patch(`/menus/${menuId}/sections/${a.id}`, { sort_order: orderB }),
        api.patch(`/menus/${menuId}/sections/${b.id}`, { sort_order: orderA }),
      ]);
    } catch {
      setMenu(snapshot);
      setError('Failed to reorder categories');
    }
  };

  const maxItemOrder = (section: MenuSection) => {
    const items = section.menu_items ?? [];
    if (!items.length) return 0;
    return Math.max(...items.map((i) => i.sort_order), -1) + 1;
  };

  const handleAddItem = async (sectionId: number) => {
    const name = (newItemName[sectionId] ?? '').trim();
    if (!name || !menuId) {
      setError('Item name is required');
      return;
    }
    const priceStr = (newItemPrice[sectionId] ?? '').trim();
    const price = parseFloat(priceStr);
    if (!priceStr || Number.isNaN(price) || price <= 0) {
      setError('Enter a price greater than 0');
      return;
    }
    const veg = newItemVeg[sectionId] ?? false;
    const section = menu?.menu_sections?.find((s) => s.id === sectionId);
    if (!section) return;
    const sort_order = maxItemOrder(section);
    const tempId = -Date.now();
    const snapshot = cloneMenu(menu);
    const optimistic: MenuItem = {
      id: tempId,
      name,
      price,
      veg,
      sort_order,
      currency: 'LKR',
      is_available: true,
      is_popular: false,
      is_recommended: false,
      ingredients: [],
    };
    setMenu((m) =>
      m
        ? normalizeMenu({
            ...m,
            menu_sections: (m.menu_sections ?? []).map((s) =>
              s.id === sectionId
                ? { ...s, menu_items: [...(s.menu_items ?? []), optimistic] }
                : s,
            ),
          })
        : m,
    );
    setNewItemName((prev) => ({ ...prev, [sectionId]: '' }));
    setNewItemPrice((prev) => ({ ...prev, [sectionId]: '' }));
    setNewItemVeg((prev) => ({ ...prev, [sectionId]: false }));
    setError(null);
    try {
      const { data } = await api.post<MenuItem>(`/menus/${menuId}/items`, {
        menu_section_id: sectionId,
        name,
        price,
        veg,
        sort_order,
        is_available: true,
        is_popular: false,
        is_recommended: false,
      });
      setMenu((m) =>
        m
          ? normalizeMenu({
              ...m,
              menu_sections: (m.menu_sections ?? []).map((s) =>
                s.id === sectionId
                  ? {
                      ...s,
                      menu_items: (s.menu_items ?? []).map((it) =>
                        it.id === tempId
                          ? {
                              ...data,
                              price: parsePrice(data.price),
                              is_available: data.is_available !== false,
                              is_popular: Boolean(data.is_popular),
                              is_recommended: Boolean(data.is_recommended),
                            }
                          : it,
                      ),
                    }
                  : s,
              ),
            })
          : m,
      );
    } catch {
      setMenu(snapshot);
      setError('Failed to add item');
    }
  };

  const handleDeleteItem = async (sectionId: number, itemId: number, name: string) => {
    if (!menuId) return;
    if (!confirm(`Delete "${name}"?`)) return;
    const snapshot = cloneMenu(menu);
    setMenu((m) =>
      m
        ? normalizeMenu({
            ...m,
            menu_sections: (m.menu_sections ?? []).map((s) =>
              s.id === sectionId
                ? {
                    ...s,
                    menu_items: (s.menu_items ?? []).filter((it) => it.id !== itemId),
                  }
                : s,
            ),
          })
        : m,
    );
    try {
      await api.delete(`/menus/${menuId}/items/${itemId}`);
    } catch {
      setMenu(snapshot);
      setError('Failed to delete item');
    }
  };

  const startEditItem = (item: MenuItem) => {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemPrice(
      item.price != null ? String(parsePrice(item.price) ?? '') : '',
    );
    setEditItemIngredients(formatIngredientsCommaInput(item.ingredients));
    setEditItemImageUrl(item.image_url?.trim() ?? '');
  };

  const handleSaveItem = async (sectionId: number, itemId: number) => {
    if (!menuId) return;
    const name = editItemName.trim();
    if (!name) {
      setError('Item name is required');
      return;
    }
    const priceStr = editItemPrice.trim();
    const price = parseFloat(priceStr);
    if (!priceStr || Number.isNaN(price) || price <= 0) {
      setError('Enter a price greater than 0');
      return;
    }
    const ingredients = parseIngredientsFromCommaInput(editItemIngredients);
    const urlRaw = editItemImageUrl.trim();
    const image_url = urlRaw === '' ? null : urlRaw;

    const section = menu?.menu_sections?.find((s) => s.id === sectionId);
    const prev = section?.menu_items?.find((i) => i.id === itemId);
    if (!prev) return;

    setItemBusy(itemId);
    const snapshot = cloneMenu(menu);
    setMenu((m) =>
      m
        ? normalizeMenu({
            ...m,
            menu_sections: (m.menu_sections ?? []).map((s) =>
              s.id === sectionId
                ? {
                    ...s,
                    menu_items: (s.menu_items ?? []).map((it) =>
                      it.id === itemId
                        ? {
                            ...it,
                            name,
                            price,
                            ingredients,
                            image_url,
                          }
                        : it,
                    ),
                  }
                : s,
            ),
          })
        : m,
    );
    setEditingItemId(null);
    setError(null);
    try {
      await api.patch(`/menus/${menuId}/items/${itemId}`, {
        name,
        price,
        ingredients,
        image_url,
      });
    } catch {
      setMenu(snapshot);
      setError('Failed to update item');
    } finally {
      setItemBusy(null);
    }
  };

  const handleDuplicateItem = async (sectionId: number, item: MenuItem) => {
    if (!menuId || item.id < 0) return;
    const section = menu?.menu_sections?.find((s) => s.id === sectionId);
    if (!section) return;
    const priceNum = parsePrice(item.price);
    if (priceNum == null || priceNum <= 0) {
      setError('Cannot duplicate: set a valid price on the original item first');
      return;
    }
    const sort_order = maxItemOrder(section);
    const tempId = -Date.now();
    const name = `${item.name} (copy)`;
    const snapshot = cloneMenu(menu);
    const optimistic: MenuItem = {
      id: tempId,
      name,
      price: priceNum,
      veg: Boolean(item.veg),
      sort_order,
      currency: item.currency ?? 'LKR',
      is_available: item.is_available !== false,
      is_popular: Boolean(item.is_popular),
      is_recommended: Boolean(item.is_recommended),
      ingredients: [...(item.ingredients ?? [])],
      image_url: item.image_url ?? null,
    };
    setMenu((m) =>
      m
        ? normalizeMenu({
            ...m,
            menu_sections: (m.menu_sections ?? []).map((s) =>
              s.id === sectionId
                ? { ...s, menu_items: [...(s.menu_items ?? []), optimistic] }
                : s,
            ),
          })
        : m,
    );
    setError(null);
    try {
      const { data } = await api.post<MenuItem>(`/menus/${menuId}/items`, {
        menu_section_id: sectionId,
        name,
        price: priceNum,
        veg: Boolean(item.veg),
        sort_order,
        is_available: item.is_available !== false,
        is_popular: Boolean(item.is_popular),
        is_recommended: Boolean(item.is_recommended),
        ingredients: [...(item.ingredients ?? [])],
        image_url: item.image_url?.trim() || undefined,
        currency: item.currency ?? undefined,
      });
      setMenu((m) =>
        m
          ? normalizeMenu({
              ...m,
              menu_sections: (m.menu_sections ?? []).map((s) =>
                s.id === sectionId
                  ? {
                      ...s,
                      menu_items: (s.menu_items ?? []).map((it) =>
                        it.id === tempId
                          ? {
                              ...data,
                              price: parsePrice(data.price),
                              is_available: data.is_available !== false,
                              is_popular: Boolean(data.is_popular),
                              is_recommended: Boolean(data.is_recommended),
                            }
                          : it,
                      ),
                    }
                  : s,
              ),
            })
          : m,
      );
      setEditingItemId(data.id);
      setEditItemName(data.name);
      setEditItemPrice(String(parsePrice(data.price) ?? ''));
      setEditItemIngredients(formatIngredientsCommaInput(data.ingredients));
      setEditItemImageUrl(data.image_url?.trim() ?? '');
    } catch {
      setMenu(snapshot);
      setError('Failed to duplicate item');
    }
  };

  if (initLoading && !menu) {
    return <p className="admin-text-muted text-sm">Loading menu…</p>;
  }

  if (error && !menu) {
    return (
      <div>
        <p className="admin-text-error text-sm">{error}</p>
        <button type="button" className="admin-btn-secondary mt-2 text-xs" onClick={() => void loadEditor()}>
          Retry
        </button>
      </div>
    );
  }

  if (!menu || !menuId) return null;

  const sections = [...(menu.menu_sections ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  return (
    <div className="menu-editor text-sm">
      {error && (
        <p className="admin-text-error mb-2 text-xs" role="alert">
          {error}
          <button
            type="button"
            className="admin-btn-text ml-2 text-xs"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </p>
      )}

      <div className="mb-4 border-b border-[var(--border)] pb-3">
        <h1 className="admin-heading-1 text-xl sm:text-2xl">Menu editor</h1>
        <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
          {restaurant?.name_default ?? 'Restaurant'}
        </p>
      </div>

      <div className="mb-3">
        <input
          type="search"
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          placeholder="Search items by name…"
          className="admin-input w-full max-w-md py-1.5 text-xs"
          aria-label="Search menu items by name"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!addingCategory ? (
          <button
            type="button"
            className="admin-btn-primary py-1.5 text-xs"
            onClick={() => setAddingCategory(true)}
          >
            + Add category
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="admin-input max-w-[14rem] py-1 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAddCategory();
                if (e.key === 'Escape') {
                  setAddingCategory(false);
                  setNewCategoryName('');
                }
              }}
            />
            <button
              type="button"
              className="admin-btn-primary py-1 px-2 text-xs"
              disabled={savingCategory || !newCategoryName.trim()}
              onClick={() => void handleAddCategory()}
            >
              Add
            </button>
            <button
              type="button"
              className="admin-btn-secondary py-1 px-2 text-xs"
              onClick={() => {
                setAddingCategory(false);
                setNewCategoryName('');
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {sections.length === 0 && (
        <p className="rounded border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--text-secondary)]">
          No menu yet. Add your first category.
        </p>
      )}

      <div className="space-y-2">
        {sections.map((section, sIdx) => {
          const isCollapsed = collapsed[section.id];
          const q = itemSearch.trim().toLowerCase();
          const allItems = [...(section.menu_items ?? [])].sort(
            (a, b) => a.sort_order - b.sort_order,
          );
          const items = q
            ? allItems.filter((i) => i.name.toLowerCase().includes(q))
            : allItems;
          return (
            <div
              key={section.id}
              className="rounded border border-[var(--border)] bg-[var(--surface)]"
            >
              <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
                <button
                  type="button"
                  className="admin-btn-ghost px-1 py-0 text-xs"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleCollapsed(section.id)}
                >
                  {isCollapsed ? '▶' : '▼'}
                </button>
                {editingSectionId === section.id ? (
                  <>
                    <input
                      type="text"
                      value={editSectionDraft}
                      onChange={(e) => setEditSectionDraft(e.target.value)}
                      className="admin-input max-w-[12rem] py-0.5 text-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRenameSection(section.id);
                        if (e.key === 'Escape') setEditingSectionId(null);
                      }}
                    />
                    <button
                      type="button"
                      className="admin-btn-primary py-0.5 px-2 text-xs"
                      disabled={sectionBusy === section.id}
                      onClick={() => void handleRenameSection(section.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="admin-btn-secondary py-0.5 px-2 text-xs"
                      onClick={() => setEditingSectionId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate font-semibold text-[var(--text-primary)]">
                      {section.name}
                    </span>
                    <button
                      type="button"
                      className="admin-btn-ghost px-1.5 py-0 text-xs"
                      title="Rename"
                      onClick={() => {
                        setEditingSectionId(section.id);
                        setEditSectionDraft(section.name);
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="admin-btn-ghost px-1.5 py-0 text-xs"
                      title="Move up"
                      disabled={sIdx === 0}
                      onClick={() => void moveSection(section.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="admin-btn-ghost px-1.5 py-0 text-xs"
                      title="Move down"
                      disabled={sIdx >= sections.length - 1}
                      onClick={() => void moveSection(section.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="admin-btn-danger-text px-1.5 py-0 text-xs"
                      title="Delete"
                      onClick={() => void handleDeleteSection(section.id, section.name)}
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>

              {!isCollapsed && (
                <div className="px-2 py-1">
                  {q && allItems.length > 0 && items.length === 0 && (
                    <p className="py-2 text-xs text-[var(--text-secondary)]">
                      No matching items in this category.
                    </p>
                  )}
                  <div className="divide-y divide-[var(--border)]">
                    {items.map((item) => {
                      const busy = itemBusy === item.id;
                      const pending = item.id < 0;
                      const ingredientsLine = formatIngredientsBulletLine(item.ingredients);
                      return (
                        <div key={item.id} className="flex flex-col gap-1 py-1.5">
                          {editingItemId === item.id ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  ref={editNameRef}
                                  type="text"
                                  value={editItemName}
                                  onChange={(e) => setEditItemName(e.target.value)}
                                  className="admin-input min-w-[6rem] max-w-[12rem] flex-1 py-0.5 text-xs"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      editPriceRef.current?.focus();
                                    }
                                    if (e.key === 'Escape') setEditingItemId(null);
                                  }}
                                />
                                <input
                                  ref={editPriceRef}
                                  type="text"
                                  inputMode="decimal"
                                  value={editItemPrice}
                                  onChange={(e) => setEditItemPrice(e.target.value)}
                                  placeholder="Price"
                                  className="admin-input w-24 py-0.5 text-xs"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      editIngredientsRef.current?.focus();
                                    }
                                    if (e.key === 'Escape') setEditingItemId(null);
                                  }}
                                />
                                <button
                                  type="button"
                                  className="admin-btn-primary py-0.5 px-2 text-xs"
                                  disabled={busy}
                                  onClick={() => void handleSaveItem(section.id, item.id)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn-secondary py-0.5 px-2 text-xs"
                                  onClick={() => setEditingItemId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                              <input
                                ref={editIngredientsRef}
                                type="text"
                                value={editItemIngredients}
                                onChange={(e) => setEditItemIngredients(e.target.value)}
                                placeholder="Ingredients (comma-separated)"
                                className="admin-input w-full max-w-xl py-0.5 text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleSaveItem(section.id, item.id);
                                  }
                                  if (e.key === 'Escape') setEditingItemId(null);
                                }}
                              />
                              <input
                                type="url"
                                value={editItemImageUrl}
                                onChange={(e) => setEditItemImageUrl(e.target.value)}
                                placeholder="Image URL (optional)"
                                className="admin-input w-full max-w-xl py-0.5 text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleSaveItem(section.id, item.id);
                                  }
                                  if (e.key === 'Escape') setEditingItemId(null);
                                }}
                              />
                              {editItemImageUrl.trim() ? (
                                <div className="max-w-xl">
                                  <p className="mb-0.5 text-[10px] text-[var(--text-secondary)]">
                                    Preview
                                  </p>
                                  <DishImagePreview url={editItemImageUrl} variant="editor" />
                                </div>
                              ) : null}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--text-secondary)]">
                                <label className="flex cursor-pointer items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(item.veg)}
                                    disabled={pending || busy}
                                    onChange={(e) =>
                                      void patchItemBoolean(section.id, item, 'veg', e.target.checked)
                                    }
                                  />
                                  Veg
                                </label>
                                <label className="flex cursor-pointer items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={item.is_available !== false}
                                    disabled={pending || busy}
                                    onChange={(e) =>
                                      void patchItemBoolean(
                                        section.id,
                                        item,
                                        'is_available',
                                        e.target.checked,
                                      )
                                    }
                                  />
                                  Available
                                </label>
                                <label className="flex cursor-pointer items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(item.is_popular)}
                                    disabled={pending || busy}
                                    onChange={(e) =>
                                      void patchItemBoolean(
                                        section.id,
                                        item,
                                        'is_popular',
                                        e.target.checked,
                                      )
                                    }
                                  />
                                  Popular
                                </label>
                                <label className="flex cursor-pointer items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(item.is_recommended)}
                                    disabled={pending || busy}
                                    onChange={(e) =>
                                      void patchItemBoolean(
                                        section.id,
                                        item,
                                        'is_recommended',
                                        e.target.checked,
                                      )
                                    }
                                  />
                                  Recommended
                                </label>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex min-w-0 flex-wrap items-start gap-2">
                                <DishImagePreview
                                  url={item.image_url?.trim() ?? ''}
                                  variant="thumb"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium text-[var(--text-primary)]">
                                    {item.name}
                                  </div>
                                  {ingredientsLine ? (
                                    <p
                                      className="mt-0.5 text-[10px] leading-snug text-[var(--text-secondary)]"
                                      title={ingredientsLine}
                                    >
                                      {ingredientsLine}
                                    </p>
                                  ) : null}
                                </div>
                                <span className="shrink-0 text-xs tabular-nums text-[var(--text-secondary)]">
                                  {formatMoney(item.price, item.currency)}
                                </span>
                                <div className="flex shrink-0 flex-wrap gap-1.5 text-[10px]">
                                  {item.is_popular ? (
                                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-800 dark:text-amber-200">
                                      🔥 Popular
                                    </span>
                                  ) : null}
                                  {item.is_recommended ? (
                                    <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-800 dark:text-violet-200">
                                      ⭐ Recommended
                                    </span>
                                  ) : null}
                                  <span
                                    className={
                                      item.is_available !== false
                                        ? 'rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-800 dark:text-emerald-200'
                                        : 'rounded bg-red-500/15 px-1.5 py-0.5 text-red-800 dark:text-red-200'
                                    }
                                  >
                                    {item.is_available !== false ? '🟢 Available' : '🔴 Out of stock'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px]">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <label className="flex cursor-pointer items-center gap-1 text-[var(--text-secondary)]">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(item.veg)}
                                      disabled={pending || busy}
                                      onChange={(e) =>
                                        void patchItemBoolean(section.id, item, 'veg', e.target.checked)
                                      }
                                    />
                                    Veg
                                  </label>
                                  <label className="flex cursor-pointer items-center gap-1 text-[var(--text-secondary)]">
                                    <input
                                      type="checkbox"
                                      checked={item.is_available !== false}
                                      disabled={pending || busy}
                                      onChange={(e) =>
                                        void patchItemBoolean(
                                          section.id,
                                          item,
                                          'is_available',
                                          e.target.checked,
                                        )
                                      }
                                    />
                                    Available
                                  </label>
                                  <label className="flex cursor-pointer items-center gap-1 text-[var(--text-secondary)]">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(item.is_popular)}
                                      disabled={pending || busy}
                                      onChange={(e) =>
                                        void patchItemBoolean(
                                          section.id,
                                          item,
                                          'is_popular',
                                          e.target.checked,
                                        )
                                      }
                                    />
                                    Popular
                                  </label>
                                  <label className="flex cursor-pointer items-center gap-1 text-[var(--text-secondary)]">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(item.is_recommended)}
                                      disabled={pending || busy}
                                      onChange={(e) =>
                                        void patchItemBoolean(
                                          section.id,
                                          item,
                                          'is_recommended',
                                          e.target.checked,
                                        )
                                      }
                                    />
                                    Recommended
                                  </label>
                                </div>
                                <div className="flex flex-wrap gap-0.5">
                                  <button
                                    type="button"
                                    className="admin-btn-ghost px-1.5 text-xs"
                                    title="Edit details"
                                    disabled={pending}
                                    onClick={() => startEditItem(item)}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-btn-ghost px-1.5 text-xs"
                                    title="Duplicate"
                                    disabled={pending || busy}
                                    onClick={() => void handleDuplicateItem(section.id, item)}
                                  >
                                    Dup
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-btn-danger-text px-1.5 text-xs"
                                    title="Delete"
                                    disabled={pending}
                                    onClick={() =>
                                      void handleDeleteItem(section.id, item.id, item.name)
                                    }
                                  >
                                    🗑
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-[var(--border)] pt-1.5">
                    <input
                      type="text"
                      value={newItemName[section.id] ?? ''}
                      onChange={(e) =>
                        setNewItemName((p) => ({ ...p, [section.id]: e.target.value }))
                      }
                      placeholder="Item name (required)"
                      className="admin-input min-w-[6rem] max-w-[14rem] flex-1 py-0.5 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleAddItem(section.id);
                      }}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newItemPrice[section.id] ?? ''}
                      onChange={(e) =>
                        setNewItemPrice((p) => ({ ...p, [section.id]: e.target.value }))
                      }
                      placeholder="Price (>0)"
                      className="admin-input w-24 py-0.5 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleAddItem(section.id);
                      }}
                    />
                    <label className="flex items-center gap-0.5 text-xs whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={newItemVeg[section.id] ?? false}
                        onChange={(e) =>
                          setNewItemVeg((p) => ({ ...p, [section.id]: e.target.checked }))
                        }
                      />
                      Veg
                    </label>
                    <button
                      type="button"
                      className="admin-btn-primary py-0.5 px-2 text-xs"
                      title="Add item"
                      onClick={() => void handleAddItem(section.id)}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
