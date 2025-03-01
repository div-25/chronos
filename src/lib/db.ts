import Dexie, { Table } from 'dexie';

export interface TimeSegment {
  startTime: Date;
  endTime: Date | null;
  duration: number;
}

export interface TimeEntry {
  id?: string;
  title: string;
  segments: TimeSegment[];
  duration: number; // Total duration across all segments
  isActive: boolean; // Whether this entry is currently being timed
  tags: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ChronosDatabase extends Dexie {
  timeEntries!: Table<TimeEntry, string>;

  constructor() {
    super('ChronosDB');

    // Update schema version to handle the new structure and add updatedAt index
    this.version(3).stores({
      timeEntries: '++id, isActive, createdAt, updatedAt' // Added updatedAt to the index
    }).upgrade(tx => {
      // Migration from v1/v2 to v3
      return tx.table('timeEntries').toCollection().modify(entry => {
        // If entry doesn't have segments (from v1), convert it
        if (!entry.segments) {
          const oldStartTime = entry.startTime;
          const oldEndTime = entry.endTime;
          const oldDuration = entry.duration;

          // Create segments array with the existing time data
          entry.segments = [{
            startTime: oldStartTime,
            endTime: oldEndTime,
            duration: oldDuration
          }];

          // Set isActive flag based on whether the entry has an end time
          entry.isActive = oldEndTime === null;

          // Delete old properties
          delete entry.startTime;
          delete entry.endTime;
        }

        // Ensure updatedAt exists
        if (!entry.updatedAt) {
          entry.updatedAt = entry.createdAt || new Date();
        }
      });
    });
  }
}

// Create a single database instance
const db = new ChronosDatabase();

export { db };