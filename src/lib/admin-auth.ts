// Accès réservé à /admin et /api/admin/* : adresses de la variable serveur ADMIN_EMAILS.
import type { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';

export async function estAdmin(request: NextRequest): Promise<boolean> {
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const { user } = await getAuthUser(request);
  return !!user?.email && admins.includes(user.email.toLowerCase());
}
