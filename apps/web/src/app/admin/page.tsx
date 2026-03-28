import { redirect } from 'next/navigation';

/** Visiting /admin sends you to the main admin dashboard. */
export default function AdminIndexPage() {
  redirect('/admin/restaurants');
}
