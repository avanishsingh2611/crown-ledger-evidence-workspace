import React from 'react';
import {
  Briefcase,
  Files,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Shield,
  Clock,
  Database,
  Upload,
  Search,
  FileText,
  ShieldCheck,
  Scale,
} from 'lucide-react';
import { Profile, Matter, EvidenceDocument, AuditLogEntry } from '../types';
import { NavSection } from './Sidebar';
import { JudgeBenchView } from './JudgeBenchView';
import { ForensicWorkbenchView } from './ForensicWorkbenchView';
import { InvestigatingOfficerView } from './InvestigatingOfficerView';

interface OverviewViewProps {
  currentProfile: Profile;
  matters: mattersSummary;
  documents: EvidenceDocument[];
  auditLogs: AuditLogEntry[];
  dbStats: {
    totalDocuments: number;
    needsReview: number;
    reviewed: number;
    restricted: number;
  } | null;
  onNavigate: (section: NavSection, filter?: { reviewStatus?: string }) => void;
  onOpenUpload: () => void;
  onSelectDocument: (doc: EvidenceDocument) => void;
}

type mattersSummary = Matter[];

export const OverviewView: React.FC<OverviewViewProps> = ({
  currentProfile,
  matters,
  documents,
  auditLogs,
  dbStats,
  onNavigate,
  onOpenUpload,
  onSelectDocument,
}) => {
  // Defense in depth: if accessed by investigating_officer, render InvestigatingOfficerView
  if (currentProfile.role === 'investigating_officer') {
    return (
      <InvestigatingOfficerView
        currentProfile={currentProfile}
        availableProfiles={[]}
        matters={matters}
        documents={documents}
        onNavigateToNotifications={() => onNavigate('notifications')}
        onSelectDocument={onSelectDocument}
      />
    );
  }

  // Determine greeting based on local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const totalDocs = dbStats?.totalDocuments ?? documents.length;
  const needsReview = dbStats?.needsReview ?? documents.filter((d) => d.reviewStatus === 'needs_review').length;
  const reviewed = dbStats?.reviewed ?? documents.filter((d) => d.reviewStatus === 'reviewed').length;
  const restricted = dbStats?.restricted ?? documents.filter((d) => d.reviewStatus === 'restricted' || d.classification === 'confidential' || d.classification === 'privileged').length;

  const statCards = [
    {
      title: 'Total Matters',
      value: matters.length,
      subtitle: `${matters.filter((m) => m.status === 'active').length} active proceedings`,
      icon: Briefcase,
      color: 'text-sky-700 bg-sky-50 border-sky-200',
      action: () => onNavigate('matters'),
    },
    {
      title: 'Total Evidence Records',
      value: totalDocs,
      subtitle: 'Sealed with SHA-256',
      icon: Files,
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      action: () => onNavigate('documents'),
    },
    {
      title: 'Needs Review',
      value: needsReview,
      subtitle: 'Pending determination',
      icon: AlertCircle,
      color: 'text-amber-800 bg-amber-50 border-amber-200',
      action: () => onNavigate('documents', { reviewStatus: 'needs_review' }),
    },
    {
      title: 'Reviewed & Certified',
      value: reviewed,
      subtitle: 'Custodial sign-off',
      icon: CheckCircle2,
      color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
      action: () => onNavigate('documents', { reviewStatus: 'reviewed' }),
    },
    {
      title: 'Restricted / Confidential',
      value: restricted,
      subtitle: 'Ethical-wall governance',
      icon: Lock,
      color: 'text-rose-800 bg-rose-50 border-rose-200',
      action: () => onNavigate('restricted'),
    },
  ];

  // -------------------------------------------------------------
  // VICTIM ROLE: Citizen Case Portal (Strictly no internal evidence/upload)
  // -------------------------------------------------------------
  if (currentProfile.role === 'victim') {
    return (
      <div className="space-y-8 animate-in fade-in duration-150">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/80">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold">
              CITIZEN CASE PORTAL
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 mt-1">
              {getGreeting()}, {currentProfile.fullName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Protected case proceeding portal. Track hearing schedules and official notices.
            </p>
          </div>
          <div>
            <button
              onClick={() => onNavigate('cases')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>View Case Status</span>
            </button>
          </div>
        </div>

        {/* Citizen Portal Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => onNavigate('cases')}
            className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-md hover:border-amber-400/50 transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                Assigned Proceeding
              </span>
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-lg font-bold font-serif text-slate-900">CRL-ND-2024-00891</div>
              <div className="text-xs text-slate-600 mt-1">State vs. Vikram Malhotra & Ors.</div>
            </div>
          </div>

          <div
            onClick={() => onNavigate('cases')}
            className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-md hover:border-amber-400/50 transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                Next Hearing
              </span>
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-lg font-bold font-mono text-amber-800">15 Oct 2026</div>
              <div className="text-xs text-slate-600 mt-1">High Court of Delhi · 10:00 AM</div>
            </div>
          </div>

          <div
            onClick={() => onNavigate('notifications')}
            className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs hover:shadow-md hover:border-amber-400/50 transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                Official Notices
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-lg font-bold font-serif text-emerald-800">Protected & Active</div>
              <div className="text-xs text-slate-600 mt-1">Identity sealed under Section 327 CrPC</div>
            </div>
          </div>
        </div>

        {/* Victim Information Banner */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-xs text-slate-600 space-y-2">
          <div className="font-semibold text-slate-800 flex items-center gap-1.5 text-sm font-serif">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span>Statutory Citizen Protection Assurance</span>
          </div>
          <p className="leading-relaxed">
            As a protected complainant/victim, your records are safeguarded from public disclosure. Evidence discovery, chain-of-custody transfer logs, and internal law-firm work products are compartmentalized in accordance with Section 327 CrPC and High Court digital rules.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // JUDGE ROLE: Judicial Bench Portal
  // -------------------------------------------------------------
  if (currentProfile.role === 'judge') {
    return (
      <JudgeBenchView
        currentProfile={currentProfile}
        onNavigateToCase={() => onNavigate('cases')}
        onNavigateToCases={() => onNavigate('cases')}
        onNavigateToNotifications={() => onNavigate('notifications')}
        onSelectDocument={onSelectDocument}
      />
    );
  }

  // -------------------------------------------------------------
  // FORENSIC TEAM ROLE: Forensic Workbench Portal
  // -------------------------------------------------------------
  if (currentProfile.role === 'forensic_team') {
    return (
      <ForensicWorkbenchView
        currentProfile={currentProfile}
        matters={matters}
        documents={documents}
        onNavigateToNotifications={() => onNavigate('notifications')}
        onSelectDocument={onSelectDocument}
      />
    );
  }

  const isJudge = currentProfile.role === 'judge';
  const isForensic = currentProfile.role === 'forensic_team';
  const isAuditor = currentProfile.role === 'auditor';
  const canUpload = currentProfile.role === 'workspace_admin' || currentProfile.role === 'attorney';
  const canSearchEvidence = !isJudge && !isForensic;

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/80">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold">
            {isJudge
              ? 'JUDGE BENCH OVERVIEW'
              : isForensic
              ? 'FORENSIC WORKBENCH'
              : 'WORKSPACE OVERVIEW'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 mt-1">
            {getGreeting()}, {currentProfile.fullName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {isJudge
              ? 'Presiding court docket, hearing schedules, and certified forensic reports.'
              : isForensic
              ? 'Digital forensic intake, bit-stream SHA-256 acquisition, and Section 65B certifications.'
              : 'A clear view of the evidence your team is responsible for.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {(isJudge || isForensic) && (
            <button
              onClick={() => onNavigate('cases')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>{isJudge ? 'View Court Cases' : 'View Assigned Cases'}</span>
            </button>
          )}

          {canSearchEvidence && (
            <button
              onClick={() => onNavigate('documents')}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Search Evidence</span>
            </button>
          )}

          {canUpload && (
            <button
              onClick={onOpenUpload}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Evidence</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={card.action}
              className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs hover:shadow-md hover:border-amber-400/50 transition cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{card.title}</span>
                <div className={`p-1.5 rounded-lg border ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-serif text-slate-900 tracking-tight">
                  {card.value}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{card.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Two-Column Content: Activity Feed & Vault Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-serif">Recent Authorized Activity</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time chain of custody events recorded in the custodial ledger.
              </p>
            </div>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition cursor-pointer"
            >
              <span>View Full Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 divide-y divide-stone-100 mt-2">
            {auditLogs.length === 0 ? (
              <div className="py-12 text-center">
                <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No activity recorded yet in this workspace.</p>
              </div>
            ) : (
              auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center font-mono text-[11px] font-bold flex-shrink-0 mt-0.5">
                      {log.actorInitials || 'CL'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-slate-800 font-medium truncate">
                        <strong className="font-semibold text-slate-900">{log.actorName}</strong>{' '}
                        <span className="text-slate-500 font-normal">({log.action.replace('_', ' ')})</span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate mt-0.5">
                        {log.details}
                      </div>
                      {log.matterReference && (
                        <span className="inline-block mt-1 font-mono text-[10px] text-amber-800 font-semibold px-1.5 py-0.5 bg-amber-50 rounded border border-amber-200">
                          {log.matterReference}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 flex-shrink-0 whitespace-nowrap">
                    {log.createdAt}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Vault Status & Quick Shortcuts (1 col) */}
        <div className="space-y-6">
          {/* Vault Security Card */}
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="text-xs font-semibold text-slate-900 font-serif flex items-center gap-1.5">
                <Database className="w-4 h-4 text-amber-600" />
                <span>Vault Status</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Active
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-stone-50">
                <span className="text-slate-500">Evidence Storage</span>
                <span className="font-medium text-slate-800">Private Bucket</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-50">
                <span className="text-slate-500">Integrity Protocol</span>
                <span className="font-mono text-slate-800">SHA-256 Hashing</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-50">
                <span className="text-slate-500">Download Access</span>
                <span className="font-mono text-slate-800">300-Second Signed URLs</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-50">
                <span className="text-slate-500">Audit Architecture</span>
                <span className="font-medium text-slate-800">Append-Only Protection</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Storage Status</span>
                <span className="text-slate-400 italic">Status unavailable</span>
              </div>
            </div>

            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>Chain of Custody Guarantee</span>
              </div>
              <p>
                All evidence uploads are verified against cryptographic SHA-256 digests and protected by PostgreSQL immutability triggers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
