"use client";

import { useState, useEffect } from "react";
import { useTimeStore } from "@/store/timeStore";
import { toLocalTime } from "@/lib/utils";

interface DayData {
  name: string;
  averageMinutes: number;
  percentage: number;
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
};

export function DayOfWeekActivityChart() {
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "year">(
    "month"
  );
  const [chartData, setChartData] = useState<DayData[]>([]);
  const { getAllProjects } = useTimeStore();

  useEffect(() => {
    const prepareChartData = async () => {
      const entries = await getAllProjects();
      const dayTotals = new Array(7).fill(0);
      const dayCounts = new Array(7).fill(0);

      const endDate = new Date();
      const startDate = new Date(endDate);

      endDate.setHours(23, 59, 59, 999);
      switch (selectedPeriod) {
        case "week":
          startDate.setDate(endDate.getDate() - 6);
          break;
        case "month":
          startDate.setDate(endDate.getDate() - 29);
          break;
        case "year":
          startDate.setDate(endDate.getDate() - 364);
          break;
      }
      startDate.setHours(0, 0, 0, 0);

      entries.forEach((entry) => {
        entry.segments.forEach((segment) => {
          if (!segment.duration || segment.duration <= 0) return;

          const segmentDate = toLocalTime(new Date(segment.startTime));
          if (segmentDate >= startDate && segmentDate <= endDate) {
            const dayOfWeek = segmentDate.getDay();
            const minutes = Math.floor(segment.duration / 60);
            dayTotals[dayOfWeek] += minutes;
            dayCounts[dayOfWeek]++;
          }
        });
      });

      // Calculate averages and find maximum
      const averages = dayTotals.map((total, index) =>
        dayCounts[index] ? total / dayCounts[index] : 0
      );
      const maxAverage = Math.max(...averages);

      // Create final data array with percentages
      const data: DayData[] = DAYS_OF_WEEK.map((name, index) => {
        // Convert our Monday-based index to JavaScript's Sunday-based index
        const jsIndex = index === 6 ? 0 : index + 1;
        return {
          name,
          averageMinutes: averages[jsIndex],
          percentage: maxAverage > 0 ? (averages[jsIndex] / maxAverage) * 100 : 0,
        };
      });

      setChartData(data);
    };

    prepareChartData();
  }, [getAllProjects, selectedPeriod]);

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg mb-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Day of Week Activity</h2>
        <div className="flex space-x-4">
          <select
            value={selectedPeriod}
            onChange={(e) =>
              setSelectedPeriod(e.target.value as "week" | "month" | "year")
            }
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
          >
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="year">Last 365 days</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {chartData.map((day) => (
          <div key={day.name} className="flex items-center space-x-3">
            <span className="w-24 text-sm text-gray-400">{day.name}</span>
            <div className="flex-grow h-8 bg-gray-700 rounded-lg overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${day.percentage}%` }}
              ></div>
            </div>
            <span className="w-20 text-right text-sm text-gray-300">
              {formatDuration(day.averageMinutes)}
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-400 text-center mt-6">
        Shows your average working time for each day of the week during the
        selected period. The bars are scaled relative to your most active day.
      </p>
    </div>
  );
}