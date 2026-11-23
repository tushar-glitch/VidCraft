import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AwsClient } from 'aws4fetch';

export interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

/**
 * Object storage over the S3 protocol (MinIO locally, Cloudflare R2 in production).
 * aws4fetch only signs requests with the S3 signature scheme; nothing talks to AWS.
 */
export class ObjectStorage {
  private readonly client: AwsClient;
  private readonly baseUrl: string;

  constructor(config: StorageConfig) {
    this.client = new AwsClient({
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
      region: config.region,
      service: 's3',
    });
    this.baseUrl = `${config.endpoint.replace(/\/$/, '')}/${config.bucket}`;
  }

  private url(key: string): string {
    return `${this.baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  private async presign(method: 'GET' | 'PUT', key: string, expiresInSec: number, query: Record<string, string> = {}) {
    const url = new URL(this.url(key));
    url.searchParams.set('X-Amz-Expires', String(expiresInSec));
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const signed = await this.client.sign(url.toString(), { method, aws: { signQuery: true } });
    return signed.url;
  }

  /** URL the browser can PUT a file to directly. */
  presignUpload(key: string, expiresInSec = 3600): Promise<string> {
    return this.presign('PUT', key, expiresInSec);
  }

  /** Short-lived download URL that saves the file as `fileName`. */
  presignDownload(key: string, fileName: string, expiresInSec = 3600): Promise<string> {
    const safeName = fileName.replace(/["\\\r\n]/g, '_');
    return this.presign('GET', key, expiresInSec, {
      'response-content-disposition': `attachment; filename="${safeName}"`,
    });
  }

  /** Size in bytes, or null if the object does not exist. */
  async size(key: string): Promise<number | null> {
    const res = await this.client.fetch(this.url(key), { method: 'HEAD' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Storage HEAD ${key} failed: ${res.status}`);
    return Number(res.headers.get('content-length'));
  }

  async downloadToFile(key: string, filePath: string): Promise<void> {
    const res = await this.client.fetch(this.url(key));
    if (!res.ok || !res.body) throw new Error(`Storage GET ${key} failed: ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(filePath));
  }

  async uploadFile(key: string, filePath: string, contentType: string): Promise<void> {
    const { size } = await stat(filePath);
    const res = await this.client.fetch(this.url(key), {
      method: 'PUT',
      // Stream instead of buffering the whole video in memory.
      body: Readable.toWeb(createReadStream(filePath)) as ReadableStream,
      headers: {
        'content-type': contentType,
        'content-length': String(size),
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      },
      // Required by Node's fetch for streamed request bodies.
      duplex: 'half',
    } as RequestInit);
    if (!res.ok) throw new Error(`Storage PUT ${key} failed: ${res.status} ${await res.text()}`);
  }

  async remove(key: string): Promise<void> {
    const res = await this.client.fetch(this.url(key), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`Storage DELETE ${key} failed: ${res.status}`);
  }
}
