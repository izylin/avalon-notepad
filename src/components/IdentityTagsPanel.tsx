import type { GameState, IdentityTag } from "@/lib/game";

export function IdentityTagsPanel({
  state,
  activeTags,
  onToggle
}: {
  state: GameState;
  activeTags: Record<number, IdentityTag>;
  onToggle: (seat: number, tag: IdentityTag) => void;
}) {
  return (
    <div className="identity-panel">
      <div className="section-title"><h3>身份标签</h3><span className="tag blue">从当前任务起生效</span></div>
      <div className="identity-grid">
        {Array.from({ length: state.playerCount }, (_, i) => i + 1).map((seat) => (
          <button
            key={seat}
            type="button"
            className={`identity-pick ${activeTags[seat] === "percival" ? "tagged" : ""}`}
            onClick={() => onToggle(seat, "percival")}
          >
            <span>{seat === 1 ? "我" : `${seat}号`}</span>
            {activeTags[seat] === "percival" ? <strong>🛡️</strong> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
