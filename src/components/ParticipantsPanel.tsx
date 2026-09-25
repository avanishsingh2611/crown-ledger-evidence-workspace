import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Shield,
  Clock,
  AlertTriangle,
  RefreshCw,
  X,
  Loader2,
  CheckCircle2,
  Scale,
  Briefcase,
  Search,
} from 'lucide-react';
import {
  CaseParticipant,
  ParticipantRole,
  Profile,
} from '../types';
import { api, ApiError, AddCaseParticipantInput } from '../services/api';

interface ParticipantsPanelProps {
  caseId: string;
  matterId?: string;
  currentProfile: Profile | null;
  availableProfiles?: Profile[];
  isVictim?: boolean;
  readOnly?: boolean;
}

const ROLE_BADGE_CONFIG: Record<
  ParticipantRole,
  { label: string; bg: string; text: string; border: string }
> = {
  judge: {
    label: 'Presiding Judge',
    bg: 'bg-purple-50',
    text: 'text-purple-900',
    border: 'border-purple-200',
  },
  prosecutor: {
    label: 'Public Prosecutor',
    bg: 'bg-rose-50',
    text: 'text-rose-900',
    border: 'border-rose-200',
  },
  defense_lawyer: {
    label: 'Defense Counsel',
    bg: 'bg-blue-50',
    text: 'text-blue-900',
    border: 'border-blue-200',
  },
  investigating_officer: {
    label: 'Investigating Officer',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-200',
  },
  forensic_examiner: {
    label: 'Forensic Examiner',
    bg: 'bg-teal-50',
    text: 'text-teal-900',
    border: 'border-teal-200',
  },
  victim: {
    label: 'Complainant / Citizen',
    bg: 'bg-indigo-50',
    text: 'text-indigo-900',
    border: 'border-indigo-200',
  },
  auditor: {
    label: 'Independent Auditor',
    bg: 'bg-stone-100',
    text: 'text-stone-800',
    border: 'border-stone-300',
  },
};

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
  caseId,
  currentProfile,
  availableProfiles = [],
  isVictim = false,
  readOnly = false,
}) => {
  const [participants, setParticipants] = useState<CaseParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Participant Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form State
  const [selectedUserId, setSelectedUserId] = useState('');
  const [participantRole, setParticipantRole] = useState<ParticipantRole>('defense_lawyer');
  const [isPrimary, setIsPrimary] = useState(false);

  // Removing state
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadParticipants = useCallback(async () => {
    // VICTIM SAFETY CHECK: Never query complete participant directory for victim users
    if (isVictim || currentProfile?.role === 'victim') {
      setParticipants([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await api.getCaseParticipants(caseId);
      setParticipants(data);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.statusCode === 403) {
        setError('Participant roster access restricted under judicial privacy rules.');
      } else {
        setError('Unable to load case participants. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [caseId, isVictim, currentProfile]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  // Determine permissions
  const canMutateParticipants =
    !readOnly &&
    !isVictim &&
    currentProfile?.role !== 'victim' &&
    currentProfile?.role !== 'auditor' &&
    currentProfile?.role !== 'forensic_team' &&
    (currentProfile?.role === 'workspace_admin' ||
      currentProfile?.role === 'attorney' ||
      currentProfile?.role === 'judge');

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setSubmitError('Please select a system user to assign.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: AddCaseParticipantInput = {
        userId: selectedUserId,
        participantRole,
        isPrimary,
      };

      const added = await api.addCaseParticipant(caseId, payload);
      setParticipants((prev) => [...prev, added]);
      setIsAddModalOpen(false);
      setSelectedUserId('');
      setIsPrimary(false);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSubmitError(err.message || 'Participant assignment rejected by backend.');
      } else {
        setSubmitError('Failed to add participant. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (participantId: string, name?: string) => {
    if (!confirm(`Are you sure you want to remove ${name || 'this participant'} from the court case?`)) {
      return;
    }

    setRemovingId(participantId);
    try {
      await api.removeCaseParticipant(caseId, participantId);
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to remove participant.';
      alert(msg);
    } finally {
      setRemovingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // CITIZEN-SAFE VICTIM VIEW
  // ---------------------------------------------------------------------------
  if (isVictim || currentProfile?.role === 'victim') {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 space-y-4">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-stone-100">
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-serif font-bold text-slate-900">Your Judicial Proceeding</h4>
            <p className="text-xs text-slate-500">Designated judicial bench and authorized court contact.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">Presiding Authority</span>
            <span className="font-semibold text-slate-900 text-sm block">Hon. Justice V. K. Sharma</span>
            <span className="text-[11px] text-slate-500">High Court of Delhi</span>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">Your Legal Representation</span>
            <span className="font-semibold text-slate-900 text-sm block">Designated Legal Aid Counsel</span>
            <span className="text-[11px] text-emerald-700 font-medium">Assigned & Active</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 italic bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
          Note: In accordance with statutory citizen privacy safeguards, other party personnel directories and internal legal rosters remain confidential.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STANDARD ROLE CASE PARTICIPANTS VIEW
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-700" />
              <span>Case Participants Roster</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {participants.length} Assigned
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Designated bench, prosecution, defense, and forensic officers assigned under judicial appointment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadParticipants}
            disabled={loading}
            className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-slate-600 transition cursor-pointer disabled:opacity-50"
            title="Refresh Roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canMutateParticipants && (
            <button
              onClick={() => {
                setSubmitError(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs shadow-xs transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Assign Participant</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          <span className="text-xs font-medium">Loading official participant assignments...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">{error}</span>
            <button
              onClick={loadParticipants}
              className="text-rose-900 underline font-medium hover:text-rose-950 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && participants.length === 0 && (
        <div className="p-8 border border-dashed border-stone-300 rounded-2xl bg-stone-50/60 text-center space-y-2">
          <Users className="w-8 h-8 text-stone-400 mx-auto" />
          <h4 className="text-xs font-bold text-slate-800">No Participants Assigned</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            This court case does not have registered participants yet. Authorized attorneys and administrators can assign judicial officers, examiners, and counsel.
          </p>
          {canMutateParticipants && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-xs transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Initial Participant</span>
            </button>
          )}
        </div>
      )}

      {/* Participants Table / Cards */}
      {!loading && !error && participants.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {participants.map((p) => {
            const roleConf = ROLE_BADGE_CONFIG[p.participantRole] || {
              label: p.participantRole,
              bg: 'bg-stone-100',
              text: 'text-stone-800',
              border: 'border-stone-300',
            };

            const isRemoving = removingId === p.id;

            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-stone-200/90 hover:border-stone-300 p-4 shadow-2xs space-y-3 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xs font-mono shadow-2xs flex-shrink-0">
                      {p.userName
                        ? p.userName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)
                        : 'ID'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-900">
                          {p.userName || `User (${p.userId.slice(0, 8)})`}
                        </h4>
                        {p.isPrimary && (
                          <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${roleConf.bg} ${roleConf.text} ${roleConf.border}`}
                        >
                          {roleConf.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Remove Button for authorized admins/attorneys */}
                  {canMutateParticipants && (
                    <button
                      onClick={() => handleRemove(p.id, p.userName)}
                      disabled={isRemoving}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                      title="Remove participant from case"
                    >
                      {isRemoving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                      ) : (
                        <UserX className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Assigned: {new Date(p.assignedAt).toLocaleDateString()}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase">
                    Role: {p.userRole || 'verified'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ASSIGN PARTICIPANT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-400/30">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-white">Assign Case Participant</h3>
                  <p className="text-[11px] text-slate-400">
                    Add official personnel to this court proceeding
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs">
              {submitError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* User Select */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Select User <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                  required
                >
                  <option value="">-- Choose Profile to Assign --</option>
                  {availableProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.role.toUpperCase()} · {p.title})
                    </option>
                  ))}
                </select>
              </div>

              {/* Participant Role */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  Assigned Case Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={participantRole}
                  onChange={(e) => setParticipantRole(e.target.value as ParticipantRole)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                  required
                >
                  <option value="judge">judge — Presiding Judicial Bench</option>
                  <option value="prosecutor">prosecutor — Public Prosecutor</option>
                  <option value="defense_lawyer">defense_lawyer — Defense Counsel</option>
                  <option value="investigating_officer">investigating_officer — Investigating Officer</option>
                  <option value="forensic_examiner">forensic_examiner — Forensic Expert</option>
                  <option value="victim">victim — Complainant / Citizen</option>
                  <option value="auditor">auditor — Independent Case Auditor</option>
                </select>
              </div>

              {/* Primary Toggle */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Primary Representation / Lead</span>
                    <span className="text-[11px] text-slate-500 block">
                      Mark as designated lead officer for notices and hearings.
                    </span>
                  </div>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={submitting}
                  className="px-3.5 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-slate-700 font-medium transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Assignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
