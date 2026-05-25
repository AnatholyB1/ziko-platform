'use server';

import { headers } from 'next/headers';
import { ratelimit } from '@/lib/ratelimit';
import { createAdminClient } from '@/lib/supabase/admin';

export type DeleteAccountState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

async function findUserIdByEmail(email: string): Promise<string | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseUrl = process.env.SUPABASE_URL!;

  try {
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (res.ok) {
      const json = await res.json();
      const users: Array<{ id: string; email?: string }> = json.users ?? json;
      const found = users.find(
        (u) => u.email?.toLowerCase() === email
      );
      return found?.id ?? null;
    }
  } catch {
    // fall through to listUsers fallback
  }

  // Fallback: listUsers
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
}

export async function deleteAccount(
  prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  // Rate limit by IP
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return {
      status: 'error',
      message: 'Trop de tentatives. Réessayez dans une minute.',
    };
  }

  // Validate form fields
  const rawEmail = formData.get('email');
  const confirmation = formData.get('confirmation');

  const email =
    typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

  if (!email || confirmation !== 'SUPPRIMER') {
    return { status: 'error', message: 'Formulaire invalide.' };
  }

  // Find user (anti-enumeration: return success even if not found)
  const userId = await findUserIdByEmail(email);

  if (!userId) {
    return {
      status: 'success',
      message: 'Si ce compte existe, il a été supprimé.',
    };
  }

  // Delete user
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    return {
      status: 'error',
      message: 'Erreur lors de la suppression. Contactez le support.',
    };
  }

  return {
    status: 'success',
    message: 'Votre compte a été supprimé définitivement.',
  };
}
