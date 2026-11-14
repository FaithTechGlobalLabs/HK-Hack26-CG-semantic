"use client";

import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, HeartHandshake } from "lucide-react";
import { DOMAIN_DETAILS } from "@/lib/demo";
import type { DomainScore } from "@/lib/types";

type DomainPulseProps = {
  scores: DomainScore[];
  isLoading?: boolean;
  onSelectDomain?: (domain: DomainScore["domain"]) => void;
};

export function DomainPulse({ scores, isLoading = false, onSelectDomain }: DomainPulseProps) {
  const lowest = useMemo(
    () =>
      scores
        .filter((item): item is DomainScore & { score: number } => item.score !== null)
        .sort((a, b) => a.score - b.score)[0],
    [scores],
  );

  const nextStep = lowest
    ? lowest.domain === "vulnerability"
      ? "Make room for honesty before moving quickly to advice."
      : lowest.domain === "inclusion"
        ? "Invite quieter voices in, and make introductions beyond familiar circles."
        : lowest.domain === "mutual_care"
          ? "Choose one practical way to share follow-up and care this week."
          : "Check the leader’s margin and name one responsibility to share."
    : "Three or more check-ins help reveal an anonymized group pulse.";

  return (
    <section className="card-surface px-5 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow mb-2 flex items-center gap-2">
            <span className="eyebrow-dot" />
            One group · Anonymized
          </div>
          <h2 className="font-display text-[1.55rem] text-[#233b33]">A group pulse</h2>
          <p className="mt-1 text-sm text-[#7b8179]">Psychological safety, across four domains</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eff2eb] text-[#587260]">
          <HeartHandshake size={20} />
        </span>
      </div>

      <div className="mt-6 space-y-4">
        {scores.map((item) => {
          const domain = DOMAIN_DETAILS[item.domain];
          const score = item.score;
          return (
            <button
              className={`pulse-row w-full text-left ${onSelectDomain ? "cursor-pointer" : "cursor-default"}`}
              key={item.domain}
              type="button"
              onClick={() => onSelectDomain?.(item.domain)}
              disabled={!onSelectDomain}
              aria-label={`${domain.label}: ${score === null ? "not enough data" : `${Math.round(score)} out of 100`}`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#3e5045]">{domain.label}</p>
                  <p className="text-xs text-[#92958b]">{domain.description}</p>
                </div>
                <span className="min-w-[36px] text-right text-sm font-semibold tabular-nums text-[#4d6253]">
                  {isLoading ? "—" : score === null ? "—" : Math.round(score)}
                </span>
              </div>
              <div className="pulse-track">
                <span
                  className={isLoading ? "pulse-fill pulse-fill-loading" : "pulse-fill"}
                  style={{
                    width: `${isLoading || score === null ? 0 : Math.max(4, Math.min(score, 100))}%`,
                    backgroundColor: domain.color,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-[#e8e7dd] bg-[#f8f7f2] p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#718073]">
          {lowest && lowest.score < 55 ? (
            <ArrowDownRight size={15} className="text-[#a16e5b]" />
          ) : (
            <ArrowUpRight size={15} className="text-[#5d805f]" />
          )}
          A thoughtful next step
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#566158]">{nextStep}</p>
      </div>
      <p className="mt-4 text-[0.7rem] leading-relaxed text-[#96988f]">
        Scores appear only after three check-ins. No individual answers or identities are shown.
      </p>
    </section>
  );
}
