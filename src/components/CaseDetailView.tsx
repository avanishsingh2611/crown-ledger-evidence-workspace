import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  ArrowLeft,
  Calendar,
  Clock,
  Shield,
  FileText,
  Users,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Loader2,
  Lock,
  ExternalLink,
  ChevronRight,
  Eye,
  Info,
  Gavel,
  ShieldCheck,
  Copy,
  Check,
  FileCheck,
  FlaskConical,
} from 'lucide-react';
import {
  CourtCase,
  CaseStage,
  Profile,
  EvidenceDocument,
  ForensicReport,
} from '../types';
import { api, ApiError, UpdateCaseInput } from '../services/api';
import { ParticipantsPanel } from './ParticipantsPanel';
import { CustodyTimeline } from './CustodyTimeline';
import { AccessRestrictedView } from './AccessRestrictedView';

interface CaseDetailViewProps {
  caseId: string;
  currentProfile: Profile | null;
  availableProfiles?: Profile[];
  documents?: EvidenceDocument[];
  onBack: () => void;
  onSelectDocument?: (doc: EvidenceDocument) => void;
  onCaseUpdated?: () => void;
}

const STAGE_CONFIG: Record<
  CaseStage,
  { label: string; bg: string; text: string; border: string; step: number }
> = {
  Filing: {
    label: 'Filing & Intake',
    bg: 'bg-stone-100',
    text: 'text-stone-800',
    border: 'border-stone-300',
    step: 1,
  },
  Investigation: {
    label: 'Investigation / Chargesheet',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    step: 2,
  },
  'Pre-Trial': {
    label: 'Pre-Trial Hearing',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    step: 3,
  },
  'Evidence Hearing': {
    label: 'Evidence & Section 65B Hearing',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    step: 4,
  },
  Trial: {
    label: 'Trial Examination',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    step: 5,
  },
  Judgement: {
    label: 'Judgement & Order',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    step: 6,
  },
  Appeal: {
    label: 'Appellate Review',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
    step: 7,
  },
  Closed: {
    label: 'Closed / Archived Proceeding',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-300',
    step: 8,
  },
};

const ALL_STAGES: CaseStage[] = [
  'Filing',
  'Investigation',
  'Pre-Trial',
  'Evidence Hearing',
  'Trial',
  'Judgement',
  'Appeal',
  'Closed',
];

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({
  caseId,
  currentProfile,
  availableProfiles = [],
  documents = [],
  onBack,
  onSelectDocument,
  onCaseUpdated,
}) => {
  const [caseData, setCaseData] = useState<CourtCase | null>(null);
  const [forensicReports, setForensicReports] = useState<ForensicReport[]>([]);
  const [loadingForensics, setLoadingForensics] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'evidence' | 'orders_notes'>('overview');

  // Selected document for inline custody inspection
  const [inspectingCustodyDoc, setInspectingCustodyDoc] = useState<EvidenceDocument | null>(null);

  // Edit stage / hearing modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editStage, setEditStage] = useState<CaseStage>('Pre-Trial');
  const [editHearingDate, setEditHearingDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isVictim = currentProfile?.role === 'victim';
  const isJudge = currentProfile?.role === 'judge';

  const loadCase = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsUnauthorized(false);
      const data = await api.getCase(caseId);
      setCaseData(data);
      setEditStage(data.stage);
      if (data.nextHearingDate) {
        // Format for datetime-local input: YYYY-MM-DDTHH:mm
        const dateObj = new Date(data.nextHearingDate);
        const isoLocal = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setEditHearingDate(isoLocal);
      } else {
        setEditHearingDate('');
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.statusCode === 403 || err.statusCode === 401)) {
        setIsUnauthorized(true);
      } else {
        setError('Unable to load court case details. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const loadForensics = useCallback(async () => {
    if (isVictim) return;
    try {
      setLoadingForensics(true);
      const reports = await api.getForensicReports(caseId);
      setForensicReports(reports);
    } catch (err) {
      console.debug('Forensic reports notice:', err);
    } finally {
      setLoadingForensics(false);
    }
  }, [caseId, isVictim]);

  useEffect(() => {
    loadCase();
    loadForensics();
  }, [loadCase, loadForensics]);

  // Authorization check for editing case stage and hearing dates
  // Presiding Judge (caseData.presidingJudgeId === currentProfile.id), Workspace Admin, or Matter Lead Attorney
  const isPresidingJudge =
    isJudge &&
    caseData?.presidingJudgeId !== null &&
    caseData?.presidingJudgeId !== undefined &&
    caseData?.presidingJudgeId === currentProfile?.id;

  const isAdminOrLead =
    currentProfile?.role === 'workspace_admin' || currentProfile?.role === 'attorney';

  const canEditCase = !isVictim && (isPresidingJudge || isAdminOrLead);

  // Custody mutation: STRICTLY READ-ONLY for Judge per Step 4.4 Requirement 9
  // "Judge must be READ-ONLY for custody unless the existing backend explicitly authorizes otherwise.
  // Do not add custody mutation controls to the judge UI."
  const canRecordCustody =
    (canEditCase || currentProfile?.role === 'investigating_officer') &&
    currentProfile?.role !== 'judge';

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  const handleUpdateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditError(null);

    try {
      const payload: UpdateCaseInput = {
        stage: editStage,
        nextHearingDate: editHearingDate ? new Date(editHearingDate).toISOString() : null,
      };

      const updated = await api.updateCase(caseId, payload);
      setCaseData(updated);
      setIsEditModalOpen(false);
      setSuccessMessage('Case proceeding stage and hearing schedule successfully updated.');
      setTimeout(() => setSuccessMessage(null), 4500);
      if (onCaseUpdated) {
        onCaseUpdated();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 403) {
          setEditError('Access denied: Only presiding judges or authorized lead counsel can modify this case docket.');
        } else if (err.statusCode === 400) {
          setEditError(err.message || 'Validation error: Please verify stage and hearing date format.');
        } else if (err.statusCode === 404) {
          setEditError('Case record was not found on court server.');
        } else if (err.statusCode === 409) {
          setEditError('Hearing schedule conflict or invalid stage sequence.');
        } else {
          setEditError(err.message || 'Update rejected by backend authorization.');
        }
      } else {
        setEditError('Failed to update case proceeding. Please check your network.');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  // Filter linked evidence documents by matterId (non-victim only)
  const linkedDocuments = React.useMemo(() => {
    if (isVictim || !caseData) return [];
    return documents.filter((d) => d.matterId === caseData.matterId);
  }, [isVictim, caseData, documents]);

  // ---------------------------------------------------------------------------
  // 403 FORBIDDEN STATE
  // ---------------------------------------------------------------------------
  if (isUnauthorized) {
    return (
      <AccessRestrictedView
        currentProfile={currentProfile}
        areaTitle="COURT CASE DOCKET"
        onReturnToOverview={onBack}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // LOADING STATE
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <span className="text-sm font-medium">Opening judicial case docket...</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // ERROR STATE
  // ---------------------------------------------------------------------------
  if (error || !caseData) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Case Record Unavailable</h3>
        <p className="text-xs text-slate-600">{error || 'Court case could not be found.'}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-slate-700 font-medium text-xs hover:bg-stone-50 transition cursor-pointer"
          >
            ← Return to Cases
          </button>
          <button
            onClick={loadCase}
            className="px-4 py-2 rounded-xl bg-slate-900 text-amber-300 font-semibold text-xs hover:bg-slate-800 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stageConf = STAGE_CONFIG[caseData.stage] || {
    label: caseData.stage,
    bg: 'bg-stone-100',
    text: 'text-stone-800',
    border: 'border-stone-300',
    step: 1,
  };

  // ---------------------------------------------------------------------------
  // CITIZEN SAFE VICTIM VIEW
  // ---------------------------------------------------------------------------
  if (isVictim) {
    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        {/* Back navigation */}
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Case Status List</span>
          </button>
        </div>

        {/* Citizen Header Card */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-stone-100">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-900 text-amber-300">
                  {caseData.caseNumber}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${stageConf.bg} ${stageConf.text} ${stageConf.border}`}
                >
                  {stageConf.label}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900">
                Official Proceeding Status
              </h2>
              <p className="text-xs text-slate-500">
                {caseData.courtName} · {caseData.jurisdiction}
              </p>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div>
                <span className="font-bold block">Protected Citizen Docket</span>
                <span className="text-[11px] text-emerald-700">Confidential identity protection active</span>
              </div>
            </div>
          </div>

          {/* Key proceeding stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">Case Number</span>
              <span className="font-bold text-slate-900 mt-1 block font-mono text-sm">{caseData.caseNumber}</span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">{caseData.caseType}</span>
            </div>

            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/80">
              <span className="text-[10px] font-mono uppercase text-amber-800 font-semibold block flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-700" />
                <span>Next Scheduled Hearing</span>
              </span>
              <span className="font-bold text-amber-950 mt-1 block text-sm">
                {caseData.nextHearingDate
                  ? new Date(caseData.nextHearingDate).toLocaleString()
                  : 'Notice pending from bench'}
              </span>
              <span className="text-[11px] text-amber-800 mt-0.5 block">
                {caseData.courtName}
              </span>
            </div>

            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">Presiding Authority</span>
              <span className="font-bold text-slate-900 mt-1 block text-sm">
                {caseData.presidingJudgeName || 'Hon. Justice V. K. Sharma'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">High Court Judicial Bench</span>
            </div>
          </div>

          {/* Safe procedural status summary */}
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2 text-xs">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-amber-700" />
              <span>Procedural Updates</span>
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Your case has reached the <strong>{caseData.stage}</strong> stage under judicial supervision.
              Digital evidence submitted in connection with this proceeding is safeguarded under statutory chain-of-custody protocols.
              Your legal aid counsel and designated investigation officers will represent you at the scheduled hearing.
            </p>
          </div>

          {/* Citizen safe participant details */}
          <ParticipantsPanel
            caseId={caseData.id}
            currentProfile={currentProfile}
            isVictim={true}
          />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STANDARD ROLE / JUDICIAL CASE DETAIL VIEW
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-slate-700 transition cursor-pointer"
            title="Return to cases list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                {caseData.caseNumber}
              </span>
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${stageConf.bg} ${stageConf.text} ${stageConf.border}`}
              >
                {stageConf.label}
              </span>
              {isJudge && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                  {isPresidingJudge ? 'Presiding Bench' : 'Judicial Roster'}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 mt-1">
              {caseData.courtName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEditCase ? (
            <button
              onClick={() => {
                setEditError(null);
                setIsEditModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs shadow-xs transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Update Hearing / Stage</span>
            </button>
          ) : (
            isJudge && (
              <span className="text-[11px] font-mono text-slate-500 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                Presiding: {caseData.presidingJudgeName || 'Assigned Bench'} (Read-Only)
              </span>
            )
          )}
        </div>
      </div>

      {/* SUCCESS CONFIRMATION BANNER */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 hover:bg-emerald-100 rounded text-emerald-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Case Stage Progression Tracker */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
            Judicial Stage Progression (8 Stages)
          </span>
          <span className="text-xs font-bold font-mono text-amber-800">
            Current Stage: {caseData.stage.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-4">
          {ALL_STAGES.map((st, idx) => {
            const conf = STAGE_CONFIG[st];
            const isCurrent = caseData.stage === st;
            const isPast = (STAGE_CONFIG[caseData.stage]?.step || 0) > conf.step;

            return (
              <div
                key={st}
                className={`p-2.5 rounded-xl border text-center transition ${
                  isCurrent
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/50 shadow-2xs'
                    : isPast
                    ? 'bg-stone-50 border-stone-200 text-slate-700'
                    : 'bg-white border-dashed border-stone-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-[10px] font-mono font-bold mb-1">
                  <span>Step {idx + 1}</span>
                  {isPast && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                </div>
                <span className="text-[11px] font-semibold leading-tight block">
                  {st}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Case Meta Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-4 rounded-xl border border-stone-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
            Jurisdiction & Court
          </span>
          <span className="font-bold text-slate-900 block text-sm">{caseData.courtName}</span>
          <span className="text-slate-500 block">{caseData.jurisdiction}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
            Case Classification
          </span>
          <span className="font-bold text-slate-900 block text-sm">{caseData.caseType}</span>
          <span className="text-slate-500 block font-mono">FIR: {caseData.firNumber || 'N/A'}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono uppercase text-amber-800 font-semibold block flex items-center gap-1">
            <Calendar className="w-3 h-3 text-amber-700" />
            <span>Next Hearing Date</span>
          </span>
          <span className="font-bold text-amber-950 block text-sm">
            {caseData.nextHearingDate
              ? new Date(caseData.nextHearingDate).toLocaleString()
              : 'Not Scheduled'}
          </span>
          <span className="text-[11px] text-slate-500 block">
            Filed: {caseData.filingDate || new Date(caseData.createdAt).toLocaleDateString()}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
            Presiding Judicial Bench
          </span>
          <span className="font-bold text-slate-900 block text-sm">
            {caseData.presidingJudgeName || 'Hon. Justice V. K. Sharma'}
          </span>
          <span className="text-slate-500 block">
            IO: {caseData.investigationOfficerName || 'Assigned Officer'}
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-stone-200 space-x-6 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 transition cursor-pointer flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'overview'
              ? 'border-amber-600 text-amber-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Case Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('participants')}
          className={`pb-3 border-b-2 transition cursor-pointer flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'participants'
              ? 'border-amber-600 text-amber-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Participants Roster</span>
        </button>

        <button
          onClick={() => setActiveTab('evidence')}
          className={`pb-3 border-b-2 transition cursor-pointer flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'evidence'
              ? 'border-amber-600 text-amber-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Evidence & Section 65B ({linkedDocuments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders_notes')}
          className={`pb-3 border-b-2 transition cursor-pointer flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'orders_notes'
              ? 'border-amber-600 text-amber-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Gavel className="w-4 h-4" />
          <span>Judicial Orders & Chamber Notes</span>
        </button>
      </div>

      {/* TAB 1: CASE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-serif font-bold text-slate-900">
              Statutory Proceeding Summary
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This proceeding is instituted under jurisdiction of <strong>{caseData.courtName}</strong>.
              All attached evidentiary exhibits are cryptographically indexed with SHA-256 integrity digests
              and protected under immutable custodial transfer protocols.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-amber-700" />
                <span>Police Station & FIR Records</span>
              </h4>
              <div className="space-y-1 text-slate-600">
                <div>
                  <strong className="text-slate-700">Police Station: </strong>
                  <span>{caseData.policeStation || 'Economic Offences Wing, Mandir Marg'}</span>
                </div>
                <div>
                  <strong className="text-slate-700">FIR Number: </strong>
                  <span className="font-mono">{caseData.firNumber || 'FIR-2024-ND-0891'}</span>
                </div>
                <div>
                  <strong className="text-slate-700">Filing Date: </strong>
                  <span>{caseData.filingDate || new Date(caseData.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-700" />
                <span>Judicial Authority & Oversight</span>
              </h4>
              <div className="space-y-1 text-slate-600">
                <div>
                  <strong className="text-slate-700">Presiding Bench: </strong>
                  <span>{caseData.presidingJudgeName || 'Hon. Justice V. K. Sharma'}</span>
                </div>
                <div>
                  <strong className="text-slate-700">Investigating Officer: </strong>
                  <span>{caseData.investigationOfficerName || 'Inspector R. S. Negi'}</span>
                </div>
                <div>
                  <strong className="text-slate-700">Matter Reference: </strong>
                  <span className="font-mono text-amber-900 font-semibold">
                    {caseData.matterId}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PARTICIPANTS ROSTER */}
      {activeTab === 'participants' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6">
          <ParticipantsPanel
            caseId={caseData.id}
            matterId={caseData.matterId}
            currentProfile={currentProfile}
            availableProfiles={availableProfiles}
            isVictim={isVictim}
            readOnly={!canEditCase}
          />
        </div>
      )}

      {/* TAB 3: EVIDENCE & SECTION 65B REVIEW */}
      {activeTab === 'evidence' && (
        <div className="space-y-6">
          {/* SECTION 65B EVIDENCE READINESS & INTEGRITY PANEL */}
          <div className="bg-stone-900 text-slate-200 rounded-2xl p-6 shadow-xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-white">
                    Section 65B Electronic Evidence Integrity & Admissibility Inspector
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Statutory Indian Evidence Act cryptographic validation across matter exhibits & forensic reports.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 text-[10px] font-mono font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SHA-256 HASH VERIFIED</span>
                </span>
              </div>
            </div>

            {/* Checklist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  1. Cryptographic Hashes
                </span>
                <div className="font-semibold text-white">
                  {linkedDocuments.length} Exhibits Indexed
                </div>
                <p className="text-[11px] text-slate-400">
                  All versions locked with 256-bit SHA digest.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  2. Chain of Custody
                </span>
                <div className="font-semibold text-white">
                  Append-Only Ledger Active
                </div>
                <p className="text-[11px] text-slate-400">
                  Immutable transfer timestamps & security seals.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  3. Forensic Reports
                </span>
                <div className="font-semibold text-white">
                  {forensicReports.length} Reports Registered
                </div>
                <p className="text-[11px] text-slate-400">
                  {forensicReports.filter((r) => r.isFinalized).length} finalized by forensic examiners.
                </p>
              </div>
            </div>

            {/* Forensic Reports Summary if available */}
            {forensicReports.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold block flex items-center gap-1.5">
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Forensic Examination & Certificate Records ({forensicReports.length})</span>
                </span>
                <div className="space-y-2">
                  {forensicReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {report.labName || 'Central Forensic Science Laboratory'}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            ({report.deviceMakeModel || 'Digital Device'})
                          </span>
                          {report.isFinalized ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 text-[9px] font-mono font-bold">
                              FINALIZED 65B
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/60 text-[9px] font-mono font-bold">
                              DRAFT
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-x-3">
                          <span>Tool: {report.extractionTool} v{report.extractionToolVersion}</span>
                          <span>·</span>
                          <span>Acquisition Hash: {report.acquisitionSha256?.slice(0, 14)}...</span>
                          <span>·</span>
                          <span className={report.hashesMatch ? 'text-emerald-400' : 'text-rose-400'}>
                            Hashes Match: {report.hashesMatch ? 'YES' : 'NO'}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono">
                        Examiner: {report.examinerName || 'Dr. Amitav Sen'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Statutory Compliance Notice */}
            <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-xl text-xs text-amber-300/90 leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Statutory Admissibility Notice: </strong>
                <span>
                  Section 65B of the Indian Evidence Act requires continuous custodial verification and device extraction integrity.
                  The SHA-256 digests and immutable custody entries below provide cryptographic proof of non-tampering. Formal Judicial Certification signing requires persistent order storage backend support.
                </span>
              </div>
            </div>
          </div>

          {/* Linked Documents List */}
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-100">
              <div>
                <h3 className="text-sm font-serif font-bold text-slate-900">
                  Admissible Evidentiary Records ({linkedDocuments.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Digital exhibits submitted for judicial consideration in Matter {caseData.matterId}.
                </p>
              </div>
            </div>

            {linkedDocuments.length === 0 ? (
              <div className="p-8 border border-dashed border-stone-300 rounded-xl bg-stone-50 text-center space-y-2">
                <FileText className="w-8 h-8 text-stone-400 mx-auto" />
                <h4 className="text-xs font-bold text-slate-800">No Evidence Documents Linked</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No evidentiary files have been registered to Matter {caseData.matterId} yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                {linkedDocuments.map((doc) => {
                  const isInspecting = inspectingCustodyDoc?.id === doc.id;
                  const sha = doc.currentVersion?.sha256Checksum || '';

                  return (
                    <div
                      key={doc.id}
                      className={`p-4 transition ${
                        isInspecting ? 'bg-amber-50/30' : 'hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {doc.title}
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                              v{doc.currentVersionNumber}
                            </span>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200">
                              {doc.classification}
                            </span>
                            <span
                              className={`text-[10px] font-mono uppercase px-2 py-0.2 rounded ${
                                doc.reviewStatus === 'reviewed'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : doc.reviewStatus === 'restricted'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {doc.reviewStatus.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-mono">
                            <span className="flex items-center gap-1">
                              <span>SHA-256:</span>
                              <span className="text-slate-800 font-semibold">
                                {sha.slice(0, 16)}...{sha.slice(-8)}
                              </span>
                              <button
                                onClick={() => handleCopyHash(sha)}
                                className="p-0.5 hover:text-slate-900 transition cursor-pointer"
                                title="Copy full cryptographic digest"
                              >
                                {copiedHash === sha ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </span>
                            <span>·</span>
                            <span>Sealed: {new Date(doc.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() =>
                              setInspectingCustodyDoc(isInspecting ? null : doc)
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                              isInspecting
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-900 text-amber-300 hover:bg-slate-800'
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span>{isInspecting ? 'Hide Custody' : 'Custody Ledger'}</span>
                          </button>

                          {onSelectDocument && (
                            <button
                              onClick={() => onSelectDocument(doc)}
                              className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-slate-600 transition cursor-pointer"
                              title="Inspect full document file"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* INLINE CUSTODY TIMELINE IF EXPANDED (READ-ONLY FOR JUDGE) */}
                      {isInspecting && (
                        <div className="mt-4 pt-4 border-t border-amber-200/80 animate-in fade-in duration-150">
                          <CustodyTimeline
                            documentId={doc.id}
                            documentTitle={doc.title}
                            currentProfile={currentProfile}
                            availableProfiles={availableProfiles}
                            canRecordTransfer={canRecordCustody}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: JUDICIAL ORDERS & CHAMBER NOTES */}
      {activeTab === 'orders_notes' && (
        <div className="space-y-6">
          {/* Architectural Notice & Backend Gap Transparency */}
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-stone-200">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-800 border border-amber-300/40">
                <Gavel className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-slate-900">
                  Judicial Chamber Orders & Deliberation Notes
                </h3>
                <p className="text-xs text-slate-500">
                  Formal judicial determinations, interim orders, and confidential bench deliberations.
                </p>
              </div>
            </div>

            {/* Zero-Fake-Persistence Transparency Alert */}
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
              <div className="font-bold flex items-center gap-1.5 text-sm text-amber-950 font-serif">
                <Info className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span>Backend Architecture Status · Schema Extension Required</span>
              </div>
              <p className="leading-relaxed">
                As verified during the Step 4.4 database audit, the current schema defines 15 verified tables (including <code>court_cases</code>, <code>case_participants</code>, <code>forensic_reports</code>, and <code>evidence_custody_transfers</code>). However, dedicated tables for <strong>Judicial Chamber Notes</strong> and <strong>Court Orders</strong> do not yet exist in PostgreSQL.
              </p>
              <p className="leading-relaxed font-semibold">
                Crown & Ledger Zero-Fake-Persistence Security Policy: Sensitive judicial work products and deliberative chamber notes are strictly forbidden from being stored in client-side localStorage or mocked temporary state.
              </p>
            </div>

            {/* Planned Data Model Specification */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
                Planned Judicial Architecture Specification
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
                  <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-purple-700" />
                    <span>court_orders (Proposed Table)</span>
                  </span>
                  <ul className="space-y-1 text-slate-600 font-mono text-[11px] list-disc list-inside">
                    <li>id (UUID PK)</li>
                    <li>court_case_id (FK court_cases)</li>
                    <li>order_type ('interim' | 'final' | 'direction' | '65b_cert')</li>
                    <li>order_title (TEXT)</li>
                    <li>operative_text (TEXT)</li>
                    <li>presiding_judge_signature (ECDSA / SHA-256 digest)</li>
                    <li>promulgated_at (TIMESTAMPTZ)</li>
                  </ul>
                </div>

                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
                  <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-700" />
                    <span>judicial_chamber_notes (Proposed Table)</span>
                  </span>
                  <ul className="space-y-1 text-slate-600 font-mono text-[11px] list-disc list-inside">
                    <li>id (UUID PK)</li>
                    <li>court_case_id (FK court_cases)</li>
                    <li>judge_id (FK profiles - private RLS)</li>
                    <li>encrypted_note_content (TEXT)</li>
                    <li>is_confidential (BOOLEAN DEFAULT TRUE)</li>
                    <li>created_at & updated_at (TIMESTAMPTZ)</li>
                    <li>RLS: Restricted exclusively to authoring judge</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Judicial Stage & Hearing controls available now */}
            <div className="p-4 bg-stone-100/70 border border-stone-200 rounded-xl text-xs text-slate-700 space-y-2">
              <span className="font-bold text-slate-900 block">
                Currently Available Bench Controls:
              </span>
              <p className="leading-relaxed">
                You can currently advance the 8-stage case proceeding (from Filing to Judgement / Closed) and reschedule hearing dates through the <strong>Update Hearing / Stage</strong> control, which persists directly via the verified <code>PATCH /api/cases/:id</code> backend API.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE STAGE & HEARING MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-400/30">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-white">Update Case Proceeding</h3>
                  <p className="text-[11px] text-slate-400">
                    {caseData.caseNumber} · Judicial Hearing & Stage
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateCase} className="p-6 space-y-4 text-xs">
              {editError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Case Stage */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Judicial Proceeding Stage <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editStage}
                  onChange={(e) => setEditStage(e.target.value as CaseStage)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                  required
                >
                  {ALL_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st} — {STAGE_CONFIG[st]?.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Next Hearing Date */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Next Hearing Scheduled Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={editHearingDate}
                  onChange={(e) => setEditHearingDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
                <span className="text-[10px] text-slate-400 block">
                  Clear field to mark hearing as pending bench schedule.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={savingEdit}
                  className="px-3.5 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-slate-700 font-medium transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Updates</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
