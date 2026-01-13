import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import EmailsSent from '@/lib/models/EmailsSent';
import { getServerSession } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    // Use aggregation pipeline for better performance - single query instead of 30+ queries
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Single aggregation query to get all stats
    const [overallStats, dailyStats] = await Promise.all([
      // Get overall counts using aggregation
      EmailsSent.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            bounced: [
              { $match: { 'emailEvents.Bounce': { $exists: true } } },
              { $count: 'count' }
            ],
            complained: [
              { $match: { 'emailEvents.Complaint': { $exists: true } } },
              { $count: 'count' }
            ],
            delivered: [
              { $match: { 'emailEvents.Delivery': { $exists: true } } },
              { $count: 'count' }
            ]
          }
        }
      ]),
      // Get daily stats for the last 30 days in a single query
      EmailsSent.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            total: { $sum: 1 },
            bounced: {
              $sum: { $cond: [{ $ifNull: ['$emailEvents.Bounce', false] }, 1, 0] }
            },
            complained: {
              $sum: { $cond: [{ $ifNull: ['$emailEvents.Complaint', false] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Extract overall stats
    const totalEmails = overallStats[0]?.total[0]?.count || 0;
    const bouncedEmails = overallStats[0]?.bounced[0]?.count || 0;
    const complainedEmails = overallStats[0]?.complained[0]?.count || 0;
    const deliveredEmails = overallStats[0]?.delivered[0]?.count || 0;

    const bounceRate = totalEmails > 0 ? (bouncedEmails / totalEmails * 100).toFixed(2) : '0';
    const complaintRate = totalEmails > 0 ? (complainedEmails / totalEmails * 100).toFixed(2) : '0';

    // Build reputation data for the last 30 days
    const dailyStatsMap = new Map(dailyStats.map((d: any) => [d._id, d]));
    const reputationData = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      const dayStats = dailyStatsMap.get(dateKey);
      
      const dayTotal = dayStats?.total || 0;
      const dayBounced = dayStats?.bounced || 0;
      const dayComplained = dayStats?.complained || 0;
      
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
