import React, { useState } from 'react';
import { Search, Shield, Briefcase, Upload, Hash, FileText, X, SlidersHorizontal } from 'lucide-react';
import { Matter, DocumentClassification } from '../types';

interface MatterSelectorProps {
  matters: Matter[];
  selectedMatterId: string | 'all';
  onSelectMatter: (matterId: string | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedClassification: DocumentClassification | 'all';
  onSelectClassification: (classification: DocumentClassification | 'all') => void;
  selectedFileType?: string;
  onSelectFileType?: (fileType: string) => void;
  sha256Query?: string;
  onSha256Change?: (hash: string) => void;
  onClearFilters?: () => void;
  onOpenUpload?: () => void;
}

export const MatterSelector: React.FC<MatterSelectorProps> = ({
  matters,
  selectedMatterId,
  onSelectMatter,
  searchQuery,
  onSearchChange,
  selectedClassification,
  onSelectClassification,
  selectedFileType = 'all',
  onSelectFileType,
  sha256Query = '',
  onSha256Change,
  onClearFilters,
  onOpenUpload,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const totalEvidenceCount = matters.reduce((sum, m) => sum + m.documentCount, 0);

  const hasActiveFilters =
    selectedMatterId !== 'all' ||
    selectedClassification !== 'all' ||
    searchQuery.trim().length > 0 ||
    selectedFileType !== 'all' ||
    sha256Query.trim().length > 0;

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3.5 mb-6">
      {/* Matter Pills Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
          <Briefcase className="w-3.5 h-3.5 text-slate-500" />
          <span>Matter:</span>
        </span>

        <button
          onClick={() => onSelectMatter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 ${
            selectedMatterId === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span>All Matters</span>
          <span
            className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
              selectedMatterId === 'all' ? 'bg-slate-800 text-amber-300' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {totalEvidenceCount}
          </span>
        </button>

        {matters.map((m) => {
          const isSelected = selectedMatterId === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelectMatter(m.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="font-mono text-[11px] opacity-80">{m.referenceCode}</span>
              <span>·</span>
              <span className="truncate max-w-[160px]">{m.title}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-slate-800 text-amber-300' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {m.documentCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Primary Search & Filter Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Title/Metadata Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by title, reference, tags, or filename..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Classification Filter */}
        <div className="flex items-center space-x-2">
          <label className="text-xs text-slate-500 flex items-center gap-1 font-medium whitespace-nowrap">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Classification:</span>
          </label>
          <select
            value={selectedClassification}
            onChange={(e) => onSelectClassification(e.target.value as DocumentClassification | 'all')}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition cursor-pointer"
          >
            <option value="all">All Classifications</option>
            <option value="privileged">Privileged (Attorney-Client)</option>
            <option value="confidential">Confidential (Litigation)</option>
            <option value="internal">Internal Firm Record</option>
          </select>
        </div>

        {/* Advanced Filter Toggle Button */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3 py-2 border rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
            showAdvanced || sha256Query || selectedFileType !== 'all'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
          title="Toggle SHA-256 and File Type filters"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          <span>Faceted Search</span>
        </button>

        {/* Upload Action Button */}
        {onOpenUpload && (
          <button
            type="button"
            onClick={onOpenUpload}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap border border-slate-800 hover:border-amber-500/40"
            title="Upload Evidence to Secure Repository"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>Upload Evidence</span>
          </button>
        )}
      </div>

      {/* Advanced Faceted Search Drawer (SHA-256 & File Type) */}
      {(showAdvanced || sha256Query || selectedFileType !== 'all') && (
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-in fade-in duration-150">
          {/* SHA-256 Checksum Input */}
          <div className="relative flex-1">
            <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={sha256Query}
              onChange={(e) => onSha256Change?.(e.target.value)}
              placeholder="Search exact or prefix SHA-256 checksum (e.g. b66b01...)"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition font-mono text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* File Type Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-xs text-slate-500 flex items-center gap-1 font-medium whitespace-nowrap">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>File Type:</span>
            </label>
            <select
              value={selectedFileType}
              onChange={(e) => onSelectFileType?.(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition cursor-pointer"
            >
              <option value="all">All File Formats</option>
              <option value="pdf">PDF Documents (.pdf)</option>
              <option value="docx">Word Files (.docx)</option>
              <option value="xlsx">Excel Spreadsheets (.xlsx)</option>
              <option value="csv">CSV Data (.csv)</option>
              <option value="txt">Plain Text (.txt)</option>
              <option value="image">Images (.png, .jpg, .tiff)</option>
            </select>
          </div>

          {/* Clear All Filters Button */}
          {hasActiveFilters && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              <X className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
