import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import SupportRequest from '@/lib/models/SupportRequest';
import { SUPPORT_REQUEST_STATUS } from '@/lib/constants';
import { getReferralDbConnection } from '@/lib/referral-db';
import { partnerTicketsFilterForReferralUser } from '@/lib/partner-access.util';

async function getReferralUserRole(referralUserId: string): Promise<string> {
  const conn = await getReferralDbConnection();
  const User =
    conn.models.ReferralAppUser ||
    conn.model(
      'ReferralAppUser',
      new mongoose.Schema({ role: String }, { collection: 'User', strict: false }),
    );

  const user = (await User.findById(referralUserId).select('role').lean()) as { role?: string } | null;
  return user?.role || 'MARKETING_AFFILIATE';
}

export type ReferralPartnerSupportStats = {
  unreadChatMessages: number;
  openSupportRequests: number;
};

export async function getReferralPartnerSupportStats(
  referralUserId: string,
): Promise<ReferralPartnerSupportStats> {
  const role = await getReferralUserRole(referralUserId);
  await dbConnect();

  const activeStatuses = [
    SUPPORT_REQUEST_STATUS.OPEN,
    SUPPORT_REQUEST_STATUS.IN_PROGRESS,
  ];
  const scopedFilter = await partnerTicketsFilterForReferralUser(referralUserId, role);

  const [chatAgg, openSupportRequests] = await Promise.all([
    SupportRequest.aggregate([
      { $match: scopedFilter },
      { $group: { _id: null, unreadChatMessages: { $sum: '$unreadByAdmin' } } },
    ]),
    SupportRequest.countDocuments({
      ...scopedFilter,
      status: { $in: activeStatuses },
    }),
  ]);

  return {
    unreadChatMessages: chatAgg[0]?.unreadChatMessages ?? 0,
    openSupportRequests,
  };
}
