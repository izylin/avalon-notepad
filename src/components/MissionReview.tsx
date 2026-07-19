import { effectiveIdentityTags, missionCardClass, missionLogsFor, type GameState } from "@/lib/game";
import { SeatSvg } from "./SeatSvg";
import { VoteResultGraphic } from "./VoteResultGraphic";

export function MissionReview({ state, missionIndex }: { state: GameState; missionIndex: number }) {
  const logs = missionLogsFor(state, missionIndex);
  const finalLog = logs.slice().reverse().find((log) => log.missionResult) ?? logs.at(-1);
  const result = state.missionResults[missionIndex];
  const leaderText = finalLog ? finalLog.leaderSeat === 1 ? "我" : `${finalLog.leaderSeat}号` : "";
  const failText = finalLog?.missionResult ? `失败票 ${finalLog.fails} 张，成功票 ${Math.max(0, finalLog.team.length - finalLog.fails)} 张` : "暂无任务结算记录";

  return (
    <div className={missionCardClass(result)}>
      <h4>最终结果</h4>
      <p>{result === "good" ? "好人任务成功" : result === "bad" ? "坏人任务成功" : "尚未发车"}{finalLog ? ` · 第 ${finalLog.round} 次组队通过 · ${leaderText}队长` : ""}</p>
      {finalLog ? (
        <>
          <SeatSvg
            n={state.playerCount}
            leaderSeat={finalLog.leaderSeat}
            teamSeats={finalLog.team}
            voteMap={finalLog.votes}
            identityTags={effectiveIdentityTags(state, missionIndex)}
            captionTop={`队长 ${leaderText}`}
            captionBottom={`上车 ${finalLog.team.map((s) => s === 1 ? "我" : s).join(",")}`}
          />
          <VoteResultGraphic votes={finalLog.votes} playerCount={state.playerCount} passed={finalLog.passed} />
          <div className="mission-table">
            <div className="mission-table-row"><span>队伍</span><strong>{finalLog.team.map((s) => s === 1 ? "我" : `${s}号`).join("、")}</strong></div>
            <div className="mission-table-row"><span>任务牌</span><strong>{failText}</strong></div>
          </div>
        </>
      ) : null}
    </div>
  );
}
