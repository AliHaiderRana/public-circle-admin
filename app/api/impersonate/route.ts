import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";

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

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            typeof payload?.message === "string"
              ? payload.message
              : "Failed to create impersonation session",
        },
        { status: res.status }
      );
    }

    const token = payload?.data?.token as string | undefined;
    const impersonatedBy = payload?.data?.impersonatedBy as
      | { email?: string; name?: string }
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

    return NextResponse.json({ redirectUrl: redirectUrl.toString() });
  } catch (e) {
    console.error("[impersonate]", e);
    return NextResponse.json(
      { error: "Failed to reach API server" },
      { status: 502 }
    );
  }
}
