import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY || "internal_admin_cron_key_2024";

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
    console.log("[API] Fetching crons from:", API_BASE_URL);
    const res = await fetch(`${API_BASE_URL}/crons`, {
      headers: {
        "x-internal-api-key": INTERNAL_API_KEY,
      },
    });

    console.log("[API] Backend response status:", res.status);

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      console.error("[API] Backend error:", errorBody);
      return NextResponse.json(
        {
          error: "Failed to fetch crons from backend",
          details: errorBody?.error || errorBody?.message || `Backend returned ${res.status}`,
          backendUrl: API_BASE_URL,
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    console.log("[API] Successfully fetched", data.crons?.length || 0, "crons");
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API] Error fetching crons via backend:", error);
    return NextResponse.json(
      { 
        error: "Failed to connect to backend", 
        details: error.message,
        backendUrl: API_BASE_URL 
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

    const res = await fetch(`${API_BASE_URL}/crons/seed`, {
      method: "POST",
      headers: {
        "x-internal-api-key": INTERNAL_API_KEY,
        "Content-Type": "application/json",
      },
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
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API] Error in crons POST proxy:", error);
    return NextResponse.json(
      { error: "Operation failed", details: error.message },
      { status: 500 }
    );
  }
}
