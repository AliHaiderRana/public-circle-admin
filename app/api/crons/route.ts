import { NextResponse } from "next/server";
import { getServerSession, toAdminAuditSession } from "@/lib/auth";
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from "@/lib/admin-audit";
import { getAdminLocalCronsForApi } from "@/lib/admin-cron-status.server";
import {
  getBackendApiUrl,
  getBackendAuthHeaders,
} from "@/lib/backend-api.server";

/**
 * GET /api/crons
 * Proxy to backend to list all cron jobs with their metadata (from definitions + history).
 */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const apiBaseUrl = getBackendApiUrl();
    const headers = await getBackendAuthHeaders();
    console.log("[API] Fetching crons from:", apiBaseUrl);
    const res = await fetch(`${apiBaseUrl}/crons`, { headers });

    console.log("[API] Backend response status:", res.status);

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      console.error("[API] Backend error:", errorBody);
      return NextResponse.json(
        {
          error: "Failed to fetch crons from backend",
          details: errorBody?.error || errorBody?.message || `Backend returned ${res.status}`,
          backendUrl: apiBaseUrl,
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    const localCrons = await getAdminLocalCronsForApi();
    const localCronNames = new Set(localCrons.map((cron) => cron.name));
    const mergedCrons = [
      ...(data.crons || []).filter((cron: { name: string }) => !localCronNames.has(cron.name)),
      ...localCrons,
    ].sort((a, b) =>
      String(a.displayName || a.name).localeCompare(String(b.displayName || b.name))
    );

    console.log(
      "[API] Successfully fetched",
      mergedCrons.length,
      "crons (",
      localCrons.length,
      "local )"
    );
    return NextResponse.json({ ...data, crons: mergedCrons });
  } catch (error: any) {
    console.error("[API] Error fetching crons via backend:", error);
    return NextResponse.json(
      { 
        error: "Failed to connect to backend", 
        details: error.message,
        backendUrl: getBackendApiUrl(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crons
 * Proxy to backend to (logically) seed cron metadata.
 * On the backend this is now a no-op that just returns current cron definitions.
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body || {};

    if (action !== "seed") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const res = await fetch(`${getBackendApiUrl()}/crons/seed`, {
      method: "POST",
      headers: await getBackendAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: "Failed to seed crons",
          details: errorBody?.error || errorBody?.message,
        },
        { status: res.status }
      );
    }

    const data = await res.json();

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.CRON_SEED,
        category: ADMIN_AUDIT_CATEGORY.CRON,
        resourceType: 'cron',
        details: { action: 'seed' },
      });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API] Error in crons POST proxy:", error);
    return NextResponse.json(
      { error: "Operation failed", details: error.message },
      { status: 500 }
    );
  }
}
