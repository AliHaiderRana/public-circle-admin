import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ThirdPartyUser from '@/lib/models/ThirdPartyUser';
import { requireSuperAdminSession } from '@/lib/auth';
import {
  formatReferralRoleLabel,
  formatThirdPartyUserName,
  isReferralSignupComplete,
} from '@/lib/third-party-user-display.util';

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const search = (searchParams.get('search') || '').trim();
    const role = (searchParams.get('role') || 'all').trim();
    const portalAccess = (searchParams.get('portalAccess') || 'all').trim();
    const status = (searchParams.get('status') || 'all').trim();
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      source: 'referral_app',
    };

    if (search) {
      const regex = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      filter.$or = [
        { emailAddress: regex },
        { firstName: regex },
        { lastName: regex },
        { phoneNumber: regex },
      ];
    }

    if (role !== 'all') filter.role = role;
    if (portalAccess !== 'all') filter.portalAccess = portalAccess;
    if (status !== 'all') filter.status = status;

    const [users, total] = await Promise.all([
      ThirdPartyUser.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ThirdPartyUser.countDocuments(filter),
    ]);

    return NextResponse.json({
      users: users.map((row) => ({
        id: String(row._id),
        referralUserId: String(row.referralUserId),
        emailAddress: row.emailAddress,
        firstName: row.firstName,
        lastName: row.lastName,
        name: formatThirdPartyUserName(row),
        role: row.role,
        roleLabel: formatReferralRoleLabel(row.role),
        status: row.status,
        signupStep: row.signupStep,
        signupCompleted: isReferralSignupComplete(row),
        signupCompletedAt: row.signupCompletedAt,
        portalAccess: row.portalAccess,
        country: row.country,
        city: row.city,
        phoneNumber: row.phoneNumber,
        lastSyncedAt: row.lastSyncedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error('[third-party-users]', err);
    return NextResponse.json({ error: 'Failed to load referral users' }, { status: 500 });
  }
}
