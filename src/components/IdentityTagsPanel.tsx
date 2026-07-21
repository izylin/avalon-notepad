import { roleKeys, roles, type GameState, type IdentityTag } from "@/lib/game";

function RoleSymbol({ role }: { role: IdentityTag }) {
  return (
    <svg className="role-symbol" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" className="symbol-disc" />
      {role === "merlin" ? (
        <>
          <path d="M20 7l8 10-8 16-8-16z" className="symbol-fill" />
          <path d="M12 17h16M16 17l4 16 4-16M20 7v26" className="symbol-line" />
          <path d="M30 7l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" className="symbol-accent" />
        </>
      ) : role === "percival" ? (
        <>
          <path d="M20 7l12 5v8c0 7-4.4 11.5-12 14-7.6-2.5-12-7-12-14v-8z" className="symbol-fill" />
          <path d="M20 10v20M12 15h16" className="symbol-line" />
        </>
      ) : role === "morgana" ? (
        <>
          <path d="M10 17c4-6 16-6 20 0v8c-4 5-16 5-20 0z" className="symbol-fill" />
          <path d="M14 21c2-2 5-2 7 0M26 21c-2-2-5-2-7 0M20 24c-1.4 2.8-3.5 4.6-6.4 5.4M20 24c1.4 2.8 3.5 4.6 6.4 5.4" className="symbol-line" />
          <path d="M27 7.5a7.5 7.5 0 1 0 0 11.5 9.5 9.5 0 1 1 0-11.5z" className="symbol-accent" />
        </>
      ) : role === "assassin" ? (
        <>
          <path d="M24 6l7 7-13 16-5 2 2-5z" className="symbol-fill" />
          <path d="M21 9l10 10M12 30l-3 3M25 12L14 27" className="symbol-line" />
        </>
      ) : role === "mordred" ? (
        <>
          <path d="M9 22l4-12 7-4 7 4 4 12-4 9H13z" className="symbol-fill" />
          <path d="M13 22h14M20 7v24M13 31h14M15 14l5-3 5 3" className="symbol-line" />
          <path d="M13 10l7-5 7 5-2 4-5-3-5 3z" className="symbol-accent" />
        </>
      ) : (
        <>
          <path d="M20 34c-7-5-9-12-5-18 5 2 7 6 5 18zM20 34c7-5 9-12 5-18-5 2-7 6-5 18z" className="symbol-fill" />
          <path d="M20 8v26M14 14c-3.5-.3-5.8-2.3-7-6 4.8 0 8.2 1.8 10.2 5.5M26 14c3.5-.3 5.8-2.3 7-6-4.8 0-8.2 1.8-10.2 5.5" className="symbol-line" />
          <path d="M16 12c2.7-4.5 5.3-4.5 8 0" className="symbol-accent" />
        </>
      )}
    </svg>
  );
}

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
      .map(([seat]) => seat === "1" ? "我" : seat);
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
            className={`identity-token role-${key} ${selectedTag === key ? "selected" : ""} ${taggedSeatsByRole[key] ? "assigned" : ""}`}
            onClick={() => onSelect(selectedTag === key ? null : key)}
            title={roles[key].name}
            aria-pressed={selectedTag === key}
          >
            <RoleSymbol role={key} />
            <strong>{roles[key].name}</strong>
            {taggedSeatsByRole[key] ? <em>{taggedSeatsByRole[key]}</em> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
