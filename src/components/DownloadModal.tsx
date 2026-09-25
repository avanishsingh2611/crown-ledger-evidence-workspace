import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { EvidenceDocument, DocumentVersion, Profile } from '../types';

interface DownloadModalProps {
  document: EvidenceDocument | null;
  version: DocumentVersion | null;
  currentProfile: Profile;
  onClose: () => void;
  onConfirmDownload: (
    doc: EvidenceDocument,
    ver: DocumentVersion
  ) => Promise<{ signedUrl: string; expiresAt: string } | void>;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  document,
  version,
  currentProfile,
  onClose,
  onConfirmDownload,
}) => {
  const [copied, setCopied] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(300);
  const [urlGenerated, setUrlGenerated] = useState(false);
  const [realSignedUrl, setRealSignedUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!urlGenerated) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [urlGenerated]);

  if (!document || !version) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await onConfirmDownload(document, version);
      if (res && res.signedUrl) {
        setRealSignedUrl(res.signedUrl);
        setUrlGenerated(true);

        // Auto-trigger browser download of the actual PDF
        const link = document.createElement('a');
        link.href = res.signedUrl;
        link.download = version.originalFilename || `${document.title}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error('No signed URL returned by secure storage service');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Access denied or server error generating signed URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (realSignedUrl) {
      navigator.clipboard.writeText(realSignedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-serif">
                Custodial Download Request
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Storage: evidence-documents (Private Bucket)
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

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <div className="font-semibold text-slate-900">{document.title}</div>
            <div className="text-slate-500 font-mono text-[11px]">
              File: {version.originalFilename} (v{version.versionNumber})
            </div>
            <div className="text-slate-500 font-mono text-[11px]">
              Matter: <span className="text-amber-700 font-bold">{document.matterReference}</span>
            </div>
            <div className="text-slate-500 font-mono text-[11px]">
              Actor: <span className="text-slate-800 font-semibold">{currentProfile.fullName}</span> ({currentProfile.title})
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Chain of Custody Notice:</span> Any download generates an immutable event in <code className="font-mono text-amber-950 font-bold">public.download_security_events</code> and triggers cryptographic watermarking.
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-900 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Access Gated / Security Restriction:</span>
                <p className="mt-0.5 text-rose-800">{errorMsg}</p>
              </div>
            </div>
          )}

          {!urlGenerated ? (
            <div className="pt-2">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Verifying Permissions & Storage Token...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Issue Single-Use Signed URL (300s TTL)</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Signed URL Generated</span>
                </span>
                <span className="font-mono text-xs text-slate-600 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Expires in: {Math.floor(secondsRemaining / 60)}:{(secondsRemaining % 60).toString().padStart(2, '0')}</span>
                </span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={realSignedUrl}
                  className="w-full text-[11px] font-mono p-2.5 pr-20 bg-slate-100 border border-slate-300 rounded-lg text-slate-800 select-all"
                />
                <button
                  onClick={handleCopy}
                  className="absolute right-1.5 top-1.5 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-medium transition cursor-pointer flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <a
                href={realSignedUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                download={version.originalFilename}
                className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Secure File ({version.originalFilename})</span>
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
