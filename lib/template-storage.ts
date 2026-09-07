import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getAwsCredentials } from '@/lib/aws-credentials';

/**
 * Sample template files live on the main server bucket, never the admin bucket
 * (`S3BUCKET` here is the admin bucket for admin assets/archives only):
 *
 *   sample-templates/{templateId}/thumbnail.png
 *   sample-templates/{templateId}/template-images/{file}
 */
export function resolveTemplateStorage() {
  const bucket = (
    process.env.TEMPLATE_THUMBNAILS_BUCKET ||
    process.env.PUBLIC_CIRCLE_S3BUCKET ||
    ''
  ).trim();
  const { region, accessKeyId, secretAccessKey } = getAwsCredentials('');

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Sample template S3 storage is not configured (set TEMPLATE_THUMBNAILS_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY)',
    );
  }

  return {
    bucket,
    region,
    s3Client: new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export function templateFileUrl({
  bucket,
  region,
  key,
}: {
  bucket: string;
  region: string;
  key: string;
}) {
  const publicBaseUrl = process.env.TEMPLATE_THUMBNAIL_PUBLIC_BASE_URL?.trim();
  return publicBaseUrl
    ? `${publicBaseUrl.replace(/\/$/, '')}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export function sanitizeTemplateFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Keys are readable filenames, so a second upload of the same name would overwrite
 * an image another template may still render. Suffix instead.
 */
export async function buildSampleTemplateImageKey({
  s3Client,
  bucket,
  templateId,
  fileName,
}: {
  s3Client: S3Client;
  bucket: string;
  templateId: string;
  fileName: string;
}) {
  const safeName = sanitizeTemplateFileName(fileName) || `image-${Date.now()}`;
  const folder = `sample-templates/${templateId}/template-images`;
  const dot = safeName.lastIndexOf('.');
  const base = dot === -1 ? safeName : safeName.slice(0, dot);
  const extension = dot === -1 ? '' : safeName.slice(dot);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const key =
      attempt === 0
        ? `${folder}/${safeName}`
        : `${folder}/${base}-${Math.random().toString(16).slice(2, 8)}${extension}`;

    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
      return key;
    }
  }

  return `${folder}/${base}-${Date.now().toString(16)}${extension}`;
}
