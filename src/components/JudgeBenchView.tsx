/*
 * Crown & Ledger Evidence Workspace
 * Copyright © 2026 Avanish Singh
 * Author: Avanish Singh
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Gavel,
  Scale,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Bell,
  FileText,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Info,
  ExternalLink,
  Loader2,
  Lock,
} from 'lucide-react';
import { CourtCase, CaseStage, Profile, EvidenceDocument } from '../types';
import { api, ApiError } from '../services/api';
import { NavSection } from './Sidebar';

interface JudgeBenchViewProps {
  currentProfile: Profile;
  onNavigateToCase: (caseId: string) => void;
  onNavigateToCases: () => void;
  onNavigateToNotifications: () => void;
  unreadNotificationCount?: number;
  onSelectDocument?: (doc: EvidenceDocument) => void;
}

const STAGE_CONFIG: Record<
  CaseStage,
  { label: string; bg: string; text: string; border: string; step: number }
> = {
  Filing: {
    label: 'Filing',
    bg: 'bg-stone-100',
    text: 'text-stone-800',
    border: 'border-stone-300',
    step: 1,
  },
  Investigation: {
    label: 'Investigation',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    step: 2,
  },
  'Pre-Trial': {
    label: 'Pre-Trial',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    step: 3,
  },
  'Evidence Hearing': {
    label: 'Evidence Hearing',
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
    label: 'Judgement',
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
    label: 'Closed',
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

export const JudgeBenchView: React.FC<JudgeBenchViewProps> = ({
  currentProfile,
  onNavigateToCase,
  onNavigateToCases,
  onNavigateToNotifications,
  unreadNotificationCount = 0,
}) => {
  const [cases, setCases] = useState<CourtCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<CaseStage | 'all'>('all');

  const loadBenchCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCases();
      setCases(data);
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        setError('Judicial bench access restricted or session expired. Please verify clearance.');
      } else {
        setError('Unable to load judicial docket from court server.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBenchCases();
  }, [loadBenchCases]);

  // Derived Summary Metrics from real backend data
  const summaryMetrics = useMemo(() => {
    const total = cases.length;
    const active = cases.filter((c) => c.stage !== 'Closed').length;

    const now = new Date();
    const upcomingHearings = cases.filter((c) => {
      if (!c.nextHearingDate) return false;
      const d = new Date(c.nextHearingDate);
      return !isNaN(d.getTime()) && d >= now;
    }).length;

    const awaitingDecision = cases.filter(
      (c) => c.stage === 'Evidence Hearing' || c.stage === 'Judgement'
    ).length;

    // Recently updated (within last 14 days or top recent)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recentlyUpdated = cases.filter((c) => {
      const u = new Date(c.updatedAt || c.createdAt);
      return !isNaN(u.getTime()) && u >= fourteenDaysAgo;
    }).length;

    return {
      total,
      active,
      upcomingHearings,
      awaitingDecision,
      recentlyUpdated,
    };
  }, [cases]);

  // Upcoming hearings sorted chronologically
  const upcomingHearingsList = useMemo(() => {
    const list = cases
      .filter((c) => !!c.nextHearingDate)
      .map((c) => {
        const hearingDate = new Date(c.nextHearingDate!);
        return {
          caseItem: c,
          hearingDate,
          isPast: hearingDate < new Date(),
        };
      });

    list.sort((a, b) => a.hearingDate.getTime() - b.hearingDate.getTime());
    return list;
  }, [cases]);

  // Filtered docket list
  const filteredDocket = useMemo(() => {
    return cases.filter((c) => {
      if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesNum = c.caseNumber.toLowerCase().includes(q);
        const matchesCourt = c.courtName.toLowerCase().includes(q);
        const matchesJurisdiction = c.jurisdiction.toLowerCase().includes(q);
        const matchesType = c.caseType.toLowerCase().includes(q);
        const matchesFir = c.firNumber ? c.firNumber.toLowerCase().includes(q) : false;
        if (!matchesNum && !matchesCourt && !matchesJurisdiction && !matchesType && !matchesFir) {
          return false;
        }
      }
      return true;
    });
  }, [cases, stageFilter, searchQuery]);

  // Recently updated cases list (top 4)
  const recentlyUpdatedList = useMemo(() => {
    return [...cases]
      .sort((a, b) => {
        const da = new Date(a.updatedAt || a.createdAt).getTime();
        const db = new Date(b.updatedAt || b.createdAt).getTime();
        return db - da;
      })
      .slice(0, 4);
  }, [cases]);

  // Helper: Compute countdown label
  const getCountdownLabel = (targetDate: Date) => {
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, isUrgent: true, isPast: true };
    }
    if (diffDays === 0) {
      return { text: 'Today', isUrgent: true, isPast: false };
    }
    if (diffDays === 1) {
      return { text: 'Tomorrow', isUrgent: true, isPast: false };
    }
    if (diffDays <= 7) {
      return { text: `In ${diffDays} days`, isUrgent: true, isPast: false };
    }
    return { text: `In ${diffDays} days`, isUrgent: false, isPast: false };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* 1. JUDGE BENCH HEADER */}
      <div className="bg-[#0A1128] text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Subtle background decorative accent */}
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 -bottom-16 w-48 h-48 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-400/30">
              <Gavel className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
              JUDICIAL BENCH & DOCKET DISPOSITION
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
            Judge Bench · {currentProfile.fullName}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>High Court Presiding Jurisdiction</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-slate-400">{currentProfile.email}</span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Cryptographic Chain-of-Custody Authority</span>
            </span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3 z-10 flex-shrink-0">
          <button
            onClick={onNavigateToNotifications}
            className="relative px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-amber-400/50 transition cursor-pointer text-xs font-semibold flex items-center gap-2 shadow-xs"
            title="Judicial communication stream"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Notices</span>
            {unreadNotificationCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold font-mono text-[10px] animate-pulse">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          <button
            onClick={loadBenchCases}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Refresh Bench Docket"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ERROR BANNER IF API FAILED */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadBenchCases}
            className="px-3 py-1 bg-white hover:bg-rose-100 rounded-lg font-semibold text-rose-700 border border-rose-300 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Cases */}
        <div
          onClick={onNavigateToCases}
          className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-md hover:border-amber-400/50 transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Active Cases
            </span>
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-serif text-slate-900">
              {loading ? '—' : summaryMetrics.active}
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
              <span>{summaryMetrics.total} total court dockets</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Card 2: Upcoming Hearings */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-md hover:border-amber-400/50 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Upcoming Hearings
            </span>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-900">
              {loading ? '—' : summaryMetrics.upcomingHearings}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Scheduled for bench appearance
            </div>
          </div>
        </div>

        {/* Card 3: Cases Awaiting Decision */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-md hover:border-amber-400/50 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Awaiting Decision
            </span>
            <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-800">
              <Gavel className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-serif text-purple-950">
              {loading ? '—' : summaryMetrics.awaitingDecision}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Evidence Hearing or Judgement
            </div>
          </div>
        </div>

        {/* Card 4: Recently Updated Cases */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-md hover:border-amber-400/50 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              Recently Updated
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-serif text-emerald-950">
              {loading ? '—' : summaryMetrics.recentlyUpdated}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Proceedings modified in last 14 days
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN SECTION A: UPCOMING HEARINGS */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-700" />
              <h2 className="text-base font-serif font-bold text-slate-900">
                Scheduled Court Hearings ({upcomingHearingsList.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological calendar of matters scheduled for judicial oral argument and evidence examination.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            <span className="text-xs">Loading judicial hearing calendar...</span>
          </div>
        ) : upcomingHearingsList.length === 0 ? (
          <div className="p-8 text-center space-y-2 text-slate-500">
            <Calendar className="w-8 h-8 text-stone-300 mx-auto" />
            <div className="text-xs font-semibold text-slate-700">No Upcoming Hearings Scheduled</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No cases on the bench calendar have an active next hearing date recorded.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {upcomingHearingsList.map(({ caseItem, hearingDate, isPast }) => {
              const countdown = getCountdownLabel(hearingDate);
              const stageConf = STAGE_CONFIG[caseItem.stage] || {
                label: caseItem.stage,
                bg: 'bg-stone-100',
                text: 'text-stone-800',
                border: 'border-stone-300',
              };

              return (
                <div
                  key={caseItem.id}
                  className="p-5 sm:px-6 hover:bg-stone-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                        {caseItem.caseNumber}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${stageConf.bg} ${stageConf.text} ${stageConf.border}`}
                      >
                        {stageConf.label}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          countdown.isUrgent
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-stone-100 text-slate-700'
                        }`}
                      >
                        {countdown.text}
                      </span>
                    </div>

                    <h3 className="text-sm font-serif font-bold text-slate-900">
                      {caseItem.courtName} · {caseItem.jurisdiction}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-mono">
                      <span className="flex items-center gap-1 text-amber-900 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        <span>
                          {hearingDate.toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          at{' '}
                          {hearingDate.toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                      <span>·</span>
                      <span>Type: {caseItem.caseType}</span>
                      {caseItem.firNumber && (
                        <>
                          <span>·</span>
                          <span>FIR: {caseItem.firNumber}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onNavigateToCase(caseItem.id)}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      <span>Open Docket</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. MAIN SECTION B: ACTIVE DOCKET TABLE */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        {/* Docket Controls Header */}
        <div className="p-6 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-700" />
              <h2 className="text-base font-serif font-bold text-slate-900">
                Active Bench Docket ({filteredDocket.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete catalog of assigned court proceedings under judicial oversight.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search case, FIR, court..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 bg-stone-50/50 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Stage Filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as CaseStage | 'all')}
                className="w-full sm:w-auto px-3 py-1.5 rounded-xl border border-stone-300 bg-stone-50/50 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="all">All Stages</option>
                {ALL_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Docket Listing */}
        {loading ? (
          <div className="py-16 text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600 mx-auto" />
            <span className="text-xs text-slate-500">Loading cases docket...</span>
          </div>
        ) : filteredDocket.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Scale className="w-8 h-8 text-stone-300 mx-auto" />
            <h3 className="text-xs font-bold text-slate-700">No Cases Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No proceedings match the search query or stage filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50/80 border-b border-stone-200 text-[10px] font-mono uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-semibold">Case Number & FIR</th>
                  <th className="px-4 py-3 font-semibold">Jurisdiction & Court</th>
                  <th className="px-4 py-3 font-semibold">Current Stage</th>
                  <th className="px-4 py-3 font-semibold">Next Scheduled Hearing</th>
                  <th className="px-4 py-3 font-semibold">Bench Assignment</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredDocket.map((c) => {
                  const stageConf = STAGE_CONFIG[c.stage] || {
                    label: c.stage,
                    bg: 'bg-stone-100',
                    text: 'text-stone-800',
                    border: 'border-stone-300',
                  };
                  const isPresiding = c.presidingJudgeId === currentProfile.id;

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
                        <span
                          className={`inline-block text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${stageConf.bg} ${stageConf.text} ${stageConf.border}`}
                        >
                          {stageConf.label}
                        </span>
                      </td>

                      <td className="px-4 py-4 font-mono text-slate-700">
                        {c.nextHearingDate ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-amber-950 block">
                              {new Date(c.nextHearingDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {new Date(c.nextHearingDate).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unscheduled</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {isPresiding ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Presiding Judge</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            {c.presidingJudgeName || 'Hon. Justice V. K. Sharma'}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => onNavigateToCase(c.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <span>Examine Docket</span>
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

      {/* 5. MAIN SECTION C: RECENTLY UPDATED PROCEEDINGS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700" />
              <h3 className="text-sm font-serif font-bold text-slate-900">
                Recently Modified Proceedings
              </h3>
            </div>
            <button
              onClick={onNavigateToCases}
              className="text-xs font-semibold text-amber-800 hover:text-amber-900 transition cursor-pointer"
            >
              View All Cases →
            </button>
          </div>

          {recentlyUpdatedList.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No recent case modifications recorded.</p>
          ) : (
            <div className="space-y-3">
              {recentlyUpdatedList.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onNavigateToCase(c.id)}
                  className="p-3.5 rounded-xl border border-stone-200/80 hover:border-amber-400/50 hover:bg-stone-50/50 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{c.caseNumber}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-stone-100 text-slate-700 rounded">
                        {c.stage}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {c.courtName} · {c.jurisdiction}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-[11px] font-semibold text-amber-800 flex items-center justify-end gap-1 mt-0.5">
                      <span>Inspect</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6. STATUTORY & EVIDENCE READINESS PANEL */}
        <div className="bg-stone-50/70 rounded-2xl border border-stone-200/90 shadow-2xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-200">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-serif font-bold text-slate-900">
              Judicial Evidence Standards & Section 65B Notice
            </h3>
          </div>

          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div className="p-3 bg-white rounded-xl border border-stone-200/80 space-y-1.5">
              <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cryptographic Digest Verification</span>
              </span>
              <p className="text-[11px] text-slate-600">
                All electronic documents registered to matter dockets are hashed with immutable SHA-256 digests.
                Any bit-level alteration in storage immediately invalidates cryptographic verification.
              </p>
            </div>

            <div className="p-3 bg-white rounded-xl border border-stone-200/80 space-y-1.5">
              <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                <span>Append-Only Chain of Custody</span>
              </span>
              <p className="text-[11px] text-slate-600">
                Transfer of electronic evidence across investigating officers, forensic laboratories, and court registry is recorded in an immutable, append-only custody ledger.
              </p>
            </div>

            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-amber-900 space-y-1">
              <span className="font-bold block flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-800" />
                <span>Section 65B Certificate Sign-off Status</span>
              </span>
              <p className="text-[11px] text-amber-800/90">
                Forensic examiner extraction certificates are verified in forensic reports. Formal electronic Section 65B judicial order drafting and signing require persistent judicial orders schema integration.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
