import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Search,
  Archive,
  Lock,
  Download,
  Eye,
  FileText,
  Upload,
  ArrowLeft,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
} from 'lucide-react';
import { Matter, EvidenceDocument, DocumentVersion } from '../types';

interface MattersViewProps {
  matters: Matter[];
  documents: EvidenceDocument[];
  onSelectDocument: (doc: EvidenceDocument) => void;
  onInitiateDownload: (doc: EvidenceDocument, version?: DocumentVersion) => void;
  onRequestAccess: (doc: EvidenceDocument) => void;
  onOpenUpload: (matterId?: string) => void;
}

export const MattersView: React.FC<MattersViewProps> = ({
  matters,
  documents,
  onSelectDocument,
  onInitiateDownload,
  onRequestAccess,
  onOpenUpload,
}) => {
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Local filter for documents inside the Matter Detail View
  const [matterDocSearch, setMatterDocSearch] = useState('');

  // Filtered matters list
  const filteredMatters = useMemo(() => {
    return matters.filter((matter) => {
      if (statusFilter !== 'all' && matter.status !== statusFilter) return false;
      if (riskFilter !== 'all' && matter.riskLevel !== riskFilter) return false;
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesTitle = matter.title.toLowerCase().includes(query);
        const matchesRef = matter.referenceCode.toLowerCase().includes(query);
        const matchesClient = matter.clientName.toLowerCase().includes(query);
        const matchesLead = matter.leadAttorneyName.toLowerCase().includes(query);
        if (!matchesTitle && !matchesRef && !matchesClient && !matchesLead) return false;
      }
      return true;
    });
  }, [matters, statusFilter, riskFilter, searchQuery]);

  // Documents for the currently selected matter in Matter Detail view
  const matterDocuments = useMemo(() => {
    if (!selectedMatter) return [];
    return documents.filter((doc) => {
      if (doc.matterId !== selectedMatter.id) return false;
      if (matterDocSearch.trim() !== '') {
        const query = matterDocSearch.toLowerCase();
        const matchesTitle = doc.title.toLowerCase().includes(query);
        const matchesFile = doc.currentVersion.originalFilename.toLowerCase().includes(query);
        const matchesTag = (doc.tags || []).some((t) => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesFile && !matchesTag) return false;
      }
      return true;
    });
  }, [documents, selectedMatter, matterDocSearch]);

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  // ==========================================================
  // RENDER: MATTER DETAIL VIEW
  // ==========================================================
  if (selectedMatter) {
    const isArchived = selectedMatter.status === 'archived';
    const matterDocsTotal = documents.filter((d) => d.matterId === selectedMatter.id);
    const needsReviewCount = matterDocsTotal.filter((d) => d.reviewStatus === 'needs_review').length;
    const reviewedCount = matterDocsTotal.filter((d) => d.reviewStatus === 'reviewed').length;
    const restrictedCount = matterDocsTotal.filter((d) => d.reviewStatus === 'restricted' || d.classification === 'confidential' || d.classification === 'privileged').length;

    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        {/* Back Navigation Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <button
            onClick={() => {
              setSelectedMatter(null);
              setMatterDocSearch('');
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-amber-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Matters</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              {selectedMatter.referenceCode}
            </span>
          </div>
        </div>

        {/* Matter Overview Header Card */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                  isArchived
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {selectedMatter.status}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                  selectedMatter.riskLevel === 'high'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : selectedMatter.riskLevel === 'medium'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  Risk: {selectedMatter.riskLevel}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-900">
                {selectedMatter.title}
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                {selectedMatter.description}
              </p>
            </div>

            {/* Upload Action */}
            <div>
              {isArchived ? (
                <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-1.5" title="Archived matters cannot accept new evidence">
                  <Archive className="w-3.5 h-3.5 text-amber-700" />
                  <span>Archived (Read-Only)</span>
                </div>
              ) : (
                <button
                  onClick={() => onOpenUpload(selectedMatter.id)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload to Matter</span>
                </button>
              )}
            </div>
          </div>

          {/* Compliance Lock Warning if archived */}
          {isArchived && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
              <Archive className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Archived Matter Compliance Lock:</strong> This proceeding is closed/archived. Evidence is sealed for regulatory retention. Uploads, revisions, and status determinations are disabled.
              </div>
            </div>
          )}

          {/* Metadata Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-stone-100 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Client</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">{selectedMatter.clientName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Lead Attorney</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">{selectedMatter.leadAttorneyName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Total Evidence</span>
              <span className="font-bold text-slate-900 mt-0.5 block font-serif text-base">{matterDocsTotal.length}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Review State</span>
              <span className="text-xs text-slate-700 mt-0.5 block">
                <span className="font-semibold text-amber-700">{needsReviewCount}</span> pending / <span className="font-semibold text-emerald-700">{reviewedCount}</span> certified
              </span>
            </div>
          </div>
        </div>

        {/* Evidence In This Matter */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50">
            <div>
              <h2 className="text-sm font-serif font-bold text-slate-900">
                Evidence in this Matter ({matterDocuments.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Authorized custodial records assigned to {selectedMatter.referenceCode}.
              </p>
            </div>

            {/* Matter Doc Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={matterDocSearch}
                onChange={(e) => setMatterDocSearch(e.target.value)}
                placeholder="Search matter evidence..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
              />
            </div>
          </div>

          {/* Table */}
          {matterDocuments.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              {matterDocSearch ? 'No evidence records match your search.' : 'No evidence records registered in this matter yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100/80 text-slate-500 font-mono text-[10px] uppercase border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Evidence Title</th>
                    <th className="py-3 px-3 font-semibold">Classification</th>
                    <th className="py-3 px-3 font-semibold">Review Status</th>
                    <th className="py-3 px-3 font-semibold">Version</th>
                    <th className="py-3 px-3 font-semibold">Size</th>
                    <th className="py-3 px-3 font-semibold">Custodian</th>
                    <th className="py-3 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {matterDocuments.map((doc) => {
                    const isRestricted =
                      doc.classification === 'restricted' ||
                      doc.classification === 'confidential' ||
                      doc.classification === 'privileged';
                    const userHasAccess = doc.userHasAccess !== false;

                    return (
                      <tr key={doc.id} className="hover:bg-amber-50/20 transition">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          <div className="font-semibold text-slate-900">{doc.title}</div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {doc.currentVersion.originalFilename}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            doc.classification === 'privileged'
                              ? 'bg-rose-100 text-rose-800'
                              : doc.classification === 'confidential'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {isRestricted && <Lock className="w-2.5 h-2.5" />}
                            {doc.classification}
                          </span>
                        </td>
                        <td className="py-3 px-3">
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
                        <td className="py-3 px-3 font-mono font-medium text-slate-700">
                          v{doc.currentVersionNumber}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {formatFileSize(doc.currentVersion.fileSizeBytes)}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {doc.creatorName}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => onSelectDocument(doc)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                              title="Inspect evidence details and versions"
                            >
                              <Eye className="w-3 h-3 text-slate-500" />
                              <span>Inspect</span>
                            </button>

                            {userHasAccess ? (
                              <button
                                onClick={() => onInitiateDownload(doc)}
                                className="px-2.5 py-1 text-[11px] font-medium text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                                title="Download signed evidence"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onRequestAccess(doc)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                                title="Request restricted access"
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
  }

  // ==========================================================
  // RENDER: MATTERS LIST VIEW
  // ==========================================================
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold">
            MATTERS WORKSPACE
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 mt-1">
            Legal Matters & Proceedings
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Active and archived litigation matters with segregated evidence custodianship.
          </p>
        </div>

        {/* Filter Bar & Upload Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition cursor-pointer text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="archived">Archived Only</option>
          </select>

          {/* Risk Filter */}
          <select
            value={riskFilter}
            onChange={(e: any) => setRiskFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition cursor-pointer text-slate-700"
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>

          <button
            onClick={() => onOpenUpload()}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 ml-1"
            title="Upload legal evidence document"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Evidence</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by matter title, reference code, client, or lead attorney..."
          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs transition"
        />
      </div>

      {/* Matters Grid */}
      {filteredMatters.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-slate-500 text-xs">
          <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          No legal matters match your filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMatters.map((matter) => {
            const isArchived = matter.status === 'archived';
            const docsCount = documents.filter((d) => d.matterId === matter.id).length;

            return (
              <div
                key={matter.id}
                onClick={() => setSelectedMatter(matter)}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-amber-400/60 p-5 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      {matter.referenceCode}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isArchived
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {matter.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        matter.riskLevel === 'high'
                          ? 'bg-rose-100 text-rose-800'
                          : matter.riskLevel === 'medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {matter.riskLevel} risk
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-serif font-bold text-slate-900 mt-2">
                    {matter.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {matter.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-slate-500">
                  <div>
                    <span className="text-[10px] uppercase font-mono block text-slate-400">Client</span>
                    <span className="font-medium text-slate-800">{matter.clientName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono block text-slate-400">Lead Attorney</span>
                    <span className="font-medium text-slate-800">{matter.leadAttorneyName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono block text-slate-400">Evidence</span>
                    <span className="font-bold text-amber-800 font-serif">{docsCount} records</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
