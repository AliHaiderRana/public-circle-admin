import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminActivity from '@/lib/models/AdminActivity';
import { requireSuperAdminSession } from '@/lib/auth';
import { ADMIN_AUDIT_CATEGORY } from '@/lib/admin-audit.constants';
import {
  buildAuditDateFilter,
  escapeRegexEmail,
  parseAuditSortOrder,
} from '@/lib/audit-query';

const VALID_CATEGORIES = new Set<string>(Object.values(ADMIN_AUDIT_CATEGORY));

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const category = searchParams.get('category') || 'all';
    const adminEmail = (searchParams.get('adminEmail') || '').trim();
    const dateFrom = (searchParams.get('dateFrom') || '').trim();
    const dateTo = (searchParams.get('dateTo') || '').trim();
    const sort = parseAuditSortOrder(searchParams.get('sort'));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (category !== 'all' && VALID_CATEGORIES.has(category)) {
      filter.category = category;
    }
    if (adminEmail) {
      filter.adminEmail = { $regex: escapeRegexEmail(adminEmail), $options: 'i' };
    }
    const createdAtRange = buildAuditDateFilter(dateFrom, dateTo);
    if (createdAtRange) {
      filter.createdAt = createdAtRange;
    }

    const [activities, total] = await Promise.all([
      AdminActivity.find(filter)
        .sort({ createdAt: sort === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminActivity.countDocuments(filter),
    ]);

    const data = activities.map((row) => ({
      id: String(row._id),
      adminId: String(row.adminId),
      adminEmail: row.adminEmail,
      adminName: row.adminName,
      actorWasSuperAdmin: row.actorWasSuperAdmin,
      action: row.action,
      category: row.category,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      summary: row.summary,
      details: row.details,
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
    console.error('[admin-activities]', err);
    return NextResponse.json({ error: 'Failed to load admin activity' }, { status: 500 });
  }
}
