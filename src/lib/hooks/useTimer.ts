import { useState, useEffect, useRef, useCallback } from "react";
import { useTimeStore } from "@/store/timeStore";
import { toLocalTime } from "@/lib/utils";

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
    updateDisplayTime,
  } = useTimeStore();

  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [todayTime, setTodayTime] = useState(0);
  const [weekTime, setWeekTime] = useState(0);
  const timerRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Initialize timer display when state changes
  useEffect(() => {
    // Clear any existing animation frame
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }

    // Helper function to calculate time periods
    const calculateTimePeriods = (
      segments: { startTime: Date; endTime: Date | null; duration: number }[]
    ) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const weekStart = new Date(now);
      weekStart.setDate(
        now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)
      );
      weekStart.setHours(0, 0, 0, 0);

      let todayTotal = 0;
      let weekTotal = 0;

      // Process all segments except the last one (current running segment)
      segments.slice(0, -1).forEach((segment) => {
        if (!segment.startTime || !segment.duration) return;

        const startLocal = toLocalTime(new Date(segment.startTime));
        const endLocal = segment.endTime
          ? toLocalTime(new Date(segment.endTime))
          : now;

        // Rest of segment calculations...
        if (startLocal < now && startLocal >= today) {
          const endTime = endLocal > now ? now : endLocal;
          const startTime = startLocal < today ? today : startLocal;
          todayTotal += Math.floor(
            (endTime.getTime() - startTime.getTime()) / 1000
          );
        }
        if (startLocal < now && startLocal >= weekStart) {
          const endTime = endLocal > now ? now : endLocal;
          const startTime = startLocal < weekStart ? weekStart : startLocal;
          weekTotal += Math.floor(
            (endTime.getTime() - startTime.getTime()) / 1000
          );
        }
      });

      // Handle the current running segment separately
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        if (!lastSegment.startTime) {
          console.warn(
            "No start time for the last segment. Cannot calculate time."
          );
          return { todayTotal, weekTotal };
        }
        const startLocal = toLocalTime(new Date(lastSegment.startTime));
        const endLocal = lastSegment.endTime
          ? toLocalTime(new Date(lastSegment.endTime))
          : now;
        if (startLocal < now && startLocal >= today) {
          const startTime = startLocal < today ? today : startLocal;
          const endTime = endLocal > now ? now : endLocal;
          todayTotal += Math.floor(
            (endTime.getTime() - startTime.getTime()) / 1000
          );
        }
        if (startLocal < now && startLocal >= weekStart) {
          const startTime = startLocal < weekStart ? weekStart : startLocal;
          const endTime = endLocal > now ? now : endLocal;
          weekTotal += Math.floor(
            (endTime.getTime() - startTime.getTime()) / 1000
          );
        }
      }

      return { todayTotal, weekTotal };
    };

    // Set initial elapsed time
    if (isPaused) {
      // When paused, calculate time periods from segments
      if (currentEntry) {
        const { todayTotal, weekTotal } = calculateTimePeriods(
          currentEntry.segments
        );
        setTodayTime(todayTotal);
        setWeekTime(weekTotal);
      }
      setElapsedTime(currentDisplayTime);
      setTotalTime(totalAccumulatedTime);
    } else if (isTimerRunning && currentEntry) {
      // Get the current active segment
      const currentSegmentIndex = currentEntry.segments.length - 1;
      const currentSegment = currentEntry.segments[currentSegmentIndex];
      const startTimeLocal = toLocalTime(new Date(currentSegment.startTime));

      // Calculate time elapsed in current segment
      const now = new Date();
      const segmentTime = Math.floor(
        (now.getTime() - startTimeLocal.getTime()) / 1000
      );

      // Calculate time periods including current segment
      const { todayTotal, weekTotal } = calculateTimePeriods(
        currentEntry.segments
      );
      setElapsedTime(segmentTime);
      setTodayTime(todayTotal);
      setWeekTime(weekTotal);
      setTotalTime(totalAccumulatedTime + segmentTime);

      // Start animation frame for running timer
      const updateTimer = () => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeLocal.getTime()) / 1000);

        setElapsedTime(elapsed);
        setTotalTime(totalAccumulatedTime + elapsed);

        // Recalculate today and week times
        const { todayTotal, weekTotal } = calculateTimePeriods(
          currentEntry.segments
        );
        setTodayTime(todayTotal);
        setWeekTime(weekTotal);

        // Update store occasionally
        if (now - lastUpdateRef.current > 5000) {
          lastUpdateRef.current = now;
          updateDisplayTime(elapsed);
        }

        timerRef.current = requestAnimationFrame(updateTimer);
      };

      timerRef.current = requestAnimationFrame(updateTimer);
    } else {
      // Reset all timers
      setElapsedTime(0);
      setTotalTime(0);
      setTodayTime(0);
      setWeekTime(0);
    }

    // Cleanup animation frame on unmount or state change
    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    isTimerRunning,
    isPaused,
    currentEntry,
    currentDisplayTime,
    totalAccumulatedTime,
    updateDisplayTime,
  ]);

  const handleStartTimer = useCallback(
    (
      title: string,
      notes: string = "",
      tags: string[] = [],
      parentId?: string | null
    ) => {
      if (title.trim()) {
        startTimer(title, notes, tags, parentId);
      }
    },
    [startTimer]
  );

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
    todayTime,
    weekTime,
    handleStartTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    getSessionCount,
  };
}
