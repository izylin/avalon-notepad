"use client";

import { useState } from "react";
import { missionLogsFor, type GameState, type Vote } from "@/lib/game";
import { VoteResultGraphic } from "./VoteResultGraphic";

function seatLabel(seat: number) {
  return seat === 1 ? "我" : `${seat}号`;
}

export function LaunchHistory({
  state,
  missionIndex,
  onEditLaunch
}: {
  state: GameState;
  missionIndex: number;
  onEditLaunch?: (missionIndex: number, round: number, team: number[], votes: Record<number, Vote>) => void;
}) {
  const logs = missionLogsFor(state, missionIndex);
  const [editingRound, setEditingRound] = useState<number | null>(null);
  const [draftTeam, setDraftTeam] = useState<number[]>([]);
  const [draftVotes, setDraftVotes] = useState<Record<number, Vote>>({});

  if (!logs.length) return null;
  const seats = Array.from({ length: state.playerCount }, (_, index) => index + 1);

  function beginEdit(log: (typeof logs)[number]) {
    setEditingRound(log.round);
    setDraftTeam([...log.team]);
    setDraftVotes({ ...log.votes });
  }

  function toggleTeam(seat: number, size: number) {
    setDraftTeam((current) => {
      if (current.includes(seat)) return current.filter((item) => item !== seat);
      if (current.length >= size) return current;
      return [...current, seat].sort((a, b) => a - b);
    });
  }

  function toggleVote(seat: number) {
    setDraftVotes((current) => ({ ...current, [seat]: current[seat] === "agree" ? "reject" : "agree" }));
  }

  return (
    <>
      <div className="section-title"><h3>本局发车记录</h3></div>
      {logs.slice().reverse().map((log, index) => {
        const editing = editingRound === log.round;
        const agree = Object.values(draftVotes).filter((vote) => vote === "agree").length;
        const reject = Object.values(draftVotes).filter((vote) => vote === "reject").length;
        const completeVotes = Object.keys(draftVotes).length === state.playerCount;
        const editedPassed = agree > reject;
        const sameOutcome = editedPassed === log.passed;
        const canSave = draftTeam.length === log.team.length && completeVotes && sameOutcome;
        return (
          <div className="launch-card" key={`${log.missionNo}-${log.round}-${index}`}>
            <div className="launch-head">
              <div>
                <h4>{log.resultOnly ? "快速记录" : `第 ${log.round} 次组队 · ${seatLabel(log.leaderSeat)}队长`}</h4>
                <p>{log.resultOnly ? "未记录组队与投票详情" : `队伍：${log.team.map(seatLabel).join(", ")}`}</p>
              </div>
              <div className="launch-head-actions">
                <span className={`tag ${log.missionResult === "good" ? "blue" : log.missionResult === "bad" || !log.passed ? "bad" : ""}`}>{log.missionResult === "good" ? "好人任务成功" : log.missionResult === "bad" ? "坏人任务成功" : log.passed ? "已通过表决" : "未通过"}</span>
                {!log.resultOnly && onEditLaunch && (
                  <button className="launch-edit-btn" type="button" onClick={() => editing ? setEditingRound(null) : beginEdit(log)}>{editing ? "收起" : "编辑"}</button>
                )}
              </div>
            </div>
            {!log.resultOnly && <VoteResultGraphic votes={log.votes} playerCount={state.playerCount} passed={log.passed} />}
            {editing && (
              <div className="launch-edit-panel">
                <div className="launch-edit-section">
                  <strong>修改上车玩家</strong>
                  <span>保持本次上车人数为 {log.team.length} 人</span>
                  <div className="launch-edit-grid">
                    {seats.map((seat) => <button key={seat} type="button" className={draftTeam.includes(seat) ? "selected" : ""} onClick={() => toggleTeam(seat, log.team.length)}>{seatLabel(seat)}</button>)}
                  </div>
                </div>
                <div className="launch-edit-section">
                  <strong>修改投票</strong>
                  <span>赞成 {agree} · 反对 {reject}</span>
                  <div className="launch-edit-grid">
                    {seats.map((seat) => <button key={seat} type="button" className={draftVotes[seat] === "agree" ? "agree" : "reject"} onClick={() => toggleVote(seat)}>{seatLabel(seat)} · {draftVotes[seat] === "agree" ? "赞成" : "反对"}</button>)}
                  </div>
                </div>
                {!sameOutcome && <p className="launch-edit-warning">修改后的投票结果必须仍然是“{log.passed ? "通过" : "未通过"}”，这样不会改变当前任务进度。</p>}
                <div className="launch-edit-save">
                  <button className="ghost-btn" type="button" onClick={() => setEditingRound(null)}>取消</button>
                  <button className="primary-btn" type="button" disabled={!canSave} onClick={() => { onEditLaunch?.(missionIndex, log.round, draftTeam, draftVotes); setEditingRound(null); }}>保存修改</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
