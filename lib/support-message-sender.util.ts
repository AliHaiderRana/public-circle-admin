import AdminUser from '@/lib/models/AdminUser';
import ThirdPartyUser from '@/lib/models/ThirdPartyUser';
import { SUPPORT_CHAT_SENDER_TYPE } from '@/lib/constants';
import { formatAdminUserRoleLabel } from '@/lib/support-admin.util';
import { formatReferralRoleLabel } from '@/lib/third-party-user-display.util';

type SupportChatMessageLike = {
  senderType?: string;
  senderAdminId?: string;
  senderRoleLabel?: string;
  [key: string]: unknown;
};

export async function resolveSenderRoleLabelsForAdminIds(
  adminIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(adminIds.map((id) => String(id).trim()).filter(Boolean))];
  const roleById = new Map<string, string>();

  if (!uniqueIds.length) {
    return roleById;
  }

  const admins = await AdminUser.find({ _id: { $in: uniqueIds } })
    .select('_id isSuperAdmin')
    .lean();

  for (const admin of admins) {
    roleById.set(String(admin._id), formatAdminUserRoleLabel(Boolean(admin.isSuperAdmin)));
  }

  const unresolvedIds = uniqueIds.filter((id) => !roleById.has(id));
  if (!unresolvedIds.length) {
    return roleById;
  }

  const referralUsers = await ThirdPartyUser.find({
    referralUserId: { $in: unresolvedIds },
  })
    .select('referralUserId role')
    .lean();

  for (const user of referralUsers) {
    roleById.set(String(user.referralUserId), formatReferralRoleLabel(user.role));
  }

  return roleById;
}

export async function enrichSupportChatMessagesWithSenderRoles<
  T extends SupportChatMessageLike,
>(messages: T[]): Promise<T[]> {
  if (!messages.length) {
    return messages;
  }

  const adminSenderIds = messages
    .filter(
      (message) =>
        message.senderType === SUPPORT_CHAT_SENDER_TYPE.ADMIN && message.senderAdminId,
    )
    .map((message) => String(message.senderAdminId));

  const roleById = await resolveSenderRoleLabelsForAdminIds(adminSenderIds);

  return messages.map((message) => {
    if (message.senderType === SUPPORT_CHAT_SENDER_TYPE.USER) {
      return { ...message, senderRoleLabel: 'Customer' };
    }

    if (message.senderType !== SUPPORT_CHAT_SENDER_TYPE.ADMIN || !message.senderAdminId) {
      return message;
    }

    const senderAdminId = String(message.senderAdminId);
    const role = roleById.get(senderAdminId) || 'Support';
    return { ...message, senderRoleLabel: role };
  });
}
