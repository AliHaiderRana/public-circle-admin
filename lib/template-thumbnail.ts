import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { resolveTemplateStorage, templateFileUrl } from './template-storage';

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

/**
 * Sample thumbnails live ONLY on the main server bucket:
 * sample-templates/{templateId}/thumbnail.png
 *
 * Do not use admin S3BUCKET — that bucket is for admin assets/archives only.
 */
export async function generateTemplateThumbnailUrl({
  html,
  templateId,
}: {
  html: string;
  templateId: string;
}) {
  if (!templateId) {
    throw new Error('templateId is required to store sample thumbnail');
  }

  const buffer = await renderThumbnailBuffer(html);
  const { bucket, region, s3Client } = resolveTemplateStorage();
  const key = `sample-templates/${templateId}/thumbnail.png`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      // the key is stable per template, so an edit must not serve the old preview
      CacheControl: 'public, max-age=60, must-revalidate',
    }),
  );

  return templateFileUrl({ bucket, region, key });
}
