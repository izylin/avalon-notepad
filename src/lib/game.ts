export type Screen = "home" | "setup" | "rules" | "rulesInGame" | "record" | "notes" | "result" | "assassinate";
export type RoleKey = "merlin" | "percival" | "morgana" | "assassin" | "mordred" | "oberon";
export type Vote = "agree" | "reject";
export type MissionResult = "good" | "bad" | null;
export type Phase = "team" | "vote" | "mission";
export type IdentityTag = RoleKey;

export type IdentityTagEvent = {
  seat: number;
  tag: IdentityTag;
  startMission: number;
  endMission?: number;
};

export type SeatPoint = { x: number; y: number };
export type SeatLayout = Record<number, SeatPoint>;

export type LaunchLog = {
  missionNo: number;
  round: number;
  leaderSeat: number;
  team: number[];
  votes: Record<number, Vote>;
  passed: boolean;
  missionResult: MissionResult;
  fails: number;
  /** 仅记录任务成功 / 失败，不保存组队、投票等详细过程。 */
  resultOnly?: boolean;
};

export type GameState = {
  playerCount: number;
  roleToggle: Record<RoleKey, boolean>;
  missionSizes: number[];
  currentMission: number;
  missionResults: MissionResult[];
  leaderIndex: number;
  rejectStreak: number;
  launchLog: LaunchLog[];
  phase: Phase;
  pickedTeam: number[];
  votes: Record<number, Vote>;
  missionFailVotes: number;
  identityTags?: Record<number, IdentityTag>;
  identityTagEvents: IdentityTagEvent[];
  seatLayout?: SeatLayout;
  notes: string;
  finished: boolean;
  winner: "blue" | "red" | null;
  awaitingAssassination: boolean;
  updatedAt?: number;
};

export type SaveSummary = {
  playerCount: number;
  currentMission: number;
  missionCount: number;
  finished: boolean;
  winner: "blue" | "red" | null;
  updatedAt?: number;
};

export type HistoryEntry = {
  id: string;
  playerCount: number;
  winner: "blue" | "red";
  missionResults: MissionResult[];
  finishedAt: number;
};

export const missionSizeTable: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5]
};

export const roles: Record<RoleKey, { name: string; side: "blue" | "red"; sub: string }> = {
  merlin: { name: "梅林", side: "blue", sub: "好人核心" },
  percival: { name: "派西维尔", side: "blue", sub: "识别梅林" },
  morgana: { name: "莫甘娜", side: "red", sub: "伪装梅林" },
  assassin: { name: "刺客", side: "red", sub: "终局刺杀" },
  mordred: { name: "莫德雷德", side: "red", sub: "梅林不可见" },
  oberon: { name: "奥伯伦", side: "red", sub: "坏人互不见" }
};

export const defaultConfig: Record<number, { red: number; blue: number; specials: RoleKey[] }> = {
  5: { red: 2, blue: 3, specials: ["merlin", "percival", "morgana", "assassin"] },
  6: { red: 2, blue: 4, specials: ["merlin", "percival", "morgana", "assassin"] },
  7: { red: 3, blue: 4, specials: ["merlin", "percival", "morgana", "oberon", "assassin"] },
  8: { red: 3, blue: 5, specials: ["merlin", "percival", "morgana", "assassin"] },
  9: { red: 3, blue: 6, specials: ["merlin", "percival", "mordred", "morgana", "assassin"] },
  10: { red: 4, blue: 6, specials: ["merlin", "percival", "mordred", "morgana", "oberon", "assassin"] }
};

export const storageKey = "avalon_note_save_v1";
export const historyKey = "avalon_note_history_v1";
export const themeStorageKey = "avalon_note_theme_v1";
export const roleKeys = Object.keys(roles) as RoleKey[];
export const playerCounts = [5, 6, 7, 8, 9, 10];
export const seatCanvas = { width: 344, height: 320 };
const maxSavedCharacters = 256 * 1024;
const maxNotesLength = 10_000;
const maxLaunchLogs = 25;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntegerBetween(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function isMissionResult(value: unknown): value is MissionResult {
  return value === null || value === "good" || value === "bad";
}

function isSeat(value: unknown, playerCount: number): value is number {
  return isIntegerBetween(value, 1, playerCount);
}

function isSeatList(value: unknown, playerCount: number): value is number[] {
  return Array.isArray(value) &&
    value.length <= playerCount &&
    new Set(value).size === value.length &&
    value.every((seat) => isSeat(seat, playerCount));
}

function isVotes(value: unknown, playerCount: number): value is Record<number, Vote> {
  if (!isRecord(value) || Object.keys(value).length > playerCount) return false;
  return Object.entries(value).every(([seat, vote]) => (
    isSeat(Number(seat), playerCount) && (vote === "agree" || vote === "reject")
  ));
}

function isLaunchLog(value: unknown, playerCount: number): value is LaunchLog {
  if (!isRecord(value)) return false;
  return isIntegerBetween(value.missionNo, 1, 5) &&
    isIntegerBetween(value.round, 1, 5) &&
    isSeat(value.leaderSeat, playerCount) &&
    isSeatList(value.team, playerCount) &&
    isVotes(value.votes, playerCount) &&
    typeof value.passed === "boolean" &&
    isMissionResult(value.missionResult) &&
    isIntegerBetween(value.fails, 0, playerCount) &&
    (value.resultOnly === undefined || typeof value.resultOnly === "boolean");
}

function isIdentityTag(value: unknown): value is IdentityTag {
  return typeof value === "string" && (roleKeys as string[]).includes(value);
}

function isIdentityTagEvent(value: unknown, playerCount: number): value is IdentityTagEvent {
  if (!isRecord(value)) return false;
  return isSeat(value.seat, playerCount) &&
    isIdentityTag(value.tag) &&
    isIntegerBetween(value.startMission, 0, 4) &&
    (value.endMission === undefined || isIntegerBetween(value.endMission, 0, 5));
}

function isSeatPoint(value: unknown): value is SeatPoint {
  if (!isRecord(value)) return false;
  const { x, y } = value;
  return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= seatCanvas.width &&
    typeof y === "number" && Number.isFinite(y) && y >= 0 && y <= seatCanvas.height;
}

function isSeatLayout(value: unknown, playerCount: number): value is SeatLayout {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= playerCount &&
    entries.every(([seat, point]) => isSeat(Number(seat), playerCount) && isSeatPoint(point));
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" &&
    value.id.length > 0 && value.id.length <= 100 &&
    isIntegerBetween(value.playerCount, 5, 10) &&
    (value.winner === "blue" || value.winner === "red") &&
    Array.isArray(value.missionResults) &&
    value.missionResults.length === 5 &&
    value.missionResults.every(isMissionResult) &&
    typeof value.finishedAt === "number" && Number.isFinite(value.finishedAt);
}

export function failsNeeded(playerCount: number, missionIndex: number) {
  return playerCount >= 8 && missionIndex === 3 ? 2 : 1;
}

export function togglesFor(playerCount: number): Record<RoleKey, boolean> {
  const cfg = defaultConfig[playerCount];
  return roleKeys.reduce((acc, key) => {
    acc[key] = cfg.specials.includes(key);
    return acc;
  }, {} as Record<RoleKey, boolean>);
}

export function freshState(playerCount: number, roleToggle = togglesFor(playerCount), leaderSeat = 1): GameState {
  return {
    playerCount,
    roleToggle,
    missionSizes: missionSizeTable[playerCount].slice(),
    currentMission: 0,
    missionResults: [null, null, null, null, null],
    leaderIndex: leaderSeat - 1,
    rejectStreak: 0,
    launchLog: [],
    phase: "team",
    pickedTeam: [],
    votes: {},
    missionFailVotes: 0,
    identityTagEvents: [],
    notes: "",
    finished: false,
    winner: null,
    awaitingAssassination: false,
    updatedAt: Date.now()
  };
}

export function peekSavedSummary(): SaveSummary | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(storageKey);
  if (!raw || raw.length > maxSavedCharacters) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isSavedGameState(parsed)) return null;
    const saved = normalizeState(parsed);
    return {
      playerCount: saved.playerCount,
      currentMission: saved.currentMission,
      missionCount: saved.missionSizes.length,
      finished: saved.finished,
      winner: saved.winner,
      updatedAt: saved.updatedAt
    };
  } catch {
    return null;
  }
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(historyKey);
    if (!raw) return [];
    if (raw.length > maxSavedCharacters) throw new Error("history is too large");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > 30 || !parsed.every(isHistoryEntry)) {
      throw new Error("invalid history");
    }
    return parsed;
  } catch {
    localStorage.removeItem(historyKey);
    return [];
  }
}

export function appendHistory(entry: HistoryEntry) {
  const list = [entry, ...loadHistory()].slice(0, 30);
  localStorage.setItem(historyKey, JSON.stringify(list));
  return list;
}

export function loadHistoryStats() {
  const history = loadHistory();
  return {
    total: history.length,
    blue: history.filter((entry) => entry.winner === "blue").length,
    red: history.filter((entry) => entry.winner === "red").length,
    recent: history.slice(0, 3)
  };
}

export function allAgreeVotes(playerCount: number): Record<number, Vote> {
  const votes: Record<number, Vote> = {};
  for (let seat = 1; seat <= playerCount; seat++) votes[seat] = "agree";
  return votes;
}

export function isSavedGameState(value: unknown): value is GameState {
  if (!isRecord(value) || !isIntegerBetween(value.playerCount, 5, 10)) return false;
  const playerCount = value.playerCount;
  const expectedMissionSizes = missionSizeTable[playerCount];
  const roleToggle = value.roleToggle;
  const validRoleToggle = isRecord(roleToggle) && roleKeys.every((key) => typeof roleToggle[key] === "boolean");
  const validIdentityEvents = value.identityTagEvents === undefined || (
    Array.isArray(value.identityTagEvents) &&
    value.identityTagEvents.length <= 50 &&
    value.identityTagEvents.every((event) => isIdentityTagEvent(event, playerCount))
  );
  const validLegacyIdentityTags = value.identityTags === undefined || (
    isRecord(value.identityTags) &&
    Object.entries(value.identityTags).every(([seat, tag]) => (
      isSeat(Number(seat), playerCount) && isIdentityTag(tag)
    ))
  );
  const validSeatLayout = value.seatLayout === undefined || isSeatLayout(value.seatLayout, playerCount);

  return validRoleToggle &&
    Array.isArray(value.missionSizes) &&
    value.missionSizes.length === 5 &&
    value.missionSizes.every((size, index) => size === expectedMissionSizes[index]) &&
    isIntegerBetween(value.currentMission, 0, 4) &&
    Array.isArray(value.missionResults) &&
    value.missionResults.length === 5 &&
    value.missionResults.every(isMissionResult) &&
    isIntegerBetween(value.leaderIndex, 0, playerCount - 1) &&
    isIntegerBetween(value.rejectStreak, 0, 5) &&
    Array.isArray(value.launchLog) &&
    value.launchLog.length <= maxLaunchLogs &&
    value.launchLog.every((log) => isLaunchLog(log, playerCount)) &&
    (value.phase === "team" || value.phase === "vote" || value.phase === "mission") &&
    isSeatList(value.pickedTeam, playerCount) &&
    isVotes(value.votes, playerCount) &&
    isIntegerBetween(value.missionFailVotes, 0, playerCount) &&
    validLegacyIdentityTags &&
    validIdentityEvents &&
    validSeatLayout &&
    typeof value.notes === "string" && value.notes.length <= maxNotesLength &&
    typeof value.finished === "boolean" &&
    (value.winner === null || value.winner === "blue" || value.winner === "red") &&
    (value.awaitingAssassination === undefined || typeof value.awaitingAssassination === "boolean") &&
    (value.updatedAt === undefined || (typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)));
}

export function normalizeState(saved: GameState): GameState {
  const legacyTagEvents = Object.entries(saved.identityTags ?? {}).map(([seat, tag]) => ({
    seat: Number(seat),
    tag,
    startMission: 0
  }));
  return {
    ...saved,
    identityTagEvents: saved.identityTagEvents ?? legacyTagEvents,
    awaitingAssassination: saved.awaitingAssassination ?? false
  };
}

export function effectiveIdentityTags(state: GameState, missionIndex: number): Record<number, IdentityTag> {
  return (state.identityTagEvents ?? []).reduce<Record<number, IdentityTag>>((tags, event) => {
    if (event.startMission <= missionIndex && (event.endMission === undefined || missionIndex < event.endMission)) {
      tags[event.seat] = event.tag;
    }
    return tags;
  }, {});
}

export function missionCardClass(result: MissionResult) {
  return `active-card ${result === "good" ? "mission-good" : result === "bad" ? "mission-bad" : "mission-pending"}`;
}

export function logLaunch(current: GameState, info: { passed: boolean; missionResult?: MissionResult; fails?: number }) {
  return {
    ...current,
    launchLog: [
      ...current.launchLog,
      {
        missionNo: current.currentMission + 1,
        round: current.rejectStreak + 1,
        leaderSeat: current.leaderIndex + 1,
        team: [...current.pickedTeam],
        votes: { ...current.votes },
        passed: info.passed,
        missionResult: info.missionResult ?? null,
        fails: info.fails ?? 0
      }
    ]
  };
}


export function editLaunchRecord(
  current: GameState,
  missionIndex: number,
  round: number,
  team: number[],
  votes: Record<number, Vote>
) {
  const missionNo = missionIndex + 1;
  const agree = Object.values(votes).filter((vote) => vote === "agree").length;
  const reject = Object.values(votes).filter((vote) => vote === "reject").length;
  const passed = agree > reject;

  return {
    ...current,
    launchLog: current.launchLog.map((log) =>
      log.missionNo === missionNo && log.round === round && !log.resultOnly
        ? { ...log, team: [...team].sort((a, b) => a - b), votes: { ...votes }, passed }
        : log
    )
  };
}

export function completeMissionLaunch(current: GameState, result: "good" | "bad") {
  const missionNo = current.currentMission + 1;
  const launchIndex = current.launchLog.findLastIndex((log) => log.missionNo === missionNo && log.passed);
  if (launchIndex < 0) {
    return logLaunch(current, { passed: true, missionResult: result, fails: current.missionFailVotes });
  }

  return {
    ...current,
    launchLog: current.launchLog.map((log, index) => index === launchIndex ? {
      ...log,
      missionResult: result,
      fails: current.missionFailVotes
    } : log)
  };
}

/**
 * 产品需求 #34：现场来不及逐项记录时，整轮只保留“任务成功 / 失败”。
 * 当前任务已有的临时组队或投票记录会被替换，避免回顾页展示不完整详情。
 */
export function recordMissionResultOnly(current: GameState, result: "good" | "bad") {
  const missionNo = current.currentMission + 1;
  const minimalLog: LaunchLog = {
    missionNo,
    round: Math.min(5, current.rejectStreak + 1),
    leaderSeat: current.leaderIndex + 1,
    team: [],
    votes: {},
    passed: true,
    missionResult: result,
    fails: result === "bad" ? failsNeeded(current.playerCount, current.currentMission) : 0,
    resultOnly: true
  };

  return {
    ...current,
    launchLog: [
      ...current.launchLog.filter((log) => log.missionNo !== missionNo),
      minimalLog
    ]
  };
}

function deriveOutcome(current: GameState, missionResults: MissionResult[]): GameState {
  const goodWins = missionResults.filter((result) => result === "good").length;
  const badWins = missionResults.filter((result) => result === "bad").length;

  if (badWins >= 3) {
    return {
      ...current,
      missionResults,
      finished: true,
      winner: "red",
      awaitingAssassination: false
    };
  }

  if (goodWins >= 3) {
    if (current.roleToggle.assassin) {
      return {
        ...current,
        missionResults,
        finished: false,
        winner: null,
        awaitingAssassination: true
      };
    }
    return {
      ...current,
      missionResults,
      finished: true,
      winner: "blue",
      awaitingAssassination: false
    };
  }

  const firstPendingMission = missionResults.findIndex((result) => result === null);
  return {
    ...current,
    missionResults,
    currentMission: firstPendingMission >= 0 ? firstPendingMission : current.currentMission,
    finished: false,
    winner: null,
    awaitingAssassination: false
  };
}

/**
 * 产品需求 #33：在回顾页修正某轮的任务结果与最终通过组队的投票。
 * 这里只更新历史记录，不回退 currentMission、phase、当前组队或当前投票状态。
 */
export function editMissionRecord(
  current: GameState,
  missionIndex: number,
  result: "good" | "bad",
  votes?: Record<number, Vote>
) {
  if (missionIndex < 0 || missionIndex >= current.missionResults.length) return current;

  const missionResults = current.missionResults.map((value, index) => index === missionIndex ? result : value);
  const missionNo = missionIndex + 1;
  const launchIndex = current.launchLog.findLastIndex((log) => log.missionNo === missionNo && Boolean(log.missionResult));
  const fallbackLog: LaunchLog = {
    missionNo,
    round: 1,
    leaderSeat: current.leaderIndex + 1,
    team: [],
    votes: {},
    passed: true,
    missionResult: result,
    fails: result === "bad" ? failsNeeded(current.playerCount, missionIndex) : 0,
    resultOnly: true
  };
  const launchLog = launchIndex >= 0
    ? current.launchLog.map((log, index) => index === launchIndex ? {
      ...log,
      votes: !log.resultOnly && votes ? { ...votes } : log.votes,
      missionResult: result,
      fails: log.resultOnly
        ? (result === "bad" ? failsNeeded(current.playerCount, missionIndex) : 0)
        : result === "good"
          ? 0
          : Math.max(log.fails, failsNeeded(current.playerCount, missionIndex))
    } : log)
    : [...current.launchLog, fallbackLog];

  return deriveOutcome({ ...current, launchLog }, missionResults);
}

/** 向后兼容：仅修改任务结果。 */
export function editMissionResult(current: GameState, missionIndex: number, result: "good" | "bad") {
  return editMissionRecord(current, missionIndex, result);
}

export function finalizeMission(current: GameState, result: "good" | "bad") {
  const missionResults = current.missionResults.map((r, i) => i === current.currentMission ? result : r);
  const goodWins = missionResults.filter((r) => r === "good").length;
  const badWins = missionResults.filter((r) => r === "bad").length;
  if (badWins >= 3) {
    return { ...current, missionResults, finished: true, winner: "red" as const };
  }
  if (goodWins >= 3) {
    if (current.roleToggle.assassin) {
      return { ...current, missionResults, awaitingAssassination: true };
    }
    return { ...current, missionResults, finished: true, winner: "blue" as const };
  }
  return {
    ...current,
    missionResults,
    currentMission: current.currentMission + 1,
    rejectStreak: 0,
    pickedTeam: [],
    votes: {},
    missionFailVotes: 0,
    leaderIndex: (current.leaderIndex + 1) % current.playerCount,
    phase: "team" as Phase
  };
}

export function resolveAssassination(current: GameState, success: boolean): GameState {
  return {
    ...current,
    awaitingAssassination: false,
    finished: true,
    winner: success ? "red" : "blue"
  };
}

function sameSeats(a: number[], b: number[]) {
  return a.length === b.length && a.every((seat, index) => seat === b[index]);
}

function sameVotes(a: Record<number, Vote>, b: Record<number, Vote>) {
  const seats = new Set([...Object.keys(a), ...Object.keys(b)]);
  return Array.from(seats).every((seat) => a[Number(seat)] === b[Number(seat)]);
}

function sameLaunchChoice(a: LaunchLog, b: LaunchLog) {
  return a.leaderSeat === b.leaderSeat && sameSeats(a.team, b.team) && sameVotes(a.votes, b.votes);
}

export function missionLogsFor(state: GameState, missionIndex: number) {
  return state.launchLog
    .filter((log) => log.missionNo === missionIndex + 1)
    .reduce<LaunchLog[]>((logs, log) => {
      if (log.passed && log.missionResult) {
        const pendingIndex = logs.findLastIndex((item) => item.passed && !item.missionResult && sameLaunchChoice(item, log));
        if (pendingIndex >= 0) {
          logs[pendingIndex] = { ...logs[pendingIndex], missionResult: log.missionResult, fails: log.fails };
          return logs;
        }
      }
      logs.push(log);
      return logs;
    }, []);
}
