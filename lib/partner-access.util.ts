import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import AdminUser from '@/lib/models/AdminUser';
import { SUPPORT_REQUEST_STATUS } from '@/lib/constants';
import { getPartnerStripeCustomerIds } from '@/lib/referral-partner.service';

export type AdminSessionLike = {
  userId?: string;
  isSuperAdmin?: boolean;
  isPartner?: boolean;
  referralUserId?: string;
  referralRole?: string;
};

export function isPartnerSession(session: AdminSessionLike | null | undefined): boolean {
  return Boolean(session?.isPartner && session?.referralUserId);
}

export function isFullAdminSession(session: AdminSessionLike | null | undefined): boolean {
  return Boolean(session && !session.isPartner);
}

const PARTNER_PAYMENT_API_PREFIXES = ['/api/stripe', '/api/plans'] as const;
const ADMIN_ASSIGNEE_CACHE_MS = 60_000;

let cachedAdminAssigneeIds: {
  expiresAt: number;
  ids: Array<string | mongoose.Types.ObjectId>;
} | null = null;

async function getInternalAdminAssigneeIds(): Promise<Array<string | mongoose.Types.ObjectId>> {
  const now = Date.now();
  if (cachedAdminAssigneeIds && cachedAdminAssigneeIds.expiresAt > now) {
    return cachedAdminAssigneeIds.ids;
  }

  await dbConnect();
  const admins = await AdminUser.find({}).select('_id').lean();
  const ids = admins.flatMap((admin) => {
    const id = String(admin._id);
    return mongoose.isValidObjectId(id)
      ? [id, new mongoose.Types.ObjectId(id)]
      : [id];
  });

  cachedAdminAssigneeIds = { ids, expiresAt: now + ADMIN_ASSIGNEE_CACHE_MS };
  return ids;
}

function buildPartnerAssigneeClauses(partnerId: string): Record<string, unknown>[] {
  const id = String(partnerId || '').trim();
  if (!id) return [];

  const clauses: Record<string, unknown>[] = [{ assignedAdminId: id }];
  if (mongoose.isValidObjectId(id)) {
    clauses.push({ assignedAdminId: new mongoose.Types.ObjectId(id) });
  }
  return clauses;
}

function normalizeTicketCompanyId(companyId: unknown): string {
  if (!companyId) return '';
  if (typeof companyId === 'object' && companyId !== null && '_id' in companyId) {
    return String((companyId as { _id: unknown })._id);
  }
  return String(companyId);
}

async function partnerCanAccessAssignedTicket(
  session: AdminSessionLike,
  ticket: { assignedAdminId?: unknown; companyId?: unknown },
): Promise<boolean> {
  const partnerId = String(session.referralUserId || session.userId || '');
  if (!partnerId || !ticket.assignedAdminId) return false;

  if (String(ticket.assignedAdminId) === partnerId) {
    return true;
  }

  const companyId = normalizeTicketCompanyId(ticket.companyId);
  if (!companyId) return false;

  const allowedCompanyIds = await getPartnerAllowedCompanyIds(session);
  if (!allowedCompanyIds.includes(companyId)) {
    return false;
  }

  const internalAdminIds = await getInternalAdminAssigneeIds();
  const assigneeId = String(ticket.assignedAdminId);
  return internalAdminIds.some((id) => String(id) === assigneeId);
}

export function isPartnerPaymentApiPath(pathname: string): boolean {
  return PARTNER_PAYMENT_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Block partner write requests (impersonation is allowed separately). */
export function denyPartnerWrite(
  session: AdminSessionLike | null | undefined,
): NextResponse | null {
  if (!isPartnerSession(session)) return null;
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/** Partners may reply on assigned tickets only — block internal notes and other support writes. */
export function denyPartnerSupportMessageWrite(
  session: AdminSessionLike | null | undefined,
  options?: { internal?: boolean },
): NextResponse | null {
  if (!isPartnerSession(session)) return null;
  if (options?.internal) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export type PartnerSupportTicketPatchBody = {
  status?: string;
  adminNotes?: unknown;
  assignedAdminId?: unknown;
  assignedAdminName?: unknown;
  anchorMessageId?: unknown;
  forceResolve?: boolean;
};

/** Partners may close tickets (pending customer confirmation) but not other ticket writes. */
export function denyPartnerSupportTicketPatch(
  session: AdminSessionLike | null | undefined,
  body: PartnerSupportTicketPatchBody,
): NextResponse | null {
  if (!isPartnerSession(session)) return null;

  const {
    status,
    adminNotes,
    assignedAdminId,
    assignedAdminName,
    anchorMessageId,
    forceResolve,
  } = body;

  if (forceResolve) {
    return NextResponse.json(
      { error: 'Only super admins can resolve tickets without customer confirmation' },
      { status: 403 },
    );
  }

  if (adminNotes !== undefined) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (
    assignedAdminId !== undefined ||
    assignedAdminName !== undefined ||
    anchorMessageId !== undefined
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (status !== SUPPORT_REQUEST_STATUS.RESOLVED) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}

/** Block partner access to billing / Stripe admin APIs. */
export function denyPartnerPaymentAccess(
  session: AdminSessionLike | null | undefined,
): NextResponse | null {
  if (!isPartnerSession(session)) return null;
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/** Remove billing fields from company payloads shown to partners. */
export function sanitizeCompanyForPartner<T extends Record<string, unknown>>(company: T): T {
  const { stripeCustomerId, purchasedPlan, ...rest } = company;
  void stripeCustomerId;
  void purchasedPlan;
  return rest as T;
}

/** Block partner access to support inbox / chat (admins only). */
export function denyPartnerSupportAccess(
  session: AdminSessionLike | null | undefined,
): NextResponse | null {
  if (!isPartnerSession(session)) return null;
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

const partnerCompanyCache = new Map<
  string,
  { expiresAt: number; companyIds: string[] }
>();
const CACHE_TTL_MS = 60_000;

export async function getPartnerAllowedCompanyIds(
  session: AdminSessionLike,
): Promise<string[]> {
  if (!isPartnerSession(session) || !session.referralUserId) {
    return [];
  }

  const cacheKey = `${session.referralUserId}:${session.referralRole || ''}`;
  const cached = partnerCompanyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.companyIds;
  }

  const stripeCustomerIds = await getPartnerStripeCustomerIds({
    referralUserId: session.referralUserId,
    referralRole: session.referralRole || 'MARKETING_AFFILIATE',
  });

  await dbConnect();

  const companies =
    stripeCustomerIds.length > 0
      ? await Company.find({ stripeCustomerId: { $in: stripeCustomerIds } })
          .select('_id')
          .lean()
      : [];

  const companyIds = companies.map((company) => String(company._id));
  partnerCompanyCache.set(cacheKey, {
    companyIds,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return companyIds;
}

export async function canPartnerAccessCompany(
  session: AdminSessionLike,
  companyId: unknown,
): Promise<boolean> {
  if (!isPartnerSession(session) || !companyId) return false;
  const allowed = await getPartnerAllowedCompanyIds(session);
  return allowed.includes(String(companyId));
}

export async function partnerCompanyFieldFilter(
  session: AdminSessionLike,
  field = 'company',
): Promise<Record<string, unknown>> {
  const companyIds = await getPartnerAllowedCompanyIds(session);
  if (!companyIds.length) {
    return { [field]: new mongoose.Types.ObjectId('000000000000000000000000') };
  }
  return {
    [field]: { $in: companyIds.map((id) => new mongoose.Types.ObjectId(id)) },
  };
}

/** Apply partner company scope to list queries (optional single-company filter). */
export async function resolvePartnerCompanyScope(
  session: AdminSessionLike,
  requestedCompanyId?: string,
): Promise<{ filter: Record<string, unknown>; forbidden: boolean }> {
  if (!isPartnerSession(session)) {
    return {
      filter: requestedCompanyId ? { company: requestedCompanyId } : {},
      forbidden: false,
    };
  }

  const allowed = await getPartnerAllowedCompanyIds(session);
  if (requestedCompanyId) {
    if (!allowed.includes(requestedCompanyId)) {
      return { filter: {}, forbidden: true };
    }
    return { filter: { company: requestedCompanyId }, forbidden: false };
  }

  return {
    filter: await partnerCompanyFieldFilter(session, 'company'),
    forbidden: false,
  };
}

export async function partnerCompaniesFilter(
  session: AdminSessionLike,
): Promise<Record<string, unknown>> {
  const companyIds = await getPartnerAllowedCompanyIds(session);
  if (!companyIds.length) {
    return { _id: new mongoose.Types.ObjectId('000000000000000000000000') };
  }
  return {
    _id: { $in: companyIds.map((id) => new mongoose.Types.ObjectId(id)) },
  };
}

export async function partnerTicketsFilterForReferralUser(
  referralUserId: string,
  referralRole = 'MARKETING_AFFILIATE',
): Promise<Record<string, unknown>> {
  return partnerTicketsFilter({
    isPartner: true,
    referralUserId,
    referralRole,
  });
}

export async function partnerTicketsFilter(
  session: AdminSessionLike,
): Promise<Record<string, unknown>> {
  const partnerId = session.referralUserId || session.userId;
  if (!isPartnerSession(session) || !partnerId) {
    return { assignedAdminId: new mongoose.Types.ObjectId('000000000000000000000000') };
  }

  const orClauses = buildPartnerAssigneeClauses(String(partnerId));
  const companyIds = await getPartnerAllowedCompanyIds(session);
  const internalAdminIds = await getInternalAdminAssigneeIds();

  if (companyIds.length > 0 && internalAdminIds.length > 0) {
    orClauses.push({
      companyId: { $in: companyIds.map((id) => new mongoose.Types.ObjectId(id)) },
      assignedAdminId: { $in: internalAdminIds },
    });
  }

  if (!orClauses.length) {
    return { assignedAdminId: new mongoose.Types.ObjectId('000000000000000000000000') };
  }

  return { $or: orClauses };
}

export async function canSessionAccessTicket(
  session: AdminSessionLike,
  ticket: { assignedAdminId?: unknown; companyId?: unknown },
): Promise<boolean> {
  if (!session) return false;
  if (session.isSuperAdmin) return true;

  if (isPartnerSession(session)) {
    return partnerCanAccessAssignedTicket(session, ticket);
  }

  if (!session.userId || !ticket.assignedAdminId) return false;
  return String(ticket.assignedAdminId) === String(session.userId);
}

export async function ticketsFilterForSession(
  session: AdminSessionLike,
): Promise<Record<string, unknown>> {
  if (isPartnerSession(session)) {
    return partnerTicketsFilter(session);
  }
  if (session.isSuperAdmin) return {};
  if (!session.userId) return { assignedAdminId: '__none__' };
  return { assignedAdminId: session.userId };
}

export { isPartnerAllowedPath, PARTNER_ALLOWED_PATH_PREFIXES } from '@/lib/partner-routes.util';
