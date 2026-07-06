import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getReferralDbConnection } from '@/lib/referral-db';
import { isReferralPortalRole } from '@/lib/referral-portal-roles.util';
import { getServerSecrets } from '@/lib/server-secrets.server';

export type PartnerRealtimeSocketUser = {
  referralUserId: string;
};

async function resolveReferralAccessTokenSecret(): Promise<string | null> {
  const fromEnv =
    process.env.REFERRAL_APP_ACCESS_TOKEN_SECRET?.trim() ||
    process.env.ACCESS_TOKEN_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const secrets = await getServerSecrets();
  return secrets.accessTokenSecret;
}

export async function resolvePartnerRealtimeSocketUser(
  token: string,
): Promise<PartnerRealtimeSocketUser | null> {
  if (!token?.trim()) return null;

  try {
    const secret = await resolveReferralAccessTokenSecret();
    if (!secret) return null;

    const decoded = jwt.verify(token, secret) as { emailAddress?: string };
    const emailAddress = decoded.emailAddress?.trim().toLowerCase();
    if (!emailAddress) return null;

    const conn = await getReferralDbConnection();
    const User =
      conn.models.ReferralAppUser ||
      conn.model(
        'ReferralAppUser',
        new mongoose.Schema({ emailAddress: String, role: String, status: String }, { collection: 'User', strict: false }),
      );

    const user = (await User.findOne({
      emailAddress,
      status: { $nin: ['DELETED', 'DISABLED'] },
    })
      .select('_id role')
      .lean()) as { _id?: unknown; role?: string } | null;

    if (!user?._id || !isReferralPortalRole(user.role)) {
      return null;
    }

    return { referralUserId: String(user._id) };
  } catch {
    return null;
  }
}
