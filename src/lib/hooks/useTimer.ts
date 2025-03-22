import { useState, useEffect, useRef, useCallback } from 'react';
import { useTimeStore } from '@/store/timeStore';
import { toLocalTime } from '@/lib/utils';

export function useTimer() {
  const {
    isTimerRunning,
    isPaused,
    currentEntry,
    currentDisplayTime,
    totalAccumulatedTime,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    updateDisplayTime
  } = useTimeStore();

  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const timerRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Initialize timer display when state changes
  useEffect(() => {
    // Clear any existing animation frame
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }

    // Set initial elapsed time
    if (isPaused) {
      // When paused, just show the current display time
      setElapsedTime(currentDisplayTime);
      setTotalTime(totalAccumulatedTime);
    } else if (isTimerRunning && currentEntry) {
      // Get the current active segment (last segment in the array)
      const currentSegmentIndex = currentEntry.segments.length - 1;
      const currentSegment = currentEntry.segments[currentSegmentIndex];

      // Convert UTC stored time to local time for display calculation
      const startTimeLocal = toLocalTime(new Date(currentSegment.startTime));

      // Calculate time elapsed in current segment
      const now = new Date();
      const segmentTime = Math.floor(
        (now.getTime() - startTimeLocal.getTime()) / 1000
      );

      // Set elapsed time to current display time plus segment time
      setElapsedTime(segmentTime);

      // Set total time to total accumulated time plus segment time
      setTotalTime(totalAccumulatedTime + segmentTime);

      // Start animation frame for running timer
      const updateTimer = () => {
        const now = Date.now();
        const elapsed = Math.floor(
          (now - startTimeLocal.getTime()) / 1000
        );

        setElapsedTime(elapsed);
        setTotalTime(totalAccumulatedTime + elapsed);

        // Update store occasionally
        if (now - lastUpdateRef.current > 5000) {
          lastUpdateRef.current = now;
          updateDisplayTime(elapsed);
        }

        timerRef.current = requestAnimationFrame(updateTimer);
      };

      timerRef.current = requestAnimationFrame(updateTimer);
    } else {
      // Reset timer when not running or paused
      setElapsedTime(0);
      setTotalTime(0);
    }

    // Cleanup animation frame on unmount or state change
    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTimerRunning, isPaused, currentEntry, currentDisplayTime, totalAccumulatedTime, updateDisplayTime]);

  const handleStartTimer = useCallback(
    (title: string, notes: string = '', tags: string[] = [],
      parentId?: string | null
    ) => {
      if (title.trim()) {
        startTimer(title, notes, tags, parentId);
      }
    }, [startTimer]);

  // Get the total number of sessions for the current entry
  const getSessionCount = useCallback(() => {
    if (currentEntry?.segments) {
      return currentEntry.segments.length;
    }
    return 0;
  }, [currentEntry]);

  return {
    isTimerRunning,
    isPaused,
    currentEntry,
    elapsedTime,
    totalTime,
    handleStartTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    getSessionCount
  };
}