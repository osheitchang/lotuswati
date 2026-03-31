import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

const isR2Configured =
  R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_URL;

let s3Client: S3Client | null = null;

if (isR2Configured) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Upload a media buffer to Cloudflare R2. Returns the public URL.
 * Throws if R2 is not configured.
 */
export async function uploadMedia(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  if (!s3Client || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error('[Storage] R2 is not configured');
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  const publicUrl = R2_PUBLIC_URL.replace(/\/$/, '');
  return `${publicUrl}/${filename}`;
}

interface DownloadedMedia {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

/**
 * Download media from WhatsApp using the media ID.
 * 1. Fetches the download URL from the Graph API.
 * 2. Downloads the actual file bytes.
 */
export async function downloadWhatsAppMedia(mediaId: string): Promise<DownloadedMedia> {
  const accessToken = process.env.WA_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('[Storage] WA_ACCESS_TOKEN is not set');
  }

  // Step 1: Get the media URL
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    throw new Error(
      `[Storage] Failed to fetch media metadata for ${mediaId}: ${metaRes.status} ${metaRes.statusText}`
    );
  }

  const meta = (await metaRes.json()) as { url: string; mime_type: string; id: string };

  if (!meta.url) {
    throw new Error(`[Storage] No URL returned for media ${mediaId}`);
  }

  // Step 2: Download the actual file
  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!fileRes.ok) {
    throw new Error(
      `[Storage] Failed to download media file for ${mediaId}: ${fileRes.status} ${fileRes.statusText}`
    );
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = meta.mime_type || 'application/octet-stream';

  // Derive a file extension from the mime type
  const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
  const filename = `media/${mediaId}.${ext}`;

  return { buffer, mimeType, filename };
}

/**
 * Fetch only the temporary download URL for a WhatsApp media object.
 * Lighter than downloadWhatsAppMedia — no file download, no R2 upload.
 * Used as a fallback when R2 is unavailable.
 */
export async function getWhatsAppMediaUrl(mediaId: string): Promise<{ url: string; mimeType: string }> {
  const accessToken = process.env.WA_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('[Storage] WA_ACCESS_TOKEN is not set');
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`[Storage] Failed to fetch media URL for ${mediaId}: ${res.status} ${res.statusText}`);
  }

  const meta = (await res.json()) as { url: string; mime_type: string };

  if (!meta.url) {
    throw new Error(`[Storage] No URL returned for media ${mediaId}`);
  }

  return { url: meta.url, mimeType: meta.mime_type || 'application/octet-stream' };
}

export const r2Enabled = Boolean(isR2Configured);
