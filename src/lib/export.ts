import { db, TimeEntry, TimeSegment } from './db';

export async function exportToCSV(): Promise<string> {
  const entries = await db.timeEntries.toArray();
  
  // Create CSV header
  const headers = [
    'ID',
    'Title',
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
  
  // Format each entry as CSV rows (one row per segment)
  const rows: string[][] = [];
  
  entries.forEach(entry => {
    // For each entry, create a row for each segment
    entry.segments.forEach((segment, index) => {
      rows.push([
        entry.id || '',
        entry.title,
        entry.notes || '',
        entry.tags.join(';'),
        entry.duration.toString(),
        entry.createdAt.toISOString(),
        entry.updatedAt.toISOString(),
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
        const csvContent = e.target?.result as string;
        if (!csvContent) {
          throw new Error('Failed to read CSV file');
        }
        
        // Parse CSV content
        const lines = csvContent.split('\n');
        if (lines.length < 2) {
          throw new Error('CSV file is empty or invalid');
        }
        
        const headers = parseCSVLine(lines[0]);
        
        // Validate headers
        const requiredHeaders = [
          'ID', 'Title', 'Notes', 'Tags', 'Total Duration (sec)', 
          'Created At', 'Updated At', 'Segment Index', 
          'Segment Start Time', 'Segment End Time', 'Segment Duration (sec)'
        ];
        
        // Check if this is a new format export (with all segments) or old format
        const isNewFormat = requiredHeaders.every(header => headers.includes(header));
        
        if (!isNewFormat) {
          // Check if it's the old format
          const oldRequiredHeaders = ['Title', 'Start Time', 'End Time', 'Duration (sec)', 'Tags', 'Notes'];
          const isOldFormat = oldRequiredHeaders.every(header => headers.includes(header));
          
          if (!isOldFormat) {
            throw new Error('Invalid CSV format. Please use a file exported from Chronos.');
          }
          
          // Process old format
          return await processOldFormatCSV(lines, headers);
        }
        
        // Process new format (with segments)
        // Group rows by entry ID
        const entriesMap = new Map<string, {
          entry: Partial<TimeEntry>,
          segments: TimeSegment[]
        }>();
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue; // Skip empty lines
          
          const values = parseCSVLine(lines[i]);
          if (values.length !== headers.length) {
            console.warn(`Skipping line ${i+1}: column count mismatch`);
            continue;
          }
          
          // Create a map of header -> value
          const rowData = headers.reduce((obj, header, index) => {
            obj[header] = values[index];
            return obj;
          }, {} as Record<string, string>);
          
          const id = rowData['ID'];
          if (!id) {
            console.warn(`Skipping line ${i+1}: missing ID`);
            continue;
          }
          
          // Parse segment data
          const segmentIndex = parseInt(rowData['Segment Index'], 10);
          const segmentStartTime = new Date(rowData['Segment Start Time']);
          const segmentEndTimeStr = rowData['Segment End Time'];
          const segmentEndTime = segmentEndTimeStr ? new Date(segmentEndTimeStr) : null;
          const segmentDuration = parseInt(rowData['Segment Duration (sec)'], 10);
          
          // Validate segment data
          if (isNaN(segmentIndex) || isNaN(segmentDuration) || !isValidDate(segmentStartTime)) {
            console.warn(`Skipping line ${i+1}: invalid segment data`);
            continue;
          }
          
          const segment: TimeSegment = {
            startTime: segmentStartTime,
            endTime: segmentEndTime,
            duration: segmentDuration
          };
          
          // If this is the first segment for this entry, create the entry
          if (!entriesMap.has(id)) {
            const totalDuration = parseInt(rowData['Total Duration (sec)'], 10);
            const createdAt = new Date(rowData['Created At']);
            const updatedAt = new Date(rowData['Updated At']);
            
            // Validate entry data
            if (isNaN(totalDuration) || !isValidDate(createdAt) || !isValidDate(updatedAt)) {
              console.warn(`Skipping entry ${id}: invalid entry data`);
              continue;
            }
            
            entriesMap.set(id, {
              entry: {
                id,
                title: rowData['Title'],
                notes: rowData['Notes'],
                tags: rowData['Tags'] ? rowData['Tags'].split(';') : [],
                duration: totalDuration,
                isActive: false, // Will be updated based on segments
                createdAt,
                updatedAt
              },
              segments: []
            });
          }
          
          // Add segment to the entry
          const entryData = entriesMap.get(id)!;
          entryData.segments[segmentIndex] = segment;
        }
        
        // Convert map to array of entries
        const entries: TimeEntry[] = [];
        
        entriesMap.forEach(({ entry, segments }) => {
          // Check if any segment is active (no end time)
          const hasActiveSegment = segments.some(segment => segment.endTime === null);
          
          entries.push({
            ...entry,
            segments,
            isActive: hasActiveSegment
          } as TimeEntry);
        });
        
        // Clear existing database and add new entries
        await db.transaction('rw', db.timeEntries, async () => {
          await db.timeEntries.clear();
          if (entries.length > 0) {
            await db.timeEntries.bulkAdd(entries);
          }
        });
        
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read the file'));
    };
    
    reader.readAsText(file);
  });
}

// Process old format CSV (for backward compatibility)
async function processOldFormatCSV(lines: string[], headers: string[]): Promise<void> {
  const entries: TimeEntry[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // Skip empty lines
    
    const values = parseCSVLine(lines[i]);
    
    const titleIndex = headers.indexOf('Title');
    const startTimeIndex = headers.indexOf('Start Time');
    const endTimeIndex = headers.indexOf('End Time');
    const durationIndex = headers.indexOf('Duration (sec)');
    const tagsIndex = headers.indexOf('Tags');
    const notesIndex = headers.indexOf('Notes');
    
    const startTime = new Date(values[startTimeIndex]);
    const endTimeStr = values[endTimeIndex];
    const endTime = endTimeStr ? new Date(endTimeStr) : null;
    const duration = parseInt(values[durationIndex], 10);
    
    // Validate data
    if (!values[titleIndex] || !isValidDate(startTime) || isNaN(duration)) {
      console.warn(`Skipping line ${i+1}: invalid data`);
      continue;
    }
    
    const entry: TimeEntry = {
      title: values[titleIndex],
      segments: [{
        startTime,
        endTime,
        duration
      }],
      duration,
      isActive: endTime === null,
      tags: values[tagsIndex] ? values[tagsIndex].split(';') : [],
      notes: values[notesIndex] || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    entries.push(entry);
  }
  
  // Clear existing database and add new entries
  await db.transaction('rw', db.timeEntries, async () => {
    await db.timeEntries.clear();
    if (entries.length > 0) {
      await db.timeEntries.bulkAdd(entries);
    }
  });
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