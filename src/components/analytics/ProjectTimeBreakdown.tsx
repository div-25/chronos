"use client";

import { useState, useEffect } from "react";
import { useTimeStore } from "@/store/timeStore";
import { Project } from "@/lib/db";
import { toLocalTime } from "@/lib/utils";

export const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds <= 0) {
    return "0s";
  }
  if (totalSeconds < 60) {
    return `${Math.round(totalSeconds)}s`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}`;
  } else {
    return `${minutes}m`;
  }
};

interface ProcessedProjectData {
  id: string;
  title: string;
  depth: number;
  totalTimeSeconds: number;
  percentage: number;
  parentId?: string | null;
}

export function ProjectTimeBreakdown() {
  const [selectedPeriod, setSelectedPeriod] = useState<
    "today" | "week" | "month" | "year"
  >("week");
  const [displayProjects, setDisplayProjects] = useState<
    ProcessedProjectData[]
  >([]);

  const { getAllProjects } = useTimeStore();

  useEffect(() => {
    const calculateBreakdown = async () => {
      const allProjects = await getAllProjects();
      if (!allProjects || allProjects.length === 0) {
        setDisplayProjects([]);
        return;
      }

      const endDate = new Date();  // Returns date in local time.
      const startDate = new Date(endDate);

      endDate.setHours(23, 59, 59, 999);
      switch (selectedPeriod) {
        case "today":
          startDate.setDate(endDate.getDate());
          break;
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

      let overallTotalSeconds = 0;
      const projectTimeMap = new Map<
        string,
        { ownSeconds: number; totalSeconds: number }
      >();
      const projectChildrenMap = new Map<string, string[]>();
      const projectMap = new Map<string, Project>();

      allProjects.forEach((project) => {
        if (!project.id) return;
        projectMap.set(project.id, project);

        let ownSecondsInPeriod = 0;
        project.segments.forEach((segment) => {
          const segmentStartTime = toLocalTime(new Date(segment.startTime));
          if (
            segment.duration &&
            segment.duration > 0 &&
            segmentStartTime >= startDate &&
            segmentStartTime <= endDate
          ) {
            ownSecondsInPeriod += segment.duration;
          }
        });

        projectTimeMap.set(project.id, {
          ownSeconds: ownSecondsInPeriod,
          totalSeconds: 0,
        });

        const parentId = project.parentId;
        if (parentId) {
          if (!projectChildrenMap.has(parentId)) {
            projectChildrenMap.set(parentId, []);
          }
          projectChildrenMap.get(parentId)!.push(project.id);
        }
      });

      const calculatedProjects = new Set<string>();
      const calculateAggregatedTime = (projectId: string): number => {
        if (calculatedProjects.has(projectId)) {
          return projectTimeMap.get(projectId)?.totalSeconds ?? 0;
        }

        const timeData = projectTimeMap.get(projectId);
        if (!timeData) return 0;

        let aggregatedSeconds = timeData.ownSeconds;
        const children = projectChildrenMap.get(projectId) || [];

        children.forEach((childId) => {
          if (projectTimeMap.has(childId)) {
            aggregatedSeconds += calculateAggregatedTime(childId);
          }
        });

        timeData.totalSeconds = Math.max(0, aggregatedSeconds);
        calculatedProjects.add(projectId);
        return timeData.totalSeconds;
      };

      allProjects.forEach((p) => {
        if (p.id && projectTimeMap.has(p.id)) calculateAggregatedTime(p.id);
      });

      const topLevelProjects = allProjects.filter(
        (p) => !p.parentId && p.id && projectTimeMap.has(p.id)
      );
      overallTotalSeconds = topLevelProjects.reduce((sum, p) => {
        return sum + (projectTimeMap.get(p.id!)?.totalSeconds ?? 0);
      }, 0);

      overallTotalSeconds = Math.max(0, overallTotalSeconds);

      const renderList: ProcessedProjectData[] = [];
      const buildRenderList = (projectId: string, depth: number) => {
        const project = projectMap.get(projectId);
        const timeData = projectTimeMap.get(projectId);

        if (!project || !timeData || !project.id) return;

        const shouldDisplay = timeData.totalSeconds > 0 || depth === 0;

        if (shouldDisplay) {
          renderList.push({
            id: project.id,
            title: project.title,
            depth: depth,
            totalTimeSeconds: timeData.totalSeconds,
            percentage:
              overallTotalSeconds > 0
                ? (timeData.totalSeconds / overallTotalSeconds) * 100
                : 0,
            parentId: project.parentId,
          });
        }

        // Regardless of whether the current project is displayed,
        // process its children if within depth limit,
        // because a child might have time even if the parent doesn't (e.g., parent is just a folder).
        if (depth < 3) {
          const childrenIds = projectChildrenMap.get(projectId) || [];
          const sortedChildren = childrenIds
            .filter((id) => projectTimeMap.has(id))
            .map((id) => ({
              id,
              time: projectTimeMap.get(id)!.totalSeconds,
            }))
            .sort((a, b) => b.time - a.time)
            .map((item) => item.id);

          sortedChildren.forEach((childId) => {
            buildRenderList(childId, depth + 1);
          });
        }
      };

      topLevelProjects.sort((a, b) => {
        const timeA = projectTimeMap.get(a.id!)?.totalSeconds ?? 0;
        const timeB = projectTimeMap.get(b.id!)?.totalSeconds ?? 0;
        return timeB - timeA;
      });

      topLevelProjects.forEach((project) => {
        if (project.id) {
          buildRenderList(project.id, 0);
        }
      });

      setDisplayProjects(renderList);
    };

    calculateBreakdown();
  }, [getAllProjects, selectedPeriod]);

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Projects Worked On</h2>
        <div className="flex space-x-4">
          <select
            value={selectedPeriod}
            onChange={(e) =>
              setSelectedPeriod(e.target.value as "today" | "week" | "month" | "year")
            }
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="year">Last 365 days</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between text-sm text-gray-400 mb-2 px-3 font-medium">
        <span className="flex-grow-[3] basis-0">Project</span>
        <span className="flex-grow-[1] basis-0 text-right">Time</span>
        <span className="flex flex-grow-[1] basis-0 justify-end text-right">
          % Total
        </span>
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {displayProjects.length > 0 ? (
          displayProjects.map((proj) => (
            <div
              key={proj.id}
              className="flex justify-between items-center bg-gray-700/50 hover:bg-gray-700 rounded px-3 py-2 text-sm"
            >
              <span
                className="flex-grow-[3] basis-0 truncate mr-2"
                style={{ paddingLeft: `${proj.depth * 1.5}rem` }}
                title={proj.title}
              >
                {proj.title}
              </span>

              <span className="flex-grow-[1] basis-0 text-right text-gray-300 mr-2">
                {formatDuration(proj.totalTimeSeconds)}
              </span>

              <span className="flex flex-grow-[1] basis-0 justify-end items-center gap-x-2">
                <div
                  className="w-12 h-1.5 bg-gray-600 rounded-full overflow-hidden"
                  title={`${proj.percentage.toFixed(1)}%`}
                >
                  <div
                    className="h-full bg-blue-500 rounded-full transition-width duration-300 ease-in-out"
                    style={{
                      width: `${Math.min(100, Math.max(0, proj.percentage))}%`,
                    }}
                  ></div>
                </div>
                <span className="w-10 text-right text-gray-300 tabular-nums">
                  {proj.percentage.toFixed(1)}%
                </span>
              </span>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-4">
            No project data found for the selected period.
          </div>
        )}
      </div>

      <p className="text-sm text-gray-400 text-center mt-4">
        Shows how much time you spent working on each project in the selected
        time period. A parent project includes the total time spent on all its
        descendants.
      </p>
    </div>
  );
}
