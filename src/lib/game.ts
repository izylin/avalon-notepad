export type Screen = "home" | "setup" | "rules" | "rulesInGame" | "record" | "notes" | "result" | "assassinate";
export type RoleKey = "merlin" | "percival" | "morgana" | "assassin" | "mordred" | "oberon";
export type Vote = "agree" | "reject";
export type MissionResult = "good" | "bad" | null;
export type Phase = "team" | "vote" | "mission";
export type IdentityTag = "percival";

export type IdentityTagEvent = {
  seat: number;
  tag: IdentityTag;
  startMission: number;
  endMission?: number;
};

export type LaunchLog = {
  missionNo: number;
  round: number;
  leaderSeat: number;
  team: number[];
  votes: Record<number, Vote>;
  passed: boolean;
  missionResult: MissionResult;
  fails: number;
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
  notes: string;
  finished: boolean;
  winner: "blue" | "red" | null;
  awaitingAssassination: boolean;
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
export const roleKeys = Object.keys(roles) as RoleKey[];
export const playerCounts = [5, 6, 7, 8, 9, 10];

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
    awaitingAssassination: false
  };
}

export function allAgreeVotes(playerCount: number): Record<number, Vote> {
  const votes: Record<number, Vote> = {};
  for (let seat = 1; seat <= playerCount; seat++) votes[seat] = "agree";
  return votes;
}

export function isSavedGameState(value: unknown): value is GameState {
  if (typeof value !== "object" || value === null) return false;
  const saved = value as Record<string, unknown>;
  return (
    typeof saved.playerCount === "number" &&
    missionSizeTable[saved.playerCount] !== undefined &&
    typeof saved.roleToggle === "object" && saved.roleToggle !== null &&
    Array.isArray(saved.missionSizes) &&
    typeof saved.currentMission === "number" &&
    Array.isArray(saved.missionResults) &&
    typeof saved.leaderIndex === "number" &&
    typeof saved.rejectStreak === "number" &&
    Array.isArray(saved.launchLog) &&
    Array.isArray(saved.pickedTeam) &&
    typeof saved.notes === "string" &&
    typeof saved.finished === "boolean"
  );
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
