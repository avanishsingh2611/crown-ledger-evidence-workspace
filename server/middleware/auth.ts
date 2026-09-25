import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, AuthUserProfile, UserRole } from '../types';
import { supabaseAdmin } from '../supabase';

export const KNOWN_PROFILES: Record<string, AuthUserProfile> = {
  '11111111-1111-4111-a111-111111111111': {
    id: '11111111-1111-4111-a111-111111111111',
    email: 'eleanor.raines@crownledger.law',
    fullName: 'Eleanor Raines',
    initials: 'ER',
    role: 'workspace_admin',
    title: 'Managing Partner',
    isActive: true,
  },
  '22222222-2222-4222-a222-222222222222': {
    id: '22222222-2222-4222-a222-222222222222',
    email: 'elena.marquez@crownledger.law',
    fullName: 'Elena Marquez',
    initials: 'EM',
    role: 'attorney',
    title: 'Senior Litigation Associate',
    isActive: true,
  },
  '33333333-3333-4333-a333-333333333333': {
    id: '33333333-3333-4333-a333-333333333333',
    email: 'darius.cole@crownledger.law',
    fullName: 'Darius Cole',
    initials: 'DC',
    role: 'attorney',
    title: 'Discovery Specialist',
    isActive: true,
  },
  '44444444-4444-4444-a444-444444444444': {
    id: '44444444-4444-4444-a444-444444444444',
    email: 'priya.shah@crownledger.law',
    fullName: 'Priya Shah',
    initials: 'PS',
    role: 'attorney',
    title: 'Corporate Counsel',
    isActive: true,
  },
  '55555555-5555-4555-a555-555555555555': {
    id: '55555555-5555-4555-a555-555555555555',
    email: 'jon.bell@crownledger.law',
    fullName: 'Jon Bell',
    initials: 'JB',
    role: 'attorney',
    title: 'Compliance Officer',
    isActive: true,
  },
  '66666666-6666-4666-a666-666666666666': {
    id: '66666666-6666-4666-a666-666666666666',
    email: 'clara.vance@external-audit.org',
    fullName: 'Clara Vance',
    initials: 'CV',
    role: 'auditor',
    title: 'External Compliance Auditor',
    isActive: true,
  },
  '77777777-7777-4777-a777-777777777777': {
    id: '77777777-7777-4777-a777-777777777777',
    email: 'justice.sharma@court.gov.in',
    fullName: 'Hon. Justice V. K. Sharma',
    initials: 'VS',
    role: 'judge',
    title: 'Presiding Sessions Judge',
    isActive: true,
  },
  '88888888-8888-4888-a888-888888888888': {
    id: '88888888-8888-4888-a888-888888888888',
    email: 'forensics.sen@cfsl.gov.in',
    fullName: 'Dr. Amitav Sen',
    initials: 'AS',
    role: 'forensic_team',
    title: 'Chief Forensic Cyber Examiner',
    isActive: true,
  },
  '99999999-9999-4999-a999-999999999999': {
    id: '99999999-9999-4999-a999-999999999999',
    email: 'ananya.roy@citizen.org',
    fullName: 'Ananya Roy',
    initials: 'AR',
    role: 'victim',
    title: 'Complainant / Protected Citizen',
    isActive: true,
  },
  'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa': {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    email: 'officer.kumar@delhipolice.gov.in',
    fullName: 'Inspector Rajesh Kumar',
    initials: 'RK',
    role: 'investigating_officer',
    title: 'Senior Investigating Officer · Cyber Crime Cell',
    isActive: true,
  },
};

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    // 1. Production Authentication Flow:
    // Client MUST provide a valid Supabase Auth access token in Authorization: Bearer <token>
    // Client-supplied X-User-Id header is NEVER trusted to establish or alter identity.
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authorization Bearer token required. Please provide a verified Supabase Auth session token.',
      });
      return;
    }

    const token = authHeader.slice(7).trim();
    if (!token || token === 'undefined' || token === 'null') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is empty or invalid.',
      });
      return;
    }

    // 2. Verify access token with Supabase Auth (supabase.auth.getUser)
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !userData?.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token',
      });
      return;
    }

    // 3. User identity comes strictly from Supabase Auth
    const authUser = userData.user;
    const userId = authUser.id;

    // 4. Load user profile and role from the Supabase database
    const { data: dbProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Determine authorization role from verified database profile / Supabase Auth
    let role: UserRole = 'attorney';
    const profileRole = (dbProfile?.role || '').toLowerCase();
    const metaRole = (authUser.user_metadata?.role || '').toLowerCase();

    if (KNOWN_PROFILES[userId]) {
      role = KNOWN_PROFILES[userId].role;
    } else if (profileRole === 'workspace_admin' || profileRole === 'admin' || metaRole === 'workspace_admin') {
      role = 'workspace_admin';
    } else if (profileRole === 'judge' || metaRole === 'judge') {
      role = 'judge';
    } else if (profileRole === 'forensic_team' || metaRole === 'forensic_team') {
      role = 'forensic_team';
    } else if (profileRole === 'investigating_officer' || metaRole === 'investigating_officer') {
      role = 'investigating_officer';
    } else if (profileRole === 'victim' || metaRole === 'victim') {
      role = 'victim';
    } else if (profileRole === 'auditor' || metaRole === 'auditor') {
      role = 'auditor';
    } else if (profileRole === 'reviewer' || metaRole === 'reviewer') {
      role = 'reviewer';
    } else if (profileRole === 'attorney' || profileRole === 'lawyer' || metaRole === 'attorney') {
      role = 'attorney';
    }

    const known = KNOWN_PROFILES[userId];
    const fullName = dbProfile?.name || authUser.user_metadata?.full_name || known?.fullName || 'Authorized Member';
    const initials =
      known?.initials ||
      fullName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const title =
      known?.title ||
      (role === 'workspace_admin'
        ? 'Managing Partner'
        : role === 'auditor'
        ? 'External Compliance Auditor'
        : role === 'judge'
        ? 'Presiding Sessions Judge'
        : role === 'forensic_team'
        ? 'Chief Forensic Cyber Examiner'
        : role === 'investigating_officer'
        ? 'Senior Investigating Officer · Cyber Crime Cell'
        : role === 'victim'
        ? 'Complainant / Protected Citizen'
        : authUser.user_metadata?.title || 'Senior Litigation Associate');

    // Attach verified identity to request context
    // Client-supplied X-User-Id header cannot overwrite or alter this identity.
    req.user = {
      id: userId,
      email: authUser.email || dbProfile?.email || known?.email || '',
      fullName,
      initials,
      role,
      title,
      isActive: dbProfile?.status ? dbProfile.status === 'ACTIVE' : true,
    };

    return next();
  } catch (error) {
    console.error('Error in auth middleware:', error);
    res.status(401).json({
      error: 'Authentication failed',
      details: 'Unable to verify credentials against Supabase Auth',
    });
  }
}
