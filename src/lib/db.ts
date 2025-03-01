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

    // Define the current schema without migrations
    this.version(1).stores({
      timeEntries: '++id, isActive, createdAt, updatedAt'
    });
  }
}

// Create a single database instance
const db = new ChronosDatabase();

export { db };