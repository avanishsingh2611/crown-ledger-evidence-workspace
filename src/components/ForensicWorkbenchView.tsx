/*
 * Crown & Ledger Evidence Workspace
 * Copyright © 2026 Avanish Singh
 * Author: Avanish Singh
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FlaskConical,
  Scale,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Search,
  Filter,
  Plus,
  Edit3,
  Lock,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  X,
  Loader2,
  Copy,
  Check,
  Bell,
  RefreshCw,
  Hash,
  Binary,
  FileCheck,
  Info,
  Calendar,
} from 'lucide-react';
import {
  CourtCase,
  ForensicReport,
  EvidenceDocument,
  Profile,
  Matter,
} from '../types';
import {
  api,
  ApiError,
  CreateForensicReportInput,
  UpdateForensicReportInput,
} from '../services/api';
import { CustodyTimeline } from './CustodyTimeline';

interface ForensicWorkbenchViewProps {
  currentProfile: Profile;
  availableProfiles?: Profile[];
  matters?: Matter[];
  documents?: EvidenceDocument[];
  onNavigateToNotifications?: () => void;
  unreadNotificationCount?: number;
  onSelectDocument?: (doc: EvidenceDocument) => void;
  initialCaseId?: string | null;
}

const SHA256_REGEX = /^[0-9a-f]{64}$/i;

export const ForensicWorkbenchView: React.FC<ForensicWorkbenchViewProps> = ({
  currentProfile,
  availableProfiles = [],
  documents = [],
  onNavigateToNotifications,
  unreadNotificationCount = 0,
  onSelectDocument,
  initialCaseId = null,
}) => {
  // Cases state
  const [cases, setCases] = useState<CourtCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [caseError, setCaseError] = useState<string | null>(null);

  // Selected case state
  const [selectedCase, setSelectedCase] = useState<CourtCase | null>(null);
  const [activeTab, setActiveTab] = useState<'evidence' | 'reports' | 'custody' | 'integrity'>('evidence');

  // Reports state for selected case
  const [reports, setReports] = useState<ForensicReport[]>([]);
  const [allReportsCache, setAllReportsCache] = useState<Record<string, ForensicReport[]>>({});
  const [loadingReports, setLoadingReports] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocumentForCustody, setSelectedDocumentForCustody] = useState<EvidenceDocument | null>(null);

  // Report Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFinalizeConfirmOpen, setIsFinalizeConfirmOpen] = useState(false);
  const [selectedReportDetail, setSelectedReportDetail] = useState<ForensicReport | null>(null);
  const [reportToEdit, setReportToEdit] = useState<ForensicReport | null>(null);
  const [reportToFinalize, setReportToFinalize] = useState<ForensicReport | null>(null);

  // Form states for Create/Edit report
  const [formDocumentId, setFormDocumentId] = useState<string>('');
  const [formLabName, setFormLabName] = useState('Central Forensic Science Laboratory (CFSL) · CBI New Delhi');
  const [formDeviceType, setFormDeviceType] = useState('Mobile Device / Smartphone');
  const [formDeviceMakeModel, setFormDeviceMakeModel] = useState('');
  const [formDeviceSerialNumber, setFormDeviceSerialNumber] = useState('');
  const [formExtractionTool, setFormExtractionTool] = useState('Cellebrite UFED Physical Analyzer');
  const [formExtractionToolVersion, setFormExtractionToolVersion] = useState('7.64.0.12');
  const [formAcquisitionSha256, setFormAcquisitionSha256] = useState('');
  const [formVerificationSha256, setFormVerificationSha256] = useState('');
  const [formIntakeCondition, setFormIntakeCondition] = useState('Tamper-evident anti-static evidence bag intact with tamper tape intact. No physical casing degradation.');
  const [formFindingsSummary, setFormFindingsSummary] = useState('');
  const [formSection65bCertified, setFormSection65bCertified] = useState(false);

  // Feedback states
  const [submittingReport, setSubmittingReport] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Real-time Hash Comparison derived calculation
  const hashComparison = useMemo(() => {
    const acq = formAcquisitionSha256.trim().toLowerCase();
    const ver = formVerificationSha256.trim().toLowerCase();

    const isAcqValid = SHA256_REGEX.test(acq);
    const isVerValid = SHA256_REGEX.test(ver);

    if (!acq && !ver) {
      return { status: 'idle', message: 'Enter 64-hex SHA-256 digests to compare.', matches: false };
    }
    if (!isAcqValid || !isVerValid) {
      return {
        status: 'invalid',
        message: 'Both digests must be exactly 64 hexadecimal characters [0-9a-f].',
        matches: false,
      };
    }
    if (acq === ver) {
      return {
        status: 'match',
        message: 'INTEGRITY VERIFIED: Bit-stream acquisition hash exactly matches secondary verification hash.',
        matches: true,
      };
    }
    return {
      status: 'mismatch',
      message: 'INTEGRITY MISMATCH: Acquisition hash differs from verification hash! Possible evidence tampering or write-blocker failure.',
      matches: false,
    };
  }, [formAcquisitionSha256, formVerificationSha256]);

  // Load cases authorized for forensic team
  const loadCases = useCallback(async () => {
    try {
      setLoadingCases(true);
      setCaseError(null);
      const data = await api.getCases();
      setCases(data);

      // Pre-fetch reports for summary counts
      const reportsMap: Record<string, ForensicReport[]> = {};
      await Promise.all(
        data.map(async (c) => {
          try {
            const caseReports = await api.getForensicReports(c.id);
            reportsMap[c.id] = caseReports;
          } catch {
            reportsMap[c.id] = [];
          }
        })
      );
      setAllReportsCache(reportsMap);

      if (initialCaseId) {
        const target = data.find((c) => c.id === initialCaseId);
        if (target) {
          setSelectedCase(target);
        }
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        setCaseError('Forensic laboratory access denied or session expired. Please verify clearance.');
      } else {
        setCaseError('Unable to load assigned cases from court server.');
      }
    } finally {
      setLoadingCases(false);
    }
  }, [initialCaseId]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // Load reports for the currently selected case
  const loadSelectedCaseReports = useCallback(async (caseId: string) => {
    try {
      setLoadingReports(true);
      const data = await api.getForensicReports(caseId);
      setReports(data);
      setAllReportsCache((prev) => ({ ...prev, [caseId]: data }));
    } catch (err) {
      console.debug('Failed to load forensic reports:', err);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCase) {
      loadSelectedCaseReports(selectedCase.id);
    }
  }, [selectedCase, loadSelectedCaseReports]);

  // Summary Metrics derived purely from live fetched backend cases & reports
  const summaryMetrics = useMemo(() => {
    const totalCases = cases.length;
    const allReports: ForensicReport[] = (Object.values(allReportsCache) as ForensicReport[][]).flat();
    const draftReports = allReports.filter((r) => !r.isFinalized).length;
    const finalizedReports = allReports.filter((r) => r.isFinalized).length;
    const pendingExaminations = cases.filter((c) => {
      const caseReports = allReportsCache[c.id] || [];
      return caseReports.length === 0 || caseReports.some((r) => !r.isFinalized);
    }).length;

    return {
      totalCases,
      pendingExaminations,
      draftReports,
      finalizedReports,
    };
  }, [cases, allReportsCache]);

  // Linked documents for the selected case's matter
  const linkedDocuments = useMemo(() => {
    if (!selectedCase) return [];
    return documents.filter((d) => d.matterId === selectedCase.matterId);
  }, [selectedCase, documents]);

  // Filtered cases list
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.caseNumber.toLowerCase().includes(q) ||
        c.courtName.toLowerCase().includes(q) ||
        c.caseType.toLowerCase().includes(q) ||
        (c.firNumber && c.firNumber.toLowerCase().includes(q))
    );
  }, [cases, searchQuery]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  const handleOpenCreateModal = (docId?: string) => {
    setModalError(null);
    setFormDocumentId(docId || '');
    setFormLabName('Central Forensic Science Laboratory (CFSL) · CBI New Delhi');
    setFormDeviceType('Mobile Device / Smartphone');
    setFormDeviceMakeModel('');
    setFormDeviceSerialNumber('');
    setFormExtractionTool('Cellebrite UFED Physical Analyzer');
    setFormExtractionToolVersion('7.64.0.12');
    setFormAcquisitionSha256('');
    setFormVerificationSha256('');
    setFormIntakeCondition('Tamper-evident anti-static evidence bag intact with tamper tape intact. No physical casing degradation.');
    setFormFindingsSummary('');
    setFormSection65bCertified(false);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (report: ForensicReport) => {
    if (report.isFinalized) return;
    setModalError(null);
    setReportToEdit(report);
    setFormDocumentId(report.documentId || '');
    setFormLabName(report.labName);
    setFormDeviceType(report.deviceType);
    setFormDeviceMakeModel(report.deviceMakeModel);
    setFormDeviceSerialNumber(report.deviceSerialNumber);
    setFormExtractionTool(report.extractionTool);
    setFormExtractionToolVersion(report.extractionToolVersion);
    setFormAcquisitionSha256(report.acquisitionSha256);
    setFormVerificationSha256(report.verificationSha256);
    setFormIntakeCondition(report.intakeCondition);
    setFormFindingsSummary(report.findingsSummary);
    setFormSection65bCertified(report.section65bCertified);
    setIsEditModalOpen(true);
  };

  const handleCreateReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    if (!SHA256_REGEX.test(formAcquisitionSha256.trim())) {
      setModalError('Acquisition hash must be a valid 64-character hexadecimal SHA-256 string.');
      return;
    }
    if (!SHA256_REGEX.test(formVerificationSha256.trim())) {
      setModalError('Verification hash must be a valid 64-character hexadecimal SHA-256 string.');
      return;
    }

    setSubmittingReport(true);
    setModalError(null);

    try {
      const payload: CreateForensicReportInput = {
        documentId: formDocumentId || null,
        labName: formLabName.trim(),
        deviceType: formDeviceType.trim(),
        deviceMakeModel: formDeviceMakeModel.trim(),
        deviceSerialNumber: formDeviceSerialNumber.trim(),
        extractionTool: formExtractionTool.trim(),
        extractionToolVersion: formExtractionToolVersion.trim(),
        acquisitionSha256: formAcquisitionSha256.trim().toLowerCase(),
        verificationSha256: formVerificationSha256.trim().toLowerCase(),
        hashesMatch: formAcquisitionSha256.trim().toLowerCase() === formVerificationSha256.trim().toLowerCase(),
        intakeCondition: formIntakeCondition.trim(),
        findingsSummary: formFindingsSummary.trim(),
        section65bCertified: formSection65bCertified,
      };

      const created = await api.createForensicReport(selectedCase.id, payload);
      setReports((prev) => [created, ...prev]);
      setAllReportsCache((prev) => ({
        ...prev,
        [selectedCase.id]: [created, ...(prev[selectedCase.id] || [])],
      }));
      setIsCreateModalOpen(false);
      setSuccessNotice(`Draft Forensic Report registered for ${created.deviceMakeModel}.`);
      setTimeout(() => setSuccessNotice(null), 4500);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setModalError(err.message || 'Report creation failed validation.');
      } else {
        setModalError('Failed to create forensic report. Please verify parameters.');
      }
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleEditReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportToEdit || !selectedCase) return;

    if (formAcquisitionSha256 && !SHA256_REGEX.test(formAcquisitionSha256.trim())) {
      setModalError('Acquisition hash must be a valid 64-character hexadecimal SHA-256 string.');
      return;
    }
    if (formVerificationSha256 && !SHA256_REGEX.test(formVerificationSha256.trim())) {
      setModalError('Verification hash must be a valid 64-character hexadecimal SHA-256 string.');
      return;
    }

    setSubmittingReport(true);
    setModalError(null);

    try {
      const payload: UpdateForensicReportInput = {
        labName: formLabName.trim(),
        deviceType: formDeviceType.trim(),
        deviceMakeModel: formDeviceMakeModel.trim(),
        deviceSerialNumber: formDeviceSerialNumber.trim(),
        extractionTool: formExtractionTool.trim(),
        extractionToolVersion: formExtractionToolVersion.trim(),
        acquisitionSha256: formAcquisitionSha256.trim().toLowerCase(),
        verificationSha256: formVerificationSha256.trim().toLowerCase(),
        hashesMatch: formAcquisitionSha256.trim().toLowerCase() === formVerificationSha256.trim().toLowerCase(),
        intakeCondition: formIntakeCondition.trim(),
        findingsSummary: formFindingsSummary.trim(),
        section65bCertified: formSection65bCertified,
      };

      const updated = await api.updateForensicReport(reportToEdit.id, payload);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (selectedReportDetail?.id === updated.id) {
        setSelectedReportDetail(updated);
      }
      setIsEditModalOpen(false);
      setSuccessNotice(`Draft Forensic Report for ${updated.deviceMakeModel} saved.`);
      setTimeout(() => setSuccessNotice(null), 4500);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setModalError(err.message || 'Report update failed.');
      } else {
        setModalError('Failed to update forensic report.');
      }
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleFinalizeReport = async () => {
    if (!reportToFinalize) return;

    setSubmittingReport(true);
    setModalError(null);

    try {
      const finalized = await api.finalizeForensicReport(reportToFinalize.id);
      setReports((prev) => prev.map((r) => (r.id === finalized.id ? finalized : r)));
      if (selectedReportDetail?.id === finalized.id) {
        setSelectedReportDetail(finalized);
      }
      setIsFinalizeConfirmOpen(false);
      setReportToFinalize(null);
      setSuccessNotice(`Report ${finalized.id.slice(0, 8)}... permanently finalized under Section 65B certification.`);
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setModalError(err.message || 'Report finalization rejected by backend authorization.');
      } else {
        setModalError('Finalization error: Unable to freeze report record.');
      }
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* 1. FORENSIC WORKBENCH HEADER */}
      <div className="bg-[#0A1128] text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 -bottom-16 w-48 h-48 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-400/30">
              <FlaskConical className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-teal-400 font-bold">
              DIGITAL FORENSIC LABORATORY WORKBENCH
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
            Digital Forensic Workbench · {currentProfile.fullName}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium text-teal-300">
              <Shield className="w-3.5 h-3.5" />
              <span>Central Forensic Science Laboratory (CFSL) · Digital Investigation Division</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-slate-400">{currentProfile.email}</span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Section 65B ISO/IEC 27037 Certified Laboratory Environment</span>
            </span>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-3 z-10 flex-shrink-0">
          {onNavigateToNotifications && (
            <button
              onClick={onNavigateToNotifications}
              className="relative px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-teal-400/50 transition cursor-pointer text-xs font-semibold flex items-center gap-2 shadow-xs"
              title="Forensic notifications stream"
            >
              <Bell className="w-4 h-4 text-teal-400" />
              <span>Alerts</span>
              {unreadNotificationCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-teal-500 text-slate-950 font-bold font-mono text-[10px] animate-pulse">
                  {unreadNotificationCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={loadCases}
            disabled={loadingCases}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Refresh Forensic Workbench"
          >
            <RefreshCw className={`w-4 h-4 ${loadingCases ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* SUCCESS BANNER */}
      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="p-1 hover:bg-emerald-100 rounded text-emerald-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ERROR BANNER */}
      {caseError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{caseError}</span>
          </div>
          <button
            onClick={loadCases}
            className="px-3 py-1 bg-white hover:bg-rose-100 rounded-lg font-semibold text-rose-700 border border-rose-300 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Assigned Cases */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Assigned Cases
            </span>
            <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-700">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-serif text-slate-900">
              {loadingCases ? '—' : summaryMetrics.totalCases}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Active dockets with forensic jurisdiction
            </div>
          </div>
        </div>

        {/* Card 2: Pending Examinations */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Pending Examinations
            </span>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-900">
              {loadingCases ? '—' : summaryMetrics.pendingExaminations}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Exhibits awaiting lab extraction or report
            </div>
          </div>
        </div>

        {/* Card 3: Draft Reports */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Draft Reports
            </span>
            <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-800">
              <Edit3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-serif text-purple-950">
              {loadingCases ? '—' : summaryMetrics.draftReports}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              In progress; editable prior to Section 65B freeze
            </div>
          </div>
        </div>

        {/* Card 4: Finalized Reports */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Finalized Reports
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-serif text-emerald-950">
              {loadingCases ? '—' : summaryMetrics.finalizedReports}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Immutable Section 65B certified lab reports
            </div>
          </div>
        </div>
      </div>

      {/* 3. CASE SELECTION / ACTIVE CASE WORKSPACE */}
      {!selectedCase ? (
        /* CASE SELECTION CATALOG */
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-teal-700" />
                <h2 className="text-base font-serif font-bold text-slate-900">
                  Assigned Forensic Case Dockets ({filteredCases.length})
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Select a court proceeding to review evidence exhibits, record custody transfers, and author forensic examination reports.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search case, FIR, court..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 bg-stone-50/50 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {loadingCases ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600 mx-auto" />
              <span className="text-xs text-slate-500">Loading authorized forensic cases...</span>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Scale className="w-8 h-8 text-stone-300 mx-auto" />
              <h3 className="text-xs font-bold text-slate-700">No Authorized Cases Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No court cases matching your search criteria are currently assigned to your forensic laboratory roster.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50/80 border-b border-stone-200 text-[10px] font-mono uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Case Number & FIR</th>
                    <th className="px-4 py-3 font-semibold">Jurisdiction & Court</th>
                    <th className="px-4 py-3 font-semibold">Stage</th>
                    <th className="px-4 py-3 font-semibold">Next Scheduled Hearing</th>
                    <th className="px-4 py-3 font-semibold">Forensic Reports</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredCases.map((c) => {
                    const caseReports = allReportsCache[c.id] || [];
                    const finalizedCount = caseReports.filter((r) => r.isFinalized).length;

                    return (
                      <tr key={c.id} className="hover:bg-stone-50/80 transition">
                        <td className="px-6 py-4">
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            {c.caseNumber}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {c.firNumber ? `FIR: ${c.firNumber}` : c.caseType}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-800">{c.courtName}</div>
                          <div className="text-[11px] text-slate-500">{c.jurisdiction}</div>
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-teal-50 text-teal-900 border-teal-200">
                            {c.stage}
                          </span>
                        </td>

                        <td className="px-4 py-4 font-mono text-slate-700">
                          {c.nextHearingDate ? (
                            <span className="font-semibold text-amber-950">
                              {new Date(c.nextHearingDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Pending notice</span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <span className="font-bold text-slate-900">{caseReports.length}</span>
                            <span className="text-slate-400 text-[10px]">
                              ({finalizedCount} certified)
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedCase(c);
                              setActiveTab('evidence');
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-300 font-semibold text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                            <span>Open Workbench</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* CASE FORENSIC WORKSPACE */
        <div className="space-y-6">
          {/* Case Navigation & Meta Header */}
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-stone-100">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedCase(null)}
                  className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-slate-700 transition cursor-pointer"
                  title="Return to case docket list"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-teal-300">
                      {selectedCase.caseNumber}
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                      {selectedCase.stage}
                    </span>
                  </div>
                  <h2 className="text-xl font-serif font-bold text-slate-900 mt-1">
                    {selectedCase.courtName} · Forensic Lab Examination
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenCreateModal()}
                  className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-semibold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Forensic Report</span>
                </button>
              </div>
            </div>

            {/* Quick Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">Case Classification</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{selectedCase.caseType}</span>
                <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">FIR: {selectedCase.firNumber || 'N/A'}</span>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">Presiding Bench</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{selectedCase.presidingJudgeName || 'Hon. Judicial Bench'}</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">IO: {selectedCase.investigationOfficerName || 'Assigned Officer'}</span>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
                <span className="text-[10px] font-mono uppercase text-amber-800 font-semibold block">Next Court Hearing</span>
                <span className="font-bold text-amber-950 mt-0.5 block">
                  {selectedCase.nextHearingDate ? new Date(selectedCase.nextHearingDate).toLocaleDateString() : 'Unscheduled'}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Section 65B filing due prior to trial</span>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
                <span className="text-[10px] font-mono uppercase text-teal-800 font-semibold block">Examination Reports</span>
                <span className="font-bold text-teal-950 mt-0.5 block font-mono text-sm">{reports.length} Registered</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">{reports.filter((r) => r.isFinalized).length} Section 65B Certified</span>
              </div>
            </div>
          </div>

          {/* 4 WORKSPACE TABS */}
          <div className="flex border-b border-stone-200 space-x-6 text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setActiveTab('evidence')}
              className={`pb-3 border-b-2 transition cursor-pointer flex items-center gap-2 flex-shrink-0 ${
                activeTab === 'evidence'
                  ? 'border-teal-600 text-teal-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>1. Evidence Exhibits ({linkedDocuments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`pb-3 border-b-2 transition cursor-pointer flex items-center gap-2 flex-shrink-0 ${
                activeTab === 'reports'
                  ? 'border-teal-600 text-teal-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              <span>2. Forensic Reports ({reports.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('custody')}
              className={`pb-3 border-b-2 transition cursor-pointer flex items-center gap-2 flex-shrink-0 ${
                activeTab === 'custody'
                  ? 'border-teal-600 text-teal-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>3. Chain of Custody</span>
            </button>

            <button
              onClick={() => setActiveTab('integrity')}
              className={`pb-3 border-b-2 transition cursor-pointer flex items-center gap-2 flex-shrink-0 ${
                activeTab === 'integrity'
                  ? 'border-teal-600 text-teal-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Binary className="w-4 h-4" />
              <span>4. Integrity Verification & Section 65B</span>
            </button>
          </div>

          {/* TAB 1: EVIDENCE EXHIBITS */}
          {activeTab === 'evidence' && (
            <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-100">
                <div>
                  <h3 className="text-sm font-serif font-bold text-slate-900">
                    Matter Evidence Exhibits for Laboratory Examination ({linkedDocuments.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cryptographically indexed digital exhibits subject to forensic acquisition and hash verification.
                  </p>
                </div>
              </div>

              {linkedDocuments.length === 0 ? (
                <div className="p-8 border border-dashed border-stone-300 rounded-xl bg-stone-50 text-center space-y-2">
                  <FileText className="w-8 h-8 text-stone-400 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-800">No Evidence Documents Registered</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    No files have been registered to Matter {selectedCase.matterId} yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                  {linkedDocuments.map((doc) => {
                    const sha = doc.currentVersion?.sha256Checksum || '';

                    return (
                      <div key={doc.id} className="p-4 hover:bg-stone-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{doc.title}</span>
                            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                              v{doc.currentVersionNumber}
                            </span>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200">
                              {doc.classification}
                            </span>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {doc.reviewStatus}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-mono">
                            <span className="flex items-center gap-1">
                              <span>SHA-256:</span>
                              <span className="text-slate-800 font-semibold">{sha.slice(0, 16)}...{sha.slice(-8)}</span>
                              <button
                                onClick={() => handleCopy(sha)}
                                className="p-0.5 hover:text-slate-900 cursor-pointer"
                                title="Copy full cryptographic checksum"
                              >
                                {copiedHash === sha ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </span>
                            <span>·</span>
                            <span>Uploaded: {new Date(doc.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              setSelectedDocumentForCustody(doc);
                              setActiveTab('custody');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-slate-700 font-medium text-xs transition cursor-pointer flex items-center gap-1"
                          >
                            <Shield className="w-3.5 h-3.5 text-teal-700" />
                            <span>Custody History</span>
                          </button>

                          <button
                            onClick={() => handleOpenCreateModal(doc.id)}
                            className="px-3 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-700 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                            <span>Examine Exhibit</span>
                          </button>

                          {onSelectDocument && (
                            <button
                              onClick={() => onSelectDocument(doc)}
                              className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-slate-600 transition cursor-pointer"
                              title="Inspect full file"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FORENSIC REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Reports List */}
              <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                  <div>
                    <h3 className="text-sm font-serif font-bold text-slate-900">
                      Digital Forensic Reports ({reports.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Bit-stream acquisition records, device extractions, and Section 65B certified lab determinations.
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenCreateModal()}
                    className="px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-semibold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Report</span>
                  </button>
                </div>

                {loadingReports ? (
                  <div className="py-12 text-center space-y-2 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-600 mx-auto" />
                    <span className="text-xs">Loading forensic reports...</span>
                  </div>
                ) : reports.length === 0 ? (
                  <div className="p-8 border border-dashed border-stone-300 rounded-xl bg-stone-50 text-center space-y-2">
                    <FlaskConical className="w-8 h-8 text-stone-400 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-800">No Forensic Reports Recorded</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      No forensic laboratory reports have been created for this court case yet.
                    </p>
                    <button
                      onClick={() => handleOpenCreateModal()}
                      className="px-4 py-2 mt-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-semibold text-xs transition cursor-pointer"
                    >
                      Start New Forensic Report
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                    {reports.map((report) => (
                      <div key={report.id} className="p-4 hover:bg-stone-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900 text-xs">
                              {report.deviceMakeModel}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              SN: {report.deviceSerialNumber}
                            </span>
                            {report.isFinalized ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                <span>FINALIZED 65B</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono font-bold">
                                DRAFT
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                report.hashesMatch
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {report.hashesMatch ? 'HASHES MATCH' : 'HASH MISMATCH'}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 font-mono flex flex-wrap items-center gap-x-3">
                            <span>Lab: {report.labName}</span>
                            <span>·</span>
                            <span>Examiner: {report.examinerName || 'Dr. Amitav Sen'}</span>
                            <span>·</span>
                            <span>Tool: {report.extractionTool} v{report.extractionToolVersion}</span>
                          </div>

                          <div className="text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-x-3">
                            <span>Acq Hash: {report.acquisitionSha256?.slice(0, 16)}...</span>
                            <span>·</span>
                            <span>Ver Hash: {report.verificationSha256?.slice(0, 16)}...</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setSelectedReportDetail(report)}
                            className="px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-slate-700 font-semibold text-xs transition cursor-pointer"
                          >
                            Inspect Detail
                          </button>

                          {!report.isFinalized ? (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(report)}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-teal-300 font-semibold text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit Draft</span>
                              </button>

                              <button
                                onClick={() => {
                                  setModalError(null);
                                  setReportToFinalize(report);
                                  setIsFinalizeConfirmOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>Finalize 65B</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                              Immutable Record
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* REPORT DETAIL INSPECTOR MODAL/VIEW */}
              {selectedReportDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
                  <div
                    className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 sticky top-0 z-10">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-400/30">
                          <FlaskConical className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-serif font-bold text-white">
                            Forensic Examination Report Detail
                          </h3>
                          <p className="text-[11px] text-slate-400 font-mono">
                            ID: {selectedReportDetail.id}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedReportDetail(null)}
                        className="text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-6 space-y-6 text-xs text-slate-700">
                      {/* Status Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-stone-50 rounded-xl border border-stone-200">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Report Status</span>
                          <div className="flex items-center gap-2 mt-1">
                            {selectedReportDetail.isFinalized ? (
                              <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 font-mono font-bold text-xs flex items-center gap-1.5 border border-emerald-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>PERMANENTLY FINALIZED (SECTION 65B CERTIFIED)</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 font-mono font-bold text-xs border border-amber-300">
                                DRAFT EXAMINATION REPORT
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right font-mono text-[11px] text-slate-500">
                          <div>Created: {new Date(selectedReportDetail.createdAt).toLocaleString()}</div>
                          {selectedReportDetail.finalizedAt && (
                            <div className="text-emerald-800 font-semibold">
                              Finalized: {new Date(selectedReportDetail.finalizedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Device & Extraction Specs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                          <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Binary className="w-4 h-4 text-teal-700" />
                            <span>Device Specifications</span>
                          </h4>
                          <div className="space-y-1 text-[11px]">
                            <div><strong className="text-slate-700">Make & Model:</strong> {selectedReportDetail.deviceMakeModel}</div>
                            <div><strong className="text-slate-700">Device Type:</strong> {selectedReportDetail.deviceType}</div>
                            <div><strong className="text-slate-700">Serial Number:</strong> <span className="font-mono">{selectedReportDetail.deviceSerialNumber}</span></div>
                            <div><strong className="text-slate-700">Intake Condition:</strong> {selectedReportDetail.intakeCondition}</div>
                          </div>
                        </div>

                        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                          <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                            <FlaskConical className="w-4 h-4 text-teal-700" />
                            <span>Laboratory & Extraction Tool</span>
                          </h4>
                          <div className="space-y-1 text-[11px]">
                            <div><strong className="text-slate-700">Laboratory:</strong> {selectedReportDetail.labName}</div>
                            <div><strong className="text-slate-700">Examiner:</strong> {selectedReportDetail.examinerName || 'Dr. Amitav Sen'}</div>
                            <div><strong className="text-slate-700">Tool:</strong> {selectedReportDetail.extractionTool}</div>
                            <div><strong className="text-slate-700">Tool Version:</strong> <span className="font-mono">{selectedReportDetail.extractionToolVersion}</span></div>
                          </div>
                        </div>
                      </div>

                      {/* Cryptographic SHA-256 Hash Verification */}
                      <div className="p-4 bg-slate-950 text-slate-200 rounded-xl border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-bold text-white flex items-center gap-1.5 font-mono text-xs">
                            <Hash className="w-4 h-4 text-teal-400" />
                            <span>Cryptographic SHA-256 Verification</span>
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              selectedReportDetail.hashesMatch
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                                : 'bg-rose-950 text-rose-400 border border-rose-700'
                            }`}
                          >
                            {selectedReportDetail.hashesMatch ? 'INTEGRITY VERIFIED (MATCH)' : 'INTEGRITY MISMATCH'}
                          </span>
                        </div>

                        <div className="space-y-2 font-mono text-[11px]">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase">Acquisition Bit-Stream Hash:</span>
                            <div className="p-2 rounded bg-slate-900 border border-slate-800 text-teal-300 break-all select-all flex items-center justify-between gap-2">
                              <span>{selectedReportDetail.acquisitionSha256}</span>
                              <button onClick={() => handleCopy(selectedReportDetail.acquisitionSha256)} className="p-1 hover:text-white">
                                {copiedHash === selectedReportDetail.acquisitionSha256 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase">Verification Secondary Hash:</span>
                            <div className="p-2 rounded bg-slate-900 border border-slate-800 text-teal-300 break-all select-all flex items-center justify-between gap-2">
                              <span>{selectedReportDetail.verificationSha256}</span>
                              <button onClick={() => handleCopy(selectedReportDetail.verificationSha256)} className="p-1 hover:text-white">
                                {copiedHash === selectedReportDetail.verificationSha256 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Findings Summary */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-slate-900 font-serif">Findings & Examination Narrative</span>
                        <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-slate-700 leading-relaxed text-xs">
                          {selectedReportDetail.findingsSummary}
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between sticky bottom-0">
                      <button
                        onClick={() => setSelectedReportDetail(null)}
                        className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-slate-700 font-semibold text-xs hover:bg-stone-100 transition cursor-pointer"
                      >
                        Close Viewer
                      </button>

                      {!selectedReportDetail.isFinalized && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const r = selectedReportDetail;
                              setSelectedReportDetail(null);
                              handleOpenEditModal(r);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-300 font-semibold text-xs transition cursor-pointer"
                          >
                            Edit Draft
                          </button>
                          <button
                            onClick={() => {
                              const r = selectedReportDetail;
                              setSelectedReportDetail(null);
                              setReportToFinalize(r);
                              setIsFinalizeConfirmOpen(true);
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Finalize Report</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CHAIN OF CUSTODY */}
          {activeTab === 'custody' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                  <div>
                    <h3 className="text-sm font-serif font-bold text-slate-900">
                      Evidence Chain of Custody Ledger
                    </h3>
                    <p className="text-xs text-slate-500">
                      Statutory append-only custody trail. Forensic examiners can log intake, laboratory analysis, and court submission transfers.
                    </p>
                  </div>

                  {linkedDocuments.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Select Exhibit:</span>
                      <select
                        value={selectedDocumentForCustody?.id || (linkedDocuments[0]?.id ?? '')}
                        onChange={(e) => {
                          const doc = linkedDocuments.find((d) => d.id === e.target.value) || null;
                          setSelectedDocumentForCustody(doc);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-stone-300 bg-stone-50 text-xs text-slate-800 font-medium cursor-pointer"
                      >
                        {linkedDocuments.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.title} (v{doc.currentVersionNumber})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {linkedDocuments.length === 0 ? (
                  <div className="p-8 border border-dashed border-stone-300 rounded-xl bg-stone-50 text-center space-y-2">
                    <Shield className="w-8 h-8 text-stone-400 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-800">No Evidence Linked to Case</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Custody transfers require an evidentiary file registered to Matter {selectedCase.matterId}.
                    </p>
                  </div>
                ) : (
                  <div className="pt-2">
                    {/* Reuse CustodyTimeline with canRecordTransfer=true for forensic team */}
                    <CustodyTimeline
                      documentId={selectedDocumentForCustody?.id || linkedDocuments[0].id}
                      documentTitle={selectedDocumentForCustody?.title || linkedDocuments[0].title}
                      currentProfile={currentProfile}
                      availableProfiles={availableProfiles}
                      canRecordTransfer={true}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: INTEGRITY VERIFICATION & SECTION 65B */}
          {activeTab === 'integrity' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
                  <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-800 border border-teal-300/40">
                    <Binary className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-slate-900">
                      Section 65B Forensic Integrity Verification Matrix
                    </h3>
                    <p className="text-xs text-slate-500">
                      Direct side-by-side bit-stream SHA-256 comparative audit across laboratory exhibits.
                    </p>
                  </div>
                </div>

                {reports.length === 0 ? (
                  <div className="p-8 text-center space-y-2 border border-dashed border-stone-200 rounded-xl bg-stone-50">
                    <Hash className="w-8 h-8 text-stone-300 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-700">No Forensic Hashes Recorded</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Create a forensic report for this case to log acquisition and verification checksums.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reports.map((report) => (
                      <div
                        key={report.id}
                        className={`p-4 rounded-xl border transition ${
                          report.hashesMatch
                            ? 'bg-emerald-50/30 border-emerald-200'
                            : 'bg-rose-50/40 border-rose-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">
                              {report.deviceMakeModel}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              (SN: {report.deviceSerialNumber})
                            </span>
                            {report.isFinalized && (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-bold text-[9px] border border-emerald-300">
                                CERTIFIED 65B
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {report.hashesMatch ? (
                              <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-mono font-bold text-[10px] flex items-center gap-1 shadow-2xs">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>INTEGRITY VERIFIED (0-BIT ALTERATION)</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-mono font-bold text-[10px] flex items-center gap-1 shadow-2xs">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>INTEGRITY MISMATCH</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Side by side hashes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 text-[11px] font-mono">
                          <div className="p-2.5 rounded-lg bg-white border border-stone-200 space-y-1">
                            <span className="text-[10px] uppercase text-slate-400 font-bold block">
                              1. Acquisition Bit-Stream Hash
                            </span>
                            <div className="break-all text-slate-900 font-semibold select-all">
                              {report.acquisitionSha256}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white border border-stone-200 space-y-1">
                            <span className="text-[10px] uppercase text-slate-400 font-bold block">
                              2. Secondary Verification Hash
                            </span>
                            <div className="break-all text-slate-900 font-semibold select-all">
                              {report.verificationSha256}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2 border-t border-black/5">
                          <span>Tool: {report.extractionTool} v{report.extractionToolVersion}</span>
                          <span>Examiner: {report.examinerName || 'Dr. Amitav Sen'} ({report.labName})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT FORENSIC REPORT MODAL */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 sticky top-0 z-10">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-400/30">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-white">
                    {isCreateModalOpen ? 'Create Forensic Examination Report' : 'Edit Draft Forensic Report'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedCase?.caseNumber} · Section 65B Digital Evidence Standard
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={isCreateModalOpen ? handleCreateReportSubmit : handleEditReportSubmit} className="p-6 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Linked Evidence Document */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Linked Matter Evidence Exhibit (Optional)
                </label>
                <select
                  value={formDocumentId}
                  onChange={(e) => setFormDocumentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                >
                  <option value="">No specific exhibit linked (Physical hardware intake)</option>
                  {linkedDocuments.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title} (v{doc.currentVersionNumber}) — {doc.classification}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 1: Lab Name & Device Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Forensic Laboratory Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formLabName}
                    onChange={(e) => setFormLabName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Device Classification <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formDeviceType}
                    onChange={(e) => setFormDeviceType(e.target.value)}
                    placeholder="e.g. Smartphone, NVMe SSD, Server Image"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                  />
                </div>
              </div>

              {/* Row 2: Device Make/Model & Serial Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Device Make & Model <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formDeviceMakeModel}
                    onChange={(e) => setFormDeviceMakeModel(e.target.value)}
                    placeholder="e.g. Apple iPhone 14 Pro 256GB"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Device Serial Number / IMEI <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formDeviceSerialNumber}
                    onChange={(e) => setFormDeviceSerialNumber(e.target.value)}
                    placeholder="e.g. IMEI-358920194820194"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Row 3: Extraction Tool & Tool Version */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Extraction / Acquisition Tool <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formExtractionTool}
                    onChange={(e) => setFormExtractionTool(e.target.value)}
                    placeholder="e.g. Cellebrite UFED / Magnet AXIOM"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Tool Version <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formExtractionToolVersion}
                    onChange={(e) => setFormExtractionToolVersion(e.target.value)}
                    placeholder="e.g. 7.64.0.12"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Row 4: Intake Condition */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Intake Physical Condition <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formIntakeCondition}
                  onChange={(e) => setFormIntakeCondition(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                />
              </div>

              {/* HASH CAPTURE & COMPARISON SECTION (CRITICAL SECURITY FEATURE) */}
              <div className="p-4 bg-slate-950 text-slate-200 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-white flex items-center gap-1.5 font-mono text-xs">
                    <Binary className="w-4 h-4 text-teal-400" />
                    <span>Cryptographic Bit-Stream Hash Capture (SHA-256)</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    64-Hexadecimal Characters Required
                  </span>
                </div>

                {/* Acquisition Hash */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-teal-300">1. Acquisition SHA-256 Digest:</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {formAcquisitionSha256.trim().length} / 64 chars
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={64}
                    value={formAcquisitionSha256}
                    onChange={(e) => setFormAcquisitionSha256(e.target.value)}
                    placeholder="Enter 64-character SHA-256 computed immediately after extraction"
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-teal-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-mono"
                  />
                </div>

                {/* Verification Hash */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-teal-300">2. Verification Secondary SHA-256 Digest:</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {formVerificationSha256.trim().length} / 64 chars
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={64}
                    value={formVerificationSha256}
                    onChange={(e) => setFormVerificationSha256(e.target.value)}
                    placeholder="Enter 64-character SHA-256 computed on target image prior to analysis"
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-teal-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-mono"
                  />
                </div>

                {/* Visual Real-Time Comparison Indicator */}
                <div
                  className={`p-2.5 rounded-lg border text-xs font-mono flex items-start gap-2 ${
                    hashComparison.status === 'match'
                      ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                      : hashComparison.status === 'mismatch'
                      ? 'bg-rose-950/80 border-rose-600 text-rose-300'
                      : hashComparison.status === 'invalid'
                      ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  {hashComparison.status === 'match' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : hashComparison.status === 'mismatch' ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{hashComparison.message}</span>
                </div>
              </div>

              {/* Findings Summary */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Forensic Findings Summary & Technical Observations <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formFindingsSummary}
                  onChange={(e) => setFormFindingsSummary(e.target.value)}
                  placeholder="Detail write-blocker connection, partition analysis, recovered artifacts, and non-alteration statement..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                />
              </div>

              {/* Section 65B Checkbox */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="section65bCheckbox"
                  checked={formSection65bCertified}
                  onChange={(e) => setFormSection65bCertified(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded border-stone-300 mt-0.5 cursor-pointer"
                />
                <label htmlFor="section65bCheckbox" className="text-xs text-slate-700 cursor-pointer">
                  <strong className="block text-slate-900">Section 65B Compliance Attestation</strong>
                  <span>I attest that extraction was performed using calibrated write-blocker hardware under strict ISO/IEC 27037 standards with continuous evidence integrity preservation.</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  disabled={submittingReport}
                  className="px-3.5 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-slate-700 font-medium transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="px-4 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-700 text-white font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {submittingReport && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isCreateModalOpen ? 'Register Draft Report' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FINALIZATION CONFIRMATION MODAL (PERMANENT IMMUTABILITY) */}
      {isFinalizeConfirmOpen && reportToFinalize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-serif font-bold text-white">Finalize & Sign Forensic Report</h3>
              </div>
              <button
                onClick={() => {
                  setIsFinalizeConfirmOpen(false);
                  setReportToFinalize(null);
                }}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span>Statutory Immutability Warning</span>
                </div>
                <p className="leading-relaxed">
                  Once finalized, this forensic report becomes <strong>permanently immutable</strong> under Section 65B compliance.
                  Database triggers will reject any subsequent <code>UPDATE</code> or <code>DELETE</code> operations.
                </p>
              </div>

              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5 font-mono text-[11px]">
                <div><strong>Device:</strong> {reportToFinalize.deviceMakeModel}</div>
                <div><strong>Serial:</strong> {reportToFinalize.deviceSerialNumber}</div>
                <div><strong>Acquisition SHA-256:</strong> {reportToFinalize.acquisitionSha256?.slice(0, 16)}...</div>
                <div><strong>Verification SHA-256:</strong> {reportToFinalize.verificationSha256?.slice(0, 16)}...</div>
                <div>
                  <strong>Hash Comparison: </strong>
                  <span className={reportToFinalize.hashesMatch ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                    {reportToFinalize.hashesMatch ? 'MATCHES (Verified)' : 'MISMATCH (Will Be Rejected)'}
                  </span>
                </div>
              </div>

              <p className="text-slate-600 leading-relaxed">
                Are you certain you wish to finalize and permanently freeze this forensic report for submission to the court docket?
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsFinalizeConfirmOpen(false);
                    setReportToFinalize(null);
                  }}
                  disabled={submittingReport}
                  className="px-3.5 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-slate-700 font-medium transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeReport}
                  disabled={submittingReport}
                  className="px-4 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {submittingReport && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm & Finalize</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
