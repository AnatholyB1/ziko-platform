'use client';

import { useState } from 'react';
import { DashboardControlBar } from '@/components/coach/dashboard/DashboardControlBar';
import { DashboardEmptyState } from '@/components/coach/dashboard/DashboardEmptyState';
import { PowerliftingDashboard } from '@/components/coach/dashboard/PowerliftingDashboard';

type SportType = 'powerlifting' | 'hyrox' | 'running' | 'bodybuilding' | 'weightloss';

export default function DashboardPage({ params }: { params: { id: string } }) {
  const [sport, setSport] = useState<SportType | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | '3m'>('month');

  return (
    <div className="px-8 py-6">
      <DashboardControlBar
        sport={sport}
        onSportChange={setSport}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
      {sport === null && <DashboardEmptyState prompt={true} />}
      {sport === 'powerlifting' && (
        <PowerliftingDashboard clientId={params.id} sport={sport} dateRange={dateRange} />
      )}
    </div>
  );
}
