"use client";

import { useState, useEffect, useRef } from "react";
import { useTimeStore } from "@/store/timeStore";
import { toLocalTime } from "@/lib/utils";
import { WordCloud } from "@isoterik/react-word-cloud";
import type { Word, SpiralValue } from "@isoterik/react-word-cloud";
function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TagWordCloud() {
  const [wordsData, setWordsData] = useState<Word[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState(new Date());
  const { getAllProjects } = useTimeStore();

  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    const calculateTagFrequency = async () => {
      const entries = await getAllProjects();
      const tagCount = new Map<string, number>();
      const localStartOfDay = new Date(startDate);
      const localEndOfDay = new Date(endDate);

      localStartOfDay.setHours(0, 0, 0, 0);
      localEndOfDay.setHours(23, 59, 59, 999);

      entries.forEach((entry) => {
        if (!entry.segments?.length) return;

        entry.segments.forEach((segment) => {
          const segmentStartDate = toLocalTime(new Date(segment.startTime));
          const segmentEndDate = segment.endTime
            ? toLocalTime(new Date(segment.endTime))
            : new Date();

          if (
            segmentStartDate > localEndOfDay ||
            segmentEndDate < localStartOfDay
          )
            return;

          const effectiveStart =
            segmentStartDate < localStartOfDay
              ? localStartOfDay
              : segmentStartDate;
          const effectiveEnd =
            segmentEndDate > localEndOfDay ? localEndOfDay : segmentEndDate;
          const durationMinutes =
            (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60);

          entry.tags.forEach((tag) => {
            tagCount.set(tag, (tagCount.get(tag) || 0) + durationMinutes);
          });
        });
      });

      setWordsData(
        Array.from(tagCount.entries()).map(([tag, count]) => ({
          text: tag,
          value: count,
        }))
      );
    };

    calculateTagFrequency();
  }, [getAllProjects, startDate, endDate]);

  // --- WordCloud Configuration Props (Directly Passed) ---

  const resolveFontSize = (word: Word): number => {
    const containerArea = containerSize.width * containerSize.height;
    const minPx = Math.max(14, Math.sqrt(containerArea) * 0.02);
    const maxPx = Math.max(80, Math.sqrt(containerArea) * 0.08);

    if (wordsData.length === 0) return minPx;

    const values = wordsData.map((w) => w.value);
    const minValue = Math.min(...values, 1);
    const maxValue = Math.max(...values, 1);

    if (maxValue === minValue) return (minPx + maxPx) / 2;

    const logValue = Math.log2(word.value || 1) + 1;
    const logMinValue = Math.log2(minValue || 1) + 1;
    const logMaxValue = Math.log2(maxValue || 1) + 1;

    if (logMaxValue === logMinValue) return (minPx + maxPx) / 2;

    return (
      minPx +
      ((logValue - logMinValue) / (logMaxValue - logMinValue)) * (maxPx - minPx)
    );
  };

  const resolveFillColor = (): string => {
    const colors = ["#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8", "#1E40AF"];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const resolveRotation = () => 0;

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 sm:gap-0">
        <h2 className="text-2xl font-bold">Tag Cloud</h2>
        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          {/* Date inputs remain the same */}
          <div className="flex items-center space-x-2">
            <label htmlFor="startDateCloud" className="text-sm text-gray-400">
              From:
            </label>
            <input
              id="startDateCloud"
              type="date"
              value={formatDateToYYYYMMDD(startDate)}
              onChange={(e) => {
                const [year, month, day] = e.target.value
                  .split("-")
                  .map(Number);
                setStartDate(new Date(year, month - 1, day));
              }}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="endDateCloud" className="text-sm text-gray-400">
              To:
            </label>
            <input
              id="endDateCloud"
              type="date"
              value={formatDateToYYYYMMDD(endDate)}
              onChange={(e) => {
                const [year, month, day] = e.target.value
                  .split("-")
                  .map(Number);
                setEndDate(new Date(year, month - 1, day));
              }}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Container for WordCloud - its dimensions will be passed to WordCloud */}
      <div
        ref={containerRef}
        className="h-[400px] w-full bg-gray-750 rounded-md overflow-hidden"
      >
        {wordsData.length > 0 &&
        containerSize.width > 0 &&
        containerSize.height > 0 ? (
          <WordCloud
            words={wordsData}
            width={containerSize.width} // Use dynamic width from container
            height={containerSize.height} // Use dynamic height from container
            font="Inter"
            fontSize={resolveFontSize} // CRITICAL for size
            fontWeight="bold"
            padding={Math.max(
              5,
              Math.sqrt(containerSize.width * containerSize.height) * 0.01
            )} // Dynamic padding
            rotate={resolveRotation}
            fill={resolveFillColor}
            spiral={"rectangular" as SpiralValue}
            // enableTooltip={true} // Optional: if you want tooltips
            // transition="all .3s ease" // Optional: default is "all .5s ease"
            // timeInterval={10} // Optional: default is 1ms, can increase if layout is slow and UI freezes
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-400 text-lg">
              {containerSize.width === 0
                ? "Loading dimensions..."
                : "No tags found for the selected period."}
            </p>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-400 text-center mt-4">
        The size of each tag represents the total time spent on tasks with that
        tag during the selected period.
      </p>
    </div>
  );
}
