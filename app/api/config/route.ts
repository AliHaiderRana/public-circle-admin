import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AppConfig from '@/lib/models/AppConfig';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';

export async function GET() {
  await dbConnect();
  try {
    let config = await AppConfig.findOne();
    if (!config) {
      config = await AppConfig.create({ isSignupAllowed: true });
    }
    return NextResponse.json({
      DlqLastProcessedAt: config.DlqLastProcessedAt,
      appleRelayEmail: config.appleRelayEmail,
      deleteCompanyContactsAfterDays: config.deleteCompanyContactsAfterDays,
      isSignupAllowed: config.isSignupAllowed,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  
  try {
    // Check if current user is super admin
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: 'Only super admins can modify system configuration' }, { status: 403 });
    }

    const {
      isSignupAllowed,
      appleRelayEmail,
      deleteCompanyContactsAfterDays,
    } = await request.json();

    let config = await AppConfig.findOne();
    if (!config) {
      config = await AppConfig.create({
        ...(typeof isSignupAllowed === 'boolean' ? { isSignupAllowed } : {}),
        ...(typeof appleRelayEmail === 'string' || appleRelayEmail === null
          ? { appleRelayEmail }
          : {}),
        ...(typeof deleteCompanyContactsAfterDays === 'number'
          ? { deleteCompanyContactsAfterDays }
          : {}),
      });
    } else {
      if (typeof isSignupAllowed === 'boolean') {
        config.isSignupAllowed = isSignupAllowed;
      }
      if (typeof appleRelayEmail === 'string' || appleRelayEmail === null) {
        config.appleRelayEmail = appleRelayEmail;
      }
      if (typeof deleteCompanyContactsAfterDays === 'number') {
        config.deleteCompanyContactsAfterDays = deleteCompanyContactsAfterDays;
      }
      await config.save();
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.SYSTEM_CONFIG_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.SYSTEM_CONFIG,
        resourceType: 'app_config',
        details: {
          isSignupAllowed: config.isSignupAllowed,
          appleRelayEmail: config.appleRelayEmail,
          deleteCompanyContactsAfterDays: config.deleteCompanyContactsAfterDays,
        },
      });
    }

    return NextResponse.json({
      DlqLastProcessedAt: config.DlqLastProcessedAt,
      appleRelayEmail: config.appleRelayEmail,
      deleteCompanyContactsAfterDays: config.deleteCompanyContactsAfterDays,
      isSignupAllowed: config.isSignupAllowed,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}

