"use client";

import { useState } from "react";
import { effectiveIdentityTags, missionCardClass, missionLogsFor, type GameState, type Vote } from "@/lib/game";
import { SeatSvg } from "./SeatSvg";
import { VoteResultGraphic } from "./VoteResultGraphic";

function seatLabel(seat: number) {
  return seat === 1 ? "我" : `${seat}号`;
}

function voteLabel(vote?: Vote) {
  if (vote === "agree") return "赞成";
  if (vote === "reject") return "反对";
  return "未记录";
}

export function MissionReview({
  state,
  missionIndex,
  onChangeRecord
}: {
  state: GameState;
  missionIndex: number;
  onChangeRecord?: (missionIndex: number, result: "good" | "bad", votes?: Record<number, Vote>) => void;
}) {
  const [editingMission, setEditingMission] = useState<number | null>(null);
  const [draftResult, setDraftResult] = useState<"good" | "bad">("good");
  const [draftVotes, setDraftVotes] = useState<Record<number, Vote>>({});
  const editing = editingMission === missionIndex;
  const logs = missionLogsFor(state, missionIndex);
  const finalLog = logs.slice().reverse().find((log) => log.missionResult) ?? logs.at(-1);
  const result = state.missionResults[missionIndex];
  const leaderText = finalLog ? finalLog.leaderSeat === 1 ? "我" : `${finalLog.leaderSeat}号` : "";
  const failText = finalLog?.missionResult ? `失败票 ${finalLog.fails} 张，成功票 ${Math.max(0, finalLog.team.length - finalLog.fails)} 张` : "暂无任务结算记录";
  const canEdit = Boolean(result && onChangeRecord);
  const canEditVotes = Boolean(finalLog && !finalLog.resultOnly);
  const seats = Array.from({ length: state.playerCount }, (_, index) => index + 1);
  const agreeCount = seats.filter((seat) => draftVotes[seat] === "agree").length;
  const rejectCount = seats.filter((seat) => draftVotes[seat] === "reject").length;
  const missingCount = state.playerCount - agreeCount - rejectCount;
  const editedVotePassed = agreeCount > rejectCount;
  const canSave = !canEditVotes || (missingCount === 0 && editedVotePassed);

  function toggleEditor() {
    if (editing) {
      setEditingMission(null);
      return;
    }
    setDraftResult(result === "bad" ? "bad" : "good");
    setDraftVotes(finalLog ? { ...finalLog.votes } : {});
    setEditingMission(missionIndex);
  }

  function toggleDraftVote(seat: number) {
    setDraftVotes((current) => ({
      ...current,
      [seat]: current[seat] === "agree" ? "reject" : "agree"
    }));
  }

  return (
    <div className={missionCardClass(result)}>
      <div className="mission-review-head">
        <div>
          <h4>最终结果</h4>
          <p>
            {result === "good" ? "好人任务成功" : result === "bad" ? "坏人任务成功" : "尚未发车"}
            {finalLog && !finalLog.resultOnly ? ` · 第 ${finalLog.round} 次组队通过 · ${leaderText}队长` : ""}
          </p>
        </div>
        {canEdit && (
          <button className="ghost-btn mission-edit-btn" type="button" onClick={toggleEditor}>
            {editing ? "收起编辑" : "编辑记录"}
          </button>
        )}
      </div>

      {editing && result && onChangeRecord && (
        <div className="mission-edit-panel">
          <div>
            <strong>修改任务结果与投票</strong>
            <span>
              {canEditVotes
                ? "点击玩家可切换赞成或反对；保存后会回到当前正在进行的任务。"
                : "本轮使用了快速记录，没有保存投票人员，因此只能修改任务结果。"}
            </span>
          </div>

          <div className="mission-edit-actions" aria-label="修改任务结果">
            <button
              type="button"
              className={draftResult === "good" ? "primary-btn" : "ghost-btn"}
              onClick={() => setDraftResult("good")}
            >
              任务成功
            </button>
            <button
              type="button"
              className={draftResult === "bad" ? "primary-btn danger-primary" : "ghost-btn"}
              onClick={() => setDraftResult("bad")}
            >
              任务失败
            </button>
          </div>

          {canEditVotes && (
            <div className="mission-vote-editor">
              <div className="mission-vote-editor-head">
                <strong>修改组队投票</strong>
                <span>赞成 {agreeCount} · 反对 {rejectCount}</span>
              </div>
              <div className="mission-vote-edit-grid" role="group" aria-label="逐位修改组队投票">
                {seats.map((seat) => {
                  const vote = draftVotes[seat];
                  const statusClass = vote === "agree" ? "agree" : vote === "reject" ? "reject" : "missing";
                  return (
                    <button
                      key={seat}
                      type="button"
                      className={`mission-vote-edit-card ${statusClass}`}
                      onClick={() => toggleDraftVote(seat)}
                      aria-label={`${seatLabel(seat)}当前${voteLabel(vote)}，点击切换`}
                    >
                      <span>{seatLabel(seat)}</span>
                      <strong>{voteLabel(vote)}</strong>
                    </button>
                  );
                })}
              </div>
              {!canSave && (
                <p className="mission-edit-warning">
                  {missingCount > 0
                    ? `还有 ${missingCount} 位玩家未记录投票。`
                    : "最终执行任务的组队必须获得超过半数赞成票，请继续调整。"}
                </p>
              )}
            </div>
          )}

          <div className="mission-edit-save-actions">
            <button className="ghost-btn" type="button" onClick={() => setEditingMission(null)}>取消</button>
            <button
              className="primary-btn"
              type="button"
              disabled={!canSave}
              onClick={() => {
                onChangeRecord(missionIndex, draftResult, canEditVotes ? draftVotes : undefined);
                setEditingMission(null);
              }}
            >
              保存修改
            </button>
          </div>
        </div>
      )}

      {finalLog?.resultOnly ? (
        <div className="result-only-review">
          <strong>本轮为快速记录</strong>
          <span>已跳过组队、投票和任务牌数量，只保存任务成功或失败。</span>
        </div>
      ) : finalLog ? (
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
