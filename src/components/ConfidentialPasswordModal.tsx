import React, { useState } from 'react';
import {
  X,
  Lock,
  ShieldAlert,
  Loader2,
  KeyRound,
} from 'lucide-react';
import { EvidenceDocument, DocumentVersion, Profile } from '../types';

interface ConfidentialPasswordModalProps {
  document: EvidenceDocument | null;
  version: DocumentVersion | null;
  currentProfile: Profile;
  onClose: () => void;
  onVerifyAndDownload: (
    doc: EvidenceDocument,
    ver: DocumentVersion,
    password: string
  ) => Promise<void>;
}

export const ConfidentialPasswordModal: React.FC<ConfidentialPasswordModalProps> = ({
  document,
  version,
  currentProfile,
  onClose,
  onVerifyAndDownload,
}) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!document || !version) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!password) {
      setErrorMsg('Incorrect confidential file password.');
      return;
    }

    setLoading(true);
    try {
      await onVerifyAndDownload(document, version, password);
    } catch (err: any) {
      // Show exact required security error message without leaking sensitive details
      const msg = err?.message || '';
      if (msg.includes('Incorrect confidential file password') || err?.statusCode === 403) {
        setErrorMsg('Incorrect confidential file password.');
      } else {
        setErrorMsg('Incorrect confidential file password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-serif tracking-wide">
                Confidential File Access
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Security Clearance Required · 300-Second Signed URLs
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Document Context Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <div className="font-semibold text-slate-900">{document.title}</div>
            <div className="text-slate-500 font-mono text-[11px]">
              File: {version.originalFilename} (v{version.versionNumber})
            </div>
            <div className="text-slate-500 font-mono text-[11px]">
              Matter: <span className="text-amber-700 font-bold">{document.matterReference}</span> · Classification: <span className="font-bold text-slate-800 uppercase">{document.classification}</span>
            </div>
            <div className="text-slate-500 font-mono text-[11px]">
              Requesting Actor: <span className="text-slate-800 font-semibold">{currentProfile.fullName}</span> ({currentProfile.title})
            </div>
          </div>

          {/* Security Instruction Message */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
            <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">
              This document requires confidential clearance and a file access password.
            </div>
          </div>

          {/* Error Message Display */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-900 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Password Input Field */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-semibold text-slate-700">
              Enter confidential file password
            </label>
            <div className="relative">
              <input
                type="password"
                autoFocus
                placeholder="Enter confidential file password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                className="w-full text-xs font-mono px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify & Download</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
