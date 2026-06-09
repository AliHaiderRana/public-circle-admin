const ADMIN_API_URL =
  process.env.MCP_ADMIN_API_URL || process.env.ADMIN_API_URL || "http://localhost:3000";

const INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY || "internal_admin_cron_key_2024";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${ADMIN_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Internal-API-Key": INTERNAL_API_KEY,
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data
        ? String((data as { error?: string }).error)
        : `Request failed with status ${response.status}`,
    );
  }

  return data;
}

export async function getSystemNotifications() {
  return request("/api/mcp/system-notifications");
}

export async function updateSystemNotifications(body: Record<string, unknown>) {
  return request("/api/mcp/system-notifications", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
