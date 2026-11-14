"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Filter,
  HeartHandshake,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { cellHealthApi, getErrorMessage } from "@/lib/api";
import {
  DOMAIN_DETAILS,
  lowestDomain,
  makeMockAnalysis,
  makeMockSearch,
  totalBurnoutAlerts,
  totalCheckIns,
} from "@/lib/demo";
import type {
  AnalysisResponse,
  DashboardGroup,
  Domain,
  SearchMatch,
  StaffDashboardResponse,
} from "@/lib/types";

type StaffViewProps = {
  dashboard: StaffDashboardResponse;
  connected: boolean;
  onConnectionLost: (message: string) => void;
  onDashboardRefresh: () => void;
  onDemoNote: (groupId: string, summary: string, result: AnalysisResponse) => void;
};

const domainOptions: { value: Domain | "all"; label: string }[] = [
  { value: "all", label: "Any domain" },
  { value: "vulnerability", label: "Trust is the weakest pulse" },
  { value: "inclusion", label: "Belonging is the weakest pulse" },
  { value: "mutual_care", label: "Mutual care is the weakest pulse" },
  { value: "leader_sustainability", label: "Leader sustainability is weakest" },
];

export function StaffView({
  dashboard,
  connected,
  onConnectionLost,
  onDashboardRefresh,
  onDemoNote,
}: StaffViewProps) {
  const [district, setDistrict] = useState("all");
  const [domainFilter, setDomainFilter] = useState<Domain | "all">("all");
  const [burnoutOnly, setBurnoutOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<SearchMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [meetingNote, setMeetingNote] = useState("");
  const [meetingGroup, setMeetingGroup] = useState("G014");
  const [savingNote, setSavingNote] = useState(false);
  const [savedNote, setSavedNote] = useState<{
    result: AnalysisResponse;
    simulated: boolean;
  } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<DashboardGroup | null>(null);

  const districts = useMemo(
    () => [...new Set(dashboard.groups.map((group) => group.group.district))].sort(),
    [dashboard.groups],
  );
  const seededCount = dashboard.groups.filter((group) => group.checkInCount > 0).length;
  const alerts = totalBurnoutAlerts(dashboard.groups);
  const totalSubmissions = totalCheckIns(dashboard.groups);
  const averageSafety = useMemo(() => {
    const scores = dashboard.groups.flatMap((group) =>
      group.domainScores
        .map((item) => item.score)
        .filter((score): score is number => score !== null),
    );
    return scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null;
  }, [dashboard.groups]);

  const filteredGroups = useMemo(() => {
    return dashboard.groups
      .filter((group) => district === "all" || group.group.district === district)
      .filter((group) => !burnoutOnly || group.burnoutAlerts.length > 0)
      .filter(
        (group) =>
          domainFilter === "all" || lowestDomain(group)?.domain === domainFilter,
      )
      .sort((a, b) => {
        const scoreA =
          a.domainScores
            .map((item) => item.score)
            .filter((score): score is number => score !== null)
            .reduce((sum, score, _, all) => sum + score / all.length, 0) || 101;
        const scoreB =
          b.domainScores
            .map((item) => item.score)
            .filter((score): score is number => score !== null)
            .reduce((sum, score, _, all) => sum + score / all.length, 0) || 101;
        return scoreA - scoreB;
      });
  }, [dashboard.groups, district, domainFilter, burnoutOnly]);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query || searching) return;

    setSearching(true);
    setSearchError("");
    try {
      if (connected) {
        const result = await cellHealthApi.search(query);
        setSearchMatches(result.matches);
      } else {
        setSearchMatches(makeMockSearch(query, dashboard.groups));
      }
    } catch (error) {
      onConnectionLost(getErrorMessage(error));
      setSearchMatches(makeMockSearch(query, dashboard.groups));
    } finally {
      setSearching(false);
    }
  }

  async function submitMeetingNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = meetingNote.trim();
    if (!note || savingNote) return;

    const summary = `Staff 1-on-1 reflection: ${note}`;
    setSavingNote(true);
    setSavedNote(null);
    let result: AnalysisResponse;
    let simulated = !connected;

    if (connected) {
      try {
        result = await cellHealthApi.analyze({
          groupId: meetingGroup,
          role: "staff",
          participantResponses: [note],
          synthesizedSummary: summary,
          transcript: note,
        });
      } catch (error) {
        onConnectionLost(getErrorMessage(error));
        result = makeMockAnalysis(summary, "staff", meetingGroup);
        simulated = true;
      }
    } else {
      result = makeMockAnalysis(summary, "staff", meetingGroup);
    }

    setSavedNote({ result, simulated });
    setMeetingNote("");
    setSavingNote(false);
    if (simulated) {
      onDemoNote(meetingGroup, summary, result);
    } else {
      onDashboardRefresh();
    }

  }

  return (
    <>
      <section className="staff-welcome">
        <div className="staff-welcome-copy">
          <div className="welcome-kicker">
            <span className="welcome-kicker-line" />
            A wider view, held with care
          </div>
          <h1 className="font-display">
            Notice what’s happening
            <br className="hidden sm:block" /> across the whole family.
          </h1>
          <p>
            Listen across the network. Find the places asking for a little more attention, and the
            communities showing what care can look like.
          </p>
          <div className="staff-welcome-foot">
            <span>
              <MapPin size={14} /> 108 groups
            </span>
            <span className="staff-foot-divider" />
            <span>4 psychological safety domains</span>
          </div>
        </div>
        <div className="staff-welcome-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit-core">
            <HeartHandshake size={42} strokeWidth={1.2} />
          </div>
          <span className="orbit-node orbit-node-one" />
          <span className="orbit-node orbit-node-two" />
          <span className="orbit-node orbit-node-three" />
          <span className="orbit-node orbit-node-four" />
        </div>
      </section>

      <section className="stat-grid" aria-label="Network overview">
        <StatCard
          label="Groups in network"
          value={dashboard.networkGroupCount}
          detail={`${seededCount} groups with check-ins`}
          icon={<MapPin size={18} />}
          tint="sage"
        />
        <StatCard
          label="Check-ins received"
          value={totalSubmissions}
          detail="Member, leader & staff reflections"
          icon={<MessageCircle size={18} />}
          tint="clay"
        />
        <StatCard
          label="Burnout signals"
          value={alerts}
          detail={alerts ? "A gentle follow-up may help" : "No active alerts"}
          icon={<ShieldAlert size={18} />}
          tint={alerts ? "rose" : "sage"}
        />
        <StatCard
          label="Network pulse"
          value={averageSafety === null ? "—" : `${averageSafety}%`}
          detail="Average across available domains"
          icon={<Sparkles size={18} />}
          tint="gold"
        />
      </section>

      <div className="staff-workspace">
        <div className="staff-main-column">
          <section className="card-surface search-card">
            <div className="section-heading-row">
              <div>
                <div className="eyebrow mb-2 flex items-center gap-2">
                  <span className="eyebrow-dot" />
                  Listen across the network
                </div>
                <h2 className="font-display text-[1.65rem] text-[#233b33]">Ask your groups</h2>
                <p className="mt-1 text-sm text-[#7b8179]">
                  Search themes across anonymized check-ins, in everyday language.
                </p>
              </div>
              <span className="search-icon-orb">
                <Search size={20} />
              </span>
            </div>
            <form className="semantic-search" onSubmit={(event) => void submitSearch(event)}>
              <Search size={18} className="shrink-0 text-[#8a9388]" />
              <label className="sr-only" htmlFor="group-search">
                Ask your groups
              </label>
              <input
                id="group-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Where are newer members feeling left out?"
                maxLength={2000}
              />
              <button type="submit" disabled={!searchQuery.trim() || searching}>
                {searching ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <>
                    Ask <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
            <div className="suggestion-row">
              <span>Try asking</span>
              {[
                "Who may need a rest?",
                "Where are people feeling left out?",
                "How are groups sharing care?",
              ].map((suggestion) => (
                <button
                  type="button"
                  className="suggestion-chip"
                  key={suggestion}
                  onClick={() => {
                    setSearchQuery(suggestion);
                    setSearchError("");
                    setSearchMatches(null);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            {searchError ? <p className="mt-3 text-sm text-[#a0574b]">{searchError}</p> : null}
            {searchMatches ? (
              <div className="search-results">
                <div className="search-results-heading">
                  <p>
                    {searchMatches.length
                      ? `${searchMatches.length} groups with related reflections`
                      : "No close matches yet"}
                  </p>
                  <button
                    type="button"
                    className="quiet-icon-button"
                    onClick={() => setSearchMatches(null)}
                    aria-label="Clear search results"
                  >
                    <X size={15} />
                  </button>
                </div>
                {searchMatches.map((match, index) => (
                  <div className="search-result" key={`${match.group.id}-${index}`}>
                    <span className="search-result-rank">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <strong>{match.group.name}</strong>
                        <span className="search-result-district">{match.group.district}</span>
                      </div>
                      <p>{match.insight}</p>
                      <span className="domain-chip">
                        {DOMAIN_DETAILS[match.primaryDomain].shortLabel}
                      </span>
                    </div>
                    <span className="similarity-score">
                      {Math.round(match.similarity * 100)}%
                    </span>
                  </div>
                ))}
                {!connected ? (
                  <p className="mt-3 text-[0.7rem] text-[#9a8970]">
                    Simulated semantic matches · Local API is not connected
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="card-surface group-grid-section" id="group-grid">
            <div className="group-grid-header">
              <div>
                <div className="eyebrow mb-2 flex items-center gap-2">
                  <span className="eyebrow-dot" />
                  Ministry-wide listening
                </div>
                <h2 className="font-display text-[1.65rem] text-[#233b33]">108 group snapshots</h2>
                <p className="mt-1 text-sm text-[#7b8179]">
                  {seededCount} groups have demo check-ins. Select a group to view its shared themes.
                </p>
              </div>
              <span className="result-count">
                {filteredGroups.length} <small>shown</small>
              </span>
            </div>

            <div className="filter-toolbar">
              <div className="filter-label">
                <Filter size={15} /> Filter
              </div>
              <label className="filter-select">
                <span className="sr-only">Filter by district</span>
                <select value={district} onChange={(event) => setDistrict(event.target.value)}>
                  <option value="all">All districts</option>
                  {districts.map((item) => (
                    <option value={item} key={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="filter-select filter-domain">
                <span className="sr-only">Filter by weakest safety domain</span>
                <select
                  value={domainFilter}
                  onChange={(event) => setDomainFilter(event.target.value as Domain | "all")}
                >
                  {domainOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <button
                className={`burnout-filter ${burnoutOnly ? "burnout-filter-active" : ""}`}
                type="button"
                onClick={() => setBurnoutOnly((active) => !active)}
                aria-pressed={burnoutOnly}
              >
                <ShieldAlert size={14} /> Burnout flags
                {alerts > 0 ? <span>{alerts}</span> : null}
              </button>
              {(district !== "all" || domainFilter !== "all" || burnoutOnly) && (
                <button
                  type="button"
                  className="clear-filters"
                  onClick={() => {
                    setDistrict("all");
                    setDomainFilter("all");
                    setBurnoutOnly(false);
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {filteredGroups.length ? (
              <div className="group-grid">
                {filteredGroups.map((group) => (
                  <GroupCard
                    group={group}
                    key={group.group.id}
                    onClick={() => setSelectedGroup(group)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-filter-state">
                <CircleHelp size={20} />
                <p>No groups match these filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setDistrict("all");
                    setDomainFilter("all");
                    setBurnoutOnly(false);
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            <p className="grid-footnote">
              Group snapshots use aggregated themes only. Individual responses are never displayed
              to group leaders.
            </p>
          </section>
        </div>

        <aside className="staff-side-column">
          <section className="card-surface meeting-card">
            <div className="meeting-card-top">
              <span className="meeting-icon">
                <MessageCircle size={19} />
              </span>
              <span className="mode-tag mode-tag-local">Private note</span>
            </div>
            <div className="eyebrow mt-4 mb-2">Pastoral listening</div>
            <h2 className="font-display text-[1.55rem] leading-tight text-[#233b33]">
              Log a 1-on-1 leader meeting
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#7b8179]">
              Capture what the leader is carrying. Local analysis helps surface themes for
              thoughtful follow-up.
            </p>

            <form className="meeting-form" onSubmit={(event) => void submitMeetingNote(event)}>
              <label htmlFor="meeting-group">Group</label>
              <div className="meeting-select-wrap">
                <select
                  id="meeting-group"
                  value={meetingGroup}
                  onChange={(event) => setMeetingGroup(event.target.value)}
                >
                  {dashboard.groups.map((item) => (
                    <option value={item.group.id} key={item.group.id}>
                      {item.group.name} · {item.group.district}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </div>
              <label htmlFor="meeting-note">What came up in your conversation?</label>
              <div className="meeting-prompt">
                <Sparkles size={15} />
                <span>
                  Where are they finding joy? What feels heavy? What support could help them rest?
                </span>
              </div>
              <textarea
                id="meeting-note"
                value={meetingNote}
                onChange={(event) => setMeetingNote(event.target.value)}
                placeholder="Share a few notes from the conversation…"
                rows={5}
                maxLength={4000}
              />
              <div className="meeting-char-count">{meetingNote.length}/4,000</div>
              <button
                className="primary-button meeting-submit"
                type="submit"
                disabled={!meetingNote.trim() || savingNote}
              >
                {savingNote ? (
                  <>
                    <LoaderCircle className="animate-spin" size={16} /> Listening…
                  </>
                ) : (
                  <>
                    Analyze &amp; save locally <Send size={15} />
                  </>
                )}
              </button>
            </form>
            {savedNote ? (
              <div className="meeting-success" role="status">
                <Check size={16} />
                <div>
                  <strong>Meeting note recorded</strong>
                  <p>
                    {DOMAIN_DETAILS[savedNote.result.primaryDomain].label}
                    {savedNote.simulated ? " · simulated demo" : " · local analysis"}
                  </p>
                </div>
              </div>
            ) : null}
            <p className="meeting-privacy">
              <CircleHelp size={14} />
              Staff notes stay within this oversight view; group leaders see only anonymized pulse
              scores.
            </p>
          </section>

          <section className="gentle-alert-card">
            <div className="gentle-alert-icon">
              {alerts > 0 ? <ShieldAlert size={19} /> : <HeartHandshake size={19} />}
            </div>
            <div>
              <p className="eyebrow">A posture of care</p>
              <h3 className="font-display">
                {alerts > 0 ? "Notice, don’t diagnose." : "Keep listening."}
              </h3>
              <p>
                Signals are invitations to check in—not labels. Begin with curiosity, presence, and
                practical support.
              </p>
              <a className="text-link" href="#group-grid">
                Explore group snapshots <ArrowRight size={14} />
              </a>
            </div>
          </section>
        </aside>
      </div>

      {selectedGroup ? (
        <GroupDialog group={selectedGroup} onClose={() => setSelectedGroup(null)} />
      ) : null}
    </>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
  tint,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: ReactNode;
  tint: "sage" | "clay" | "rose" | "gold";
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon stat-icon-${tint}`}>{icon}</div>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      <p className="stat-detail">{detail}</p>
    </article>
  );
}

function GroupCard({
  group,
  onClick,
}: {
  group: DashboardGroup;
  onClick: () => void;
}) {
  const weakest = lowestDomain(group);
  const hasData = group.checkInCount > 0;
  const representativeScore = weakest?.score ?? null;

  return (
    <button className={`group-card ${!hasData ? "group-card-empty" : ""}`} onClick={onClick} type="button">
      <div className="group-card-head">
        <div className="group-card-location">
          <span className={`group-health-dot ${group.burnoutAlerts.length ? "group-health-dot-alert" : ""}`} />
          <div className="min-w-0">
            <strong>{group.group.name}</strong>
            <span>
              <MapPin size={11} /> {group.group.district}
            </span>
          </div>
        </div>
        {group.burnoutAlerts.length ? (
          <span className="burnout-indicator" title="Burnout flag">
            <ShieldAlert size={14} />
          </span>
        ) : null}
      </div>
      {hasData ? (
        <>
          <div className="group-pulse-line">
            <span className="group-pulse-domain">
              {weakest ? DOMAIN_DETAILS[weakest.domain].shortLabel : "Group pulse"}
            </span>
            {representativeScore !== null ? (
              <span className={`group-pulse-score ${representativeScore < 50 ? "score-low" : ""}`}>
                {Math.round(representativeScore)}
              </span>
            ) : null}
          </div>
          <div className="mini-domain-bars" aria-label="Four-domain pulse">
            {group.domainScores.map((item) => (
              <span
                key={item.domain}
                title={`${DOMAIN_DETAILS[item.domain].label}: ${item.score === null ? "No data" : Math.round(item.score)}`}
                style={{
                  backgroundColor: DOMAIN_DETAILS[item.domain].color,
                  opacity: item.score === null ? 0.18 : Math.max(0.35, item.score / 100),
                  width: item.score === null ? "18%" : `${Math.max(14, item.score)}%`,
                }}
              />
            ))}
          </div>
          <p className="group-card-insight">
            {group.triangulatedNotes[0]?.synthesizedSummary ??
              "Check-ins are coming together across the group."}
          </p>
          <div className="group-card-footer">
            <span>{group.checkInCount} check-ins · anonymized themes</span>
            <ArrowUpRight size={14} />
          </div>
        </>
      ) : (
        <div className="group-empty-content">
          <span className="empty-pulse">
            <span />
            <span />
            <span />
            <span />
          </span>
          <p>Awaiting first check-in</p>
          <small>Group is included in the 108-group network.</small>
        </div>
      )}
    </button>
  );
}

function GroupDialog({ group, onClose }: { group: DashboardGroup; onClose: () => void }) {
  const weakest = lowestDomain(group);
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        aria-labelledby="group-dialog-title"
        aria-modal="true"
        className="group-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="dialog-top">
          <div>
            <p className="eyebrow mb-1">Shared group snapshot</p>
            <h2 className="font-display text-2xl text-[#233b33]" id="group-dialog-title">
              {group.group.name}
            </h2>
            <p className="mt-1 text-sm text-[#7b8179]">{group.group.district}</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close group snapshot">
            <X size={17} />
          </button>
        </div>
        <div className="dialog-pulse-grid">
          {group.domainScores.map((item) => (
            <div className="dialog-score" key={item.domain}>
              <span className="dialog-score-dot" style={{ backgroundColor: DOMAIN_DETAILS[item.domain].color }} />
              <span>{DOMAIN_DETAILS[item.domain].shortLabel}</span>
              <strong>{item.score === null ? "—" : Math.round(item.score)}</strong>
            </div>
          ))}
        </div>
        <div className="dialog-next-step">
          {weakest && weakest.score < 55 ? (
            <ArrowDownRight size={16} />
          ) : (
            <ArrowUpRight size={16} />
          )}
          <span>
            {weakest
              ? `Keep listening around ${DOMAIN_DETAILS[weakest.domain].label.toLowerCase()}.`
              : "A group pulse will appear after at least three check-ins."}
          </span>
        </div>
        <div className="dialog-notes">
          <h3 className="font-display text-lg text-[#30483a]">What people are noticing</h3>
          {group.triangulatedNotes.length ? (
            group.triangulatedNotes.map((item, index) => (
              <article className="dialog-note" key={`${item.createdAt}-${index}`}>
                <span className="domain-chip">{DOMAIN_DETAILS[item.primaryDomain].shortLabel}</span>
                <p>{item.synthesizedSummary}</p>
                <time dateTime={item.createdAt}>
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                    new Date(item.createdAt),
                  )}
                </time>
              </article>
            ))
          ) : (
            <p className="text-sm text-[#858a80]">
              No shared themes yet. Check back after a few people have had a chance to check in.
            </p>
          )}
        </div>
        {group.burnoutAlerts.length ? (
          <div className="dialog-alert">
            <ShieldAlert size={16} />
            <p>
              <strong>Consider a personal check-in.</strong> A staff or leader reflection surfaced a
              sustainability concern. This is a prompt for care, not a diagnosis.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
