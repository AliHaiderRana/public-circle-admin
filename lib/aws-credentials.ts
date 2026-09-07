/**
 * Amplify rejects env keys that start with AWS_. Use S3_* / SES_* / BACKUP_* /
 * ANALYTICS_* on Amplify. Vercel/GitHub can keep the old AWS_* names — those
 * are still read as fallbacks.
 */
function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

export function getAwsRegion(fallback = 'ca-central-1'): string {
  return firstEnv('S3_REGION', 'SES_REGION', 'AWS_REGION', 'AWS_SES_REGION') || fallback;
}

export function getAwsAccessKeyId(): string {
  return firstEnv('S3_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID');
}

export function getAwsSecretAccessKey(): string {
  return firstEnv('S3_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY');
}

export function getAwsCredentials(fallbackRegion = 'ca-central-1'): {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
} {
  return {
    region: getAwsRegion(fallbackRegion),
    accessKeyId: getAwsAccessKeyId(),
    secretAccessKey: getAwsSecretAccessKey(),
  };
}

export function getS3Bucket(): string {
  return firstEnv(
    'S3BUCKET',
    'S3_BUCKET',
    'AWS_S3_BUCKET',
    'TEMPLATE_THUMBNAILS_BUCKET'
  );
}

export function getBackupBucket(): string {
  return firstEnv('BACKUP_BUCKET', 'AWS_BACKUP_BUCKET');
}

export function getAnalyticsBucketsRaw(): string {
  return firstEnv('ANALYTICS_BUCKETS', 'AWS_ANALYTICS_BUCKETS');
}
