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
        <ellipse cx="155" cy="118" rx="82" ry="62" fill="none" stroke="rgba(201,164,92,.38)" strokeWidth="1.8" />
        <ellipse cx="155" cy="118" rx="42" ry="32" fill="#1a2230" stroke="rgba(201,164,92,.3)" strokeWidth="1.2" />
        <text fontSize="10" x="155" y="114" textAnchor="middle" fill="#98a1ad">{captionTop}</text>
        <text fontSize="10" x="155" y="127" textAnchor="middle" fill="#98a1ad">{captionBottom}</text>
        {Array.from({ length: n }, (_, i) => i + 1).map((seat) => {
          const p = pos[seat];
          const isMe = seat === 1;
          const onTeam = teamSeats.includes(seat);
          const isLeader = seat === leaderSeat;
          const tag = identityTags[seat];
          const r = isMe ? 22 : 20;
          return (
            <g key={seat}>
              <circle cx={p.x} cy={p.y} r={r} fill={onTeam ? "#c9a45c" : "#202a3a"} stroke={onTeam ? "#e2c284" : isMe ? "#98a1ad" : "#3a4557"} strokeWidth={isMe || onTeam ? 2.5 : 1.3} />
              {isLeader ? <circle cx={p.x} cy={p.y} r={r + 3.5} fill="none" stroke="#e2c284" strokeWidth="2" /> : null}
              <text fontSize={isMe ? 11 : 13} fontWeight="700" x={p.x} y={p.y + 5} textAnchor="middle" fill={onTeam ? "#251b09" : "#b9c1cb"}>{isMe ? "我" : seat}</text>
              {tag ? (
                <>
                  <circle cx={p.x + r - 1} cy={p.y - r + 1} r="10" fill="#1a2230" stroke="rgba(201,164,92,.4)" strokeWidth="1" />
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
