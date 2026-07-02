import { NextResponse } from "next/server";
import { getServerSession, toAdminAuditSession } from "@/lib/auth";
import { isPartnerSession, canPartnerAccessCompany } from "@/lib/partner-access.util";
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from "@/lib/admin-audit";
import { logPartnerPortalActivity, PARTNER_PORTAL_ACTIONS } from '@/lib/partner-activity';
import {
  createImpersonationSession,
  ImpersonationError,
} from "@/lib/impersonation.server";
import { createImpersonationViaApi } from "@/lib/impersonation-api.server";

/**
 * Base URL of the deployed public-circle web app (no trailing slash).
 */
const PUBLIC_CIRCLE_APP_URL =
  process.env.PUBLIC_CIRCLE_APP_URL || process.env.NEXT_PUBLIC_PUBLIC_CIRCLE_APP_URL;

function buildRedirectUrl(data: {
  token: string;
  sessionId: string;
  impersonatedBy: { email: string; name: string };
}, options?: { impersonatorRole?: string }) {
  const base = PUBLIC_CIRCLE_APP_URL!.replace(/\/$/, "");
  const redirectUrl = new URL(`${base}/auth/jwt/admin-impersonate`);
  redirectUrl.searchParams.set("token", data.token);
  redirectUrl.searchParams.set("adminEmail", data.impersonatedBy.email);
  redirectUrl.searchParams.set("adminName", data.impersonatedBy.name);
  if (data.sessionId) {
    redirectUrl.searchParams.set("sessionId", data.sessionId);
  }
  if (options?.impersonatorRole) {
    redirectUrl.searchParams.set("impersonatorRole", options.impersonatorRole);
  }
  return redirectUrl.toString();
}

export async function POST(request: Request) {
  const session = await getServerSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Admin session expired — please sign in again and retry." },
      { status: 401 }
    );
  }

  if (!PUBLIC_CIRCLE_APP_URL) {
    return NextResponse.json(
      {
        error:
          "PUBLIC_CIRCLE_APP_URL (or NEXT_PUBLIC_PUBLIC_CIRCLE_APP_URL) is not configured",
      },
      { status: 500 }
    );
  }

  let body: { userId?: string; companyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, companyId } = body;
  if (!userId || !companyId) {
    return NextResponse.json(
      { error: "userId and companyId are required" },
      { status: 400 }
    );
  }

  if (isPartnerSession(session)) {
    const allowed = await canPartnerAccessCompany(session, companyId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const adminEmail = session.email ?? "";
  const adminName = session.name ?? "";

  try {
    // Prefer API server so the JWT is signed with the live ACCESS_TOKEN_SECRET.
    let data =
      (await createImpersonationViaApi({
        userId,
        companyId,
        adminEmail,
        adminName,
      })) ?? null;

    if (!data) {
      data = await createImpersonationSession({
        userId,
        companyId,
        adminEmail,
        adminName,
      });
    }

    const redirectUrl = buildRedirectUrl(data, {
      impersonatorRole: session.referralRole,
    });

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      if (isPartnerSession(session)) {
        await logPartnerPortalActivity(auditSession, {
          action: PARTNER_PORTAL_ACTIONS.IMPERSONATE_START,
          resourceType: 'user',
          resourceId: userId,
          details: {
            companyId,
            impersonatedUserEmail: data.impersonatedUser.email,
            companyName: data.company.name,
          },
        });
      }

      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.IMPERSONATE_START,
        category: ADMIN_AUDIT_CATEGORY.IMPERSONATION,
        resourceType: "user",
        resourceId: userId,
        details: {
          userId,
          companyId,
          impersonatedUserEmail: data.impersonatedUser.email,
          impersonatedUserName: data.impersonatedUser.name,
          companyName: data.company.name,
          sessionId: data.sessionId,
          referralRole: session.referralRole,
        },
      });
    }

    return NextResponse.json({ redirectUrl });
  } catch (e) {
    if (e instanceof ImpersonationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[impersonate]", e);
    return NextResponse.json(
      {
        error: "Failed to start impersonation session",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
