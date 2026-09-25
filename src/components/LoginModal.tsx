import React, { useState } from 'react';
import { Scale, Lock, ShieldAlert, Loader2, KeyRound, UserCheck, Clock } from 'lucide-react';

interface LoginModalProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  isSessionExpired?: boolean;
}

const AUTHORIZED_PERSONAS = [
  {
    name: 'Eleanor Raines',
    email: 'eleanor.raines@crownledger.internal',
    title: 'Managing Partner · Workspace Admin',
    role: 'Admin',
    badgeClass: 'bg-amber-500/10 text-amber-800 border-amber-300',
  },
  {
    name: 'Elena Marquez',
    email: 'elena.marquez@crownledger.internal',
    title: 'Senior Litigation Associate',
    role: 'Assigned Counsel (MAT-2024-018)',
    badgeClass: 'bg-blue-500/10 text-blue-800 border-blue-300',
  },
  {
    name: 'Darius Cole',
    email: 'darius.cole@crownledger.internal',
    title: 'Discovery Specialist',
    role: 'Assigned Counsel (MAT-2024-022)',
    badgeClass: 'bg-slate-500/10 text-slate-800 border-slate-300',
  },
  {
    name: 'Priya Shah',
    email: 'priya.shah@crownledger.internal',
    title: 'Corporate Counsel',
    role: 'Assigned Counsel (MAT-2024-011)',
    badgeClass: 'bg-indigo-500/10 text-indigo-800 border-indigo-300',
  },
  {
    name: 'Jon Bell',
    email: 'jon.bell@crownledger.internal',
    title: 'Compliance Officer',
    role: 'Assigned Counsel (MAT-2023-044)',
    badgeClass: 'bg-emerald-500/10 text-emerald-800 border-emerald-300',
  },
  {
    name: 'Clara Vance',
    email: 'clara.vance@external-audit.org',
    title: 'External Compliance Auditor',
    role: 'Auditor (Read-Only)',
    badgeClass: 'bg-purple-500/10 text-purple-800 border-purple-300',
  },
  {
    name: 'Hon. Justice V. K. Sharma',
    email: 'justice.sharma@court.gov.in',
    title: 'High Court Judge · Presiding Bench',
    role: 'Judge',
    badgeClass: 'bg-red-500/15 text-red-300 border-red-400/40',
  },
  {
    name: 'Dr. Amitav Sen',
    email: 'forensics.sen@cfsl.gov.in',
    title: 'Chief Forensic Examiner · CFSL',
    role: 'Forensic Team',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40',
  },
  {
    name: 'Ananya Roy',
    email: 'ananya.roy@citizen.org',
    title: 'Complainant / Protected Citizen',
    role: 'Victim',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-400/40',
  },
  {
    name: 'Inspector Rajesh Kumar',
    email: 'officer.kumar@delhipolice.gov.in',
    title: 'Senior Investigating Officer · Cyber Crime Cell',
    role: 'Investigating Officer',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-400/40',
  },
];

export const LoginModal: React.FC<LoginModalProps> = ({ onSignIn, loading, error, isSessionExpired }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setLocalError('Please enter both email address and password.');
      return;
    }
    setLocalError(null);
    try {
      await onSignIn(email.trim(), password);
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleSelectPersona = (personaEmail: string) => {
    setEmail(personaEmail);
    setLocalError(null);
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-slate-100 font-sans">
      <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 mx-auto flex items-center justify-center text-slate-950 font-bold shadow-inner border border-amber-400/40">
            <Scale className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center justify-center space-x-2">
              <h1 className="text-xl font-serif font-bold text-white tracking-wide">
                Crown & Ledger
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-700 font-mono font-medium">
                WORKSPACE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5 font-sans">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>Privileged & Confidential Legal Repository</span>
            </p>
          </div>
        </div>

        {/* Session Expired Alert */}
        {isSessionExpired && (
          <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">Custodial Session Expired:</span>
              <p className="text-amber-200/90 mt-0.5">
                Your secure session has timed out. Please authenticate with Supabase Auth to resume privileged work.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {displayError && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Authentication Error:</span>
              <p className="text-rose-300 mt-0.5">{displayError}</p>
            </div>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Work Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. eleanor.raines@crownledger.internal"
              required
              disabled={loading}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your security password"
              required
              disabled={loading}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating with Supabase Auth...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Sign In to Privileged Repository</span>
              </>
            )}
          </button>
        </form>

        {/* Authorized Firm & SIH Directory (Select to fill email) */}
        <div className="pt-3 border-t border-slate-700/60 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Authorized Firm & Court Personas (Click to Fill Email):</span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
            {AUTHORIZED_PERSONAS.map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => handleSelectPersona(p.email)}
                className={`w-full text-left p-2 rounded-lg text-xs transition border cursor-pointer flex items-center justify-between ${
                  email === p.email
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                    : 'bg-slate-900/60 border-slate-700/50 hover:bg-slate-700/40 text-slate-300'
                }`}
              >
                <div>
                  <div className="font-semibold text-white">{p.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{p.email}</div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${p.badgeClass}`}>
                  {p.role}
                </span>
              </button>
            ))}
          </div>

          <p className="text-[10px] text-slate-500 text-center font-mono pt-1">
            Strict RLS & immutability enforced · All sessions tracked
          </p>
        </div>
      </div>
    </div>
  );
};
