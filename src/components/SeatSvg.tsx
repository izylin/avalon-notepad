import type { IdentityTag, Vote } from "@/lib/game";

function seatPositions(n: number, cx = 155, cy = 118, rx = 82, ry = 62) {
  const positions: Record<number, { x: number; y: number }> = { 1: { x: cx, y: cy + ry + 20 } };
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
  identityTags = {},
  captionTop,
  captionBottom
}: {
  n: number;
  leaderSeat: number;
  teamSeats: number[];
  voteMap?: Record<number, Vote>;
  identityTags?: Record<number, IdentityTag>;
  captionTop: string;
  captionBottom: string;
}) {
  const pos = seatPositions(n);
  return (
    <div className="seat-svg-wrap">
      <svg width="100%" viewBox="0 0 310 250" style={{ display: "block", width: "100%" }}>
        <ellipse cx="155" cy="118" rx="82" ry="62" fill="none" stroke="#b8c4cc" strokeWidth="1.8" />
        <ellipse cx="155" cy="118" rx="42" ry="32" fill="#f0f2f1" stroke="#b8c4cc" strokeWidth="1.2" />
        <text fontSize="10" x="155" y="114" textAnchor="middle" fill="#64727f">{captionTop}</text>
        <text fontSize="10" x="155" y="127" textAnchor="middle" fill="#64727f">{captionBottom}</text>
        {Array.from({ length: n }, (_, i) => i + 1).map((seat) => {
          const p = pos[seat];
          const isMe = seat === 1;
          const onTeam = teamSeats.includes(seat);
          const isLeader = seat === leaderSeat;
          const tag = identityTags[seat];
          const r = isMe ? 22 : 20;
          return (
            <g key={seat}>
              <circle cx={p.x} cy={p.y} r={r} fill={onTeam ? "#182026" : "#eef0ef"} stroke={isMe || onTeam ? "#0f1519" : "#c4cdd4"} strokeWidth={isMe || onTeam ? 2.5 : 1.3} />
              {isLeader ? <circle cx={p.x} cy={p.y} r={r + 3.5} fill="none" stroke="#b1812f" strokeWidth="2" /> : null}
              <text fontSize={isMe ? 11 : 13} fontWeight="700" x={p.x} y={p.y + 5} textAnchor="middle" fill={onTeam ? "#fff" : "#64727f"}>{isMe ? "我" : seat}</text>
              {tag ? (
                <>
                  <circle cx={p.x + r - 1} cy={p.y - r + 1} r="10" fill="#fff" stroke="#dce3e8" strokeWidth="1" />
                  <text fontSize="13" x={p.x + r - 1} y={p.y - r + 6} textAnchor="middle">{tag === "percival" ? "🛡️" : ""}</text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
