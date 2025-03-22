import { db, TimeSegment, Project } from './db';

export async function exportToCSV(): Promise<string> {
  const projects = await db.projects.toArray();
  
  // Updated CSV headers to include project-specific fields
  const headers = [
    'ID',
    'Title',
    'Parent ID',
    'Path',
    'Depth',
    'Child Count',
    'Notes',
    'Tags',
    'Total Duration (sec)',
    'Created At',
    'Updated At',
    'Segment Index',
    'Segment Start Time',
    'Segment End Time',
    'Segment Duration (sec)'
  ];
  
  // Format each project as CSV rows (one row per segment)
  const rows: string[][] = [];
  
  projects.forEach(project => {
    // For each project, create a row for each segment
    project.segments.forEach((segment, index) => {
      rows.push([
        project.id || '',
        project.title,
        project.parentId || '',
        project.path.join(';'),
        project.depth.toString(),
        project.childCount.toString(),
        project.notes || '',
        project.tags.join(';'),
        project.duration.toString(),
        project.createdAt.toISOString(),
        project.updatedAt.toISOString(),
        index.toString(),
        segment.startTime.toISOString(),
        segment.endTime ? segment.endTime.toISOString() : '',
        segment.duration.toString()
      ]);
    });
  });
  
  // Combine header and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${escapeCSVValue(cell)}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

// Helper function to escape CSV values
function escapeCSVValue(value: string | number | boolean | null | undefined): string {
  // Convert value to string and then replace double quotes with two double quotes (CSV standard)
  return String(value).replace(/"/g, '""');
}

export function downloadCSV(csvContent: string, filename: string = 'chronos-export.csv'): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function importFromCSV(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        if (!content) {
          throw new Error("Failed to read file content");
        }
        
        const lines = content.split(/\r?\n/);
        if (lines.length < 2) {
          throw new Error("CSV file is empty or invalid");
        }
        
        const headers = parseCSVLine(lines[0]);
        
        // Detect if this is an old format (TimeEntry) or new format (Project)
        const isOldFormat = !headers.includes('Parent ID');
        
        // Process CSV
        const projectsMap = new Map<string, { 
          project: Partial<Project>, 
          segments: TimeSegment[] 
        }>();
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = parseCSVLine(lines[i]);
          const rowData: Record<string, string> = {};
          
          headers.forEach((header, index) => {
            if (index < values.length) {
              rowData[header] = values[index];
            }
          });
          
          const id = rowData['ID'];
          if (!id) {
            console.warn(`Skipping line ${i+1}: missing ID`);
            continue;
          }
          
          
          // Extract segment data
          const segment = parseSegmentData(rowData);
          if (!segment) continue;
          
          // If this is the first segment for this project
          if (!projectsMap.has(id)) {
            const projectData = isOldFormat ? 
              convertTimeEntryToProject(rowData) : 
              parseProjectData(rowData);
            
            projectsMap.set(id, {
              project: projectData,
              segments: []
            });
          }
          
          // Add segment to the project
          const projectData = projectsMap.get(id)!;
          const segmentIndex = parseInt(rowData['Segment Index'], 10);
          projectData.segments[segmentIndex] = segment;
        }
        
        // Convert map to array of projects
        const projects: Project[] = [];
        
        projectsMap.forEach(({ project, segments }) => {
          const hasActiveSegment = segments.some(segment => segment.endTime === null);
          
          projects.push({
            ...project,
            segments,
            isActive: hasActiveSegment
          } as Project);
        });
        
        // Update database
        await db.transaction('rw', db.projects, async () => {
          await db.projects.clear();
          if (projects.length > 0) {
            await db.projects.bulkAdd(projects);
          }
        });
        
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read the file'));
    reader.readAsText(file);
  });
}

// Helper functions for parsing data
function parseSegmentData(rowData: Record<string, string>): TimeSegment | null {
  const startTime = new Date(rowData['Segment Start Time']);
  const endTimeStr = rowData['Segment End Time'];
  const endTime = endTimeStr ? new Date(endTimeStr) : null;
  const duration = parseInt(rowData['Segment Duration (sec)'], 10);
  
  if (!isValidDate(startTime) || (endTimeStr && !isValidDate(endTime as Date)) || isNaN(duration)) {
    return null;
  }
  
  return { startTime, endTime, duration };
}

function convertTimeEntryToProject(rowData: Record<string, string>): Partial<Project> {
  return {
    id: rowData['ID'],
    title: rowData['Title'],
    notes: rowData['Notes'] === '"' ? '' : rowData['Notes'] || '',  // Fix for empty notes
    tags: rowData['Tags'] === '"' ? [] : (rowData['Tags'] ? rowData['Tags'].split(';') : []),  // Fix for empty tags
    duration: parseInt(rowData['Total Duration (sec)'], 10),
    createdAt: new Date(rowData['Created At']),
    updatedAt: new Date(rowData['Updated At']),
    parentId: null,
    path: [],
    depth: 0,
    childCount: 0,
    isActive: false
  };
}

function parseProjectData(rowData: Record<string, string>): Partial<Project> {
  return {
    id: rowData['ID'],
    title: rowData['Title'],
    parentId: rowData['Parent ID'] || null,
    path: rowData['Path'] ? rowData['Path'].split(';') : [],
    depth: parseInt(rowData['Depth'], 10) || 0,
    childCount: parseInt(rowData['Child Count'], 10) || 0,
    notes: rowData['Notes'] === '"' ? '' : rowData['Notes'] || '',  // Fix for empty notes
    tags: rowData['Tags'] === '"' ? [] : (rowData['Tags'] ? rowData['Tags'].split(';') : []),  // Fix for empty tags
    duration: parseInt(rowData['Total Duration (sec)'], 10),
    createdAt: new Date(rowData['Created At']),
    updatedAt: new Date(rowData['Updated At']),
    isActive: false
  };
}

// Helper function to parse CSV line considering quoted values
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (i + 1 < line.length && line[i + 1] === '"') {
        // Handle escaped quotes
        currentValue += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // End of value
      values.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  
  // Add the last value
  values.push(currentValue);
  
  return values.map(value => value.replace(/^"(.*)"$/, '$1')); // Remove surrounding quotes
}

// Helper function to validate date
function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}