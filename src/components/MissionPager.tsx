import type { GameState } from "@/lib/game";

export function MissionPager({
  state,
  selectedMissionIndex,
  onSelect
}: {
  state: GameState;
  selectedMissionIndex: number;
  onSelect: (missionIndex: number | null) => void;
}) {
  return (
    <div className="mission-pager">
      {state.missionResults.map((result, i) => {
        const isLiveMission = i === state.currentMission && !state.finished;
        const canOpen = Boolean(result) || isLiveMission;
        return (
          <button
            key={i}
            type="button"
            disabled={!canOpen}
            className={`pager-tab ${result === "good" ? "good-win" : ""} ${result === "bad" ? "bad-win" : ""} ${i === selectedMissionIndex ? "active" : ""}`}
            onClick={() => onSelect(isLiveMission ? null : i)}
          >
            <strong>任务 {i + 1}</strong>{result === "good" ? "好人成功" : result === "bad" ? "坏人成功" : "未发车"}
          </button>
        );
      })}
    </div>
  );
}
