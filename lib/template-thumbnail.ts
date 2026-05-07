import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const FALLBACK_HTML =
  '<div style="font-family:Arial,sans-serif;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f5f5f5;color:#333;">Template</div>';

async function resolveExecutablePath() {
  if (process.env.VERCEL) {
    return chromium.executablePath();
  }
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_BIN) {
    return process.env.CHROME_BIN;
  }
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  return '/usr/bin/google-chrome';
}

function normalizeHtml(html: string) {
  const cleaned = (html || '').trim();
  if (!cleaned) {
    return `<!doctype html><html><head><meta charset="utf-8" /></head><body>${FALLBACK_HTML}</body></html>`;
  }
  if (/<html[\s>]/i.test(cleaned)) return cleaned;
  return `<!doctype html><html><head><meta charset="utf-8" /></head><body>${cleaned}</body></html>`;
}

function sanitizeFilename(value = '') {
  return String(value)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.-]/g, '')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function createS3Client() {
  const region = process.env.AWS_REGION || process.env.S3_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

async function renderThumbnailBuffer(html: string) {
  const executablePath = await resolveExecutablePath();
  const isServerless = Boolean(process.env.VERCEL);
  const browser = await puppeteer.launch({
    executablePath,
    args: isServerless
      ? chromium.args
      : ['--disable-web-security'],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(normalizeHtml(html), {
      waitUntil: 'load',
    });
    const screenshotBuffer = await page.screenshot({
      type: 'png',
    });

    return Buffer.from(screenshotBuffer);
  } finally {
    await browser.close();
  }
}

export async function generateTemplateThumbnailUrl({
  html,
  templateName,
}: {
  html: string;
  templateName?: string;
}) {
  const buffer = await renderThumbnailBuffer(html);

  const bucket =
    process.env.S3BUCKET ||
    process.env.AWS_S3_BUCKET ||
    process.env.TEMPLATE_THUMBNAILS_BUCKET;
  const region = process.env.AWS_REGION || process.env.S3_REGION;
  const s3Client = createS3Client();

  if (!bucket || !region || !s3Client) {
    throw new Error('S3 thumbnail configuration is missing');
  }

  const basename = sanitizeFilename(templateName || 'sample-template') || 'sample-template';
  const key = `thumbnails/admin/${basename}.png`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const publicBaseUrl = process.env.TEMPLATE_THUMBNAIL_PUBLIC_BASE_URL?.trim();
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}
