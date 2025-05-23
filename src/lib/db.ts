import Dexie, { Table } from "dexie";

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

export interface Project {
  id?: string;
  title: string;
  parentId?: string | null; // Reference to parent project, null/undefined for root projects
  path: string[]; // Array of ancestor project IDs for efficient querying
  segments: TimeSegment[];
  duration: number; // Total duration across all segments
  isActive: boolean; // Whether this project is currently being timed
  tags: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  depth: number; // Nesting level, 0 for root projects
  childCount: number; // Number of immediate children
}

export class ChronosDatabase extends Dexie {
  projects!: Table<Project, string>;

  constructor() {
    super("ChronosDB");

    // Define the schema with indexes for hierarchical queries
    this.version(2).stores({
      projects: "++id, parentId, path, isActive, depth, createdAt, updatedAt",
    });

    // Migration from v1 (TimeEntries) to v2 (Projects).
    this.version(2).upgrade(async (tx) => {
      const oldTimeEntries = await tx.table("timeEntries").toArray();
      const projectsTable = tx.table("projects");

      for (const entry of oldTimeEntries) {
        await projectsTable.add({
          ...entry,
          parentId: null,
          path: [],
          depth: 0,
          childCount: 0,
        });
      }

      // Delete the old timeEntries table.
      await tx.table("timeEntries").clear();
    });
  }
}

// Create a single database instance
const db = new ChronosDatabase();

export { db };
