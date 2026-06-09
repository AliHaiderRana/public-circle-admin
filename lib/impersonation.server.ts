import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import AdminImpersonationActivity from '@/lib/models/AdminImpersonationActivity';
import { USER_KIND, USER_STATUS } from '@/lib/constants';
import { getServerSecrets } from '@/lib/server-secrets.server';

const ACCESS_TOKEN_EXPIRY =
  (process.env.ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn']) || '1d';

export type ImpersonationResult = {
  token: string;
  sessionId: string;
  impersonatedBy: { email: string; name: string };
  impersonatedUser: { id: string; email: string; name: string };
  company: { id: string; name: string };
};

export class ImpersonationError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function createImpersonationSession({
  userId,
  companyId,
  adminEmail,
  adminName,
}: {
  userId: string;
  companyId: string;
  adminEmail: string;
  adminName: string;
}): Promise<ImpersonationResult> {
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(companyId)
  ) {
    throw new ImpersonationError(400, 'Invalid user or company id');
  }

  await dbConnect();

  const user = await User.findOne({ _id: userId })
    .populate('company')
    .sort({ createdAt: -1 });

  if (!user) {
    throw new ImpersonationError(404, 'User not found');
  }

  const userCompanyId =
    user.company?._id?.toString() || user.company?.toString() || '';
  if (userCompanyId !== String(companyId)) {
    throw new ImpersonationError(403, 'User does not belong to this company');
  }

  if (
    user.kind === USER_KIND.SECONDARY &&
    user.status === 'DEACTIVATED'
  ) {
    throw new ImpersonationError(
      403,
      'This user account is deactivated. Contact the company admin.'
    );
  }

  const companyStatus = user.company?.status;
  if (
    companyStatus === USER_STATUS.BLOCKED ||
    user.status === USER_STATUS.BLOCKED
  ) {
    throw new ImpersonationError(403, 'This company or user is blocked');
  }

  if (companyStatus === 'ARCHIVED') {
    throw new ImpersonationError(404, 'User not found');
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new ImpersonationError(403, 'User account is not active');
  }

  const sessionId = crypto.randomUUID();
  const impersonatedUserEmail = user.emailAddress || '';

  const secrets = await getServerSecrets();
  const accessTokenSecret =
    secrets.accessTokenSecret ||
    process.env.ACCESS_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    'fallback_secret';

  const token = jwt.sign(
    {
      emailAddress: impersonatedUserEmail,
      impersonation: {
        sessionId,
        adminEmail: adminEmail || '',
        adminName: adminName || '',
        userId: user._id.toString(),
        companyId: userCompanyId,
        impersonatedUserEmail,
      },
    },
    accessTokenSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const impersonatedUserName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || '';

  try {
    await AdminImpersonationActivity.create({
      sessionId,
      type: 'SESSION_START',
      adminEmail: adminEmail || '',
      adminName: adminName || '',
      impersonatedUserId: user._id,
      impersonatedUserEmail,
      companyId: user.company?._id || user.company,
      method: 'SESSION',
      path: 'impersonation/login',
      summary: `Started Login as user (${impersonatedUserEmail})`,
      statusCode: 200,
      metadata: {
        category: 'session',
        source: 'admin_panel',
      },
    });
  } catch (err) {
    console.error('[impersonation] failed to log SESSION_START', err);
  }

  return {
    token,
    sessionId,
    impersonatedBy: {
      email: adminEmail || '',
      name: adminName || '',
    },
    impersonatedUser: {
      id: user._id.toString(),
      email: impersonatedUserEmail,
      name: impersonatedUserName,
    },
    company: {
      id: userCompanyId,
      name: user.company?.name || '',
    },
  };
}
