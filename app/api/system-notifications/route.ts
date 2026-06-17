import { NextResponse } from 'next/server';
import { requireSuperAdminSession, toAdminAuditSession } from '@/lib/auth';
import {
  getSystemNotifications,
  updateSystemNotifications,
} from '@/lib/system-notifications.server';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';

export async function GET() {
  const { session, error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const payload = await getSystemNotifications();
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch system notifications' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { session, error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const body = await request.json();
    const previous = await getSystemNotifications();
    const current = await updateSystemNotifications(body);

    const fieldsChanged = Object.keys(current).filter((key) => {
      if (key === 'adminRecipients' || key === 'teamRecipients' || key === 'inAppRecipients') {
        return false;
      }
      return (
        previous[key as keyof typeof previous] !== current[key as keyof typeof current]
      );
    });

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.SYSTEM_NOTIFICATIONS_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.SYSTEM_NOTIFICATIONS,
        resourceType: 'system_notifications',
        details: {
          fieldsChanged,
          adminPreferencesUpdated: Array.isArray(body.adminPreferences)
            ? body.adminPreferences.length
            : 0,
          ...current,
        },
      });
    }

    return NextResponse.json(current);
  } catch {
    return NextResponse.json({ error: 'Failed to update system notifications' }, { status: 500 });
  }
}
