import { MatterRecord, AuthUserProfile } from '../types';
import { supabaseAdmin } from '../supabase';

export class MatterService {
  /**
   * List all matters with computed live document counts from Supabase database
   */
  async getAllMatters(): Promise<MatterRecord[]> {
    // 1. Query canonical `public.matters` table from Supabase PostgreSQL
    const { data: dbMatters, error } = await supabaseAdmin
      .from('matters')
      .select(`
        id,
        reference_code,
        title,
        client_name,
        matter_type,
        status,
        risk_level,
        lead_attorney_id,
        description,
        created_at,
        updated_at,
        lead_attorney:profiles!lead_attorney_id (
          id,
          full_name
        )
      `)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to query public.matters from Supabase:', error.message);
      throw new Error(`Database error fetching matters: ${error.message}`);
    }

    if (!dbMatters) {
      return [];
    }

    // 2. Query document counts directly from `public.documents`
    const { data: docData, error: docError } = await supabaseAdmin
      .from('documents')
      .select('id, matter_id, review_status');

    if (docError) {
      console.warn('Failed to query document counts for matters:', docError.message);
    }

    const docs = docData || [];

    return dbMatters.map((m: any) => {
      const matterDocs = docs.filter((d: any) => d.matter_id === m.id);
      const unreviewed = matterDocs.filter((d: any) => d.review_status === 'needs_review').length;
      const leadName = m.lead_attorney?.full_name || 'Eleanor Raines';

      return {
        id: m.id,
        referenceCode: m.reference_code,
        title: m.title,
        clientName: m.client_name,
        matterType: m.matter_type || 'Litigation',
        status: m.status || 'active',
        riskLevel: m.risk_level || 'low',
        leadAttorneyId: m.lead_attorney_id,
        leadAttorneyName: leadName,
        fileCount: matterDocs.length,
        unreviewedCount: unreviewed,
        lastActivity: 'Recent',
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      };
    });
  }

  /**
   * List matters filtered for a specific authenticated user based on role and matter_members
   */
  async getMattersForUser(user: AuthUserProfile): Promise<MatterRecord[]> {
    const allMatters = await this.getAllMatters();

    // Managing Partner / Admin and External Auditors have access across all matters
    if (user.role === 'workspace_admin' || user.role === 'auditor') {
      return allMatters;
    }

    // For Counsel / Reviewers / Judges / Forensics / Victims: retrieve assignments
    const [memberRes, participantRes] = await Promise.all([
      supabaseAdmin.from('matter_members').select('matter_id').eq('user_id', user.id),
      supabaseAdmin.from('case_participants').select('matter_id').eq('user_id', user.id),
    ]);

    const assignedMatterIds = new Set([
      ...((memberRes.data || []).map((row: any) => row.matter_id)),
      ...((participantRes.data || []).map((row: any) => row.matter_id)),
    ]);

    return allMatters.filter(
      (m) => m.leadAttorneyId === user.id || assignedMatterIds.has(m.id)
    );
  }

  /**
   * Get single matter by ID or reference code
   */
  async getMatterById(matterIdOrCode: string): Promise<MatterRecord | null> {
    const all = await this.getAllMatters();
    return (
      all.find(
        (m) =>
          m.id.toLowerCase() === matterIdOrCode.toLowerCase() ||
          m.referenceCode.toLowerCase() === matterIdOrCode.toLowerCase()
      ) || null
    );
  }

  /**
   * Check if user has permission to access this matter based on role, lead attorney, or matter_members
   */
  async checkUserMatterAccess(userId: string, matterIdOrCode: string): Promise<boolean> {
    const matter = await this.getMatterById(matterIdOrCode);
    if (!matter) return false;

    // Check if user is lead attorney on this matter
    if (matter.leadAttorneyId === userId) return true;

    // Query canonical `public.matter_members` table
    const { data: memberData } = await supabaseAdmin
      .from('matter_members')
      .select('id')
      .eq('matter_id', matter.id)
      .eq('user_id', userId)
      .limit(1);

    if (memberData && memberData.length > 0) return true;

    // Check `public.case_participants` table
    const { data: participantData } = await supabaseAdmin
      .from('case_participants')
      .select('id')
      .eq('matter_id', matter.id)
      .eq('user_id', userId)
      .limit(1);

    return !!(participantData && participantData.length > 0);
  }

  /**
   * Check if a matter is archived or closed (read-only protection)
   */
  async isMatterArchived(matterIdOrCode: string): Promise<boolean> {
    const matter = await this.getMatterById(matterIdOrCode);
    if (!matter) return false;
    return matter.status === 'archived' || matter.status === 'closed';
  }
}

export const matterService = new MatterService();
