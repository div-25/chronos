"use client";

import { TagStats } from '@/components/timer/TagStats';

export default function StatisticsPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Chronos Statistics</h1>
      </div>
      <TagStats />
    </main>
  );
} 