"use client";

import { TagWordCloud } from "@/components/delight/TagWordCloud";

export default function DelightPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Delightful Insights</h1>
      </div>
      <TagWordCloud />
    </main>
  );
}
