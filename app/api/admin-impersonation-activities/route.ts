import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import AdminImpersonationActivity from '@/lib/models/AdminImpersonationActivity';
import { getServerSession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const companyId = (searchParams.get('companyId') || '').trim();
    const userId = (searchParams.get('userId') || '').trim();
    const sessionId = (searchParams.get('sessionId') || '').trim();
    const adminEmail = (searchParams.get('adminEmail') || '').trim();
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
      filter.companyId = new mongoose.Types.ObjectId(companyId);
    }
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.impersonatedUserId = new mongoose.Types.ObjectId(userId);
    }
    if (sessionId) {
      filter.sessionId = sessionId;
    }
    if (adminEmail) {
      filter.adminEmail = {
        $regex: adminEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
    }

    const [activities, total] = await Promise.all([
      AdminImpersonationActivity.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminImpersonationActivity.countDocuments(filter),
    ]);

    const data = activities.map((row) => ({
      id: String(row._id),
      sessionId: row.sessionId,
      type: row.type,
      adminEmail: row.adminEmail,
      adminName: row.adminName,
      userId: String(row.impersonatedUserId),
      impersonatedUserEmail: row.impersonatedUserEmail,
      companyId: String(row.companyId),
      method: row.method,
      path: row.path,
      summary: row.summary,
      statusCode: row.statusCode,
      projectId: row.projectId,
      metadata: row.metadata,
      createdAt: row.createdAt,
    }));

    return NextResponse.json({
      activities: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error('[admin-impersonation-activities]', err);
    return NextResponse.json(
      { error: 'Failed to load impersonation activity' },
      { status: 500 }
    );
  }
}
