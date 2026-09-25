import React, { useRef, useEffect } from 'react';
import {
  Bell,
  Check,
  Calendar,
  ShieldCheck,
  ArrowRightLeft,
  Scale,
  Lock,
  X,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { AppNotification, NotificationType } from '../types';

interface NotificationsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => Promise<void>;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'hearing_scheduled':
        return <Calendar className="w-4 h-4 text-amber-600" />;
      case 'evidence_submitted':
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case 'custody_transferred':
        return <ArrowRightLeft className="w-4 h-4 text-purple-600" />;
      case 'case_status_updated':
        return <Scale className="w-4 h-4 text-sky-600" />;
      case 'clearance_decided':
        return <Lock className="w-4 h-4 text-indigo-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  const getTypeBadgeClass = (type: NotificationType) => {
    switch (type) {
      case 'hearing_scheduled':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'evidence_submitted':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'custody_transferred':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'case_status_updated':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'clearance_decided':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      default:
        return 'bg-stone-50 text-slate-700 border-stone-200';
    }
  };

  const formatRelativeTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-stone-200/90 py-2.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 select-none"
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bell className="w-4 h-4 text-amber-600" />
          <span className="font-serif font-bold text-sm text-slate-900">Notifications</span>
          {unreadCount > 0 ? (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
              {unreadCount} unread
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-stone-100">
              All read
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-stone-100 transition cursor-pointer"
          aria-label="Close notifications"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Notification List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
        {notifications.length === 0 ? (
          <div className="py-8 px-4 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-xs font-semibold text-slate-700">No Notifications</div>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              You are all caught up. Updates on case proceedings, hearings, and forensic certifications will appear here.
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3.5 transition flex items-start space-x-3 ${
                !n.isRead ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'hover:bg-stone-50'
              }`}
            >
              {/* Type Icon */}
              <div className="p-2 rounded-xl bg-stone-50 border border-stone-200/80 flex-shrink-0 mt-0.5">
                {getTypeIcon(n.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getTypeBadgeClass(
                      n.type
                    )}`}
                  >
                    {n.type.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center text-[10px] text-slate-400 font-mono gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formatRelativeTime(n.createdAt)}</span>
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-900 truncate">{n.title}</div>
                <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                  {n.message}
                </p>

                {/* Mark as read action */}
                {!n.isRead && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => onMarkAsRead(n.id)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 hover:text-emerald-700 bg-amber-50 hover:bg-emerald-50 px-2 py-0.5 rounded-md border border-amber-200 hover:border-emerald-200 transition cursor-pointer"
                      title="Mark as read"
                    >
                      <Check className="w-3 h-3" />
                      <span>Mark Read</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Unread indicator dot */}
              {!n.isRead && (
                <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-1" title="Unread" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50/60 text-[10px] text-slate-400 font-mono text-center">
        Authenticated notifications stream · Real-time verification
      </div>
    </div>
  );
};
