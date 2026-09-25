import React, { useState } from 'react';
import {
  X,
  FileText,
  Lock,
  Shield,
  Clock,
  Download,
  AlertCircle,
  CheckCircle2,
  GitCommit,
  Hash,
  Database,
  ArrowRight,
  UserCheck,
  Upload,
  Copy,
  ShieldAlert,
  Archive,
  Send,
} from 'lucide-react';
import { EvidenceDocument, DocumentVersion, Profile } from '../types';
import { CustodyTimeline } from './CustodyTimeline';

interface DocumentModalProps {
  document: EvidenceDocument | null;
  currentProfile?: Profile | null;
  availableProfiles?: Profile[];
  onClose: () => void;
  onInitiateDownload: (doc: EvidenceDocument, version?: DocumentVersion) => void;
  onRequestReview: (doc: EvidenceDocument) => void;
  onCompleteReview: (doc: EvidenceDocument, status?: 'reviewed' | 'restricted', notes?: string) => void;
  onUploadNewVersion?: (doc: EvidenceDocument) => void;
  onRequestAccess?: (doc: EvidenceDocument) => void;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({
  document,
  currentProfile,
  availableProfiles = [],
  onClose,
  onInitiateDownload,
  onRequestReview,
  onCompleteReview,
  onUploadNewVersion,
  onRequestAccess,
}) => {
  const [modalTab, setModalTab] = useState<'versions' | 'custody'>('versions');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewTargetStatus, setReviewTargetStatus] = useState<'reviewed' | 'restricted'>('reviewed');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);

  if (!document) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1048576) {
      return `${(bytes / 1048576).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  const isRestricted =
    document.classification === 'restricted' ||
    document.classification === 'confidential' ||
    document.classification === 'privileged' ||
    document.reviewStatus === 'restricted';

  const userHasAccess = document.userHasAccess !== false;
  const isPending = document.accessRequestStatus === 'pending';
  const isArchivedMatter = !!document.isArchivedMatter;

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionNotes.trim() || decisionNotes.trim().length < 3) {
      setReviewError('Substantive decision notes are mandatory for custodial legal audit trail.');
      return;
    }
    setReviewError(null);
    onCompleteReview(document, reviewTargetStatus, decisionNotes.trim());
    setShowReviewForm(false);
    setDecisionNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-slate-800 text-amber-400 border border-slate-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs text-amber-400 font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                  {document.matterReference}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {document.matterTitle}
                </span>
              </div>
              <h2 className="text-base font-serif font-bold text-white mt-1">
                {document.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Archival Banner (TASK 9) */}
        {isArchivedMatter && (
          <div className="px-6 py-2.5 bg-amber-500/15 border-b border-amber-500/30 flex items-center gap-2 text-xs text-amber-900 font-medium">
            <Archive className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>
              <strong>Archived Matter Compliance Lock:</strong> This matter is archived. Evidence is permanently retained in read-only mode; uploads, version updates, and review edits are disabled.
            </span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 font-medium uppercase tracking-wider block text-[10px]">
                Classification
              </span>
              <span className="font-semibold text-slate-800 mt-1 capitalize inline-flex items-center gap-1">
                {isRestricted ? (
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                ) : (
                  <Shield className="w-3.5 h-3.5 text-sky-600" />
                )}
                {document.classification}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium uppercase tracking-wider block text-[10px]">
                Review Status
              </span>
              <span className={`font-semibold mt-1 inline-flex items-center gap-1 ${
                document.reviewStatus === 'reviewed'
                  ? 'text-emerald-700'
                  : document.reviewStatus === 'restricted'
                  ? 'text-rose-700'
                  : 'text-amber-700'
              }`}>
                {document.reviewStatus === 'reviewed' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : document.reviewStatus === 'restricted' ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                )}
                {document.reviewStatus.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium uppercase tracking-wider block text-[10px]">
                Active Version
              </span>
              <span className="font-mono font-bold text-slate-800 mt-1 block">
                v{document.currentVersionNumber} ({formatFileSize(document.currentVersion.fileSizeBytes)})
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium uppercase tracking-wider block text-[10px]">
                Lead Custodian
              </span>
              <span className="font-medium text-slate-800 mt-1 block">
                {document.creatorName}
              </span>
            </div>
          </div>

          {/* Workflow & Clearance Actions */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold text-amber-950 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-amber-600" />
                <span>Review & Access Governance</span>
              </h4>
              <p className="text-xs text-amber-900/80 mt-0.5">
                {document.reviewRecord
                  ? `Last determined: ${document.reviewRecord.assignedToName} · Status: ${document.reviewRecord.status}`
                  : 'No determination recorded yet.'}
              </p>
              {document.approvedUntil && (
                <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium ${
                  new Date(document.approvedUntil).getTime() < Date.now()
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-sky-100 text-sky-800 border border-sky-200'
                }`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {new Date(document.approvedUntil).getTime() < Date.now()
                      ? 'Access expired'
                      : `Access expires: ${new Date(document.approvedUntil).toLocaleString()}`}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Review Certification Button (if needs review and not archived) */}
              {!isArchivedMatter && document.reviewStatus === 'needs_review' && (
                <button
                  onClick={() => setShowReviewForm(!showReviewForm)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Certify Review</span>
                </button>
              )}

              {/* Download / Clearance Buttons */}
              {!userHasAccess ? (
                isPending ? (
                  <div className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Clearance Pending</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onRequestAccess && onRequestAccess(document)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Request Access</span>
                  </button>
                )
              ) : (
                <button
                  onClick={() => onInitiateDownload(document)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download v{document.currentVersionNumber}</span>
                </button>
              )}
            </div>
          </div>

          {/* Inline Review Certification Form (TASK 6) */}
          {showReviewForm && !isArchivedMatter && (
            <form onSubmit={handleReviewSubmit} className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/40 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Certify Review Determination</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowReviewForm(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Target Determination Status:
                </label>
                <div className="flex items-center space-x-3 text-xs">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="reviewStatus"
                      value="reviewed"
                      checked={reviewTargetStatus === 'reviewed'}
                      onChange={() => setReviewTargetStatus('reviewed')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-800 font-medium">Reviewed (Cleared for discovery)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="reviewStatus"
                      value="restricted"
                      checked={reviewTargetStatus === 'restricted'}
                      onChange={() => setReviewTargetStatus('restricted')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-slate-800 font-medium">Restricted (Lock under protective order)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Mandatory Legal Decision Notes <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="e.g., Reviewed against protective order schedule; no privilege waiver detected."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              {reviewError && (
                <p className="text-xs text-rose-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{reviewError}</span>
                </p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Determination</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab Navigation: Version History vs Chain of Custody */}
          <div className="flex border-b border-stone-200 space-x-6 text-xs font-semibold">
            <button
              onClick={() => setModalTab('versions')}
              className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                modalTab === 'versions'
                  ? 'border-amber-600 text-amber-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>Version History ({document.allVersions.length})</span>
            </button>

            <button
              onClick={() => setModalTab('custody')}
              className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                modalTab === 'custody'
                  ? 'border-amber-600 text-amber-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Chain of Custody Ledger</span>
            </button>
          </div>

          {/* TAB CONTENT 1: VERSION HISTORY */}
          {modalTab === 'versions' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <GitCommit className="w-4 h-4 text-slate-600" />
                  <span>Immutable Version History ({document.allVersions.length} Snapshots)</span>
                </h3>
                <div className="flex items-center gap-2">
                  {!isArchivedMatter && onUploadNewVersion && userHasAccess && (
                    <button
                      onClick={() => onUploadNewVersion(document)}
                      className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Upload next version of this evidence document"
                    >
                      <Upload className="w-3 h-3 text-amber-600" />
                      <span>Upload v{document.currentVersionNumber + 1}</span>
                    </button>
                  )}
                  <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                    Storage: evidence-documents
                  </span>
                </div>
              </div>

              {!userHasAccess ? (
                <div className="p-8 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-center text-xs text-slate-500 space-y-1">
                  <Lock className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="font-semibold text-slate-700">Restricted File Contents Locked</p>
                  <p>Version snapshots and download binaries require approved clearance from Lead Counsel.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {document.allVersions.map((version) => {
                    const isCurrent = version.versionNumber === document.currentVersionNumber;
                    return (
                      <div
                        key={version.id}
                        className={`p-4 transition ${
                          isCurrent ? 'bg-amber-50/20' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                                isCurrent
                                  ? 'bg-amber-500/20 text-amber-800 border border-amber-400/40'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                v{version.versionNumber} {isCurrent && '· CURRENT'}
                              </span>
                              <span className="text-xs font-semibold text-slate-900">
                                {version.originalFilename}
                              </span>
                              <span className="text-xs text-slate-400">({formatFileSize(version.fileSizeBytes)})</span>
                            </div>
                            <p className="text-xs text-slate-600 italic">
                              "{version.changeSummary || 'Version snapshot recorded.'}"
                            </p>
                          </div>

                          <button
                            onClick={() => onInitiateDownload(document, version)}
                            className="self-start sm:self-auto px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download v{version.versionNumber}</span>
                          </button>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex flex-wrap items-center gap-y-1 gap-x-4 text-[11px] text-slate-500 font-mono">
                          <div
                            className="flex items-center gap-1 cursor-pointer hover:text-amber-700 group transition"
                            onClick={() => {
                              navigator.clipboard.writeText(version.sha256Checksum);
                              alert(`Copied SHA-256 hash to clipboard:\n${version.sha256Checksum}`);
                            }}
                            title={`Click to copy full SHA-256 hash: ${version.sha256Checksum}`}
                          >
                            <Hash className="w-3 h-3 text-slate-400 group-hover:text-amber-600" />
                            <span className="font-bold text-slate-700 group-hover:text-amber-800">
                              SHA-256: {version.sha256Checksum ? `${version.sha256Checksum.slice(0, 16)}...` : 'N/A'}
                            </span>
                            <Copy className="w-2.5 h-2.5 text-slate-400 opacity-60 group-hover:opacity-100" />
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{new Date(version.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="text-slate-600">
                            Uploaded by: <strong>{version.uploaderName}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 2: CHAIN OF CUSTODY */}
          {modalTab === 'custody' && (
            <div className="p-4 bg-stone-50/50 rounded-xl border border-stone-200 animate-in fade-in duration-150">
              <CustodyTimeline
                documentId={document.id}
                documentTitle={document.title}
                currentProfile={currentProfile || null}
                availableProfiles={availableProfiles}
                canRecordTransfer={userHasAccess && !isArchivedMatter}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>RLS Protected: public.has_matter_access(auth.uid())</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
