import React from 'react';
import {
  Scale,
  LayoutDashboard,
  Briefcase,
  Files,
  ShieldCheck,
  Lock,
  LogOut,
  X,
  Database,
  CheckCircle2,
  Gavel,
  FlaskConical,
  HeartHandshake,
  Bell,
} from 'lucide-react';
import { Profile } from '../types';
import { formatUserRole } from './AccessRestrictedView';

export type NavSection =
  | 'overview'
  | 'cases'
  | 'matters'
  | 'documents'
  | 'audit'
  | 'restricted'
  | 'notifications';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  currentProfile: Profile;
  onSignOut: () => void;
  pendingClearanceCount?: number;
  unreadNotificationCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  currentProfile,
  onSignOut,
  pendingClearanceCount = 0,
  unreadNotificationCount = 0,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const getNavItems = (): {
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] => {
    const role = currentProfile.role;

    // 1. VICTIM / CITIZEN ROLE: Clean citizen-facing portal, strictly no internal vault/audit
    if (role === 'victim') {
      return [
        { id: 'overview', label: 'Victim Portal', icon: HeartHandshake },
        { id: 'cases', label: 'Case Status', icon: Scale },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
        },
      ];
    }

    // 2. JUDGE ROLE: Judicial bench, court cases docket, notifications
    if (role === 'judge') {
      return [
        { id: 'overview', label: 'Judge Bench', icon: Gavel },
        { id: 'cases', label: 'Court Cases', icon: Scale },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
        },
      ];
    }

    // 3. FORENSIC TEAM ROLE: Forensic lab workbench, assigned cases, notifications
    if (role === 'forensic_team') {
      return [
        { id: 'overview', label: 'Forensic Workbench', icon: FlaskConical },
        { id: 'cases', label: 'Assigned Cases', icon: Scale },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
        },
      ];
    }

    // 4. INVESTIGATING OFFICER ROLE: Investigation command, assigned cases, notifications
    if (role === 'investigating_officer') {
      return [
        { id: 'overview', label: 'Investigation Command', icon: ShieldCheck },
        { id: 'cases', label: 'Assigned Cases', icon: Scale },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
        },
      ];
    }

    // 5. WORKSPACE ADMIN, ATTORNEY, AUDITOR, REVIEWER
    return [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'cases', label: 'Cases', icon: Scale },
      { id: 'matters', label: 'Matters', icon: Briefcase },
      { id: 'documents', label: 'Documents', icon: Files },
      { id: 'audit', label: 'Audit Activity', icon: ShieldCheck },
      {
        id: 'restricted',
        label: 'Restricted / Confidential',
        icon: Lock,
        badge: pendingClearanceCount > 0 ? pendingClearanceCount : undefined,
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        badge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
      },
    ];
  };

  const navItems = getNavItems();
  const isVictim = currentProfile.role === 'victim';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0A1128] text-slate-200 border-r border-slate-800/80 select-none">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/10 border border-amber-300/40">
            <Scale className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-serif font-bold tracking-tight text-white">
                Crown & Ledger
              </span>
            </div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-amber-400/90 font-semibold mt-0.5">
              {isVictim ? 'CITIZEN PORTAL' : currentProfile.role === 'investigating_officer' ? 'POLICE COMMAND' : 'EVIDENCE WORKSPACE'}
            </div>
          </div>
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Section */}
      <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
        <div>
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider font-semibold text-slate-400">
            {isVictim ? 'CITIZEN ACCESS' : currentProfile.role === 'investigating_officer' ? 'INVESTIGATION' : 'WORKSPACE'}
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectSection(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${isActive
                    ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30 shadow-inner'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'
                        }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Security / Status Card */}
        <div className="px-3">
          {isVictim ? (
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Citizen Privacy</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Protected</span>
                </span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-400 font-sans">
                <div className="flex justify-between">
                  <span>Identity Shield</span>
                  <span className="text-slate-300 font-mono">Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Access Protocol</span>
                  <span className="text-slate-300 font-mono">Direct Notice</span>
                </div>
                <div className="flex justify-between">
                  <span>Judicial Docket</span>
                  <span className="text-slate-300 font-mono">Real-time</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <span>Vault Security</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Sealed</span>
                </span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-400 font-sans">
                <div className="flex justify-between">
                  <span>Storage</span>
                  <span className="text-slate-300 font-mono">Private Bucket</span>
                </div>
                <div className="flex justify-between">
                  <span>Integrity</span>
                  <span className="text-slate-300 font-mono">SHA-256</span>
                </div>
                <div className="flex justify-between">
                  <span>Signed URLs</span>
                  <span className="text-slate-300 font-mono">300s TTL</span>
                </div>
                <div className="flex justify-between">
                  <span>Audit Logs</span>
                  <span className="text-slate-300 font-mono">Append-Only</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Identity & Sign Out Footer */}
      <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-mono text-xs font-bold flex-shrink-0">
              {currentProfile.initials}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {currentProfile.fullName}
              </div>
              <div className="text-[10px] font-mono text-amber-400/90 font-medium truncate">
                {formatUserRole(currentProfile.role)}
              </div>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="Sign out of workspace"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 flex-shrink-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
