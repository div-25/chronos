"use client";

import { TimerControl } from "@/components/timer/TimerControl";
import { ProjectsList } from "@/components/projects/ProjectsList";

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Chronos Dashboard</h1>
      </div>
      <TimerControl />
      <ProjectsList />
    </main>
  );
}
