import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CronMetadata from '@/lib/models/CronMetadata';
import { getServerSession } from '@/lib/auth';

/**
 * GET /api/crons
 * List all cron jobs with their metadata
 */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  
  try {
    const crons = await CronMetadata.find({})
      .sort({ displayName: 1 })
      .lean();
    
    return NextResponse.json({
      message: 'Crons fetched successfully',
      crons,
    });
  } catch (error: any) {
    console.error('[API] Error fetching crons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch crons', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crons
 * Seed cron metadata (for initial setup)
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === 'seed') {
      // Seed cron definitions
      const CRON_DEFINITIONS = [
        {
          name: "runCampaign",
          displayName: "Run Campaign",
          schedule: "*/1 * * * *",
          description: "Processes pending, recurring, and ongoing campaigns every minute",
        },
        {
          name: "stripeInvoice",
          displayName: "Stripe Invoice",
          schedule: "0 0 * * *",
          description: "Calculates and charges contact overage for companies with Stripe customers daily at midnight",
        },
        {
          name: "getDlqInfo",
          displayName: "Get DLQ Info",
          schedule: "*/10 * * * *",
          description: "Checks for messages in the Dead Letter Queue every 10 minutes and sends notifications",
        },
        {
          name: "campaignRunStat",
          displayName: "Campaign Run Stats",
          schedule: "0 0 0 * * *",
          description: "Archives campaign email data older than 2 months to S3 and updates statistics daily at midnight",
        },
        {
          name: "updateSuppressionTrack",
          displayName: "Update Suppression Track",
          schedule: "0 4 * * *",
          description: "Updates suppression tracking for bounced and complained emails daily at 4 AM",
        },
        {
          name: "deleteCompanyContacts",
          displayName: "Delete Company Contacts",
          schedule: "0 6 * * *",
          description: "Permanently deletes soft-deleted company contacts older than configured days at 6 AM",
        },
        {
          name: "sesHealthMonitor",
          displayName: "SES Health Monitor",
          schedule: "0 0,12 * * *",
          description: "Monitors email complaint and bounce rates, updates company status twice daily",
        },
        {
          name: "deleteOldNotifications",
          displayName: "Delete Old Notifications",
          schedule: "0 1 * * *",
          description: "Deletes notifications older than 30 days daily at 1 AM",
        },
      ];

      const operations = CRON_DEFINITIONS.map((cron) => ({
        updateOne: {
          filter: { name: cron.name },
          update: {
            $set: {
              displayName: cron.displayName,
              schedule: cron.schedule,
              description: cron.description,
            },
            $setOnInsert: {
              name: cron.name,
              lastRunAt: null,
              lastRecordsUpdated: 0,
              isEnabled: true,
            },
          },
          upsert: true,
        },
      }));

      await CronMetadata.bulkWrite(operations, { ordered: false });
      
      const crons = await CronMetadata.find({}).sort({ displayName: 1 }).lean();
      
      return NextResponse.json({
        message: 'Cron metadata seeded successfully',
        crons,
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[API] Error in crons POST:', error);
    return NextResponse.json(
      { error: 'Operation failed', details: error.message },
      { status: 500 }
    );
  }
}
