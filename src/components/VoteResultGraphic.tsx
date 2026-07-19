import type { Vote } from "@/lib/game";

function seatLabel(seat: number) {
  return seat === 1 ? "我" : `${seat}号`;
}

function voteLabel(vote?: Vote) {
  if (vote === "agree") return "赞成";
  if (vote === "reject") return "反对";
  return "未记录";
}

export function VoteResultGraphic({
  votes,
  playerCount,
  passed
}: {
  votes: Record<number, Vote>;
  playerCount: number;
  passed: boolean;
}) {
  const seats = Array.from({ length: playerCount }, (_, index) => index + 1);
  const agreeSeats = seats.filter((seat) => votes[seat] === "agree");
  const rejectSeats = seats.filter((seat) => votes[seat] === "reject");
  const missingSeats = seats.filter((seat) => votes[seat] !== "agree" && votes[seat] !== "reject");
  const isComplete = missingSeats.length === 0;
  const isTie = isComplete && agreeSeats.length === rejectSeats.length;
  const calculatedPassed = agreeSeats.length > rejectSeats.length;
  const hasResultConflict = isComplete && calculatedPassed !== passed;

  const agreePercent = playerCount ? (agreeSeats.length / playerCount) * 100 : 0;
  const rejectPercent = playerCount ? (rejectSeats.length / playerCount) * 100 : 0;
  const missingPercent = playerCount ? (missingSeats.length / playerCount) * 100 : 0;

  let decisionText = passed ? "组队通过" : "组队未通过";
  let decisionClass = passed ? "passed" : "rejected";
  let decisionIcon = passed ? "✓" : "×";

  if (!isComplete) {
    decisionText = "记录不完整";
    decisionClass = "incomplete";
    decisionIcon = "!";
  } else if (hasResultConflict) {
    decisionText = "记录与结果不一致";
    decisionClass = "incomplete";
    decisionIcon = "!";
  } else if (isTie) {
    decisionText = "平票，组队未通过";
    decisionClass = "tied";
    decisionIcon = "=";
  }

  const ariaSummary = [
    `赞成 ${agreeSeats.length} 票`,
    `反对 ${rejectSeats.length} 票`,
    missingSeats.length ? `未记录或弃票 ${missingSeats.length} 票` : "全部票已记录",
    decisionText
  ].join("，");

  return (
    <div className="vote-graphic" aria-label={`投票结果：${ariaSummary}`}>
      <div className="vote-summary-row">
        <div className="vote-total vote-total-agree"><span>赞成</span><strong>{agreeSeats.length}</strong></div>
        <div className={`vote-decision ${decisionClass}`}>
          <span aria-hidden="true">{decisionIcon}</span>
          <strong>{decisionText}</strong>
        </div>
        <div className="vote-total vote-total-reject"><span>反对</span><strong>{rejectSeats.length}</strong></div>
      </div>

      <div className="vote-balance" role="img" aria-label={`赞成 ${Math.round(agreePercent)}%，反对 ${Math.round(rejectPercent)}%，未记录或弃票 ${Math.round(missingPercent)}%`}>
        {agreePercent > 0 && <span className="vote-balance-agree" style={{ width: `${agreePercent}%` }} />}
        {rejectPercent > 0 && <span className="vote-balance-reject" style={{ width: `${rejectPercent}%` }} />}
        {missingPercent > 0 && <span className="vote-balance-missing" style={{ width: `${missingPercent}%` }} />}
      </div>

      <div className="vote-seat-grid" role="list" aria-label="逐座位投票记录">
        {seats.map((seat) => {
          const vote = votes[seat];
          const statusClass = vote === "agree" ? "agree" : vote === "reject" ? "reject" : "missing";
          return (
            <div className={`vote-seat-card ${statusClass}`} key={seat} role="listitem">
              <span className="vote-seat-name">{seatLabel(seat)}</span>
              <strong>{voteLabel(vote)}</strong>
            </div>
          );
        })}
      </div>

      <p className={`vote-boundary-note ${missingSeats.length || hasResultConflict ? "warning" : ""}`}>
        {missingSeats.length > 0
          ? `未记录／弃票：${missingSeats.map(seatLabel).join("、")}。这些座位未被自动计入反对票。`
          : hasResultConflict
          ? "票数计算结果与原始对局记录中的通过状态不一致，请以原始记录为准并检查数据。"
          : isTie
          ? "赞成票未超过反对票；平票按组队未通过处理。"
          : "已记录全部玩家投票，结果与原始投票记录一致。"}
      </p>
    </div>
  );
}
