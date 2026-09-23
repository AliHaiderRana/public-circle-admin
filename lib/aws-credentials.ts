/**
 * Amplify rejects env keys that start with AWS_. Use S3_* / SES_* / BACKUP_* /
 * ANALYTICS_* on Amplify. Vercel/GitHub can keep the old AWS_* names — those
 * are still read as fallbacks.
 *
 * S3 is always ca-central-1 (staging + production). SES is not: staging sends
 * from us-east-1, production from ca-central-1. Never reuse one region for both.
 */
const S3_DEFAULT_REGION = 'ca-central-1';
const SES_REGION_BY_ENV: Record<string, string> = {
  LOCAL: 'us-east-1',
  STAGING: 'us-east-1',
  PRODUCTION: 'ca-central-1',
};

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

function inferDeployEnv(): 'LOCAL' | 'STAGING' | 'PRODUCTION' | '' {
  const explicit = (process.env.ENVIRONMENT || process.env.APP_ENV || '')
    .trim()
    .toUpperCase();
  if (explicit === 'LOCAL' || explicit === 'STAGING' || explicit === 'PRODUCTION') {
    return explicit;
  }

  const bucket = getS3Bucket().toLowerCase();
  if (bucket.includes('staging')) return 'STAGING';
  if (bucket.includes('production') || bucket.includes('prod')) return 'PRODUCTION';

  const host = (
    process.env.ADMIN_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    ''
  ).toLowerCase();
  if (host.includes('staging')) return 'STAGING';
  if (host.includes('public-circle-admin.vercel.app')) return 'PRODUCTION';

  return '';
}

export function getS3Region(fallback = S3_DEFAULT_REGION): string {
  return firstEnv('S3_REGION', 'AWS_S3_REGION') || fallback;
}

/** S3 region. Kept as an alias so existing S3 callers stay correct. */
export function getAwsRegion(fallback = S3_DEFAULT_REGION): string {
  return getS3Region(fallback);
}

export function getSesRegion(): string {
  const deployEnv = inferDeployEnv();
  const byEnvironment = deployEnv
    ? firstEnv(`SES_REGION_${deployEnv}`)
    : '';
  return (
    byEnvironment ||
    firstEnv('SES_REGION', 'AWS_SES_REGION') ||
    (deployEnv ? SES_REGION_BY_ENV[deployEnv] : '') ||
    SES_REGION_BY_ENV.STAGING
  );
}

export function getAwsAccessKeyId(): string {
  return firstEnv('S3_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID');
}

export function getAwsSecretAccessKey(): string {
  return firstEnv('S3_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY');
}

export function getAwsCredentials(fallbackRegion = S3_DEFAULT_REGION): {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
} {
  return {
    region: getS3Region(fallbackRegion),
    accessKeyId: getAwsAccessKeyId(),
    secretAccessKey: getAwsSecretAccessKey(),
  };
}

export function getSesCredentials(): {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
} {
  return {
    region: getSesRegion(),
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
