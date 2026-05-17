'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SpecialtyTagInput } from './SpecialtyTagInput';
import { PhotoUpload } from './PhotoUpload';

export interface ProfileFormData {
  display_name: string;
  bio: string;
  specialties: string[];
  website: string;
  photo_url: string | null;
}

export function ProfileForm({
  initial,
  userId,
  apiUrl,
  jwt,
  onChange,
}: {
  initial: Partial<ProfileFormData>;
  userId: string;
  apiUrl: string;
  jwt: string;
  onChange?: (data: ProfileFormData) => void;
}) {
  const t = useTranslations('Onboarding');
  const [display_name, setDisplayName] = useState(initial.display_name ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [specialties, setSpecialties] = useState<string[]>(initial.specialties ?? []);
  const [website, setWebsite] = useState(initial.website ?? '');
  const [photo_url, setPhotoUrl] = useState<string | null>(initial.photo_url ?? null);

  const notify = (update: Partial<ProfileFormData>) => {
    onChange?.({ display_name, bio, specialties, website, photo_url, ...update });
  };

  return (
    <div className="flex flex-col gap-5">
      <PhotoUpload
        userId={userId}
        apiUrl={apiUrl}
        jwt={jwt}
        currentPath={photo_url}
        onUploaded={(p) => {
          setPhotoUrl(p);
          notify({ photo_url: p });
        }}
      />
      {/* Hidden inputs carry values into the parent's Server Action FormData */}
      <input type="hidden" name="photo_url" value={photo_url ?? ''} />
      <input type="hidden" name="specialties" value={JSON.stringify(specialties)} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="display_name" className="text-sm font-bold text-text">
          {t('displayNameLabel')}
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          required
          maxLength={200}
          value={display_name}
          onChange={(e) => {
            setDisplayName(e.target.value);
            notify({ display_name: e.target.value });
          }}
          placeholder={t('displayNamePlaceholder')}
          className="bg-white border border-border rounded-lg px-3 h-11 w-full text-base font-normal text-text focus:outline-none focus:border-text transition-colors placeholder:text-muted"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-sm font-bold text-text">
          {t('bioLabel')}
        </label>
        <textarea
          id="bio"
          name="bio"
          maxLength={5000}
          rows={5}
          value={bio}
          onChange={(e) => {
            setBio(e.target.value);
            notify({ bio: e.target.value });
          }}
          placeholder={t('bioPlaceholder')}
          className="bg-white border border-border rounded-lg px-3 py-3 w-full text-base font-normal text-text focus:outline-none focus:border-text transition-colors placeholder:text-muted resize-none min-h-[120px]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-text">{t('specialtiesLabel')}</label>
        <SpecialtyTagInput
          value={specialties}
          onChange={(tags) => {
            setSpecialties(tags);
            notify({ specialties: tags });
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="website" className="text-sm font-bold text-text">
          {t('websiteLabel')}
        </label>
        <input
          id="website"
          name="website"
          type="url"
          value={website}
          onChange={(e) => {
            setWebsite(e.target.value);
            notify({ website: e.target.value });
          }}
          placeholder="https://…"
          className="bg-white border border-border rounded-lg px-3 h-11 w-full text-base font-normal text-text focus:outline-none focus:border-text transition-colors placeholder:text-muted"
        />
      </div>
    </div>
  );
}
