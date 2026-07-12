import type { IdentityTag, Vote } from "@/lib/game";

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
  return (
    <div className="seat-svg-wrap">
      <svg width="100%" viewBox="0 0 344 320" style={{ display: "block", width: "100%" }}>
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
              {tag ? (
                <>
                  <circle cx={p.x + r - 1} cy={p.y - r + 1} r="11" fill="var(--panel)" stroke="var(--line-gold)" strokeWidth="1" />
                  <text fontSize="14" x={p.x + r - 1} y={p.y - r + 6} textAnchor="middle">{tag === "percival" ? "🛡️" : ""}</text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
