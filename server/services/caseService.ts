/*
 * Crown & Ledger Evidence Workspace
 * Copyright © 2026 Avanish Singh
 * Author: Avanish Singh
 */

import { CourtCaseRecord, AuthUserProfile, CaseStage } from '../types';
import { supabaseAdmin } from '../supabase';
import { auditService } from './auditService';
import { notificationService } from './notificationService';

export interface CreateCaseInput {
  caseNumber: string;
  matterId: string;
  courtName: string;
  jurisdiction: string;
  caseType: string;
  firNumber?: string | null;
  policeStation?: string | null;
  presidingJudgeId?: string | null;
  investigationOfficerId?: string | null;
  stage?: CaseStage;
  filingDate?: string | null;
  nextHearingDate?: string | null;
}

export interface UpdateCaseInput {
  courtName?: string;
  jurisdiction?: string;
  caseType?: string;
  firNumber?: string | null;
  policeStation?: string | null;
  presidingJudgeId?: string | null;
  investigationOfficerId?: string | null;
  stage?: CaseStage;
  filingDate?: string | null;
  nextHearingDate?: string | null;
}

export class CaseService {
  /**
   * Transforms raw database row to CourtCaseRecord
   */
  private mapRowToRecord(row: any): CourtCaseRecord {
    const judge = Array.isArray(row.presiding_judge) ? row.presiding_judge[0] : row.presiding_judge;
    const officer = Array.isArray(row.investigation_officer) ? row.investigation_officer[0] : row.investigation_officer;

    return {
      id: row.id,
      matterId: row.matter_id,
      caseNumber: row.case_number,
      courtName: row.court_name,
      jurisdiction: row.jurisdiction,
      caseType: row.case_type,
      firNumber: row.fir_number || null,
      policeStation: row.police_station || null,
      presidingJudgeId: row.presiding_judge_id || null,
      presidingJudgeName: judge?.full_name || null,
      investigationOfficerId: row.investigation_officer_id || null,
      investigationOfficerName: officer?.full_name || null,
      stage: row.stage as CaseStage,
      filingDate: row.filing_date || null,
      nextHearingDate: row.next_hearing_date || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Evaluates whether a user is authorized to read a court case
   */
  async isUserAuthorizedForCase(user: AuthUserProfile, courtCaseId: string): Promise<boolean> {
    // 1. Workspace admin and auditor have read access across all cases
    if (user.role === 'workspace_admin' || user.role === 'auditor') {
      return true;
    }

    // 2. Fetch the case with its matter relation
    const { data: cCase, error } = await supabaseAdmin
      .from('court_cases')
      .select('id, matter_id, presiding_judge_id, matter:matters!matter_id(id, lead_attorney_id)')
      .eq('id', courtCaseId)
      .single();

    if (error || !cCase) {
      return false;
    }

    // 3. Presiding judge check
    if (user.role === 'judge' && cCase.presiding_judge_id === user.id) {
      return true;
    }

    // 4. Lead attorney on the matter
    const matter = Array.isArray(cCase.matter) ? cCase.matter[0] : cCase.matter;
    if (matter?.lead_attorney_id === user.id) {
      return true;
    }

    // 5. Case participant check (valid for victim, forensic_team, attorney, reviewer, etc.)
    const { data: participant } = await supabaseAdmin
      .from('case_participants')
      .select('id')
      .eq('court_case_id', courtCaseId)
      .eq('user_id', user.id)
      .limit(1);

    if (participant && participant.length > 0) {
      return true;
    }

    // 6. Matter members check (for attorneys / reviewers on the matter)
    if (user.role !== 'victim') {
      const { data: member } = await supabaseAdmin
        .from('matter_members')
        .select('id')
        .eq('matter_id', cCase.matter_id)
        .eq('user_id', user.id)
        .limit(1);

      if (member && member.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Lists all court cases authorized for the user
   */
  async getCasesForUser(user: AuthUserProfile): Promise<CourtCaseRecord[]> {
    const baseQuery = supabaseAdmin
      .from('court_cases')
      .select(`
        id,
        matter_id,
        case_number,
        court_name,
        jurisdiction,
        case_type,
        fir_number,
        police_station,
        presiding_judge_id,
        investigation_officer_id,
        stage,
        filing_date,
        next_hearing_date,
        created_at,
        updated_at,
        presiding_judge:profiles!presiding_judge_id(id, full_name),
        investigation_officer:profiles!investigation_officer_id(id, full_name)
      `)
      .order('created_at', { ascending: false });

    // Workspace admins and auditors can read all cases
    if (user.role === 'workspace_admin' || user.role === 'auditor') {
      const { data, error } = await baseQuery;
      if (error) throw new Error(`Failed to fetch court cases: ${error.message}`);
      return (data || []).map((row) => this.mapRowToRecord(row));
    }

    // Other roles: fetch candidate cases and filter strictly by authorization
    const { data, error } = await baseQuery;
    if (error) throw new Error(`Failed to fetch court cases: ${error.message}`);

    const allCases = data || [];
    const authorizedCases: CourtCaseRecord[] = [];

    for (const c of allCases) {
      const isAuth = await this.isUserAuthorizedForCase(user, c.id);
      if (isAuth) {
        authorizedCases.push(this.mapRowToRecord(c));
      }
    }

    return authorizedCases;
  }

  /**
   * Retrieves a single court case by ID with access verification
   */
  async getCaseById(id: string, user: AuthUserProfile): Promise<CourtCaseRecord | null> {
    const { data, error } = await supabaseAdmin
      .from('court_cases')
      .select(`
        id,
        matter_id,
        case_number,
        court_name,
        jurisdiction,
        case_type,
        fir_number,
        police_station,
        presiding_judge_id,
        investigation_officer_id,
        stage,
        filing_date,
        next_hearing_date,
        created_at,
        updated_at,
        presiding_judge:profiles!presiding_judge_id(id, full_name),
        investigation_officer:profiles!investigation_officer_id(id, full_name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    const isAuth = await this.isUserAuthorizedForCase(user, id);
    if (!isAuth) {
      const err: any = new Error(`Access denied: You are not authorized to view court case ${data.case_number}.`);
      err.statusCode = 403;
      throw err;
    }

    return this.mapRowToRecord(data);
  }

  /**
   * Creates a new court case record.
   * Authorized: workspace_admin or matter lead attorney.
   */
  async createCase(input: CreateCaseInput, user: AuthUserProfile, ipAddress: string = '127.0.0.1'): Promise<CourtCaseRecord> {
    // 1. Fetch matter
    const { data: matter, error: matterErr } = await supabaseAdmin
      .from('matters')
      .select('id, reference_code, title, lead_attorney_id')
      .eq('id', input.matterId)
      .single();

    if (matterErr || !matter) {
      const err: any = new Error(`Matter not found: ${input.matterId}`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Authorization check: workspace_admin or authorized matter lead attorney only
    if (user.role !== 'workspace_admin' && (user.role !== 'attorney' || matter.lead_attorney_id !== user.id)) {
      const err: any = new Error('Access denied: Only workspace admins or the authorized matter lead attorney can create a court case.');
      err.statusCode = 403;
      throw err;
    }

    // 3. One court case per matter rule
    const { data: existingCaseForMatter } = await supabaseAdmin
      .from('court_cases')
      .select('id, case_number')
      .eq('matter_id', input.matterId)
      .limit(1);

    if (existingCaseForMatter && existingCaseForMatter.length > 0) {
      const err: any = new Error(
        `Matter ${matter.reference_code} is already linked to court case ${existingCaseForMatter[0].case_number}. Only one court case per matter is permitted.`
      );
      err.statusCode = 409;
      throw err;
    }

    // 4. Case number uniqueness check
    const { data: existingCaseNumber } = await supabaseAdmin
      .from('court_cases')
      .select('id')
      .eq('case_number', input.caseNumber)
      .limit(1);

    if (existingCaseNumber && existingCaseNumber.length > 0) {
      const err: any = new Error(`Court case number ${input.caseNumber} already exists in the workspace.`);
      err.statusCode = 409;
      throw err;
    }

    // 5. Presiding judge profile role check if provided
    if (input.presidingJudgeId) {
      const { data: judgeProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', input.presidingJudgeId)
        .single();

      if (!judgeProfile || (judgeProfile.role !== 'judge' && judgeProfile.role !== 'workspace_admin')) {
        const err: any = new Error('Assigned presiding judge must have system role "judge" or "workspace_admin".');
        err.statusCode = 400;
        throw err;
      }
    }

    // 6. Insert new court case
    const payload = {
      matter_id: input.matterId,
      case_number: input.caseNumber,
      court_name: input.courtName,
      jurisdiction: input.jurisdiction,
      case_type: input.caseType,
      fir_number: input.firNumber || null,
      police_station: input.policeStation || null,
      presiding_judge_id: input.presidingJudgeId || null,
      investigation_officer_id: input.investigationOfficerId || null,
      stage: input.stage || 'Investigation',
      filing_date: input.filingDate || null,
      next_hearing_date: input.nextHearingDate || null,
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('court_cases')
      .insert([payload])
      .select(`
        id,
        matter_id,
        case_number,
        court_name,
        jurisdiction,
        case_type,
        fir_number,
        police_station,
        presiding_judge_id,
        investigation_officer_id,
        stage,
        filing_date,
        next_hearing_date,
        created_at,
        updated_at,
        presiding_judge:profiles!presiding_judge_id(id, full_name),
        investigation_officer:profiles!investigation_officer_id(id, full_name)
      `)
      .single();

    if (insertErr || !inserted) {
      throw new Error(`Failed to create court case: ${insertErr?.message || 'Database error'}`);
    }

    const createdRecord = this.mapRowToRecord(inserted);

    // 7. Audit log
    await auditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorInitials: user.initials,
      matterId: input.matterId,
      matterReference: matter.reference_code,
      action: 'matter_created',
      targetName: createdRecord.caseNumber,
      details: `Court case ${createdRecord.caseNumber} created in ${createdRecord.courtName} (${createdRecord.stage})`,
      ipAddress,
      metadata: {
        courtCaseId: createdRecord.id,
        caseType: createdRecord.caseType,
        jurisdiction: createdRecord.jurisdiction,
      },
    }).catch(console.error);

    // 8. Notifications
    if (input.presidingJudgeId) {
      await notificationService.createNotification({
        recipientId: input.presidingJudgeId,
        courtCaseId: createdRecord.id,
        title: 'Assigned as Presiding Judge',
        message: `You have been designated presiding judge for court case ${createdRecord.caseNumber} (${matter.reference_code}).`,
        type: 'case_status_updated',
      }).catch(console.error);
    }

    return createdRecord;
  }

  /**
   * Updates an existing court case record.
   * Authorized: workspace_admin, presiding judge, or matter lead attorney.
   */
  async updateCase(id: string, updates: UpdateCaseInput, user: AuthUserProfile, ipAddress: string = '127.0.0.1'): Promise<CourtCaseRecord> {
    // 1. Fetch current case
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('court_cases')
      .select('*, matter:matters!matter_id(id, reference_code, lead_attorney_id)')
      .eq('id', id)
      .single();

    if (fetchErr || !current) {
      const err: any = new Error(`Court case not found: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    const matter = Array.isArray(current.matter) ? current.matter[0] : current.matter;
    const isLead = matter?.lead_attorney_id === user.id && user.role === 'attorney';
    let isPresidingJudge = current.presiding_judge_id === user.id && user.role === 'judge';
    if (!isPresidingJudge && user.role === 'judge') {
      const { data: judgePart } = await supabaseAdmin
        .from('case_participants')
        .select('id')
        .eq('court_case_id', id)
        .eq('user_id', user.id)
        .eq('participant_role', 'judge')
        .limit(1);
      if (judgePart && judgePart.length > 0) {
        isPresidingJudge = true;
      }
    }
    const isAdmin = user.role === 'workspace_admin';
    const isAssignedIO =
      current.investigation_officer_id === user.id && user.role === 'investigating_officer';

    // 2. Authorization
    if (!isAdmin && !isLead && !isPresidingJudge && !isAssignedIO) {
      const err: any = new Error('Access denied: You do not have permission to modify this court case.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Investigating officer scope limitation: restricted strictly to police station and FIR registration
    if (isAssignedIO && !isAdmin && !isLead && !isPresidingJudge) {
      if (
        updates.courtName !== undefined ||
        updates.jurisdiction !== undefined ||
        updates.caseType !== undefined ||
        updates.presidingJudgeId !== undefined ||
        updates.investigationOfficerId !== undefined ||
        updates.stage !== undefined ||
        updates.filingDate !== undefined ||
        updates.nextHearingDate !== undefined
      ) {
        const err: any = new Error(
          'Access denied: Investigating officers can only update police station and FIR registration details.'
        );
        err.statusCode = 403;
        throw err;
      }
    }

    // 4. Sensitive field protection: Only admin or lead attorney can change presiding judge or officer
    if (!isAdmin && !isLead) {
      if (updates.presidingJudgeId !== undefined && updates.presidingJudgeId !== current.presiding_judge_id) {
        const err: any = new Error('Access denied: Only workspace admins or lead attorney can reassign the presiding judge.');
        err.statusCode = 403;
        throw err;
      }
      if (updates.investigationOfficerId !== undefined && updates.investigationOfficerId !== current.investigation_officer_id) {
        const err: any = new Error('Access denied: Only workspace admins or lead attorney can reassign the investigation officer.');
        err.statusCode = 403;
        throw err;
      }
    }

    // 4. Prepare update payload with allowlisted fields
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.courtName !== undefined) payload.court_name = updates.courtName;
    if (updates.jurisdiction !== undefined) payload.jurisdiction = updates.jurisdiction;
    if (updates.caseType !== undefined) payload.case_type = updates.caseType;
    if (updates.firNumber !== undefined) payload.fir_number = updates.firNumber;
    if (updates.policeStation !== undefined) payload.police_station = updates.policeStation;
    if (updates.presidingJudgeId !== undefined) payload.presiding_judge_id = updates.presidingJudgeId;
    if (updates.investigationOfficerId !== undefined) payload.investigation_officer_id = updates.investigationOfficerId;
    if (updates.stage !== undefined) payload.stage = updates.stage;
    if (updates.filingDate !== undefined) payload.filing_date = updates.filingDate;
    if (updates.nextHearingDate !== undefined) payload.next_hearing_date = updates.nextHearingDate;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('court_cases')
      .update(payload)
      .eq('id', id)
      .select(`
        id,
        matter_id,
        case_number,
        court_name,
        jurisdiction,
        case_type,
        fir_number,
        police_station,
        presiding_judge_id,
        investigation_officer_id,
        stage,
        filing_date,
        next_hearing_date,
        created_at,
        updated_at,
        presiding_judge:profiles!presiding_judge_id(id, full_name),
        investigation_officer:profiles!investigation_officer_id(id, full_name)
      `)
      .single();

    if (updateErr || !updated) {
      throw new Error(`Failed to update court case: ${updateErr?.message || 'Database error'}`);
    }

    const updatedRecord = this.mapRowToRecord(updated);

    // 5. Detect and audit specific state transitions
    if (updates.nextHearingDate !== undefined && updates.nextHearingDate !== current.next_hearing_date) {
      await auditService.logEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorInitials: user.initials,
        matterId: current.matter_id,
        matterReference: matter?.reference_code,
        action: 'matter_updated',
        targetName: updatedRecord.caseNumber,
        details: `Hearing date scheduled for ${updatedRecord.caseNumber}: ${updates.nextHearingDate || 'Cleared'}`,
        ipAddress,
        metadata: {
          courtCaseId: updatedRecord.id,
          previousDate: current.next_hearing_date,
          newDate: updates.nextHearingDate,
          event: 'hearing_date_changed',
        },
      }).catch(console.error);

      if (updates.nextHearingDate) {
        await notificationService.notifyCaseParticipants(updatedRecord.id, {
          title: 'Hearing Scheduled',
          message: `Next hearing for ${updatedRecord.caseNumber} has been scheduled for ${new Date(updates.nextHearingDate).toLocaleString()}.`,
          type: 'hearing_scheduled',
          excludeUserId: user.id,
        }).catch(console.error);
      }
    }

    if (updates.stage !== undefined && updates.stage !== current.stage) {
      await auditService.logEvent({
        actorId: user.id,
        actorName: user.fullName,
        actorInitials: user.initials,
        matterId: current.matter_id,
        matterReference: matter?.reference_code,
        action: 'matter_updated',
        targetName: updatedRecord.caseNumber,
        details: `Case stage changed from ${current.stage} to ${updates.stage} for ${updatedRecord.caseNumber}`,
        ipAddress,
        metadata: {
          courtCaseId: updatedRecord.id,
          previousStage: current.stage,
          newStage: updates.stage,
          event: 'case_stage_changed',
        },
      }).catch(console.error);

      await notificationService.notifyCaseParticipants(updatedRecord.id, {
        title: 'Case Stage Updated',
        message: `Court case ${updatedRecord.caseNumber} moved to stage: ${updates.stage}.`,
        type: 'case_status_updated',
        excludeUserId: user.id,
      }).catch(console.error);
    }

    // General case update audit
    await auditService.logEvent({
      actorId: user.id,
      actorName: user.fullName,
      actorInitials: user.initials,
      matterId: current.matter_id,
      matterReference: matter?.reference_code,
      action: 'matter_updated',
      targetName: updatedRecord.caseNumber,
      details: `Updated details for court case ${updatedRecord.caseNumber}`,
      ipAddress,
      metadata: {
        courtCaseId: updatedRecord.id,
        updatedFields: Object.keys(updates),
      },
    }).catch(console.error);

    return updatedRecord;
  }
}

export const caseService = new CaseService();
