import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import ThirdPartyUser, { THIRD_PARTY_PORTAL_ACCESS } from '@/lib/models/ThirdPartyUser';
import { getReferralDbConnection } from '@/lib/referral-db';

const PARTNER_ROLES = new Set(['SALES_PERSON', 'MARKETING_AFFILIATE']);
const ACTIVE_REFERRAL_CODE_STATUS = 'ACTIVE';

type ReferralUserDoc = {
  _id: mongoose.Types.ObjectId;
  emailAddress: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
};

async function hasActivePortalAccess(referralUserId: string): Promise<boolean> {
  await dbConnect();
  const thirdParty = await ThirdPartyUser.findOne({
    referralUserId: new mongoose.Types.ObjectId(referralUserId),
    source: 'referral_app',
  })
    .select('portalAccess')
    .lean();

  if (!thirdParty) return false;
  return thirdParty.portalAccess === THIRD_PARTY_PORTAL_ACCESS.ACTIVE;
}

function getReferralUserModel(conn: mongoose.Connection) {
  if (conn.models.ReferralAppUser) {
    return conn.models.ReferralAppUser;
  }
  const schema = new mongoose.Schema(
    {
      emailAddress: String,
      password: String,
      firstName: String,
      lastName: String,
      role: String,
      status: String,
      reportingTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      attachedReferralCode: [{ type: mongoose.Schema.Types.ObjectId }],
    },
    { collection: 'User', strict: false },
  );
  return conn.model('ReferralAppUser', schema);
}

function getLinkedCustomerModel(conn: mongoose.Connection) {
  if (conn.models.ReferralLinkedCustomer) {
    return conn.models.ReferralLinkedCustomer;
  }
  const schema = new mongoose.Schema(
    {
      userId: mongoose.Schema.Types.ObjectId,
      customerStripeId: String,
      companyId: mongoose.Schema.Types.ObjectId,
    },
    { collection: 'Linked-Customer', strict: false },
  );
  return conn.model('ReferralLinkedCustomer', schema);
}

function getReferralCodeModel(conn: mongoose.Connection) {
  if (conn.models.ReferralAppCode) {
    return conn.models.ReferralAppCode;
  }
  const schema = new mongoose.Schema(
    {
      code: String,
      createdBy: mongoose.Schema.Types.ObjectId,
      createdFor: mongoose.Schema.Types.ObjectId,
      reward: mongoose.Schema.Types.ObjectId,
      status: String,
    },
    { collection: 'Referral-Code', strict: false },
  );
  return conn.model('ReferralAppCode', schema);
}

function getPurchaseHistoryModel(conn: mongoose.Connection) {
  if (conn.models.ReferralPurchaseHistory) {
    return conn.models.ReferralPurchaseHistory;
  }
  const schema = new mongoose.Schema(
    {
      stripeCustomerId: String,
      rewardId: mongoose.Schema.Types.ObjectId,
      companyId: mongoose.Schema.Types.ObjectId,
    },
    { collection: 'Customer-Purchase-History', strict: false },
  );
  return conn.model('ReferralPurchaseHistory', schema);
}

async function getDownlineReferralUserIds(
  conn: mongoose.Connection,
  rootUserId: string,
): Promise<string[]> {
  const User = getReferralUserModel(conn);
  const downline: string[] = [];
  const queue = [rootUserId];
  const seen = new Set<string>([rootUserId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = await User.find({
      reportingTo: currentId,
      status: { $nin: ['DELETED', 'DISABLED'] },
    })
      .select('_id')
      .lean();

    for (const child of children) {
      const childId = String(child._id);
      if (seen.has(childId)) continue;
      seen.add(childId);
      downline.push(childId);
      queue.push(childId);
    }
  }

  return downline;
}

export async function findReferralPartnerAccountByEmail(
  email: string,
): Promise<ReferralUserDoc | null> {
  const conn = await getReferralDbConnection();
  const User = getReferralUserModel(conn);

  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return null;
  }

  const user = (await User.findOne({
    emailAddress: {
      $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    },
    status: { $nin: ['DELETED', 'DISABLED'] },
    role: { $in: [...PARTNER_ROLES] },
  }).lean()) as ReferralUserDoc | null;

  return user;
}

export async function validateReferralPartnerCredentials(
  email: string,
  password: string,
): Promise<ReferralUserDoc | null> {
  const user = await findReferralPartnerAccountByEmail(email);

  if (!user || !user.password || user.password !== password) {
    return null;
  }

  const accessAllowed = await hasActivePortalAccess(String(user._id));
  if (!accessAllowed) {
    return null;
  }

  return user;
}

export async function getReferralPartnerById(
  referralUserId: string,
): Promise<ReferralUserDoc | null> {
  const accessAllowed = await hasActivePortalAccess(referralUserId);
  if (!accessAllowed) {
    return null;
  }

  const conn = await getReferralDbConnection();
  const User = getReferralUserModel(conn);
  const user = (await User.findOne({
    _id: referralUserId,
    status: { $nin: ['DELETED', 'DISABLED'] },
    role: { $in: Array.from(PARTNER_ROLES) },
  }).lean()) as ReferralUserDoc | null;
  return user;
}

export async function getPartnerStripeCustomerIds({
  referralUserId,
  referralRole,
}: {
  referralUserId: string;
  referralRole: string;
}): Promise<string[]> {
  const conn = await getReferralDbConnection();
  const LinkedCustomer = getLinkedCustomerModel(conn);
  const ReferralCode = getReferralCodeModel(conn);
  const PurchaseHistory = getPurchaseHistoryModel(conn);
  const User = getReferralUserModel(conn);

  const referralUserIds = [referralUserId];
  if (referralRole === 'SALES_PERSON') {
    const downline = await getDownlineReferralUserIds(conn, referralUserId);
    referralUserIds.push(...downline);
  }

  const objectIds = referralUserIds.map((id) => new mongoose.Types.ObjectId(id));

  const [linkedCustomers, referralCodes, affiliateUser] = await Promise.all([
    LinkedCustomer.find({ userId: { $in: objectIds } })
      .select('customerStripeId')
      .lean(),
    ReferralCode.find({
      status: ACTIVE_REFERRAL_CODE_STATUS,
      $or: [{ createdBy: { $in: objectIds } }, { createdFor: { $in: objectIds } }],
    })
      .select('reward')
      .lean(),
    referralRole === 'MARKETING_AFFILIATE'
      ? User.findById(referralUserId).select('attachedReferralCode').lean()
      : Promise.resolve(null),
  ]);

  let rewardIds = referralCodes
    .map((code) => code.reward)
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));

  if (affiliateUser?.attachedReferralCode?.length) {
    const attachedCodes = await ReferralCode.find({
      _id: { $in: affiliateUser.attachedReferralCode },
      status: ACTIVE_REFERRAL_CODE_STATUS,
    })
      .select('reward')
      .lean();
    rewardIds = rewardIds.concat(
      attachedCodes
        .map((code) => code.reward)
        .filter(Boolean)
        .map((id) => new mongoose.Types.ObjectId(String(id))),
    );
  }

  const uniqueRewardIds = [...new Set(rewardIds.map((id) => id.toString()))].map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  const purchases =
    uniqueRewardIds.length > 0
      ? await PurchaseHistory.find({ rewardId: { $in: uniqueRewardIds } })
          .select('stripeCustomerId')
          .lean()
      : [];

  const stripeIds = new Set<string>();
  for (const row of linkedCustomers) {
    if (row.customerStripeId) stripeIds.add(row.customerStripeId);
  }
  for (const row of purchases) {
    if (row.stripeCustomerId) stripeIds.add(row.stripeCustomerId);
  }

  return Array.from(stripeIds);
}

export type CompanyReferralPartner = {
  id: string;
  email: string;
  name: string;
  role: 'SALES_PERSON' | 'MARKETING_AFFILIATE';
};

function formatReferralPartnerUser(user: ReferralUserDoc): CompanyReferralPartner {
  return {
    id: String(user._id),
    email: user.emailAddress,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.emailAddress,
    role: user.role as 'SALES_PERSON' | 'MARKETING_AFFILIATE',
  };
}

/** Resolve sales / marketing partners linked to Public Circle companies via referral data. */
export async function getReferralPartnersByCompanyIds(
  companyIds: string[],
): Promise<Record<string, CompanyReferralPartner[]>> {
  const result: Record<string, CompanyReferralPartner[]> = {};
  const uniqueIds = [...new Set(companyIds.filter(Boolean))];
  for (const id of uniqueIds) {
    result[id] = [];
  }
  if (!uniqueIds.length) return result;

  await dbConnect();
  const companies = await Company.find({ _id: { $in: uniqueIds } })
    .select('_id stripeCustomerId')
    .lean();

  const stripeToCompanyIds = new Map<string, string[]>();
  for (const company of companies) {
    const stripeId = company.stripeCustomerId as string | undefined;
    if (!stripeId) continue;
    const companyId = String(company._id);
    const list = stripeToCompanyIds.get(stripeId) ?? [];
    list.push(companyId);
    stripeToCompanyIds.set(stripeId, list);
  }

  const stripeIds = [...stripeToCompanyIds.keys()];
  if (!stripeIds.length) return result;

  const conn = await getReferralDbConnection();
  const LinkedCustomer = getLinkedCustomerModel(conn);
  const PurchaseHistory = getPurchaseHistoryModel(conn);
  const ReferralCode = getReferralCodeModel(conn);
  const User = getReferralUserModel(conn);

  const [linkedCustomers, purchases] = await Promise.all([
    LinkedCustomer.find({ customerStripeId: { $in: stripeIds } })
      .select('customerStripeId userId')
      .lean(),
    PurchaseHistory.find({ stripeCustomerId: { $in: stripeIds } })
      .select('stripeCustomerId rewardId')
      .lean(),
  ]);

  const stripePartnerUserIds = new Map<string, Set<string>>();
  const allPartnerUserIds = new Set<string>();

  const addUserForStripe = (stripeId: string, userId: unknown) => {
    if (!userId) return;
    const id = String(userId);
    if (!stripePartnerUserIds.has(stripeId)) {
      stripePartnerUserIds.set(stripeId, new Set());
    }
    stripePartnerUserIds.get(stripeId)!.add(id);
    allPartnerUserIds.add(id);
  };

  for (const row of linkedCustomers) {
    if (row.customerStripeId) {
      addUserForStripe(row.customerStripeId, row.userId);
    }
  }

  const rewardIds = [
    ...new Set(purchases.map((row) => row.rewardId).filter(Boolean).map((id) => String(id))),
  ];

  const usersByReward = new Map<string, Set<string>>();
  if (rewardIds.length) {
    const codes = await ReferralCode.find({
      reward: { $in: rewardIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select('reward createdBy createdFor')
      .lean();

    for (const code of codes) {
      const rewardKey = String(code.reward);
      if (!usersByReward.has(rewardKey)) {
        usersByReward.set(rewardKey, new Set());
      }
      const bucket = usersByReward.get(rewardKey)!;
      if (code.createdBy) {
        bucket.add(String(code.createdBy));
        allPartnerUserIds.add(String(code.createdBy));
      }
      if (code.createdFor) {
        bucket.add(String(code.createdFor));
        allPartnerUserIds.add(String(code.createdFor));
      }
    }
  }

  for (const purchase of purchases) {
    if (!purchase.stripeCustomerId || !purchase.rewardId) continue;
    const linkedUsers = usersByReward.get(String(purchase.rewardId));
    if (!linkedUsers) continue;
    for (const userId of linkedUsers) {
      addUserForStripe(purchase.stripeCustomerId, userId);
    }
  }

  if (!allPartnerUserIds.size) return result;

  const partners = (await User.find({
    _id: { $in: [...allPartnerUserIds].map((id) => new mongoose.Types.ObjectId(id)) },
    role: { $in: ['SALES_PERSON', 'MARKETING_AFFILIATE'] },
    status: { $nin: ['DELETED', 'DISABLED'] },
  }).lean()) as ReferralUserDoc[];

  const partnerById = new Map(
    partners.map((partner) => [String(partner._id), formatReferralPartnerUser(partner)]),
  );

  for (const [stripeId, userIds] of stripePartnerUserIds) {
    const companyIdsForStripe = stripeToCompanyIds.get(stripeId) ?? [];
    const partnersForStripe: CompanyReferralPartner[] = [];
    const seen = new Set<string>();

    for (const userId of userIds) {
      const partner = partnerById.get(userId);
      if (!partner || seen.has(partner.id)) continue;
      seen.add(partner.id);
      partnersForStripe.push(partner);
    }

    partnersForStripe.sort((a, b) => a.name.localeCompare(b.name));

    for (const companyId of companyIdsForStripe) {
      result[companyId] = partnersForStripe;
    }
  }

  return result;
}

export async function getReferralPartnersForCompany(
  companyId: string,
): Promise<CompanyReferralPartner[]> {
  const map = await getReferralPartnersByCompanyIds([companyId]);
  return map[companyId] ?? [];
}

/** All active sales / marketing partners for super-admin support user audit views. */
export async function listReferralSupportPartners(): Promise<CompanyReferralPartner[]> {
  const conn = await getReferralDbConnection();
  const User = getReferralUserModel(conn);
  const users = (await User.find({
    role: { $in: Array.from(PARTNER_ROLES) },
    status: { $nin: ['DELETED', 'DISABLED'] },
  })
    .select('emailAddress firstName lastName role')
    .sort({ firstName: 1, lastName: 1, emailAddress: 1 })
    .lean()) as ReferralUserDoc[];

  return users.map(formatReferralPartnerUser);
}
