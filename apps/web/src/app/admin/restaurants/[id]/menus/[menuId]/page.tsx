import { redirect } from 'next/navigation';

/** Legacy URL — editor no longer uses menu id in path. */
export default async function AdminLegacyMenuPage({
  params,
}: {
  params: Promise<{ id: string; menuId: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/restaurants/${id}/menu`);
}
