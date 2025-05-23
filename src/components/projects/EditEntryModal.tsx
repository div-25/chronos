"use client";

import { useState, useEffect } from "react";
import { useTimeStore } from "@/store/timeStore";
import { Project, TimeSegment } from "@/lib/db";
import { toUTC, toLocalTime, formatDateForInput } from "@/lib/utils";

interface EditEntryModalProps {
  entry: Project | null;
  onClose: () => void;
}

// Define a type for the form data that uses strings for dates
interface EntryFormData {
  title?: string;
  notes?: string;
  parentId?: string | null;
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
  const [tagInput, setTagInput] = useState("");
  const [projectsList, setProjectsList] = useState<Project[]>([]);

  const loadProjects = async () => {
    const { getRecentEntries } = useTimeStore.getState();
    const projects = await getRecentEntries();
    setProjectsList(projects);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (entry) {
      // Convert segments dates from UTC to local time for input fields
      const formattedSegments = entry.segments.map((segment) => {
        // Convert UTC dates to local time
        const localStartTime = segment.startTime
          ? toLocalTime(new Date(segment.startTime))
          : null;
        const localEndTime = segment.endTime
          ? toLocalTime(new Date(segment.endTime))
          : null;

        return {
          startTime: formatDateForInput(localStartTime),
          endTime: localEndTime ? formatDateForInput(localEndTime) : null,
          duration: segment.duration,
        };
      });

      setFormData({
        title: entry.title,
        notes: entry.notes,
        tags: entry.tags,
        segments: formattedSegments,
        parentId: entry.parentId === null ? null : entry.parentId, // Fix here
      });
    }
  }, [entry]);

  if (!entry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Convert string dates back to Date objects for segments (from local to UTC)
    const updatedSegments: TimeSegment[] = (formData.segments || []).map(
      (segment) => {
        // Parse local time input strings to Date objects
        let localStartTime: Date | null = null;
        let localEndTime: Date | null = null;

        if (segment.startTime) {
          // Parse the local datetime string (YYYY-MM-DDTHH:MM)
          localStartTime = new Date(segment.startTime);
        } else {
          localStartTime = new Date(); // Default to current time if empty
        }

        if (segment.endTime) {
          localEndTime = new Date(segment.endTime);
        }

        // Convert local times to UTC for storage
        const startTime = toUTC(localStartTime);
        const endTime = localEndTime ? toUTC(localEndTime) : null;

        // Calculate duration for this segment
        const duration = endTime
          ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
          : 0;

        return {
          startTime,
          endTime,
          duration,
        };
      }
    );

    // Calculate total duration
    const totalDuration = updatedSegments.reduce(
      (total, segment) => total + segment.duration,
      0
    );

    const updatedEntry: Project = {
      ...entry,
      title: formData.title || entry.title,
      notes: formData.notes || entry.notes,
      tags: formData.tags || entry.tags,
      parentId: formData.parentId,
      segments: updatedSegments,
      duration: totalDuration,
      updatedAt: toUTC(new Date()),
    };

    await updateEntry(updatedEntry);
    onClose();
  };

  const updateSegmentTime = (
    index: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    const updatedSegments = [...(formData.segments || [])];
    updatedSegments[index] = {
      ...updatedSegments[index],
      [field]: value,
    };

    setFormData({
      ...formData,
      segments: updatedSegments,
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
      segments: updatedSegments,
    });
  };

  const addTag = () => {
    if (!tagInput.trim()) return;

    // Don't add duplicate tags
    if (formData.tags?.includes(tagInput.trim())) {
      setTagInput("");
      return;
    }

    setFormData({
      ...formData,
      tags: [...(formData.tags || []), tagInput.trim()],
    });
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
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
              value={formData.title || ""}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full p-2 bg-gray-700 rounded border border-gray-600"
              required
            />
          </div>

          <div className="relative mb-4">
            <label className="block mb-1">Parent Project</label>
            <div className="relative">
              <select
                value={formData.parentId ?? ""} // Fix here
                onChange={(e) => {
                  const newParentId = e.target.value || null;
                  setFormData({ ...formData, parentId: newParentId });
                }}
                className={`w-full p-2 pl-10 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none text-white}`}
              >
                <option value="" className={"text-gray-400"}>
                  No Parent Project
                </option>
                {projectsList
                  .filter((project) => {
                    // Filter out:
                    // 1. The current project itself
                    // 2. Any project that has the current entry in its path
                    return (
                      project.id !== entry?.id &&
                      !project.path.includes(entry?.id || "")
                    );
                  })
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
              </select>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 absolute left-3 top-2.5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 absolute right-3 top-2.5 text-gray-400 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>

          <div>
            <label className="block mb-1">Notes</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 min-h-[100px]"
            />
          </div>

          <div>
            <label className="block mb-1">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags?.map((tag) => (
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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
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
                <div
                  key={index}
                  className="p-3 bg-gray-700 rounded border border-gray-600 relative"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">Session {index + 1}</h4>
                    {formData.segments && formData.segments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteSegment(index)}
                        className="text-gray-400 hover:text-red-500 focus:outline-none"
                        aria-label="Delete segment"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 text-sm">Start Time</label>
                      <input
                        type="datetime-local"
                        value={segment.startTime || ""}
                        onChange={(e) =>
                          updateSegmentTime(index, "startTime", e.target.value)
                        }
                        className="w-full p-2 bg-gray-600 rounded border border-gray-500 text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-sm">End Time</label>
                      <input
                        type="datetime-local"
                        value={segment.endTime || ""}
                        onChange={(e) =>
                          updateSegmentTime(index, "endTime", e.target.value)
                        }
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
