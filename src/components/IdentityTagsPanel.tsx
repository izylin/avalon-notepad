import Image from "next/image";
import { formatSeatLabel, roleKeys, roles, type GameState, type IdentityTag } from "@/lib/game";

export function IdentityTagsPanel({
  state,
  activeTags,
  draggingTag,
  onTagDragStart
}: {
  state: GameState;
  activeTags: Record<number, IdentityTag[]>;
  draggingTag?: IdentityTag | null;
  onTagDragStart: (tag: IdentityTag, event: React.PointerEvent) => void;
}) {
  const enabledRoles = roleKeys.filter((key) => state.roleToggle[key]);
  const taggedSeatsByRole = enabledRoles.reduce<Record<string, string>>((acc, key) => {
    const seats = Object.entries(activeTags)
      .filter(([, tags]) => tags.includes(key))
      .map(([seat]) => formatSeatLabel(Number(seat), state.selfSeat, state.seatNames, false));
    if (seats.length) acc[key] = seats.join(",");
    return acc;
  }, {});

  return (
    <div className="identity-panel" data-tour="identity-tags">
      <div className="section-title"><h3>身份标签</h3><span className="tag blue">拖到座位上磁吸标记，每位最多 3 个</span></div>
      <div className="identity-rail" aria-label="拖拽身份标签到座位">
        {enabledRoles.map((key) => (
          <button
            key={key}
            type="button"
            className={`identity-token ${draggingTag === key ? "dragging" : ""} ${taggedSeatsByRole[key] ? "assigned" : ""}`}
            onPointerDown={(event) => {
              event.preventDefault();
              onTagDragStart(key, event);
            }}
            title={roles[key].name}
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
