import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AppConfig from '@/lib/models/AppConfig';
import AdminUser from '@/lib/models/AdminUser';
import { requireSuperAdminSession, toAdminAuditSession } from '@/lib/auth';
import {
  serializeSystemNotificationSettings,
  computeTeamRecipients,
} from '@/lib/system-notifications';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';

export async function GET() {
  const { session, error } = await requireSuperAdminSession();
  if (error) return error;

  await dbConnect();

  try {
    let config = await AppConfig.findOne();
    if (!config) {
      config = await AppConfig.create({});
    }

    const admins = await AdminUser.find({})
      .select('email name isSuperAdmin')
      .sort({ isSuperAdmin: -1, email: 1 })
      .lean();

    const settings = serializeSystemNotificationSettings(config);
    const adminRecipients = admins.map((a) => ({
      email: a.email,
      name: a.name,
      isSuperAdmin: Boolean(a.isSuperAdmin),
    }));

    return NextResponse.json({
      ...settings,
      adminRecipients,
      teamRecipients: computeTeamRecipients({
        ...settings,
        adminRecipients,
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch system notifications' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { session, error } = await requireSuperAdminSession();
  if (error) return error;

  await dbConnect();

  try {
    const body = await request.json();
    const {
      supportNotificationEmail,
      supportSendAlertEmail,
      supportSendDetailEmail,
      supportSendCustomerConfirmation,
      supportNotifySuperAdmins,
      supportNotifyAdmins,
    } = body;

    const parsedSupportEmail =
      typeof supportNotificationEmail === 'string'
        ? supportNotificationEmail.trim() === ''
          ? null
          : supportNotificationEmail.trim().toLowerCase()
        : supportNotificationEmail === null
          ? null
          : undefined;

    let config = await AppConfig.findOne();
    const previous = config ? serializeSystemNotificationSettings(config) : null;

    if (!config) {
      config = await AppConfig.create({
        ...(parsedSupportEmail !== undefined ? { supportNotificationEmail: parsedSupportEmail } : {}),
        ...(typeof supportSendAlertEmail === 'boolean' ? { supportSendAlertEmail } : {}),
        ...(typeof supportSendDetailEmail === 'boolean' ? { supportSendDetailEmail } : {}),
        ...(typeof supportSendCustomerConfirmation === 'boolean'
          ? { supportSendCustomerConfirmation }
          : {}),
        ...(typeof supportNotifySuperAdmins === 'boolean' ? { supportNotifySuperAdmins } : {}),
        ...(typeof supportNotifyAdmins === 'boolean' ? { supportNotifyAdmins } : {}),
      });
    } else {
      if (parsedSupportEmail !== undefined) {
        config.supportNotificationEmail = parsedSupportEmail;
      }
      if (typeof supportSendAlertEmail === 'boolean') {
        config.supportSendAlertEmail = supportSendAlertEmail;
      }
      if (typeof supportSendDetailEmail === 'boolean') {
        config.supportSendDetailEmail = supportSendDetailEmail;
      }
      if (typeof supportSendCustomerConfirmation === 'boolean') {
        config.supportSendCustomerConfirmation = supportSendCustomerConfirmation;
      }
      if (typeof supportNotifySuperAdmins === 'boolean') {
        config.supportNotifySuperAdmins = supportNotifySuperAdmins;
      }
      if (typeof supportNotifyAdmins === 'boolean') {
        config.supportNotifyAdmins = supportNotifyAdmins;
      }
      await config.save();
    }

    const current = serializeSystemNotificationSettings(config);
    const fieldsChanged = Object.keys(current).filter(
      (key) =>
        previous &&
        previous[key as keyof typeof previous] !== current[key as keyof typeof current],
    );

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.SYSTEM_NOTIFICATIONS_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.SYSTEM_NOTIFICATIONS,
        resourceType: 'system_notifications',
        details: {
          fieldsChanged,
          ...current,
        },
      });
    }

    const admins = await AdminUser.find({})
      .select('email name isSuperAdmin')
      .sort({ isSuperAdmin: -1, email: 1 })
      .lean();

    const adminRecipients = admins.map((a) => ({
      email: a.email,
      name: a.name,
      isSuperAdmin: Boolean(a.isSuperAdmin),
    }));

    return NextResponse.json({
      ...current,
      adminRecipients,
      teamRecipients: computeTeamRecipients({
        ...current,
        adminRecipients,
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update system notifications' }, { status: 500 });
  }
}
