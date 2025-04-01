"use client";

import { TimeDistributionChart } from '@/components/analytics/TimeDistributionChart';
import { HourlyActivityChart } from '@/components/analytics/HourlyActivityChart';
import { ProjectTimeBreakdown } from '@/components/analytics/ProjectTimeBreakdown';

export default function StatisticsPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Chronos Statistics</h1>
      </div>
      <TimeDistributionChart/>
      <HourlyActivityChart/>
      <ProjectTimeBreakdown/>
    </main>
  );
}