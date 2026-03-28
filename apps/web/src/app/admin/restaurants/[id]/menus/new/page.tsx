import { redirect } from 'next/navigation';

/** Multi-menu creation removed from UI; use menu editor (auto-creates default if needed). */
export default async function AdminNewMenuRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/restaurants/${id}/menu`);
}
