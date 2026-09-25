import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
  Hash,
  FileCheck2,
  X,
  Loader2,
  Info,
} from 'lucide-react';
import {
  EvidenceCustodyTransfer,
  CustodyTransferType,
  Profile,
} from '../types';
import { api, ApiError, RecordCustodyTransferInput } from '../services/api';

interface CustodyTimelineProps {
  documentId: string;
  documentTitle?: string;
  currentProfile: Profile | null;
  availableProfiles?: Profile[];
  canRecordTransfer?: boolean;
  onTransferRecorded?: (transfer: EvidenceCustodyTransfer) => void;
}

const TRANSFER_TYPE_CONFIG: Record<
  CustodyTransferType,
  { label: string; bg: string; text: string; border: string }
> = {
  INTAKE: {
    label: 'Evidence Intake',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
  },
  LAB_ANALYSIS: {
    label: 'Forensic Lab Analysis',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
  },
  COURT_SUBMISSION: {
    label: 'Court Submission',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  VAULT_STORAGE: {
    label: 'Secure Vault Storage',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
  },
  RELEASE: {
    label: 'Authorized Release',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
  },
};

export const CustodyTimeline: React.FC<CustodyTimelineProps> = ({
  documentId,
  documentTitle,
  currentProfile,
  availableProfiles = [],
  canRecordTransfer = false,
  onTransferRecorded,
}) => {
  const [transfers, setTransfers] = useState<EvidenceCustodyTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transfer recording modal state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form state
  const [receivingPartyId, setReceivingPartyId] = useState('');
  const [transferType, setTransferType] = useState<CustodyTransferType>('VAULT_STORAGE');
  const [purpose, setPurpose] = useState('');
  const [securitySealNumber, setSecuritySealNumber] = useState('');
  const [sealIntact, setSealIntact] = useState(true);
  const [sha256Verified, setSha256Verified] = useState(true);
  const [notes, setNotes] = useState('');

  const loadCustody = useCallback(async () => {
    // VICTIM SAFETY CHECK: Never attempt custody queries for victim users
    if (currentProfile?.role === 'victim') {
      setTransfers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await api.getDocumentCustody(documentId);
      // Sort chronologically ascending
      const sorted = [...data].sort(
        (a, b) =>
          new Date(a.transferTimestamp).getTime() - new Date(b.transferTimestamp).getTime()
      );
      setTransfers(sorted);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.statusCode === 403) {
        setError('Custody ledger access restricted under matter authorization policy.');
      } else {
        setError('Unable to load evidence custody records. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [documentId, currentProfile]);

  useEffect(() => {
    loadCustody();
  }, [loadCustody]);

  // Set default receiving party when availableProfiles updates
  useEffect(() => {
    if (availableProfiles.length > 0 && !receivingPartyId) {
      const candidate = availableProfiles.find((p) => p.id !== currentProfile?.id) || availableProfiles[0];
      if (candidate) {
        setReceivingPartyId(candidate.id);
      }
    }
  }, [availableProfiles, currentProfile, receivingPartyId]);

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPartyId) {
      setSubmitError('Please designate a verified receiving party.');
      return;
    }
    if (!purpose.trim() || purpose.trim().length < 3) {
      setSubmitError('Substantive purpose of transfer is required (min 3 characters).');
      return;
    }
    if (!securitySealNumber.trim()) {
      setSubmitError('Physical tamper-evident security seal number is mandatory.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: RecordCustodyTransferInput = {
        receivingPartyId,
        transferType,
        purpose: purpose.trim(),
        securitySealNumber: securitySealNumber.trim(),
        sealIntact,
        sha256Verified,
        notes: notes.trim() || undefined,
        transferTimestamp: new Date().toISOString(),
      };

      const newTransfer = await api.recordCustodyTransfer(documentId, payload);
      setTransfers((prev) => [...prev, newTransfer]);
      if (onTransferRecorded) {
        onTransferRecorded(newTransfer);
      }
      setIsRecordModalOpen(false);
      // Reset form
      setPurpose('');
      setSecuritySealNumber('');
      setNotes('');
      setSealIntact(true);
      setSha256Verified(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSubmitError(err.message || 'Custody transfer rejected by backend.');
      } else {
        setSubmitError('Failed to record custody transfer. Please check network connection.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Roles that are permitted to record transfers
  const userCanRecord =
    canRecordTransfer &&
    (currentProfile?.role === 'workspace_admin' ||
      currentProfile?.role === 'attorney' ||
      currentProfile?.role === 'forensic_team' ||
      currentProfile?.role === 'investigating_officer');

  return (
    <div className="space-y-4">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-700" />
              <span>Chain of Custody Ledger</span>
            </span>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              Append-Only · Immutable
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Cryptographically sealed custody trail for legal evidence integrity under Section 65B.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCustody}
            disabled={loading}
            className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-slate-600 transition cursor-pointer disabled:opacity-50"
            title="Refresh Custody Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {userCanRecord && (
            <button
              onClick={() => {
                setSubmitError(null);
                setIsRecordModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Custody Transfer</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          <span className="text-xs font-medium">Verifying immutable custody entries...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">{error}</span>
            <button
              onClick={loadCustody}
              className="text-rose-900 underline font-medium hover:text-rose-950 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && transfers.length === 0 && (
        <div className="p-8 border border-dashed border-stone-300 rounded-2xl bg-stone-50/60 text-center space-y-2">
          <FileCheck2 className="w-8 h-8 text-stone-400 mx-auto" />
          <h4 className="text-xs font-bold text-slate-800">No Custody Transfers Logged</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            This evidence document is in initial intake status. Any physical or digital transfer must be logged into this immutable ledger.
          </p>
          {userCanRecord && (
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Initial Custody Transfer</span>
            </button>
          )}
        </div>
      )}

      {/* Timeline entries list */}
      {!loading && !error && transfers.length > 0 && (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-amber-400 before:via-stone-300 before:to-stone-200">
          {transfers.map((item, index) => {
            const typeConf = TRANSFER_TYPE_CONFIG[item.transferType] || {
              label: item.transferType,
              bg: 'bg-slate-100',
              text: 'text-slate-800',
              border: 'border-slate-300',
            };

            const isLatest = index === transfers.length - 1;

            return (
              <div key={item.id} className="relative group">
                {/* Node icon on track */}
                <div
                  className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                    isLatest
                      ? 'bg-amber-500 border-white ring-3 ring-amber-300/40 text-white shadow-xs'
                      : 'bg-white border-stone-400 text-stone-600'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isLatest ? 'bg-white' : 'bg-stone-500'}`} />
                </div>

                {/* Card */}
                <div
                  className={`bg-white rounded-xl border p-4 space-y-3 shadow-2xs transition ${
                    isLatest
                      ? 'border-amber-300/90 ring-1 ring-amber-200/50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {/* Card header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${typeConf.bg} ${typeConf.text} ${typeConf.border}`}
                      >
                        {typeConf.label}
                      </span>
                      {isLatest && (
                        <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Current Holder
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{new Date(item.transferTimestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Transfer Parties Flow */}
                  <div className="flex items-center space-x-2 text-xs">
                    <div className="px-2.5 py-1 rounded bg-stone-100 text-slate-800 font-semibold">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block font-normal">Releasing Party</span>
                      {item.releasingPartyName || 'Authorized Custodian'}
                    </div>

                    <ArrowRight className="w-4 h-4 text-amber-600 flex-shrink-0" />

                    <div className="px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-950 font-semibold">
                      <span className="text-[10px] font-mono uppercase text-amber-700 block font-normal">Receiving Party</span>
                      {item.receivingPartyName || 'Designated Recipient'}
                    </div>
                  </div>

                  {/* Purpose & Notes */}
                  <div className="text-xs space-y-1 bg-stone-50/70 p-2.5 rounded-lg border border-stone-100">
                    <div>
                      <strong className="text-slate-700 font-semibold">Purpose: </strong>
                      <span className="text-slate-600">{item.purpose}</span>
                    </div>
                    {item.notes && (
                      <div className="text-slate-500 italic">
                        <strong>Notes: </strong>
                        <span>{item.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Integrity indicators */}
                  <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-y-1.5 gap-x-4 text-[11px] font-mono">
                    {/* Security Seal */}
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-500">Seal:</span>
                      <span className="font-bold text-slate-800 bg-stone-100 px-1.5 py-0.5 rounded">
                        {item.securitySealNumber}
                      </span>
                      {item.sealIntact ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Intact</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                          <span>Compromised</span>
                        </span>
                      )}
                    </div>

                    {/* SHA-256 Verification */}
                    <div className="flex items-center gap-1 text-slate-600">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>SHA-256:</span>
                      {item.sha256Verified ? (
                        <span className="text-emerald-700 font-bold">VERIFIED</span>
                      ) : (
                        <span className="text-rose-700 font-bold">UNVERIFIED</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Statutory notice at bottom */}
      <div className="p-3 bg-stone-100/80 rounded-xl border border-stone-200/80 text-[11px] text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Statutory Compliance Lock:</strong> Every custody transfer is permanent and signed under judicial oversight. Editing, overwriting, or backdating entries is prevented by database RLS and triggers.
        </span>
      </div>

      {/* RECORD TRANSFER MODAL */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-400/30">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-white">Record Evidence Custody Transfer</h3>
                  <p className="text-[11px] text-slate-400">
                    {documentTitle ? `Document: ${documentTitle}` : 'Append an immutable custody transfer record'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleRecordSubmit} className="p-6 space-y-4 text-xs">
              {submitError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Receiving Party */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Receiving Party <span className="text-rose-500">*</span>
                </label>
                <select
                  value={receivingPartyId}
                  onChange={(e) => setReceivingPartyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                  required
                >
                  <option value="">-- Select Receiving Custodian --</option>
                  {availableProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.role.toUpperCase()} · {p.title})
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer Type */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Transfer Classification <span className="text-rose-500">*</span>
                </label>
                <select
                  value={transferType}
                  onChange={(e) => setTransferType(e.target.value as CustodyTransferType)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                  required
                >
                  <option value="INTAKE">INTAKE — Initial Evidence Receipt</option>
                  <option value="LAB_ANALYSIS">LAB_ANALYSIS — Forensic Laboratory Handover</option>
                  <option value="COURT_SUBMISSION">COURT_SUBMISSION — Presentation to Bench</option>
                  <option value="VAULT_STORAGE">VAULT_STORAGE — Secured Retention</option>
                  <option value="RELEASE">RELEASE — Authorized Disposal/Release</option>
                </select>
              </div>

              {/* Security Seal Number */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Tamper-Evident Security Seal # <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={securitySealNumber}
                  onChange={(e) => setSecuritySealNumber(e.target.value)}
                  placeholder="e.g. SEAL-DEL-2024-99812"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs font-mono"
                  required
                />
              </div>

              {/* Purpose */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Purpose of Transfer <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Handover for forensic bitstream acquisition"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                  required
                />
              </div>

              {/* Checkboxes: Seal Intact & SHA-256 Verified */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sealIntact}
                    onChange={(e) => setSealIntact(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium text-slate-800">Seal Intact & Inspected</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sha256Verified}
                    onChange={(e) => setSha256Verified(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium text-slate-800">SHA-256 Hash Matched</span>
                </label>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Custodial Observations / Notes <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any physical packaging condition, tamper tape status, or witness notes"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  disabled={submitting}
                  className="px-3.5 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-slate-700 font-medium transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Sign & Record Transfer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
