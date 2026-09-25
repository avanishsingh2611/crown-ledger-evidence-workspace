import {
  DocumentRecord,
  DocumentVersionRecord,
  DocumentClassification,
  DocumentReviewStatus,
  ReviewRecord,
  AuthUserProfile,
  DocumentFilterParams,
} from '../types';
import { supabaseAdmin } from '../supabase';
import { matterService } from './matterService';

export class DocumentService {
  /**
   * Adapts a raw Supabase database document row into a canonical DocumentRecord
   */
  private adaptDbDocument(d: any): DocumentRecord {
    const rawVersions = d.versions || [];
    const versions: DocumentVersionRecord[] = rawVersions
      .map((v: any) => ({
        id: v.id,
        documentId: v.document_id,
        versionNumber: v.version_number,
        originalFilename: v.original_filename,
        storagePath: v.storage_path,
        fileSizeBytes: Number(v.file_size_bytes || 0),
        fileSizeFormatted: `${(Number(v.file_size_bytes || 0) / (1024 * 1024)).toFixed(1)} MB`,
        mimeType: v.mime_type || 'application/pdf',
        sha256Hash: v.sha256_checksum || '',
        uploadedBy: v.uploaded_by,
        uploadedByName: v.uploader?.full_name || 'Authorized Member',
        changeSummary: v.change_summary || '',
        isCurrent: v.version_number === d.current_version_number,
        createdAt: v.created_at,
      }))
      .sort((a: any, b: any) => b.versionNumber - a.versionNumber);

    const currentVer =
      versions.find((v) => v.versionNumber === d.current_version_number) ||
      versions[0] || {
        id: `v-${d.id}-1`,
        documentId: d.id,
        versionNumber: d.current_version_number || 1,
        originalFilename: 'document.pdf',
        storagePath: '',
        fileSizeBytes: 0,
        fileSizeFormatted: '0.0 MB',
        mimeType: 'application/pdf',
        sha256Hash: '',
        uploadedBy: d.created_by,
        uploadedByName: d.creator?.full_name || 'Authorized Member',
        changeSummary: 'Initial document record',
        isCurrent: true,
        createdAt: d.created_at,
      };

    const latestReview = (d.reviews || []).sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    const reviewRecord: ReviewRecord | undefined = latestReview
      ? {
          id: latestReview.id,
          documentId: latestReview.document_id,
          documentVersionId: latestReview.document_version_id,
          assignedToId: latestReview.assigned_to,
          assignedToName: latestReview.assignee?.full_name || 'Assigned Reviewer',
          requestedById: latestReview.requested_by,
          requestedByName: latestReview.requester?.full_name || 'Authorized Member',
          status: latestReview.status,
          decisionNotes: latestReview.decision_notes,
          completedAt: latestReview.completed_at,
          createdAt: latestReview.created_at,
        }
      : undefined;

    return {
      id: d.id,
      matterId: d.matter_id,
      matterReference: d.matter?.reference_code || '',
      matterTitle: d.matter?.title || '',
      title: d.title,
      classification: (d.classification?.toLowerCase() || 'internal') as DocumentClassification,
      reviewStatus: d.review_status,
      currentVersionNumber: d.current_version_number,
      currentVersion: currentVer,
      versions,
      reviewRecord,
      tags: d.tags || [],
      createdBy: d.created_by,
      creatorName: d.creator?.full_name || 'Authorized Member',
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  }

  /**
   * Get all documents with optional filters directly from Supabase PostgreSQL
   */
  async getAllDocuments(
    filters?: DocumentFilterParams,
    user?: AuthUserProfile
  ): Promise<DocumentRecord[]> {
    let query = supabaseAdmin.from('documents').select(`
      id,
      matter_id,
      title,
      classification,
      review_status,
      current_version_number,
      tags,
      is_archived,
      created_by,
      created_at,
      updated_at,
      matter:matters!matter_id (
        id,
        reference_code,
        title
      ),
      creator:profiles!created_by (
        id,
        full_name
      ),
      versions:document_versions (
        id,
        document_id,
        version_number,
        original_filename,
        file_extension,
        mime_type,
        file_size_bytes,
        storage_path,
        sha256_checksum,
        change_summary,
        uploaded_by,
        created_at,
        uploader:profiles!uploaded_by (
          id,
          full_name
        )
      ),
      reviews:reviews (
        id,
        document_id,
        document_version_id,
        assigned_to,
        requested_by,
        status,
        decision_notes,
        completed_at,
        created_at,
        assignee:profiles!assigned_to (
          id,
          full_name
        ),
        requester:profiles!requested_by (
          id,
          full_name
        )
      )
    `).order('created_at', { ascending: false });

    if (filters?.reviewStatus && filters.reviewStatus !== 'all') {
      query = query.eq('review_status', filters.reviewStatus);
    }

    if (filters?.classification && filters.classification !== 'all') {
      query = query.ilike('classification', filters.classification);
    }

    const { data: dbDocs, error } = await query;

    if (error) {
      console.error('Failed to query public.documents from Supabase:', error.message);
      throw new Error(`Database error fetching documents: ${error.message}`);
    }

    if (!dbDocs) {
      return [];
    }

    let documents = dbDocs.map((d: any) => this.adaptDbDocument(d));

    // Enforce matter-level filtering for non-admin counsel
    if (user && user.role !== 'workspace_admin' && user.role !== 'auditor') {
      const allowedMatters = await matterService.getMattersForUser(user);
      const allowedMatterIds = new Set(allowedMatters.map((m) => m.id));
      documents = documents.filter((doc) => allowedMatterIds.has(doc.matterId));
    }

    // Filter by specific matter ID or reference code
    if (filters?.matterId && filters.matterId !== 'all') {
      const target = filters.matterId.toLowerCase();
      documents = documents.filter(
        (d) =>
          d.matterId.toLowerCase() === target ||
          d.matterReference.toLowerCase() === target
      );
    }

    // Filter by search query
    if (filters?.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase();
      documents = documents.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.matterReference.toLowerCase().includes(q) ||
          d.matterTitle.toLowerCase().includes(q) ||
          d.currentVersion.originalFilename.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Filter by SHA-256 hash (exact or prefix match)
    if (filters?.sha256Hash && filters.sha256Hash.trim() !== '') {
      const targetHash = filters.sha256Hash.trim().toLowerCase();
      documents = documents.filter(
        (d) =>
          d.currentVersion.sha256Hash.toLowerCase().includes(targetHash) ||
          d.versions.some((v) => v.sha256Hash.toLowerCase().includes(targetHash))
      );
    }

    // Filter by file type / extension
    if (filters?.fileType && filters.fileType !== 'all') {
      const targetType = filters.fileType.toLowerCase().replace(/^\./, '');
      documents = documents.filter((d) => {
        const ext = d.currentVersion.originalFilename.split('.').pop()?.toLowerCase() || '';
        const mime = d.currentVersion.mimeType.toLowerCase();
        if (targetType === 'image') {
          return ['png', 'jpg', 'jpeg', 'tiff', 'tif'].includes(ext) || mime.startsWith('image/');
        }
        return ext === targetType || mime.includes(targetType);
      });
    }

    // Filter by uploader ID
    if (filters?.uploaderId && filters.uploaderId !== 'all') {
      const targetUploader = filters.uploaderId.toLowerCase();
      documents = documents.filter(
        (d) =>
          d.createdBy.toLowerCase() === targetUploader ||
          d.currentVersion.uploadedBy.toLowerCase() === targetUploader
      );
    }

    // Pagination
    if (filters?.offset && filters.offset > 0) {
      documents = documents.slice(filters.offset);
    }
    if (filters?.limit && filters.limit > 0) {
      documents = documents.slice(0, filters.limit);
    }

    return documents;
  }

  /**
   * Find a single document by ID from Supabase PostgreSQL
   */
  async getDocumentById(id: string): Promise<DocumentRecord | null> {
    const { data: dbDoc, error } = await supabaseAdmin
      .from('documents')
      .select(`
        id,
        matter_id,
        title,
        classification,
        review_status,
        current_version_number,
        tags,
        is_archived,
        created_by,
        created_at,
        updated_at,
        matter:matters!matter_id (
          id,
          reference_code,
          title
        ),
        creator:profiles!created_by (
          id,
          full_name
        ),
        versions:document_versions (
          id,
          document_id,
          version_number,
          original_filename,
          file_extension,
          mime_type,
          file_size_bytes,
          storage_path,
          sha256_checksum,
          change_summary,
          uploaded_by,
          created_at,
          uploader:profiles!uploaded_by (
            id,
            full_name
          )
        ),
        reviews:reviews (
          id,
          document_id,
          document_version_id,
          assigned_to,
          requested_by,
          status,
          decision_notes,
          completed_at,
          created_at,
          assignee:profiles!assigned_to (
            id,
            full_name
          ),
          requester:profiles!requested_by (
            id,
            full_name
          )
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch document ${id} from Supabase:`, error.message);
      throw new Error(`Database error retrieving document: ${error.message}`);
    }

    if (!dbDoc) {
      return null;
    }

    return this.adaptDbDocument(dbDoc);
  }

  /**
   * Update document review status in Supabase PostgreSQL
   */
  async updateReviewStatus(
    documentId: string,
    status: DocumentReviewStatus,
    reviewRecord?: any
  ): Promise<DocumentRecord | null> {
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        review_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      console.error(`Failed to update review status for doc ${documentId}:`, updateError.message);
      throw new Error(`Database error updating review status: ${updateError.message}`);
    }

    return await this.getDocumentById(documentId);
  }

  /**
   * Create a new document and its initial version in Supabase PostgreSQL
   */
  async createDocument(data: {
    matterId: string;
    matterReference: string;
    matterTitle: string;
    title: string;
    classification: DocumentClassification;
    reviewStatus?: DocumentReviewStatus;
    tags?: string[];
    creatorId: string;
    creatorName: string;
    filename: string;
    storagePath: string;
    fileSizeBytes: number;
    mimeType: string;
    sha256Hash: string;
    changeSummary: string;
  }): Promise<DocumentRecord> {
    // 1. Insert document record into public.documents
    const { data: newDoc, error: docError } = await supabaseAdmin
      .from('documents')
      .insert([
        {
          matter_id: data.matterId,
          case_id: data.matterId,
          title: data.title,
          classification: data.classification.toUpperCase(),
          document_type: 'FORENSIC_REPORT',
          review_status: data.reviewStatus || 'needs_review',
          current_version_number: 1,
          tags: data.tags || [],
          created_by: data.creatorId,
          uploaded_by: data.creatorId,
          file_name: data.filename,
          storage_path: data.storagePath,
          file_size: data.fileSizeBytes,
          file_type: data.mimeType || 'application/pdf',
        },
      ])
      .select()
      .single();

    if (docError || !newDoc) {
      console.error('Failed to insert document into Supabase:', docError?.message);
      throw new Error(`Database error creating document: ${docError?.message || 'Insert failed'}`);
    }

    // 2. Insert initial version into public.document_versions
    const fileExt = data.filename.split('.').pop() || 'pdf';
    const { error: verError } = await supabaseAdmin
      .from('document_versions')
      .insert([
        {
          document_id: newDoc.id,
          version_number: 1,
          original_filename: data.filename,
          file_extension: fileExt,
          mime_type: data.mimeType || 'application/pdf',
          file_size_bytes: data.fileSizeBytes,
          storage_path: data.storagePath,
          sha256_checksum: data.sha256Hash,
          change_summary: data.changeSummary || 'Initial document upload',
          uploaded_by: data.creatorId,
        },
      ]);

    if (verError) {
      console.error('Failed to insert initial document version into Supabase:', verError.message);
      throw new Error(`Database error creating document version: ${verError.message}`);
    }

    const created = await this.getDocumentById(newDoc.id);
    if (!created) {
      throw new Error('Document was created but could not be re-queried from database');
    }

    return created;
  }

  /**
   * Add a new version to an existing document in Supabase PostgreSQL
   */
  async addDocumentVersion(
    documentId: string,
    versionData: {
      originalFilename: string;
      storagePath: string;
      fileSizeBytes: number;
      mimeType: string;
      sha256Hash: string;
      uploadedBy: string;
      uploadedByName: string;
      changeSummary: string;
    }
  ): Promise<{ document: DocumentRecord; version: DocumentVersionRecord } | null> {
    const doc = await this.getDocumentById(documentId);
    if (!doc) return null;

    const nextVersionNumber = doc.currentVersionNumber + 1;
    const fileExt = versionData.originalFilename.split('.').pop() || 'pdf';

    // 1. Insert new version record into public.document_versions
    const { data: newVer, error: verError } = await supabaseAdmin
      .from('document_versions')
      .insert([
        {
          document_id: documentId,
          version_number: nextVersionNumber,
          original_filename: versionData.originalFilename,
          file_extension: fileExt,
          mime_type: versionData.mimeType || 'application/pdf',
          file_size_bytes: versionData.fileSizeBytes,
          storage_path: versionData.storagePath,
          sha256_checksum: versionData.sha256Hash,
          change_summary: versionData.changeSummary,
          uploaded_by: versionData.uploadedBy,
        },
      ])
      .select()
      .single();

    if (verError || !newVer) {
      console.error(`Failed to add version ${nextVersionNumber} for doc ${documentId}:`, verError?.message);
      throw new Error(`Database error creating version: ${verError?.message || 'Insert failed'}`);
    }

    // 2. Update current_version_number in public.documents
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        current_version_number: nextVersionNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      console.error(`Failed to update current_version_number for doc ${documentId}:`, updateError.message);
    }

    const updatedDoc = await this.getDocumentById(documentId);
    if (!updatedDoc) {
      throw new Error('Version created but updated document could not be retrieved');
    }

    const versionRecord: DocumentVersionRecord = {
      id: newVer.id,
      documentId,
      versionNumber: nextVersionNumber,
      originalFilename: versionData.originalFilename,
      storagePath: versionData.storagePath,
      fileSizeBytes: versionData.fileSizeBytes,
      fileSizeFormatted: `${(versionData.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`,
      mimeType: versionData.mimeType,
      sha256Hash: versionData.sha256Hash,
      uploadedBy: versionData.uploadedBy,
      uploadedByName: versionData.uploadedByName,
      changeSummary: versionData.changeSummary,
      isCurrent: true,
      createdAt: newVer.created_at,
    };

    return { document: updatedDoc, version: versionRecord };
  }
}

export const documentService = new DocumentService();
