'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { PREDEFINED_PORTION_NAMES, PORTION_NAME_CUSTOM } from '@/lib/portions.constants';
import type { MenuItemPortion, MenuItemPortionsResponse } from '@/types/menu-portion';

type PortionEditState = {
  namePreset: string;
  nameCustom: string;
  price: string;
  serves: string;
  is_available: boolean;
};

type NewPortionFormState = {
  namePreset: string;
  nameCustom: string;
  price: string;
  serves: string;
  is_available: boolean;
};

const DEFAULT_NEW_PORTION: NewPortionFormState = {
  namePreset: 'Mini',
  nameCustom: '',
  price: '',
  serves: '',
  is_available: true,
};

function axiosErrorMessage(e: unknown): string | null {
  if (!e || typeof e !== 'object' || !('response' in e)) return null;
  const msg = (e as { response?: { data?: { message?: string | string[] } } }).response?.data
    ?.message;
  if (Array.isArray(msg)) return msg.join(' ');
  if (typeof msg === 'string') return msg;
  return null;
}

function portionToEditState(p: MenuItemPortion): PortionEditState {
  const isPredefined = (PREDEFINED_PORTION_NAMES as readonly string[]).includes(p.name);
  return {
    namePreset: isPredefined ? p.name : PORTION_NAME_CUSTOM,
    nameCustom: isPredefined ? '' : p.name,
    price: Number(p.price).toFixed(2),
    serves: p.serves != null ? String(p.serves) : '',
    is_available: p.is_available,
  };
}

function parseServes(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n) || n < 1) return null;
  return n;
}

function resolveNameFromEdit(edit: PortionEditState | NewPortionFormState): string | null {
  if (edit.namePreset === PORTION_NAME_CUSTOM) {
    const custom = edit.nameCustom.trim();
    return custom || null;
  }
  if (edit.namePreset.trim()) return edit.namePreset.trim();
  return null;
}

function parsePortionPrice(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function minAvailablePortionPrice(portions: MenuItemPortion[]): number | null {
  const available = portions.filter((p) => p.is_available);
  if (available.length === 0) return null;
  return Math.min(...available.map((p) => Number(p.price)));
}

function sortPortions(list: MenuItemPortion[]): MenuItemPortion[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || a.price - b.price);
}

function editsFromPortions(portions: MenuItemPortion[]): Record<number, PortionEditState> {
  const map: Record<number, PortionEditState> = {};
  for (const p of portions) {
    map[p.id] = portionToEditState(p);
  }
  return map;
}

type MenuItemPortionsSectionProps = {
  /** Persisted menu item id; null when the dish has not been saved yet. */
  itemId: number | null;
  disabled?: boolean;
  /** Greyed-out placeholder until the dish exists (no menu_item_id yet). */
  awaitingSave?: boolean;
  onMetaChange?: (meta: { hasPortions: boolean; minPrice: number | null }) => void;
  onMenuItemPriceSynced?: (price: number | null) => void;
  onError?: (message: string | null) => void;
};

function PortionSizesHeader({
  showExpandAll = false,
  allCollapsed = true,
  onToggleAll,
  disabled = false,
}: {
  showExpandAll?: boolean;
  allCollapsed?: boolean;
  onToggleAll?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-1">
      {showExpandAll ? (
        <button
          type="button"
          className="admin-btn-ghost shrink-0 px-1 py-0 text-xs"
          aria-expanded={!allCollapsed}
          aria-label={
            allCollapsed ? 'Expand all portion sizes' : 'Collapse all portion sizes'
          }
          disabled={disabled}
          onClick={onToggleAll}
        >
          {allCollapsed ? '▶' : '▼'}
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h4 className="text-xs font-semibold text-[var(--text-primary)]">Portion Sizes</h4>
        <p className="mt-0.5 text-xs leading-snug text-[var(--text-secondary)]">
          Add portions if this dish comes in multiple sizes. The lowest available price will be
          shown to customers.
        </p>
      </div>
    </div>
  );
}

function PortionServesField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="w-20 shrink-0">
      <label className="admin-label text-xs">Serves</label>
      <input
        type="number"
        min={1}
        placeholder="Serves"
        className="admin-input mt-0.5 w-full py-0.5 text-xs tabular-nums"
        style={{ width: '80px' }}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function PortionNameFields({
  edit,
  disabled,
  onChange,
}: {
  edit: PortionEditState | NewPortionFormState;
  disabled?: boolean;
  onChange: (patch: Partial<PortionEditState>) => void;
}) {
  const showCustom = edit.namePreset === PORTION_NAME_CUSTOM;
  return (
    <div className="min-w-[7rem] flex-1">
      <label className="admin-label text-xs">Size</label>
      <select
        className="admin-select mt-0.5 w-full py-0.5 text-xs"
        value={edit.namePreset}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          onChange({
            namePreset: v,
            nameCustom: v === PORTION_NAME_CUSTOM ? edit.nameCustom : '',
          });
        }}
      >
        <option value="">Select size…</option>
        {PREDEFINED_PORTION_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={PORTION_NAME_CUSTOM}>Custom…</option>
      </select>
      {showCustom ? (
        <input
          type="text"
          className="admin-input mt-1 w-full py-0.5 text-xs"
          placeholder="Custom portion name"
          value={edit.nameCustom}
          disabled={disabled}
          onChange={(e) => onChange({ nameCustom: e.target.value })}
        />
      ) : null}
    </div>
  );
}

export function MenuItemPortionsSection({
  itemId,
  disabled = false,
  awaitingSave = false,
  onMetaChange,
  onMenuItemPriceSynced,
  onError,
}: MenuItemPortionsSectionProps) {
  const menuItemId =
    itemId != null && itemId > 0 && !awaitingSave ? itemId : null;

  const onMetaChangeRef = useRef(onMetaChange);
  const onMenuItemPriceSyncedRef = useRef(onMenuItemPriceSynced);
  const onErrorRef = useRef(onError);
  onMetaChangeRef.current = onMetaChange;
  onMenuItemPriceSyncedRef.current = onMenuItemPriceSynced;
  onErrorRef.current = onError;

  const [portions, setPortions] = useState<MenuItemPortion[]>([]);
  const [portionEdits, setPortionEdits] = useState<Record<number, PortionEditState>>({});
  const [loading, setLoading] = useState(Boolean(menuItemId));
  const [rowBusy, setRowBusy] = useState<number | null>(null);

  const [showNewPortionForm, setShowNewPortionForm] = useState(false);
  const [newPortion, setNewPortion] = useState<NewPortionFormState>(DEFAULT_NEW_PORTION);
  const [savingNewPortion, setSavingNewPortion] = useState(false);
  /** true = row collapsed (default for new ids) */
  const [collapsedPortions, setCollapsedPortions] = useState<Record<number, boolean>>({});

  const applyPortionsFromServer = useCallback((sorted: MenuItemPortion[]) => {
    setPortions(sorted);
    setPortionEdits(editsFromPortions(sorted));
    const hasPortions = sorted.length > 0;
    const minPrice = minAvailablePortionPrice(sorted);
    onMetaChangeRef.current?.({ hasPortions, minPrice });
    if (hasPortions) {
      onMenuItemPriceSyncedRef.current?.(minPrice);
    }
  }, []);

  const fetchPortions = useCallback(async () => {
    if (!menuItemId) {
      setPortions([]);
      setPortionEdits({});
      setLoading(false);
      onMetaChangeRef.current?.({ hasPortions: false, minPrice: null });
      return;
    }

    setLoading(true);
    onErrorRef.current?.(null);
    try {
      const { data } = await api.get<MenuItemPortionsResponse>(
        `/menu-items/${menuItemId}/portions`,
      );
      applyPortionsFromServer(sortPortions(data.portions ?? []));
    } catch (e: unknown) {
      onErrorRef.current?.(axiosErrorMessage(e) || 'Failed to load portion sizes');
      setPortions([]);
      setPortionEdits({});
      onMetaChangeRef.current?.({ hasPortions: false, minPrice: null });
    } finally {
      setLoading(false);
    }
  }, [menuItemId, applyPortionsFromServer]);

  useEffect(() => {
    void fetchPortions();
  }, [menuItemId]);

  const resetNewPortionForm = () => {
    setNewPortion({ ...DEFAULT_NEW_PORTION });
  };

  const saveNewPortion = async () => {
    if (!menuItemId) return;

    const name = resolveNameFromEdit(newPortion);
    const price = parsePortionPrice(newPortion.price);
    const serves = parseServes(newPortion.serves);
    if (!name) {
      onErrorRef.current?.('Portion name is required');
      return;
    }
    if (price == null) {
      onErrorRef.current?.('Enter a valid portion price');
      return;
    }
    if (newPortion.serves.trim() && serves == null) {
      onErrorRef.current?.('Serves must be a whole number of 1 or more');
      return;
    }

    setSavingNewPortion(true);
    onErrorRef.current?.(null);
    try {
      const { data: created } = await api.post<MenuItemPortion>(
        `/menu-items/${menuItemId}/portions`,
        {
          name,
          price,
          sort_order:
            portions.length === 0
              ? 0
              : Math.max(...portions.map((p) => p.sort_order), -1) + 1,
          ...(serves != null ? { serves } : {}),
        },
      );
      if (created.is_available !== newPortion.is_available) {
        await api.patch(`/menu-items/${menuItemId}/portions/${created.id}`, {
          is_available: newPortion.is_available,
        });
      }
      await fetchPortions();
      resetNewPortionForm();
      setShowNewPortionForm(false);
    } catch (e: unknown) {
      onErrorRef.current?.(axiosErrorMessage(e) || 'Failed to save portion');
    } finally {
      setSavingNewPortion(false);
    }
  };

  const saveExistingPortion = async (portionId: number) => {
    if (!menuItemId) return;
    const edit = portionEdits[portionId];
    if (!edit) return;

    const name = resolveNameFromEdit(edit);
    const price = parsePortionPrice(edit.price);
    const serves = parseServes(edit.serves);
    if (!name) {
      onErrorRef.current?.('Portion name is required');
      return;
    }
    if (price == null) {
      onErrorRef.current?.('Enter a valid portion price');
      return;
    }
    if (edit.serves.trim() && serves == null) {
      onErrorRef.current?.('Serves must be a whole number of 1 or more');
      return;
    }

    setRowBusy(portionId);
    onErrorRef.current?.(null);
    try {
      await api.patch(`/menu-items/${menuItemId}/portions/${portionId}`, {
        name,
        price,
        is_available: edit.is_available,
        serves,
      });
      await fetchPortions();
    } catch (e: unknown) {
      onErrorRef.current?.(axiosErrorMessage(e) || 'Failed to save portion');
    } finally {
      setRowBusy(null);
    }
  };

  const deletePortion = async (portionId: number, displayName: string) => {
    if (!menuItemId) return;
    if (!confirm(`Delete portion "${displayName}"?`)) return;

    setRowBusy(portionId);
    onErrorRef.current?.(null);
    try {
      await api.delete(`/menu-items/${menuItemId}/portions/${portionId}`);
      await fetchPortions();
    } catch (e: unknown) {
      onErrorRef.current?.(axiosErrorMessage(e) || 'Failed to delete portion');
    } finally {
      setRowBusy(null);
    }
  };

  const updatePortionEdit = (portionId: number, patch: Partial<PortionEditState>) => {
    setPortionEdits((prev) => ({
      ...prev,
      [portionId]: { ...prev[portionId], ...patch },
    }));
  };

  const isPortionCollapsed = (portionId: number) => collapsedPortions[portionId] ?? true;

  const togglePortionCollapsed = (portionId: number) => {
    setCollapsedPortions((prev) => ({
      ...prev,
      [portionId]: !(prev[portionId] ?? true),
    }));
  };

  const allPortionsCollapsed =
    portions.length > 0 && portions.every((p) => isPortionCollapsed(p.id));

  const toggleAllPortionsCollapsed = () => {
    const collapseAll = !allPortionsCollapsed;
    setCollapsedPortions(() => {
      const next: Record<number, boolean> = {};
      for (const p of portions) {
        next[p.id] = collapseAll;
      }
      return next;
    });
  };

  const portionListControlsDisabled = disabled || loading || savingNewPortion;
  const showPortionListExpandAll = !loading && portions.length > 0;

  if (awaitingSave || itemId == null || itemId < 1) {
    return (
      <div
        className="flex w-full flex-col gap-2 border-t border-[var(--border)] pt-3 opacity-50 pointer-events-none"
        aria-disabled
      >
        <PortionSizesHeader />
        <p className="text-xs leading-snug text-[var(--text-secondary)]">
          Save the dish first, then you can add portion sizes.
        </p>
        <p className="text-xs text-[var(--text-secondary)]">No portion sizes yet.</p>
        <button
          type="button"
          className="admin-btn-secondary self-start py-0.5 px-2 text-xs"
          disabled
        >
          + Add portion size
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 border-t border-[var(--border)] pt-3">
      <PortionSizesHeader
        showExpandAll={showPortionListExpandAll}
        allCollapsed={allPortionsCollapsed}
        onToggleAll={toggleAllPortionsCollapsed}
        disabled={portionListControlsDisabled}
      />

      {loading ? (
        <p className="text-xs text-[var(--text-secondary)]">Loading portions…</p>
      ) : portions.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">No portion sizes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {portions.map((portion) => {
            const edit = portionEdits[portion.id];
            if (!edit) return null;
            const busy = rowBusy === portion.id;
            const displayName = resolveNameFromEdit(edit) ?? portion.name;
            const collapsed = isPortionCollapsed(portion.id);
            const rowDisabled = disabled || busy || savingNewPortion;
            return (
              <li
                key={portion.id}
                className="rounded border border-[var(--border)] bg-[var(--background)]"
              >
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <button
                    type="button"
                    className="admin-btn-ghost shrink-0 px-1 py-0 text-xs"
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? `Expand ${displayName}` : `Collapse ${displayName}`}
                    disabled={rowDisabled}
                    onClick={() => togglePortionCollapsed(portion.id)}
                  >
                    {collapsed ? '▶' : '▼'}
                  </button>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left text-xs"
                    disabled={rowDisabled}
                    onClick={() => togglePortionCollapsed(portion.id)}
                  >
                    <span className="truncate font-medium text-[var(--text-primary)]">
                      {displayName}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">
                      LKR {edit.price || '—'}
                    </span>
                    {!edit.is_available ? (
                      <span className="shrink-0 text-xs text-[var(--text-secondary)]">
                        Unavailable
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="admin-btn-danger-text shrink-0 px-1.5 py-0.5 text-xs"
                    title="Delete portion"
                    disabled={rowDisabled}
                    onClick={() => void deletePortion(portion.id, displayName)}
                  >
                    🗑
                  </button>
                </div>

                {!collapsed ? (
                  <div className="flex flex-col gap-2 border-t border-[var(--border)] p-2">
                    <div className="flex flex-wrap items-start gap-2">
                      <PortionNameFields
                        edit={edit}
                        disabled={rowDisabled}
                        onChange={(patch) => updatePortionEdit(portion.id, patch)}
                      />
                      <div className="w-28">
                        <label className="admin-label text-xs">Price (LKR)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="admin-input mt-0.5 w-full py-0.5 text-xs tabular-nums"
                          placeholder="0.00"
                          value={edit.price}
                          disabled={rowDisabled}
                          onChange={(e) =>
                            updatePortionEdit(portion.id, { price: e.target.value })
                          }
                        />
                      </div>
                      <PortionServesField
                        value={edit.serves}
                        disabled={rowDisabled}
                        onChange={(serves) => updatePortionEdit(portion.id, { serves })}
                      />
                      <label className="flex cursor-pointer items-center gap-1 self-end pb-0.5 text-xs text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={edit.is_available}
                          disabled={rowDisabled}
                          onChange={(e) =>
                            updatePortionEdit(portion.id, { is_available: e.target.checked })
                          }
                        />
                        Available
                      </label>
                    </div>
                    <button
                      type="button"
                      className="admin-btn-secondary self-start py-0.5 px-2 text-xs"
                      disabled={rowDisabled}
                      onClick={() => void saveExistingPortion(portion.id)}
                    >
                      {busy ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {showNewPortionForm ? (
        <div className="flex flex-col gap-2 rounded border border-dashed border-[var(--border)] bg-[var(--background)] p-2">
          <p className="text-xs font-medium text-[var(--text-primary)]">New portion size</p>
          <div className="flex flex-wrap items-start gap-2">
            <PortionNameFields
              edit={newPortion}
              disabled={disabled || savingNewPortion}
              onChange={(patch) => setNewPortion((prev) => ({ ...prev, ...patch }))}
            />
            <div className="w-28">
              <label className="admin-label text-xs">Price (LKR)</label>
              <input
                type="text"
                inputMode="decimal"
                className="admin-input mt-0.5 w-full py-0.5 text-xs tabular-nums"
                placeholder="0.00"
                value={newPortion.price}
                disabled={disabled || savingNewPortion}
                onChange={(e) => setNewPortion((prev) => ({ ...prev, price: e.target.value }))}
              />
            </div>
            <PortionServesField
              value={newPortion.serves}
              disabled={disabled || savingNewPortion}
              onChange={(serves) => setNewPortion((prev) => ({ ...prev, serves }))}
            />
            <label className="flex cursor-pointer items-center gap-1 self-end pb-0.5 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={newPortion.is_available}
                disabled={disabled || savingNewPortion}
                onChange={(e) =>
                  setNewPortion((prev) => ({ ...prev, is_available: e.target.checked }))
                }
              />
              Available
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="admin-btn-primary py-0.5 px-2 text-xs"
              disabled={disabled || savingNewPortion}
              onClick={() => void saveNewPortion()}
            >
              {savingNewPortion ? 'Saving…' : 'Save portion'}
            </button>
            <button
              type="button"
              className="admin-btn-secondary py-0.5 px-2 text-xs"
              disabled={savingNewPortion}
              onClick={() => {
                resetNewPortionForm();
                setShowNewPortionForm(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="admin-btn-secondary self-start py-0.5 px-2 text-xs"
        disabled={disabled || loading}
        onClick={() => {
          resetNewPortionForm();
          setShowNewPortionForm(true);
        }}
      >
        + Add portion size
      </button>
    </div>
  );
}
