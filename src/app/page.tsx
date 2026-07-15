"use client";

import { useEffect, useMemo, useState } from "react";
import { IdentityTagsPanel } from "@/components/IdentityTagsPanel";
import { LaunchHistory } from "@/components/LaunchHistory";
import { MissionPager } from "@/components/MissionPager";
import { MissionReview } from "@/components/MissionReview";
import { RulesScreen } from "@/components/RulesScreen";
import { SeatSvg } from "@/components/SeatSvg";
import {
  allAgreeVotes,
  appendHistory,
  completeMissionLaunch,
  defaultConfig,
  effectiveIdentityTags,
  failsNeeded,
  finalizeMission,
  freshState,
  isSavedGameState,
  loadHistoryStats,
  logLaunch,
  missionCardClass,
  missionSizeTable,
  normalizeState,
  peekSavedSummary,
  playerCounts,
  resolveAssassination,
  roleKeys,
  roles,
  storageKey,
  themeStorageKey,
  togglesFor,
  type GameState,
  type HistoryEntry,
  type IdentityTag,
  type RoleKey,
  type SaveSummary,
  type Screen,
  type SeatPoint
} from "@/lib/game";

function formatRelativeTime(ms?: number) {
  if (!ms) return "本机存档";
  const minutes = Math.floor((Date.now() - ms) / 60000);
  if (minutes < 1) return "刚刚保存";
  if (minutes < 60) return `${minutes} 分钟前保存`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前保存`;
  return `${Math.floor(hours / 24)} 天前保存`;
}

function formatShortDate(ms: number) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function persistState(nextState: GameState) {
  try {
    const serialized = JSON.stringify({ ...nextState, updatedAt: Date.now() });
    if (serialized.length > 256 * 1024) return false;
    localStorage.setItem(storageKey, serialized);
    return true;
  } catch {
    return false;
  }
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [setupCount, setSetupCount] = useState(8);
  const [setupRoles, setSetupRoles] = useState<Record<RoleKey, boolean>>(togglesFor(8));
  const [setupLeader, setSetupLeader] = useState(1);
  const [state, setState] = useState<GameState | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [viewMissionIndex, setViewMissionIndex] = useState<number | null>(null);
  const [selectedIdentityTag, setSelectedIdentityTag] = useState<IdentityTag | null>(null);
  const [editingSeats, setEditingSeats] = useState(false);
  const [savedSummary, setSavedSummary] = useState<SaveSummary | null>(null);
  const [historyStats, setHistoryStats] = useState<{ total: number; blue: number; red: number; recent: HistoryEntry[] } | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // Deferred to an effect (rather than computed during render) so the first client
    // render matches the server-rendered markup before reading localStorage.
    if (screen !== "home") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedSummary(peekSavedSummary());
    setHistoryStats(loadHistoryStats());
  }, [screen]);

  useEffect(() => {
    const saved = localStorage.getItem(themeStorageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((cur) => (cur === "dark" ? "light" : "dark"));
  }

  const filler = useMemo(() => {
    const cfg = defaultConfig[setupCount];
    const redSpecialsOn = roleKeys.filter((key) => roles[key].side === "red" && setupRoles[key]).length;
    const blueSpecialsOn = roleKeys.filter((key) => roles[key].side === "blue" && setupRoles[key]).length;
    const assassinMissing = !setupRoles.assassin;
    return {
      redSpecialsOn,
      minionCount: cfg.red - redSpecialsOn,
      loyalCount: cfg.blue - blueSpecialsOn,
      assassinMissing,
      ok: !assassinMissing && redSpecialsOn <= cfg.red && cfg.blue >= blueSpecialsOn
    };
  }, [setupCount, setupRoles]);

  function goTo(next: Screen) {
    setShowSave(false);
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
    if (!raw) return;
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
      if (!persistState(next)) {
        alert("保存失败：记录过大或浏览器存储空间不足");
      }
      if (next.finished && !current.finished && next.winner) {
        appendHistory({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          playerCount: next.playerCount,
          winner: next.winner,
          missionResults: next.missionResults,
          finishedAt: Date.now()
        });
      }
      return next;
    });
  }

  function toggleIdentityTag(seat: number, tag: IdentityTag) {
    updateState((cur) => {
      const missionIndex = cur.currentMission;
      const identityTagEvents = [...(cur.identityTagEvents ?? [])];
      const activeAtMission = (event: { startMission: number; endMission?: number }) => (
        event.startMission <= missionIndex &&
        (event.endMission === undefined || missionIndex < event.endMission)
      );
      const activeIndex = identityTagEvents.findLastIndex((event) => (
        event.seat === seat && event.tag === tag && activeAtMission(event)
      ));

      if (activeIndex >= 0) {
        identityTagEvents[activeIndex] = { ...identityTagEvents[activeIndex], endMission: missionIndex };
      } else {
        identityTagEvents.forEach((event, index) => {
          if (event.seat === seat && activeAtMission(event)) {
            identityTagEvents[index] = { ...event, endMission: missionIndex };
          }
        });
        identityTagEvents.push({ seat, tag, startMission: missionIndex });
      }

      return { ...cur, identityTagEvents };
    });
  }

  function moveSeat(seat: number, point: SeatPoint) {
    updateState((cur) => ({ ...cur, seatLayout: { ...cur.seatLayout, [seat]: point } }));
  }

  function resetSeatLayout() {
    updateState((cur) => {
      const next = { ...cur };
      delete next.seatLayout;
      return next;
    });
  }

  function handleSeatWithIdentityFallback(seat: number, fallback: (seat: number) => void) {
    if (selectedIdentityTag) {
      toggleIdentityTag(seat, selectedIdentityTag);
      return;
    }
    fallback(seat);
  }

  function beginGame() {
    if (!filler.ok) return;
    const next = freshState(setupCount, setupRoles, setupLeader);
    setState(next);
    setViewMissionIndex(null);
    persistState(next);
    goTo("record");
  }

  function toggleTeamSeat(seat: number) {
    updateState((cur) => {
      const exists = cur.pickedTeam.includes(seat);
      if (!exists && cur.pickedTeam.length >= cur.missionSizes[cur.currentMission]) return cur;
      return { ...cur, pickedTeam: exists ? cur.pickedTeam.filter((s) => s !== seat) : [...cur.pickedTeam, seat].sort((a, b) => a - b) };
    });
  }

  function toggleVoteSeat(seat: number) {
    updateState((cur) => {
      const votes = { ...cur.votes };
      votes[seat] = votes[seat] === "agree" ? "reject" : "agree";
      return { ...cur, votes };
    });
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
      <div className="app-container">
        <div className="app-screen">
            {activeScreen === "home" && (
              <section className="screen screen-auto">
              <div className="home-shell">
                <nav className="app-nav top-nav">
                  <div className="brand"><span className="brand-mark">A</span><span>Avalon Note</span></div>
                  <div className="top-nav-links">
                    <button className="nav-link" onClick={() => goTo("rules")}>规则</button>
                    <button className="icon-btn" aria-label="切换主题" onClick={toggleTheme}>{theme === "dark" ? "☀️" : "🌙"}</button>
                  </div>
                </nav>

                <div className="hero home-hero">
                  <svg className="hero-motif" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
                    <circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" strokeWidth="1" />
                    <circle cx="200" cy="200" r="108" fill="none" stroke="currentColor" strokeWidth="1" />
                    <circle cx="200" cy="200" r="66" fill="none" stroke="currentColor" strokeWidth="1" />
                    <line x1="200" y1="30" x2="200" y2="370" stroke="currentColor" strokeWidth="1" />
                    <line x1="30" y1="200" x2="370" y2="200" stroke="currentColor" strokeWidth="1" />
                    <line x1="72" y1="72" x2="328" y2="328" stroke="currentColor" strokeWidth="1" />
                    <line x1="328" y1="72" x2="72" y2="328" stroke="currentColor" strokeWidth="1" />
                  </svg>
                  <div className="hero-content">
                    <span className="eyebrow">线下阿瓦隆 · 现场记录</span>
                    <h1 className="home-title">阿瓦隆笔记本</h1>
                    <p className="home-subtitle">记录组队、投票与任务结果，全部数据只保存在本机。</p>
                    <div className="hero-actions">
                      <button className="primary-btn" onClick={startNewGame}>新开一局</button>
                    </div>
                  </div>
                </div>

                <div className="home-below-hero">
                  {savedSummary && (
                    <button className="recent-card" onClick={continueGame}>
                      <div className="recent-card-body">
                        <span className={`tag ${savedSummary.finished ? (savedSummary.winner === "blue" ? "blue" : "bad") : ""}`}>
                          {savedSummary.finished ? (savedSummary.winner === "blue" ? "蓝方胜利" : "红方胜利") : "进行中"}
                        </span>
                        <strong className="recent-card-title">
                          {savedSummary.playerCount} 人局
                          {!savedSummary.finished && ` · 任务 ${savedSummary.currentMission + 1}/${savedSummary.missionCount}`}
                        </strong>
                        <span className="recent-card-meta">{formatRelativeTime(savedSummary.updatedAt)}</span>
                      </div>
                      <span className="recent-card-arrow" aria-hidden="true">→</span>
                    </button>
                  )}

                  {historyStats && historyStats.total > 0 && (
                    <div className="stats-card">
                      <div className="section-title" style={{ margin: "0 0 12px" }}><h3>本机战绩</h3></div>
                      <div className="stats-grid">
                        <div className="stat-tile"><strong>{historyStats.total}</strong><span>总局数</span></div>
                        <div className="stat-tile stat-blue"><strong>{historyStats.blue}</strong><span>蓝方胜</span></div>
                        <div className="stat-tile stat-red"><strong>{historyStats.red}</strong><span>红方胜</span></div>
                      </div>
                      <div className="history-list">
                        {historyStats.recent.map((entry) => (
                          <div className="history-item" key={entry.id}>
                            <span className={`tag ${entry.winner === "blue" ? "blue" : "bad"}`}>{entry.winner === "blue" ? "蓝方胜" : "红方胜"}</span>
                            <span className="history-meta">{entry.playerCount} 人局 · {formatShortDate(entry.finishedAt)}</span>
                            <span className="history-dots">
                              {entry.missionResults.filter(Boolean).map((r, i) => <i key={i} className={`mini-dot ${r === "good" ? "good" : "bad"}`} />)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rules-summary-card">
                  <div>
                    <div className="section-title" style={{ margin: 0 }}><h3>新手须知</h3></div>
                    <p>蓝方完成三次任务获胜；红方靠破坏任务或事后刺杀梅林翻盘。队长每轮组队、全员表决，多数同意才能出发。</p>
                  </div>
                  <button className="ghost-btn" onClick={() => goTo("rules")}>查看完整规则</button>
                </div>
              </div>
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
                <p className={`warn-text ${filler.ok ? "" : "error"}`}>
                  {filler.ok
                    ? <>自动补齐：<strong>{filler.loyalCount}</strong> 名忠臣（蓝方）、<strong>{filler.minionCount}</strong> 名爪牙（红方），共 {setupCount} 人。</>
                    : filler.assassinMissing
                    ? `红方特殊角色不符合 ${setupCount} 人局要求：刺客为必选角色，请开启刺客。`
                    : `红方特殊角色不符合 ${setupCount} 人局要求：不能超过 ${defaultConfig[setupCount].red} 个。`}
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
            {activeScreen === "rulesInGame" && <RulesScreen onBack={() => goTo("record")} full />}

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
                      <button className="primary-btn" onClick={() => { if (state) persistState(state); goTo("home"); }}>保存并返回</button>
                      <button className="ghost-btn" onClick={discardSaveAndReturnHome}>不保存</button>
                      <button className="ghost-btn" onClick={() => setShowSave(false)}>继续记录</button>
                    </div>
                  </div>
                )}
                <MissionPager state={state} selectedMissionIndex={displayedMissionIndex} onSelect={setViewMissionIndex} />
                {isLiveMissionView ? (
                  <div className={missionCardClass(state.missionResults[state.currentMission])}>
                    {state.rejectStreak > 0 && <div className="reset-banner">已连续 {state.rejectStreak} 次组队被否决{state.rejectStreak >= 4 ? "，本次为强制轮，将直接出发不再表决" : ""}</div>}
                    <div className="seat-layout-bar">
                      <button
                        className={editingSeats ? "primary-btn seat-layout-btn" : "ghost-btn seat-layout-btn"}
                        onClick={() => { setEditingSeats((on) => !on); setSelectedIdentityTag(null); }}
                      >
                        {editingSeats ? "完成编辑" : "编辑座位图"}
                      </button>
                      <span className="seat-layout-hint">
                        {editingSeats ? "拖动座位以贴合现场牌桌，编辑期间不会改动上车与投票记录。" : "长按座位可直接拖动调整位置。"}
                      </span>
                      {state.seatLayout && <button className="ghost-btn seat-layout-btn" onClick={resetSeatLayout}>恢复默认排布</button>}
                    </div>
                    {state.phase === "team" && (
                    <>
                      <h4>第 {state.rejectStreak + 1} 次组队 · {leaderSeat === 1 ? "我" : `${leaderSeat}号`}队长</h4>
                      <p>需选出 {currentSize} 人组队，当前已选 {state.pickedTeam.length} 人</p>
                      <div className="seat-identity-stage">
                        <IdentityTagsPanel state={state} activeTags={displayedIdentityTags} selectedTag={selectedIdentityTag} onSelect={setSelectedIdentityTag} />
                        <SeatSvg seatLayout={state.seatLayout} editing={editingSeats} onSeatMove={moveSeat} n={state.playerCount} leaderSeat={leaderSeat} teamSeats={state.pickedTeam} identityTags={displayedIdentityTags} onSeatClick={(seat) => handleSeatWithIdentityFallback(seat, toggleTeamSeat)} captionTop={`队长 ${leaderSeat === 1 ? "我" : `${leaderSeat}号`}`} captionBottom={`需上车 ${currentSize} 人`} />
                      </div>
                      <button className="primary-btn" style={{ width: "100%" }} disabled={state.pickedTeam.length !== currentSize} onClick={() => updateState((cur) => cur.rejectStreak >= 4 ? { ...cur, votes: allAgreeVotes(cur.playerCount), phase: "mission", missionFailVotes: 0 } : { ...cur, votes: allAgreeVotes(cur.playerCount), phase: "vote" })}>确认组队{state.rejectStreak >= 4 ? "（强制出发）" : "，进入投票"}</button>
                    </>
                    )}
                    {state.phase === "vote" && (
                    <>
                      <h4>第 {state.rejectStreak + 1} 次组队表决</h4>
                      <p>队伍：{state.pickedTeam.map((s) => s === 1 ? "我" : `${s}号`).join("、")}，请记录每位玩家的投票</p>
                      <div className="seat-identity-stage">
                        <IdentityTagsPanel state={state} activeTags={displayedIdentityTags} selectedTag={selectedIdentityTag} onSelect={setSelectedIdentityTag} />
                        <SeatSvg seatLayout={state.seatLayout} editing={editingSeats} onSeatMove={moveSeat} n={state.playerCount} leaderSeat={leaderSeat} teamSeats={state.pickedTeam} voteMap={state.votes} identityTags={displayedIdentityTags} onSeatClick={(seat) => handleSeatWithIdentityFallback(seat, toggleVoteSeat)} captionTop={`队长 ${leaderSeat === 1 ? "我" : `${leaderSeat}号`}`} captionBottom={`上车 ${state.pickedTeam.map((s) => s === 1 ? "我" : s).join(",")}`} />
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
                      <div className="seat-identity-stage">
                        <IdentityTagsPanel state={state} activeTags={displayedIdentityTags} selectedTag={selectedIdentityTag} onSelect={setSelectedIdentityTag} />
                        <SeatSvg seatLayout={state.seatLayout} editing={editingSeats} onSeatMove={moveSeat} n={state.playerCount} leaderSeat={leaderSeat} teamSeats={state.pickedTeam} identityTags={displayedIdentityTags} onSeatClick={selectedIdentityTag ? (seat) => toggleIdentityTag(seat, selectedIdentityTag) : undefined} captionTop="上车执行中" captionBottom={`需${failsNeeded(state.playerCount, state.currentMission)}张失败票才算失败`} />
                      </div>
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
                <div className="hero hero-red">
                  <h3>蓝方完成三次任务</h3>
                  <p>场上有刺客，请刺客线下指认梅林，然后在此记录刺杀结果。</p>
                </div>
                <div className="section-title"><h3>任务回顾</h3></div>
                <MissionPager state={state} selectedMissionIndex={displayedMissionIndex} onSelect={setViewMissionIndex} />
                <MissionReview state={state} missionIndex={displayedMissionIndex} />
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
                <div className={`hero ${state.winner === "blue" ? "hero-blue" : "hero-red"}`}>
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
        </div>
        <p className="footer-note">阿瓦隆笔记本 · Next.js App Router</p>
      </div>
    </main>
  );
}
