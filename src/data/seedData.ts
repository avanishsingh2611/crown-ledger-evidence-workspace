/**
 * DEPRECATED: Mock seed data has been removed.
 * All application data is loaded from the verified Express + PostgreSQL backend.
 */
import { Profile, Matter, EvidenceDocument, AuditLogEntry, DownloadSecurityEvent } from '../types';

export const SEED_PROFILES: Profile[] = [];
export const SEED_MATTERS: Matter[] = [];
export const SEED_DOCUMENTS: EvidenceDocument[] = [];
export const SEED_AUDIT_LOGS: AuditLogEntry[] = [];
export const SEED_DOWNLOAD_EVENTS: DownloadSecurityEvent[] = [];
