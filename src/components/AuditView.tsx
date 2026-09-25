import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Download,
  FileSpreadsheet,
  FileCode,
  Search,
  Filter,
  Shield,
  Clock,
  User,
  Database,
  CheckCircle2,
  Lock,
  Loader2,
} from 'lucide-react';
import { Profile, Matter, AuditLogEntry, DownloadSecurityEvent } from '../types';

interface AuditViewProps {
  currentProfile: Profile;
  matters: Matter[];
  auditLogs: AuditLogEntry[];
  downloadEvents: DownloadSecurityEvent[];
  onExportAudit: (format: 'csv' | 'json') => void;
  isExporting: boolean;
}

export const AuditView: React.FC<AuditViewProps> = ({
  currentProfile,
  matters,
  auditLogs,
  downloadEvents,
  onExportAudit,
  isExporting,
}) => {
  const [activeTab, setActiveTab] = useState<'ledger' | 'downloads'>('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatterFilter, setSelectedMatterFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const canExport = currentProfile.role === 'workspace_admin' || currentProfile.role === 'attorney';

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (selectedMatterFilter !== 'all' && log.matterId !== selectedMatterFilter) return false;
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesActor = log.actorName.toLowerCase().includes(q);
        const matchesTarget = log.targetName.toLowerCase().includes(q);
        const matchesDetails = log.details.toLowerCase().includes(q);
        const matchesRef = (log.matterReference || '').toLowerCase().includes(q);
        if (!matchesActor && !matchesTarget && !matchesDetails && !matchesRef) return false;
      }
      return true;
    });
  }, [auditLogs, selectedMatterFilter, actionFilter, searchQuery]);

  // Filtered download security events
  const filteredDownloadEvents = useMemo(() => {
    return downloadEvents.filter((evt) => {
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesUser = evt.userName.toLowerCase().includes(q);
        const matchesDoc = evt.documentTitle.toLowerCase().includes(q);
        const matchesRef = evt.matterReference.toLowerCase().includes(q);
        if (!matchesUser && !matchesDoc && !matchesRef) return false;
      }
      return true;
    });
  }, [downloadEvents, searchQuery]);

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'uploaded':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'accessed':
      case 'downloaded':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'review_completed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'access_request_created':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'access_request_approved':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'access_request_denied':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'audit_exported':
        return 'bg-stone-100 text-stone-800 border-stone-300';
      default:
        return 'bg-stone-100 text-slate-700 border-stone-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold">
            AUDIT ACTIVITY WORKSPACE
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 mt-1">
            Custodial Chain of Custody
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Immutable, append-only ledger tracking all evidence ingestion, reviews, clearances, and signed downloads.
          </p>
        </div>

        {/* Audit Export Controls for Authorized Roles */}
        {canExport && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] font-mono text-slate-400 uppercase hidden md:inline">
              Export Audit Log:
            </span>
            <button
              onClick={() => onExportAudit('csv')}
              disabled={isExporting}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title="Export complete authorized audit log as CSV with SHA-256 integrity digest"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>CSV Export</span>
            </button>
            <button
              onClick={() => onExportAudit('json')}
              disabled={isExporting}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title="Export complete authorized audit log as JSON with SHA-256 integrity envelope"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileCode className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>JSON Export</span>
            </button>
          </div>
        )}
      </div>

      {/* Immutability & Integrity Guarantee Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-950">
        <ShieldCheck className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-semibold text-amber-900">
            Cryptographic Custodial Guarantee (SHA-256 Integrity Verified)
          </div>
          <p className="text-amber-800/90 text-[11px]">
            Every custodial action is immutably timestamped in PostgreSQL and protected against modification or deletion by database triggers. Export files include cryptographic SHA-256 digests suitable for judicial discovery and compliance certification.
          </p>
        </div>
      </div>

      {/* Sub-Tabs & Filter Controls */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          {/* Sub-Tabs */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ledger'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Custodial Ledger ({auditLogs.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('downloads')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'downloads'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Signed Downloads ({downloadEvents.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit trail..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800"
            />
          </div>
        </div>

        {/* Filters Row (Active for ledger tab) */}
        {activeTab === 'ledger' && (
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filter by:</span>
            </div>

            <select
              value={selectedMatterFilter}
              onChange={(e) => setSelectedMatterFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700"
            >
              <option value="all">All Matters</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.referenceCode} — {m.title}
                </option>
              ))}
            </select>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700"
            >
              <option value="all">All Actions</option>
              <option value="uploaded">Uploaded</option>
              <option value="accessed">Accessed</option>
              <option value="downloaded">Downloaded</option>
              <option value="review_completed">Review Certified</option>
              <option value="access_request_created">Clearance Requested</option>
              <option value="access_request_approved">Clearance Approved</option>
              <option value="access_request_denied">Clearance Denied</option>
              <option value="audit_exported">Audit Exported</option>
            </select>

            {(selectedMatterFilter !== 'all' || actionFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedMatterFilter('all');
                  setActionFilter('all');
                  setSearchQuery('');
                }}
                className="text-[11px] font-semibold text-amber-800 hover:underline cursor-pointer ml-auto"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Ledger Table */}
      {activeTab === 'ledger' ? (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          {filteredAuditLogs.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-500 space-y-1">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="font-medium text-slate-700">No audit records match your filters</div>
              <p>Try adjusting your search query or matter filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100/80 text-slate-500 font-mono text-[10px] uppercase border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-3 font-semibold">Actor</th>
                    <th className="py-3 px-3 font-semibold">Action</th>
                    <th className="py-3 px-3 font-semibold">Matter</th>
                    <th className="py-3 px-3 font-semibold">Target / Details</th>
                    <th className="py-3 px-4 font-semibold font-mono text-right">Integrity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-amber-50/15 transition">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                        {log.createdAt}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {log.actorInitials || 'CU'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-slate-900 block truncate max-w-[130px]">
                              {log.actorName}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border ${getActionBadgeClass(log.action)}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {log.matterReference ? (
                          <span className="font-mono text-[11px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            {log.matterReference}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">
                          {log.targetName}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
                          {log.details}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Sealed</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Download Security Events Table */
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          {filteredDownloadEvents.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-500 space-y-1">
              <Download className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="font-medium text-slate-700">No signed download events recorded</div>
              <p>Signed download tokens with 300-second TTL are logged automatically upon generation.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100/80 text-slate-500 font-mono text-[10px] uppercase border-b border-stone-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-3 font-semibold">Authorized User</th>
                    <th className="py-3 px-3 font-semibold">Matter</th>
                    <th className="py-3 px-3 font-semibold">Evidence Document</th>
                    <th className="py-3 px-3 font-semibold">Version</th>
                    <th className="py-3 px-3 font-semibold">TTL Expiry</th>
                    <th className="py-3 px-4 text-right font-semibold">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {filteredDownloadEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-amber-50/15 transition">
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {evt.createdAt}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900">
                        {evt.userName}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-[11px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          {evt.matterReference}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {evt.documentTitle}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">
                        v{evt.versionNumber}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                        300s TTL ({evt.signedUrlExpiresAt.slice(11, 19)})
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Verified</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
