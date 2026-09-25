import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  Lock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  User,
  FileText,
  Calendar,
  Search,
  Check,
} from 'lucide-react';
import { RestrictedAccessRequest } from '../types';
import { api } from '../services/api';

interface AccessRequestsReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDecided: () => void;
}

export const AccessRequestsReviewModal: React.FC<AccessRequestsReviewModalProps> = ({
  isOpen,
  onClose,
  onDecided,
}) => {
  const [requests, setRequests] = useState<RestrictedAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getRestrictedAccessRequests({
        status: filterStatus,
      });
      setRequests(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load access requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRequests();
    }
  }, [isOpen, filterStatus]);

  if (!isOpen) return null;

  const handleDecision = async (requestId: string, decision: 'approved' | 'denied') => {
    const note = decisionNote[requestId]?.trim();
    if (!note || note.length < 3) {
      alert('A decision note is strictly required for legal compliance before approving or denying.');
      return;
    }

    try {
      setSubmittingId(requestId);
      await api.decideRestrictedAccessRequest(requestId, decision, note);
      // Remove or update locally
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      onDecided();
    } catch (err: any) {
      alert(`Error deciding request: ${err.message}`);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold text-white">
                Restricted Clearance Determinations
              </h2>
              <p className="text-xs text-slate-400">
                Lead Counsel & Managing Partner Clearance Governance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600">Status:</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  filterStatus === 'pending'
                    ? 'bg-amber-100 text-amber-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pending Review
              </button>
              <button
                onClick={() => setFilterStatus('approved')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  filterStatus === 'approved'
                    ? 'bg-emerald-100 text-emerald-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setFilterStatus('denied')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  filterStatus === 'denied'
                    ? 'bg-rose-100 text-rose-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Denied
              </button>
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  filterStatus === 'all'
                    ? 'bg-slate-200 text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {requests.length} {requests.length === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Loading access requests...</span>
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-center text-xs text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 mx-auto mb-1.5" />
              <p>{error}</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-slate-700">No {filterStatus} clearance requests</p>
              <p className="text-slate-400 mt-0.5">All restricted evidence requests have been determined.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {req.matterReference}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {req.matterTitle}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                        <Lock className="w-2.5 h-2.5" />
                        {req.classification}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(req.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <h4 className="text-sm font-semibold text-slate-900">
                        {req.documentTitle}
                      </h4>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-600 pl-6">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Requester: <strong>{req.requesterName}</strong> ({req.requesterEmail})</span>
                    </div>
                  </div>

                  {/* Stated Reason */}
                  <div className="pl-6">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 italic">
                      "{req.reason}"
                    </div>
                  </div>

                  {/* Decision Interface (if pending) */}
                  {req.status === 'pending' ? (
                    <div className="pl-6 pt-2 space-y-2">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Determination Decision Note <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={decisionNote[req.id] || ''}
                          onChange={(e) =>
                            setDecisionNote({ ...decisionNote, [req.id]: e.target.value })
                          }
                          placeholder="e.g., Access granted scoped to deposition preparation; protective order applies."
                          className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                        />
                      </div>

                      <div className="flex items-center justify-end space-x-2 pt-1">
                        <button
                          onClick={() => handleDecision(req.id, 'denied')}
                          disabled={submittingId === req.id || !(decisionNote[req.id] || '').trim()}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Deny Clearance</span>
                        </button>
                        <button
                          onClick={() => handleDecision(req.id, 'approved')}
                          disabled={submittingId === req.id || !(decisionNote[req.id] || '').trim()}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve Clearance</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pl-6 text-xs text-slate-500 border-t border-slate-100 pt-2 flex items-center justify-between">
                      <div>
                        Status: <strong className={req.status === 'approved' ? 'text-emerald-700' : 'text-rose-700'}>{req.status.toUpperCase()}</strong>
                        {req.decisionNote && <span> · Note: "{req.decisionNote}"</span>}
                      </div>
                      {req.reviewerName && <div>Reviewer: {req.reviewerName}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
