'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

export type ExtraCostRow = {
  label: string;
  rate: string;
};

type Props = {
  restaurantId: number;
};

const EMPTY_ROW: ExtraCostRow = { label: '', rate: '' };

export function ExtraCostsEditor({ restaurantId }: Props) {
  const [rows, setRows] = useState<ExtraCostRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    api
      .get<{ id: number; label: string; rate: string | number }[]>(
        `/restaurants/${restaurantId}/extra-costs`,
      )
      .then((res) => {
        const data = res.data ?? [];
        if (data.length === 0) {
          setRows([]);
        } else {
          setRows(
            data.map((c) => ({
              label: c.label,
              rate: String(Number(c.rate)),
            })),
          );
        }
      })
      .catch(() => setLoadError('Failed to load extra costs'));
  }, [restaurantId]);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  }, []);

  const removeRow = useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateRow = useCallback(
    (idx: number, field: keyof ExtraCostRow, value: string) => {
      setRows((prev) =>
        prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  const handleSave = async () => {
    setSaveError(null);
    setSaveOk(false);

    const costs = rows
      .filter((r) => r.label.trim() && r.rate.trim())
      .map((r, i) => ({
        label: r.label.trim(),
        rate: parseFloat(r.rate),
        sort_order: i,
      }));

    const invalid = costs.some((c) => Number.isNaN(c.rate) || c.rate < 0 || c.rate > 100);
    if (invalid) {
      setSaveError('Rate must be a number between 0 and 100.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch<
        { id: number; label: string; rate: string | number }[]
      >(`/restaurants/${restaurantId}/extra-costs`, { costs });
      setRows(
        (res.data ?? []).map((c) => ({
          label: c.label,
          rate: String(Number(c.rate)),
        })),
      );
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch {
      setSaveError('Failed to save extra costs');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return <p className="admin-text-error">{loadError}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="admin-text-muted">
        Add charges like service charge, VAT, etc. Rate is a percentage (e.g. 10 for 10%).
      </p>

      {rows.length === 0 && (
        <p className="admin-text-muted">No extra costs defined.</p>
      )}

      {rows.map((row, idx) => (
        <div key={idx} className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            {idx === 0 && <span className="admin-label">Label</span>}
            <input
              type="text"
              value={row.label}
              onChange={(e) => updateRow(idx, 'label', e.target.value)}
              placeholder="e.g. Service Charge"
              className="admin-input"
              maxLength={100}
            />
          </div>
          <div className="w-28">
            {idx === 0 && <span className="admin-label">Rate %</span>}
            <input
              type="number"
              value={row.rate}
              onChange={(e) => updateRow(idx, 'rate', e.target.value)}
              placeholder="10"
              step="0.1"
              min="0"
              max="100"
              className="admin-input"
            />
          </div>
          <button
            type="button"
            onClick={() => removeRow(idx)}
            className="admin-btn-danger-text mb-0.5"
            aria-label={`Remove ${row.label || 'cost'}`}
          >
            Remove
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={addRow} className="admin-btn-secondary">
          + Add cost
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="admin-btn-primary"
        >
          {saving ? 'Saving…' : 'Save extra costs'}
        </button>
        {saveOk && (
          <span className="text-sm font-medium" style={{ color: 'var(--success-text)' }}>
            Saved ✓
          </span>
        )}
      </div>

      {saveError && <p className="admin-text-error">{saveError}</p>}
    </div>
  );
}
