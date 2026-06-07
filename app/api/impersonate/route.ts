import { NextResponse } from "next/server";
import { getServerSession, toAdminAuditSession } from "@/lib/auth";
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from "@/lib/admin-audit";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY || "internal_admin_cron_key_2024";

/**
 * Base URL of the deployed public-circle web app (no trailing slash).
 * Used to build the redirect URL after minting an impersonation JWT on the API server.
 */
const PUBLIC_CIRCLE_APP_URL =
  process.env.PUBLIC_CIRCLE_APP_URL || process.env.NEXT_PUBLIC_PUBLIC_CIRCLE_APP_URL;

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  try {
    const res = await fetch(`${API_BASE_URL}/internal/impersonate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": INTERNAL_API_KEY,
      },
      body: JSON.stringify({
        userId,
        companyId,
        adminEmail: session.email ?? "",
        adminName: session.name ?? "",
      }),
    });

    const rawBody = await res.text();
    let payload: any = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      payload = {};
    }

    if (!res.ok) {
      const upstreamMessage =
        typeof payload?.message === "string"
          ? payload.message
          : typeof payload?.error === "string"
            ? payload.error
            : rawBody?.slice(0, 300);

      return NextResponse.json(
        {
          error: upstreamMessage || "Failed to create impersonation session",
          upstreamStatus: res.status,
        },
        { status: res.status }
      );
    }

    const token = payload?.data?.token as string | undefined;
    const sessionId = payload?.data?.sessionId as string | undefined;
    const impersonatedBy = payload?.data?.impersonatedBy as
      | { email?: string; name?: string }
      | undefined;
    const impersonatedUser = payload?.data?.impersonatedUser as
      | { id?: string; email?: string; name?: string }
      | undefined;
    const company = payload?.data?.company as
      | { id?: string; name?: string }
      | undefined;

    if (!token) {
      return NextResponse.json(
        { error: "Invalid response from server" },
        { status: 502 }
      );
    }

    const base = PUBLIC_CIRCLE_APP_URL.replace(/\/$/, "");
    const redirectUrl = new URL(`${base}/auth/jwt/admin-impersonate`);
    redirectUrl.searchParams.set("token", token);
    redirectUrl.searchParams.set("adminEmail", impersonatedBy?.email ?? session.email ?? "");
    redirectUrl.searchParams.set("adminName", impersonatedBy?.name ?? session.name ?? "");
    if (sessionId) {
      redirectUrl.searchParams.set("sessionId", sessionId);
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.IMPERSONATE_START,
        category: ADMIN_AUDIT_CATEGORY.IMPERSONATION,
        resourceType: 'user',
        resourceId: userId,
        details: {
          userId,
          companyId,
          impersonatedUserEmail: impersonatedUser?.email ?? '',
          impersonatedUserName: impersonatedUser?.name ?? '',
          companyName: company?.name ?? '',
          sessionId: sessionId ?? '',
        },
      });
    }

    return NextResponse.json({ redirectUrl: redirectUrl.toString() });
  } catch (e: any) {
    console.error("[impersonate]", e);
    return NextResponse.json(
      {
        error: "Failed to reach API server",
        details:
          typeof e?.message === "string" ? e.message : "Unknown network error",
      },
      { status: 502 }
    );
  }
}
