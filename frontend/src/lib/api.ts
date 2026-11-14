import type {
  AnalysisResponse,
  ChatLine,
  ChatResponse,
  DemoRole,
  LeaderDashboardResponse,
  SearchResponse,
  StaffDashboardResponse,
} from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_CELL_HEALTH_API_URL ?? "http://localhost:5000";

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 20_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string; title?: string }
        | null;
      throw new Error(body?.error ?? body?.title ?? `API request failed (${response.status}).`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const cellHealthApi = {
  async probe(): Promise<void> {
    await requestJson<{ checkInStatus: string }>(
      "/api/dashboard?role=member&groupId=group-14",
      undefined,
      3_500,
    );
  },

  getLeaderDashboard(groupId: string) {
    const params = new URLSearchParams({ role: "leader", groupId });
    return requestJson<LeaderDashboardResponse>(`/api/dashboard?${params}`);
  },

  getStaffDashboard() {
    return requestJson<StaffDashboardResponse>("/api/dashboard?role=staff", undefined, 30_000);
  },

  chat(role: DemoRole, message: string, history: ChatLine[]) {
    return requestJson<ChatResponse>(
      "/api/chat",
      {
        method: "POST",
        body: JSON.stringify({ role, message, history }),
      },
      180_000,
    );
  },

  analyze(input: {
    groupId: string;
    role: DemoRole;
    synthesizedSummary: string;
    transcript: string;
  }) {
    return requestJson<AnalysisResponse>(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      180_000,
    );
  },

  search(query: string) {
    return requestJson<SearchResponse>(
      "/api/search",
      {
        method: "POST",
        body: JSON.stringify({ query }),
      },
      180_000,
    );
  },
};

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The local API could not complete this request.";
}
