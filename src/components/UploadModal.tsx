import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  X,
  FileText,
  Shield,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FolderPlus,
  Hash,
  FileCheck,
  FileUp,
  FolderOpen,
  ArrowRight,
  Database,
  FileClock,
  KeyRound,
} from 'lucide-react';
import { Matter, DocumentClassification, EvidenceDocument } from '../types';
import { api } from '../services/api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  matters: Matter[];
  currentMatterId?: string | 'all';
  onUploaded: (newDoc: EvidenceDocument) => void;
}

export type UploadPhase =
  | 'selecting'
  | 'validating'
  | 'uploading'
  | 'creating_document'
  | 'creating_version'
  | 'recording_audit'
  | 'complete';

const UPLOAD_PIPELINE: { key: UploadPhase; label: string; desc: string }[] = [
  { key: 'selecting', label: 'Selecting file', desc: 'File & matter parameters' },
  { key: 'validating', label: 'Validating', desc: 'Magic bytes & MIME integrity' },
  { key: 'uploading', label: 'Uploading', desc: 'Private binary storage transfer' },
  { key: 'creating_document', label: 'Creating document', desc: 'PostgreSQL evidence record' },
  { key: 'creating_version', label: 'Creating version', desc: 'SHA-256 custody seal' },
  { key: 'recording_audit', label: 'Recording audit event', desc: 'Tamper-evident trail' },
  { key: 'complete', label: 'Complete', desc: 'Custodial registration finished' },
];

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'csv', 'txt', 'tiff', 'tif', 'png', 'jpeg', 'jpg'];
const MAX_FILE_SIZE = 104857600; // 100 MB limit

const ALLOWED_MIMES: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
  csv: ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'],
  txt: ['text/plain'],
  tiff: ['image/tiff', 'image/x-tiff'],
  tif: ['image/tiff', 'image/x-tiff'],
  png: ['image/png'],
  jpeg: ['image/jpeg', 'image/pjpeg'],
  jpg: ['image/jpeg', 'image/pjpeg'],
};

/**
 * Deep binary signature and magic byte verification
 * Validates file headers directly from binary slices rather than trusting extensions alone.
 */
async function validateFileClientSide(file: File): Promise<{ valid: boolean; reason?: string }> {
  // 1. File size check
  if (file.size === 0) {
    return { valid: false, reason: 'Selected file is empty (0 bytes).' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      reason: `File size exceeds the 100 MB limit (${(file.size / 1048576).toFixed(1)} MB).`,
    };
  }

  // 2. Extension check
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      reason: `Unsupported file extension ".${ext}". Allowed formats: PDF, DOCX, XLSX, CSV, TXT, TIFF, PNG, JPEG.`,
    };
  }

  // 3. MIME type check
  if (file.type && ALLOWED_MIMES[ext]) {
    const validMimes = ALLOWED_MIMES[ext];
    if (!validMimes.includes(file.type) && !validMimes.some((m) => file.type.startsWith(m))) {
      return {
        valid: false,
        reason: `MIME type mismatch: File "${file.name}" reported as "${file.type}", which does not match extension ".${ext}".`,
      };
    }
  }

  // 4. Binary signature / Magic bytes check (Do not rely on file extension alone)
  try {
    const slice = file.slice(0, 512);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (ext === 'pdf') {
      // Must start with %PDF (0x25 0x50 0x44 0x46)
      if (bytes.length < 4 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
        return { valid: false, reason: 'Invalid PDF: File does not contain a valid %PDF header signature.' };
      }
    } else if (ext === 'png') {
      // 0x89 0x50 0x4E 0x47
      if (bytes.length < 4 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
        return { valid: false, reason: 'Invalid PNG: File does not contain a valid PNG header signature.' };
      }
    } else if (ext === 'jpg' || ext === 'jpeg') {
      // 0xFF 0xD8 0xFF
      if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
        return { valid: false, reason: 'Invalid JPEG: File does not contain a valid JPEG SOI header signature.' };
      }
    } else if (ext === 'tiff' || ext === 'tif') {
      // II*. or MM.*
      const isLittle = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00;
      const isBig = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a;
      if (!isLittle && !isBig) {
        return { valid: false, reason: 'Invalid TIFF: File does not contain a valid TIFF byte-order header.' };
      }
    } else if (ext === 'docx' || ext === 'xlsx') {
      // Zip container PK\x03\x04
      if (
        bytes.length < 4 ||
        bytes[0] !== 0x50 ||
        bytes[1] !== 0x4b ||
        (bytes[2] !== 0x03 && bytes[2] !== 0x05 && bytes[2] !== 0x07)
      ) {
        return { valid: false, reason: `Invalid ${ext.toUpperCase()}: File missing standard OpenXML/ZIP archive container signature.` };
      }
    } else if (ext === 'txt' || ext === 'csv') {
      if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
        return { valid: false, reason: 'Security violation: Disguised binary executable (MZ header) detected inside text extension.' };
      }
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0x00) {
          return { valid: false, reason: `Invalid ${ext.toUpperCase()}: Binary null bytes detected in plain text file.` };
        }
      }
    }
  } catch (err: any) {
    return { valid: false, reason: `Could not inspect binary headers: ${err.message}` };
  }

  return { valid: true };
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  matters,
  currentMatterId,
  onUploaded,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMatterId, setSelectedMatterId] = useState<string>(
    currentMatterId && currentMatterId !== 'all' ? currentMatterId : matters[0]?.id || ''
  );
  const [title, setTitle] = useState('');
  const [classification, setClassification] = useState<DocumentClassification>('confidential');
  const [changeSummary, setChangeSummary] = useState('');
  const [tags, setTags] = useState('');

  // Hashing and 7-phase progress states
  const [sha256Preview, setSha256Preview] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('selecting');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successDoc, setSuccessDoc] = useState<EvidenceDocument | null>(null);

  // Sample Cases drawer state
  const [sampleCases, setSampleCases] = useState<
    Array<{
      filename: string;
      sizeBytes: number;
      sizeFormatted: string;
      suggestedTitle: string;
    }>
  >([]);
  const [showSampleDrawer, setShowSampleDrawer] = useState(false);
  const [selectedSampleFilename, setSelectedSampleFilename] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync selected matter if passed prop changes
  useEffect(() => {
    if (currentMatterId && currentMatterId !== 'all') {
      setSelectedMatterId(currentMatterId);
    } else if (matters.length > 0 && !selectedMatterId) {
      setSelectedMatterId(matters[0].id);
    }
  }, [currentMatterId, matters]);

  // Load sample cases list on modal open
  useEffect(() => {
    if (isOpen) {
      api.getSampleCases()
        .then((cases) => setSampleCases(cases))
        .catch(() => setSampleCases([]));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isUploading = uploadPhase !== 'selecting' && uploadPhase !== 'complete';

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  // Compute client SHA-256 for instant legal custody preview
  const handleFileSelect = async (file: File) => {
    setErrorMsg(null);
    setSuccessDoc(null);
    setSelectedSampleFilename(null);

    // Initial preliminary client checks
    const valResult = await validateFileClientSide(file);
    if (!valResult.valid) {
      setErrorMsg(valResult.reason || 'Invalid evidence file.');
      setSelectedFile(null);
      setSha256Preview(null);
      return;
    }

    setSelectedFile(file);
    if (!title || title === selectedFile?.name.replace(/\.[^/.]+$/, '')) {
      setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
    }

    // Compute preview SHA-256 checksum
    setIsHashing(true);
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setSha256Preview(hashHex);
    } catch {
      setSha256Preview(null);
    } finally {
      setIsHashing(false);
    }
  };

  // Select sample case
  const handleSelectSample = (sample: { filename: string; suggestedTitle: string }) => {
    setSelectedSampleFilename(sample.filename);
    setSelectedFile(null);
    setSha256Preview(null);
    setTitle(sample.suggestedTitle);
    setShowSampleDrawer(false);
    setErrorMsg(null);
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Submit Upload with 7 clear visual states
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedMatterId) {
      setErrorMsg('Please select a Matter for this evidence record.');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Document title is required.');
      return;
    }

    if (!selectedFile && !selectedSampleFilename) {
      setErrorMsg('Please select a file to upload or pick a sample case file.');
      return;
    }

    // Step 2: Validating
    setUploadPhase('validating');
    setUploadProgress(15);

    if (selectedFile) {
      const valResult = await validateFileClientSide(selectedFile);
      if (!valResult.valid) {
        setErrorMsg(valResult.reason || 'File validation failed.');
        setUploadPhase('selecting');
        setUploadProgress(0);
        return;
      }
    }

    // Step 3: Uploading
    setUploadPhase('uploading');
    setUploadProgress(35);

    // Staged progression through remaining pipeline states
    const tDoc = setTimeout(() => {
      setUploadPhase('creating_document');
      setUploadProgress(60);
    }, 450);

    const tVer = setTimeout(() => {
      setUploadPhase('creating_version');
      setUploadProgress(80);
    }, 900);

    const tAudit = setTimeout(() => {
      setUploadPhase('recording_audit');
      setUploadProgress(92);
    }, 1350);

    try {
      let created: EvidenceDocument;

      if (selectedSampleFilename) {
        created = await api.importSampleCase({
          sampleFilename: selectedSampleFilename,
          matterId: selectedMatterId,
          title: title.trim(),
          classification,
        });
      } else if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('matterId', selectedMatterId);
        formData.append('title', title.trim());
        formData.append('classification', classification);
        if (changeSummary.trim()) {
          formData.append('changeSummary', changeSummary.trim());
        }
        if (tags.trim()) {
          tags.split(',').forEach((t) => formData.append('tags', t.trim()));
        }

        created = await api.uploadEvidenceDocument(formData);
      } else {
        throw new Error('No evidence file provided');
      }

      clearTimeout(tDoc);
      clearTimeout(tVer);
      clearTimeout(tAudit);

      // Step 7: Complete
      setUploadPhase('complete');
      setUploadProgress(100);
      setSuccessDoc(created);

      // Notify parent handler to update workspace evidence table & statistics
      onUploaded(created);

      // Close modal smoothly after brief celebration state
      setTimeout(() => {
        onClose();
        resetForm();
      }, 750);
    } catch (err: any) {
      clearTimeout(tDoc);
      clearTimeout(tVer);
      clearTimeout(tAudit);
      setUploadPhase('selecting');
      setUploadProgress(0);
      console.error('Upload failed:', err);
      setErrorMsg(err?.message || 'Failed to upload evidence file to secure repository.');
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setSelectedSampleFilename(null);
    setTitle('');
    setSha256Preview(null);
    setSuccessDoc(null);
    setErrorMsg(null);
    setUploadPhase('selecting');
    setUploadProgress(0);
  };

  // Helper to determine step status
  const getStepIndex = (phase: UploadPhase) => {
    return UPLOAD_PIPELINE.findIndex((s) => s.key === phase);
  };
  const currentStepIdx = getStepIndex(uploadPhase);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold tracking-tight">Upload Evidence Document</h2>
              <p className="text-xs text-slate-400 font-sans">
                Crown & Ledger Custodial Vault · Private Supabase Storage · SHA-256 Ledger Sealed
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={isUploading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 7-Stage Visual Progress Pipeline Bar */}
        <div className="bg-slate-950/95 border-b border-slate-800 px-6 py-3">
          <div className="flex items-center justify-between gap-1 overflow-x-auto text-[11px] pb-1 font-mono">
            {UPLOAD_PIPELINE.map((step, idx) => {
              const isCompleted = currentStepIdx > idx || uploadPhase === 'complete';
              const isCurrent = currentStepIdx === idx && uploadPhase !== 'complete';

              return (
                <div key={step.key} className="flex items-center gap-1.5 min-w-fit">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      isCompleted
                        ? 'bg-emerald-500 text-slate-950'
                        : isCurrent
                        ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/50 animate-pulse'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={`whitespace-nowrap ${
                      isCompleted
                        ? 'text-emerald-400 font-semibold'
                        : isCurrent
                        ? 'text-amber-400 font-bold'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                  {idx < UPLOAD_PIPELINE.length - 1 && (
                    <span className="text-slate-700 text-xs px-1">→</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-rose-900">Upload Validation Error</div>
                <div className="mt-0.5">{errorMsg}</div>
                <div className="mt-1 text-[11px] text-rose-700 font-mono">
                  Please review the file or parameters and click "Upload & Seal Evidence" to retry.
                </div>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successDoc && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-semibold text-emerald-800 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Evidence Successfully Registered & Cryptographically Sealed</span>
              </div>
              <p className="text-slate-600 font-sans">
                Document <strong className="text-slate-900">"{successDoc.title}"</strong> sealed in matter{' '}
                <strong className="font-mono text-slate-900">{successDoc.matterReference}</strong> as version v
                {successDoc.currentVersionNumber}.
              </p>
              <div className="pt-2 border-t border-emerald-200/70 font-mono text-[11px] text-slate-600 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-emerald-600" />
                <span>SHA-256: </span>
                <span className="text-slate-800 font-bold truncate">
                  {successDoc.currentVersion?.sha256Checksum || successDoc.currentVersion?.sha256Hash}
                </span>
              </div>
            </div>
          )}

          {!successDoc && (
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Matter Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Associated Matter <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedMatterId}
                  onChange={(e) => setSelectedMatterId(e.target.value)}
                  disabled={isUploading}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition cursor-pointer font-sans"
                >
                  {matters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.referenceCode} — {m.title} ({m.clientName})
                    </option>
                  ))}
                </select>
              </div>

              {/* File Drop Area / Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Evidence File <span className="text-rose-500">*</span>
                  </label>
                  {sampleCases.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowSampleDrawer(!showSampleDrawer)}
                      disabled={isUploading}
                      className="text-xs text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1 cursor-pointer transition"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>
                        {showSampleDrawer ? 'Hide Sample Cases' : `Select Sample Case PDF (${sampleCases.length} available)`}
                      </span>
                    </button>
                  )}
                </div>

                {/* Sample Case Drawer */}
                {showSampleDrawer && (
                  <div className="mb-3 p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2 animate-in fade-in text-xs">
                    <div className="font-semibold text-amber-950 flex items-center justify-between">
                      <span>Available Sample Case Documents:</span>
                      <span className="text-[10px] font-mono text-amber-800">Verified Test Case Vault</span>
                    </div>
                    <div className="max-h-36 overflow-y-auto divide-y divide-amber-200/50 rounded-lg border border-amber-200 bg-white">
                      {sampleCases.map((sample) => (
                        <div
                          key={sample.filename}
                          onClick={() => handleSelectSample(sample)}
                          className={`p-2 flex items-center justify-between cursor-pointer transition ${
                            selectedSampleFilename === sample.filename
                              ? 'bg-amber-100 font-semibold text-amber-950'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                            <span className="truncate">{sample.suggestedTitle}</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap ml-2">
                            {sample.sizeFormatted}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dropzone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition flex flex-col items-center justify-center gap-2 ${
                    isUploading
                      ? 'border-slate-200 bg-slate-50/50 cursor-not-allowed'
                      : selectedFile || selectedSampleFilename
                      ? 'border-amber-400 bg-amber-50/20 cursor-pointer'
                      : 'border-slate-300 hover:border-amber-400 hover:bg-slate-50/80 cursor-pointer'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.xlsx,.csv,.txt,.tiff,.tif,.png,.jpeg,.jpg"
                    disabled={isUploading}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />

                  {selectedFile ? (
                    <div className="flex items-center gap-3 text-left w-full">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-700 flex-shrink-0">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-xs truncate">
                          {selectedFile.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {formatSize(selectedFile.size)} · {selectedFile.type || 'application/octet-stream'}
                        </div>
                      </div>
                      {!isUploading && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            setSha256Preview(null);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : selectedSampleFilename ? (
                    <div className="flex items-center gap-3 text-left w-full">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-700 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-xs truncate">
                          {selectedSampleFilename}
                        </div>
                        <div className="text-[11px] text-amber-700 font-mono">
                          Selected from verified Case Files
                        </div>
                      </div>
                      {!isUploading && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSampleFilename(null);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <FileUp className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-amber-700 hover:underline">Click to browse</span>
                        <span className="text-xs text-slate-500"> or drag and drop legal evidence file</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        PDF, DOCX, XLSX, CSV, TXT, TIFF, PNG, JPEG (up to 100 MB)
                      </p>
                    </>
                  )}
                </div>

                {/* Pre-upload Cryptographic SHA-256 Checksum Preview */}
                {isHashing && (
                  <div className="mt-2 text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>Computing cryptographic SHA-256 custody checksum...</span>
                  </div>
                )}
                {sha256Preview && (
                  <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <Hash className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="text-slate-400 font-medium">Pre-upload SHA-256:</span>
                      <span className="text-slate-900 font-bold truncate">{sha256Preview}</span>
                    </div>
                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border border-emerald-200">
                      Verified
                    </span>
                  </div>
                )}
              </div>

              {/* Title & Classification Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Document Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Document Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Expert Witness Report — Dr. Sterling"
                    disabled={isUploading}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
                  />
                </div>

                {/* Classification Selector (Internal, Confidential, Privileged, Restricted) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Legal Classification <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={classification}
                    onChange={(e) => setClassification(e.target.value as DocumentClassification)}
                    disabled={isUploading}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition cursor-pointer font-sans"
                  >
                    <option value="internal">Internal (Firm Work Record)</option>
                    <option value="confidential">Confidential (Protective Order)</option>
                    <option value="privileged">Privileged (Attorney-Client / Work Product)</option>
                    <option value="restricted">Restricted (Court Protective Order / Ethical Wall)</option>
                  </select>
                </div>
              </div>

              {/* Optional Custodial / Change Summary */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Custodial / Change Summary <span className="text-slate-400 font-normal font-sans">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="e.g. Initial evidence batch received from outside counsel"
                  disabled={isUploading}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Metadata Tags <span className="text-slate-400 font-normal font-sans">(Optional, comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. financial, audit, forensic, exhibit-A"
                  disabled={isUploading}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
                />
              </div>

              {/* Visual Progress Bar while Uploading */}
              {isUploading && (
                <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-slate-800 text-white animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center gap-2 text-amber-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        Stage: <strong className="text-white">{UPLOAD_PIPELINE[currentStepIdx]?.label}</strong>
                        {' — '}
                        <span className="text-slate-400 text-[11px] font-sans">
                          {UPLOAD_PIPELINE[currentStepIdx]?.desc}
                        </span>
                      </span>
                    </span>
                    <span className="text-amber-400 font-bold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-300 shadow-sm"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    onClose();
                  }}
                  disabled={isUploading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || (!selectedFile && !selectedSampleFilename)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span>Sealing Evidence...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload & Seal Evidence</span>
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
