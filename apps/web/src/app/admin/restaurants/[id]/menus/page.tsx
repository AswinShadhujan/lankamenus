import { redirect } from 'next/navigation';

/** Legacy URL — single-menu admin UX uses `/menu` only. */
export default async function AdminRestaurantMenusRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/restaurants/${id}/menu`);
}
