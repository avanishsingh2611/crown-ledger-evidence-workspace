import { supabaseAdmin } from '../supabase';
import { config } from '../config';

export class StorageService {
  private bucketName = config.STORAGE_BUCKET;

  /**
   * Generates a time-limited signed URL for secure evidence file access
   * @param storagePath The relative path within the evidence-documents bucket
   * @param expiresInSeconds Duration in seconds before the signed link expires (default 300s)
   */
  async generateSignedUrl(
    storagePath: string,
    expiresInSeconds: number = config.SIGNED_URL_TTL_SECONDS,
    downloadFilename?: string
  ): Promise<{ signedUrl: string; expiresAt: string }> {
    // Normalize path by stripping bucket prefix if already present
    const cleanPath = storagePath.startsWith(`${this.bucketName}/`)
      ? storagePath.replace(`${this.bucketName}/`, '')
      : storagePath;

    try {
      const options = downloadFilename ? { download: downloadFilename } : undefined;
      const { data, error } = await supabaseAdmin.storage
        .from(this.bucketName)
        .createSignedUrl(cleanPath, expiresInSeconds, options);

      if (error) {
        console.error(`Supabase Storage signed URL error for ${cleanPath}:`, error.message);
        throw new Error(`Failed to generate signed URL from storage: ${error.message}`);
      }

      let fullSignedUrl = data?.signedUrl || '';
      if (fullSignedUrl && fullSignedUrl.startsWith('/')) {
        fullSignedUrl = `${config.SUPABASE_URL}${fullSignedUrl}`;
      }

      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
      return {
        signedUrl: fullSignedUrl,
        expiresAt,
      };
    } catch (err: any) {
      console.error('Failed to create signed URL:', err);
      throw new Error(err?.message || 'Storage service failed to generate signed download URL');
    }
  }

  /**
   * Upload a new version file to the private evidence-documents storage bucket
   */
  async uploadFile(
    storagePath: string,
    fileData: Buffer | Uint8Array | string,
    contentType: string = 'application/pdf'
  ): Promise<{ path: string; error?: string }> {
    const cleanPath = storagePath.startsWith(`${this.bucketName}/`)
      ? storagePath.replace(`${this.bucketName}/`, '')
      : storagePath;

    const { data, error } = await supabaseAdmin.storage
      .from(this.bucketName)
      .upload(cleanPath, fileData, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error('Storage upload error:', error.message);
      return { path: cleanPath, error: error.message };
    }

    return { path: data.path };
  }

  /**
   * Deletes an uploaded file (used for rollbacks when subsequent DB transactions fail)
   */
  async deleteFile(storagePath: string): Promise<boolean> {
    const cleanPath = storagePath.startsWith(`${this.bucketName}/`)
      ? storagePath.replace(`${this.bucketName}/`, '')
      : storagePath;

    try {
      const { error } = await supabaseAdmin.storage
        .from(this.bucketName)
        .remove([cleanPath]);

      if (error) {
        console.warn(`Warning: failed to delete storage file ${cleanPath}:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`Exception deleting storage file ${cleanPath}:`, err);
      return false;
    }
  }

  /**
   * Verifies if a file exists in the private evidence-documents storage bucket
   */
  async checkFileExists(storagePath: string): Promise<boolean> {
    const cleanPath = storagePath.startsWith(`${this.bucketName}/`)
      ? storagePath.replace(`${this.bucketName}/`, '')
      : storagePath;

    try {
      const lastSlash = cleanPath.lastIndexOf('/');
      const folder = lastSlash >= 0 ? cleanPath.substring(0, lastSlash) : '';
      const filename = lastSlash >= 0 ? cleanPath.substring(lastSlash + 1) : cleanPath;

      const { data, error } = await supabaseAdmin.storage
        .from(this.bucketName)
        .list(folder, { search: filename });

      if (error || !data) {
        return false;
      }

      return data.some((item) => item.name === filename);
    } catch {
      return false;
    }
  }

  /**
   * Verify storage bucket existence
   */
  async ensureBucket(): Promise<boolean> {
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const exists = buckets?.some((b) => b.name === this.bucketName);
      if (!exists) {
        await supabaseAdmin.storage.createBucket(this.bucketName, {
          public: false,
        });
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const storageService = new StorageService();
