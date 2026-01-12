import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import User from '@/lib/models/User';
import CustomerRequest from '@/lib/models/CustomerRequest';
import Campaign from '@/lib/models/Campaign';
import EmailsSent from '@/lib/models/EmailsSent';
import { CUSTOMER_REQUEST_STATUS } from '@/lib/constants';
import { getServerSession } from '@/lib/auth';
import mongoose from 'mongoose';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfLast30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      companyCount,
      userCount,
      pendingRequests,
      activeCampaigns,
      totalCampaigns,
      thisMonthEmails,
      lastMonthEmails,
      totalEmails,
      recentActivity
    ] = await Promise.all([
      Company.countDocuments({}),
      User.countDocuments({}),
      CustomerRequest.countDocuments({ requestStatus: CUSTOMER_REQUEST_STATUS.PENDING }),
      Campaign.countDocuments({ status: 'ACTIVE' }),
      Campaign.countDocuments({}),
      EmailsSent.countDocuments({ createdAt: { $gte: startOfMonth } }),
      EmailsSent.countDocuments({ createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      EmailsSent.countDocuments({ createdAt: { $gte: startOfLast30Days } }),
      Campaign.find({ status: 'ACTIVE' })
        .populate('company', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

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
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
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

    const emailGrowth = lastMonthEmails > 0 
      ? ((thisMonthEmails - lastMonthEmails) / lastMonthEmails * 100).toFixed(1)
      : '0';

    return NextResponse.json({
      companyCount,
      userCount,
      pendingRequests,
      activeCampaigns,
      totalCampaigns,
      thisMonthEmails,
      lastMonthEmails,
      emailGrowth: parseFloat(emailGrowth),
      totalEmails,
      bounceRate: parseFloat(bounceRate),
      complaintRate: parseFloat(complaintRate),
      bouncedEmails,
      complainedEmails,
      deliveredEmails,
      reputationData,
      recentActivity,
      status: 'Healthy'
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
