'use client';
import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createClientSupabase } from '@/lib/supabase/client';
import { ProfileForm } from '@/components/coach/ProfileForm';
import { KycDocList } from '@/components/coach/KycDocList';
import { KycStatusChip } from '@/components/coach/KycStatusChip';
import { saveProfile, saveKyc, type CoachIdentityState } from '@/actions/coach-identity';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const profileInitial: CoachIdentityState = { status: 'idle', message: '' };
const kycInitial: CoachIdentityState = { status: 'idle', message: '' };

export function SettingsClient({
  userId,
  initialProfile,
}: {
  userId: string;
  initialProfile: Record<string, unknown> | null;
}) {
  const t = useTranslations('Settings');
  const [jwt, setJwt] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClientSupabase();
    supabase.auth.getSession().then((result: { data: { session: { access_token: string } | null } }) => {
      setJwt(result.data.session?.access_token ?? null);
    });
  }, []);

  const [profileState, profileAction, profilePending] = useActionState(saveProfile, profileInitial);
  const [kycState, kycAction, kycPending] = useActionState(saveKyc, kycInitial);
  const [kycDocs, setKycDocs] = useState(
    (initialProfile?.kyc_docs as Parameters<typeof KycDocList>[0]['initial']) ?? []
  );

  if (!jwt) return <div className="text-sm font-normal text-muted">{t('loading')}</div>;

  return (
    <>
      {/* Profile section */}
      <section className="bg-white rounded-2xl p-8 border border-border shadow-sm">
        <h2 className="text-base font-bold text-text mb-5">{t('profileSection')}</h2>
        <form action={profileAction} className="flex flex-col gap-5">
          <ProfileForm
            initial={{
              display_name: (initialProfile?.display_name as string) ?? '',
              bio: (initialProfile?.bio as string) ?? '',
              specialties: (initialProfile?.specialties as string[]) ?? [],
              website: (initialProfile?.website as string) ?? '',
              photo_url: (initialProfile?.photo_url as string) ?? null,
            }}
            userId={userId}
            apiUrl={API_URL}
            jwt={jwt}
          />
          {profileState.status !== 'idle' && (
            <p
              role="alert"
              className={`text-sm font-normal ${
                profileState.status === 'success' ? 'text-primary' : 'text-danger'
              }`}
            >
              {profileState.message}
            </p>
          )}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={profilePending}
              className="h-11 px-6 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {profilePending ? t('saving') : t('saveCta')}
            </button>
          </div>
        </form>
      </section>

      {/* KYC section */}
      <section className="bg-white rounded-2xl p-8 border border-border shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-base font-bold text-text">{t('kycSection')}</h2>
          <KycStatusChip status={(initialProfile?.kyc_status as string) ?? 'pending'} />
        </div>
        <form action={kycAction} className="flex flex-col gap-5">
          <input type="hidden" name="kyc_docs" value={JSON.stringify(kycDocs)} />
          <KycDocList
            userId={userId}
            apiUrl={API_URL}
            jwt={jwt}
            initial={kycDocs}
            onChange={setKycDocs}
          />
          {kycState.status !== 'idle' && (
            <p
              role="alert"
              className={`text-sm font-normal ${
                kycState.status === 'success' ? 'text-primary' : 'text-danger'
              }`}
            >
              {kycState.message}
            </p>
          )}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={kycPending}
              className="h-11 px-6 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {kycPending ? t('saving') : t('saveCta')}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
