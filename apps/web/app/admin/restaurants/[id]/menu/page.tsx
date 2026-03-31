import Link from 'next/link';
import { MenuEditor } from '@/components/admin/MenuEditor';

export default async function AdminRestaurantMenuEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const restaurantId = Number(id);

  if (Number.isNaN(restaurantId)) {
    return (
      <div>
        <p className="admin-text-error">Invalid restaurant id</p>
        <Link href="/admin/restaurants" className="admin-link mt-3 inline-block text-xs">
          Back to restaurants
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/restaurants" className="admin-link text-xs">
          ← Back to restaurants
        </Link>
      </div>
      <MenuEditor restaurantId={restaurantId} />
    </div>
  );
}
