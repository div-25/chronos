"use client";

import { useState, useEffect } from 'react';
import { useTimeStore } from '@/store/timeStore';
import { TimeEntry, TimeSegment } from '@/lib/db';

interface EditEntryModalProps {
  entry: TimeEntry | null;
  onClose: () => void;
}

// Define a type for the form data that uses strings for dates
interface EntryFormData {
  title?: string;
  notes?: string;
  tags?: string[];
  segments?: {
    startTime: string;
    endTime: string | null;
    duration: number;
  }[];
}

export function EditEntryModal({ entry, onClose }: EditEntryModalProps) {
  const { updateEntry } = useTimeStore();
  const [formData, setFormData] = useState<EntryFormData>({});
  const [tagInput, setTagInput] = useState('');
  
  useEffect(() => {
    if (entry) {
      // Convert segments dates to string for input fields
      const formattedSegments = entry.segments.map(segment => ({
        startTime: segment.startTime ? new Date(segment.startTime).toISOString().slice(0, 16) : '',
        endTime: segment.endTime ? new Date(segment.endTime).toISOString().slice(0, 16) : null,
        duration: segment.duration
      }));
      
      setFormData({
        title: entry.title,
        notes: entry.notes,
        tags: entry.tags,
        segments: formattedSegments
      });
    }
  }, [entry]);
  
  if (!entry) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert string dates back to Date objects for segments
    const updatedSegments: TimeSegment[] = (formData.segments || []).map((segment) => {
      // Create a new segment with the form data
      const startTime = segment.startTime 
        ? new Date(segment.startTime) 
        : new Date();
        
      const endTime = segment.endTime 
        ? new Date(segment.endTime) 
        : null;
      
      // Calculate duration for this segment
      const duration = endTime
        ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
        : 0;
      
      return {
        startTime,
        endTime,
        duration
      };
    });
    
    // Calculate total duration
    const totalDuration = updatedSegments.reduce(
      (total, segment) => total + segment.duration,
      0
    );
    
    const updatedEntry: TimeEntry = {
      ...entry,
      title: formData.title || entry.title,
      notes: formData.notes || entry.notes,
      tags: formData.tags || entry.tags,
      segments: updatedSegments,
      duration: totalDuration,
      updatedAt: new Date(),
    };
    
    await updateEntry(updatedEntry);
    onClose();
  };
  
  const updateSegmentTime = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const updatedSegments = [...(formData.segments || [])];
    updatedSegments[index] = {
      ...updatedSegments[index],
      [field]: value
    };
    
    setFormData({
      ...formData,
      segments: updatedSegments
    });
  };
  
  const deleteSegment = (index: number) => {
    // Don't allow deleting if there's only one segment
    if (!formData.segments || formData.segments.length <= 1) {
      return;
    }
    
    const updatedSegments = [...formData.segments];
    updatedSegments.splice(index, 1);
    
    setFormData({
      ...formData,
      segments: updatedSegments
    });
  };
  
  const addTag = () => {
    if (!tagInput.trim()) return;
    
    // Don't add duplicate tags
    if (formData.tags?.includes(tagInput.trim())) {
      setTagInput('');
      return;
    }
    
    setFormData({
      ...formData,
      tags: [...(formData.tags || []), tagInput.trim()]
    });
    setTagInput('');
  };
  
  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(tag => tag !== tagToRemove)
    });
  };
  
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Edit Time Entry</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-1">Title</label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full p-2 bg-gray-700 rounded border border-gray-600"
              required
            />
          </div>
          
          <div>
            <label className="block mb-1">Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 min-h-[100px]"
            />
          </div>
          
          <div>
            <label className="block mb-1">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags?.map(tag => (
                <div 
                  key={tag} 
                  className="bg-blue-600 text-white px-2 py-1 rounded-full text-sm flex items-center"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-white hover:text-red-300 focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag and press Enter"
                className="flex-1 p-2 bg-gray-700 rounded-l border border-gray-600"
              />
              <button
                type="button"
                onClick={addTag}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 rounded-r"
              >
                Add
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Tags help you categorize and filter your time entries
            </p>
          </div>
          
          <div>
            <label className="block mb-2">Time Segments</label>
            <div className="space-y-4 max-h-[300px] overflow-y-auto p-2">
              {formData.segments?.map((segment, index) => (
                <div key={index} className="p-3 bg-gray-700 rounded border border-gray-600 relative">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">Session {index + 1}</h4>
                    {formData.segments && formData.segments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteSegment(index)}
                        className="text-gray-400 hover:text-red-500 focus:outline-none"
                        aria-label="Delete segment"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 text-sm">Start Time</label>
                      <input
                        type="datetime-local"
                        value={segment.startTime || ''}
                        onChange={e => updateSegmentTime(index, 'startTime', e.target.value)}
                        className="w-full p-2 bg-gray-600 rounded border border-gray-500 text-sm"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block mb-1 text-sm">End Time</label>
                      <input
                        type="datetime-local"
                        value={segment.endTime || ''}
                        onChange={e => updateSegmentTime(index, 'endTime', e.target.value)}
                        className="w-full p-2 bg-gray-600 rounded border border-gray-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}