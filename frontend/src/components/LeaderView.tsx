"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Leaf, MessageCircleHeart } from "lucide-react";
import { CheckInChat } from "@/components/CheckInChat";
import { DomainPulse } from "@/components/DomainPulse";
import { cellHealthApi, getErrorMessage } from "@/lib/api";
import { getSeededGroups } from "@/lib/demo";
import type { DomainScore } from "@/lib/types";

type LeaderViewProps = {
  connected: boolean;
  onConnectionLost: (message: string) => void;
};

const fallbackScores =
  getSeededGroups().find((group) => group.group.id === "G014")?.domainScores ?? [];

export function LeaderView({ connected, onConnectionLost }: LeaderViewProps) {
  const [scores, setScores] = useState<DomainScore[]>(fallbackScores);
  const [status, setStatus] = useState<"ready" | "insufficient_data">("ready");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!connected) return;
    let active = true;
    void cellHealthApi
      .getLeaderDashboard("group-14")
      .then((response) => {
        if (!active) return;
        setStatus(response.status);
        setScores(response.domainScores ?? []);
      })
      .catch((error: unknown) => {
        if (!active) return;
        onConnectionLost(getErrorMessage(error));
        setScores(fallbackScores);
        setStatus("ready");
      });
    return () => {
      active = false;
    };
  }, [connected, onConnectionLost, refreshKey]);

  const handleAnalysis = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  return (
    <>
      <section className="welcome-band welcome-band-leader">
        <div className="welcome-copy">
          <div className="welcome-kicker">
            <span className="welcome-kicker-line" />
            For the people who make room
          </div>
          <h1 className="font-display">
            Caring for a group
            <br className="hidden sm:block" /> starts with caring for you.
          </h1>
          <p>
            Notice the small signs of trust and belonging—and make space for the one who holds the
            circle, too.
          </p>
        </div>
        <div className="welcome-illustration welcome-illustration-leader" aria-hidden="true">
          <div className="illustration-sun" />
          <div className="illustration-hill illustration-hill-back" />
          <div className="illustration-hill illustration-hill-front" />
          <Leaf className="illustration-leaf" size={37} strokeWidth={1.2} />
          <span className="illustration-bird">✳</span>
        </div>
      </section>

      <div className="leader-layout">
        <div id="check-in">
          <CheckInChat
            role="leader"
            connected={connected}
            onConnectionLost={onConnectionLost}
            onAnalysisComplete={handleAnalysis}
          />
        </div>
        <aside className="leader-aside">
          <DomainPulse scores={scores} />
          {status === "insufficient_data" ? (
            <p className="data-threshold-note">
              A pulse becomes visible once three or more people have checked in.
            </p>
          ) : null}
          <section className="coach-card">
            <div className="coach-card-icon">
              <MessageCircleHeart size={18} />
            </div>
            <div>
              <p className="eyebrow">A question to carry</p>
              <h3 className="font-display">Who is caring for the one who cares?</h3>
              <p>
                Name one responsibility you could share this week. A sustainable rhythm is a
                spiritual practice, too.
              </p>
              <button className="text-link" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                Return to your check-in <ArrowRight size={14} />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
