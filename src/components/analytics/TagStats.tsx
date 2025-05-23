"use client";

import { useState, useEffect, useMemo } from "react";
import { useTimeStore } from "@/store/timeStore";
import { TimeEntry } from "@/lib/db";
import { formatDuration } from "@/lib/utils";

interface TagStat {
  tag: string;
  totalDuration: number;
  entryCount: number;
}

export function TagStats() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getAllProjects } = useTimeStore();
  const [selectedPeriod, setSelectedPeriod] = useState<
    "day" | "week" | "month" | "all"
  >("week");

  useEffect(() => {
    const loadEntries = async () => {
      try {
        setIsLoading(true);
        const recentEntries = await getAllProjects();
        setEntries(recentEntries);
      } catch (error) {
        console.error("Error loading entries:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEntries();

    // Set up interval to refresh entries
    const refreshInterval = setInterval(() => {
      loadEntries();
    }, 30000); // Refresh every 30 seconds

    // Clean up interval on component unmount
    return () => {
      clearInterval(refreshInterval);
    };
  }, [getAllProjects]);

  const filteredEntries = useMemo(() => {
    if (selectedPeriod === "all") {
      return entries;
    }

    const now = new Date();
    const cutoffDate = new Date();

    switch (selectedPeriod) {
      case "day":
        cutoffDate.setDate(now.getDate() - 1);
        break;
      case "week":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "month":
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
    }

    return entries.filter((entry) => {
      // Use the most recent segment's start time for filtering
      if (entry.segments.length === 0) return false;
      const latestSegment = entry.segments[entry.segments.length - 1];
      const segmentDate = new Date(latestSegment.startTime);
      return segmentDate >= cutoffDate;
    });
  }, [entries, selectedPeriod]);

  const tagStats = useMemo(() => {
    const stats = new Map<string, TagStat>();

    filteredEntries.forEach((entry) => {
      if (!entry.tags || entry.tags.length === 0) {
        // Handle entries without tags
        const untaggedKey = "Untagged";
        const existing = stats.get(untaggedKey) || {
          tag: untaggedKey,
          totalDuration: 0,
          entryCount: 0,
        };
        stats.set(untaggedKey, {
          ...existing,
          totalDuration: existing.totalDuration + entry.duration,
          entryCount: existing.entryCount + 1,
        });
        return;
      }

      // Process each tag in the entry
      entry.tags.forEach((tag) => {
        const existing = stats.get(tag) || {
          tag,
          totalDuration: 0,
          entryCount: 0,
        };
        stats.set(tag, {
          ...existing,
          totalDuration: existing.totalDuration + entry.duration,
          entryCount: existing.entryCount + 1,
        });
      });
    });

    // Convert to array and sort by duration (descending)
    return Array.from(stats.values()).sort(
      (a, b) => b.totalDuration - a.totalDuration
    );
  }, [filteredEntries]);

  // Calculate total time across all tags
  const totalTime = useMemo(() => {
    return tagStats.reduce((total, stat) => total + stat.totalDuration, 0);
  }, [tagStats]);

  // Calculate average time per entry
  const averageTimePerEntry = useMemo(() => {
    const totalEntries = filteredEntries.length;
    return totalEntries > 0 ? Math.floor(totalTime / totalEntries) : 0;
  }, [totalTime, filteredEntries]);

  // Calculate total entries count
  const totalEntries = useMemo(() => {
    return filteredEntries.length;
  }, [filteredEntries]);

  if (isLoading && entries.length === 0) {
    return (
      <div className="p-8 bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading statistics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Tag Statistics</h2>
          <div className="flex space-x-2">
            <select
              value={selectedPeriod}
              onChange={(e) =>
                setSelectedPeriod(
                  e.target.value as "day" | "week" | "month" | "all"
                )
              }
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="day">Last 24 hours</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>

        {tagStats.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-lg">
              No data available for the selected period.
            </p>
            <p className="text-gray-500 mt-2">
              Try selecting a different time period or add some tagged entries.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 p-4 rounded-lg">
                <p className="text-sm text-gray-400">Total Time</p>
                <p className="text-2xl font-mono">
                  {formatDuration(totalTime)}
                </p>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg">
                <p className="text-sm text-gray-400">Total Entries</p>
                <p className="text-2xl font-mono">{totalEntries}</p>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg">
                <p className="text-sm text-gray-400">Average Time/Entry</p>
                <p className="text-2xl font-mono">
                  {formatDuration(averageTimePerEntry)}
                </p>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg">
                <p className="text-sm text-gray-400">Unique Tags</p>
                <p className="text-2xl font-mono">{tagStats.length}</p>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">
                Time Distribution by Tag
              </h3>
              <div className="space-y-3">
                {tagStats.map((stat) => (
                  <div key={stat.tag} className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        <span className="font-medium text-lg">{stat.tag}</span>
                        <span className="ml-2 text-xs bg-blue-900 px-2 py-0.5 rounded-full">
                          {stat.entryCount}{" "}
                          {stat.entryCount === 1 ? "entry" : "entries"}
                        </span>
                      </div>
                      <span className="font-mono text-lg">
                        {formatDuration(stat.totalDuration)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full"
                        style={{
                          width: `${(stat.totalDuration / totalTime) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>
                        {Math.round((stat.totalDuration / totalTime) * 100)}% of
                        total time
                      </span>
                      <span>
                        Avg:{" "}
                        {formatDuration(
                          Math.floor(stat.totalDuration / stat.entryCount)
                        )}{" "}
                        per entry
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">Summary</h3>
              <p className="text-gray-300">
                During this period, you spent most of your time on{" "}
                <span className="font-semibold text-white">
                  {tagStats[0]?.tag}
                </span>{" "}
                ({formatDuration(tagStats[0]?.totalDuration)}), which accounts
                for {Math.round((tagStats[0]?.totalDuration / totalTime) * 100)}
                % of your tracked time.
              </p>
              {tagStats.length > 1 && (
                <p className="text-gray-300 mt-2">
                  Your second most time-consuming activity was{" "}
                  <span className="font-semibold text-white">
                    {tagStats[1]?.tag}
                  </span>{" "}
                  ({formatDuration(tagStats[1]?.totalDuration)}), accounting for{" "}
                  {Math.round((tagStats[1]?.totalDuration / totalTime) * 100)}%
                  of your tracked time.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
