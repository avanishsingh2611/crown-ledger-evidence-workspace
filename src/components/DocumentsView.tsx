import React, { useState } from 'react';
import {
  Search,
  Filter,
  RotateCcw,
  Upload,
  Eye,
  Download,
  Lock,
  Clock,
  Shield,
  FileText,
  Hash,
  Layers,
  ChevronDown,
} from 'lucide-react';
import {
  Matter,
  EvidenceDocument,
  DocumentVersion,
  DocumentClassification,
  DocumentReviewStatus,
} from '../types';

interface DocumentsViewProps {
  documents: EvidenceDocument[];
  matters: Matter[];
  selectedMatterId: string | 'all';
  onSelectMatterId: (id: string | 'all') => void;
  reviewStatusFilter: DocumentReviewStatus | 'all';
  onSelectReviewStatus: (status: DocumentReviewStatus | 'all') => void;
  classificationFilter: DocumentClassification | 'all';
  onSelectClassification: (cls: DocumentClassification | 'all') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  fileTypeFilter: string;
  onSelectFileType: (type: string) => void;
  sha256Query: string;
  onSha256Change: (h: string) => void;
  onClearFilters: () => void;
  onSelectDocument: (doc: EvidenceDocument) => void;
  onInitiateDownload: (doc: EvidenceDocument, version?: DocumentVersion) => void;
  onRequestAccess: (doc: EvidenceDocument) => void;
  onOpenUpload: () => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  matters,
  selectedMatterId,
  onSelectMatterId,
  reviewStatusFilter,
  onSelectReviewStatus,
  classificationFilter,
  onSelectClassification,
  searchQuery,
  onSearchChange,
  fileTypeFilter,
  onSelectFileType,
  sha256Query,
  onSha256Change,
  onClearFilters,
  onSelectDocument,
  onInitiateDownload,
  onRequestAccess,
  onOpenUpload,
}) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  const hasActiveFilters =
    selectedMatterId !== 'all' ||
    reviewStatusFilter !== 'all' ||
    classificationFilter !== 'all' ||
    fileTypeFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    sha256Query.trim() !== '';

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold">
            DOCUMENTS WORKSPACE
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 mt-1">
            Evidence Repository ({documents.length})
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Authorized custodial evidence records, version histories, and SHA-256 integrity verification.
          </p>
        </div>

        <button
          onClick={onOpenUpload}
          className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Evidence</span>
        </button>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-4 space-y-3">
        {/* Top Search Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search evidence title, tags, matter reference, filename..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-stone-50/60 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-2 text-xs font-medium rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
                showAdvancedFilters || hasActiveFilters
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-white text-slate-700 border-stone-300 hover:bg-stone-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-amber-600" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>

            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer flex items-center gap-1"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-150">
            {/* Matter Filter */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1">
                Matter Filter
              </label>
              <select
                value={selectedMatterId}
                onChange={(e) => onSelectMatterId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700"
              >
                <option value="all">All Matters</option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.referenceCode} — {m.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Classification Filter */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1">
                Classification
              </label>
              <select
                value={classificationFilter}
                onChange={(e: any) => onSelectClassification(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700"
              >
                <option value="all">All Classifications</option>
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="confidential">Confidential</option>
                <option value="privileged">Privileged</option>
              </select>
            </div>

            {/* Review Status Filter */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1">
                Review Status
              </label>
              <select
                value={reviewStatusFilter}
                onChange={(e: any) => onSelectReviewStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="needs_review">Needs Review</option>
                <option value="reviewed">Reviewed & Certified</option>
                <option value="restricted">Restricted Determination</option>
              </select>
            </div>

            {/* File Type Filter */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1">
                File Type / Format
              </label>
              <select
                value={fileTypeFilter}
                onChange={(e) => onSelectFileType(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700"
              >
                <option value="all">All File Formats</option>
                <option value="pdf">PDF Documents (.pdf)</option>
                <option value="docx">Word Files (.docx)</option>
                <option value="xlsx">Spreadsheets (.xlsx)</option>
                <option value="csv">Data Exports (.csv)</option>
                <option value="txt">Text Records (.txt)</option>
                <option value="image">Photographic Evidence</option>
              </select>
            </div>

            {/* SHA-256 Hash Filter (spans 2 cols on lg) */}
            <div className="sm:col-span-2 lg:col-span-4 pt-1">
              <label className="block text-[10px] font-mono uppercase text-slate-400 font-semibold mb-1 flex items-center gap-1">
                <Hash className="w-3 h-3 text-amber-600" />
                <span>SHA-256 Checksum Exact/Prefix Lookup (Current & Historical Versions)</span>
              </label>
              <input
                type="text"
                value={sha256Query}
                onChange={(e) => onSha256Change(e.target.value)}
                placeholder="Enter full or partial SHA-256 hash (e.g. 5d41402abc4b2a...)"
                className="w-full px-3 py-1.5 text-xs font-mono bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Primary Evidence Table */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        {documents.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-500 space-y-2">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-medium text-slate-700 text-sm">No evidence records found</div>
            <p className="max-w-md mx-auto text-slate-500">
              No evidence documents match your active search or filters, or you lack clearance to discover restricted evidence records in these matters.
            </p>
            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="mt-2 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition cursor-pointer"
              >
                Clear Active Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100/80 text-slate-500 font-mono text-[10px] uppercase border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Evidence Details</th>
                  <th className="py-3 px-3 font-semibold">Matter</th>
                  <th className="py-3 px-3 font-semibold">Classification</th>
                  <th className="py-3 px-3 font-semibold">Review Status</th>
                  <th className="py-3 px-3 font-semibold">Version</th>
                  <th className="py-3 px-3 font-semibold">Size</th>
                  <th className="py-3 px-3 font-semibold">Custodian</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {documents.map((doc) => {
                  const isRestricted =
                    doc.classification === 'restricted' ||
                    doc.classification === 'confidential' ||
                    doc.classification === 'privileged';
                  const userHasAccess = doc.userHasAccess !== false;
                  const isPending = doc.accessRequestStatus === 'pending';

                  return (
                    <tr key={doc.id} className="hover:bg-amber-50/20 transition">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {isRestricted && (
                            <Lock className="w-3 h-3 text-rose-600 flex-shrink-0" />
                          )}
                          <span>{doc.title}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {doc.currentVersion.originalFilename}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-mono text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 block truncate max-w-[120px]" title={doc.matterTitle}>
                          {doc.matterReference}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          doc.classification === 'privileged'
                            ? 'bg-rose-100 text-rose-800'
                            : doc.classification === 'confidential'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {doc.classification}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          doc.reviewStatus === 'reviewed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : doc.reviewStatus === 'restricted'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {doc.reviewStatus.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-700 font-medium">
                        v{doc.currentVersionNumber}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-500 text-[11px]">
                        {formatFileSize(doc.currentVersion.fileSizeBytes)}
                      </td>

                      <td className="py-3.5 px-3 text-slate-700">
                        {doc.creatorName}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onSelectDocument(doc)}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                            title="Inspect document metadata, chain of custody, and versions"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>Inspect</span>
                          </button>

                          {userHasAccess ? (
                            <button
                              onClick={() => onInitiateDownload(doc)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                              title="Download verified signed document"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-semibold">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => onRequestAccess(doc)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                              title="Request ethical-wall clearance"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Request</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
