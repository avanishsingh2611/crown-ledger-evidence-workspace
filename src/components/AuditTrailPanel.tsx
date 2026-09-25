import React from 'react';
import {
  Upload,
  UserCheck,
  Eye,
  Tag,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Download,
  Terminal,
  Clock
} from 'lucide-react';
import { AuditLogEntry, DownloadSecurityEvent, AuditActionType } from '../types';

interface AuditTrailPanelProps {
  auditLogs: AuditLogEntry[];
  downloadEvents: DownloadSecurityEvent[];
  onExportAudit?: (format: 'csv' | 'json') => void;
  isExporting?: boolean;
}

export const AuditTrailPanel: React.FC<AuditTrailPanelProps> = ({
  auditLogs,
  downloadEvents,
  onExportAudit,
  isExporting,
}) => {
  const [activeTab, setActiveTab] = React.useState<'audit' | 'downloads'>('audit');

  const getActionBadge = (action: AuditActionType) => {
    switch (action) {
      case 'uploaded':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <Upload className="w-3 h-3 text-emerald-600" />
            <span>uploaded</span>
          </span>
        );
      case 'review_requested':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            <UserCheck className="w-3 h-3 text-amber-600" />
            <span>review requested</span>
          </span>
        );
      case 'accessed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
            <Eye className="w-3 h-3 text-sky-600" />
            <span>accessed</span>
          </span>
        );
      case 'classification_changed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
            <Tag className="w-3 h-3 text-purple-600" />
            <span>classification changed</span>
          </span>
        );
      case 'review_completed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            <span>review completed</span>
          </span>
        );
      case 'audit_exported':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            <Download className="w-3 h-3 text-indigo-600" />
            <span>audit exported</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            <span>{action}</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      {/* Header with Switcher Tabs and Export Button */}
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Custodial Activity & Security Ledger
          </h3>
        </div>

        <div className="flex items-center space-x-2.5">
          {onExportAudit && (
            <div className="flex items-center space-x-1 border border-slate-200 bg-white rounded-lg p-0.5 text-xs shadow-2xs">
              <span className="text-[11px] text-slate-400 font-medium px-1.5 flex items-center gap-1">
                <Download className="w-3 h-3 text-slate-500" />
                <span className="hidden sm:inline">Export:</span>
              </span>
              <button
                type="button"
                onClick={() => onExportAudit('csv')}
                disabled={isExporting}
                className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                title="Export immutable audit trail as CSV for legal discovery"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => onExportAudit('json')}
                disabled={isExporting}
                className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                title="Export signed audit trail as JSON with cryptographic SHA-256 digest"
              >
                JSON
              </button>
            </div>
          )}

          <div className="flex items-center space-x-1 bg-slate-200/70 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Audit Trail ({auditLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('downloads')}
              className={`px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'downloads'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3 h-3 text-amber-600" />
              <span>Signed Downloads ({downloadEvents.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: 5 Screenshot Audit Events */}
      {activeTab === 'audit' && (
        <div className="divide-y divide-slate-100">
          {auditLogs.map((log) => (
            <div key={log.id} className="px-5 py-3.5 hover:bg-slate-50/60 transition-colors flex items-start justify-between text-xs">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  {getActionBadge(log.action)}
                  <span className="font-semibold text-slate-900 font-sans">
                    {log.targetName}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600 font-medium">({log.actorName})</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono pl-0.5">
                  {log.details}
                </div>
              </div>

              <div className="text-right flex-shrink-0 ml-4">
                <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3 text-slate-300" />
                  <span>{log.createdAt}</span>
                </span>
                {log.matterReference && (
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    {log.matterReference}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Signed URL Security Events */}
      {activeTab === 'downloads' && (
        <div className="divide-y divide-slate-100">
          {downloadEvents.map((evt) => (
            <div key={evt.id} className="px-5 py-3.5 hover:bg-slate-50/60 transition-colors flex items-start justify-between text-xs">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <Lock className="w-3 h-3 text-amber-600" />
                    <span>signed url issued</span>
                  </span>
                  <span className="font-semibold text-slate-900">{evt.documentTitle}</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono text-slate-600 text-[11px]">v{evt.versionNumber}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Recipient: <strong className="text-slate-700">{evt.userName}</strong> · Custodial access verified under protective order protocol
                </div>
              </div>

              <div className="text-right flex-shrink-0 ml-4">
                <span className="text-[11px] text-slate-400 font-mono">{evt.createdAt}</span>
                <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                  Token: 300s TTL (Single-use)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Status Bar */}
      <div className="bg-slate-900 text-slate-400 px-5 py-2 text-[11px] font-mono flex items-center justify-between border-t border-slate-800">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          <span>PostgreSQL Trigger `prevent_audit_logs_mutation()` ACTIVE</span>
        </div>
        <span className="text-slate-500">UPDATE / DELETE / TRUNCATE = RESTRICTED</span>
      </div>
    </div>
  );
};
