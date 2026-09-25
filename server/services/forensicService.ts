/*
 * Crown & Ledger Evidence Workspace
 * Copyright © 2026 Avanish Singh
 * Author: Avanish Singh
 */

import { ForensicReportRecord, AuthUserProfile } from '../types';
import { supabaseAdmin } from '../supabase';
import { auditService } from './auditService';
import { notificationService } from './notificationService';

export interface CreateForensicReportInput {
  documentId?: string | null;
  labName: string;
  deviceType: string;
  deviceMakeModel: string;
  deviceSerialNumber: string;
  extractionTool: string;
  extractionToolVersion: string;
  acquisitionSha256: string;
  verificationSha256: string;
  hashesMatch: boolean;
  intakeCondition: string;
  findingsSummary: string;
  section65bCertified?: boolean;
}

export interface UpdateForensicReportInput {
  labName?: string;
  deviceType?: string;
  deviceMakeModel?: string;
  deviceSerialNumber?: string;
  extractionTool?: string;
  extractionToolVersion?: string;
  acquisitionSha256?: string;
  verificationSha256?: string;
  hashesMatch?: boolean;
  intakeCondition?: string;
  findingsSummary?: string;
  section65bCertified?: boolean;
}

export class ForensicService {
  /**
   * Helper to map database row to ForensicReportRecord
   */
  private mapRowToRecord(row: any): ForensicReportRecord {
    const examiner = Array.isArray(row.examiner) ? row.examiner[0] : row.examiner;
    return {
      id: row.id,
      documentId: row.document_id || null,
      courtCaseId: row.court_case_id,
      matterId: row.matter_id,
      examinerId: row.examiner_id,
      examinerName: examiner?.full_name || 'Forensic Examiner',
      labName: row.lab_name,
      deviceType: row.device_type,
      deviceMakeModel: row.device_make_model,
      deviceSerialNumber: row.device_serial_number,
      extractionTool: row.extraction_tool,
      extractionToolVersion: row.extraction_tool_version,
      acquisitionSha256: row.acquisition_sha256,
      verificationSha256: row.verification_sha256,
      hashesMatch: row.hashes_match,
      intakeCondition: row.intake_condition,
      findingsSummary: row.findings_summary,
      section65bCertified: row.section_65b_certified,
      isFinalized: row.is_finalized,
      createdAt: row.created_at,
      finalizedAt: row.finalized_at || null,
    };
  }

  /**
   * Evaluates whether a user is authorized to read a forensic report.
   * Strict boundary: VICTIMS ARE NEVER PERMITTED TO READ FORENSIC REPORTS.
   */
  async isUserAuthorizedForReport(user: AuthUserProfile, report: any): Promise<boolean> {
    // 1. VICTIMS ARE STRICTLY DENIED
    if (user.role === 'victim') {
      return false;
    }

    // 2. Workspace admin and auditor have full read visibility
    if (user.role === 'workspace_admin' || user.role === 'auditor') {
      return true;
    }

    // 3. Author examiner
    if (report.examiner_id === user.id) {
      return true;
    }

    // 4. Presiding judge of the case
    const { data: cCase } = await supabaseAdmin
      .from('court_cases')
      .select('presiding_judge_id, matter_id')
      .eq('id', report.court_case_id)
      .single();

    if (cCase && cCase.presiding_judge_id === user.id) {
      return true;
    }

    // 5. Lead attorney of the matter
    const { data: matter } = await supabaseAdmin
      .from('matters')
      .select('lead_attorney_id')
      .eq('id', report.matter_id)
      .single();

    if (matter && matter.lead_attorney_id === user.id) {
      return true;
    }

    // 6. Case participant (excluding victim)
    const { data: participant } = await supabaseAdmin
      .from('case_participants')
      .select('id, participant_role')
      .eq('court_case_id', report.court_case_id)
      .eq('user_id', user.id)
      .neq('participant_role', 'victim')
      .limit(1);

    if (participant && participant.length > 0) {
      return true;
    }

    // 7. Matter members (for attorneys)
    if (user.role === 'attorney') {
      const { data: member } = await supabaseAdmin
        .from('matter_members')
        .select('id')
        .eq('matter_id', report.matter_id)
        .eq('user_id', user.id)
        .limit(1);

      if (member && member.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Retrieves all forensic reports for a court case
   */
  async getReportsForCase(courtCaseId: string, user: AuthUserProfile): Promise<ForensicReportRecord[]> {
    // 1. Victim barrier
    if (user.role === 'victim') {
      const err: any = new Error('Access denied: Victims do not have clearance to view digital forensic reports.');
      err.statusCode = 403;
      throw err;
    }

    // 2. Query reports
    const { data, error } = await supabaseAdmin
      .from('forensic_reports')
      .select(`
        *,
        examiner:profiles!examiner_id(id, full_name)
      `)
      .eq('court_case_id', courtCaseId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch forensic reports: ${error.message}`);
    }

    const reports = data || [];
    const authorizedReports: ForensicReportRecord[] = [];

    for (const r of reports) {
      const isAuth = await this.isUserAuthorizedForReport(user, r);
      if (isAuth) {
        authorizedReports.push(this.mapRowToRecord(r));
      }
    }

    return authorizedReports;
  }

  /**
   * Retrieves a single forensic report by ID
   */
  async getReportById(id: string, user: AuthUserProfile): Promise<ForensicReportRecord | null> {
    if (user.role === 'victim') {
      const err: any = new Error('Access denied: Victims do not have clearance to view digital forensic reports.');
      err.statusCode = 403;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from('forensic_reports')
      .select(`
        *,
        examiner:profiles!examiner_id(id, full_name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    const isAuth = await this.isUserAuthorizedForReport(user, data);
    if (!isAuth) {
      const err: any = new Error('Access denied: You are not authorized to view this forensic report.');
      err.statusCode = 403;
      throw err;
    }

    return this.mapRowToRecord(data);
  }

  /**
   * Creates a draft forensic report
   * Authorized: forensic_team or workspace_admin
   */
  async createReport(
    courtCaseId: string,
    input: CreateForensicReportInput,
    user: AuthUserProfile,
    ipAddress: string = '127.0.0.1'
  ): Promise<ForensicReportRecord> {
    if (user.role !== 'forensic_team' && user.role !== 'workspace_admin') {
      const err: any = new Error('Access denied: Only forensic examiners or workspace admins can create forensic reports.');
      err.statusCode = 403;
      throw err;
    }

    // 1. Fetch court case to get matter_id
    const { data: cCase, error: caseErr } = await supabaseAdmin
      .from('court_cases')
      .select('id, matter_id, case_number, matter:matters!matter_id(id, reference_code)')
      .eq('id', courtCaseId)
      .single();

    if (caseErr || !cCase) {
      const err: any = new Error(`Court case not found: ${courtCaseId}`);
      err.statusCode = 404;
      throw err;
    }

    const matter = Array.isArray(cCase.matter) ? cCase.matter[0] : cCase.matter;

    // 2. If documentId is provided, verify it belongs to this matter
    if (input.documentId) {
      const { data: doc, error: docErr } = await supabaseAdmin
        .from('documents')
        .select('id, matter_id')
        .eq('id', input.documentId)
        .single();

      if (docErr || !doc || doc.matter_id !== cCase.matter_id) {
        const err: any = new Error(`Document ${input.documentId} not found or does not belong to case matter ${cCase.matter_id}`);
        err.statusCode = 400;
        throw err;
      }
    }

    // 3. Insert report record
    const payload = {
      court_case_id: courtCaseId,
      matter_id: cCase.matter_id,
      document_id: input.documentId || null,
      examiner_id: user.id,
      lab_name: input.labName,
      device_type: input.deviceType,
      device_make_model: input.deviceMakeModel,
      device_serial_number: input.deviceSerialNumber,
      extraction_tool: input.extractionTool,
      extraction_tool_version: input.extractionToolVersion,
      acquisition_sha256: input.acquisitionSha256.toLowerCase(),
      verification_sha256: input.verificationSha256.toLowerCase(),
      hashes_match: input.hashesMatch,
      intake_condition: input.intakeCondition,
      findings_summary: input.findingsSummary,
      section_65b_certified: input.section65bCertified ?? false,
      is_finalized: false,
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('forensic_reports')
      .insert([payload])
      .select(`
        *,
        examiner:profiles!examiner_id(id, full_name)
      `)
      .single();

    if (insertErr || !inserted) {
      throw new Error(`Failed to create forensic report: ${insertErr?.message || 'Database error'}`);
    }

    const result = this.mapRowToRecord(inserted);

    // 4. Audit log
    await auditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorInitials: user.initials,
      matterId: cCase.matter_id,
      matterReference: matter?.reference_code,
      action: 'uploaded',
      targetName: `Forensic Report (${result.deviceMakeModel})`,
      details: `Forensic examination draft report created for ${result.deviceMakeModel} (Serial: ${result.deviceSerialNumber}) in case ${cCase.case_number}`,
      ipAddress,
      metadata: {
        reportId: result.id,
        courtCaseId,
        acquisitionHash: result.acquisitionSha256,
        verificationHash: result.verificationSha256,
        event: 'forensic_report_created',
      },
    }).catch(console.error);

    return result;
  }

  /**
   * Updates an unfinalized draft forensic report
   */
  async updateReport(
    id: string,
    input: UpdateForensicReportInput,
    user: AuthUserProfile,
    ipAddress: string = '127.0.0.1'
  ): Promise<ForensicReportRecord> {
    // 1. Fetch existing report
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('forensic_reports')
      .select('*, court_case:court_cases!court_case_id(case_number)')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      const err: any = new Error(`Forensic report not found: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    // 2. IMMUTABILITY ENFORCEMENT: Finalized reports cannot be updated
    if (existing.is_finalized) {
      const err: any = new Error('Modification prohibited: Finalized forensic reports are permanently immutable under Section 65B compliance.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Authorization: Examiner or workspace_admin
    if (existing.examiner_id !== user.id && user.role !== 'workspace_admin') {
      const err: any = new Error('Access denied: Only the assigned examiner or a workspace administrator can update this report.');
      err.statusCode = 403;
      throw err;
    }

    // 4. Update allowlisted fields
    const payload: Record<string, any> = {};
    if (input.labName !== undefined) payload.lab_name = input.labName;
    if (input.deviceType !== undefined) payload.device_type = input.deviceType;
    if (input.deviceMakeModel !== undefined) payload.device_make_model = input.deviceMakeModel;
    if (input.deviceSerialNumber !== undefined) payload.device_serial_number = input.deviceSerialNumber;
    if (input.extractionTool !== undefined) payload.extraction_tool = input.extractionTool;
    if (input.extractionToolVersion !== undefined) payload.extraction_tool_version = input.extractionToolVersion;
    if (input.acquisitionSha256 !== undefined) payload.acquisition_sha256 = input.acquisitionSha256.toLowerCase();
    if (input.verificationSha256 !== undefined) payload.verification_sha256 = input.verificationSha256.toLowerCase();
    if (input.hashesMatch !== undefined) payload.hashes_match = input.hashesMatch;
    if (input.intakeCondition !== undefined) payload.intake_condition = input.intakeCondition;
    if (input.findingsSummary !== undefined) payload.findings_summary = input.findingsSummary;
    if (input.section65bCertified !== undefined) payload.section_65b_certified = input.section65bCertified;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('forensic_reports')
      .update(payload)
      .eq('id', id)
      .select(`
        *,
        examiner:profiles!examiner_id(id, full_name)
      `)
      .single();

    if (updateErr || !updated) {
      throw new Error(`Failed to update forensic report: ${updateErr?.message || 'Database error'}`);
    }

    const result = this.mapRowToRecord(updated);

    // 5. Audit log
    await auditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorInitials: user.initials,
      matterId: existing.matter_id,
      action: 'classification_changed',
      targetName: `Forensic Report (${result.deviceMakeModel})`,
      details: `Updated draft forensic examination report for ${result.deviceMakeModel}`,
      ipAddress,
      metadata: {
        reportId: result.id,
        event: 'forensic_report_updated',
      },
    }).catch(console.error);

    return result;
  }

  /**
   * Finalizes a forensic report under strict Section 65B hash verification.
   * Once finalized, the database trigger permanently freezes the record from UPDATE and DELETE.
   */
  async finalizeReport(id: string, user: AuthUserProfile, ipAddress: string = '127.0.0.1'): Promise<ForensicReportRecord> {
    // 1. Fetch current report
    const { data: report, error: fetchErr } = await supabaseAdmin
      .from('forensic_reports')
      .select(`
        *,
        court_case:court_cases!court_case_id(id, case_number, presiding_judge_id, matter:matters!matter_id(id, reference_code, lead_attorney_id))
      `)
      .eq('id', id)
      .single();

    if (fetchErr || !report) {
      const err: any = new Error(`Forensic report not found: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    // 2. Check if already finalized
    if (report.is_finalized) {
      const err: any = new Error('Forensic report is already finalized and signed.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Authorization check
    if (report.examiner_id !== user.id && user.role !== 'workspace_admin') {
      const err: any = new Error('Access denied: Only the assigned examiner or workspace admin can finalize this report.');
      err.statusCode = 403;
      throw err;
    }

    // 4. Strict Section 65B Hash Verification
    const acqHash = (report.acquisition_sha256 || '').trim().toLowerCase();
    const verHash = (report.verification_sha256 || '').trim().toLowerCase();

    if (!acqHash || !verHash || acqHash.length !== 64 || verHash.length !== 64) {
      const err: any = new Error(
        'Section 65B Finalization Error: Both acquisition SHA-256 and verification SHA-256 must be present and 64 hex characters.'
      );
      err.statusCode = 400;
      throw err;
    }

    if (acqHash !== verHash || !report.hashes_match) {
      const err: any = new Error(
        'Section 65B Verification Failed: Acquisition hash does not match verification hash. Digital evidence integrity cannot be certified.'
      );
      err.statusCode = 400;
      throw err;
    }

    // 4b. Verify document belongs to the same matter/case if specified
    if (report.document_id) {
      const { data: doc } = await supabaseAdmin
        .from('documents')
        .select('id, matter_id')
        .eq('id', report.document_id)
        .single();

      if (!doc || doc.matter_id !== report.matter_id) {
        const err: any = new Error(
          'Verification failed: Digital evidence document does not belong to the same matter/case.'
        );
        err.statusCode = 400;
        throw err;
      }
    }

    // 5. Finalize the record in Supabase
    const finalizedTimestamp = new Date().toISOString();
    const { data: finalized, error: finalizeErr } = await supabaseAdmin
      .from('forensic_reports')
      .update({
        is_finalized: true,
        finalized_at: finalizedTimestamp,
        section_65b_certified: true,
      })
      .eq('id', id)
      .select(`
        *,
        examiner:profiles!examiner_id(id, full_name)
      `)
      .single();

    if (finalizeErr || !finalized) {
      throw new Error(`Failed to finalize report: ${finalizeErr?.message || 'Database error'}`);
    }

    const result = this.mapRowToRecord(finalized);
    const cCase = Array.isArray(report.court_case) ? report.court_case[0] : report.court_case;
    const matter = Array.isArray(cCase?.matter) ? cCase.matter[0] : cCase?.matter;

    // 6. Audit log
    await auditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorInitials: user.initials,
      matterId: report.matter_id,
      matterReference: matter?.reference_code,
      action: 'classification_changed',
      targetName: `Finalized Forensic Report (${result.deviceMakeModel})`,
      details: `Forensic report finalized & certified under Indian Evidence Act Sec 65B for ${result.deviceMakeModel} (Serial: ${result.deviceSerialNumber}). Hashes verified: ${result.acquisitionSha256}`,
      ipAddress,
      metadata: {
        reportId: result.id,
        courtCaseId: report.court_case_id,
        acquisitionSha256: result.acquisitionSha256,
        verificationSha256: result.verificationSha256,
        section65bCertified: true,
        finalizedAt: finalizedTimestamp,
        event: 'forensic_report_finalized',
      },
    }).catch(console.error);

    // 7. Notify presiding judge and lead attorney of new certified evidence
    const notificationRecipients: string[] = [];
    if (cCase?.presiding_judge_id) notificationRecipients.push(cCase.presiding_judge_id);
    if (matter?.lead_attorney_id) notificationRecipients.push(matter.lead_attorney_id);

    if (notificationRecipients.length > 0) {
      await notificationService.notifyUsers(notificationRecipients, {
        courtCaseId: report.court_case_id,
        title: 'Certified Forensic Report Submitted',
        message: `Forensic examiner ${user.fullName} has finalized a Section 65B certified report for ${result.deviceMakeModel} in case ${cCase?.case_number}.`,
        type: 'evidence_submitted',
      }).catch(console.error);
    }

    return result;
  }
}

export const forensicService = new ForensicService();
