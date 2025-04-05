"use client";

import { useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { exportToCSV, downloadCSV, importFromCSV } from '@/lib/export';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { FiDownload, FiUpload } from 'react-icons/fi';

export function Navbar() {
  const pathname = usePathname();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isActive = (path: string) => {
    return pathname === path;
  };
  
  const handleExport = async () => {
    try {
      const csvContent = await exportToCSV();
      // Only show loading state during CSV generation, not during file save
      setExporting(true);
      downloadCSV(csvContent);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      await importFromCSV(file);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Reload the page to show the imported data
      window.location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };
  
  return (
    <nav className="bg-gray-900 shadow-md">
      <div className="container mx-auto px-4 py-3 max-w-4xl">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-white">
              Chronos
            </Link>
            
            <div className="ml-8 flex space-x-4">
              <Link 
                href="/" 
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/') 
                    ? 'bg-gray-700 text-white' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                Dashboard
              </Link>
              <Link 
                href="/statistics" 
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/statistics') 
                    ? 'bg-gray-700 text-white' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                Statistics
              </Link>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white text-sm disabled:opacity-50 w-24 flex items-center justify-center gap-2"
            >
              {importing ? (
                <AiOutlineLoading3Quarters className="animate-spin" />
              ) : (
                <>
                  <FiUpload />
                  <span>Import</span>
                </>
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm disabled:opacity-50 w-24 flex items-center justify-center gap-2"
            >
              {exporting ? (
                <AiOutlineLoading3Quarters className="animate-spin" />
              ) : (
                <>
                  <FiDownload />
                  <span>Export</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}