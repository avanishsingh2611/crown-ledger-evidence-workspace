/*
 * Crown & Ledger Evidence Workspace
 * Copyright © 2026 Avanish Singh
 * Author: Avanish Singh
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavSection } from './components/Sidebar';
import { OverviewView } from './components/OverviewView';
import { MattersView } from './components/MattersView';
import { DocumentsView } from './components/DocumentsView';
import { AuditView } from './components/AuditView';
import { RestrictedView } from './components/RestrictedView';
import { LoginModal } from './components/LoginModal';
import { DocumentModal } from './components/DocumentModal';
import { DownloadModal } from './components/DownloadModal';
import { ConfidentialPasswordModal } from './components/ConfidentialPasswordModal';
import { UploadModal } from './components/UploadModal';
import { RestrictedAccessModal } from './components/RestrictedAccessModal';
import { AccessRequestsReviewModal } from './components/AccessRequestsReviewModal';
import { AccessRestrictedView } from './components/AccessRestrictedView';
import { CasesView } from './components/CasesView';
import { JudgeBenchView } from './components/JudgeBenchView';
import { ForensicWorkbenchView } from './components/ForensicWorkbenchView';
import { InvestigatingOfficerView } from './components/InvestigatingOfficerView';
import {
  Profile,
  Matter,
  EvidenceDocument,
  DocumentVersion,
  DocumentReviewStatus,
  DocumentClassification,
  AuditLogEntry,
  DownloadSecurityEvent,
  AppNotification,
  UserRole,
} from './types';
import { api, ApiError } from './services/api';
import { supabase, getSupabaseSession } from './services/supabase';
import { ShieldAlert, RefreshCw, Loader2, CheckCircle2, AlertTriangle, X, Scale } from 'lucide-react';

const ROLE_ALLOWED_SECTIONS: Record<UserRole, NavSection[]> = {
  workspace_admin: ['overview', 'cases', 'matters', 'documents', 'audit', 'restricted', 'notifications'],
  attorney: ['overview', 'cases', 'matters', 'documents', 'audit', 'restricted', 'notifications'],
  auditor: ['overview', 'cases', 'matters', 'documents', 'audit', 'restricted', 'notifications'],
  judge: ['overview', 'cases', 'notifications'],
  forensic_team: ['overview', 'cases', 'notifications'],
  victim: ['overview', 'cases', 'notifications'],
  reviewer: ['overview', 'cases', 'matters', 'documents', 'notifications'],
  investigating_officer: ['overview', 'cases', 'notifications'],
};

export default function App() {
  // Profiles & Auth state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Application Data state (sourced from Express + PostgreSQL backend)
  const [matters, setMatters] = useState<Matter[]>([]);
  const [documents, setDocuments] = useState<EvidenceDocument[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [downloadEvents, setDownloadEvents] = useState<DownloadSecurityEvent[]>([]);
  const [dbStats, setDbStats] = useState<{
    totalDocuments: number;
    needsReview: number;
    reviewed: number;
    restricted: number;
  } | null>(null);

  // Navigation state (5 Segregated Workspaces)
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Application UI states
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [securityNotification, setSecurityNotification] = useState<{
    title: string;
    message: string;
    type: 'error' | 'warning' | 'success';
  } | null>(null);

  // Synchronization and lifecycle locks to prevent infinite useEffect loops
  const isInitializingRef = useRef(false);
  const currentProfileRef = useRef<Profile | null>(null);
  currentProfileRef.current = currentProfile;

  // Filters state (for Documents workspace)
  const [selectedMatterId, setSelectedMatterId] = useState<string | 'all'>('all');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<DocumentReviewStatus | 'all'>('all');
  const [classificationFilter, setClassificationFilter] = useState<DocumentClassification | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all');
  const [sha256SearchQuery, setSha256SearchQuery] = useState<string>('');
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isExportingAudit, setIsExportingAudit] = useState(false);

  // Modals state
  const [selectedDocument, setSelectedDocument] = useState<EvidenceDocument | null>(null);
  const [downloadModalDoc, setDownloadModalDoc] = useState<EvidenceDocument | null>(null);
  const [downloadModalVersion, setDownloadModalVersion] = useState<DocumentVersion | null>(null);
  const [confidentialModalDoc, setConfidentialModalDoc] = useState<{
    doc: EvidenceDocument;
    version: DocumentVersion;
  } | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [restrictedRequestDoc, setRestrictedRequestDoc] = useState<EvidenceDocument | null>(null);
  const [isClearanceReviewModalOpen, setIsClearanceReviewModalOpen] = useState(false);
  const [pendingClearanceCount, setPendingClearanceCount] = useState(0);

  // Notifications state (SIH stream & unread count)
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Judge Bench selected case tracking
  const [selectedJudgeCaseId, setSelectedJudgeCaseId] = useState<string | null>(null);

  /**
   * Loads core application data from backend
   */
  const loadWorkspaceData = useCallback(async () => {
    setGlobalError(null);
    const role = currentProfileRef.current?.role;

    // VICTIM SAFETY: Victims do not participate in internal legal document repository
    if (role === 'victim') {
      setMatters([]);
      setDocuments([]);
      setAuditLogs([]);
      setDownloadEvents([]);
      setDbStats(null);
      return;
    }

    const [fetchedMatters, fetchedDocs, fetchedLogs, fetchedDownloads, fetchedStats] = await Promise.all([
      api.getMatters().catch(() => []),
      api.getDocuments().catch(() => []),
      api.getAuditLogs({ limit: 50 }).catch(() => []),
      api.getDownloadSecurityEvents().catch(() => []),
      api.getStats().catch((err) => {
        console.warn('Non-fatal stats loading failure:', err);
        return null;
      }),
    ]);

    setMatters(fetchedMatters);
    setDocuments(fetchedDocs);
    setAuditLogs(fetchedLogs);
    setDownloadEvents(fetchedDownloads);
    if (fetchedStats) {
      setDbStats({
        totalDocuments: fetchedStats.totalDocuments,
        needsReview: fetchedStats.needsReview,
        reviewed: fetchedStats.reviewed,
        restricted: fetchedStats.restricted,
      });
    }

    // Check pending clearance tickets for authorized admins/attorneys (non-blocking)
    if (role === 'workspace_admin' || role === 'attorney') {
      api.getRestrictedAccessRequests({ status: 'pending' })
        .then((reqs) => setPendingClearanceCount(reqs.length))
        .catch(() => {});
    }
  }, []);

  /**
   * Loads notifications from verified backend /api/notifications
   */
  const loadNotifications = useCallback(async () => {
    if (!currentProfileRef.current) return;
    try {
      const res = await api.getNotifications({ limit: 30 });
      setNotifications(res.notifications);
      setUnreadNotificationCount(res.unreadCount);
    } catch (err) {
      console.debug('Notification refresh notice:', err);
    }
  }, []);

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Notification polling effect (refreshes every 35 seconds without WebSockets)
  useEffect(() => {
    if (!currentProfile) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 35000);
    return () => clearInterval(interval);
  }, [currentProfile, loadNotifications]);

  /**
   * Initial Session Check:
   * 1. On application startup, Supabase Auth checks for the existing session.
   * 2. If NO session:
   *    - stop loading state
   *    - show LoginModal
   *    - do NOT call protected workspace APIs.
   * 3. If valid session:
   *    - obtain authenticated Supabase user
   *    - call GET /api/auth/me with Bearer token
   *    - load authorized workspace data
   *    - set loading=false after successful completion
   *    - render Evidence Workspace.
   * 4. If any initialization API call fails:
   *    - DO NOT leave application permanently stuck on loading screen
   *    - set loading=false
   *    - display clear error state with retry option.
   */
  const initializeWorkspace = useCallback(async () => {
    // Prevent overlapping/concurrent execution
    if (isInitializingRef.current) {
      console.debug('Workspace initialization already in flight, skipping duplicate call');
      return;
    }

    isInitializingRef.current = true;

    try {
      setLoading(true);
      setGlobalError(null);
      setAuthError(null);
      setInitError(null);

      // Step 1: Check existing Supabase Auth session with timeout
      const session = await getSupabaseSession();
      if (!session?.access_token) {
        // Visitor is unauthenticated. Do not call protected endpoints.
        setCurrentProfile(null);
        return;
      }

      // Step 2: Valid session found: verify identity with backend
      const { user, availableProfiles } = await api.getCurrentUser();
      setProfiles(availableProfiles);
      setCurrentProfile(user);

      // Step 3: Fetch live workspace data from backend
      await loadWorkspaceData();
    } catch (err: any) {
      console.error('Initialization error:', err);
      if (err instanceof ApiError && err.statusCode === 401) {
        // Stale or invalid session: clear and show login screen
        try {
          await api.signOut();
        } catch {
          // ignore
        }
        setCurrentProfile(null);
      } else {
        const errorMsg = err?.message || 'Error connecting to Crown & Ledger backend API.';
        setInitError(errorMsg);
        setGlobalError(errorMsg);
      }
    } finally {
      setLoading(false);
      isInitializingRef.current = false;
    }
  }, [loadWorkspaceData]);

  useEffect(() => {
    // 1. Initial check on mount
    initializeWorkspace();

    // 2. Listen to real-time auth changes from Supabase Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.debug(`Supabase Auth state changed: ${event}`);

      if (event === 'SIGNED_OUT' || !session) {
        setCurrentProfile(null);
        setMatters([]);
        setDocuments([]);
        setAuditLogs([]);
        setDownloadEvents([]);
        setDbStats(null);
        setSelectedDocument(null);
        setDownloadModalDoc(null);
        setDownloadModalVersion(null);
        setNotifications([]);
        setUnreadNotificationCount(0);
        setInitError(null);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        console.debug('Supabase Auth session token refreshed');
      } else if (event === 'SIGNED_IN') {
        // Only trigger initialization if there is no active profile and not already initializing
        if (!currentProfileRef.current && !isInitializingRef.current) {
          initializeWorkspace();
        }
      }
    });

    // 3. Listen to custom session expired event from API client
    const handleSessionExpired = () => {
      setIsSessionExpired(true);
      setCurrentProfile(null);
      setMatters([]);
      setDocuments([]);
      setAuditLogs([]);
      setDownloadEvents([]);
      setDbStats(null);
      setSelectedDocument(null);
      setDownloadModalDoc(null);
      setDownloadModalVersion(null);
      setNotifications([]);
      setUnreadNotificationCount(0);
      setInitError(null);
      setLoading(false);
    };

    window.addEventListener('crownledger:session-expired', handleSessionExpired);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('crownledger:session-expired', handleSessionExpired);
    };
  }, [initializeWorkspace]);

  /**
   * Handles user sign in via Supabase Auth credentials.
   */
  const handleSignIn = async (email: string, password: string) => {
    try {
      setAuthSubmitting(true);
      setAuthError(null);
      setInitError(null);
      setSecurityNotification(null);

      // Lock initialization flag so onAuthStateChange doesn't race with sign-in flow
      isInitializingRef.current = true;

      const { user, availableProfiles } = await api.signIn(email, password);
      setIsSessionExpired(false);
      setCurrentProfile(user);
      setProfiles(availableProfiles);
      setActiveSection('overview');

      // Load workspace data with newly authenticated role
      await loadWorkspaceData();

      setSecurityNotification({
        title: 'Session Authenticated via Supabase Auth',
        message: `Active identity verified as ${user.fullName} (${user.title} · ${user.role}).`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Failed to sign in:', err);
      const msg = err?.message || 'Failed to authenticate with Supabase Auth.';
      setAuthError(msg);
      throw err;
    } finally {
      setAuthSubmitting(false);
      isInitializingRef.current = false;
    }
  };

  /**
   * Handles user sign out
   */
  const handleSignOut = async () => {
    try {
      await api.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setCurrentProfile(null);
      setMatters([]);
      setDocuments([]);
      setAuditLogs([]);
      setDownloadEvents([]);
      setDbStats(null);
      setNotifications([]);
      setUnreadNotificationCount(0);
      setInitError(null);
      setSecurityNotification({
        title: 'Signed Out',
        message: 'You have been securely signed out of Crown & Ledger.',
        type: 'success',
      });
    }
  };

  // Search & filter live synchronization with GET /api/documents/search and GET /api/documents
  useEffect(() => {
    if (!currentProfile || loading) return;
    if (currentProfile.role === 'victim') return; // Victim does not query document repository

    const isSearchActive = searchQuery.trim().length > 0 || sha256SearchQuery.trim().length > 0;

    if (isSearchActive) {
      const timer = setTimeout(async () => {
        try {
          const results = await api.searchDocuments(searchQuery, {
            matterId: selectedMatterId,
            classification: classificationFilter,
            reviewStatus: reviewStatusFilter,
            sha256Hash: sha256SearchQuery,
            fileType: fileTypeFilter,
          });
          setDocuments(results);
        } catch (err) {
          console.error('Failed to execute search:', err);
        }
      }, 250);
      return () => clearTimeout(timer);
    } else {
      api.getDocuments({
        matterId: selectedMatterId,
        classification: classificationFilter,
        reviewStatus: reviewStatusFilter,
        fileType: fileTypeFilter,
      }).then(setDocuments).catch((err) => {
        console.error('Failed to fetch filtered documents:', err);
      });
    }
  }, [
    searchQuery,
    sha256SearchQuery,
    fileTypeFilter,
    selectedMatterId,
    classificationFilter,
    reviewStatusFilter,
    currentProfile,
    loading,
  ]);

  /**
   * Filtered documents memoized for instant client response
   */
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Matter filter
      if (selectedMatterId !== 'all' && doc.matterId !== selectedMatterId) {
        return false;
      }
      // Review status filter
      if (reviewStatusFilter !== 'all' && doc.reviewStatus !== reviewStatusFilter) {
        return false;
      }
      // Classification filter
      if (classificationFilter !== 'all' && doc.classification !== classificationFilter) {
        return false;
      }
      // File type filter
      if (fileTypeFilter !== 'all') {
        const ext = doc.currentVersion.originalFilename.split('.').pop()?.toLowerCase() || '';
        const mime = doc.currentVersion.mimeType.toLowerCase();
        if (fileTypeFilter === 'image') {
          if (!['png', 'jpg', 'jpeg', 'tiff', 'tif'].includes(ext) && !mime.startsWith('image/')) return false;
        } else if (ext !== fileTypeFilter && !mime.includes(fileTypeFilter)) {
          return false;
        }
      }
      // SHA-256 Checksum filter
      if (sha256SearchQuery.trim() !== '') {
        const targetHash = sha256SearchQuery.trim().toLowerCase();
        const matchesCurrent = doc.currentVersion.sha256Checksum.toLowerCase().includes(targetHash);
        const matchesAll = (doc.allVersions || []).some((v) => v.sha256Checksum.toLowerCase().includes(targetHash));
        if (!matchesCurrent && !matchesAll) return false;
      }
      // Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesTitle = doc.title.toLowerCase().includes(query);
        const matchesRef = doc.matterReference.toLowerCase().includes(query);
        const matchesFile = doc.currentVersion.originalFilename.toLowerCase().includes(query);
        const matchesTags = (doc.tags || []).some((t) => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesRef && !matchesFile && !matchesTags) {
          return false;
        }
      }
      return true;
    });
  }, [documents, selectedMatterId, reviewStatusFilter, classificationFilter, searchQuery, fileTypeFilter, sha256SearchQuery]);

  /**
   * Navigation helper for jumping between sections with optional filter settings
   */
  const handleNavigate = (section: NavSection, filter?: { reviewStatus?: string }) => {
    setActiveSection(section);
    if (filter?.reviewStatus) {
      setReviewStatusFilter(filter.reviewStatus as DocumentReviewStatus);
    }
  };

  /**
   * Handlers
   */
  const handleSelectDocument = async (doc: EvidenceDocument) => {
    setSelectedDocument(doc);
    try {
      const [fullDoc, versions] = await Promise.all([
        api.getDocument(doc.id),
        api.getDocumentVersions(doc.id).catch(() => doc.allVersions),
      ]);
      if (versions && versions.length > 0) {
        fullDoc.allVersions = versions;
      }
      setSelectedDocument(fullDoc);
    } catch (err: any) {
      console.error('Failed to load document details from backend:', err);
      if (err instanceof ApiError && err.statusCode === 403) {
        setSecurityNotification({
          title: 'Access Restricted',
          message: err.message || 'You do not have clearance to view this document.',
          type: 'error',
        });
      }
    }
  };

  const handleOpenDownload = (doc: EvidenceDocument, version?: DocumentVersion) => {
    const targetVersion = version || doc.currentVersion;
    const isConfidentialOrRestricted =
      doc.classification.toLowerCase() === 'confidential' ||
      doc.classification.toLowerCase() === 'restricted';

    if (isConfidentialOrRestricted) {
      setConfidentialModalDoc({ doc, version: targetVersion });
    } else {
      setDownloadModalDoc(doc);
      setDownloadModalVersion(targetVersion);
    }
  };

  /**
   * Verified confidential download handler with password gate
   */
  const handleVerifyConfidentialDownload = async (
    doc: EvidenceDocument,
    version: DocumentVersion,
    password: string
  ) => {
    const payload = await api.generateSignedDownloadUrl(
      doc.id,
      version.versionNumber,
      300,
      password
    );

    // Trigger download of the actual PDF file
    const link = document.createElement('a');
    link.href = payload.signedUrl;
    link.download = version.originalFilename || `${doc.title}.pdf`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const newEvent: DownloadSecurityEvent = {
      id: payload.securityEventId || `evt-${Date.now()}`,
      documentId: doc.id,
      documentTitle: doc.title,
      versionNumber: version.versionNumber,
      userId: currentProfile?.id || '',
      userName: currentProfile?.fullName || 'Authorized User',
      matterReference: doc.matterReference,
      actionType: 'signed_url_generated',
      signedUrlExpiresAt: payload.expiresAt,
      downloadVerified: true,
      createdAt: 'Just now',
    };
    setDownloadEvents((prev) => [newEvent, ...prev]);

    const newAuditLog: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      actorId: currentProfile?.id || '',
      actorName: currentProfile?.fullName || 'Authorized User',
      actorInitials: currentProfile?.initials || 'CU',
      matterId: doc.matterId,
      matterReference: doc.matterReference,
      documentId: doc.id,
      action: 'accessed',
      targetName: doc.title,
      details: `Signed URL issued for v${version.versionNumber} (300s TTL) · Confidential access granted · ${currentProfile?.fullName}`,
      metadata: { version: version.versionNumber, expiresAt: payload.expiresAt },
      createdAt: 'Just now',
    };
    setAuditLogs((prev) => [newAuditLog, ...prev]);

    api.getAuditLogs({ limit: 50 }).then(setAuditLogs).catch(() => {});
    api.getDownloadSecurityEvents().then(setDownloadEvents).catch(() => {});

    setConfidentialModalDoc(null);
  };

  /**
   * Real backend signed URL generation with private storage token
   */
  const handleConfirmDownload = async (
    doc: EvidenceDocument,
    version: DocumentVersion
  ): Promise<{ signedUrl: string; expiresAt: string }> => {
    try {
      const payload = await api.generateSignedDownloadUrl(doc.id, version.versionNumber, 300);

      const newEvent: DownloadSecurityEvent = {
        id: payload.securityEventId || `evt-${Date.now()}`,
        documentId: doc.id,
        documentTitle: doc.title,
        versionNumber: version.versionNumber,
        userId: currentProfile?.id || '',
        userName: currentProfile?.fullName || 'Authorized User',
        matterReference: doc.matterReference,
        actionType: 'signed_url_generated',
        signedUrlExpiresAt: payload.expiresAt,
        downloadVerified: true,
        createdAt: 'Just now',
      };
      setDownloadEvents((prev) => [newEvent, ...prev]);

      const newAuditLog: AuditLogEntry = {
        id: `audit-${Date.now()}`,
        actorId: currentProfile?.id || '',
        actorName: currentProfile?.fullName || 'Authorized User',
        actorInitials: currentProfile?.initials || 'CU',
        matterId: doc.matterId,
        matterReference: doc.matterReference,
        documentId: doc.id,
        action: 'accessed',
        targetName: doc.title,
        details: `Signed URL issued for v${version.versionNumber} (300s TTL) · ${currentProfile?.fullName}`,
        metadata: { version: version.versionNumber, expiresAt: payload.expiresAt },
        createdAt: 'Just now',
      };
      setAuditLogs((prev) => [newAuditLog, ...prev]);

      api.getAuditLogs({ limit: 50 }).then(setAuditLogs).catch(() => {});
      api.getDownloadSecurityEvents().then(setDownloadEvents).catch(() => {});

      return {
        signedUrl: payload.signedUrl,
        expiresAt: payload.expiresAt,
      };
    } catch (err: any) {
      console.error('Download permission check failed:', err);
      if (err instanceof ApiError && err.statusCode === 403) {
        setSecurityNotification({
          title: 'Ethical Wall / Access Restricted',
          message: err.message,
          type: 'error',
        });
      }
      throw err;
    }
  };

  /**
   * Certifies/completes review for a document on the backend
   */
  const handleCompleteReview = async (
    doc: EvidenceDocument,
    status: 'reviewed' | 'restricted' = 'reviewed',
    notes?: string
  ) => {
    if (!currentProfile) return;

    try {
      const decisionNotes = notes || `Review determination (${status}) certified by ${currentProfile.fullName} (${currentProfile.title}).`;
      const result = await api.certifyReview(doc.id, decisionNotes, status);

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === doc.id
            ? {
                ...d,
                reviewStatus: status,
                reviewRecord: {
                  id: result.reviewRecord?.id || `rev-${Date.now()}`,
                  documentId: doc.id,
                  documentVersionId: doc.currentVersion.id,
                  assignedToId: currentProfile.id,
                  assignedToName: currentProfile.fullName,
                  requestedById: d.createdBy,
                  requestedByName: d.creatorName,
                  status: 'completed',
                  decisionNotes,
                  completedAt: new Date().toISOString(),
                  createdAt: d.createdAt,
                },
              }
            : d
        )
      );

      api.getStats().then((s) =>
        setDbStats({
          totalDocuments: s.totalDocuments,
          needsReview: s.needsReview,
          reviewed: s.reviewed,
          restricted: s.restricted,
        })
      ).catch(() => {});

      api.getAuditLogs({ limit: 50 }).then(setAuditLogs).catch(() => {});

      setSecurityNotification({
        title: 'Review Certified',
        message: `Document "${doc.title}" certified and sealed on custodial ledger.`,
        type: 'success',
      });

      setSelectedDocument(null);
    } catch (err: any) {
      console.error('Failed to complete review:', err);
      setSecurityNotification({
        title: 'Review Certification Error',
        message: err?.message || 'You do not have clearance to certify reviews on this matter.',
        type: 'error',
      });
    }
  };

  /**
   * Called when evidence file upload successfully registers a document in the database
   */
  const handleEvidenceUploaded = (newDoc: EvidenceDocument) => {
    setIsUploadModalOpen(false);
    setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
    setActiveSection('documents');
    loadWorkspaceData();
    setSecurityNotification({
      title: 'Evidence Successfully Registered',
      message: `"${newDoc.title}" sealed in matter ${newDoc.matterReference} with cryptographic SHA-256 custody verification.`,
      type: 'success',
    });
  };

  /**
   * Resets all search, matter, classification, file type, and hash filters
   */
  const handleClearFilters = () => {
    setSelectedMatterId('all');
    setReviewStatusFilter('all');
    setClassificationFilter('all');
    setSearchQuery('');
    setSha256SearchQuery('');
    setFileTypeFilter('all');
  };

  /**
   * Secure audit log export with cryptographic SHA-256 integrity verification
   */
  const handleExportAudit = async (format: 'csv' | 'json') => {
    try {
      setIsExportingAudit(true);
      const { blob, filename, integrityHash } = await api.exportAuditLogs(format, selectedMatterId);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      api.getAuditLogs({ limit: 50 }).then(setAuditLogs).catch(() => {});

      setSecurityNotification({
        title: 'Custodial Audit Trail Exported',
        message: `Exported ${filename} (${format.toUpperCase()}) with cryptographic SHA-256 integrity digest: ${integrityHash.slice(0, 16)}...`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Failed to export audit trail:', err);
      setSecurityNotification({
        title: 'Audit Export Denied',
        message: err?.message || 'You do not have authorization to export this audit history.',
        type: 'error',
      });
    } finally {
      setIsExportingAudit(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1128] flex flex-col items-center justify-center text-white px-4">
        <div className="flex flex-col items-center space-y-4 text-center max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-serif font-bold text-white tracking-wide">
              Crown & Ledger Evidence Workspace
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Verifying credentials with Supabase Auth & loading database records...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Database / Auth Initialization Error State with Retry option (Requirement 4)
  if (initError && !currentProfile) {
    return (
      <div className="min-h-screen bg-[#0A1128] flex flex-col items-center justify-center text-white px-4">
        <div className="flex flex-col items-center space-y-5 text-center max-w-md w-full bg-slate-900/90 border border-rose-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/10 text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-serif font-bold text-white tracking-wide">
              Crown & Ledger Evidence Workspace
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Unable to initialize secure workspace session
            </p>
            <div className="mt-3 p-3 bg-rose-950/50 border border-rose-800/50 rounded-xl text-left">
              <span className="text-[11px] font-semibold text-rose-300 block mb-0.5">Database / Network Error:</span>
              <p className="text-xs text-rose-200/90 font-mono break-words leading-relaxed">{initError}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full pt-2">
            <button
              onClick={() => initializeWorkspace()}
              className="w-full sm:flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Initialization</span>
            </button>
            <button
              onClick={async () => {
                setInitError(null);
                setGlobalError(null);
                try {
                  await api.signOut();
                } catch {
                  // ignore
                }
              }}
              className="w-full sm:w-auto py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer border border-slate-700"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <LoginModal
        onSignIn={handleSignIn}
        loading={authSubmitting}
        error={authError || globalError}
        isSessionExpired={isSessionExpired}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900 font-sans antialiased flex flex-row">
      {/* Fixed Left Sidebar Navigation */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        currentProfile={currentProfile}
        onSignOut={handleSignOut}
        pendingClearanceCount={pendingClearanceCount}
        unreadNotificationCount={unreadNotificationCount}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#FAF9F6]">
        {/* Top Header Shell */}
        <Header
          currentProfile={currentProfile}
          activeSection={activeSection}
          onSignOut={handleSignOut}
          onToggleMobileMenu={() => setIsMobileNavOpen(true)}
          onOpenClearanceModal={() => setIsClearanceReviewModalOpen(true)}
          pendingClearanceCount={pendingClearanceCount}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          notifications={notifications}
          unreadNotificationCount={unreadNotificationCount}
          onMarkNotificationAsRead={handleMarkNotificationRead}
        />

        {/* Security & Access Restriction Notification Banner */}
        {securityNotification && (
          <div
            className={`px-4 py-3 border-b flex items-center justify-between text-xs transition animate-in fade-in duration-200 ${
              securityNotification.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : securityNotification.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-emerald-50 text-emerald-900 border-emerald-200'
            }`}
          >
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {securityNotification.type === 'error' ? (
                  <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                ) : securityNotification.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                )}
                <div>
                  <strong className="font-semibold">{securityNotification.title}: </strong>
                  <span>{securityNotification.message}</span>
                </div>
              </div>
              <button
                onClick={() => setSecurityNotification(null)}
                className="p-1 rounded-md hover:bg-black/5 text-slate-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {globalError && (
          <div className="bg-rose-600 text-white text-xs px-4 py-2.5 flex items-center justify-between shadow-xs">
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4" />
                <span>{globalError}</span>
              </div>
              <button
                onClick={() => initializeWorkspace()}
                className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded font-medium flex items-center gap-1 transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Segregated Workspace Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!ROLE_ALLOWED_SECTIONS[currentProfile.role]?.includes(activeSection) ? (
            <AccessRestrictedView
              currentProfile={currentProfile}
              areaTitle={activeSection.toUpperCase()}
              onReturnToOverview={() => setActiveSection('overview')}
            />
          ) : (
            <>
              {activeSection === 'overview' && (
                currentProfile.role === 'judge' ? (
                  <JudgeBenchView
                    currentProfile={currentProfile}
                    onNavigateToCase={(caseId) => {
                      setSelectedJudgeCaseId(caseId);
                      setActiveSection('cases');
                    }}
                    onNavigateToCases={() => {
                      setSelectedJudgeCaseId(null);
                      setActiveSection('cases');
                    }}
                    onNavigateToNotifications={() => setActiveSection('notifications')}
                    unreadNotificationCount={unreadNotificationCount}
                    onSelectDocument={handleSelectDocument}
                  />
                ) : currentProfile.role === 'forensic_team' ? (
                  <ForensicWorkbenchView
                    currentProfile={currentProfile}
                    availableProfiles={profiles}
                    matters={matters}
                    documents={documents}
                    onNavigateToNotifications={() => setActiveSection('notifications')}
                    unreadNotificationCount={unreadNotificationCount}
                    onSelectDocument={handleSelectDocument}
                  />
                ) : currentProfile.role === 'investigating_officer' ? (
                  <InvestigatingOfficerView
                    currentProfile={currentProfile}
                    availableProfiles={profiles}
                    matters={matters}
                    documents={documents}
                    onNavigateToNotifications={() => setActiveSection('notifications')}
                    unreadNotificationCount={unreadNotificationCount}
                    onSelectDocument={handleSelectDocument}
                  />
                ) : (
                  <OverviewView
                    currentProfile={currentProfile}
                    matters={matters}
                    documents={documents}
                    auditLogs={auditLogs}
                    dbStats={dbStats}
                    onNavigate={handleNavigate}
                    onOpenUpload={() => setIsUploadModalOpen(true)}
                    onSelectDocument={handleSelectDocument}
                  />
                )
              )}

              {activeSection === 'cases' && (
                <CasesView
                  currentProfile={currentProfile}
                  availableProfiles={profiles}
                  matters={matters}
                  documents={documents}
                  onSelectDocument={handleSelectDocument}
                  initialCaseId={selectedJudgeCaseId}
                  onClearSelectedCase={() => setSelectedJudgeCaseId(null)}
                />
              )}

              {activeSection === 'notifications' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold">
                        COMMUNICATION STREAM
                      </div>
                      <h1 className="text-2xl font-serif font-bold text-slate-900 mt-1">
                        Notifications Center ({notifications.length})
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                        Direct notices for case hearings, evidence custody handovers, and forensic certifications.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs divide-y divide-stone-100 overflow-hidden">
                    {notifications.length === 0 ? (
                      <div className="p-12 text-center space-y-2">
                        <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
                        <h3 className="text-sm font-bold text-slate-800">No Notifications</h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          You are completely up to date. You will receive notifications when hearings are scheduled, custody transfers occur, or forensic reports are finalized.
                        </p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition ${
                            !n.isRead ? 'bg-amber-50/20' : 'hover:bg-stone-50/50'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-stone-100 text-slate-700 border border-stone-200">
                                {n.type.replace(/_/g, ' ')}
                              </span>
                              {!n.isRead && (
                                <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold font-mono text-[9px] rounded-full">
                                  NEW
                                </span>
                              )}
                              <span className="text-xs text-slate-400 font-mono">
                                {new Date(n.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900">{n.title}</h4>
                            <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                          </div>

                          {!n.isRead && (
                            <button
                              onClick={() => handleMarkNotificationRead(n.id)}
                              className="px-3 py-1 bg-amber-50 hover:bg-emerald-50 text-amber-800 hover:text-emerald-800 border border-amber-200 hover:border-emerald-200 rounded-lg text-xs font-semibold transition cursor-pointer flex-shrink-0"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'matters' && (
                <MattersView
                  matters={matters}
                  documents={documents}
                  onSelectDocument={handleSelectDocument}
                  onInitiateDownload={handleOpenDownload}
                  onRequestAccess={(doc) => setRestrictedRequestDoc(doc)}
                  onOpenUpload={(matterId) => {
                    if (matterId) setSelectedMatterId(matterId);
                    setIsUploadModalOpen(true);
                  }}
                />
              )}

              {activeSection === 'documents' && (
                <DocumentsView
                  documents={filteredDocuments}
                  matters={matters}
                  selectedMatterId={selectedMatterId}
                  onSelectMatterId={setSelectedMatterId}
                  reviewStatusFilter={reviewStatusFilter}
                  onSelectReviewStatus={setReviewStatusFilter}
                  classificationFilter={classificationFilter}
                  onSelectClassification={setClassificationFilter}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  fileTypeFilter={fileTypeFilter}
                  onSelectFileType={setFileTypeFilter}
                  sha256Query={sha256SearchQuery}
                  onSha256Change={setSha256SearchQuery}
                  onClearFilters={handleClearFilters}
                  onSelectDocument={handleSelectDocument}
                  onInitiateDownload={handleOpenDownload}
                  onRequestAccess={(doc) => setRestrictedRequestDoc(doc)}
                  onOpenUpload={() => setIsUploadModalOpen(true)}
                />
              )}

              {activeSection === 'audit' && (
                <AuditView
                  currentProfile={currentProfile}
                  matters={matters}
                  auditLogs={auditLogs}
                  downloadEvents={downloadEvents}
                  onExportAudit={handleExportAudit}
                  isExporting={isExportingAudit}
                />
              )}

              {activeSection === 'restricted' && (
                <RestrictedView
                  currentProfile={currentProfile}
                  documents={documents}
                  onSelectDocument={handleSelectDocument}
                  onInitiateDownload={handleOpenDownload}
                  onRequestAccess={(doc) => setRestrictedRequestDoc(doc)}
                  onOpenClearanceReviewModal={() => setIsClearanceReviewModalOpen(true)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals (Preserved from Phase 1-5) */}
      <DocumentModal
        document={selectedDocument}
        currentProfile={currentProfile}
        availableProfiles={profiles}
        onClose={() => setSelectedDocument(null)}
        onInitiateDownload={handleOpenDownload}
        onRequestReview={() => {}}
        onCompleteReview={handleCompleteReview}
        onRequestAccess={(doc) => {
          setSelectedDocument(null);
          setRestrictedRequestDoc(doc);
        }}
        onUploadNewVersion={(doc) => {
          setSelectedDocument(null);
          setSelectedMatterId(doc.matterId);
          setIsUploadModalOpen(true);
        }}
      />

      <RestrictedAccessModal
        isOpen={!!restrictedRequestDoc}
        document={restrictedRequestDoc}
        onClose={() => setRestrictedRequestDoc(null)}
        onRequestSubmitted={() => loadWorkspaceData()}
      />

      <AccessRequestsReviewModal
        isOpen={isClearanceReviewModalOpen}
        onClose={() => setIsClearanceReviewModalOpen(false)}
        onDecided={() => loadWorkspaceData()}
      />

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        matters={matters}
        currentMatterId={selectedMatterId}
        onUploaded={handleEvidenceUploaded}
      />

      {currentProfile && (
        <DownloadModal
          document={downloadModalDoc}
          version={downloadModalVersion}
          currentProfile={currentProfile}
          onClose={() => {
            setDownloadModalDoc(null);
            setDownloadModalVersion(null);
          }}
          onConfirmDownload={handleConfirmDownload}
        />
      )}

      {currentProfile && (
        <ConfidentialPasswordModal
          document={confidentialModalDoc?.doc || null}
          version={confidentialModalDoc?.version || null}
          currentProfile={currentProfile}
          onClose={() => setConfidentialModalDoc(null)}
          onVerifyAndDownload={handleVerifyConfidentialDownload}
        />
      )}
    </div>
  );
}
