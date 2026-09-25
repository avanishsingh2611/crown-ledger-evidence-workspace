import React from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { Profile, UserRole } from '../types';

interface AccessRestrictedViewProps {
  currentProfile: Profile;
  areaTitle?: string;
  onReturnToOverview: () => void;
}

export function formatUserRole(role: UserRole): string {
  switch (role) {
    case 'judge':
      return 'Judge';
    case 'forensic_team':
      return 'Forensic Team';
    case 'investigating_officer':
      return 'Investigating Officer';
    case 'victim':
      return 'Victim';
    case 'workspace_admin':
      return 'Workspace Admin';
    case 'attorney':
      return 'Attorney';
    case 'auditor':
      return 'Auditor';
    case 'reviewer':
      return 'Reviewer';
    default:
      return String(role).replace('_', ' ');
  }
}

export const AccessRestrictedView: React.FC<AccessRestrictedViewProps> = ({
  currentProfile,
  areaTitle = 'This Section',
  onReturnToOverview,
}) => {
  return (
    <div className="max-w-2xl mx-auto my-12 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-rose-700 font-bold bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
            Ethical Wall & Judicial Protection
          </span>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 mt-2">
            Access Restricted
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-lg mx-auto leading-relaxed">
            You do not have permission to view {areaTitle}. Your authenticated identity (
            <span className="font-semibold text-slate-800">{currentProfile.fullName}</span> ·{' '}
            <span className="font-mono text-amber-800 font-semibold">{formatUserRole(currentProfile.role)}</span>
            ) is restricted under statutory role-based access control and confidentiality policies.
          </p>
        </div>

        <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-left text-xs text-slate-600 flex items-start gap-2.5 max-w-md mx-auto">
          <Lock className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <strong>Security Boundary Active:</strong> All internal legal documents, forensic work-product, and custodial records remain enforced by PostgreSQL Row-Level Security (RLS).
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={onReturnToOverview}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Authorized Overview</span>
          </button>
        </div>
      </div>
    </div>
  );
};
