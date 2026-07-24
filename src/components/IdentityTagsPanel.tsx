import Image from "next/image";
import { formatSeatLabel, roleKeys, roles, type GameState, type IdentityTag } from "@/lib/game";

export function IdentityTagsPanel({
  state,
  activeTags,
  selectedTag,
  onSelect
}: {
  state: GameState;
  activeTags: Record<number, IdentityTag>;
  selectedTag: IdentityTag | null;
  onSelect: (tag: IdentityTag | null) => void;
}) {
  const enabledRoles = roleKeys.filter((key) => state.roleToggle[key]);
  const taggedSeatsByRole = enabledRoles.reduce<Record<string, string>>((acc, key) => {
    const seats = Object.entries(activeTags)
      .filter(([, tag]) => tag === key)
      .map(([seat]) => formatSeatLabel(Number(seat), state.selfSeat, state.seatNames, false));
    if (seats.length) acc[key] = seats.join(",");
    return acc;
  }, {});

  return (
    <div className="identity-panel" data-tour="identity-tags">
      <div className="section-title"><h3>身份标签</h3><span className="tag blue">{selectedTag ? "点击座位标记" : "从当前任务起生效"}</span></div>
      <div className="identity-rail" aria-label="选择身份标签">
        {enabledRoles.map((key) => (
          <button
            key={key}
            type="button"
            className={`identity-token ${selectedTag === key ? "selected" : ""} ${taggedSeatsByRole[key] ? "assigned" : ""}`}
            onClick={() => onSelect(selectedTag === key ? null : key)}
            title={roles[key].name}
            aria-pressed={selectedTag === key}
          >
            <Image className="role-portrait" src={`/roles/${key}.png`} alt="" width={36} height={36} unoptimized />
            <strong>{roles[key].name}</strong>
            {taggedSeatsByRole[key] ? <em>{taggedSeatsByRole[key]}</em> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
