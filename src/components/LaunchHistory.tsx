import { missionLogsFor, type GameState } from "@/lib/game";
import { VoteResultGraphic } from "./VoteResultGraphic";

export function LaunchHistory({ state, missionIndex }: { state: GameState; missionIndex: number }) {
  const logs = missionLogsFor(state, missionIndex);
  if (!logs.length) return null;
  return (
    <>
      <div className="section-title"><h3>本局发车记录</h3></div>
      {logs.slice().reverse().map((log, index) => (
        <div className="launch-card" key={`${log.missionNo}-${log.round}-${index}`}>
          <div className="launch-head">
            <div>
              <h4>{log.resultOnly ? "快速记录" : `第 ${log.round} 次组队 · ${log.leaderSeat === 1 ? "我" : `${log.leaderSeat}号`}队长`}</h4>
              <p>{log.resultOnly ? "未记录组队与投票详情" : `队伍：${log.team.map((s) => s === 1 ? "我" : `${s}号`).join(", ")}`}</p>
            </div>
            <span className={`tag ${log.missionResult === "good" ? "blue" : log.missionResult === "bad" || !log.passed ? "bad" : ""}`}>{log.missionResult === "good" ? "好人任务成功" : log.missionResult === "bad" ? "坏人任务成功" : log.passed ? "已通过表决" : "未通过"}</span>
          </div>
          {!log.resultOnly && <VoteResultGraphic votes={log.votes} playerCount={state.playerCount} passed={log.passed} />}
        </div>
      ))}
    </>
  );
}
