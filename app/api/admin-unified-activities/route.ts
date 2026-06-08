import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminActivity from '@/lib/models/AdminActivity';
import AdminImpersonationActivity from '@/lib/models/AdminImpersonationActivity';
import { requireSuperAdminSession } from '@/lib/auth';
import { parseAuditSortOrder } from '@/lib/audit-query';
import {
  fetchGroupedAdminTimeline,
  fetchImpersonatedCustomersForAdmin,
  fetchSessionActivities,
  fetchUnifiedAdminActivities,
} from '@/lib/unified-admin-activity.server';

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const customersOnly = searchParams.get('customers') === '1';
    const grouped = searchParams.get('grouped') === '1';
    const sessionId = (searchParams.get('sessionId') || '').trim();
    const adminEmail = (searchParams.get('adminEmail') || '').trim();
    const dateFrom = (searchParams.get('dateFrom') || '').trim();
    const dateTo = (searchParams.get('dateTo') || '').trim();
    const hideNoise = searchParams.get('hideNoise') !== 'false';

    if (customersOnly) {
      if (!adminEmail) {
        return NextResponse.json({ error: 'adminEmail is required' }, { status: 400 });
      }
      const customers = await fetchImpersonatedCustomersForAdmin({
        AdminActivity,
        AdminImpersonationActivity,
        adminEmail,
        dateFrom,
        dateTo,
        hideNoise,
      });
      return NextResponse.json({ customers });
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const source = (searchParams.get('source') || 'all').trim();
    const userEmail = (searchParams.get('userEmail') || '').trim();
    const userId = (searchParams.get('userId') || '').trim();
    const companyId = (searchParams.get('companyId') || '').trim();
    const category = (searchParams.get('category') || 'all').trim();
    const sort = parseAuditSortOrder(searchParams.get('sort'));

    if (sessionId) {
      if (!adminEmail) {
        return NextResponse.json({ error: 'adminEmail is required' }, { status: 400 });
      }
      const pcCategory = category.startsWith('pc:') ? category.slice('pc:'.length) : undefined;
      const activities = await fetchSessionActivities({
        AdminImpersonationActivity,
        sessionId,
        adminEmail,
        userEmail,
        dateFrom,
        dateTo,
        pcCategory,
        hideNoise,
        sort,
      });
      return NextResponse.json({ activities });
    }

    if (grouped) {
      if (!adminEmail) {
        return NextResponse.json({ error: 'adminEmail is required' }, { status: 400 });
      }
      const result = await fetchGroupedAdminTimeline({
        AdminActivity,
        AdminImpersonationActivity,
        page,
        limit,
        sort,
        source,
        adminEmail,
        userEmail,
        userId,
        companyId,
        dateFrom,
        dateTo,
        category,
        hideNoise,
      });
      return NextResponse.json(result);
    }

    const result = await fetchUnifiedAdminActivities({
      AdminActivity,
      AdminImpersonationActivity,
      page,
      limit,
      sort,
      source,
      adminEmail,
      userEmail,
      userId,
      companyId,
      dateFrom,
      dateTo,
      category,
      hideNoise,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[admin-unified-activities]', err);
    return NextResponse.json(
      { error: 'Failed to load unified admin activity' },
      { status: 500 }
    );
  }
}
