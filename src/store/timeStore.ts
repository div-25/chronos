"use client";

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { db, TimeEntry, TimeSegment } from '@/lib/db';

interface TimeState {
  currentEntry: TimeEntry | null;
  isTimerRunning: boolean;
  isPaused: boolean;
  currentDisplayTime: number; // Time for current session only
  totalAccumulatedTime: number; // Total time across all segments
  isUpdatingDisplayTime: boolean; // Flag to prevent excessive updates
  startTimer: (title: string, notes?: string, tags?: string[]) => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  resumeTask: (entryId: string) => Promise<void>;
  updateDisplayTime: (time: number) => void;
  getRecentEntries: () => Promise<TimeEntry[]>;
  updateEntry: (entry: TimeEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

export const useTimeStore = create<TimeState>((set, get) => ({
  currentEntry: null,
  isTimerRunning: false,
  isPaused: false,
  currentDisplayTime: 0,
  totalAccumulatedTime: 0,
  isUpdatingDisplayTime: false,
  
  startTimer: async (title: string, notes: string = '', tags: string[] = []) => {
    try {
      const now = new Date();
      
      // First, stop any currently running timer
      const { isTimerRunning, currentEntry } = get();
      if (isTimerRunning && currentEntry) {
        await get().stopTimer();
      }
      
      // Create a new entry with a single segment
      const newSegment: TimeSegment = {
        startTime: now,
        endTime: null,
        duration: 0
      };
      
      const newEntry: TimeEntry = {
        id: uuidv4(),
        title,
        notes,
        segments: [newSegment],
        duration: 0,
        isActive: true,
        tags,
        createdAt: now,
        updatedAt: now,
      };
      
      // Add to database
      const id = await db.timeEntries.add(newEntry);
      console.log("Added new entry with ID:", id);
      
      // Update state
      set({ 
        currentEntry: { ...newEntry, id: id.toString() }, 
        isTimerRunning: true,
        isPaused: false,
        currentDisplayTime: 0,
        totalAccumulatedTime: 0
      });
    } catch (error) {
      console.error("Error starting timer:", error);
    }
  },
  
  pauseTimer: async () => {
    try {
      const { isTimerRunning, isPaused, currentEntry, currentDisplayTime } = get();
      
      if (isTimerRunning && !isPaused && currentEntry && currentEntry.id) {
        const now = new Date();
        
        // Get the current active segment (last segment in the array)
        const currentSegmentIndex = currentEntry.segments.length - 1;
        const currentSegment = currentEntry.segments[currentSegmentIndex];
        
        // Calculate duration for this segment
        const segmentDuration = Math.floor(
          (now.getTime() - new Date(currentSegment.startTime).getTime()) / 1000
        );
        
        // Update the segment with end time and duration
        const updatedSegments = [...currentEntry.segments];
        updatedSegments[currentSegmentIndex] = {
          ...currentSegment,
          endTime: now,
          duration: segmentDuration
        };
        
        // Calculate total duration across all segments
        const totalDuration = updatedSegments.reduce(
          (total, segment) => total + segment.duration, 
          0
        );
        
        // Update entry in database
        const updatedEntry = {
          segments: updatedSegments,
          duration: totalDuration,
          updatedAt: now
        };
        
        await db.timeEntries.update(currentEntry.id, updatedEntry);
        
        // Get the updated entry
        const refreshedEntry = await db.timeEntries.get(currentEntry.id);
        
        // Update state
        set({ 
          currentEntry: refreshedEntry || null,
          isPaused: true,
          currentDisplayTime: currentDisplayTime, // Preserve the current display time
          totalAccumulatedTime: totalDuration // Update total accumulated time
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
        const now = new Date();
        
        // Create a new segment
        const newSegment: TimeSegment = {
          startTime: now,
          endTime: null,
          duration: 0
        };
        
        // Add the new segment to the entry
        const updatedSegments = [...currentEntry.segments, newSegment];
        
        // Update the entry in the database
        const updatedEntry = {
          segments: updatedSegments,
          updatedAt: now
        };
        
        await db.timeEntries.update(currentEntry.id, updatedEntry);
        
        // Get the updated entry
        const refreshedEntry = await db.timeEntries.get(currentEntry.id);
        
        // Update state
        set({
          currentEntry: refreshedEntry || null,
          isTimerRunning: true,
          isPaused: false,
          currentDisplayTime: 0, // Reset current session timer
          totalAccumulatedTime: totalAccumulatedTime // Keep total accumulated time
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
      
      const now = new Date();
      
      // If we're not paused, we need to end the current segment
      if (!isPaused) {
        // Get the current active segment (last segment in the array)
        const currentSegmentIndex = currentEntry.segments.length - 1;
        const currentSegment = currentEntry.segments[currentSegmentIndex];
        
        // Calculate duration for this segment
        const segmentDuration = Math.floor(
          (now.getTime() - new Date(currentSegment.startTime).getTime()) / 1000
        );
        
        // Update the segment
        const updatedSegments = [...currentEntry.segments];
        updatedSegments[currentSegmentIndex] = {
          ...currentSegment,
          endTime: now,
          duration: segmentDuration
        };
        
        // Calculate total duration across all segments
        const totalDuration = updatedSegments.reduce(
          (total, segment) => total + segment.duration, 
          0
        );
        
        // Update entry in database
        const updatedEntry = {
          segments: updatedSegments,
          duration: totalDuration,
          isActive: false,
          updatedAt: now
        };
        
        await db.timeEntries.update(currentEntry.id, updatedEntry);
      } else {
        // If we're already paused, just mark the entry as inactive
        await db.timeEntries.update(currentEntry.id, {
          isActive: false,
          updatedAt: now
        });
      }
      
      // Update state
      set({ 
        currentEntry: null, 
        isTimerRunning: false,
        isPaused: false,
        currentDisplayTime: 0,
        totalAccumulatedTime: 0
      });
    } catch (error) {
      console.error("Error stopping timer:", error);
    }
  },
  
  updateDisplayTime: (time: number) => {
    const { isUpdatingDisplayTime, currentEntry, totalAccumulatedTime } = get();
    
    // Prevent excessive updates
    if (!isUpdatingDisplayTime) {
      // Calculate total accumulated time if we have a current entry
      let newTotalAccumulatedTime = totalAccumulatedTime;
      
      if (currentEntry) {
        // Sum up durations of completed segments
        const completedDuration = currentEntry.segments
          .filter(segment => segment.endTime !== null)
          .reduce((total, segment) => total + (segment.duration || 0), 0);
          
        // Add current session time to get total
        newTotalAccumulatedTime = completedDuration + time;
      }
      
      set({ 
        isUpdatingDisplayTime: true,
        currentDisplayTime: time,
        totalAccumulatedTime: newTotalAccumulatedTime
      });
      
      // Reset the flag after a short delay
      setTimeout(() => {
        set({ isUpdatingDisplayTime: false });
      }, 1000);
    }
  },
  
  resumeTask: async (entryId: string) => {
    try {
      // First, stop any currently running timer
      const { isTimerRunning, currentEntry } = get();
      if (isTimerRunning && currentEntry) {
        await get().stopTimer();
      }
      
      // Get the entry to resume
      const entryToResume = await db.timeEntries.get(entryId);
      if (!entryToResume) {
        console.error("Entry not found:", entryId);
        return;
      }
      
      const now = new Date();
      
      // Create a new segment for this entry
      const newSegment: TimeSegment = {
        startTime: now,
        endTime: null,
        duration: 0
      };
      
      // Add the new segment to the entry
      const updatedSegments = [...entryToResume.segments, newSegment];
      
      // Update the entry in the database
      const updatedEntry = {
        segments: updatedSegments,
        isActive: true,
        updatedAt: now
      };
      
      await db.timeEntries.update(entryId, updatedEntry);
      
      // Get the updated entry to use as current entry
      const refreshedEntry = await db.timeEntries.get(entryId);
      
      // Calculate the total duration of completed segments
      const totalCompletedDuration = entryToResume.segments.reduce(
        (total, segment) => total + (segment.duration || 0), 
        0
      );
      
      // Update state
      set({
        currentEntry: refreshedEntry || null,
        isTimerRunning: true,
        isPaused: false,
        currentDisplayTime: 0, // Start current session timer from 0
        totalAccumulatedTime: totalCompletedDuration // Set total accumulated time
      });
      
      console.log("Resumed task:", entryId, "with total accumulated time:", totalCompletedDuration);
    } catch (error) {
      console.error("Error resuming task:", error);
    }
  },
  
  getRecentEntries: async () => {
    try {
      // Try to get entries ordered by updatedAt
      try {
        return await db.timeEntries
          .orderBy('updatedAt')
          .reverse()
          .limit(50)
          .toArray();
      } catch (error) {
        console.warn("Error ordering by updatedAt, falling back to default order:", error);
        
        // Fallback to getting all entries and sorting them in memory
        const allEntries = await db.timeEntries.toArray();
        return allEntries
          .sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt || 0);
            const dateB = new Date(b.updatedAt || b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 50);
      }
    } catch (error) {
      console.error("Error fetching entries:", error);
      return [];
    }
  },
  
  updateEntry: async (entry: TimeEntry) => {
    if (!entry.id) return;
    try {
      // Calculate total duration across all segments
      const totalDuration = entry.segments.reduce(
        (total, segment) => total + segment.duration, 
        0
      );
      
      // Create an update object with only the fields we want to update
      const updateObj = {
        title: entry.title,
        notes: entry.notes,
        segments: entry.segments,
        duration: totalDuration,
        tags: entry.tags,
        updatedAt: new Date(),
      };
      
      await db.timeEntries.update(entry.id, updateObj);
    } catch (error) {
      console.error("Error updating entry:", error);
    }
  },
  
  deleteEntry: async (id: string) => {
    try {
      await db.timeEntries.delete(id);
    } catch (error) {
      console.error("Error deleting entry:", error);
    }
  },
}));