import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Scale,
  Search,
  Plus,
  Calendar,
  Clock,
  ChevronRight,
  Shield,
  FileText,
  AlertTriangle,
  RefreshCw,
  X,
  Loader2,
  CheckCircle2,
  Lock,
  Filter,
  Users,
} from 'lucide-react';
import {
  CourtCase,
  CaseStage,
  Profile,
  Matter,
  EvidenceDocument,
} from '../types';
import { api, ApiError, CreateCaseInput } from '../services/api';
import { CaseDetailView } from './CaseDetailView';
import { AccessRestrictedView } from './AccessRestrictedView';

interface CasesViewProps {
  currentProfile: Profile | null;
  availableProfiles?: Profile[];
  matters?: Matter[];
  documents?: EvidenceDocument[];
  onSelectDocument?: (doc: EvidenceDocument) => void;
  initialCaseId?: string | null;
  onClearSelectedCase?: () => void;
}

const STAGE_CONFIG: Record<
  CaseStage,
  { label: string; bg: string; text: string; border: string }
> = {
  Filing: {
    label: 'Filing',
    bg: 'bg-stone-100',
    text: 'text-stone-800',
    border: 'border-stone-300',
  },
  Investigation: {
    label: 'Investigation',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
  },
  'Pre-Trial': {
    label: 'Pre-Trial',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
  },
  'Evidence Hearing': {
    label: 'Evidence Hearing',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  Trial: {
    label: 'Trial Examination',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
  },
  Judgement: {
    label: 'Judgement',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
  },
  Appeal: {
    label: 'Appellate Review',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
  },
  Closed: {
    label: 'Closed',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-300',
  },
};

export const CasesView: React.FC<CasesViewProps> = ({
  currentProfile,
  availableProfiles = [],
  matters = [],
  documents = [],
  onSelectDocument,
  initialCaseId = null,
  onClearSelectedCase,
}) => {
  const [cases, setCases] = useState<CourtCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  // Selected case for detail view
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialCaseId);

  useEffect(() => {
    if (initialCaseId) {
      setSelectedCaseId(initialCaseId);
    }
  }, [initialCaseId]);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<CaseStage | 'all'>('all');

  // New Case Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // New Case Form fields
  const [caseNumber, setCaseNumber] = useState('');
  const [matterId, setMatterId] = useState('');
  const [courtName, setCourtName] = useState('High Court of Delhi');
  const [jurisdiction, setJurisdiction] = useState('New Delhi');
  const [caseType, setCaseType] = useState('Criminal Special Leave');
  const [firNumber, setFirNumber] = useState('');
  const [policeStation, setPoliceStation] = useState('');
  const [presidingJudgeId, setPresidingJudgeId] = useState('');
  const [stage, setStage] = useState<CaseStage>('Investigation');
  const [filingDate, setFilingDate] = useState(new Date().toISOString().slice(0, 10));
  const [nextHearingDate, setNextHearingDate] = useState('');

  const isVictim = currentProfile?.role === 'victim';

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsUnauthorized(false);
      const data = await api.getCases();
      setCases(data);
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.statusCode === 403 || err.statusCode === 401)) {
        setIsUnauthorized(true);
      } else {
        setError('Unable to fetch judicial cases docket. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // Set default matterId when matters load
  useEffect(() => {
    if (matters.length > 0 && !matterId) {
      setMatterId(matters[0].id);
    }
  }, [matters, matterId]);

  // Filter judges from available profiles
  const judgeProfiles = useMemo(() => {
    return availableProfiles.filter((p) => p.role === 'judge');
  }, [availableProfiles]);

  // Filtered cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (selectedStage !== 'all' && c.stage !== selectedStage) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesNum = c.caseNumber.toLowerCase().includes(q);
        const matchesCourt = c.courtName.toLowerCase().includes(q);
        const matchesJurisdiction = c.jurisdiction.toLowerCase().includes(q);
        const matchesType = c.caseType.toLowerCase().includes(q);
        const matchesJudge = c.presidingJudgeName?.toLowerCase().includes(q);
        if (!matchesNum && !matchesCourt && !matchesJurisdiction && !matchesType && !matchesJudge) {
          return false;
        }
      }
      return true;
    });
  }, [cases, selectedStage, searchQuery]);

  // Role permissions for creating new court case
  const canCreateCase =
    !isVictim &&
    (currentProfile?.role === 'workspace_admin' || currentProfile?.role === 'attorney');

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber.trim()) {
      setCreateError('Case number is required.');
      return;
    }
    if (!matterId) {
      setCreateError('Please link an authorized legal matter.');
      return;
    }

    setSubmittingCreate(true);
    setCreateError(null);

    try {
      const payload: CreateCaseInput = {
        caseNumber: caseNumber.trim(),
        matterId,
        courtName: courtName.trim(),
        jurisdiction: jurisdiction.trim(),
        caseType: caseType.trim(),
        firNumber: firNumber.trim() || undefined,
        policeStation: policeStation.trim() || undefined,
        presidingJudgeId: presidingJudgeId || undefined,
        stage,
        filingDate: filingDate || undefined,
        nextHearingDate: nextHearingDate ? new Date(nextHearingDate).toISOString() : undefined,
      };

      const created = await api.createCase(payload);
      setCases((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
      // Reset form
      setCaseNumber('');
      setFirNumber('');
      setPoliceStation('');
      setNextHearingDate('');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setCreateError(err.message || 'Case creation rejected by backend.');
      } else {
        setCreateError('Failed to create court case. Please check connection.');
      }
    } finally {
      setSubmittingCreate(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 403 ACCESS RESTRICTED
  // ---------------------------------------------------------------------------
  if (isUnauthorized) {
    return (
      <AccessRestrictedView
        currentProfile={currentProfile}
        areaTitle="COURT CASES"
        onReturnToOverview={() => window.location.reload()}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // IF A CASE IS SELECTED, RENDER CASE DETAIL VIEW
  // ---------------------------------------------------------------------------
  if (selectedCaseId) {
    return (
      <CaseDetailView
        caseId={selectedCaseId}
        currentProfile={currentProfile}
        availableProfiles={availableProfiles}
        documents={documents}
        onBack={() => {
          setSelectedCaseId(null);
          if (onClearSelectedCase) onClearSelectedCase();
        }}
        onSelectDocument={onSelectDocument}
        onCaseUpdated={loadCases}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // CITIZEN CASE STATUS VIEW FOR VICTIM ROLE
  // ---------------------------------------------------------------------------
  if (isVictim) {
    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold">
              CITIZEN CASE STATUS DOCKET
            </div>
            <h1 className="text-2xl font-serif font-bold text-slate-900 mt-1">
              My Assigned Proceedings
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Secure citizen portal providing protected status updates and scheduled hearing dates.
            </p>
          </div>

          <button
            onClick={loadCases}
            disabled={loading}
            className="self-start sm:self-auto p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-slate-600 transition cursor-pointer disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            <span className="text-xs font-medium">Checking judicial proceeding records...</span>
          </div>
        )}

        {!loading && error && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadCases}
              className="px-3 py-1 bg-rose-200 hover:bg-rose-300 rounded font-semibold text-rose-900 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && cases.length === 0 && (
          <div className="p-10 border border-dashed border-stone-300 rounded-2xl bg-white text-center space-y-2">
            <Scale className="w-8 h-8 text-stone-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Assigned Proceedings</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There are currently no active court proceedings registered for your citizen profile.
            </p>
          </div>
        )}

        {!loading && !error && cases.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {cases.map((c) => {
              const stageConf = STAGE_CONFIG[c.stage] || {
                label: c.stage,
                bg: 'bg-stone-100',
                text: 'text-stone-800',
                border: 'border-stone-300',
              };

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs hover:border-amber-400/70 transition p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-800 flex items-center justify-center font-bold">
                        <Scale className="w-5 h-5 text-amber-800" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                            {c.caseNumber}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${stageConf.bg} ${stageConf.text} ${stageConf.border}`}
                          >
                            {stageConf.label}
                          </span>
                        </div>
                        <h3 className="text-base font-serif font-bold text-slate-900 mt-0.5">
                          {c.courtName}
                        </h3>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedCaseId(c.id)}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs transition cursor-pointer shadow-xs"
                    >
                      <span>View Case Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
                        Jurisdiction
                      </span>
                      <span className="font-semibold text-slate-800 mt-0.5 block">
                        {c.jurisdiction}
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">
                        Presiding Authority
                      </span>
                      <span className="font-semibold text-slate-800 mt-0.5 block">
                        {c.presidingJudgeName || 'Hon. Justice V. K. Sharma'}
                      </span>
                    </div>

                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
                      <span className="text-[10px] font-mono uppercase text-amber-800 font-semibold block flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-700" />
                        <span>Next Scheduled Hearing</span>
                      </span>
                      <span className="font-semibold text-amber-950 mt-0.5 block">
                        {c.nextHearingDate
                          ? new Date(c.nextHearingDate).toLocaleString()
                          : 'Notice pending from bench'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STANDARD ROLE COURT CASES WORKSPACE
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold">
            JUDICIAL OVERSIGHT
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 mt-1">
            Court Cases Docket ({filteredCases.length})
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Judicial proceedings, stage progression, hearing schedules, and Section 65B certified evidence linkages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCases}
            disabled={loading}
            className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-slate-600 transition cursor-pointer disabled:opacity-50"
            title="Refresh Cases"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canCreateCase && (
            <button
              onClick={() => {
                setCreateError(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register Court Case</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by case #, court, or judge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Stage Filter */}
        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-slate-500">Stage:</span>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value as CaseStage | 'all')}
            className="text-xs rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">All Proceeding Stages</option>
            <option value="Filing">Filing</option>
            <option value="Investigation">Investigation</option>
            <option value="Pre-Trial">Pre-Trial</option>
            <option value="Evidence Hearing">Evidence Hearing</option>
            <option value="Trial">Trial</option>
            <option value="Judgement">Judgement</option>
            <option value="Appeal">Appeal</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          <span className="text-xs font-medium">Retrieving authorized court cases...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadCases}
            className="px-3 py-1 bg-rose-200 hover:bg-rose-300 rounded font-semibold text-rose-900 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredCases.length === 0 && (
        <div className="p-12 border border-dashed border-stone-300 rounded-2xl bg-white text-center space-y-3">
          <Scale className="w-10 h-10 text-stone-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Court Cases Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery || selectedStage !== 'all'
              ? 'No court cases matched your search filters. Try clearing your search parameters.'
              : 'There are no judicial cases recorded under your authorized matters.'}
          </p>
          {canCreateCase && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register First Court Case</span>
            </button>
          )}
        </div>
      )}

      {/* Cases Cards Grid */}
      {!loading && !error && filteredCases.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCases.map((item) => {
            const stageConf = STAGE_CONFIG[item.stage] || {
              label: item.stage,
              bg: 'bg-stone-100',
              text: 'text-stone-800',
              border: 'border-stone-300',
            };

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-amber-400/80 shadow-2xs hover:shadow-xs transition p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card top */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                          {item.caseNumber}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${stageConf.bg} ${stageConf.text} ${stageConf.border}`}
                        >
                          {stageConf.label}
                        </span>
                      </div>
                      <h3 className="text-base font-serif font-bold text-slate-900 mt-1">
                        {item.courtName}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {item.jurisdiction} · {item.caseType}
                      </p>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center text-slate-400">
                      <Scale className="w-4 h-4 text-slate-600" />
                    </div>
                  </div>

                  {/* Hearing and Bench Meta */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 text-xs">
                    <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/80">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">
                        Presiding Judge
                      </span>
                      <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                        {item.presidingJudgeName || 'Hon. Justice V. K. Sharma'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-200/80">
                      <span className="text-[10px] font-mono uppercase text-amber-800 block font-semibold flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-amber-700" />
                        <span>Next Hearing</span>
                      </span>
                      <span className="font-semibold text-amber-950 mt-0.5 block truncate">
                        {item.nextHearingDate
                          ? new Date(item.nextHearingDate).toLocaleDateString()
                          : 'Not Scheduled'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer action */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-slate-400">
                    FIR: {item.firNumber || 'None'}
                  </span>

                  <button
                    onClick={() => setSelectedCaseId(item.id)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950 transition cursor-pointer"
                  >
                    <span>Open Case File</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REGISTER NEW COURT CASE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-400/30">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-white">Register Court Proceeding</h3>
                  <p className="text-[11px] text-slate-400">
                    Connect statutory legal matter to judicial oversight
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-3.5 text-xs overflow-y-auto">
              {createError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Case Number & Linked Matter */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Court Case Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    placeholder="e.g. CRL-DL-2024-001"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Linked Legal Matter <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={matterId}
                    onChange={(e) => setMatterId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                    required
                  >
                    {matters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.referenceCode} — {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Court Name & Jurisdiction */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Court Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={courtName}
                    onChange={(e) => setCourtName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Jurisdiction <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                    required
                  />
                </div>
              </div>

              {/* Case Type & Stage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Proceeding Classification <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={caseType}
                    onChange={(e) => setCaseType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Initial Stage <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as CaseStage)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                    required
                  >
                    <option value="Investigation">Investigation</option>
                    <option value="Pre-Trial">Pre-Trial</option>
                    <option value="Evidence Hearing">Evidence Hearing</option>
                    <option value="Trial">Trial</option>
                    <option value="Judgement">Judgement</option>
                  </select>
                </div>
              </div>

              {/* FIR & Police Station */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    FIR Number <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={firNumber}
                    onChange={(e) => setFirNumber(e.target.value)}
                    placeholder="e.g. FIR-2024-ND-0891"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">
                    Police Station <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={policeStation}
                    onChange={(e) => setPoliceStation(e.target.value)}
                    placeholder="e.g. Special Cell, Lodhi Road"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                  />
                </div>
              </div>

              {/* Presiding Judge Select */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Presiding Judicial Bench
                </label>
                <select
                  value={presidingJudgeId}
                  onChange={(e) => setPresidingJudgeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                >
                  <option value="">-- Assign Judge Later --</option>
                  {judgeProfiles.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.fullName} ({j.title})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filing Date & Hearing Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Filing Date</label>
                  <input
                    type="date"
                    value={filingDate}
                    onChange={(e) => setFilingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-700">Initial Hearing Date</label>
                  <input
                    type="datetime-local"
                    value={nextHearingDate}
                    onChange={(e) => setNextHearingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={submittingCreate}
                  className="px-3.5 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-slate-700 font-medium transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {submittingCreate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Register Case</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
