"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/utils";
import { useTimeStore } from "@/store/timeStore";
import { useTimer } from "@/lib/hooks/useTimer";
import { Project } from "@/lib/db";

export function TimerControl() {
  const {
    isTimerRunning,
    isPaused,
    currentEntry,
    elapsedTime,
    todayTime,
    weekTime,
    totalTime,
    handleStartTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    getSessionCount,
  } = useTimer();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [parentId, setParentId] = useState<string | null>();
  const [projectsList, setProjectsList] = useState<Project[]>([]);

  const loadProjects = async () => {
    const { getRecentEntries } = useTimeStore.getState();
    const projects = await getRecentEntries();
    setProjectsList(projects);
  };

  // Fetch projects when component mounts
  useEffect(() => {
    loadProjects();
  }, []);

  const onStartTimer = () => {
    if (!title.trim()) return; // Prevent starting timer without a title

    handleStartTimer(title, notes, tags, parentId);
    setTitle("");
    setNotes("");
    setTags([]);
    setTagInput("");
    setParentId(null);
    loadProjects();
  };

  const addTag = () => {
    if (!tagInput.trim()) return;

    // Don't add duplicate tags
    if (tags.includes(tagInput.trim())) {
      setTagInput("");
      return;
    }

    setTags([...tags, tagInput.trim()]);
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
      <div className="flex items-center mb-4">
        <div className="w-3 h-3 rounded-full mr-2 bg-emerald-500 animate-pulse"></div>
        <h2 className="text-2xl font-bold">Time Tracker</h2>
      </div>

      {!isTimerRunning && !isPaused ? (
        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What project are you working on?"
              className="w-full p-3 pl-10 bg-gray-700 rounded-lg border border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 absolute left-3 top-3.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </div>
          <div className="relative mb-4">
            <select
              value={parentId || ""}
              onChange={(e) => setParentId(e.target.value || undefined)}
              className={`w-full p-3 pl-10 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none ${parentId ? "text-white" : "text-gray-400"}`}
            >
              <option value="">No Parent Project</option>
              {projectsList.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 absolute left-3 top-3.5 text-gray-400"
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
              className="h-5 w-5 absolute right-3 top-3.5 text-gray-400 pointer-events-none"
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

          <div className="relative">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes (optional)"
              className="w-full p-3 pl-10 bg-gray-700 rounded-lg border border-gray-600 text-white resize-none h-24 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 absolute left-3 top-3.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Tags (optional)
            </label>
            <div className="flex flex-wrap gap-2 mb-2 min-h-8">
              {tags.map((tag) => (
                <div
                  key={tag}
                  className="bg-blue-600/30 text-blue-200 px-2 py-1 rounded-full text-sm flex items-center border border-blue-500/30"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-blue-200 hover:text-red-300 focus:outline-none"
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
              <div className="relative flex-1">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Add tags"
                  className="w-full p-3 pl-10 bg-gray-700 rounded-l-lg border border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 absolute left-3 top-3.5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              </div>
              <button
                type="button"
                onClick={addTag}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-r-lg font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <button
            onClick={onStartTimer}
            disabled={!title.trim()}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Start Timer
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-inner">
            <div className="text-center">
              <div className="text-sm font-mono text-gray-400 mb-1">
                Current Session
              </div>
              <div className="text-5xl font-mono text-white py-2">
                {formatDuration(elapsedTime)}
              </div>
              {isPaused && (
                <div className="text-yellow-500 text-lg mt-1 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  PAUSED
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between text-gray-300">
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Today
                </div>
                <div className="text-sm font-mono">
                  {formatDuration(todayTime)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  This Week
                </div>
                <div className="text-sm font-mono">
                  {formatDuration(weekTime)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  All Time
                </div>
                <div className="text-sm font-mono">
                  {formatDuration(totalTime)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
            <h3 className="text-xl font-medium">
              {currentEntry?.title}
              {getSessionCount() > 1 && (
                <span className="ml-2 text-xs bg-purple-900/50 text-purple-200 px-2 py-0.5 rounded-full border border-purple-500/30">
                  Session {getSessionCount()}
                </span>
              )}
            </h3>
            {currentEntry?.notes && (
              <p className="text-gray-400 text-sm mt-2">{currentEntry.notes}</p>
            )}
            {currentEntry?.tags && currentEntry.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {currentEntry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-blue-600/30 text-blue-200 px-2 py-0.5 rounded-full text-xs border border-blue-500/30"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {isPaused ? (
              <button
                onClick={resumeTimer}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Resume
              </button>
            ) : (
              <button
                onClick={pauseTimer}
                className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg transition-all flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Pause
              </button>
            )}
            <button
              onClick={stopTimer}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 10l6 0"
                />
              </svg>
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
