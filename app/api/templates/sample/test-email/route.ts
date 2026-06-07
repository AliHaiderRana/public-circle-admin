import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sendTestEmailSchema = z.object({
  toEmailAddresses: z.string().min(1, 'Recipient email(s) are required'),
  emailSubject: z.string().min(1, 'Email subject is required'),
  html: z.string().min(1, 'Email HTML is required'),
});

const emailSchema = z.string().email('Invalid email address');
const TEST_FROM_EMAIL = 'test@publiccircles.com';

function parseRecipientEmails(raw: string) {
  const emails = raw
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

  const uniqueEmails = Array.from(new Set(emails));

  if (!uniqueEmails.length) {
    throw new Error('Please provide at least one recipient email address.');
  }

  for (const email of uniqueEmails) {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      throw new Error(`Invalid email address: ${email}`);
    }
  }

  return uniqueEmails;
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = sendTestEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      );
    }

    const recipients = parseRecipientEmails(parsed.data.toEmailAddresses);
    const sourceEmailAddress = TEST_FROM_EMAIL;

    const region = (process.env.AWS_REGION || '').trim() || 'ca-central-1';
    const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();

    if (!accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { error: 'AWS credentials are missing. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.' },
        { status: 500 }
      );
    }

    const sesClient = new SESClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const sendResults = await Promise.allSettled(
      recipients.map((email) =>
        sesClient.send(
          new SendEmailCommand({
            Source: sourceEmailAddress,
            Destination: {
              ToAddresses: [email],
            },
            Message: {
              Subject: {
                Data: parsed.data.emailSubject,
                Charset: 'UTF-8',
              },
              Body: {
                Html: {
                  Data: parsed.data.html,
                  Charset: 'UTF-8',
                },
              },
            },
          })
        )
      )
    );

    const sent = sendResults.filter((result) => result.status === 'fulfilled').length;
    const failedRecipients = sendResults
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ index }) => recipients[index]);

    if (failedRecipients.length) {
      return NextResponse.json(
        {
          error: 'Some test emails failed to send.',
          sent,
          failed: failedRecipients,
        },
        { status: sent > 0 ? 207 : 502 }
      );
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_TEST_EMAIL,
        category: ADMIN_AUDIT_CATEGORY.TEMPLATE,
        resourceType: 'sample_template_test_email',
        details: {
          recipients,
          emailSubject: parsed.data.emailSubject,
          sent,
        },
      });
    }

    return NextResponse.json({
      message: 'Test email(s) sent successfully.',
      sent,
      sourceEmailAddress,
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to send test email(s).';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
