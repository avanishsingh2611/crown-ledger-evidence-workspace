import React, { useState } from 'react';
import {
  ShieldAlert,
  X,
  Lock,
  Send,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Building,
} from 'lucide-react';
import { EvidenceDocument } from '../types';
import { api } from '../services/api';

interface RestrictedAccessModalProps {
  document: EvidenceDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestSubmitted: (docId: string) => void;
}

export const RestrictedAccessModal: React.FC<RestrictedAccessModalProps> = ({
  document,
  isOpen,
  onClose,
  onRequestSubmitted,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !document) return null;

  const isPending = document.accessRequestStatus === 'pending';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError('A substantive legal reason is required (minimum 5 characters).');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await api.requestRestrictedAccess(document.id, reason.trim());
      setSuccess(true);
      onRequestSubmitted(document.id);
      setTimeout(() => {
        setSuccess(false);
        setReason('');
        onClose();
      }, 1600);
    } catch (err: any) {
      setError(err.message || 'Failed to submit clearance request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-serif font-bold text-white">
                Restricted Clearance Request
              </h2>
              <p className="text-xs text-slate-400">
                Ethical Wall & Protective Order Access Protocol
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Document Summary Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs text-amber-800 font-semibold px-2 py-0.5 rounded bg-amber-100 border border-amber-300">
                  {document.matterReference}
                </span>
                <span className="text-xs text-slate-500 truncate max-w-[200px]">
                  {document.matterTitle}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                <Lock className="w-3 h-3" />
                {document.classification}
              </span>
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {document.title}
              </h3>
            </div>
          </div>

          {/* Pending Notice if already submitted */}
          {isPending ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <p className="font-semibold">Clearance Request Pending Review</p>
                <p className="text-amber-800/80">
                  Your request to access this confidential evidence has been logged in the custodial ledger and is awaiting determination by Lead Counsel.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-800">
                  Substantive Legal Reason for Access <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  State your specific litigation role, necessary work product need, or discovery obligation. This justification is permanently recorded in the immutable audit trail.
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Assigned to prepare preliminary cross-examination binder for deposition scheduled on next court docket..."
                  rows={4}
                  className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none"
                  disabled={isSubmitting || success}
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Clearance request submitted. Lead Counsel notified.</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || success || !reason.trim()}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-amber-400" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
