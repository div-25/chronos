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
  date: string; // "MM/DD" or "YYYY/MM/DD"
  minutes: number;
  movingAverage?: number;
}

const DAY_LABELS = ["M", "T", "W", "Th", "F", "Sa", "S"];

function getLastMonday(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

const getDayIndex = (date: Date): number => (date.getDay() + 6) % 7;

type SelectedPeriodType = "today" | "week" | "month" | "year" | "thisWeek";

const PERIOD_DISPLAY_NAMES: Record<SelectedPeriodType, string> = {
  today: "Today",
  thisWeek: "This Week",
  week: "Last 7 days",
  month: "Last 30 days",
  year: "Last 365 days",
};

export function TimeDistributionChart() {
  const [selectedPeriod, setSelectedPeriod] =
    useState<SelectedPeriodType>("week");
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const { getAllProjects } = useTimeStore();

  // State for managing checked days for "This Week" view
  // Key is day index (0 for Monday, ..., 6 for Sunday)
  const [checkedDays, setCheckedDays] = useState<{ [key: number]: boolean }>(
    {}
  );

  const calculateTotalTime = () => {
    const totalMinutes = chartData.reduce((sum, data) => sum + data.minutes, 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  // Effect to initialize/reset checkedDays when selectedPeriod changes
  useEffect(() => {
    if (selectedPeriod === "thisWeek") {
      const today = new Date();
      const currentDayNumeric = getDayIndex(today); // 0 for Monday, ..., 6 for Sunday
      const initialCheckedDays: { [key: number]: boolean } = {};
      for (let i = 0; i < 7; i++) {
        // M, T, W, Th, F, Sa, S
        initialCheckedDays[i] = i <= currentDayNumeric; // Check current and past days of this week
      }
      setCheckedDays(initialCheckedDays);
    } else {
      setCheckedDays({}); // Clear for other periods
    }
  }, [selectedPeriod]);

  useEffect(() => {
    const prepareChartData = async () => {
      const entries = await getAllProjects();
      const dateMap = new Map<string, number>();

      const localEndDate = new Date(); // Current local time
      localEndDate.setHours(23, 59, 59, 999); // End of current day

      let localStartDate = new Date(localEndDate);

      switch (selectedPeriod) {
        case "today":
          localStartDate.setDate(localEndDate.getDate());
          break;
        case "thisWeek":
          localStartDate = getLastMonday(new Date()); // Monday of the current week
          break;
        case "week":
          localStartDate.setDate(localEndDate.getDate() - 6);
          break;
        case "month":
          localStartDate.setDate(localEndDate.getDate() - 29);
          break;
        case "year":
          localStartDate.setDate(localEndDate.getDate() - 364);
          break;
      }
      localStartDate.setHours(0, 0, 0, 0); // Start of the day

      // Initialize all dates in range with 0 minutes
      // Use a new Date object for the loop to avoid modifying localStartDate
      for (
        let d = new Date(localStartDate);
        d <= localEndDate;
        d.setDate(d.getDate() + 1)
      ) {
        const dateKey =
          selectedPeriod === "year"
            ? `${d.getFullYear()}/${formatDateInMMDD(d)}`
            : formatDateInMMDD(d);
        dateMap.set(dateKey, 0);
      }

      // Aggregate minutes per day
      entries.forEach((entry: Project) => {
        entry.segments.forEach((segment) => {
          const segmentLocalDate = toLocalTime(new Date(segment.startTime));
          // Filter entries to be within the [localStartDate, localEndDate] range
          if (
            segmentLocalDate >= localStartDate &&
            segmentLocalDate <= localEndDate
          ) {
            const dateKey =
              selectedPeriod === "year"
                ? `${segmentLocalDate.getFullYear()}/${formatDateInMMDD(segmentLocalDate)}`
                : formatDateInMMDD(segmentLocalDate);

            if (dateMap.has(dateKey)) {
              const minutes = Math.floor((segment.duration || 0) / 60);
              dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + minutes);
            }
          }
        });
      });

      // Convert to array
      let processedData: ChartData[] = Array.from(dateMap)
        .map(([dateStr, minutes]) => ({
          date: dateStr,
          minutes,
        }))
        // Sort data chronologically. This sort assumes MM/DD are for the current year context,
        // or YYYY/MM/DD provides full context. This might need refinement if periods
        // like 'month' frequently cross year boundaries and formatDateInMMDD only returns MM/DD.
        .sort((a, b) => {
          const dateAIsYearFormat = a.date.split("/").length === 3;
          const dateBIsYearFormat = b.date.split("/").length === 3;

          const fullDateA = dateAIsYearFormat
            ? new Date(a.date)
            : new Date(`${localStartDate.getFullYear()}/${a.date}`);
          const fullDateB = dateBIsYearFormat
            ? new Date(b.date)
            : new Date(`${localStartDate.getFullYear()}/${b.date}`);

          // Adjust year for MM/DD if it seems to be in the next year (e.g. Jan dates when startDate is Dec)
          if (
            !dateAIsYearFormat &&
            fullDateA < localStartDate &&
            localStartDate.getMonth() === 11 &&
            fullDateA.getMonth() === 0
          ) {
            fullDateA.setFullYear(localStartDate.getFullYear() + 1);
          }
          if (
            !dateBIsYearFormat &&
            fullDateB < localStartDate &&
            localStartDate.getMonth() === 11 &&
            fullDateB.getMonth() === 0
          ) {
            fullDateB.setFullYear(localStartDate.getFullYear() + 1);
          }

          return fullDateA.getTime() - fullDateB.getTime();
        });

      // If "This Week" is selected, filter data based on checkedDays
      if (selectedPeriod === "thisWeek") {
        const currentWeekMonday = getLastMonday(new Date());
        currentWeekMonday.setHours(0, 0, 0, 0);

        processedData = processedData.filter((chartEntry) => {
          let actualDateForEntry: Date | null = null;
          // Find the full Date object for the chartEntry.date ("MM/DD")
          for (let i = 0; i < 7; i++) {
            const dayInIteration = new Date(currentWeekMonday);
            dayInIteration.setDate(currentWeekMonday.getDate() + i);
            if (formatDateInMMDD(dayInIteration) === chartEntry.date) {
              actualDateForEntry = dayInIteration;
              break;
            }
          }

          if (actualDateForEntry) {
            const dayOfWeekIndex = getDayIndex(actualDateForEntry);
            return checkedDays[dayOfWeekIndex] === true;
          }
          return false; // Entry date not found in current week logic, or not checked
        });
      }

      // Calculate 7-day moving average if enabled (for month or year view)
      if (
        showMovingAverage &&
        (selectedPeriod === "month" || selectedPeriod === "year")
      ) {
        const windowSize = 7;
        processedData.forEach((point, index) => {
          if (index >= windowSize - 1) {
            const window = processedData.slice(
              index - windowSize + 1,
              index + 1
            );
            const sum = window.reduce((acc, curr) => acc + curr.minutes, 0);
            point.movingAverage = parseFloat((sum / windowSize).toFixed(2));
          } else {
            point.movingAverage = undefined; // Or null, for points before MA starts
          }
        });
      }
      setChartData(processedData);
    };

    prepareChartData();
  }, [getAllProjects, selectedPeriod, showMovingAverage, checkedDays]);

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg mb-6">
      <div className="flex justify-between items-start mb-4">
        {" "}
        {/* Main header container */}
        {/* Left Side: Title and Total Time */}
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold">Time Distribution</h2>
          <span className="text-sm text-gray-400">
            {" "}
            {/* Removed mb-2 from here */}
            Total time ({PERIOD_DISPLAY_NAMES[selectedPeriod]}):{" "}
            {calculateTotalTime()}
          </span>
        </div>
        {/* Right Side: Conditional Checkboxes and Period Selector */}
        <div className="flex items-center space-x-4">
          {" "}
          {/* Aligns checkbox area and select dropdown horizontally */}
          {/* Conditional Checkbox Area */}
          <div className="flex items-center">
            {" "}
            {/* This div ensures vertical alignment if checkboxes take up space */}
            {selectedPeriod === "thisWeek" && (
              <div className="flex space-x-1 sm:space-x-2">
                {" "}
                {/* Container for day checkboxes */}
                {DAY_LABELS.map((label, index) => {
                  const today = new Date();
                  const currentDayOfWeekIndex = getDayIndex(today); // 0=Mon, ..., 6=Sun
                  const isDisabled = index > currentDayOfWeekIndex;

                  return (
                    <label
                      key={index}
                      className={`flex items-center space-x-1 text-xs ${isDisabled ? "text-gray-500 cursor-not-allowed" : "text-gray-300"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checkedDays[index] === true}
                        disabled={isDisabled}
                        onChange={(e) => {
                          setCheckedDays((prev) => ({
                            ...prev,
                            [index]: e.target.checked,
                          }));
                        }}
                        className={`form-checkbox h-3 w-3 sm:h-4 sm:w-4 ${isDisabled ? "bg-gray-600 border-gray-500" : "text-blue-600 bg-gray-700 border-gray-600"} rounded`}
                      />
                      <span className="hidden sm:inline">{label}</span>{" "}
                      {/* Show full label on sm+, just checkbox on xs */}
                      <span className="sm:hidden">{label[0]}</span>{" "}
                      {/* Show first letter on xs */}
                    </label>
                  );
                })}
              </div>
            )}
            {(selectedPeriod === "month" || selectedPeriod === "year") && (
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showMovingAverage}
                  onChange={(e) => setShowMovingAverage(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                />
                <span className="text-sm text-gray-300">
                  Show 7-day average
                </span>
              </label>
            )}
          </div>
          {/* Period Selector Dropdown */}
          <select
            value={selectedPeriod}
            onChange={(e) =>
              setSelectedPeriod(e.target.value as SelectedPeriodType)
            }
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
          >
            <option value="today">Today</option>
            <option value="thisWeek">This Week</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="year">Last 365 days</option>
          </select>
        </div>
      </div>

      {selectedPeriod === "today" ? (
        <div className="h-[400px] flex flex-col items-center justify-center">
          <div className="text-3xl font-bold mb-4">
            Total time today: {calculateTotalTime()}
          </div>
          <div className="text-xl text-gray-400">Keep going strong! 💪</div>
        </div>
      ) : (
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => {
                  // date is "MM/DD" or "YYYY/MM/DD"
                  if (selectedPeriod === "year") {
                    const monthShortNames = [
                      "Jan",
                      "Feb",
                      "Mar",
                      "Apr",
                      "May",
                      "Jun",
                      "Jul",
                      "Aug",
                      "Sep",
                      "Oct",
                      "Nov",
                      "Dec",
                    ];
                    const [year, monthNumStr] = date.split("/");
                    return `${monthShortNames[parseInt(monthNumStr, 10) - 1]} '${year.substring(2)}`;
                  }
                  return date; // "MM/DD"
                }}
                stroke="#9CA3AF"
                interval={
                  selectedPeriod === "year" || selectedPeriod === "month"
                    ? "preserveStartEnd"
                    : 0
                }
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
                labelFormatter={(label) => {
                  // label is the XAxis value, e.g., "MM/DD" or "YYYY/MM/DD"
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
                  if (selectedPeriod === "year") {
                    const [year, month] = label.split("/");
                    return `${monthNames[month - 1]} ${year}`;
                  } else {
                    const [month, day] = label.split("/").map(Number);
                    return `${monthNames[month - 1]} ${day}`;
                  }
                }}
                formatter={(value: number, name: string) => [
                  `${Math.floor(value / 60)}h ${Math.floor(value % 60)}m`,
                  name === "movingAverage"
                    ? "7-day Rolling Avg."
                    : "Time Worked",
                ]}
              />
              <Legend
                formatter={(value) =>
                  value === "movingAverage"
                    ? "7-day Rolling Avg."
                    : "Minutes worked"
                }
              />
              <Area
                type="monotone"
                dataKey="minutes"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.6}
                name="Minutes worked"
              />
              {showMovingAverage &&
                (selectedPeriod === "month" || selectedPeriod === "year") && (
                  <Area
                    type="monotone"
                    dataKey="movingAverage"
                    stroke="#34D399"
                    fill="#10B981"
                    fillOpacity={0.1}
                    name="movingAverage" // Legend formatter will change this
                    connectNulls={true} // To handle points where MA is not yet calculated
                  />
                )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
