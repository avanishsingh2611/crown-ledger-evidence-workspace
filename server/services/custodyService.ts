/*
 * Crown & Ledger Evidence Workspace
 * Copyright © 2026 Avanish Singh
 * Author: Avanish Singh
 */

import { EvidenceCustodyTransferRecord, CustodyTransferType, AuthUserProfile } from '../types';
import { supabaseAdmin } from '../supabase';
import { auditService } from './auditService';
import { notificationService } from './notificationService';
import { matterService } from './matterService';

export interface RecordTransferInput {
  receivingPartyId: string;
  releasingPartyId?: string;
  transferType: CustodyTransferType;
  purpose: string;
  securitySealNumber: string;
  sealIntact?: boolean;
  sha256Verified?: boolean;
  transferTimestamp?: string;
  notes?: string | null;
}

export class CustodyService {
  /**
   * Helper to map database row to EvidenceCustodyTransferRecord
   */
  private mapRowToRecord(row: any): EvidenceCustodyTransferRecord {
    const releasing = Array.isArray(row.releasing_party) ? row.releasing_party[0] : row.releasing_party;
    const receiving = Array.isArray(row.receiving_party) ? row.receiving_party[0] : row.receiving_party;
    const doc = Array.isArray(row.document) ? row.document[0] : row.document;

    return {
      id: row.id,
      documentId: row.document_id,
      documentTitle: doc?.title || 'Evidence Document',
      matterId: row.matter_id,
      courtCaseId: row.court_case_id || null,
      releasingPartyId: row.releasing_party_id,
      releasingPartyName: releasing?.full_name || 'Releasing Officer',
      receivingPartyId: row.receiving_party_id,
      receivingPartyName: receiving?.full_name || 'Receiving Officer',
      transferType: row.transfer_type as CustodyTransferType,
      purpose: row.purpose,
      securitySealNumber: row.security_seal_number,
      sealIntact: row.seal_intact,
      sha256Verified: row.sha256_verified,
      transferTimestamp: row.transfer_timestamp,
      notes: row.notes || null,
      createdAt: row.created_at,
    };
  }

  /**
   * Retrieves full immutable chain of custody history for a document.
   * Victims are strictly denied access.
   */
  async getCustodyHistory(documentId: string, user: AuthUserProfile): Promise<EvidenceCustodyTransferRecord[]> {
    // 1. Victim barrier
    if (user.role === 'victim') {
      const err: any = new Error('Access denied: Victims do not have clearance to inspect the chain of custody ledger.');
      err.statusCode = 403;
      throw err;
    }

    // 2. Fetch document to verify matter access
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('documents')
      .select('id, matter_id, title')
      .eq('id', documentId)
      .single();

    if (docErr || !doc) {
      const err: any = new Error(`Document not found: ${documentId}`);
      err.statusCode = 404;
      throw err;
    }

    // 3. Matter access verification (workspace_admin and auditor bypass)
    if (user.role !== 'workspace_admin' && user.role !== 'auditor') {
      const hasAccess = await matterService.checkUserMatterAccess(user.id, doc.matter_id);
      if (!hasAccess) {
        const err: any = new Error('Access denied: You do not have access to this matter evidence.');
        err.statusCode = 403;
        throw err;
      }
    }

    // 4. Query custody records
    const { data, error } = await supabaseAdmin
      .from('evidence_custody_transfers')
      .select(`
        *,
        releasing_party:profiles!releasing_party_id(id, full_name),
        receiving_party:profiles!receiving_party_id(id, full_name),
        document:documents!document_id(id, title)
      `)
      .eq('document_id', documentId)
      .order('transfer_timestamp', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch custody transfers: ${error.message}`);
    }

    return (data || []).map((row) => this.mapRowToRecord(row));
  }

  /**
   * Records a new immutable chain of custody transfer.
   */
  async recordTransfer(
    documentId: string,
    input: RecordTransferInput,
    user: AuthUserProfile,
    ipAddress: string = '127.0.0.1'
  ): Promise<EvidenceCustodyTransferRecord> {
    // 1. Victim barrier
    if (user.role === 'victim') {
      const err: any = new Error('Access denied: Victims are not permitted to log custody transfers.');
      err.statusCode = 403;
      throw err;
    }

    // 2. Fetch document
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('documents')
      .select('id, matter_id, title, matter:matters!matter_id(id, reference_code)')
      .eq('id', documentId)
      .single();

    if (docErr || !doc) {
      const err: any = new Error(`Document not found: ${documentId}`);
      err.statusCode = 404;
      throw err;
    }

    // 2b. Role and Matter access verification: Auditor, Judge, and Reviewer are read-only; non-admin must have matter access
    if (user.role === 'auditor') {
      const err: any = new Error('Access denied: Compliance auditors have read-only permissions and cannot record custody transfers.');
      err.statusCode = 403;
      throw err;
    }

    if (user.role === 'judge') {
      const err: any = new Error('Access denied: Judicial officers have strictly read-only custody inspection privileges. Judges cannot log custody transfers.');
      err.statusCode = 403;
      throw err;
    }

    if (user.role === 'reviewer') {
      const err: any = new Error('Access denied: Document reviewers have read-only custody inspection permissions.');
      err.statusCode = 403;
      throw err;
    }

    if (user.role !== 'workspace_admin') {
      const hasAccess = await matterService.checkUserMatterAccess(user.id, doc.matter_id);
      if (!hasAccess) {
        const err: any = new Error('Access denied: You do not have authorization to record custody for this matter evidence.');
        err.statusCode = 403;
        throw err;
      }
    }

    // 3. Releasing party resolution: must be auth.uid() unless workspace_admin
    let releasingPartyId = user.id;
    if (user.role === 'workspace_admin' && input.releasingPartyId) {
      releasingPartyId = input.releasingPartyId;
    } else if (input.releasingPartyId && input.releasingPartyId !== user.id) {
      const err: any = new Error('Access denied: Non-admin users cannot record custody transfers on behalf of another releasing party.');
      err.statusCode = 403;
      throw err;
    }

    // 4. Verify receiving party exists
    const { data: receivingProfile, error: recErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('id', input.receivingPartyId)
      .single();

    if (recErr || !receivingProfile || !receivingProfile.is_active) {
      const err: any = new Error(`Invalid receiving party: ${input.receivingPartyId}`);
      err.statusCode = 400;
      throw err;
    }

    // 5. Look up linked court_case_id for this matter if available
    const { data: cCase } = await supabaseAdmin
      .from('court_cases')
      .select('id, case_number')
      .eq('matter_id', doc.matter_id)
      .limit(1);

    const courtCaseId = cCase && cCase.length > 0 ? cCase[0].id : null;
    const caseNumber = cCase && cCase.length > 0 ? cCase[0].case_number : null;

    // 6. Insert immutable record
    const payload = {
      document_id: documentId,
      matter_id: doc.matter_id,
      court_case_id: courtCaseId,
      releasing_party_id: releasingPartyId,
      receiving_party_id: input.receivingPartyId,
      transfer_type: input.transferType,
      purpose: input.purpose,
      security_seal_number: input.securitySealNumber,
      seal_intact: input.sealIntact ?? true,
      sha256_verified: input.sha256Verified ?? true,
      transfer_timestamp: input.transferTimestamp || new Date().toISOString(),
      notes: input.notes || null,
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('evidence_custody_transfers')
      .insert([payload])
      .select(`
        *,
        releasing_party:profiles!releasing_party_id(id, full_name),
        receiving_party:profiles!receiving_party_id(id, full_name),
        document:documents!document_id(id, title)
      `)
      .single();

    if (insertErr || !inserted) {
      throw new Error(`Failed to record custody transfer: ${insertErr?.message || 'Database error'}`);
    }

    const result = this.mapRowToRecord(inserted);
    const matter = Array.isArray(doc.matter) ? doc.matter[0] : doc.matter;

    // 7. Audit log
    await auditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorInitials: user.initials,
      matterId: doc.matter_id,
      matterReference: matter?.reference_code,
      documentId: doc.id,
      action: 'downloaded', // Mapped cleanly to system audit category
      targetName: `Chain of Custody (${result.transferType})`,
      details: `Custody transfer [${result.transferType}] recorded for ${doc.title}. Handover from ${result.releasingPartyName} to ${result.receivingPartyName}. Seal: ${result.securitySealNumber}`,
      ipAddress,
      metadata: {
        custodyTransferId: result.id,
        transferType: result.transferType,
        securitySealNumber: result.securitySealNumber,
        releasingPartyId: result.releasingPartyId,
        receivingPartyId: result.receivingPartyId,
        sha256Verified: result.sha256Verified,
        event: 'custody_transfer_recorded',
      },
    }).catch(console.error);

    // 8. Notification to receiving party
    await notificationService.createNotification({
      recipientId: input.receivingPartyId,
      courtCaseId,
      title: 'Evidence Custody Transferred',
      message: `You have received digital evidence custody for "${doc.title}" (${result.transferType}). Handed over by ${result.releasingPartyName}. Security Seal: ${result.securitySealNumber}.`,
      type: 'custody_transferred',
    }).catch(console.error);

    return result;
  }
}

export const custodyService = new CustodyService();
