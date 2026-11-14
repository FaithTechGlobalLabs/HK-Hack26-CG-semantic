"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, Cpu, Database, Heart } from "lucide-react";
import { LeaderView } from "@/components/LeaderView";
import { MemberView } from "@/components/MemberView";
import { StaffView } from "@/components/StaffView";
import { TopBar } from "@/components/TopBar";
import { cellHealthApi, getErrorMessage } from "@/lib/api";
import { makeDemoDashboard } from "@/lib/demo";
import type { AnalysisResponse, DemoRole, Domain, StaffDashboardResponse } from "@/lib/types";

type EngineStatus = "checking" | "connected" | "offline";

export default function Home() {
  const [role, setRole] = useState<DemoRole>("member");
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("checking");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [dashboard, setDashboard] = useState<StaffDashboardResponse>(makeDemoDashboard);
  const [refreshKey, setRefreshKey] = useState(0);

  const markConnectionLost = useCallback((message: string) => {
    setEngineStatus("offline");
    setConnectionMessage(message);
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function checkConnection() {
      try {
        await cellHealthApi.probe();
        if (active) {
          setEngineStatus("connected");
          setConnectionMessage("");
        }
      } catch (error) {
        if (active) {
          setEngineStatus("offline");
          setConnectionMessage(getErrorMessage(error));
        }
      } finally {
        if (active) {
          timer = setTimeout(() => void checkConnection(), 8_000);
        }
      }
    }

    void checkConnection();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (role !== "staff" || engineStatus !== "connected") return;
    let active = true;
    void cellHealthApi
      .getStaffDashboard()
      .then((response) => {
        if (active) setDashboard(response);
      })
      .catch((error: unknown) => {
        if (active) markConnectionLost(getErrorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [role, engineStatus, markConnectionLost, refreshKey]);

  const addDemoNote = useCallback(
    (groupId: string, summary: string, result: AnalysisResponse) => {
      const canonicalId = groupId.toLowerCase().startsWith("group-")
        ? `G${groupId.slice("group-".length).padStart(3, "0")}`
        : groupId;
      const domain: Domain = result.primaryDomain;
      const score = Math.round(((result.healthSentiment + 1) / 2) * 100);
      setDashboard((current) => ({
        ...current,
        groups: current.groups.map((group) => {
          if (group.group.id.toLowerCase() !== canonicalId.toLowerCase()) return group;
          const domainScores = group.domainScores.map((item) => {
            if (item.domain !== domain) return item;
            const count = item.checkInCount;
            return {
              ...item,
              score:
                item.score === null
                  ? score
                  : Math.round((item.score * count + score) / (count + 1)),
              checkInCount: count + 1,
            };
          });
          return {
            ...group,
            checkInCount: group.checkInCount + 1,
            domainScores,
            triangulatedNotes: [
              {
                primaryDomain: domain,
                synthesizedSummary: summary,
                createdAt: new Date().toISOString(),
              },
              ...group.triangulatedNotes,
            ],
            burnoutAlerts: result.burnoutFlag
              ? [
                  {
                    primaryDomain: domain,
                    synthesizedSummary: summary,
                    createdAt: new Date().toISOString(),
                  },
                  ...group.burnoutAlerts,
                ]
              : group.burnoutAlerts,
          };
        }),
      }));
    },
    [],
  );

  const footerMode =
    engineStatus === "connected"
      ? "Connected to the local LM-Kit engine"
      : "Simulated demo · Local API will connect when ready";

  return (
    <div className="app-shell">
      <TopBar role={role} status={engineStatus} onRoleChange={setRole} />

      <main className="app-main">
        {engineStatus === "offline" ? (
          <div
            className="fallback-banner"
            role="status"
            aria-live="polite"
            title={connectionMessage || "Using simulated demo interactions until the local API responds."}
          >
            <span className="fallback-banner-icon">
              <Cpu size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <strong>Local engine is warming up</strong>
              <p>
                This screen is using simulated demo responses. Your check-ins still feel complete
                while the model service starts.
              </p>
            </div>
            <span className="fallback-detail">API · localhost:5000</span>
          </div>
        ) : null}

        {role === "member" ? (
          <MemberView
            connected={engineStatus === "connected"}
            onConnectionLost={markConnectionLost}
            onAnalysisComplete={() => setRefreshKey((key) => key + 1)}
          />
        ) : role === "leader" ? (
          <LeaderView
            connected={engineStatus === "connected"}
            onConnectionLost={markConnectionLost}
          />
        ) : (
          <StaffView
            dashboard={dashboard}
            connected={engineStatus === "connected"}
            onConnectionLost={markConnectionLost}
            onDashboardRefresh={() => setRefreshKey((key) => key + 1)}
            onDemoNote={addDemoNote}
          />
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-brand">
          <span>
            <Heart size={13} fill="currentColor" />
          </span>
          <strong>common ground</strong>
        </div>
        <p>{footerMode}</p>
        <div className="footer-local">
          <CircleCheck size={14} /> No external database
          <span className="footer-separator">·</span>
          <Database size={14} /> Local demo data
        </div>
        <span>Built for local listening</span>
      </footer>
    </div>
  );
}
