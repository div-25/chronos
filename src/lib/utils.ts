// Helper functions for formatting and other utilities
import { TimeEntry } from './db';

// Timezone conversion utilities
export function toUTC(date: Date): Date {
  // Convert local time to UTC
  return new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  ));
}

export function toLocalTime(utcDate: Date): Date {
  // Convert UTC time to local time
  const localDate = new Date();
  localDate.setFullYear(utcDate.getUTCFullYear());
  localDate.setMonth(utcDate.getUTCMonth());
  localDate.setDate(utcDate.getUTCDate());
  localDate.setHours(utcDate.getUTCHours());
  localDate.setMinutes(utcDate.getUTCMinutes());
  localDate.setSeconds(utcDate.getUTCSeconds());
  localDate.setMilliseconds(utcDate.getUTCMilliseconds());
  return localDate;
}

// Format a date for datetime-local input (YYYY-MM-DDTHH:MM)
export function formatDateForInput(date: Date | null): string {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    const pad = (num: number) => num.toString().padStart(2, '0');
    
    return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
  }
  
  export function formatDate(date: Date): string {
    // Convert UTC date to local time for display
    const localDate = toLocalTime(date);
    
    // Use a fixed format that doesn't depend on locale
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = localDate.getDate();
    const month = months[localDate.getMonth()];
    
    let hours = localDate.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutes = localDate.getMinutes().toString().padStart(2, '0');
    
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
      
      // Convert UTC time to local time for grouping by day
      const date = toLocalTime(new Date(entry.segments[0].startTime));
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