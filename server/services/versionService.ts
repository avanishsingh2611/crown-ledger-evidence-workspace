import { DocumentVersionRecord } from '../types';
import { documentService } from './documentService';

export class VersionService {
  /**
   * List all versions for a document in historical order
   */
  async getVersionsForDocument(documentId: string): Promise<DocumentVersionRecord[] | null> {
    const doc = await documentService.getDocumentById(documentId);
    if (!doc) return null;
    return doc.versions.slice().sort((a, b) => b.versionNumber - a.versionNumber);
  }

  /**
   * Get specific version by ID or version number
   */
  async getVersionById(
    documentId: string,
    versionIdOrNumber: string
  ): Promise<DocumentVersionRecord | null> {
    const doc = await documentService.getDocumentById(documentId);
    if (!doc) return null;

    return (
      doc.versions.find(
        (v) =>
          v.id === versionIdOrNumber ||
          v.versionNumber.toString() === versionIdOrNumber
      ) || null
    );
  }
}

export const versionService = new VersionService();
