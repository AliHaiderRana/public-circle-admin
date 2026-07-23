import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import dbConnect from '@/lib/db';
import AppConfig from '@/lib/models/AppConfig';
import {
  getClusterName,
  getClusterWideStats,
  listClusterDatabases,
} from '@/lib/db-analytics.server';
import { getSystemNotifications } from '@/lib/system-notifications.server';

// Decimal GB, matching the formatBytes() convention used across DB Analytics.
export const DB_STORAGE_ALERT_THRESHOLD_BYTES = 4 * 1000 * 1000 * 1000;

const FROM_EMAIL = (process.env.PUBLIC_CIRCLES_EMAIL_ADDRESS || 'test@publiccircles.com').trim();

function formatGb(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

async function sendDbStorageAlertEmail(
  recipients: string[],
  totalSize: number,
  clusterName: string | null,
) {
  const region = (process.env.AWS_REGION || '').trim() || 'ca-central-1';
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials are missing. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
  }

  const sesClient = new SESClient({ region, credentials: { accessKeyId, secretAccessKey } });
  const subject = `MongoDB cluster storage crossed ${formatGb(DB_STORAGE_ALERT_THRESHOLD_BYTES)}`;
  const html = `
    <p>Total storage across ${clusterName ? `<strong>${clusterName}</strong>` : 'your MongoDB cluster'} has reached <strong>${formatGb(totalSize)}</strong>, crossing the ${formatGb(DB_STORAGE_ALERT_THRESHOLD_BYTES)} alert threshold.</p>
    <p>Open Database Analytics in the admin panel for a full breakdown by database and collection.</p>
  `.trim();

  await Promise.all(
    recipients.map((email) =>
      sesClient.send(
        new SendEmailCommand({
          Source: FROM_EMAIL,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Html: { Data: html, Charset: 'UTF-8' } },
          },
        }),
      ),
    ),
  );
}

export async function checkAndSendDbStorageAlert() {
  await dbConnect();

  const notifications = await getSystemNotifications();
  const databases = await listClusterDatabases();
  const stats = await getClusterWideStats(databases);
  const totalSize = stats.totalSize;
  const breached = totalSize >= DB_STORAGE_ALERT_THRESHOLD_BYTES;

  let config = await AppConfig.findOne();
  if (!config) {
    config = await AppConfig.create({});
  }
  const wasBreached = Boolean(config.dbAlertThresholdBreached);

  let alertSent = false;
  let alertError: string | null = null;
  const recipients = notifications.dbRecipients.map((r) => r.email);

  if (breached && !wasBreached && notifications.dbSendAlertEmail && recipients.length > 0) {
    try {
      await sendDbStorageAlertEmail(recipients, totalSize, getClusterName());
      alertSent = true;
    } catch (err) {
      alertError = err instanceof Error ? err.message : 'Failed to send DB storage alert email';
    }
  }

  if (breached !== wasBreached) {
    config.dbAlertThresholdBreached = breached;
    await config.save();
  }

  return {
    totalSize,
    thresholdBytes: DB_STORAGE_ALERT_THRESHOLD_BYTES,
    breached,
    alertSent,
    recipientCount: recipients.length,
    failedDatabases: stats.failedDatabases,
    error: alertError,
  };
}
