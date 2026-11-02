import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { AppEnvConfig } from '../config/env';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const FORBIDDEN_EXTENSIONS = new Set([
  '.exe',
  '.sh',
  '.bat',
  '.cmd',
  '.js',
  '.mjs',
  '.cjs',
  '.php',
  '.py',
  '.dll',
  '.so',
]);

export interface UploadFilePayload {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  base64Content?: string;
  isPrivate: boolean;
}

export interface StoredFileMetadata {
  fileKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isPrivate: boolean;
}

export class FileStorageService {
  private readonly config: AppEnvConfig;

  constructor(config: AppEnvConfig) {
    this.config = config;
    fs.mkdirSync(this.config.localPrivateStorageDir, { recursive: true });
    fs.mkdirSync(this.config.localPublicStorageDir, { recursive: true });
  }

  validateFileUpload(payload: UploadFilePayload): void {
    const ext = path.extname(payload.fileName || '').toLowerCase();
    if (FORBIDDEN_EXTENSIONS.has(ext)) {
      throw new Error('INVALID_FILE_TYPE: Executable or script files are strictly prohibited.');
    }
    if (!ALLOWED_MIME_TYPES.has(payload.mimeType)) {
      throw new Error(
        'INVALID_MIME_TYPE: শুধুমাত্র PDF, JPG, PNG অথবা WEBP ফাইল আপলোড করা যাবে।'
      );
    }
    if (payload.sizeBytes <= 0 || payload.sizeBytes > this.config.maxUploadFileSizeBytes) {
      throw new Error(
        `FILE_TOO_LARGE: ফাইলের আকার সর্বোচ্চ ${Math.round(
          this.config.maxUploadFileSizeBytes / (1024 * 1024)
        )}MB হতে পারবে।`
      );
    }
  }

  saveFile(payload: UploadFilePayload): StoredFileMetadata {
    this.validateFileUpload(payload);
    const safeBase = path
      .basename(payload.fileName)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 64);
    const fileKey = `${payload.isPrivate ? 'priv' : 'pub'}_${crypto.randomUUID()}_${safeBase}`;
    const targetDir = payload.isPrivate
      ? this.config.localPrivateStorageDir
      : this.config.localPublicStorageDir;
    const fullPath = path.join(targetDir, fileKey);

    const buffer = payload.base64Content
      ? Buffer.from(payload.base64Content, 'base64')
      : Buffer.from(`Sample verified document placeholder for ${safeBase}`);
    fs.writeFileSync(fullPath, buffer);

    return {
      fileKey,
      fileName: safeBase,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
      isPrivate: payload.isPrivate,
    };
  }

  createSignedToken(fileKey: string, userId: string, ttlSeconds = 300): string {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const data = `${fileKey}:${userId}:${exp}`;
    const sig = crypto
      .createHmac('sha256', this.config.fileSigningSecret)
      .update(data)
      .digest('hex');
    return Buffer.from(`${data}:${sig}`).toString('base64url');
  }

  verifySignedToken(token: string, expectedFileKey: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const [fileKey, userId, expStr, sig] = decoded.split(':');
      if (fileKey !== expectedFileKey) return false;
      const exp = Number(expStr);
      if (!exp || Math.floor(Date.now() / 1000) > exp) return false;
      const expectedSig = crypto
        .createHmac('sha256', this.config.fileSigningSecret)
        .update(`${fileKey}:${userId}:${expStr}`)
        .digest('hex');
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
    } catch {
      return false;
    }
  }
}
