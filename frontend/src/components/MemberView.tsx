"use client";

import {
  ArrowUpRight,
  BookOpenCheck,
  Flower2,
  HandHeart,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { CheckInChat } from "@/components/CheckInChat";
import type { AnalysisResponse } from "@/lib/types";

type MemberViewProps = {
  connected: boolean;
  onConnectionLost: (message: string) => void;
  onAnalysisComplete: (result: AnalysisResponse) => void;
};

export function MemberView({
  connected,
  onConnectionLost,
  onAnalysisComplete,
}: MemberViewProps) {
  return (
    <>
      <section className="welcome-band welcome-band-member">
        <div className="welcome-copy">
          <div className="welcome-kicker">
            <span className="welcome-kicker-line" />
            A moment for yourself
          </div>
          <h1 className="font-display">
            You don’t have to
            <br className="hidden sm:block" /> have it all figured out.
          </h1>
          <p>
            A gentle check-in can help us notice how it feels to belong, to be honest, and to care
            for one another.
          </p>
        </div>
        <div className="welcome-illustration" aria-hidden="true">
          <div className="illustration-sun" />
          <div className="illustration-hill illustration-hill-back" />
          <div className="illustration-hill illustration-hill-front" />
          <Flower2 className="illustration-flower" size={35} strokeWidth={1.2} />
          <span className="illustration-bird">✳</span>
        </div>
      </section>

      <div className="member-layout">
        <CheckInChat
          role="member"
          connected={connected}
          onConnectionLost={onConnectionLost}
          onAnalysisComplete={onAnalysisComplete}
        />
        <aside className="member-aside">
          <section className="privacy-card">
            <div className="privacy-icon">
              <LockKeyhole size={20} />
            </div>
            <p className="eyebrow">Held with care</p>
            <h2 className="font-display">A safe place to be honest.</h2>
            <p className="privacy-copy">
              Your raw words are never shown to your group leader. They receive only shared themes
              once enough people have checked in.
            </p>
            <div className="privacy-divider" />
            <div className="privacy-points">
              <p>
                <ShieldCheck size={16} /> Private by design
              </p>
              <p>
                <BookOpenCheck size={16} /> No names in group insights
              </p>
              <p>
                <HandHeart size={16} /> Here to support, not score you
              </p>
            </div>
            <div className="privacy-note">
              <Sparkles size={16} />
              <span>
                This check-in is a starting point for care—not a test, diagnosis, or measure of your
                faith.
              </span>
            </div>
          </section>

          <section className="small-note-card">
            <div className="small-note-heading">
              <span className="small-note-icon">
                <HandHeart size={17} />
              </span>
              <span>Small steps count</span>
            </div>
            <p>
              You can always pause, skip a question, or come back when the time feels right.
            </p>
            <a href="#check-in" className="text-link">
              How the check-in works <ArrowUpRight size={14} />
            </a>
          </section>
        </aside>
      </div>
    </>
  );
}
