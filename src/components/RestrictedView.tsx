import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  AlertTriangle,
  User,
  ExternalLink,
  Calendar,
  FileText,
  Search,
  Filter,
} from 'lucide-react';
import { Profile, EvidenceDocument, DocumentVersion, RestrictedAccessRequest } from '../types';
import { api } from '../services/api';

interface RestrictedViewProps {
  currentProfile: Profile;
  documents: EvidenceDocument[];
  onSelectDocument: (doc: EvidenceDocument) => void;
  onInitiateDownload: (doc: EvidenceDocument, version?: DocumentVersion) => void;
  onRequestAccess: (doc: EvidenceDocument) => void;
  onOpenClearanceReviewModal: () => void;
}

export const RestrictedView: React.FC<RestrictedViewProps> = ({
  currentProfile,
  documents,
  onSelectDocument,
  onInitiateDownload,
  onRequestAccess,
  onOpenClearanceReviewModal,
}) => {
  const [activeTab, setActiveTab] = useState<'evidence' | 'requests'>('evidence');
  const [searchQuery, setSearchQuery] = useState('');
  const [myRequests, setMyRequests] = useState<RestrictedAccessRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const isAdminOrLead = currentProfile.role === 'workspace_admin' || currentProfile.role === 'attorney';

  // Load access requests relevant to user
  useEffect(() => {
    if (activeTab === 'requests') {
      setLoadingRequests(true);
      api.getRestrictedAccessRequests()
        .then((reqs) => {
          // If admin, can see all; else filter to requester
          if (isAdminOrLead) {
            setMyRequests(reqs);
          } else {
            setMyRequests(reqs.filter((r) => r.requesterId === currentProfile.id));
          }
        })
        .catch(console.error)
        .finally(() => setLoadingRequests(false));
    }
  }, [activeTab, isAdminOrLead, currentProfile.id]);

  // Filter restricted/confidential/privileged documents only
  const restrictedDocuments = documents.filter((doc) => {
    const isRestricted =
      doc.classification === 'restricted' ||
      doc.classification === 'confidential' ||
      doc.classification === 'privileged' ||
      doc.reviewStatus === 'restricted';
    if (!isRestricted) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchesTitle = doc.title.toLowerCase().includes(q);
      const matchesRef = doc.matterReference.toLowerCase().includes(q);
      const matchesFile = doc.currentVersion.originalFilename.toLowerCase().includes(q);
      if (!matchesTitle && !matchesRef && !matchesFile) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold">
            RESTRICTED & CONFIDENTIAL WORKSPACE
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 mt-1">
            Ethical-Wall & Clearance Governance
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Strict compartmentalization of privileged legal work-product, confidential discovery, and clearance tickets.
          </p>
        </div>

        {isAdminOrLead && (
          <button
            onClick={onOpenClearanceReviewModal}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Clearance Review Terminal</span>
          </button>
        )}
      </div>

      {/* Ethical Wall Governance Notice */}
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-950">
        <Lock className="w-5 h-5 text-rose-700 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-semibold text-rose-900">
            Strict Ethical-Wall Enforced at Database Layer
          </div>
          <p className="text-rose-800/90 text-[11px]">
            Unapproved personnel cannot view content, download files, or discover restricted metadata through search queries. Clearance requests require substantive justification and approval by Lead Counsel or Managing Partner.
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('evidence')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'evidence'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Restricted Evidence ({restrictedDocuments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {isAdminOrLead ? 'Clearance Requests' : 'My Access Requests'}
            </span>
          </button>
        </div>

        {activeTab === 'evidence' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search restricted materials..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800"
            />
          </div>
        )}
      </div>

      {/* Sub-Tab 1: Restricted Evidence Table */}
      {activeTab === 'evidence' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          {restrictedDocuments.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-500 space-y-1">
              <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="font-medium text-slate-700">No restricted evidence records available</div>
              <p>You have access to all visible materials in your assigned matters, or no restricted items match your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100/80 text-slate-500 font-mono text-[10px] uppercase border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Restricted Record</th>
                    <th className="py-3 px-3 font-semibold">Matter</th>
                    <th className="py-3 px-3 font-semibold">Classification</th>
                    <th className="py-3 px-3 font-semibold">Clearance Status</th>
                    <th className="py-3 px-3 font-semibold">Version</th>
                    <th className="py-3 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {restrictedDocuments.map((doc) => {
                    const userHasAccess = doc.userHasAccess !== false;
                    const isPending = doc.accessRequestStatus === 'pending';
                    const isClearanceExpired = doc.approvedUntil ? new Date(doc.approvedUntil).getTime() < Date.now() : false;

                    return (
                      <tr key={doc.id} className="hover:bg-amber-50/15 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                            <span>{doc.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {doc.currentVersion.originalFilename}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span className="font-mono text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {doc.matterReference}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            doc.classification === 'privileged'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}>
                            <Lock className="w-2.5 h-2.5" />
                            {doc.classification}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          {userHasAccess ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Clearance Active</span>
                              </span>
                              {doc.approvedUntil && (
                                <div className="text-[10px] font-mono text-slate-500 block">
                                  {isClearanceExpired ? (
                                    <span className="text-rose-600 font-semibold">Expired</span>
                                  ) : (
                                    <span>Expires: {new Date(doc.approvedUntil).toLocaleDateString()}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending Review</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <Lock className="w-3 h-3" />
                              <span>Clearance Required</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 font-mono text-slate-700">
                          v{doc.currentVersionNumber}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => onSelectDocument(doc)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                              title="Inspect evidence metadata"
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
                            ) : !isPending && (
                              <button
                                onClick={() => onRequestAccess(doc)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                                title="Request ethical-wall clearance"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Request Clearance</span>
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
      )}

      {/* Sub-Tab 2: Clearance Requests List */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          {loadingRequests ? (
            <div className="p-12 text-center text-xs text-slate-500">
              Loading clearance requests...
            </div>
          ) : myRequests.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-500 space-y-1">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="font-medium text-slate-700">No clearance requests recorded</div>
              <p>When legal team members request access to confidential evidence, the review tickets will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100/80 text-slate-500 font-mono text-[10px] uppercase border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Document Title</th>
                    <th className="py-3 px-3 font-semibold">Matter</th>
                    <th className="py-3 px-3 font-semibold">Requester</th>
                    <th className="py-3 px-3 font-semibold">Reason</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-3 font-semibold">Expiration</th>
                    <th className="py-3 px-4 font-semibold font-mono text-right">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {myRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-amber-50/15 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {req.documentTitle}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-mono text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {req.matterReference}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-slate-800 font-medium">
                        {req.requesterName}
                      </td>

                      <td className="py-3.5 px-3 text-slate-600 max-w-xs truncate" title={req.reason}>
                        "{req.reason}"
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          req.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : req.status === 'denied'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {req.status}
                        </span>
                        {req.decisionNote && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-xs">
                            "{req.decisionNote}"
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600">
                        {req.approvedUntil ? (
                          new Date(req.approvedUntil).getTime() < Date.now() ? (
                            <span className="text-rose-600 font-semibold">Expired</span>
                          ) : (
                            new Date(req.approvedUntil).toLocaleDateString()
                          )
                        ) : (
                          <span className="text-slate-400">Permanent</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
