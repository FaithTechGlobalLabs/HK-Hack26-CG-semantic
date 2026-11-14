export type DemoRole = "member" | "leader" | "staff";

export type Domain =
  | "vulnerability"
  | "inclusion"
  | "mutual_care"
  | "leader_sustainability";

export type DomainScore = {
  domain: Domain;
  score: number | null;
  checkInCount: number;
};

export type GroupSummary = {
  id: string;
  name: string;
  district: string;
};

export type StaffNote = {
  primaryDomain: Domain;
  synthesizedSummary: string;
  createdAt: string;
};

export type BurnoutAlert = StaffNote;

export type DashboardGroup = {
  group: GroupSummary;
  checkInCount: number;
  domainScores: DomainScore[];
  triangulatedNotes: StaffNote[];
  burnoutAlerts: BurnoutAlert[];
};

export type StaffDashboardResponse = {
  role: "staff";
  networkGroupCount: number;
  seededGroupCount: number;
  groups: DashboardGroup[];
};

export type LeaderDashboardResponse = {
  role: "leader";
  group: GroupSummary;
  status: "ready" | "insufficient_data";
  domainScores?: DomainScore[];
};

export type ChatLine = {
  role: "assistant" | "user";
  content: string;
};

export type ChatResponse = {
  response: string;
  turn: number;
  isComplete: boolean;
};

export type AnalysisResponse = {
  id: string;
  groupId: string;
  role: DemoRole;
  category: string;
  primaryDomain: Domain;
  healthSentiment: number;
  burnoutFlag: boolean;
};

export type SearchMatch = {
  group: GroupSummary;
  primaryDomain: Domain;
  insight: string;
  similarity: number;
  healthSentiment: number;
};

export type SearchResponse = {
  query: string;
  matches: SearchMatch[];
};
