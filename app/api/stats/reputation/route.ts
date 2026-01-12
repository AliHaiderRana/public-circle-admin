import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import EmailsSent from '@/lib/models/EmailsSent';
import { getServerSession } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    // Get total emails for rate calculations
    const totalEmails = await EmailsSent.countDocuments({});

    // Calculate bounce and complaint rates from emailEvents
    const emailsWithEvents = await EmailsSent.find({
      $or: [
        { 'emailEvents.Bounce': { $exists: true } },
        { 'emailEvents.Complaint': { $exists: true } }
      ]
    });

    let bouncedEmails = 0;
    let complainedEmails = 0;
    let deliveredEmails = 0;

    emailsWithEvents.forEach(email => {
      if (email.emailEvents) {
        // Check for Bounce events
        if (email.emailEvents.Bounce) {
          bouncedEmails++;
        }
        // Check for Complaint events
        if (email.emailEvents.Complaint) {
          complainedEmails++;
        }
        // Check for Delivery events (if they exist)
        if (email.emailEvents.Delivery) {
          deliveredEmails++;
        }
      }
    });

    const bounceRate = totalEmails > 0 ? (bouncedEmails / totalEmails * 100).toFixed(2) : '0';
    const complaintRate = totalEmails > 0 ? (complainedEmails / totalEmails * 100).toFixed(2) : '0';

    // Generate historical data for the last 30 days for the graph
    const reputationData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      
      const dayEmails = await EmailsSent.find({
        createdAt: { $gte: dayStart, $lt: dayEnd },
        $or: [
          { 'emailEvents.Bounce': { $exists: true } },
          { 'emailEvents.Complaint': { $exists: true } }
        ]
      });
      
      let dayBounced = 0;
      let dayComplained = 0;
      let dayTotal = dayEmails.length;
      
      dayEmails.forEach(email => {
        if (email.emailEvents) {
          if (email.emailEvents.Bounce) dayBounced++;
          if (email.emailEvents.Complaint) dayComplained++;
        }
      });
      
      reputationData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        bounceRate: dayTotal > 0 ? (dayBounced / dayTotal * 100) : 0,
        complaintRate: dayTotal > 0 ? (dayComplained / dayTotal * 100) : 0,
        totalEmails: dayTotal
      });
    }

    // Determine status based on rates
    let status = 'Healthy';
    const bounceRateNum = parseFloat(bounceRate);
    const complaintRateNum = parseFloat(complaintRate);
    
    if (bounceRateNum > 10 || complaintRateNum > 0.5) {
      status = 'Account at risk';
    } else if (bounceRateNum > 5 || complaintRateNum > 0.1) {
      status = 'Warning';
    }

    return NextResponse.json({
      bounceRate: parseFloat(bounceRate),
      complaintRate: parseFloat(complaintRate),
      bouncedEmails,
      complainedEmails,
      deliveredEmails,
      reputationData,
      status
    });
  } catch (error) {
    console.error('Error fetching reputation stats:', error);
    return NextResponse.json({ error: 'Failed to fetch reputation stats' }, { status: 500 });
  }
}
