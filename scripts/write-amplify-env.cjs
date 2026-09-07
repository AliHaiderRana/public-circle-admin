/**
 * Amplify console env vars are build-time only. Next.js API routes (login)
 * read .env.production at runtime — write the keys Next needs before `next build`.
 * JSON.stringify keeps Mongo passwords that contain `=>` intact.
 */
const fs = require('fs');

const KEYS = [
  'MONGODB_URI',
  'MONGODB_URL',
  'REFERRAL_APP_MONGODB_URL',
  'JWT_SECRET',
  'ACCESS_TOKEN_SECRET',
  'REFERRAL_APP_ACCESS_TOKEN_SECRET',
  'INTERNAL_API_KEY',
  'API_BASE_URL',
  'SERVER_API_URL',
  'PUBLIC_CIRCLE_APP_URL',
  'PUBLIC_CIRCLE_S3BUCKET',
  'PUBLIC_CIRCLES_EMAIL_ADDRESS',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_REGION',
  'S3BUCKET',
  'BACKUP_BUCKET',
  'ANALYTICS_BUCKETS',
  'STRIPE_SECRET_KEY',
  'TEMPLATE_THUMBNAILS_BUCKET',
  'ADMIN_CRON_TIMEZONE',
];

const keys = [
  ...KEYS,
  ...Object.keys(process.env).filter((key) => key.startsWith('NEXT_PUBLIC_')),
];

const lines = [...new Set(keys)]
  .filter((key) => process.env[key])
  .map((key) => `${key}=${JSON.stringify(process.env[key])}`);

fs.appendFileSync('.env.production', `${lines.join('\n')}\n`);
console.log(`[amplify-env] wrote ${lines.length} keys to .env.production`);
