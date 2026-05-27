'use client';

import { useState } from 'react';
import { DashboardControlBar } from '@/components/coach/dashboard/DashboardControlBar';
import { DashboardEmptyState } from '@/components/coach/dashboard/DashboardEmptyState';
import { PowerliftingDashboard } from '@/components/coach/dashboard/PowerliftingDashboard';
import { HyroxDashboard } from '@/components/coach/dashboard/HyroxDashboard';
import { RunningDashboard } from '@/components/coach/dashboard/RunningDashboard';
import { BodybuildingDashboard } from '@/components/coach/dashboard/BodybuildingDashboard';
import { WeightLossDashboard } from '@/components/coach/dashboard/WeightLossDashboard';

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
      {sport === 'hyrox' && (
        <HyroxDashboard clientId={params.id} sport={sport} dateRange={dateRange} />
      )}
      {sport === 'running' && (
        <RunningDashboard clientId={params.id} sport={sport} dateRange={dateRange} />
      )}
      {sport === 'bodybuilding' && (
        <BodybuildingDashboard clientId={params.id} sport={sport} dateRange={dateRange} />
      )}
      {sport === 'weightloss' && (
        <WeightLossDashboard clientId={params.id} sport={sport} dateRange={dateRange} />
      )}
    </div>
  );
}
