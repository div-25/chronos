"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTimeStore } from "@/store/timeStore";
import { Project } from "@/lib/db";
import { toLocalTime } from "@/lib/utils";

interface HourlyChartData {
  hour: string; // "00", "01", ..., "23"
  averageMinutes: number;
}

// Helper function to format minutes into Hh Mm format
const formatMinutes = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export function HourlyActivityChart() {
  const [selectedPeriod, setSelectedPeriod] = useState<
    "week" | "month" | "year"
  >("week");
  const [chartData, setChartData] = useState<HourlyChartData[]>([]);
  const { getAllProjects } = useTimeStore();

  useEffect(() => {
    const prepareChartData = async () => {
      const entries = await getAllProjects();
      const weekdayHourlyData = new Array(24).fill(0); // Index 0 = 00:00, Index 23 = 23:00

      const endDate = toLocalTime(new Date());
      const startDate = new Date(endDate);
      let numberOfDays = 7; // Default for 'week'

      // Set end date to end of current day in local time
      endDate.setHours(23, 59, 59, 999);
      switch (selectedPeriod) {
        case "week":
          startDate.setDate(endDate.getDate() - 6);
          numberOfDays = 7;
          break;
        case "month":
          startDate.setDate(endDate.getDate() - 29);
          numberOfDays = 30;
          break;
        case "year":
          startDate.setDate(endDate.getDate() - 364);
          numberOfDays = 365;
          break;
      }
      // Set start date to beginning of day in local time
      startDate.setHours(0, 0, 0, 0);

      console.log("Start date for hourly stats: ", startDate);
      console.log("End date for hourly stats: ", endDate);

      // Helper function to get the start of the day (00:00:00.000) in local time
      const getStartOfDay = (date: Date): Date => {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        return start;
      };

      // Helper function to add days to a date
      const addDays = (date: Date, days: number): Date => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
      };

      /**
       * Processes a time range falling *within a single day*, adding the minutes
       * worked during each hour touched by the range to the provided map.
       * @param rangeStart The start timestamp of the range for this day.
       * @param rangeEnd The end timestamp of the range for this day.
       * @param map An array (indexed 0-23) to accumulate minutes per hour.
       */
      const processSingleDayRange = (
        rangeStart: Date,
        rangeEnd: Date,
        map: number[]
      ): void => {
        const currentTime = new Date(rangeStart);

        while (currentTime < rangeEnd) {
          const hour = currentTime.getHours();
          const nextHour = new Date(currentTime);
          nextHour.setHours(hour + 1, 0, 0, 0);

          // Determine the end of the current processing chunk within the hour or range
          const endOfChunk = Math.min(nextHour.getTime(), rangeEnd.getTime());
          const durationMs = endOfChunk - currentTime.getTime();

          if (durationMs > 0) {
            // Accumulate completed minutes within this chunk
            const minutesInChunk = Math.floor(durationMs / (60 * 1000));
            if (minutesInChunk > 0) {
                 map[hour] = (map[hour] || 0) + minutesInChunk;
            }
          }
          // Advance time to the end of the chunk
          currentTime.setTime(endOfChunk);
        }
      };

      // --- Main Processing Loop ---
      entries.forEach((entry: Project) => {
        entry.segments.forEach((segment) => {
          if (!segment.endTime || !segment.duration || segment.duration <= 0) {
             return; // Skip segments without valid end time or duration
          }

          const segmentStartLocal = toLocalTime(new Date(segment.startTime));
          const segmentEndLocal = toLocalTime(new Date(segment.endTime));

          // Clip segment to the analysis window [startDate, endDate)
          // Note: Assuming startDate/endDate define the window boundaries.
          if (segmentEndLocal <= startDate || segmentStartLocal >= endDate) {
            return; // Segment is outside the analysis window
          }

          const effectiveStart = segmentStartLocal < startDate ? startDate : segmentStartLocal;
          const effectiveEnd = segmentEndLocal > endDate ? endDate : segmentEndLocal;

          const startDay = getStartOfDay(effectiveStart);
          const endDay = getStartOfDay(effectiveEnd);

          // Case 1: Segment contained within a single day
          if (startDay.getTime() === endDay.getTime()) {
            processSingleDayRange(effectiveStart, effectiveEnd, weekdayHourlyData); // Use actual map variable
          }
          // Case 2: Segment spans multiple days
          else {
            // 1. Process partial start day
            const endOfStartDay = getStartOfDay(addDays(effectiveStart, 1));
            processSingleDayRange(effectiveStart, endOfStartDay, weekdayHourlyData); // Use actual map variable

            // 2. Process full days between start and end days
            const firstFullDayStart = endOfStartDay;
            const lastDayStart = endDay; // This is the start of the final partial day

            if (firstFullDayStart < lastDayStart) {
              const fullDaysDurationMs = lastDayStart.getTime() - firstFullDayStart.getTime();
              // Calculate full 24h days, using floor is safer for DST transitions
              const numFullDays = Math.floor(fullDaysDurationMs / (24 * 60 * 60 * 1000));

              if (numFullDays > 0) {
                for (let hr = 0; hr < 24; hr++) {
                  weekdayHourlyData[hr] = (weekdayHourlyData[hr] || 0) + numFullDays * 60; // Use actual map variable
                }
              }
            }

            // 3. Process partial end day (if the segment ends after midnight)
            if (effectiveEnd.getTime() > endDay.getTime()) {
                 processSingleDayRange(endDay, effectiveEnd, weekdayHourlyData); // Use actual map variable
            }
          }
        });
      });

      // Calculate average minutes per hour and format for the chart
      const data: HourlyChartData[] = weekdayHourlyData.map((totalMinutes, hour) => {
        const averageMinutes = numberOfDays > 0 ? totalMinutes / numberOfDays : 0;
        return {
          hour: hour.toString().padStart(2, "0"), // Format hour as "00", "01", etc.
          // Clamp average minutes to a max of 60 for visualization, though averages could exceed 60 if tracked across multiple devices simultaneously for >1hr on avg.
          // Or better, let the Y-axis handle scaling beyond 60 if needed, but base interpretation on 60min = 100%.
          // Let's keep the raw average for accuracy. The Y-axis domain will handle display.
          averageMinutes: averageMinutes
        };
      });

      console.log("Hourly chart data: ", data);
      setChartData(data);
    };

    prepareChartData();
  }, [getAllProjects, selectedPeriod]);

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg mb-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Hourly Activity</h2>
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

      <div className="h-[300px] mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 5,
              right: 0,
              left: 0,
              bottom: 5,
            }}
            barCategoryGap="0%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="hour" stroke="#9CA3AF" tickLine={false} axisLine={false} />
            <YAxis
              stroke="#9CA3AF"
              axisLine={false}
              tickLine={false}
              domain={[0, 60]}
              ticks={[0, 15, 30, 45, 60]}
              tickFormatter={(value) => `${value}m`}
            />
            <Tooltip
              cursor={{ fill: 'rgba(110, 110, 110, 0.2)' }} // Subtle hover effect
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: "4px",
              }}
              labelFormatter={() => ''}
              formatter={(value: number) => [
                  `${formatMinutes(value)}`,
                  "Avg. Time / Hour"
              ]}
            />
            <Bar
                dataKey="averageMinutes"
                name="Avg. Time / Hour"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
            >
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-gray-400 text-center">
        Shows how much work you did on average during a given hour of the day. A full bar (reaching 60m) means you worked for the entire hour on average during the selected time period.
      </p>
    </div>
  );
}