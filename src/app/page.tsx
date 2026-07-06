"use client";

import { useMemo, useState } from "react";
import { IdentityTagsPanel } from "@/components/IdentityTagsPanel";
import { LaunchHistory } from "@/components/LaunchHistory";
import { MissionPager } from "@/components/MissionPager";
import { MissionReview } from "@/components/MissionReview";
import { PageMenu } from "@/components/PageMenu";
import { RuleList, RulesScreen } from "@/components/RulesScreen";
import { SeatSvg } from "@/components/SeatSvg";
import {
  allAgreeVotes,
  completeMissionLaunch,
  defaultConfig,
  effectiveIdentityTags,
  failsNeeded,
  finalizeMission,
  freshState,
  isSavedGameState,
  logLaunch,
  missionCardClass,
  missionSizeTable,
  normalizeState,
  playerCounts,
  resolveAssassination,
  roleKeys,
  roles,
  storageKey,
  togglesFor,
  type GameState,
  type IdentityTag,
  type MissionResult,
  type RoleKey,
  type Screen
} from "@/lib/game";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [setupCount, setSetupCount] = useState(8);
  const [setupRoles, setSetupRoles] = useState<Record<RoleKey, boolean>>(togglesFor(8));
  const [setupLeader, setSetupLeader] = useState(1);
  const [state, setState] = useState<GameState | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [viewMissionIndex, setViewMissionIndex] = useState<number | null>(null);

  const filler = useMemo(() => {
    const cfg = defaultConfig[setupCount];
    const redSpecialsOn = roleKeys.filter((key) => roles[key].side === "red" && setupRoles[key]).length;
    const blueSpecialsOn = roleKeys.filter((key) => roles[key].side === "blue" && setupRoles[key]).length;
    return {
      redSpecialsOn,
      minionCount: cfg.red - redSpecialsOn,
      loyalCount: cfg.blue - blueSpecialsOn,
      ok: redSpecialsOn <= cfg.red && cfg.blue >= blueSpecialsOn
    };
  }, [setupCount, setupRoles]);

  function goTo(next: Screen) {
    setShowSave(false);
    setShowMenu(false);
    setScreen(next);
  }

  function startNewGame() {
    setSetupCount(8);
    setSetupRoles(togglesFor(8));
    setSetupLeader(1);
    setViewMissionIndex(null);
    goTo("setup");
  }

  function changeSetupCount(nextCount: number) {
    setSetupCount(nextCount);
    setSetupRoles(togglesFor(nextCount));
    setSetupLeader((leader) => Math.min(leader, nextCount));
  }

  function continueGame() {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      alert("暂无存档，先新开一局吧");
      return;
    }
    let saved: GameState;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isSavedGameState(parsed)) throw new Error("invalid save");
      saved = parsed;
    } catch {
      localStorage.removeItem(storageKey);
      alert("存档数据已损坏，已清除，请新开一局");
      return;
    }
    setState(normalizeState(saved));
    setViewMissionIndex(null);
    goTo("record");
  }

  function saveToStorage(nextState = state) {
    if (nextState) localStorage.setItem(storageKey, JSON.stringify(nextState));
  }

  function discardSaveAndReturnHome() {
    localStorage.removeItem(storageKey);
    setState(null);
    setViewMissionIndex(null);
    goTo("home");
  }

  function updateState(updater: (current: GameState) => GameState) {
    setState((current) => {
      if (!current) return current;
      const next = updater(current);
      saveToStorage(next);
      return next;
    });
  }

  function toggleIdentityTag(seat: number, tag: IdentityTag) {
    updateState((cur) => {
      const missionIndex = cur.currentMission;
      const identityTagEvents = [...(cur.identityTagEvents ?? [])];
      const activeIndex = identityTagEvents.findLastIndex((event) => (
        event.seat === seat &&
        event.tag === tag &&
        event.startMission <= missionIndex &&
        (event.endMission === undefined || missionIndex < event.endMission)
      ));

      if (activeIndex >= 0) {
        identityTagEvents[activeIndex] = { ...identityTagEvents[activeIndex], endMission: missionIndex };
      } else {
        identityTagEvents.push({ seat, tag, startMission: missionIndex });
      }

      return { ...cur, identityTagEvents };
    });
  }

  function beginGame() {
    if (!filler.ok) return;
    const next = freshState(setupCount, setupRoles, setupLeader);
    setState(next);
    setViewMissionIndex(null);
    saveToStorage(next);
    goTo("record");
  }

  function demoStateFor(nextScreen: Screen) {
    const base = state ?? freshState(8, togglesFor(8), 1);
    if (nextScreen === "assassinate") {
      return {
        ...base,
        currentMission: 2,
        missionResults: ["good", "good", "good", null, null] as MissionResult[],
        awaitingAssassination: true
      };
    }
    if (nextScreen !== "result") return base;

    return {
      ...base,
      currentMission: 4,
      missionResults: ["good", "bad", "good", "bad", "good"] as MissionResult[],
      finished: true,
      winner: "blue" as const
    };
  }

  function jumpToDemoScreen(nextScreen: Screen) {
    if (["record", "notes", "result", "assassinate"].includes(nextScreen)) {
      const next = demoStateFor(nextScreen);
      setState(next);
      setViewMissionIndex(null);
      saveToStorage(next);
    }
    goTo(nextScreen);
  }

  const currentSize = state ? state.missionSizes[state.currentMission] : 0;
  const leaderSeat = state ? state.leaderIndex + 1 : 1;
  const activeScreen = state?.awaitingAssassination && screen === "record"
    ? "assassinate"
    : state?.finished && screen === "record"
    ? "result"
    : screen;
  const displayedMissionIndex = state ? Math.min(viewMissionIndex ?? state.currentMission, state.missionResults.length - 1) : 0;
  const isLiveMissionView = state ? displayedMissionIndex === state.currentMission && !state.finished : false;
  const displayedIdentityTags = state ? effectiveIdentityTags(state, displayedMissionIndex) : {};

  return (
    <main className="page-wrap">
      <div>
        <div className="phone-shell">
          <div className="phone-notch" />
          <div className="phone-screen">
            {activeScreen === "home" && (
              <section className="screen">
                <nav className="app-nav">
                  <div className="brand"><span className="brand-mark">A</span><span>Avalon Note</span></div>
                  <button className="icon-btn" aria-label="菜单" onClick={() => setShowMenu(true)}>☰</button>
                </nav>
                <div className="hero">
                  <h3>阿瓦隆现场笔记</h3>
                  <p>记录上车、投票、任务结果，全部数据只保存在本机。</p>
                  <div className="hero-actions">
                    <button className="primary-btn" onClick={startNewGame}>新开一局</button>
                    <button className="ghost-btn" onClick={continueGame}>从存档继续</button>
                  </div>
                </div>
                <div className="section-title"><h3>规则介绍</h3><button className="ghost-btn" onClick={() => goTo("rules")}>查看全部</button></div>
                <RuleList short />
              </section>
            )}

            {activeScreen === "setup" && (
              <section className="screen">
                <nav className="app-nav">
                  <button className="icon-btn" onClick={() => goTo("home")}>‹</button>
                  <div className="brand">新开一局</div>
                  <span style={{ width: 36 }} />
                </nav>
                <div className="section-title"><h3>玩家人数</h3><span className="tag blue">{setupCount} 人局</span></div>
                <div className="segmented" style={{ gridTemplateColumns: "repeat(6,1fr)" }}>
                  {playerCounts.map((n) => <button key={n} className={`segment ${n === setupCount ? "selected" : ""}`} onClick={() => changeSetupCount(n)}>{n}</button>)}
                </div>
                <div className="section-title"><h3>本局角色</h3><span className="tag">红方特殊 {filler.redSpecialsOn}/{defaultConfig[setupCount].red}</span></div>
                <div className="role-grid">
                  {roleKeys.map((key) => (
                    <button key={key} className="role-chip" onClick={() => setSetupRoles((cur) => ({ ...cur, [key]: !cur[key] }))}>
                      <div><strong>{roles[key].name}</strong><span className="sub">{roles[key].sub}</span></div>
                      <span className={`toggle ${setupRoles[key] ? "on" : ""}`} />
                    </button>
                  ))}
                </div>
                <p className="warn-text">
                  {filler.ok ? <>自动补齐：<strong>{filler.loyalCount}</strong> 名忠臣（蓝方）、<strong>{filler.minionCount}</strong> 名爪牙（红方），共 {setupCount} 人。</> : `${setupCount}人局红方特殊角色不能超过 ${defaultConfig[setupCount].red} 个。`}
                </p>
                <div className="section-title"><h3>任务人数配置</h3><span className="tag">按官方标准</span></div>
                <div className="mission-table">
                  {missionSizeTable[setupCount].map((size, i) => <div className="mission-table-row" key={i}><span>任务 {i + 1}</span><strong>{size} 人{failsNeeded(setupCount, i) === 2 ? "（需2张失败票）" : ""}</strong></div>)}
                </div>
                <div className="section-title"><h3>首轮队长</h3><span className="tag">谁先发车</span></div>
                <div className="segmented" style={{ gridTemplateColumns: `repeat(${Math.min(setupCount, 6)},1fr)` }}>
                  {Array.from({ length: setupCount }, (_, i) => i + 1).map((seat) => <button key={seat} className={`segment ${seat === setupLeader ? "selected" : ""}`} onClick={() => setSetupLeader(seat)}>{seat === 1 ? "我" : `${seat}号`}</button>)}
                </div>
                <button className="primary-btn" style={{ width: "100%", marginTop: 18 }} disabled={!filler.ok} onClick={beginGame}>生成座位 · 进入对局</button>
              </section>
            )}

            {activeScreen === "rules" && <RulesScreen onBack={() => goTo("home")} full />}
            {activeScreen === "rulesInGame" && <RulesScreen onBack={() => goTo("record")} rolesOnly />}

            {activeScreen === "record" && state && (
              <section className="screen">
                <nav className="app-nav-3col">
                  <div className="nav-left">
                    <button className="icon-btn" onClick={() => setShowSave(true)}>‹</button>
                    <button className="ghost-btn" onClick={() => goTo("rulesInGame")}>规则</button>
                  </div>
                  <div className="nav-center">{state.playerCount} 人局战况</div>
                  <button className="ghost-btn nav-right" onClick={() => goTo("notes")}>笔记</button>
                </nav>
                {showSave && (
                  <div className="save-confirm">
                    <strong>返回前是否保存本局记录？</strong>
                    <p>点击左上角返回时弹出，避免误退丢失当前推理。</p>
                    <div className="confirm-actions">
                      <button className="primary-btn" onClick={() => { saveToStorage(); goTo("home"); }}>保存并返回</button>
                      <button className="ghost-btn" onClick={discardSaveAndReturnHome}>不保存</button>
                      <button className="ghost-btn" onClick={() => setShowSave(false)}>继续记录</button>
                    </div>
                  </div>
                )}
                <MissionPager state={state} selectedMissionIndex={displayedMissionIndex} onSelect={setViewMissionIndex} />
                {isLiveMissionView ? (
                  <div className={missionCardClass(state.missionResults[state.currentMission])}>
                    {state.rejectStreak > 0 && <div className="reset-banner">已连续 {state.rejectStreak} 次组队被否决{state.rejectStreak >= 4 ? "，本次为强制轮，将直接出发不再表决" : ""}</div>}
                    {state.phase === "team" && (
                    <>
                      <h4>第 {state.rejectStreak + 1} 次组队 · {leaderSeat === 1 ? "我" : `${leaderSeat}号`}队长</h4>
                      <p>需选出 {currentSize} 人组队，当前已选 {state.pickedTeam.length} 人</p>
                      <SeatSvg n={state.playerCount} leaderSeat={leaderSeat} teamSeats={state.pickedTeam} identityTags={displayedIdentityTags} captionTop={`队长 ${leaderSeat === 1 ? "我" : `${leaderSeat}号`}`} captionBottom={`需上车 ${currentSize} 人`} />
                      <div className="player-pick-grid">
                        {Array.from({ length: state.playerCount }, (_, i) => i + 1).map((seat) => (
                          <button key={seat} className={`player-pick ${state.pickedTeam.includes(seat) ? "picked" : ""} ${seat === leaderSeat ? "is-leader" : ""}`} onClick={() => updateState((cur) => {
                            const exists = cur.pickedTeam.includes(seat);
                            if (!exists && cur.pickedTeam.length >= cur.missionSizes[cur.currentMission]) return cur;
                            return { ...cur, pickedTeam: exists ? cur.pickedTeam.filter((s) => s !== seat) : [...cur.pickedTeam, seat].sort((a, b) => a - b) };
                          })}>{seat === 1 ? "我" : `${seat}号`}</button>
                        ))}
                      </div>
                      <button className="primary-btn" style={{ width: "100%" }} disabled={state.pickedTeam.length !== currentSize} onClick={() => updateState((cur) => cur.rejectStreak >= 4 ? { ...cur, votes: allAgreeVotes(cur.playerCount), phase: "mission", missionFailVotes: 0 } : { ...cur, votes: allAgreeVotes(cur.playerCount), phase: "vote" })}>确认组队{state.rejectStreak >= 4 ? "（强制出发）" : "，进入投票"}</button>
                    </>
                    )}
                    {state.phase === "vote" && (
                    <>
                      <h4>第 {state.rejectStreak + 1} 次组队表决</h4>
                      <p>队伍：{state.pickedTeam.map((s) => s === 1 ? "我" : `${s}号`).join("、")}，请记录每位玩家的投票</p>
                      <SeatSvg n={state.playerCount} leaderSeat={leaderSeat} teamSeats={state.pickedTeam} voteMap={state.votes} identityTags={displayedIdentityTags} captionTop={`队长 ${leaderSeat === 1 ? "我" : `${leaderSeat}号`}`} captionBottom={`上车 ${state.pickedTeam.map((s) => s === 1 ? "我" : s).join(",")}`} />
                      <div className="vote-grid">
                        {Array.from({ length: state.playerCount }, (_, i) => i + 1).map((seat) => <button key={seat} className={`vote-pick ${state.votes[seat] === "agree" ? "agree" : ""} ${state.votes[seat] === "reject" ? "reject" : ""}`} onClick={() => updateState((cur) => {
                          const votes = { ...cur.votes };
                          votes[seat] = votes[seat] === "reject" ? "agree" : "reject";
                          return { ...cur, votes };
                        })}>{seat === 1 ? "我" : `${seat}号`}</button>)}
                      </div>
                      <div className="step-actions">
                        <button className="ghost-btn" style={{ flex: 1 }} onClick={() => updateState((cur) => ({ ...cur, phase: "team", votes: {} }))}>返回重选</button>
                        <button className="primary-btn" style={{ flex: 1 }} disabled={Object.keys(state.votes).length !== state.playerCount} onClick={() => updateState((cur) => {
                          const agree = Object.values(cur.votes).filter((v) => v === "agree").length;
                          const reject = Object.values(cur.votes).filter((v) => v === "reject").length;
                          const passed = agree > reject;
                          const logged = logLaunch(cur, { passed });
                          return passed ? { ...logged, phase: "mission", missionFailVotes: 0, rejectStreak: 0 } : { ...logged, rejectStreak: logged.rejectStreak + 1, leaderIndex: (logged.leaderIndex + 1) % logged.playerCount, pickedTeam: [], votes: {}, phase: "team" };
                        })}>结算投票</button>
                      </div>
                    </>
                    )}
                    {state.phase === "mission" && (
                    <>
                      <h4>执行中</h4>
                      <p>上车 {state.pickedTeam.length} 人暗中提交任务牌，请填写本次任务收到的失败票数量。</p>
                      <SeatSvg n={state.playerCount} leaderSeat={leaderSeat} teamSeats={state.pickedTeam} identityTags={displayedIdentityTags} captionTop="上车执行中" captionBottom={`需${failsNeeded(state.playerCount, state.currentMission)}张失败票才算失败`} />
                      <div className="fail-vote-counter">
                        <button className="counter-btn" disabled={state.missionFailVotes <= 0} onClick={() => updateState((cur) => ({ ...cur, missionFailVotes: Math.max(0, cur.missionFailVotes - 1) }))}>－</button>
                        <div className="counter-display"><div className="counter-main"><strong>{state.missionFailVotes}</strong> 张失败票</div><div className="counter-sub">成功票 {state.pickedTeam.length - state.missionFailVotes} 张 · 共 {state.pickedTeam.length} 人</div></div>
                        <button className="counter-btn" disabled={state.missionFailVotes >= state.pickedTeam.length} onClick={() => updateState((cur) => ({ ...cur, missionFailVotes: Math.min(cur.pickedTeam.length, cur.missionFailVotes + 1) }))}>＋</button>
                      </div>
                      <button className="primary-btn" style={{ width: "100%" }} onClick={() => updateState((cur) => {
                        const result = cur.missionFailVotes >= failsNeeded(cur.playerCount, cur.currentMission) ? "bad" : "good";
                        return finalizeMission(completeMissionLaunch(cur, result), result);
                      })}>结算任务</button>
                    </>
                    )}
                  </div>
                ) : <MissionReview state={state} missionIndex={displayedMissionIndex} />}
                {isLiveMissionView ? <IdentityTagsPanel state={state} activeTags={displayedIdentityTags} onToggle={toggleIdentityTag} /> : null}
                <LaunchHistory state={state} missionIndex={displayedMissionIndex} />
              </section>
            )}

            {activeScreen === "notes" && state && (
              <section className="screen">
                <nav className="app-nav">
                  <button className="icon-btn" onClick={() => goTo("record")}>‹</button>
                  <div className="brand">我的笔记</div>
                  <span style={{ width: 36 }} />
                </nav>
                <textarea className="notes-area" placeholder="在这里记录身份推测、可疑发言、车次复盘……" value={state.notes} onChange={(event) => updateState((cur) => ({ ...cur, notes: event.target.value }))} />
              </section>
            )}

            {activeScreen === "assassinate" && state && (
              <section className="screen">
                <nav className="app-nav"><span style={{ width: 36 }} /><div className="brand">刺杀环节</div><span style={{ width: 36 }} /></nav>
                <div className="hero" style={{ background: "linear-gradient(180deg,rgba(13,19,23,.16),rgba(13,19,23,.82)), linear-gradient(135deg,#4a2320,#b8463e 60%,#e0a39d)" }}>
                  <h3>蓝方完成三次任务</h3>
                  <p>场上有刺客，请刺客线下指认梅林，然后在此记录刺杀结果。</p>
                </div>
                <div className="step-actions">
                  <button className="primary-btn assassin-btn" style={{ flex: 1 }} onClick={() => updateState((cur) => resolveAssassination(cur, true))}>
                    <span>刺杀成功</span>
                    <small>红方胜</small>
                  </button>
                  <button className="ghost-btn assassin-btn" style={{ flex: 1 }} onClick={() => updateState((cur) => resolveAssassination(cur, false))}>
                    <span>刺杀失败</span>
                    <small>蓝方胜</small>
                  </button>
                </div>
              </section>
            )}

            {activeScreen === "result" && state && (
              <section className="screen">
                <nav className="app-nav"><span style={{ width: 36 }} /><div className="brand">本局结算</div><span style={{ width: 36 }} /></nav>
                <div className="hero" style={{ background: state.winner === "blue" ? "linear-gradient(180deg,rgba(13,19,23,.16),rgba(13,19,23,.82)), linear-gradient(135deg,#23425e,#376f9f 60%,#9fc6e0)" : "linear-gradient(180deg,rgba(13,19,23,.16),rgba(13,19,23,.82)), linear-gradient(135deg,#4a2320,#b8463e 60%,#e0a39d)" }}>
                  <h3>{state.winner === "blue" ? "蓝方胜利" : "红方胜利"}</h3>
                  <p>
                    {state.winner === "blue"
                      ? (state.roleToggle.assassin ? "蓝方完成三次任务，且成功抵挡刺客刺杀，蓝方获胜。" : "蓝方率先完成三次任务，蓝方获胜。")
                      : (state.missionResults.filter((r) => r === "bad").length >= 3 ? "红方率先破坏三次任务，红方获胜。" : "刺客成功刺杀梅林，红方逆转获胜。")}
                  </p>
                </div>
                <div className="section-title"><h3>任务回顾</h3></div>
                <MissionPager state={state} selectedMissionIndex={displayedMissionIndex} onSelect={setViewMissionIndex} />
                <button className="primary-btn" style={{ width: "100%" }} onClick={() => goTo("home")}>返回首页</button>
              </section>
            )}

            {showMenu && <PageMenu onClose={() => setShowMenu(false)} onJump={jumpToDemoScreen} />}
          </div>
        </div>
        <p className="footer-note">阿瓦隆笔记本 · Next.js App Router</p>
      </div>
    </main>
  );
}
