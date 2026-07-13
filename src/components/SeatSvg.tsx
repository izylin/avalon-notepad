import { useId } from "react";
import type { IdentityTag, Vote } from "@/lib/game";

const roleVisuals: Record<IdentityTag, { ink: string; glow: string; accent: string; ringOpacity: number; patternScale?: number }> = {
  merlin: { ink: "#2f6ea6", glow: "#d8ebfb", accent: "#78b7e6", ringOpacity: .58 },
  percival: { ink: "#2f7f8e", glow: "#d9f0f2", accent: "#72c7d1", ringOpacity: .58 },
  morgana: { ink: "#9f1218", glow: "#f3b1a8", accent: "#df252b", ringOpacity: .52, patternScale: .68 },
  assassin: { ink: "#b6402d", glow: "#f3c7ba", accent: "#df6547", ringOpacity: .56 },
  mordred: { ink: "#58428f", glow: "#d8d0ee", accent: "#8270c9", ringOpacity: .58 },
  oberon: { ink: "#c46a58", glow: "#f7dfd8", accent: "#e89a86", ringOpacity: .52 }
};

function RolePatternMark({ tag, ink, accent }: { tag: IdentityTag; ink: string; accent: string }) {
  if (tag === "merlin") {
    return (
      <>
        <path d="M21 8l7 9-7 15-7-15z" fill={ink} opacity=".8" />
        <path d="M14 17h14M18 17l3 15 3-15" stroke="#fff8ea" strokeWidth="1.2" opacity=".75" />
        <path d="M31 8l1.2 2.5 2.6 1.2-2.6 1.3-1.2 2.5-1.3-2.5-2.5-1.3 2.5-1.2z" fill={accent} opacity=".95" />
      </>
    );
  }
  if (tag === "percival") {
    return (
      <>
        <path d="M21 8l11 5v8c0 6-4 10-11 12-7-2-11-6-11-12v-8z" fill={ink} opacity=".8" />
        <path d="M21 11v19M13 16h16" stroke="#fff8ea" strokeWidth="1.4" opacity=".75" />
      </>
    );
  }
  if (tag === "morgana") {
    return (
      <>
        <path d="M11 17c4-6 16-6 20 0v8c-4 5-16 5-20 0z" fill={ink} opacity=".78" />
        <path d="M14 21c2-2 5-2 7 0M28 21c-2-2-5-2-7 0M21 24c-1 3-3 5-6 6M21 24c1 3 3 5 6 6" stroke="#fff8ea" strokeWidth="1.2" opacity=".75" />
        <path d="M28 7a7.5 7.5 0 1 0 0 11 9.5 9.5 0 1 1 0-11z" fill={accent} opacity=".9" />
      </>
    );
  }
  if (tag === "assassin") {
    return (
      <>
        <path d="M25 7l7 7-13 16-5 2 2-5z" fill={ink} opacity=".82" />
        <path d="M22 10l10 10M13 31l-3 3M26 13L15 28" stroke="#fff8ea" strokeWidth="1.4" opacity=".78" />
      </>
    );
  }
  if (tag === "mordred") {
    return (
      <>
        <path d="M10 22l4-12 7-4 7 4 4 12-4 9H14z" fill={ink} opacity=".8" />
        <path d="M14 22h14M21 7v24M14 31h14M16 14l5-3 5 3" stroke="#fff8ea" strokeWidth="1.3" opacity=".75" />
        <path d="M14 10l7-5 7 5-2 4-5-3-5 3z" fill={accent} opacity=".92" />
      </>
    );
  }
  return (
    <>
      <path d="M21 34c-7-5-9-12-5-18 5 2 7 6 5 18zM21 34c7-5 9-12 5-18-5 2-7 6-5 18z" fill={ink} opacity=".8" />
      <path d="M21 8v26M15 14c-3.5-.3-5.8-2.3-7-6 4.8 0 8.2 1.8 10.2 5.5M27 14c3.5-.3 5.8-2.3 7-6-4.8 0-8.2 1.8-10.2 5.5" stroke="#fff8ea" strokeWidth="1.4" opacity=".75" />
      <path d="M17 12c2.7-4.5 5.3-4.5 8 0" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function seatPositions(n: number, cx = 172, cy = 150, rx = 98, ry = 76) {
  const positions: Record<number, { x: number; y: number }> = { 1: { x: cx, y: cy + ry + 24 } };
  const others = n - 1;
  for (let i = 0; i < others; i++) {
    const angle = 200 - (220 / (others - 1 || 1)) * i;
    const rad = (angle * Math.PI) / 180;
    positions[2 + i] = { x: cx + rx * Math.cos(rad), y: cy - ry * Math.sin(rad) };
  }
  return positions;
}

export function SeatSvg({
  n,
  leaderSeat,
  teamSeats,
  voteMap = {},
  identityTags = {},
  onSeatClick,
  captionTop,
  captionBottom
}: {
  n: number;
  leaderSeat: number;
  teamSeats: number[];
  voteMap?: Record<number, Vote>;
  identityTags?: Record<number, IdentityTag>;
  onSeatClick?: (seat: number) => void;
  captionTop: string;
  captionBottom: string;
}) {
  const pos = seatPositions(n);
  const svgId = useId().replace(/\W/g, "");
  return (
    <div className="seat-svg-wrap">
      <svg width="100%" viewBox="0 0 344 320" style={{ display: "block", width: "100%" }}>
        <defs>
          {(Object.keys(roleVisuals) as IdentityTag[]).map((tag) => {
            const visual = roleVisuals[tag];
            return (
              <pattern key={tag} id={`${svgId}-symbol-${tag}`} patternUnits="userSpaceOnUse" width="30" height="30">
                <rect width="30" height="30" fill={visual.glow} />
                <g transform={`translate(3 3) scale(${visual.patternScale ?? .58})`}>
                  <RolePatternMark tag={tag} ink={visual.ink} accent={visual.accent} />
                </g>
              </pattern>
            );
          })}
          {Array.from({ length: n }, (_, i) => i + 1).map((seat) => {
            const p = pos[seat];
            const r = seat === 1 ? 26 : 24;
            return (
              <mask key={seat} id={`${svgId}-role-ring-${seat}`}>
                <rect width="344" height="320" fill="black" />
                <circle cx={p.x} cy={p.y} r={r + 11} fill="white" />
                <circle cx={p.x} cy={p.y} r={r + 2} fill="black" />
              </mask>
            );
          })}
        </defs>
        <ellipse cx="172" cy="150" rx="98" ry="76" fill="none" stroke="var(--line-gold)" strokeWidth="1.8" />
        <ellipse cx="172" cy="150" rx="50" ry="38" fill="var(--panel)" stroke="var(--line-gold)" strokeWidth="1.2" />
        <text fontSize="11" x="172" y="146" textAnchor="middle" fill="var(--muted)">{captionTop}</text>
        <text fontSize="11" x="172" y="159" textAnchor="middle" fill="var(--muted)">{captionBottom}</text>
        {Array.from({ length: n }, (_, i) => i + 1).map((seat) => {
          const p = pos[seat];
          const isMe = seat === 1;
          const onTeam = teamSeats.includes(seat);
          const isLeader = seat === leaderSeat;
          const tag = identityTags[seat];
          const vote = voteMap[seat];
          const clickable = Boolean(onSeatClick);
          const r = isMe ? 26 : 24;
          const fill = vote === "agree" ? "var(--blue)" : vote === "reject" ? "var(--red)" : onTeam ? "var(--gold)" : "var(--panel-raised)";
          const stroke = vote ? "var(--gold-bright)" : onTeam ? "var(--gold-bright)" : isMe ? "var(--muted)" : "var(--line)";
          const textFill = vote || onTeam ? "var(--gold-ink)" : "var(--muted)";
          return (
            <g
              key={seat}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              style={clickable ? { cursor: "pointer" } : undefined}
              onClick={clickable ? () => onSeatClick?.(seat) : undefined}
              onKeyDown={clickable ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSeatClick?.(seat);
                }
              } : undefined}
            >
              {tag ? (
                <>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r + 11}
                    fill={`url(#${svgId}-symbol-${tag})`}
                    mask={`url(#${svgId}-role-ring-${seat})`}
                    opacity={roleVisuals[tag].ringOpacity}
                  />
                  <circle cx={p.x} cy={p.y} r={r + 11} fill="none" stroke={roleVisuals[tag].accent} strokeWidth="1.2" opacity=".72" />
                </>
              ) : null}
              {onTeam ? (
                <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={r * 0.45} fill={fill} stroke={stroke} strokeWidth={isMe || vote ? 2.5 : 1.8} />
              ) : (
                <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={stroke} strokeWidth={isMe || vote ? 2.5 : 1.3} />
              )}
              {isLeader ? (
                onTeam ? (
                  <rect x={p.x - r - 8} y={p.y - r - 8} width={(r + 8) * 2} height={(r + 8) * 2} rx={r * 0.45 + 8} fill="none" stroke="var(--gold-bright)" strokeWidth="2" />
                ) : (
                  <circle cx={p.x} cy={p.y} r={r + 8} fill="none" stroke="var(--gold-bright)" strokeWidth="2" />
                )
              ) : null}
              <text fontSize={isMe ? 13 : 15} fontWeight="700" x={p.x} y={p.y + 5} textAnchor="middle" fill={textFill}>{isMe ? "我" : seat}</text>
              {isLeader ? <text fontSize="11" fontWeight="700" x={p.x} y={p.y + r + 19} textAnchor="middle" fill="var(--red)">队长</text> : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
