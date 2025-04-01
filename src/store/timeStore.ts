"use client";

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { db, Project, TimeSegment } from "@/lib/db";
import { toUTC } from "@/lib/utils";

const wouldCreateCycle = async (
  projectId: string,
  newParentId: string
): Promise<boolean> => {
  if (projectId === newParentId) return true;

  const parent = await db.projects.get(newParentId);
  if (!parent) return false;

  // Check if the project is in the parent's path
  return parent.path.includes(projectId);
};

interface TimeState {
  currentEntry: Project | null;
  isTimerRunning: boolean;
  isPaused: boolean;
  currentDisplayTime: number;
  totalAccumulatedTime: number;
  isUpdatingDisplayTime: boolean;
  startTimer: (
    title: string,
    notes?: string,
    tags?: string[],
    parentId?: string | null
  ) => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  resumeTask: (entryId: string) => Promise<void>;
  updateDisplayTime: (time: number) => void;
  getRecentEntries: () => Promise<Project[]>;
  getAllProjects: () => Promise<Project[]>;
  updateEntry: (entry: Project) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  setParentForCurrentEntry: (parentId: string | null) => Promise<void>;
}

export const useTimeStore = create<TimeState>((set, get) => ({
  currentEntry: null,
  isTimerRunning: false,
  isPaused: false,
  currentDisplayTime: 0,
  totalAccumulatedTime: 0,
  isUpdatingDisplayTime: false,

  startTimer: async (
    title: string,
    notes = "",
    tags: string[] = [],
    parentId: string | null = null
  ): Promise<void> => {
    try {
      const now = toUTC(new Date());
      const { isTimerRunning, currentEntry } = get();

      if (isTimerRunning && currentEntry) {
        await get().stopTimer();
      }

      const newSegment: TimeSegment = {
        startTime: now,
        endTime: null,
        duration: 0,
      };

      let path: string[] = [];
      let depth = 0;

      if (parentId) {
        const parent = await db.projects.get(parentId);
        if (parent?.id) {
          path = [...parent.path, parent.id];
          depth = parent.depth + 1;
          await db.projects.update(parent.id, {
            childCount: (parent.childCount ?? 0) + 1,
            updatedAt: now,
          });
        }
      }

      const newEntry: Project = {
        id: uuidv4(),
        title,
        notes,
        parentId,
        path,
        depth,
        segments: [newSegment],
        duration: 0,
        isActive: true,
        tags,
        createdAt: now,
        updatedAt: now,
        childCount: 0,
      };

      const id = await db.projects.add(newEntry);

      set({
        currentEntry: { ...newEntry, id: id.toString() },
        isTimerRunning: true,
        isPaused: false,
        currentDisplayTime: 0,
        totalAccumulatedTime: 0,
      });
    } catch (error) {
      console.error("Error starting timer:", error);
    }
  },

  pauseTimer: async () => {
    try {
      const { isTimerRunning, isPaused, currentEntry, currentDisplayTime } =
        get();

      if (isTimerRunning && !isPaused && currentEntry && currentEntry.id) {
        const now = toUTC(new Date());

        const currentSegmentIndex = currentEntry.segments.length - 1;
        const currentSegment = currentEntry.segments[currentSegmentIndex];

        const segmentDuration = Math.floor(
          (now.getTime() - new Date(currentSegment.startTime).getTime()) / 1000
        );

        const updatedSegments = [...currentEntry.segments];
        updatedSegments[currentSegmentIndex] = {
          ...currentSegment,
          endTime: now,
          duration: segmentDuration,
        };

        const totalDuration = updatedSegments.reduce(
          (total, segment) => total + segment.duration,
          0
        );

        const updatedEntry = {
          segments: updatedSegments,
          duration: totalDuration,
          updatedAt: now,
        };

        await db.projects.update(currentEntry.id, updatedEntry);

        const refreshedEntry = await db.projects.get(currentEntry.id);

        set({
          currentEntry: refreshedEntry || null,
          isPaused: true,
          currentDisplayTime: currentDisplayTime,
          totalAccumulatedTime: totalDuration,
        });
      }
    } catch (error) {
      console.error("Error pausing timer:", error);
    }
  },

  resumeTimer: async () => {
    try {
      const { isPaused, currentEntry, totalAccumulatedTime } = get();

      if (isPaused && currentEntry && currentEntry.id) {
        const now = toUTC(new Date());

        const newSegment: TimeSegment = {
          startTime: now,
          endTime: null,
          duration: 0,
        };

        const updatedSegments = [...currentEntry.segments, newSegment];

        const updatedEntry = {
          segments: updatedSegments,
          updatedAt: now,
        };

        await db.projects.update(currentEntry.id, updatedEntry);

        const refreshedEntry = await db.projects.get(currentEntry.id);

        set({
          currentEntry: refreshedEntry || null,
          isTimerRunning: true,
          isPaused: false,
          currentDisplayTime: 0,
          totalAccumulatedTime: totalAccumulatedTime,
        });
      }
    } catch (error) {
      console.error("Error resuming timer:", error);
    }
  },

  stopTimer: async () => {
    try {
      const { currentEntry, isPaused } = get();
      if (!currentEntry || !currentEntry.id) return;

      const now = toUTC(new Date());

      if (!isPaused) {
        const currentSegmentIndex = currentEntry.segments.length - 1;
        const currentSegment = currentEntry.segments[currentSegmentIndex];

        const segmentDuration = Math.floor(
          (now.getTime() - new Date(currentSegment.startTime).getTime()) / 1000
        );

        const updatedSegments = [...currentEntry.segments];
        updatedSegments[currentSegmentIndex] = {
          ...currentSegment,
          endTime: now,
          duration: segmentDuration,
        };

        const totalDuration = updatedSegments.reduce(
          (total, segment) => total + segment.duration,
          0
        );

        const updatedEntry = {
          segments: updatedSegments,
          duration: totalDuration,
          isActive: false,
          updatedAt: now,
        };

        await db.projects.update(currentEntry.id, updatedEntry);
      } else {
        await db.projects.update(currentEntry.id, {
          isActive: false,
          updatedAt: now,
        });
      }

      set({
        currentEntry: null,
        isTimerRunning: false,
        isPaused: false,
        currentDisplayTime: 0,
        totalAccumulatedTime: 0,
      });
    } catch (error) {
      console.error("Error stopping timer:", error);
    }
  },

  updateDisplayTime: (time: number) => {
    const { isUpdatingDisplayTime, currentEntry, totalAccumulatedTime } = get();

    if (!isUpdatingDisplayTime) {
      let newTotalAccumulatedTime = totalAccumulatedTime;

      if (currentEntry) {
        const completedDuration = currentEntry.segments
          .filter((segment) => segment.endTime !== null)
          .reduce((total, segment) => total + (segment.duration || 0), 0);

        newTotalAccumulatedTime = completedDuration + time;
      }

      set({
        isUpdatingDisplayTime: true,
        currentDisplayTime: time,
        totalAccumulatedTime: newTotalAccumulatedTime,
      });

      setTimeout(() => {
        set({ isUpdatingDisplayTime: false });
      }, 1000);
    }
  },

  resumeTask: async (entryId: string) => {
    try {
      const { isTimerRunning, currentEntry } = get();
      if (isTimerRunning && currentEntry) {
        await get().stopTimer();
      }

      const entryToResume = await db.projects.get(entryId);
      if (!entryToResume) {
        console.error("Entry not found:", entryId);
        return;
      }

      const now = toUTC(new Date());

      const newSegment: TimeSegment = {
        startTime: now,
        endTime: null,
        duration: 0,
      };

      const updatedSegments = [...entryToResume.segments, newSegment];

      const updatedEntry = {
        segments: updatedSegments,
        isActive: true,
        updatedAt: now,
      };

      await db.projects.update(entryId, updatedEntry);

      const refreshedEntry = await db.projects.get(entryId);

      const totalCompletedDuration = entryToResume.segments.reduce(
        (total, segment) => total + (segment.duration || 0),
        0
      );

      set({
        currentEntry: refreshedEntry || null,
        isTimerRunning: true,
        isPaused: false,
        currentDisplayTime: 0,
        totalAccumulatedTime: totalCompletedDuration,
      });

      console.log(
        "Resumed task:",
        entryId,
        "with total accumulated time:",
        totalCompletedDuration
      );
    } catch (error) {
      console.error("Error resuming task:", error);
    }
  },

  getRecentEntries: async () => {
    try {
      return await db.projects
        .orderBy("updatedAt")
        .reverse()
        .limit(50)
        .toArray();
    } catch (error) {
      console.error("Error fetching projects:", error);
      return [];
    }
  },

  getAllProjects: async () => {
    try {
      const allProjects = await db.projects.toArray();
      console.log("Fetched all projects count:", allProjects.length);
      return allProjects;
    } catch (error) {
      console.error("Error fetching all projects:", error);
      return [];
    }
  },

  updateEntry: async (entry: Project) => {
    if (!entry.id) return;
    try {
      const totalDuration = entry.segments.reduce(
        (total, segment) => total + segment.duration,
        0
      );

      const currentEntry = await db.projects.get(entry.id);
      if (!currentEntry) return;

      if (currentEntry.parentId !== entry.parentId) {
        // Check for circular linking if the parent is being changed.
        if (
          entry.parentId &&
          (await wouldCreateCycle(entry.id, entry.parentId))
        ) {
          console.error(
            "Cannot update entry: would create circular dependency"
          );
          return;
        }
        if (currentEntry.parentId) {
          const oldParent = await db.projects.get(currentEntry.parentId);
          if (oldParent) {
            await db.projects.update(oldParent.id!, {
              childCount: Math.max(0, (oldParent.childCount || 1) - 1),
              updatedAt: toUTC(new Date()),
            });
          }
        }

        let newPath: string[] = [];
        let newDepth = 0;

        if (entry.parentId) {
          const newParent = await db.projects.get(entry.parentId);
          if (newParent?.id) {
            newPath = [...newParent.path, newParent.id];
            newDepth = newParent.depth + 1;
            await db.projects.update(newParent.id, {
              childCount: (newParent.childCount ?? 0) + 1,
              updatedAt: toUTC(new Date()),
            });
          }
        }

        await db.projects.update(entry.id, {
          title: entry.title,
          notes: entry.notes || "",
          segments: entry.segments,
          duration: totalDuration,
          tags: entry.tags,
          parentId: entry.parentId,
          path: newPath,
          depth: newDepth,
          updatedAt: toUTC(new Date()),
        });
      } else {
        await db.projects.update(entry.id, {
          title: entry.title,
          notes: entry.notes || "",
          segments: entry.segments,
          duration: totalDuration,
          tags: entry.tags,
          updatedAt: toUTC(new Date()),
        });
      }
    } catch (error) {
      console.error("Error updating entry:", error);
    }
  },

  deleteEntry: async (id: string) => {
    try {
      await db.projects.delete(id);
    } catch (error) {
      console.error("Error deleting entry:", error);
    }
  },

  setParentForCurrentEntry: async (parentId: string | null) => {
    try {
      const { currentEntry } = get();
      if (!currentEntry || !currentEntry.id) return;

      const oldParentId = currentEntry.parentId;

      if (oldParentId === parentId) return;

      if (parentId && (await wouldCreateCycle(currentEntry.id, parentId))) {
        console.error("Cannot set parent: it would create a cycle");
        return;
      }

      if (oldParentId) {
        const oldParent = await db.projects.get(oldParentId);
        if (oldParent?.id) {
          await db.projects.update(oldParent.id, {
            childCount: Math.max(0, (oldParent.childCount ?? 1) - 1),
            updatedAt: toUTC(new Date()),
          });
        } else {
          console.error("Old parent project not found");
        }
      }

      if (!parentId) {
        await db.projects.update(currentEntry.id, {
          parentId: null,
          path: [],
          depth: 0,
          updatedAt: toUTC(new Date()),
        });

        console.log("Removed parent for entry:", currentEntry.id);

        const updatedEntry = await db.projects.get(currentEntry.id);
        set({ currentEntry: updatedEntry || null });
        return;
      }

      const newParent = await db.projects.get(parentId);
      if (!newParent?.id) {
        console.error("New parent project not found");
        return;
      }

      const newPath = [...(newParent.path ?? []), newParent.id];
      const newDepth = newParent.depth + 1;

      await db.projects.update(currentEntry.id, {
        parentId,
        path: newPath,
        depth: newDepth,
        updatedAt: toUTC(new Date()),
      });

      await db.projects.update(parentId, {
        childCount: (newParent.childCount ?? 0) + 1,
        updatedAt: toUTC(new Date()),
      });

      console.log("Set parent:", parentId, "for entry:", currentEntry.id);

      const updatedEntry = await db.projects.get(currentEntry.id);
      set({ currentEntry: updatedEntry || null });
    } catch (error) {
      console.error("Error setting parent:", error);
    }
  },
}));
