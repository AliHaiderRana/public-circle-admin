import { NextResponse } from "next/server";
import { getBackendApiUrl, getBackendAuthHeaders } from "@/lib/backend-api.server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cronName: string }> }
) {
  try {
    const { cronName } = await params;

    const response = await fetch(`${getBackendApiUrl()}/crons/${cronName}`, {
      headers: await getBackendAuthHeaders(),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch cron details" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[cron-detail] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
