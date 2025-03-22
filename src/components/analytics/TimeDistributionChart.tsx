"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTimeStore } from "@/store/timeStore";
import { Project } from "@/lib/db";
import { formatDateInMMDD, toLocalTime } from "@/lib/utils";

interface ChartData {
  date: string;
  minutes: number;
  movingAverage?: number;
}

export function TimeDistributionChart() {
  const [selectedPeriod, setSelectedPeriod] = useState<
    "week" | "month" | "year"
  >("week");
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const { getRecentEntries } = useTimeStore();

  useEffect(() => {
    const prepareChartData = async () => {
      const entries = await getRecentEntries();
      const dateMap = new Map<string, number>();
      const endDate = toLocalTime(new Date());
      const startDate = new Date(endDate);

      // Set end date to end of current day in local time
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
      // Set start date to beginning of day in local time
      startDate.setHours(0, 0, 0, 0);

      console.log("Start date for stats: ", startDate);
      console.log("End date for stats: ", endDate);

      // Initialize all dates in range with 0 minutes
      for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
        dateMap.set(formatDateInMMDD(d), 0);
      }

      // Aggregate minutes per day
      entries.forEach((entry: Project) => {
        entry.segments.forEach((segment) => {
          const localDate = toLocalTime(new Date(segment.startTime));
          const dateKey = formatDateInMMDD(localDate);
          if (dateMap.has(dateKey)) {
            const minutes = Math.floor((segment.duration || 0) / 60);
            dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + minutes);
          }
        });
      });

      // Convert to array and sort by date
      const data: ChartData[] = Array.from(dateMap)
        .map(([date, minutes]) => ({
          date,
          minutes,
        }))
        .sort((a, b) => {
          const [aMonth, aDay] = a.date.split("/").map(Number);
          const [bMonth, bDay] = b.date.split("/").map(Number);
          // First compare months
          if (aMonth !== bMonth) {
            return aMonth - bMonth;
          }
          // If months are same, compare days
          return aDay - bDay;
        });

      // Calculate 7-day moving average if enabled
      if (showMovingAverage) {
        const windowSize = 7;
        data.forEach((point, index) => {
          if (index >= windowSize - 1) {
            const window = data.slice(index - windowSize + 1, index + 1);
            const sum = window.reduce((acc, curr) => acc + curr.minutes, 0);
            point.movingAverage = sum / windowSize;
          }
        });
      }
      console.log("Chart data: ", data);
      setChartData(data);
    };

    prepareChartData();
  }, [getRecentEntries, selectedPeriod, showMovingAverage]);

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg mb-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Time Distribution</h2>
        <div className="flex space-x-4">
          {selectedPeriod !== "week" && (
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showMovingAverage}
                onChange={(e) => setShowMovingAverage(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
              />
              <span className="text-sm text-gray-300">Show 7-day average</span>
            </label>
          )}
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

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => {
                return date;
              }}
              stroke="#9CA3AF"
            />
            <YAxis
              stroke="#9CA3AF"
              tickFormatter={(minutes) =>
                `${Math.floor(minutes / 60)}h ${minutes % 60}m`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
              }}
              labelFormatter={(date) => {
                const [month, day] = date.split("/").map(Number);
                const monthNames = [
                  "January",
                  "February",
                  "March",
                  "April",
                  "May",
                  "June",
                  "July",
                  "August",
                  "September",
                  "October",
                  "November",
                  "December",
                ];
                return `${monthNames[month - 1]} ${day}`;
              }}
              formatter={(value: number) => [
                `${Math.floor(value / 60)}h ${value % 60}m`,
                "Time",
              ]}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="minutes"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.2}
              name="Minutes worked"
            />
            {showMovingAverage && (
              <Area
                type="monotone"
                dataKey="movingAverage"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.1}
                name="7-day average"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
