'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IoDocumentTextOutline } from 'react-icons/io5';
import { gsap } from 'gsap';
import { CoachForm } from '@/components/coach/FormStatusBadge';
import { FormCard } from '@/components/coach/FormCard';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FormsListClientProps {
  forms: CoachForm[];
  locale: string;
  accessToken: string;
  apiUrl: string;
}

// ─── FormsListClient ──────────────────────────────────────────────────────────

export default function FormsListClient({ forms: initialForms, locale, accessToken, apiUrl }: FormsListClientProps) {
  const router = useRouter();
  const [forms, setForms] = useState<CoachForm[]>(initialForms);
  const [isLoading, setIsLoading] = useState(false);

  // GSAP entrance animation — fires once on mount when forms exist
  useEffect(() => {
    if (forms.length > 0) {
      gsap.from('.form-row', {
        y: 12,
        opacity: 0,
        duration: 0.2,
        stagger: 0.04,
        ease: 'power2.out',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GSAP skeleton pulse — fires when isLoading changes to true
  useEffect(() => {
    if (isLoading) {
      gsap.to('.skeleton', {
        opacity: 0.5,
        duration: 0.75,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
    } else {
      gsap.killTweensOf('.skeleton');
    }
  }, [isLoading]);

  // ─── Navigation callbacks ──────────────────────────────────────────────────

  const handleEdit = (id: string) => {
    router.push(`/${locale}/coach/forms/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/${locale}/coach/forms/${id}`);
  };

  const handlePublish = (id: string) => {
    router.push(`/${locale}/coach/forms/${id}`);
  };

  const handleArchive = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/forms/coach/forms/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: 'archived' }),
      });

      if (res.ok) {
        setForms((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: 'archived' as const } : f))
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Loading skeleton ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[60, 45, 52].map((w, i) => (
          <div
            key={i}
            className="skeleton bg-[#E2E0DA] rounded-xl h-11"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────────────

  if (forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <IoDocumentTextOutline size={48} className="text-[#E2E0DA]" />
        <h2 className="text-[22px] font-bold text-text">
          Aucun formulaire pour l&apos;instant
        </h2>
        <p className="text-sm text-muted">
          Créez votre premier formulaire conditionnel pour vos athlètes.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/coach/forms/new`)}
          className="bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold mt-2"
        >
          + Créer un formulaire
        </button>
      </div>
    );
  }

  // ─── Populated table ──────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[28px] font-bold text-text">Formulaires</h1>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/coach/forms/new`)}
          className="bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold"
        >
          + Nouveau formulaire
        </button>
      </div>

      {/* Table card */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-xs font-bold text-muted uppercase tracking-wider px-4 py-3 text-left">
                Titre
              </th>
              <th className="text-xs font-bold text-muted uppercase tracking-wider px-4 py-3 text-left">
                Statut
              </th>
              <th className="text-xs font-bold text-muted uppercase tracking-wider px-4 py-3 text-left">
                Déclencheur
              </th>
              <th className="text-xs font-bold text-muted uppercase tracking-wider px-4 py-3 text-left">
                Date
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                locale={locale}
                onEdit={handleEdit}
                onPublish={handlePublish}
                onArchive={handleArchive}
                onView={handleView}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
