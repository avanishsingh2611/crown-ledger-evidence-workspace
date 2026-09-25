/*
 * Crown & Ledger Evidence Workspace
 * Copyright © 2026 Avanish Singh
 * Author: Avanish Singh
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  Scale,
  FileText,
  FlaskConical,
  Lock,
  Clock,
  Search,
  Filter,
  Plus,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Send,
  Eye,
  RefreshCw,
  Users,
  Bell,
  Calendar,
  MapPin,
  Building2,
  FileCode,
  Upload,
  X,
  FileSearch,
  Package,
  Edit3,
} from 'lucide-react';
import {
  Profile,
  Matter,
  EvidenceDocument,
  CourtCase,
  CaseStage,
  ForensicReport,
  CustodyTransferType,
  AppNotification,
} from '../types';
import { api, ApiError } from '../services/api';
import { CustodyTimeline } from './CustodyTimeline';
import { ParticipantsPanel } from './ParticipantsPanel';

interface InvestigatingOfficerViewProps {
  currentProfile: Profile;
  availableProfiles?: Profile[];
  matters: Matter[];
  documents: EvidenceDocument[];
  onNavigateToNotifications?: () => void;
  unreadNotificationCount?: number;
  onSelectDocument?: (doc: EvidenceDocument) => void;
}

const CASE_STAGES: CaseStage[] = [
  'Filing',
  'Investigation',
  'Pre-Trial',
  'Trial',
  'Evidence Hearing',
  'Judgement',
  'Appeal',
  'Closed',
];

export const InvestigatingOfficerView: React.FC<InvestigatingOfficerViewProps> = ({
  currentProfile,
  availableProfiles = [],
  matters,
  documents: initialDocuments,
  onNavigateToNotifications,
  unreadNotificationCount = 0,
  onSelectDocument,
}) => {
  // Core state
  const [cases, setCases] = useState<CourtCase[]>([]);
  const [documents, setDocuments] = useState<EvidenceDocument[]>(initialDocuments);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Selected case workspace
  const [selectedCase, setSelectedCase] = useState<CourtCase | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'fir' | 'evidence' | 'forensics' | 'custody' | 'participants' | 'notices'
  >('overview');

  // Forensic reports for selected case
  const [caseReports, setCaseReports] = useState<ForensicReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReportDetail, setSelectedReportDetail] = useState<ForensicReport | null>(null);

  // All reports cache for dashboard metrics
  const [allReportsCache, setAllReportsCache] = useState<Record<string, ForensicReport[]>>({});

  // Search & Filters for Case List
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [forensicFilter, setForensicFilter] = useState<'all' | 'has_reports' | 'pending'>('all');

  // Selected document for Custody Timeline modal
  const [selectedDocForCustody, setSelectedDocForCustody] = useState<EvidenceDocument | null>(null);

  // Modals
  const [isRegisterEvidenceOpen, setIsRegisterEvidenceOpen] = useState(false);
  const [isSubmitForensicOpen, setIsSubmitForensicOpen] = useState(false);
  const [submitDocTarget, setSubmitDocTarget] = useState<EvidenceDocument | null>(null);

  // Evidence Registration form state
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceClassification, setEvidenceClassification] = useState<string>('confidential');
  const [evidenceTags, setEvidenceTags] = useState('digital-seizure, evidence');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);

  // Forensic Lab Handoff form state
  const [receivingExaminerId, setReceivingExaminerId] = useState<string>('');
  const [securitySealNumber, setSecuritySealNumber] = useState('');
  const [handoffPurpose, setHandoffPurpose] = useState('Forensic bit-stream acquisition & hash verification');
  const [sealIntact, setSealIntact] = useState(true);
  const [shaVerified, setShaVerified] = useState(true);
  const [handoffNotes, setHandoffNotes] = useState('');
  const [isSubmittingHandoff, setIsSubmittingHandoff] = useState(false);

  // FIR Intake edit form state
  const [isEditingFir, setIsEditingFir] = useState(false);
  const [editFirNumber, setEditFirNumber] = useState('');
  const [editPoliceStation, setEditPoliceStation] = useState('');
  const [savingFir, setSavingFir] = useState(false);

  // Forensic handoff current custody state
  const [loadingCustodyInfo, setLoadingCustodyInfo] = useState(false);
  const [evidenceCustodySummary, setEvidenceCustodySummary] = useState<{
    lastCustodian: string;
    lastSeal: string;
    lastType: string;
    transferCount: number;
  } | null>(null);

  // Notifications state
  const [caseNotifications, setCaseNotifications] = useState<AppNotification[]>([]);

  // Hash copy helper
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  /**
   * Load authorized cases and documents for this investigating officer
   */
  const loadCasesAndData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [fetchedCases, fetchedDocs] = await Promise.all([
        api.getCases(),
        api.getDocuments().catch(() => initialDocuments),
      ]);

      setCases(fetchedCases);
      setDocuments(fetchedDocs);

      // Preload forensic reports for each case to compute metrics
      const reportsMap: Record<string, ForensicReport[]> = {};
      await Promise.all(
        fetchedCases.map(async (c) => {
          try {
            const reports = await api.getForensicReports(c.id);
            reportsMap[c.id] = reports;
          } catch {
            reportsMap[c.id] = [];
          }
        })
      );
      setAllReportsCache(reportsMap);
    } catch (err: any) {
      console.error('Failed to load investigation cases:', err);
      setError(err?.message || 'Failed to load authorized court cases from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [initialDocuments]);

  useEffect(() => {
    loadCasesAndData();
  }, [loadCasesAndData]);

  /**
   * When a case is selected, load its forensic reports and notifications
   */
  const loadCaseDetails = useCallback(async (courtCase: CourtCase) => {
    setLoadingReports(true);
    try {
      const [reports, notifsRes] = await Promise.all([
        api.getForensicReports(courtCase.id).catch(() => []),
        api.getNotifications().catch(() => ({ notifications: [], total: 0, unreadCount: 0 })),
      ]);
      const notifs = notifsRes.notifications || [];
      setCaseReports(reports);
      setCaseNotifications(notifs.filter((n) => n.courtCaseId === courtCase.id || !n.courtCaseId));
    } catch (err: any) {
      console.error('Failed to load case reports:', err);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  const handleSelectCase = (courtCase: CourtCase) => {
    setSelectedCase(courtCase);
    setActiveTab('overview');
    loadCaseDetails(courtCase);
  };

  // Case documents
  const caseDocuments = useMemo(() => {
    if (!selectedCase) return [];
    return documents.filter((d) => d.matterId === selectedCase.matterId);
  }, [selectedCase, documents]);

  // Derived Dashboard Metrics
  const metrics = useMemo(() => {
    const totalAssigned = cases.length;
    const activeInvestigations = cases.filter((c) => c.stage !== 'Closed').length;

    // Total evidence across all authorized assigned cases
    const assignedMatterIds = new Set(cases.map((c) => c.matterId));
    const totalEvidence = documents.filter((d) => assignedMatterIds.has(d.matterId)).length;

    // Pending forensic examinations: exhibits without finalized forensic report
    const allReports = (Object.values(allReportsCache) as ForensicReport[][]).flat();
    const finalizedDocIds = new Set(
      allReports.filter((r) => r.isFinalized && r.documentId).map((r) => r.documentId as string)
    );
    const pendingExaminations = documents.filter(
      (d) => assignedMatterIds.has(d.matterId) && !finalizedDocIds.has(d.id)
    ).length;

    return {
      totalAssigned,
      activeInvestigations,
      totalEvidence,
      pendingExaminations,
    };
  }, [cases, documents, allReportsCache]);

  const matterMap = useMemo(() => new Map(matters.map((m) => [m.id, m])), [matters]);

  // Filtered Cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matter = matterMap.get(c.matterId);
      const caseTitle = matter?.title || c.caseType;
      const matchesSearch =
        !q ||
        c.caseNumber.toLowerCase().includes(q) ||
        (c.firNumber && c.firNumber.toLowerCase().includes(q)) ||
        caseTitle.toLowerCase().includes(q) ||
        (matter?.referenceCode && matter.referenceCode.toLowerCase().includes(q)) ||
        (c.policeStation && c.policeStation.toLowerCase().includes(q)) ||
        c.courtName.toLowerCase().includes(q) ||
        c.caseType.toLowerCase().includes(q);

      const matchesStage = stageFilter === 'all' || c.stage === stageFilter;

      const caseRepCount = allReportsCache[c.id]?.length || 0;
      let matchesForensic = true;
      if (forensicFilter === 'has_reports') matchesForensic = caseRepCount > 0;
      if (forensicFilter === 'pending') matchesForensic = caseRepCount === 0;

      return matchesSearch && matchesStage && matchesForensic;
    });
  }, [cases, searchQuery, stageFilter, forensicFilter, allReportsCache, matterMap]);

  /**
   * Evidence Registration Handler
   */
  const handleRegisterEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    if (!evidenceTitle.trim()) {
      setError('Please provide a title for the evidence exhibit.');
      return;
    }
    if (!selectedFile) {
      setError('Please select a verified evidence file to register.');
      return;
    }

    setIsSubmittingEvidence(true);
    setError(null);

    try {
      const parsedTags = evidenceTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('matterId', selectedCase.matterId);
      formData.append('title', evidenceTitle.trim());
      formData.append('classification', evidenceClassification);
      if (evidenceDescription.trim()) {
        formData.append('changeSummary', evidenceDescription.trim());
      }
      parsedTags.forEach((t) => formData.append('tags', t));

      const created = await api.uploadEvidenceDocument(formData);

      // Refresh documents
      const refreshedDocs = await api.getDocuments();
      setDocuments(refreshedDocs);

      setIsRegisterEvidenceOpen(false);
      setEvidenceTitle('');
      setSelectedFile(null);
      setEvidenceDescription('');
      setSuccessBanner(
        `Evidence Exhibit "${created.title}" successfully registered under FIR ${selectedCase.firNumber || selectedCase.caseNumber} with SHA-256 seal.`
      );
      setTimeout(() => setSuccessBanner(null), 6000);
    } catch (err: any) {
      console.error('Evidence registration error:', err);
      setError(err?.message || 'Failed to register evidence exhibit. Please verify permissions.');
    } finally {
      setIsSubmittingEvidence(false);
    }
  };

  /**
   * Forensic Lab Handoff Submission Handler
   */
  const handleOpenForensicSubmission = async (doc: EvidenceDocument) => {
    setSubmitDocTarget(doc);
    // Find forensic examiner profile if available
    const forensicExaminer = availableProfiles.find(
      (p) => p.role === 'forensic_team' || p.role === 'FORENSIC_TEAM'
    );
    if (forensicExaminer) {
      setReceivingExaminerId(forensicExaminer.id);
    } else {
      // Default to known CFSL examiner Dr. Amitav Sen
      setReceivingExaminerId('88888888-8888-4888-a888-888888888888');
    }
    setSecuritySealNumber(`SEAL-CFSL-${Math.floor(1000 + Math.random() * 9000)}`);
    setIsSubmitForensicOpen(true);

    // Fetch current custody state
    setLoadingCustodyInfo(true);
    try {
      const history = await api.getDocumentCustody(doc.id);
      if (history && history.length > 0) {
        const last = history[history.length - 1];
        setEvidenceCustodySummary({
          lastCustodian: last.receivingPartyName,
          lastSeal: last.securitySealNumber,
          lastType: last.transferType,
          transferCount: history.length,
        });
      } else {
        setEvidenceCustodySummary({
          lastCustodian: `${currentProfile.fullName} (Station Evidence Locker)`,
          lastSeal: 'INITIAL-SEIZURE',
          lastType: 'INTAKE',
          transferCount: 0,
        });
      }
    } catch {
      setEvidenceCustodySummary(null);
    } finally {
      setLoadingCustodyInfo(false);
    }
  };

  const handleStartEditFir = () => {
    if (!selectedCase) return;
    setEditFirNumber(selectedCase.firNumber || '');
    setEditPoliceStation(selectedCase.policeStation || '');
    setIsEditingFir(true);
  };

  const handleCancelEditFir = () => {
    setIsEditingFir(false);
    setEditFirNumber('');
    setEditPoliceStation('');
  };

  const handleSaveFir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setSavingFir(true);
    setError(null);

    try {
      const updated = await api.updateCase(selectedCase.id, {
        firNumber: editFirNumber.trim() || null,
        policeStation: editPoliceStation.trim() || null,
      });

      setSelectedCase(updated);
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setIsEditingFir(false);
      setSuccessBanner(
        `FIR registration (${updated.firNumber || 'N/A'}) and Police Station details updated and persisted.`
      );
      setTimeout(() => setSuccessBanner(null), 6000);
    } catch (err: any) {
      console.error('FIR update error:', err);
      setError(err?.message || 'Failed to update FIR registration details via backend.');
    } finally {
      setSavingFir(false);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.markNotificationAsRead(id);
      setCaseNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleSubmitForensicHandoff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !submitDocTarget) return;
    if (!receivingExaminerId.trim()) {
      setError('Please select a receiving Forensic Laboratory Examiner.');
      return;
    }
    if (!securitySealNumber.trim()) {
      setError('A verified security seal number is required for forensic evidence handoff.');
      return;
    }

    setIsSubmittingHandoff(true);
    setError(null);

    try {
      await api.recordCustodyTransfer(submitDocTarget.id, {
        receivingPartyId: receivingExaminerId,
        transferType: 'LAB_ANALYSIS',
        purpose: handoffPurpose.trim() || 'Forensic bit-stream acquisition & hash verification',
        securitySealNumber: securitySealNumber.trim(),
        sealIntact,
        sha256Verified: shaVerified,
        notes: handoffNotes.trim() || `Dispatched from ${selectedCase.policeStation || 'Police Station'} to CFSL Laboratory.`,
      });

      setIsSubmitForensicOpen(false);
      setSuccessBanner(
        `Evidence "${submitDocTarget.title}" successfully transferred to Forensic Laboratory (Seal: ${securitySealNumber.trim()}). Chain of custody ledger updated.`
      );
      setTimeout(() => setSuccessBanner(null), 6000);

      // Refresh case details
      loadCaseDetails(selectedCase);
    } catch (err: any) {
      console.error('Forensic handoff error:', err);
      setError(err?.message || 'Failed to submit evidence for forensic examination. Custody append failed.');
    } finally {
      setIsSubmittingHandoff(false);
    }
  };

  const getStageColor = (stage: CaseStage) => {
    switch (stage) {
      case 'Investigation':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Filing':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Pre-Trial':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Evidence Hearing':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Trial':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'Judgement':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'Appeal':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'Closed':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* ========================================================================= */}
      {/* 1. INVESTIGATION COMMAND HEADER                                           */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-blue-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                LAW ENFORCEMENT & INVESTIGATION COMMAND
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-600" />
                SECURE INVESTIGATION NODE
              </span>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 tracking-tight">
                Investigation Command
              </h1>
              {refreshing && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
            </div>

            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Investigating Officer:{' '}
              <strong className="text-slate-900 font-semibold">{currentProfile.fullName}</strong> ·{' '}
              <span className="font-mono text-slate-700">
                {selectedCase?.policeStation || 'Cyber Crime Police Station, Central District'}
              </span>
              . Manage FIR dossiers, register seized digital exhibits, execute forensic lab transfers, and monitor evidentiary chain of custody.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => loadCasesAndData(true)}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-slate-800 border border-stone-200/80 transition flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Records</span>
            </button>

            {onNavigateToNotifications && (
              <button
                onClick={onNavigateToNotifications}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-slate-800 border border-stone-200/80 transition flex items-center gap-2 cursor-pointer shadow-2xs relative"
              >
                <Bell className="w-3.5 h-3.5 text-slate-600" />
                <span>Alerts</span>
                {unreadNotificationCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold font-mono text-[9px] rounded-full">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications / Alerts Banners */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3 text-xs animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-bold">Investigation Notice: </strong>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-bold">Success: </strong>
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUMMARY METRIC CARDS (REAL API DATA)                                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              ASSIGNED CASES
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
              <FolderOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-serif font-bold text-slate-900 mt-2">
            {metrics.totalAssigned}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Authorized police investigations</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              ACTIVE PROCEEDINGS
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-serif font-bold text-slate-900 mt-2">
            {metrics.activeInvestigations}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Pending trial or evidence hearing</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              SEIZED EXHIBITS
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-serif font-bold text-slate-900 mt-2">
            {metrics.totalEvidence}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Registered case evidence files</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              PENDING LAB EXAMS
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <FlaskConical className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-serif font-bold text-slate-900 mt-2">
            {metrics.pendingExaminations}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting Section 65B forensic report</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CASE SELECTION CATALOG OR CASE WORKSPACE                               */}
      {/* ========================================================================= */}
      {!selectedCase ? (
        /* CASE SELECTION CATALOG */
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-serif font-bold text-slate-900">
                Assigned Investigation Dossiers
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select an active court case to inspect FIR records, register exhibits, or transfer evidence to CFSL.
              </p>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search FIR, case #, station..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:border-blue-500 w-52 sm:w-60 bg-stone-50/50"
                />
              </div>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-xl border border-stone-200 bg-stone-50/50 text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Stages</option>
                {CASE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={forensicFilter}
                onChange={(e) => setForensicFilter(e.target.value as any)}
                className="py-1.5 px-2.5 text-xs rounded-xl border border-stone-200 bg-stone-50/50 text-slate-700 focus:outline-hidden"
              >
                <option value="all">All Forensic States</option>
                <option value="has_reports">Has Forensic Reports</option>
                <option value="pending">Pending Examination</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Loading authorized investigations...</span>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <FolderOpen className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Investigations Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No court cases matching your search criteria were found in your authorized jurisdiction.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50/75 border-b border-stone-200/80 text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Case Number & Title</th>
                    <th className="py-3 px-4 font-semibold">FIR / Reference</th>
                    <th className="py-3 px-4 font-semibold">Police Station</th>
                    <th className="py-3 px-4 font-semibold">Court & Jurisdiction</th>
                    <th className="py-3 px-4 font-semibold">Investigation Stage</th>
                    <th className="py-3 px-4 font-semibold">Next Hearing</th>
                    <th className="py-3 px-4 font-semibold">Evidence & Forensics</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredCases.map((c) => {
                    const reportCount = allReportsCache[c.id]?.length || 0;
                    const docCount = documents.filter((d) => d.matterId === c.matterId).length;
                    const matter = matterMap.get(c.matterId);
                    const caseTitle = matter?.title || c.caseType;

                    return (
                      <tr key={c.id} className="hover:bg-blue-50/20 transition">
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          <div className="font-bold text-slate-900 font-mono text-xs">{c.caseNumber}</div>
                          <div className="text-xs text-slate-800 font-serif font-semibold mt-0.5 max-w-xs truncate" title={caseTitle}>
                            {caseTitle}
                          </div>
                          <div className="text-[11px] text-slate-400">{c.caseType}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                          {c.firNumber ? (
                            <div className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 w-fit text-[11px]">
                              {c.firNumber}
                            </div>
                          ) : matter?.referenceCode ? (
                            <div className="text-slate-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200 w-fit text-[11px]">
                              Ref: {matter.referenceCode}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Pending Filing</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{c.policeStation || 'Central District Station'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <div className="font-medium text-slate-800">{c.courtName}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{c.jurisdiction}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${getStageColor(
                              c.stage
                            )}`}
                          >
                            {c.stage}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                          {c.nextHearingDate ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{new Date(c.nextHearingDate).toLocaleDateString()}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">Not Scheduled</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-stone-100 text-slate-700 font-mono text-[10px] border border-stone-200">
                              {docCount} {docCount === 1 ? 'Exhibit' : 'Exhibits'}
                            </span>
                            {reportCount > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 font-mono text-[10px] border border-cyan-200 font-bold flex items-center gap-1">
                                <FlaskConical className="w-3 h-3" />
                                {reportCount} {reportCount === 1 ? 'Report' : 'Reports'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">Pending Exam</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleSelectCase(c)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
                          >
                            <FileSearch className="w-3.5 h-3.5" />
                            <span>Open Dossier</span>
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
        /* CASE INVESTIGATION WORKSPACE */
        <div className="space-y-6">
          {/* Header of Selected Case Workspace */}
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-100">
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCase(null)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer transition mb-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Investigation Catalog</span>
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xl sm:text-2xl font-serif font-bold text-slate-900">
                    {selectedCase.caseNumber}
                  </span>
                  {selectedCase.firNumber && (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-mono text-xs font-bold">
                      FIR: {selectedCase.firNumber}
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase border ${getStageColor(
                      selectedCase.stage
                    )}`}
                  >
                    {selectedCase.stage}
                  </span>
                </div>

                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <span>
                    <strong className="text-slate-800">Station:</strong>{' '}
                    {selectedCase.policeStation || 'Central District Police Station'}
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="text-slate-800">Court:</strong> {selectedCase.courtName}
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="text-slate-800">Type:</strong> {selectedCase.caseType}
                  </span>
                  {selectedCase.nextHearingDate && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-amber-800 font-medium">
                        <Clock className="w-3 h-3" />
                        Next Hearing: {new Date(selectedCase.nextHearingDate).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                <button
                  onClick={() => setIsRegisterEvidenceOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Evidence</span>
                </button>
              </div>
            </div>

            {/* 8-Stage Progression Indicator (Read-Only) */}
            <div className="pt-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-2 flex items-center justify-between">
                <span>Criminal Case Lifecycle Progression</span>
                <span className="text-slate-500 font-normal">Authoritative Court Records</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {CASE_STAGES.map((stg, idx) => {
                  const isCurrent = selectedCase.stage === stg;
                  const isPassed = CASE_STAGES.indexOf(selectedCase.stage) >= idx;

                  return (
                    <div
                      key={stg}
                      className={`p-2 rounded-xl border text-center transition ${
                        isCurrent
                          ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                          : isPassed
                          ? 'bg-blue-50/70 text-blue-900 border-blue-200'
                          : 'bg-stone-50 text-slate-400 border-stone-200/60'
                      }`}
                    >
                      <div className="text-[9px] font-mono uppercase tracking-wider">
                        Step {idx + 1}
                      </div>
                      <div className="text-xs truncate font-medium mt-0.5">{stg}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Case Navigation Tabs */}
            <div className="flex items-center gap-1 mt-6 border-b border-stone-200 overflow-x-auto pb-0.5">
              {[
                { id: 'overview', label: 'Case Overview', icon: FileText },
                { id: 'fir', label: 'FIR & Station', icon: Building2 },
                {
                  id: 'evidence',
                  label: `Evidence (${caseDocuments.length})`,
                  icon: Package,
                },
                {
                  id: 'forensics',
                  label: `Forensic Reports (${caseReports.length})`,
                  icon: FlaskConical,
                },
                { id: 'custody', label: 'Chain of Custody', icon: ShieldCheck },
                { id: 'participants', label: 'Case Participants', icon: Users },
                {
                  id: 'notices',
                  label: `Activity & Notices (${caseNotifications.length})`,
                  icon: Bell,
                },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`py-2 px-3.5 rounded-t-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap border-b-2 ${
                      isActive
                        ? 'border-blue-600 text-blue-700 bg-blue-50/30'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-stone-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: CASE OVERVIEW                                                      */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-4">
                  <h3 className="text-base font-serif font-bold text-slate-900 border-b border-stone-100 pb-3">
                    Dossier Summary
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block font-mono text-[10px] uppercase">
                        Case Number
                      </span>
                      <strong className="text-slate-900 text-sm font-serif">
                        {selectedCase.caseNumber}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-mono text-[10px] uppercase">
                        FIR Registration
                      </span>
                      <span className="font-mono text-sm text-blue-700 font-bold">
                        {selectedCase.firNumber || 'Pending Filing Registration'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-mono text-[10px] uppercase">
                        Jurisdiction / Police Station
                      </span>
                      <span className="text-slate-800 font-medium">
                        {selectedCase.policeStation || 'Central District Cyber Crime Cell'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-mono text-[10px] uppercase">
                        Presiding Bench
                      </span>
                      <span className="text-slate-800 font-medium">
                        {selectedCase.presidingJudgeName || 'Sessions & District Judge'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-mono text-[10px] uppercase">
                        Case Classification
                      </span>
                      <span className="text-slate-800 font-medium">{selectedCase.caseType}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-mono text-[10px] uppercase">
                        Filing Date
                      </span>
                      <span className="text-slate-800 font-mono">
                        {selectedCase.filingDate || '2024-03-15'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Evidence Quick Summary */}
                <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <h3 className="text-base font-serif font-bold text-slate-900">
                      Recent Evidence Exhibits ({caseDocuments.length})
                    </h3>
                    <button
                      onClick={() => setActiveTab('evidence')}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>View All</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  {caseDocuments.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No exhibits registered yet. Click &quot;Register Evidence&quot; to intake evidence files.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {caseDocuments.slice(0, 3).map((doc) => (
                        <div
                          key={doc.id}
                          className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between gap-4 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{doc.title}</div>
                            <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>v{doc.currentVersionNumber}</span>
                              <span>·</span>
                              <span className="text-slate-400">
                                SHA-256: {doc.currentVersion.sha256Checksum.slice(0, 16)}...
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenForensicSubmission(doc)}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold border border-blue-200 transition cursor-pointer"
                            >
                              Submit to Lab
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Info Panel */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 space-y-3 text-xs">
                  <h4 className="font-serif font-bold text-slate-900 text-sm border-b border-stone-100 pb-2">
                    Investigating Officer Authority
                  </h4>
                  <p className="text-slate-600 leading-relaxed">
                    Under Indian Evidence Act and criminal procedure rules, Investigating Officers retain custody of seized exhibits and submit them under secure seal to authorized forensic science laboratories.
                  </p>
                  <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-900 text-[11px] space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      Append-Only Custody Ledger
                    </div>
                    <div>
                      Every transfer from police station to CFSL generates an immutable cryptographic ledger entry.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: FIR & INVESTIGATION INTAKE                                         */}
          {/* ========================================================================= */}
          {activeTab === 'fir' && (
            <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-slate-900">
                    First Information Report (FIR) Record
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Official police station registration details and jurisdictional assignment.
                  </p>
                </div>

                {!isEditingFir ? (
                  <button
                    onClick={handleStartEditFir}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-slate-800 border border-stone-200 transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                    <span>Edit FIR & Station Intake</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCancelEditFir}
                    disabled={savingFir}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-stone-100 transition cursor-pointer self-start sm:self-auto"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {isEditingFir ? (
                <form onSubmit={handleSaveFir} className="p-5 rounded-2xl bg-blue-50/40 border border-blue-200 space-y-4 text-xs">
                  <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Update Police Station & FIR Intake Details</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        FIR Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={editFirNumber}
                        onChange={(e) => setEditFirNumber(e.target.value)}
                        placeholder="e.g. FIR-2024-ND-00482"
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-slate-900 font-mono focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Police Station Jurisdiction *
                      </label>
                      <input
                        type="text"
                        required
                        value={editPoliceStation}
                        onChange={(e) => setEditPoliceStation(e.target.value)}
                        placeholder="e.g. Cyber Crime Police Station, Central District"
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Updates persist directly to the court case record under audit trail logging. Judicial dockets and case stages remain read-only for investigating officers.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-200/60">
                    <button
                      type="button"
                      onClick={handleCancelEditFir}
                      disabled={savingFir}
                      className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:bg-stone-100 font-semibold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingFir}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {savingFir && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{savingFir ? 'Persisting Updates...' : 'Save FIR Registration'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
                  <div className="space-y-4">
                    <div>
                      <label className="text-slate-500 font-mono text-[10px] uppercase font-bold block">
                        FIR Number
                      </label>
                      <div className="font-mono text-base font-bold text-blue-800 mt-1">
                        {selectedCase.firNumber || 'Pending Filing Registration'}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-500 font-mono text-[10px] uppercase font-bold block">
                        Police Station
                      </label>
                      <div className="text-slate-900 font-medium mt-1">
                        {selectedCase.policeStation || 'Cyber Crime Police Station, Central District'}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-500 font-mono text-[10px] uppercase font-bold block">
                        Assigned Investigating Officer
                      </label>
                      <div className="text-slate-900 font-medium mt-1">
                        {currentProfile.fullName} (Lead IO)
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-slate-500 font-mono text-[10px] uppercase font-bold block">
                        Court Docket
                      </label>
                      <div className="text-slate-900 font-medium mt-1">{selectedCase.courtName}</div>
                    </div>

                    <div>
                      <label className="text-slate-500 font-mono text-[10px] uppercase font-bold block">
                        Offence Classification
                      </label>
                      <div className="text-slate-900 font-medium mt-1">{selectedCase.caseType}</div>
                    </div>

                    <div>
                      <label className="text-slate-500 font-mono text-[10px] uppercase font-bold block">
                        Investigation Stage
                      </label>
                      <div className="mt-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase border ${getStageColor(
                            selectedCase.stage
                          )}`}
                        >
                          {selectedCase.stage}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: EVIDENCE EXHIBITS MATRIX                                           */}
          {/* ========================================================================= */}
          {activeTab === 'evidence' && (
            <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-serif font-bold text-slate-900">
                    Seized Evidence & Exhibits ({caseDocuments.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Physical and digital evidence seized during investigation. Sealed with SHA-256 cryptographic hashes.
                  </p>
                </div>

                <button
                  onClick={() => setIsRegisterEvidenceOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Evidence Exhibit</span>
                </button>
              </div>

              {caseDocuments.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Package className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">No Evidence Registered</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    No exhibits have been recorded for FIR {selectedCase.firNumber || selectedCase.caseNumber}. Use the button above to upload evidence.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-50/75 border-b border-stone-200/80 text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4 font-semibold">Exhibit Title</th>
                        <th className="py-3 px-4 font-semibold">Classification</th>
                        <th className="py-3 px-4 font-semibold">Version & Format</th>
                        <th className="py-3 px-4 font-semibold">SHA-256 Checksum</th>
                        <th className="py-3 px-4 font-semibold">Forensic Status</th>
                        <th className="py-3 px-4 font-semibold">Date Seized</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {caseDocuments.map((doc) => {
                        const hash = doc.currentVersion.sha256Checksum;
                        const isCopied = copiedHash === hash;
                        const docReport = caseReports.find((r) => r.documentId === doc.id);

                        return (
                          <tr key={doc.id} className="hover:bg-blue-50/20 transition">
                            <td className="py-3.5 px-4 font-medium text-slate-900">
                              <div className="font-semibold text-slate-900">{doc.title}</div>
                              <div className="text-[11px] text-slate-400 font-mono">ID: {doc.id}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                {doc.classification}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600">
                              v{doc.currentVersionNumber} · {doc.currentVersion.fileExtension.toUpperCase()}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px]">{hash.slice(0, 16)}...</span>
                                <button
                                  onClick={() => handleCopyHash(hash)}
                                  className="p-1 rounded hover:bg-stone-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                                  title="Copy SHA-256"
                                >
                                  {isCopied ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              {docReport?.isFinalized ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  SEC 65B CERTIFIED
                                </span>
                              ) : docReport && !docReport.isFinalized ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit">
                                  <FlaskConical className="w-3 h-3 text-amber-600" />
                                  LAB DRAFT
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  PENDING EXAM
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {onSelectDocument && (
                                  <button
                                    onClick={() => onSelectDocument(doc)}
                                    className="px-2 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-slate-700 text-xs font-semibold border border-stone-200 transition cursor-pointer flex items-center gap-1"
                                    title="View Exhibit in Document Modal"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Details</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleOpenForensicSubmission(doc)}
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer shadow-2xs flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Submit to Lab</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedDocForCustody(doc);
                                    setActiveTab('custody');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-slate-700 text-xs font-semibold border border-stone-200 transition cursor-pointer"
                                  title="Inspect Chain of Custody"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
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

          {/* ========================================================================= */}
          {/* TAB 4: FORENSIC SUBMISSIONS & REPORTS                                     */}
          {/* ========================================================================= */}
          {activeTab === 'forensics' && (
            <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-stone-100">
                <h3 className="text-base font-serif font-bold text-slate-900">
                  Forensic Laboratory Reports ({caseReports.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official reports generated by Central Forensic Science Laboratory (CFSL) examiners. Read-only inspection under Section 65B of Indian Evidence Act.
                </p>
              </div>

              {loadingReports ? (
                <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Loading forensic reports...</span>
                </div>
              ) : caseReports.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <FlaskConical className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">No Forensic Reports Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    No forensic reports have been filed for this case. Use the Evidence tab to submit exhibits to the forensic team for extraction and verification.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {caseReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-5 sm:p-6 hover:bg-stone-50/50 transition flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            Report #{report.id.slice(0, 8)}
                          </span>
                          {report.isFinalized ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold">
                              FINALIZED & IMMUTABLE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px] font-bold">
                              LAB DRAFT
                            </span>
                          )}
                          {report.hashesMatch ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold">
                              ✓ HASHES MATCH
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-mono text-[10px] font-bold">
                              ✗ HASH MISMATCH
                            </span>
                          )}
                        </div>

                        <div className="text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>
                            <strong>Examiner:</strong> {report.examinerName || 'Dr. Amitav Sen'}
                          </span>
                          <span>·</span>
                          <span>
                            <strong>Lab:</strong> {report.labName}
                          </span>
                          <span>·</span>
                          <span>
                            <strong>Device:</strong> {report.deviceMakeModel} ({report.deviceType})
                          </span>
                          <span>·</span>
                          <span>
                            <strong>Tool:</strong> {report.extractionTool} v{report.extractionToolVersion}
                          </span>
                        </div>

                        <p className="text-slate-600 line-clamp-1 italic mt-1">
                          &quot;{report.findingsSummary}&quot;
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-auto">
                        <button
                          onClick={() => setSelectedReportDetail(report)}
                          className="px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-800 font-semibold border border-stone-200 transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Full Report</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: CHAIN OF CUSTODY                                                   */}
          {/* ========================================================================= */}
          {activeTab === 'custody' && (
            <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
                <div>
                  <h3 className="text-base font-serif font-bold text-slate-900">
                    Chain of Custody Ledger
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Immutable transfer history for seized exhibits. Investigating officers can inspect records and append authorized transfer events.
                  </p>
                </div>

                {caseDocuments.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Exhibit:</span>
                    <select
                      value={selectedDocForCustody?.id || caseDocuments[0]?.id || ''}
                      onChange={(e) => {
                        const target = caseDocuments.find((d) => d.id === e.target.value);
                        setSelectedDocForCustody(target || null);
                      }}
                      className="py-1.5 px-3 text-xs rounded-xl border border-stone-200 bg-stone-50 text-slate-800 focus:outline-hidden"
                    >
                      {caseDocuments.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {caseDocuments.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  No evidence exhibits available in this case yet to inspect custody.
                </div>
              ) : (
                <CustodyTimeline
                  documentId={selectedDocForCustody?.id || caseDocuments[0]?.id}
                  documentTitle={selectedDocForCustody?.title || caseDocuments[0]?.title}
                  currentProfile={currentProfile}
                  availableProfiles={availableProfiles}
                  canRecordTransfer={true}
                  onTransferRecorded={() => {
                    loadCaseDetails(selectedCase);
                  }}
                />
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: PARTICIPANTS                                                       */}
          {/* ========================================================================= */}
          {activeTab === 'participants' && (
            <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-4">
              <div>
                <h3 className="text-base font-serif font-bold text-slate-900">
                  Case Participants & Authority Roster
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified judiciary, prosecution, defense counsel, investigating officer, and victim records for this case.
                </p>
              </div>

              <ParticipantsPanel
                caseId={selectedCase.id}
                caseNumber={selectedCase.caseNumber}
                currentProfile={currentProfile}
                availableProfiles={availableProfiles}
                readOnly={true}
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: NOTICES & ACTIVITY                                                 */}
          {/* ========================================================================= */}
          {activeTab === 'notices' && (
            <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs divide-y divide-stone-100 overflow-hidden">
              <div className="p-5 sm:p-6">
                <h3 className="text-base font-serif font-bold text-slate-900">
                  Investigation Notices & Activity
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated case hearings, custody transfer handoffs, and forensic report updates.
                </p>
              </div>

              {caseNotifications.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-800">No Notices Recorded</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    All evidentiary handovers and hearing schedules are up to date.
                  </p>
                </div>
              ) : (
                caseNotifications.map((notif) => (
                  <div key={notif.id} className="p-4 sm:p-5 flex items-start gap-3.5 text-xs">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5 border border-blue-200">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{notif.title}</span>
                        <span className="text-[10px] font-mono px-2 py-0.2 bg-stone-100 rounded text-slate-600 border border-stone-200">
                          {notif.type.replace(/_/g, ' ')}
                        </span>
                        {!notif.isRead && (
                          <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold font-mono text-[9px] rounded-full">
                            NEW
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 leading-relaxed">{notif.message}</p>
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(notif.createdAt).toLocaleString()}
                        </div>
                        {!notif.isRead && (
                          <button
                            onClick={() => handleMarkNotificationRead(notif.id)}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold text-blue-700 hover:bg-blue-50 border border-blue-200 cursor-pointer"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTER EVIDENCE                                                  */}
      {/* ========================================================================= */}
      {isRegisterEvidenceOpen && selectedCase && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-slate-900 text-base">
                    Register Evidence Exhibit
                  </h3>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Case: {selectedCase.caseNumber} · FIR: {selectedCase.firNumber || 'Pending'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterEvidenceOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterEvidence} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Exhibit Title / Seizure Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Seized Hard Drive Clone - WD 2TB Serial #48291"
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-hidden focus:border-blue-500 bg-stone-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Classification
                  </label>
                  <select
                    value={evidenceClassification}
                    onChange={(e) => setEvidenceClassification(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-hidden focus:border-blue-500 bg-stone-50/50"
                  >
                    <option value="confidential">Confidential</option>
                    <option value="restricted">Restricted</option>
                    <option value="privileged">Privileged</option>
                    <option value="internal">Internal</option>
                    <option value="public">Public</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={evidenceTags}
                    onChange={(e) => setEvidenceTags(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-hidden focus:border-blue-500 bg-stone-50/50 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Seizure Notes / Chain of Custody Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Location of seizure, witness present, tamper-evident bag seal number..."
                  value={evidenceDescription}
                  onChange={(e) => setEvidenceDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-hidden focus:border-blue-500 bg-stone-50/50"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Verified Evidence File *
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-stone-50/50 text-slate-700 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  PDF, DOCX, XLSX, CSV, TXT, PNG, JPEG, TIFF. Cryptographic SHA-256 will be calculated automatically.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsRegisterEvidenceOpen(false)}
                  disabled={isSubmittingEvidence}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-stone-100 font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEvidence}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmittingEvidence && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmittingEvidence ? 'Sealing Exhibit...' : 'Register Exhibit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUBMIT FOR FORENSIC EXAMINATION                                    */}
      {/* ========================================================================= */}
      {isSubmitForensicOpen && submitDocTarget && selectedCase && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-slate-900 text-base">
                    Submit for Forensic Examination
                  </h3>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Exhibit: {submitDocTarget.title}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsSubmitForensicOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForensicHandoff} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-500 font-bold border-b border-stone-200 pb-1.5">
                  <span className="flex items-center gap-1 text-slate-700">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    Current Evidentiary Custody State
                  </span>
                  {loadingCustodyInfo ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                  ) : (
                    <span className="text-emerald-700 font-semibold">Active Ledger</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Present Custodian:</span>
                    <span className="font-semibold text-slate-800">
                      {evidenceCustodySummary ? evidenceCustodySummary.lastCustodian : currentProfile.fullName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Last Known Seal:</span>
                    <span className="font-mono text-slate-800 font-semibold">
                      {evidenceCustodySummary?.lastSeal ? evidenceCustodySummary.lastSeal : 'Initial Seizure / Station'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 font-mono text-[10px] uppercase">
                    Exhibit Cryptographic SHA-256 Checksum:
                  </div>
                  <div className="font-mono text-slate-900 break-all text-[11px] font-semibold mt-0.5 select-all">
                    {submitDocTarget.currentVersion.sha256Checksum}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Receiving Forensic Examiner *
                </label>
                <select
                  required
                  value={receivingExaminerId}
                  onChange={(e) => setReceivingExaminerId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-hidden focus:border-blue-500 bg-stone-50/50"
                >
                  <option value="88888888-8888-4888-a888-888888888888">
                    Dr. Amitav Sen — Central Forensic Science Laboratory (CFSL)
                  </option>
                  {availableProfiles
                    .filter((p) => p.role === 'forensic_team' && p.id !== '88888888-8888-4888-a888-888888888888')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} — Forensic Team
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Security Seal Number *
                </label>
                <input
                  type="text"
                  required
                  value={securitySealNumber}
                  onChange={(e) => setSecuritySealNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-hidden focus:border-blue-500 bg-stone-50/50 font-mono"
                  placeholder="e.g., SEAL-CFSL-4092"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Purpose of Transfer *
                </label>
                <input
                  type="text"
                  required
                  value={handoffPurpose}
                  onChange={(e) => setHandoffPurpose(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-hidden focus:border-blue-500 bg-stone-50/50"
                  placeholder="Forensic bit-stream acquisition & hash verification"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sealIntact}
                    onChange={(e) => setSealIntact(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 font-medium">
                    Physical tamper-evident seal is intact and verified
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shaVerified}
                    onChange={(e) => setShaVerified(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 font-medium">
                    SHA-256 acquisition checksum verified prior to dispatch
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Dispatched Notes / Handover Details
                </label>
                <textarea
                  rows={2}
                  value={handoffNotes}
                  onChange={(e) => setHandoffNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-hidden focus:border-blue-500 bg-stone-50/50"
                  placeholder="Dispatched via secure courier / hand-delivery under police escort..."
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsSubmitForensicOpen(false)}
                  disabled={isSubmittingHandoff}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-stone-100 font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingHandoff}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmittingHandoff && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmittingHandoff ? 'Recording Transfer...' : 'Confirm Lab Handoff'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW FORENSIC REPORT DETAIL                                        */}
      {/* ========================================================================= */}
      {selectedReportDetail && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-2xl w-full p-6 sm:p-7 space-y-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-slate-900 text-base">
                    Forensic Examination Report #{selectedReportDetail.id.slice(0, 8)}
                  </h3>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Lab: {selectedReportDetail.labName} · Examiner: {selectedReportDetail.examinerName || 'Dr. Amitav Sen'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedReportDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div>
                  <span className="text-slate-400 block font-mono text-[10px] uppercase">
                    Status
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {selectedReportDetail.isFinalized ? 'FINALIZED & IMMUTABLE' : 'DRAFT'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-mono text-[10px] uppercase">
                    Section 65B Certified
                  </span>
                  <span className="font-bold text-emerald-800 font-mono">
                    {selectedReportDetail.section65bCertified ? 'YES · ADMISSIBLE' : 'NO'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-mono text-[10px] uppercase">
                    Device Make / Model
                  </span>
                  <span className="text-slate-800 font-medium">
                    {selectedReportDetail.deviceMakeModel} ({selectedReportDetail.deviceType})
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-mono text-[10px] uppercase">
                    Device Serial Number
                  </span>
                  <span className="font-mono text-slate-800">
                    {selectedReportDetail.deviceSerialNumber}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-mono text-[10px] uppercase">
                    Extraction Tool
                  </span>
                  <span className="text-slate-800 font-medium">
                    {selectedReportDetail.extractionTool} v{selectedReportDetail.extractionToolVersion}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-mono text-[10px] uppercase">
                    Intake Condition
                  </span>
                  <span className="text-slate-800">{selectedReportDetail.intakeCondition}</span>
                </div>
              </div>

              {/* Hashes & Verification */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="font-semibold text-slate-900 border-b border-stone-200 pb-1.5 flex items-center justify-between">
                  <span>Cryptographic Hash Integrity</span>
                  {selectedReportDetail.hashesMatch ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold">
                      ✓ INTEGRITY VERIFIED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-mono text-[10px] font-bold">
                      ✗ HASH MISMATCH
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">
                      Acquisition SHA-256
                    </span>
                    <span className="font-mono text-[11px] text-slate-800 break-all select-all font-semibold">
                      {selectedReportDetail.acquisitionSha256}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">
                      Verification SHA-256
                    </span>
                    <span className="font-mono text-[11px] text-slate-800 break-all select-all font-semibold">
                      {selectedReportDetail.verificationSha256}
                    </span>
                  </div>
                </div>
              </div>

              {/* Findings */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <div className="font-semibold text-slate-900 border-b border-stone-200 pb-1.5">
                  Examiner Findings & Extraction Summary
                </div>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {selectedReportDetail.findingsSummary}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-stone-100">
              <button
                onClick={() => setSelectedReportDetail(null)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-800 font-semibold transition cursor-pointer text-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
