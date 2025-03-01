// Helper functions for formatting and other utilities
import { TimeEntry } from './db';

export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
  }

  export function formatDate(date: Date): string {
    // Use a fixed format that doesn't depend on locale
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate();
    const month = months[date.getMonth()];

    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${month} ${day}, ${hours}:${minutes} ${ampm}`;
  }

  interface GroupedEntries {
    date: string;
    entries: TimeEntry[];
  }

  export function groupEntriesByDay(entries: TimeEntry[]): GroupedEntries[] {
    const groups = new Map<string, TimeEntry[]>();

    entries.forEach(entry => {
      // Get the start time from the first segment
      if (!entry.segments || entry.segments.length === 0) {
        return; // Skip entries without segments
      }

      const date = new Date(entry.segments[0].startTime);
      // Format date as YYYY-MM-DD to ensure consistency
      const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(entry);
    });

    return Array.from(groups.entries()).map(([dateKey, groupEntries]) => ({
      date: dateKey,
      entries: groupEntries,
    }));
  }