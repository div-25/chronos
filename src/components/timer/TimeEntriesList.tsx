"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTimeStore } from '@/store/timeStore';
import { TimeEntry } from '@/lib/db';
import { formatDate, formatDuration } from '@/lib/utils';
import { EditEntryModal } from './EditEntryModal';

export function TimeEntriesList() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const { getRecentEntries, deleteEntry, resumeTask, currentEntry } = useTimeStore();
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  
  const loadEntries = useCallback(async () => {
    try {
      setIsLoading(true);
      const recentEntries = await getRecentEntries();
      setEntries(recentEntries);
      
      // Extract all unique tags from entries
      const tags = new Set<string>();
      recentEntries.forEach(entry => {
        entry.tags.forEach(tag => tags.add(tag));
      });
      setAvailableTags(Array.from(tags).sort());
      
    } catch (error) {
      console.error("Error loading entries:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getRecentEntries]);
  
  // Filter entries when selected tags change
  useEffect(() => {
    if (selectedTags.length === 0) {
      setFilteredEntries(entries);
    } else {
      const filtered = entries.filter(entry => 
        selectedTags.every(tag => entry.tags.includes(tag))
      );
      setFilteredEntries(filtered);
    }
  }, [entries, selectedTags]);
  
  useEffect(() => {
    loadEntries();
    
    // Set up interval to refresh entries
    const refreshInterval = setInterval(() => {
      loadEntries();
    }, 10000); // Refresh every 10 seconds (increased from 5 seconds)
    
    // Clean up interval on component unmount
    return () => {
      clearInterval(refreshInterval);
    };
  }, [loadEntries]);
  
  // Toggle tag selection
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };
  
  // Clear all selected tags
  const clearTagFilter = () => {
    setSelectedTags([]);
  };
  
  // Helper function to get the most recent segment's start time
  const getLatestStartTime = useCallback((entry: TimeEntry) => {
    if (entry.segments && entry.segments.length > 0) {
      const latestSegment = entry.segments[entry.segments.length - 1];
      return latestSegment.startTime;
    }
    return new Date(); // Fallback
  }, []);
  
  // Helper function to check if an entry is the current active one
  const isCurrentEntry = useCallback((entry: TimeEntry) => {
    return currentEntry?.id === entry.id;
  }, [currentEntry]);
  
  // Handle delete without confirmation
  const handleDelete = useCallback((id: string) => {
    deleteEntry(id).then(() => {
      loadEntries(); // Refresh the list after deletion
    });
  }, [deleteEntry, loadEntries]);
  
  // Handle resume task
  const handleResume = useCallback((id: string) => {
    resumeTask(id);
  }, [resumeTask]);
  
  // Memoize the entries list to prevent unnecessary re-renders
  const entriesList = useMemo(() => {
    return filteredEntries.map((entry) => (
      <div
        key={entry.id}
        className={`p-5 ${isCurrentEntry(entry) ? 'bg-gray-700 border-l-4 border-green-500' : 'bg-gray-800'} rounded-lg shadow-md hover:shadow-lg transition-all duration-200`}
      >
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-bold text-lg">{entry.title}</h3>
          <div className="text-right">
            <span className="text-gray-300 font-mono">{formatDuration(entry.duration)}</span>
            <p className="text-gray-400 text-xs">
              {formatDate(getLatestStartTime(entry))}
            </p>
          </div>
        </div>
        
        {entry.notes && (
          <p className="text-gray-400 text-sm mt-1 mb-3">
            {entry.notes}
          </p>
        )}
        
        <div className="flex flex-wrap justify-between items-center mt-3">
          <div className="flex flex-wrap gap-1 mb-2">
            {entry.tags && entry.tags.length > 0 ? (
              entry.tags.map(tag => (
                <span 
                  key={tag} 
                  className="bg-blue-600/30 text-blue-200 px-2 py-0.5 rounded-full text-xs border border-blue-500/30"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-gray-500 text-xs">No tags</span>
            )}
            
            {entry.segments.length > 1 && (
              <span className="ml-2 text-xs bg-purple-900/50 text-purple-200 px-2 py-0.5 rounded-full border border-purple-500/30">
                {entry.segments.length} sessions
              </span>
            )}
          </div>
          
          <div className="flex space-x-2">
            {!isCurrentEntry(entry) && (
              <button
                onClick={() => entry.id && handleResume(entry.id)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium shadow-sm hover:shadow transition-all flex items-center"
                title="Resume this task"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Resume
              </button>
            )}
            <button
              onClick={() => setEditingEntry(entry)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium shadow-sm hover:shadow transition-all flex items-center"
              title="Edit this entry"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            <button
              onClick={() => entry.id && handleDelete(entry.id)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium shadow-sm hover:shadow transition-all flex items-center"
              title="Delete this entry"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      </div>
    ));
  }, [filteredEntries, isCurrentEntry, getLatestStartTime, handleDelete, handleResume]);
  
  return (
    <div className="mt-8 bg-gray-900 p-6 rounded-xl shadow-lg">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-white">Recent Time Entries</h2>
        
        {availableTags.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-3">
            <span className="text-sm text-gray-400">Filter by tags:</span>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-1 rounded-full text-xs transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-600 text-white font-medium shadow-sm'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
              {selectedTags.length > 0 && (
                <button
                  onClick={clearTagFilter}
                  className="px-2 py-1 rounded-full text-xs bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        {isLoading && entries.length === 0 ? (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-400">Loading entries...</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-2">
              {entries.length === 0 ? "No time entries yet." : "No entries match the selected tags."}
            </p>
            {entries.length > 0 && selectedTags.length > 0 && (
              <button
                onClick={clearTagFilter}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium mt-2"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          entriesList
        )}
      </div>
      
      {editingEntry && (
        <EditEntryModal 
          entry={editingEntry} 
          onClose={() => {
            setEditingEntry(null);
            loadEntries(); // Refresh entries after editing
          }} 
        />
      )}
    </div>
  );
}