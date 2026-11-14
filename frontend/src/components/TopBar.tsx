"use client";

import {
  Activity,
  CircleHelp,
  Compass,
  Heart,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { DemoRole } from "@/lib/types";

type TopBarProps = {
  role: DemoRole;
  status: "checking" | "connected" | "offline";
  onRoleChange: (role: DemoRole) => void;
};

const roles: { id: DemoRole; label: string; caption: string; icon: typeof UserRound }[] = [
  { id: "member", label: "Cell Member", caption: "Group 14 — Kennedy Town", icon: UserRound },
  { id: "leader", label: "Cell Leader", caption: "Group 14 — Kennedy Town", icon: UsersRound },
  { id: "staff", label: "Pastor / Staff", caption: "Oversight · 108 groups", icon: Compass },
];

export function TopBar({ role, status, onRoleChange }: TopBarProps) {
  const badgeLabel =
    status === "connected"
      ? "Local engine connected"
      : status === "checking"
        ? "Checking local engine"
        : "Simulated demo mode";

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="brand-mark" aria-hidden="true">
          <Heart size={20} fill="currentColor" />
          <span />
        </div>
        <div>
          <p className="brand-name">common ground</p>
          <p className="brand-caption">Cell health &amp; belonging</p>
        </div>
      </div>

      <div className="role-switcher" role="group" aria-label="Demo role switcher">
        {roles.map(({ id, label, caption, icon: Icon }) => (
          <button
            aria-pressed={role === id}
            className={`role-option ${role === id ? "role-option-active" : ""}`}
            key={id}
            onClick={() => onRoleChange(id)}
            type="button"
          >
            <Icon size={16} aria-hidden="true" />
            <span className="role-option-copy">
              <span>{label}</span>
              <small>{caption}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="topbar-tools">
        <div
          className={`engine-badge engine-badge-${status}`}
          role="status"
          aria-live="polite"
          title={
            status === "offline"
              ? "The app remains usable with local simulated demo data."
              : "API endpoint: http://localhost:5000"
          }
        >
          <span className="engine-dot">
            {status === "checking" ? <Activity size={11} /> : null}
          </span>
          <span>{badgeLabel}</span>
        </div>
        <button
          className="icon-button help-button"
          type="button"
          aria-label="About this local demo"
          title="Runs locally; no external database is used."
        >
          <CircleHelp size={17} />
        </button>
      </div>
    </header>
  );
}
