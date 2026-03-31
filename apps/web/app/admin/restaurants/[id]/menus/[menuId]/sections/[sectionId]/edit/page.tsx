'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { MenuSection } from '@/types/menu';

export default function EditSectionPage() {
  const params = useParams();
  const router = useRouter();
  const restaurantId = Number(params.id);
  const menuId = Number(params.menuId);
  const sectionId = Number(params.sectionId);
  const [name, setName] = useState('');
  const [sort_order, setSortOrder] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Number.isNaN(menuId) || Number.isNaN(sectionId)) return;
    api
      .get<{ menu_sections: MenuSection[] }>(`/menus/${menuId}`)
      .then((res) => {
        const section = res.data.menu_sections?.find((s) => s.id === sectionId);
        if (section) {
          setName(section.name);
          setSortOrder(section.sort_order ?? 0);
        } else {
          setLoadError('Section not found');
        }
      })
      .catch(() => setLoadError('Failed to load menu'));
  }, [menuId, sectionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    api
      .patch(`/menus/${menuId}/sections/${sectionId}`, { name: name.trim(), sort_order })
      .then(() => {
        router.push(`/admin/restaurants/${restaurantId}/menu`);
        router.refresh();
      })
      .catch((err: unknown) => {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
            : null;
        setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to update section');
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

  return (
    <div>
      <div className="mb-6">
        <Link href={`/admin/restaurants/${restaurantId}/menu`} className="admin-link">
          ← Back to menu
        </Link>
      </div>
      <h1 className="admin-heading-1 mb-6">Edit section</h1>
      {error && <p className="admin-text-error mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="max-w-md space-y-5">
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
        <button type="submit" disabled={loading} className="admin-btn-primary">
          {loading ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
