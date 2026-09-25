import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  LogOut,
  User,
  ChevronDown,
  Menu,
  ChevronRight,
  Upload,
  Bell,
} from 'lucide-react';
import { Profile, AppNotification, UserRole } from '../types';
import { NavSection } from './Sidebar';
import { NotificationsDropdown } from './NotificationsDropdown';
import { formatUserRole } from './AccessRestrictedView';

interface HeaderProps {
  currentProfile: Profile;
  activeSection: NavSection;
  onSignOut: () => void;
  onToggleMobileMenu?: () => void;
  onOpenClearanceModal?: () => void;
  pendingClearanceCount?: number;
  onOpenUpload?: () => void;
  notifications: AppNotification[];
  unreadNotificationCount: number;
  onMarkNotificationAsRead: (id: string) => Promise<void>;
}

export const Header: React.FC<HeaderProps> = ({
  currentProfile,
  activeSection,
  onSignOut,
  onToggleMobileMenu,
  onOpenClearanceModal,
  pendingClearanceCount = 0,
  onOpenUpload,
  notifications,
  unreadNotificationCount = 0,
  onMarkNotificationAsRead,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const isVictim = currentProfile.role === 'victim';
  const isLawFirmStaff =
    currentProfile.role === 'workspace_admin' || currentProfile.role === 'attorney';

  const getSectionTitle = (sec: NavSection, role: UserRole) => {
    switch (sec) {
      case 'overview':
        if (role === 'judge') return 'Judge Bench';
        if (role === 'forensic_team') return 'Forensic Workbench';
        if (role === 'victim') return 'Victim Portal';
        if (role === 'investigating_officer') return 'Investigation Command';
        return 'Overview';
      case 'cases':
        if (role === 'victim') return 'Case Status';
        if (role === 'investigating_officer') return 'Assigned Investigations';
        return 'Court Cases';
      case 'matters':
        return 'Matters';
      case 'documents':
        return 'Documents';
      case 'audit':
        return 'Audit Activity';
      case 'restricted':
        return 'Restricted / Confidential';
      case 'notifications':
        return 'Notifications';
    }
  };

  return (
    <header className="bg-white border-b border-stone-200/90 text-slate-800 sticky top-0 z-20 shadow-2xs">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Mobile Toggle & Breadcrumb */}
          <div className="flex items-center space-x-3">
            {onToggleMobileMenu && (
              <button
                onClick={onToggleMobileMenu}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-stone-100 transition cursor-pointer"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* Breadcrumb */}
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-sans">
              <span className="font-semibold text-slate-700 hidden sm:inline">
                {isVictim ? 'Citizen Access' : 'Workspace'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
              <span className="font-bold text-slate-900 font-serif text-sm">
                {getSectionTitle(activeSection, currentProfile.role)}
              </span>
            </div>
          </div>

          {/* Right: Security Indicators, Notification Bell, Clearance Button & User Profile */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            {/* System Status Indicators (Security, No Debug) */}
            {isVictim ? (
              <div className="hidden md:flex items-center space-x-1.5 text-xs bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-800 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Protected Citizen Portal · Active</span>
              </div>
            ) : (
              <>
                <div className="hidden md:flex items-center space-x-2 text-xs bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200 text-slate-600">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Privileged & Confidential · Private Storage</span>
                </div>

                <div className="hidden xl:flex items-center space-x-1.5 text-xs bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-800 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Custodial Ledger: <strong>Active</strong>
                  </span>
                </div>
              </>
            )}

            {/* Notification Bell Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowDropdown(false);
                }}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-stone-100 transition cursor-pointer"
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold font-mono text-white bg-amber-500 rounded-full shadow-xs">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <NotificationsDropdown
                  isOpen={showNotifications}
                  onClose={() => setShowNotifications(false)}
                  notifications={notifications}
                  unreadCount={unreadNotificationCount}
                  onMarkAsRead={onMarkNotificationAsRead}
                />
              )}
            </div>

            {/* Clearance Review Shortcut for Admins/Attorneys only */}
            {onOpenClearanceModal && isLawFirmStaff && (
              <button
                onClick={onOpenClearanceModal}
                className="flex items-center space-x-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 px-3 py-1.5 rounded-xl border border-amber-200 transition cursor-pointer text-xs font-semibold shadow-2xs"
                title="Review pending restricted evidence clearance tickets"
              >
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span className="hidden sm:inline">Clearance Review</span>
                {pendingClearanceCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold font-mono text-[10px] rounded-full">
                    {pendingClearanceCount}
                  </span>
                )}
              </button>
            )}

            {/* Upload Evidence Shortcut for Admins/Attorneys only */}
            {onOpenUpload && isLawFirmStaff && (
              <button
                onClick={onOpenUpload}
                className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-xl transition cursor-pointer text-xs font-semibold shadow-xs"
                title="Upload new legal evidence document"
              >
                <Upload className="w-3.5 h-3.5 text-slate-950" />
                <span className="hidden sm:inline">Upload Evidence</span>
              </button>
            )}

            {/* Authenticated User Avatar & Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowDropdown(!showDropdown);
                  setShowNotifications(false);
                }}
                className="flex items-center space-x-2 bg-stone-50 hover:bg-stone-100 px-2.5 py-1.5 rounded-xl border border-stone-200 transition cursor-pointer"
                title="Current authenticated user profile"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-800 border border-amber-500/30 flex items-center justify-center font-mono text-xs font-bold">
                  {currentProfile.initials}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                    <span>{currentProfile.fullName}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </div>
                  <div className="text-[10px] font-mono text-amber-800 font-medium">
                    {formatUserRole(currentProfile.role)}
                  </div>
                </div>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-stone-200 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-4 py-2.5 border-b border-stone-100 space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <User className="w-3.5 h-3.5 text-amber-600" />
                      <span>Authenticated Identity</span>
                    </div>
                    <div className="font-semibold text-xs text-slate-900 pt-0.5">
                      {currentProfile.fullName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {currentProfile.email}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                        {formatUserRole(currentProfile.role)}
                      </span>
                    </div>
                  </div>

                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        onSignOut();
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer flex items-center gap-2 font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out of Workspace</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
