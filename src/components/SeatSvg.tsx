import { useId, useRef, useState } from "react";
import { seatCanvas, type IdentityTag, type SeatLayout, type SeatPoint, type Vote } from "@/lib/game";

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

function seatRadius(seat: number) {
  return seat === 1 ? 26 : 24;
}

// 座位连同外圈身份光环整体留在画布内，否则拖到边缘会被 viewBox 裁掉。
function clampToCanvas(point: SeatPoint, seat: number): SeatPoint {
  const margin = seatRadius(seat) + 11;
  return {
    x: Math.min(Math.max(point.x, margin), seatCanvas.width - margin),
    y: Math.min(Math.max(point.y, margin), seatCanvas.height - margin)
  };
}

export function SeatSvg({
  n,
  leaderSeat,
  teamSeats,
  voteMap = {},
  identityTags = {},
  onSeatClick,
  captionTop,
  captionBottom,
  seatLayout,
  editing = false,
  onSeatMove
}: {
  n: number;
  leaderSeat: number;
  teamSeats: number[];
  voteMap?: Record<number, Vote>;
  identityTags?: Record<number, IdentityTag>;
  onSeatClick?: (seat: number) => void;
  captionTop: string;
  captionBottom: string;
  seatLayout?: SeatLayout;
  editing?: boolean;
  onSeatMove?: (seat: number, point: SeatPoint) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ seat: number; point: SeatPoint } | null>(null);
  const pos = { ...seatPositions(n), ...seatLayout };
  if (drag) pos[drag.seat] = drag.point;
  const hasCustomLayout = Object.keys(seatLayout ?? {}).length > 0;
  const svgId = useId().replace(/\W/g, "");

  function toSvgPoint(event: React.PointerEvent): SeatPoint | null {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  }

  return (
    <div className="seat-svg-wrap">
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${seatCanvas.width} ${seatCanvas.height}`}
        className={editing ? "seat-svg seat-svg-editing" : "seat-svg"}
        style={{ display: "block", width: "100%" }}
      >
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
            const r = seatRadius(seat);
            return (
              <mask key={seat} id={`${svgId}-role-ring-${seat}`}>
                <rect width={seatCanvas.width} height={seatCanvas.height} fill="black" />
                <circle cx={p.x} cy={p.y} r={r + 11} fill="white" />
                <circle cx={p.x} cy={p.y} r={r + 2} fill="black" />
              </mask>
            );
          })}
        </defs>
        {/* 默认圆桌轮廓正好穿过默认座位；自定义排布后它不再贴合，反而误导。 */}
        {hasCustomLayout ? null : (
          <ellipse cx="172" cy="150" rx="98" ry="76" fill="none" stroke="var(--line-gold)" strokeWidth="1.8" />
        )}
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
          // 编辑座位图时不接受点击，否则拖动会顺带改掉上车名单或投票。
          const clickable = Boolean(onSeatClick) && !editing;
          const r = seatRadius(seat);
          const fill = vote === "agree" ? "var(--blue)" : vote === "reject" ? "var(--red)" : onTeam ? "var(--gold)" : "var(--panel-raised)";
          const stroke = vote ? "var(--gold-bright)" : onTeam ? "var(--gold-bright)" : isMe ? "var(--muted)" : "var(--line)";
          const textFill = vote || onTeam ? "var(--gold-ink)" : "var(--muted)";
          return (
            <g
              key={seat}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              style={editing ? { cursor: drag?.seat === seat ? "grabbing" : "grab" } : clickable ? { cursor: "pointer" } : undefined}
              onClick={clickable ? () => onSeatClick?.(seat) : undefined}
              onKeyDown={clickable ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSeatClick?.(seat);
                }
              } : undefined}
              onPointerDown={editing ? (event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                const point = toSvgPoint(event);
                if (point) setDrag({ seat, point: clampToCanvas(point, seat) });
              } : undefined}
              onPointerMove={editing && drag?.seat === seat ? (event) => {
                const point = toSvgPoint(event);
                if (point) setDrag({ seat, point: clampToCanvas(point, seat) });
              } : undefined}
              onPointerUp={editing && drag?.seat === seat ? (event) => {
                event.currentTarget.releasePointerCapture(event.pointerId);
                onSeatMove?.(seat, drag.point);
                setDrag(null);
              } : undefined}
              onPointerCancel={editing && drag?.seat === seat ? () => setDrag(null) : undefined}
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
