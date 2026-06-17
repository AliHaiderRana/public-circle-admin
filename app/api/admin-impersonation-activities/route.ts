import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import AdminImpersonationActivity from '@/lib/models/AdminImpersonationActivity';
import { getServerSession } from '@/lib/auth';
import {
  buildAuditDateFilter,
  escapeRegexEmail,
  parseAuditSortOrder,
} from '@/lib/audit-query';
import { isNoiseImpersonationRow } from '@/lib/impersonation-activity-labels';

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
    const userEmail = (searchParams.get('userEmail') || '').trim();
    const dateFrom = (searchParams.get('dateFrom') || '').trim();
    const dateTo = (searchParams.get('dateTo') || '').trim();
    const sort = parseAuditSortOrder(searchParams.get('sort'));
    const category = (searchParams.get('category') || 'all').trim();
    const hideNoise = searchParams.get('hideNoise') !== 'false';
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
        $regex: escapeRegexEmail(adminEmail),
        $options: 'i',
      };
    }
    if (userEmail) {
      filter.impersonatedUserEmail = {
        $regex: escapeRegexEmail(userEmail),
        $options: 'i',
      };
    }
    const createdAtRange = buildAuditDateFilter(dateFrom, dateTo);
    if (createdAtRange) {
      filter.createdAt = createdAtRange;
    }
    if (category !== 'all') {
      filter['metadata.category'] = category;
    }
    if (hideNoise) {
      filter.$nor = [
        { path: { $regex: /^WEBSOCKET_/i } },
        { path: { $regex: /get-dashboard-data|get-paginated-contacts|get-segment-count|get-filter-count|\/segments\/all|\/filters\/all|\/filters\/get-data-type|duplicates\/recompute/i } },
        { summary: { $regex: /recomputed duplicate contacts/i } },
        { summary: { $regex: /WEBSOCKET|get-paginated-contacts|get-dashboard-data/i } },
      ];
    }

    const [rawActivities, total] = await Promise.all([
      AdminImpersonationActivity.find(filter)
        .sort({ createdAt: sort === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminImpersonationActivity.countDocuments(filter),
    ]);

    const activities = hideNoise
      ? rawActivities.filter(
          (row) =>
            !isNoiseImpersonationRow({
              path: row.path ?? null,
              type: row.type,
              summary: row.summary ?? null,
            })
        )
      : rawActivities;

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
      requestBody:
        row.requestBody && typeof row.requestBody === 'object' && !Array.isArray(row.requestBody)
          ? (row.requestBody as Record<string, unknown>)
          : null,
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
