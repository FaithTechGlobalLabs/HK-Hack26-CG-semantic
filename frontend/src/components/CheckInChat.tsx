"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowUp,
  Check,
  Heart,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { cellHealthApi, getErrorMessage } from "@/lib/api";
import {
  DOMAIN_DETAILS,
  formatSummary,
  makeMockAnalysis,
  makeMockChatReply,
} from "@/lib/demo";
import type { AnalysisResponse, ChatLine } from "@/lib/types";

type CheckInChatProps = {
  role: "member" | "leader";
  connected: boolean;
  onConnectionLost: (message: string) => void;
  onAnalysisComplete?: (result: AnalysisResponse) => void;
};

const firstPrompts: Record<CheckInChatProps["role"], string> = {
  member: "What has helped you feel safe, known, or welcomed in your group recently?",
  leader: "What has been giving your group life lately, and where might a few people still be waiting to feel included?",
};

export function CheckInChat({
  role,
  connected,
  onConnectionLost,
  onAnalysisComplete,
}: CheckInChatProps) {
  const [lines, setLines] = useState<ChatLine[]>([
    {
      role: "assistant",
      content: `Hi, I’m glad you made a little space for this. ${firstPrompts[role]}`,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [summary, setSummary] = useState("");
  const [simulated, setSimulated] = useState(false);

  const userTurns = lines.filter((line) => line.role === "user").length;
  const finished = analysis !== null;

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || isSending || finished || userTurns >= 3) return;

    const turn = userTurns + 1;
    const previousLines = lines;
    const nextLines = [...previousLines, { role: "user" as const, content: message }];
    setLines(nextLines);
    setDraft("");
    setIsSending(true);

    let response: string;
    let usedLiveChat = false;
    if (connected) {
      try {
        const result = await cellHealthApi.chat(role, message, previousLines);
        response = result.response;
        usedLiveChat = true;
      } catch (requestError) {
        onConnectionLost(getErrorMessage(requestError));
        response = makeMockChatReply(role, turn);
        setSimulated(true);
      }
    } else {
      response = makeMockChatReply(role, turn);
      setSimulated(true);
    }

    const completedLines = [...nextLines, { role: "assistant" as const, content: response }];
    setLines(completedLines);
    setIsSending(false);

    if (turn === 3) {
      const synthesizedSummary = formatSummary(completedLines);
      const transcript = completedLines
        .map((line) => `${line.role === "user" ? "Participant" : "Pastoral companion"}: ${line.content}`)
        .join("\n");
      setSummary(synthesizedSummary);
      setIsAnalyzing(true);

      let result: AnalysisResponse;
      if (usedLiveChat && connected) {
        try {
          result = await cellHealthApi.analyze({
            groupId: "group-14",
            role,
            synthesizedSummary,
            transcript,
          });
        } catch (requestError) {
          onConnectionLost(getErrorMessage(requestError));
          result = makeMockAnalysis(synthesizedSummary, role);
          setSimulated(true);
        }
      } else {
        result = makeMockAnalysis(synthesizedSummary, role);
        setSimulated(true);
      }

      setAnalysis(result);
      setIsAnalyzing(false);
      onAnalysisComplete?.(result);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function restart() {
    setLines([
      {
        role: "assistant",
        content: `Hi, I’m glad you made a little space for this. ${firstPrompts[role]}`,
      },
    ]);
    setDraft("");
    setAnalysis(null);
    setSummary("");
    setSimulated(false);
    setIsAnalyzing(false);
  }

  const domain = analysis ? DOMAIN_DETAILS[analysis.primaryDomain] : null;
  const sentimentPercent = analysis
    ? Math.round(((analysis.healthSentiment + 1) / 2) * 100)
    : 0;

  return (
    <section id="check-in" className="card-surface flex min-h-[620px] flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-[#e9e7df] px-5 py-5 sm:px-7">
        <div>
          <div className="eyebrow mb-2 flex items-center gap-2">
            <span className="eyebrow-dot" />
            A quiet moment, just for you
          </div>
          <h2 className="font-display text-[1.65rem] leading-tight text-[#233b33]">
            {role === "member" ? "Your check-in" : "A check-in for the person who leads"}
          </h2>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={restart}
          aria-label="Start a new check-in"
          title="Start a new check-in"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {role === "member" ? (
        <div className="flex items-center gap-3 bg-[#f3f5ef] px-5 py-3 text-[0.8rem] leading-relaxed text-[#52685b] sm:px-7">
          <LockKeyhole className="shrink-0 text-[#4c6b56]" size={17} />
          <p>
            <strong className="font-semibold text-[#294535]">Your words stay private.</strong>{" "}
            Your group leader only sees anonymized themes and combined group trends.
          </p>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-6 sm:px-7">
        {lines.map((line, index) => (
          <div
            className={`chat-row ${line.role === "user" ? "chat-row-user" : ""}`}
            key={`${line.role}-${index}`}
          >
            {line.role === "assistant" ? (
              <span className="chat-avatar" aria-hidden="true">
                <Heart size={15} fill="currentColor" />
              </span>
            ) : null}
            <div className={`chat-bubble ${line.role === "user" ? "chat-bubble-user" : ""}`}>
              {line.content}
            </div>
          </div>
        ))}

        {isSending ? (
          <div className="chat-row">
            <span className="chat-avatar" aria-hidden="true">
              <Heart size={15} fill="currentColor" />
            </span>
            <div className="chat-bubble flex items-center gap-2 text-[#718078]">
              <LoaderCircle className="animate-spin" size={15} />
              Taking a moment to listen…
            </div>
          </div>
        ) : null}

        {isAnalyzing ? (
          <div className="flex items-center gap-2 rounded-xl bg-[#f6f3eb] px-4 py-3 text-sm text-[#76694e]">
            <Sparkles className="animate-pulse" size={16} />
            Finding the themes in your check-in…
          </div>
        ) : null}

      </div>

      <div className="border-t border-[#e9e7df] px-5 py-4 sm:px-7">
        <div className="mb-3 flex items-center justify-between text-[0.72rem] text-[#7b8179]">
          <span>
            {finished
              ? "Check-in complete"
              : `Step ${Math.min(userTurns + 1, 3)} of 3 · There is no perfect answer`}
          </span>
          {finished ? (
            <span className="flex items-center gap-1 font-medium text-[#507357]">
              <Check size={14} /> Saved
            </span>
          ) : (
            <span>Shift + Enter for a new line</span>
          )}
        </div>
        <form className="composer" onSubmit={(event) => void sendMessage(event)}>
          <label className="sr-only" htmlFor={`${role}-check-in-input`}>
            Write your check-in response
          </label>
          <textarea
            id={`${role}-check-in-input`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={finished ? "You can start a new check-in any time." : "Share whatever feels true today…"}
            rows={2}
            maxLength={1500}
            disabled={finished || isSending || isAnalyzing}
          />
          <button
            className="send-button"
            type="submit"
            disabled={!draft.trim() || finished || isSending || isAnalyzing}
            aria-label="Send response"
          >
            {isSending || isAnalyzing ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <ArrowUp size={19} />
            )}
          </button>
        </form>
        <p className="mt-2 text-right text-[0.68rem] text-[#9a9d94]">
          {draft.length}/1,500
        </p>
      </div>

      {analysis && domain ? (
        <div className="border-t border-[#e9e7df] bg-[#fbfaf6] px-5 py-6 sm:px-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8eee6] text-[#54715c]">
                <Sparkles size={16} />
              </span>
              <div>
                <p className="text-[0.67rem] font-semibold uppercase tracking-[0.14em] text-[#748174]">
                  Behind the scenes
                </p>
                <h3 className="font-display text-lg text-[#293d32]">
                  Local semantic analysis
                </h3>
              </div>
            </div>
            <span className={`mode-tag ${simulated ? "mode-tag-demo" : "mode-tag-local"}`}>
              {simulated ? "Simulated" : "On-device"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_0.8fr]">
            <div className="rounded-xl border border-[#e9e7df] bg-white p-4">
              <p className="text-[0.7rem] font-medium uppercase tracking-wide text-[#868a80]">
                Strongest theme
              </p>
              <p className="mt-1 font-semibold text-[#30483a]">{domain.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#7a8178]">
                {domain.description}
              </p>
            </div>
            <div className="rounded-xl border border-[#e9e7df] bg-white p-4">
              <div className="flex items-center justify-between text-[0.7rem] font-medium uppercase tracking-wide text-[#868a80]">
                <span>Check-in sentiment</span>
                <span className="normal-case tracking-normal text-[#566b5c]">
                  {analysis.healthSentiment > 0 ? "+" : ""}
                  {analysis.healthSentiment.toFixed(1)}
                </span>
              </div>
              <div className="sentiment-track mt-3">
                <span style={{ left: `${sentimentPercent}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[0.65rem] text-[#9a9d94]">
                <span>Needs care</span>
                <span>Feeling supported</span>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-[#f1f0e9] px-4 py-3">
            <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-wide text-[#7e8178]">
              Anonymized summary
            </p>
            <p className="text-sm leading-relaxed text-[#5b665d]">{summary}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
