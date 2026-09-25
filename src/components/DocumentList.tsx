import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Shield,
  Lock,
  Eye,
  Download,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { EvidenceDocument, DocumentClassification, DocumentReviewStatus } from '../types';

interface DocumentListProps {
  documents: EvidenceDocument[];
  onSelectDocument: (doc: EvidenceDocument) => void;
  onInitiateDownload: (doc: EvidenceDocument) => void;
  onRequestAccess?: (doc: EvidenceDocument) => void;
  error?: string | null;
  onRetry?: () => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onSelectDocument,
  onInitiateDownload,
  onRequestAccess,
  error = null,
  onRetry,
}) => {
  const getFileIcon = (ext: string) => {
    switch (ext.toLowerCase()) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-500" />;
      case 'csv':
      case 'xlsx':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
      case 'doc':
      case 'docx':
        return <FileCode className="w-5 h-5 text-blue-600" />;
      default:
        return <File className="w-5 h-5 text-slate-500" />;
    }
  };

  const getClassificationBadge = (classification: DocumentClassification) => {
    switch (classification) {
      case 'privileged':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
            <Lock className="w-3 h-3 text-indigo-500" />
            <span>Privileged</span>
          </span>
        );
      case 'confidential':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
            <Shield className="w-3 h-3 text-sky-500" />
            <span>Confidential</span>
          </span>
        );
      case 'internal':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <span>Internal</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <span>Public</span>
          </span>
        );
    }
  };

  const getReviewStatusBadge = (status: DocumentReviewStatus) => {
    switch (status) {
      case 'needs_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Needs Review</span>
          </span>
        );
      case 'reviewed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Reviewed</span>
          </span>
        );
      case 'restricted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Restricted</span>
          </span>
        );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1048576) {
      return `${(bytes / 1048576).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  if (error && documents.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-rose-200 p-12 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-rose-500 mb-3 border border-rose-200">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">Unable to load evidence records</h3>
        <p className="text-xs text-rose-600 mt-1 max-w-md mx-auto font-medium">
          {error}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium transition cursor-pointer"
          >
            <span>Retry Connection</span>
          </button>
        )}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">No evidence documents found</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          No records matched your matter or status filters. Try clearing or expanding your search criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
        <div>
          <h2 className="text-sm font-serif font-bold text-slate-900 tracking-tight">
            Canonical Evidence Ledger
          </h2>
          <p className="text-xs text-slate-500 font-sans">
            Showing {documents.length} custodial legal records under protective order governance
          </p>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Strict Immutability Enabled
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Document Title & File</th>
              <th className="py-3 px-3">Matter Ref</th>
              <th className="py-3 px-3">Classification</th>
              <th className="py-3 px-3">Review Status</th>
              <th className="py-3 px-3">Version & Size</th>
              <th className="py-3 px-3">Uploader</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {documents.map((doc) => (
              <tr
                key={doc.id}
                className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                onClick={() => onSelectDocument(doc)}
              >
                {/* Title & icon */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-slate-100 border border-slate-200/70 group-hover:bg-white transition-colors flex-shrink-0">
                      {getFileIcon(doc.currentVersion.fileExtension)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate group-hover:text-amber-700 transition-colors flex items-center gap-1.5">
                        <span>{doc.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-xs">
                        {doc.currentVersion.originalFilename}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Matter Ref */}
                <td className="py-3.5 px-3 whitespace-nowrap">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
                    {doc.matterReference}
                  </span>
                </td>

                {/* Classification */}
                <td className="py-3.5 px-3 whitespace-nowrap">
                  {getClassificationBadge(doc.classification)}
                </td>

                {/* Review Status */}
                <td className="py-3.5 px-3 whitespace-nowrap">
                  {getReviewStatusBadge(doc.reviewStatus)}
                </td>

                {/* Version & Size */}
                <td className="py-3.5 px-3 whitespace-nowrap">
                  <div className="flex items-center space-x-1.5 font-mono text-xs text-slate-700">
                    <span className="font-semibold bg-amber-500/10 text-amber-800 border border-amber-400/30 px-1.5 py-0.5 rounded text-[11px]">
                      v{doc.currentVersionNumber}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span>{formatFileSize(doc.currentVersion.fileSizeBytes)}</span>
                  </div>
                </td>

                {/* Uploader */}
                <td className="py-3.5 px-3 whitespace-nowrap">
                  <div className="text-slate-800 font-medium">{doc.creatorName}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-300" />
                    <span>{new Date(doc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                </td>

                {/* Actions */}
                <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end space-x-1.5">
                    <button
                      onClick={() => onSelectDocument(doc)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer"
                      title="Inspect Document & Version History"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {doc.userHasAccess === false ? (
                      doc.accessRequestStatus === 'pending' ? (
                        <span className="p-1 px-2 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Pending</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => onRequestAccess ? onRequestAccess(doc) : onSelectDocument(doc)}
                          className="p-1.5 text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-md border border-rose-300/80 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                          title="Restricted Evidence: Request clearance from Lead Counsel"
                        >
                          <Lock className="w-3.5 h-3.5 text-rose-600" />
                          <span>Request Access</span>
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => onInitiateDownload(doc)}
                        className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-md border border-amber-200/60 transition cursor-pointer flex items-center gap-1 text-[11px] font-medium"
                        title="Generate Signed URL & Track Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Signed URL</span>
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
