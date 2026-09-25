import React from 'react';
import { Files, Briefcase, AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';
import { DocumentReviewStatus } from '../types';

interface StatsBarProps {
  totalDocuments: number;
  totalMatters: number;
  needsReviewCount: number;
  reviewedCount: number;
  restrictedCount: number;
  activeFilter: DocumentReviewStatus | 'all';
  onSelectFilter: (filter: DocumentReviewStatus | 'all') => void;
  hasError?: boolean;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  totalDocuments,
  totalMatters,
  needsReviewCount,
  reviewedCount,
  restrictedCount,
  activeFilter,
  onSelectFilter,
  hasError = false,
}) => {
  const displayVal = (val: number) => (hasError ? '—' : val);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 my-6">
      {/* 1. Total Evidence Documents */}
      <button
        onClick={() => onSelectFilter('all')}
        className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
          activeFilter === 'all'
            ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-800'
            : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>All Evidence</span>
          <Files className={`w-4 h-4 ${activeFilter === 'all' ? 'text-amber-400' : 'text-slate-400'}`} />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-2xl font-bold font-mono ${activeFilter === 'all' ? 'text-white' : 'text-slate-900'}`}>
            {displayVal(totalDocuments)}
          </span>
          <span className="text-xs text-slate-400 font-sans">files</span>
        </div>
      </button>

      {/* 2. Total Matters */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Matters</span>
          <Briefcase className="w-4 h-4 text-slate-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-slate-900">{displayVal(totalMatters)}</span>
          <span className="text-xs text-slate-500 font-sans">{hasError ? 'unavailable' : '3 active · 1 closed'}</span>
        </div>
      </div>

      {/* 3. Needs Review */}
      <button
        onClick={() => onSelectFilter('needs_review')}
        className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
          activeFilter === 'needs_review'
            ? 'bg-amber-950/20 text-amber-950 border-amber-500 ring-2 ring-amber-400 shadow-md'
            : 'bg-amber-50/50 text-amber-900 border-amber-200/80 hover:border-amber-300 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-amber-800">
          <span>Needs Review</span>
          <AlertCircle className="w-4 h-4 text-amber-600" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-amber-700">{displayVal(needsReviewCount)}</span>
          <span className="text-xs text-amber-600/90 font-sans font-medium">{hasError ? 'unavailable' : 'pending action'}</span>
        </div>
      </button>

      {/* 4. Reviewed */}
      <button
        onClick={() => onSelectFilter('reviewed')}
        className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
          activeFilter === 'reviewed'
            ? 'bg-emerald-950/20 text-emerald-950 border-emerald-500 ring-2 ring-emerald-400 shadow-md'
            : 'bg-emerald-50/50 text-emerald-900 border-emerald-200/80 hover:border-emerald-300 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-800">
          <span>Reviewed</span>
          <CheckCircle className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-emerald-700">{displayVal(reviewedCount)}</span>
          <span className="text-xs text-emerald-600/90 font-sans font-medium">{hasError ? 'unavailable' : 'certified'}</span>
        </div>
      </button>

      {/* 5. Restricted */}
      <button
        onClick={() => onSelectFilter('restricted')}
        className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between col-span-2 sm:col-span-1 ${
          activeFilter === 'restricted'
            ? 'bg-rose-950/20 text-rose-950 border-rose-500 ring-2 ring-rose-400 shadow-md'
            : 'bg-rose-50/50 text-rose-900 border-rose-200/80 hover:border-rose-300 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-rose-800">
          <span>Restricted</span>
          <ShieldAlert className="w-4 h-4 text-rose-600" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-rose-700">{displayVal(restrictedCount)}</span>
          <span className="text-xs text-rose-600/90 font-sans font-medium">{hasError ? 'unavailable' : 'gated access'}</span>
        </div>
      </button>
    </div>
  );
};
