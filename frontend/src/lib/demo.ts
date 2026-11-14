import type {
  AnalysisResponse,
  BurnoutAlert,
  ChatLine,
  DashboardGroup,
  DemoRole,
  Domain,
  DomainScore,
  SearchMatch,
  StaffDashboardResponse,
  StaffNote,
} from "@/lib/types";

export const DOMAIN_DETAILS: Record<
  Domain,
  { label: string; shortLabel: string; description: string; color: string }
> = {
  vulnerability: {
    label: "Vulnerability & trust",
    shortLabel: "Trust",
    description: "Room to be honest without fear of judgment",
    color: "#637e69",
  },
  inclusion: {
    label: "Inclusion & belonging",
    shortLabel: "Belonging",
    description: "Feeling welcomed, seen, and included",
    color: "#b4874e",
  },
  mutual_care: {
    label: "Mutual care",
    shortLabel: "Care",
    description: "Sharing burdens and following through",
    color: "#7d8f8b",
  },
  leader_sustainability: {
    label: "Leader sustainability",
    shortLabel: "Sustainability",
    description: "A healthy rhythm for those who lead",
    color: "#a16e5b",
  },
};

const domainNames: Domain[] = [
  "vulnerability",
  "inclusion",
  "mutual_care",
  "leader_sustainability",
];

function scores(values: [number, number, number, number]): DomainScore[] {
  return domainNames.map((domain, index) => ({
    domain,
    score: values[index],
    checkInCount: 1,
  }));
}

function note(primaryDomain: Domain, synthesizedSummary: string, daysAgo = 2): StaffNote {
  return {
    primaryDomain,
    synthesizedSummary,
    createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  };
}

function burnoutNote(summary: string): BurnoutAlert {
  return note("leader_sustainability", summary, 1);
}

const seededGroups: DashboardGroup[] = [
  {
    group: { id: "G001", name: "North Cell 001", district: "North" },
    checkInCount: 3,
    domainScores: scores([84, 76, 88, 72]),
    triangulatedNotes: [
      note("vulnerability", "Members describe the circle as a trustworthy place to share hard weeks."),
      note("inclusion", "Newer members are finding a place in the group's weekly rhythm."),
      note("mutual_care", "Practical care was shared after a family illness."),
    ],
    burnoutAlerts: [],
  },
  {
    group: { id: "G002", name: "North Cell 002", district: "North" },
    checkInCount: 3,
    domainScores: scores([42, 38, 58, 24]),
    triangulatedNotes: [
      note("vulnerability", "Some people are holding back because they worry about being judged."),
      note("inclusion", "Established friendships can make it hard for newer people to join in."),
      note("leader_sustainability", "Follow-up and coordination are falling mostly to one leader."),
    ],
    burnoutAlerts: [burnoutNote("The leader reports tiredness and little room to step back.")],
  },
  {
    group: { id: "G014", name: "Group 14 — Kennedy Town", district: "Hong Kong Island" },
    checkInCount: 3,
    domainScores: scores([81, 69, 84, 62]),
    triangulatedNotes: [
      note("vulnerability", "Members are beginning to share doubts and ask for prayer without pressure."),
      note("mutual_care", "People have been taking turns checking in during the week."),
      note("leader_sustainability", "The leader would welcome a more sustainable schedule."),
    ],
    burnoutAlerts: [],
  },
  {
    group: { id: "G028", name: "East Cell 028", district: "East" },
    checkInCount: 3,
    domainScores: scores([58, 86, 82, 77]),
    triangulatedNotes: [
      note("inclusion", "People notice when someone has been away and make it easy to reconnect."),
      note("mutual_care", "Members have offered meals and rides without waiting for the leader."),
      note("vulnerability", "There is kindness, though conflict can still feel difficult to raise."),
    ],
    burnoutAlerts: [],
  },
  {
    group: { id: "G029", name: "East Cell 029", district: "East" },
    checkInCount: 3,
    domainScores: scores([78, 45, 54, 28]),
    triangulatedNotes: [
      note("inclusion", "A few close friendships shape most plans and some members feel peripheral."),
      note("vulnerability", "Recent conversations have made more room for honest stories."),
      note("leader_sustainability", "A leader is struggling to rest between ministry commitments."),
    ],
    burnoutAlerts: [burnoutNote("The leader is having difficulty resting and carrying follow-up alone.")],
  },
  {
    group: { id: "G030", name: "East Cell 030", district: "East" },
    checkInCount: 3,
    domainScores: scores([83, 64, 71, 79]),
    triangulatedNotes: [
      note("vulnerability", "People are trusting one another with difficult conversations."),
      note("inclusion", "A few quieter members may need a gentle invitation into the group."),
      note("leader_sustainability", "Shared hosting has made the weekly rhythm feel more balanced."),
    ],
    burnoutAlerts: [],
  },
  {
    group: { id: "G055", name: "South Cell 055", district: "South" },
    checkInCount: 3,
    domainScores: scores([64, 82, 88, 32]),
    triangulatedNotes: [
      note("mutual_care", "Members are receiving practical support without feeling ashamed to ask."),
      note("inclusion", "The group is intentionally welcoming people who arrive on their own."),
      note("leader_sustainability", "A leader has been saying yes to too many requests."),
    ],
    burnoutAlerts: [burnoutNote("The current pace is leaving the leader worn down.")],
  },
  {
    group: { id: "G056", name: "South Cell 056", district: "South" },
    checkInCount: 3,
    domainScores: scores([72, 73, 83, 70]),
    triangulatedNotes: [
      note("vulnerability", "Members feel respected even when they disagree."),
      note("mutual_care", "People have started checking on one another during the week."),
      note("vulnerability", "Some still feel pressure to present life as going well."),
    ],
    burnoutAlerts: [],
  },
  {
    group: { id: "G057", name: "South Cell 057", district: "South" },
    checkInCount: 3,
    domainScores: scores([73, 34, 52, 22]),
    triangulatedNotes: [
      note("inclusion", "Some participants feel left out of plans made within a close circle."),
      note("leader_sustainability", "The leader is tired and has not had a real break."),
      note("vulnerability", "Members are responding gently as more honest conversations emerge."),
    ],
    burnoutAlerts: [burnoutNote("The leader says too much depends on them and rest has been difficult.")],
  },
  {
    group: { id: "G082", name: "West Cell 082", district: "West" },
    checkInCount: 3,
    domainScores: scores([82, 75, 81, 31]),
    triangulatedNotes: [
      note("vulnerability", "Members are more comfortable talking about uncertainty."),
      note("mutual_care", "Transportation and meals are being shared across the group."),
      note("leader_sustainability", "The current pace cannot continue without help setting limits."),
    ],
    burnoutAlerts: [burnoutNote("The leader needs support setting a more sustainable pace.")],
  },
  {
    group: { id: "G083", name: "West Cell 083", district: "West" },
    checkInCount: 3,
    domainScores: scores([47, 42, 81, 63]),
    triangulatedNotes: [
      note("inclusion", "Quieter members can find it hard to enter existing conversations."),
      note("mutual_care", "Members are taking initiative to check in on one another."),
      note("vulnerability", "Some are cautious about sharing struggles for fear of judgment."),
    ],
    burnoutAlerts: [],
  },
  {
    group: { id: "G084", name: "West Cell 084", district: "West" },
    checkInCount: 3,
    domainScores: scores([76, 84, 67, 39]),
    triangulatedNotes: [
      note("vulnerability", "Members feel able to be honest about what is difficult."),
      note("leader_sustainability", "The leader is grateful for the group but is carrying many follow-ups."),
      note("inclusion", "Members are introducing newcomers and inviting them into the week."),
    ],
    burnoutAlerts: [burnoutNote("A leader would benefit from shared responsibility and more rest.")],
  },
];

export function makeDemoDashboard(): StaffDashboardResponse {
  const seededById = new Map(seededGroups.map((group) => [group.group.id, group]));
  const groups = Array.from({ length: 108 }, (_, index) => {
    const number = index + 1;
    const id = `G${String(number).padStart(3, "0")}`;
    const seeded = seededById.get(id);
    if (seeded) return seeded;

    const district =
      number <= 27
        ? "North"
        : number <= 54
          ? "East"
          : number <= 81
            ? "South"
            : "West";
    return {
      group: {
        id,
        name: `${district} Cell ${String(number).padStart(3, "0")}`,
        district,
      },
      checkInCount: 0,
      domainScores: domainNames.map((domain) => ({
        domain,
        score: null,
        checkInCount: 0,
      })),
      triangulatedNotes: [],
      burnoutAlerts: [],
    };
  });

  return { role: "staff", networkGroupCount: 108, seededGroupCount: 12, groups };
}

export function makeMockChatReply(role: DemoRole, turn: number): string {
  if (turn === 1) {
    return role === "leader"
      ? "I hear how much you care about the group. What part of leading has been hardest to manage lately?"
      : "Thank you for sharing that. When you have a hard week, what kind of support from someone in the group would help you most?";
  }
  if (turn === 2) {
    return role === "leader"
      ? "What is one responsibility you could share with someone else to make leading more sustainable?"
      : "What is one small thing the group could do to help you feel more connected or supported?";
  }
  return "Thank you for being open. Your reflections will be considered as shared themes, not shown as individual answers.";
}

export function makeMockAnalysis(
  summary: string,
  role: DemoRole,
  groupId = "group-14",
): AnalysisResponse {
  const lower = summary.toLowerCase();
  let primaryDomain: Domain = "vulnerability";
  let category = "authentic vulnerability and trust";
  let healthSentiment = 0.7;
  let burnoutFlag = false;

  if (/\b(burn.?out|exhaust|overwhelm|no rest|too much|worn down)\b/.test(lower)) {
    primaryDomain = "leader_sustainability";
    category = "leader exhaustion or burnout";
    healthSentiment = -0.8;
    burnoutFlag = true;
  } else if (/\b(left out|isolat|belong|newcom|welcome|included)\b/.test(lower)) {
    primaryDomain = "inclusion";
    category = "inclusion and warm belonging";
    healthSentiment = 0.55;
  } else if (/\b(care|help|support|burden|meal|ride)\b/.test(lower)) {
    primaryDomain = "mutual_care";
    category = "mutual care and shared burden";
    healthSentiment = 0.65;
  } else if (/\b(judge|afraid|hold back|surface|shallow)\b/.test(lower)) {
    category = "superficiality or fear of judgment";
    healthSentiment = -0.45;
  }

  return {
    id: `demo-${Date.now()}`,
    groupId,
    role,
    category,
    primaryDomain,
    healthSentiment,
    burnoutFlag,
  };
}

export function makeMockSearch(query: string, groups: DashboardGroup[]): SearchMatch[] {
  const lower = query.toLowerCase();
  const preferredDomain: Domain = /burn.?out|exhaust|rest|tired/.test(lower)
    ? "leader_sustainability"
    : /left out|newer|isolat|belong|welcome/.test(lower)
      ? "inclusion"
      : /care|burden|help|support/.test(lower)
        ? "mutual_care"
        : "vulnerability";

  return groups
    .filter((group) => group.checkInCount > 0)
    .map((group) => {
      const noteMatch = group.triangulatedNotes.find(
        (item) => item.primaryDomain === preferredDomain,
      );
      return {
        group: group.group,
        primaryDomain: noteMatch?.primaryDomain ?? preferredDomain,
        insight:
          noteMatch?.synthesizedSummary ??
          "A check-in highlighted the need for continued listening and practical follow-up.",
        similarity: noteMatch ? 0.84 : 0.71,
        healthSentiment:
          (group.domainScores.find((item) => item.domain === preferredDomain)?.score ?? 50) / 50 -
          1,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 4);
}

export function formatSummary(lines: ChatLine[]): string {
  const userMessages = lines
    .filter((line) => line.role === "user")
    .map((line) => line.content.trim())
    .filter(Boolean);

  const reflection = userMessages.join(" ").toLowerCase();
  const themes = [
    /\b(honest|trust|safe|judg|vulnerab|share openly)\b/.test(reflection)
      ? "trust and psychological safety"
      : "",
    /\b(left out|isolat|belong|newcom|welcome|included)\b/.test(reflection)
      ? "belonging and inclusion"
      : "",
    /\b(care|help|support|burden|meal|ride|share the load)\b/.test(reflection)
      ? "mutual care and shared support"
      : "",
    /\b(burn.?out|exhaust|overwhelm|rest|tired|sustainab)\b/.test(reflection)
      ? "leader sustainability and rest"
      : "",
  ].filter(Boolean);
  const summary =
    themes.length > 0
      ? themes.join(", ")
      : "connection, group belonging, and what could make the week feel more supportive";
  return `An anonymized check-in surfaced themes of ${summary}. No names or direct quotations are included.`;
}

export function lowestDomain(
  group: DashboardGroup,
): (Omit<DomainScore, "score"> & { score: number }) | undefined {
  return group.domainScores
    .filter((score): score is DomainScore & { score: number } => score.score !== null)
    .sort((a, b) => a.score - b.score)[0];
}

export function totalBurnoutAlerts(groups: DashboardGroup[]): number {
  return groups.reduce((total, group) => total + group.burnoutAlerts.length, 0);
}

export function totalCheckIns(groups: DashboardGroup[]): number {
  return groups.reduce((total, group) => total + group.checkInCount, 0);
}

export function getSeededGroups(): DashboardGroup[] {
  return seededGroups;
}

export function getEmptyScores(): DomainScore[] {
  return domainNames.map((domain) => ({ domain, score: null, checkInCount: 0 }));
}
