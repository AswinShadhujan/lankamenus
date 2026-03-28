import { redirect } from 'next/navigation';

/** Menu name/settings UI removed; editor is the single entry point. */
export default async function AdminMenuSettingsRedirect({
  params,
}: {
  params: Promise<{ id: string; menuId: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/restaurants/${id}/menu`);
}
