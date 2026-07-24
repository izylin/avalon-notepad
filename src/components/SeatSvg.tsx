import { useEffect, useId, useRef, useState } from "react";
import { formatSeatLabel, seatCanvas, type IdentityTag, type SeatLayout, type SeatNames, type SeatPoint, type Vote } from "@/lib/game";

const longPressMs = 400;
// 长按判定期内允许的手指抖动；超过即视为滑动页面。
const longPressSlopPx = 8;
// 身份标签磁吸的命中半径（屏幕像素）。
const tagSnapRadiusPx = 46;

const roleAccent: Record<IdentityTag, string> = {
  merlin: "#78b7e6",
  percival: "#72c7d1",
  morgana: "#df252b",
  assassin: "#df6547",
  mordred: "#8270c9",
  oberon: "#e89a86"
};

function seatPositions(n: number, cx = 172, cy = 150, rx = 98, ry = 76) {
  const positions: Record<number, { x: number; y: number }> = { 1: { x: cx, y: cy + ry + 24 } };
  const others = n - 1;
  for (let i = 0; i < others; i++) {
    const angle = 200 - (220 / (others - 1 || 1)) * i;
    const rad = (angle * Math.PI) / 180;
    positions[2 + i] = { x: cx + rx * Math.cos(rad), y: cy - ry * Math.sin(rad) };
  }
  return positions;
}

function seatRadius(seat: number, selfSeat = 1) {
  return seat === selfSeat ? 26 : 24;
}

// 徽标环绕座位上方扇形展开：只有一个时居中在正上方，多个时对称分布。
function badgePosition(center: SeatPoint, seatR: number, index: number, count: number) {
  const spacingDeg = 34;
  const angleDeg = 90 + (index - (count - 1) / 2) * spacingDeg;
  const rad = (angleDeg * Math.PI) / 180;
  const dist = seatR + 13;
  return { x: center.x + dist * Math.cos(rad), y: center.y - dist * Math.sin(rad) };
}

function toSvgPoint(svg: SVGSVGElement | null, source: { clientX: number; clientY: number }): SeatPoint | null {
  const ctm = svg?.getScreenCTM();
  if (!ctm) return null;
  const point = new DOMPoint(source.clientX, source.clientY).matrixTransform(ctm.inverse());
  return { x: point.x, y: point.y };
}

function toScreenPoint(svg: SVGSVGElement | null, point: SeatPoint): { x: number; y: number } | null {
  const ctm = svg?.getScreenCTM();
  if (!ctm) return null;
  const transformed = new DOMPoint(point.x, point.y).matrixTransform(ctm);
  return { x: transformed.x, y: transformed.y };
}

// 座位连同外圈身份光环整体留在画布内，否则拖到边缘会被 viewBox 裁掉。
function clampToCanvas(point: SeatPoint, seat: number, selfSeat = 1): SeatPoint {
  const margin = seatRadius(seat, selfSeat) + 11;
  return {
    x: Math.min(Math.max(point.x, margin), seatCanvas.width - margin),
    y: Math.min(Math.max(point.y, margin), seatCanvas.height - margin)
  };
}

export function SeatSvg({
  n,
  leaderSeat,
  teamSeats,
  voteMap = {},
  identityTags = {},
  selfSeat = 1,
  seatNames = {},
  onSeatClick,
  captionTop,
  captionBottom,
  seatLayout,
  editing = false,
  onSeatMove,
  onTagDragStart,
  dragPoint,
  onSnapSeatChange,
  tourTarget
}: {
  n: number;
  leaderSeat: number;
  teamSeats: number[];
  voteMap?: Record<number, Vote>;
  identityTags?: Record<number, IdentityTag[]>;
  selfSeat?: number;
  seatNames?: SeatNames;
  onSeatClick?: (seat: number) => void;
  captionTop: string;
  captionBottom: string;
  seatLayout?: SeatLayout;
  editing?: boolean;
  onSeatMove?: (seat: number, point: SeatPoint) => void;
  onTagDragStart?: (seat: number, tag: IdentityTag, event: React.PointerEvent) => void;
  dragPoint?: { x: number; y: number } | null;
  onSnapSeatChange?: (seat: number | null) => void;
  tourTarget?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ seat: number; point: SeatPoint } | null>(null);
  const [snapSeat, setSnapSeat] = useState<number | null>(null);
  const dragRef = useRef<{ seat: number; point: SeatPoint } | null>(null);
  const pending = useRef<{ timer: number; x: number; y: number; unlisten: () => void } | null>(null);
  const draggedRef = useRef(false);
  const dragCleanup = useRef<(() => void) | null>(null);
  const onSeatMoveRef = useRef(onSeatMove);
  const onSnapSeatChangeRef = useRef(onSnapSeatChange);
  const pos = { ...seatPositions(n), ...seatLayout };
  if (drag) pos[drag.seat] = drag.point;
  const hasCustomLayout = Object.keys(seatLayout ?? {}).length > 0;
  const svgId = useId().replace(/\W/g, "");
  const movable = Boolean(onSeatMove);

  useEffect(() => {
    onSeatMoveRef.current = onSeatMove;
    onSnapSeatChangeRef.current = onSnapSeatChange;
  });

  // 拖拽身份标签时，实时算出离指针最近且在磁吸半径内的座位。这个计算依赖
  // svgRef.current（座位的屏幕坐标要通过 SVG 的变换矩阵换算），只能在
  // effect 里读取，没法在渲染期间直接算出来。
  useEffect(() => {
    if (!dragPoint) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnapSeat(null);
      onSnapSeatChangeRef.current?.(null);
      return;
    }
    let nearestSeat: number | null = null;
    let nearestDist = Infinity;
    for (let seat = 1; seat <= n; seat++) {
      const svgPoint = pos[seat];
      if (!svgPoint) continue;
      const screenPoint = toScreenPoint(svgRef.current, svgPoint);
      if (!screenPoint) continue;
      const dist = Math.hypot(dragPoint.x - screenPoint.x, dragPoint.y - screenPoint.y);
      if (dist <= tagSnapRadiusPx && dist < nearestDist) {
        nearestDist = dist;
        nearestSeat = seat;
      }
    }
    setSnapSeat(nearestSeat);
    onSnapSeatChangeRef.current?.(nearestSeat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragPoint?.x, dragPoint?.y, n]);

  // 卸载时清掉待定的长按计时器和进行中的拖动，两者都持有 window 监听。
  useEffect(() => () => {
    if (pending.current) {
      clearTimeout(pending.current.timer);
      pending.current.unlisten();
      pending.current = null;
    }
    dragCleanup.current?.();
    dragCleanup.current = null;
  }, []);

  function cancelPending() {
    if (!pending.current) return;
    clearTimeout(pending.current.timer);
    pending.current.unlisten();
    pending.current = null;
  }

  // 监听在拖动开始的同一个同步调用里挂上：若改用 effect 订阅，
  // startDrag 到订阅生效之间存在空窗，落在其中的 pointermove 会丢失。
  function startDrag(seat: number, source: { clientX: number; clientY: number }) {
    const point = toSvgPoint(svgRef.current, source);
    if (!point) return;
    const first = { seat, point: clampToCanvas(point, seat, selfSeat) };
    dragRef.current = first;
    setDrag(first);

    function onMove(event: PointerEvent) {
      const moved = toSvgPoint(svgRef.current, event);
      if (!moved) return;
      const next = { seat, point: clampToCanvas(moved, seat, selfSeat) };
      dragRef.current = next;
      setDrag(next);
    }
    function onEnd() {
      const committed = dragRef.current;
      dragCleanup.current?.();
      dragCleanup.current = null;
      dragRef.current = null;
      setDrag(null);
      if (committed) onSeatMoveRef.current?.(committed.seat, committed.point);
    }

    dragCleanup.current?.();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    dragCleanup.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }

  function handlePointerDown(seat: number, event: React.PointerEvent) {
    if (!movable) return;
    if (editing) {
      event.preventDefault();
      startDrag(seat, event);
      return;
    }
    // 非编辑模式：长按才进入拖动，短按仍然是选人/投票。
    const { clientX, clientY } = event;
    cancelPending();

    // 待定阶段同样监听 window：手指按下后滑出座位再松开时，
    // 座位自身收不到 pointerup，计时器会照常触发出一个幽灵拖拽。
    function onPendingMove(moveEvent: PointerEvent) {
      const wait = pending.current;
      if (wait && Math.hypot(moveEvent.clientX - wait.x, moveEvent.clientY - wait.y) > longPressSlopPx) {
        cancelPending();
      }
    }
    function onPendingEnd() {
      cancelPending();
    }
    function unlisten() {
      window.removeEventListener("pointermove", onPendingMove);
      window.removeEventListener("pointerup", onPendingEnd);
      window.removeEventListener("pointercancel", onPendingEnd);
    }
    window.addEventListener("pointermove", onPendingMove);
    window.addEventListener("pointerup", onPendingEnd);
    window.addEventListener("pointercancel", onPendingEnd);

    pending.current = {
      x: clientX,
      y: clientY,
      unlisten,
      timer: window.setTimeout(() => {
        unlisten();
        pending.current = null;
        draggedRef.current = true;
        startDrag(seat, { clientX, clientY });
      }, longPressMs)
    };
  }

  return (
    <div className="seat-svg-wrap" data-tour={tourTarget}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${seatCanvas.width} ${seatCanvas.height}`}
        className={editing ? "seat-svg seat-svg-editing" : "seat-svg"}
        style={{ display: "block", width: "100%" }}
      >
        <defs>
          <clipPath id={`${svgId}-badge-clip`}>
            <circle cx="9" cy="9" r="9" />
          </clipPath>
        </defs>
        {/* 默认圆桌轮廓正好穿过默认座位；自定义排布后它不再贴合，反而误导。 */}
        {hasCustomLayout ? null : (
          <ellipse cx="172" cy="150" rx="98" ry="76" fill="none" stroke="var(--line-gold)" strokeWidth="1.8" />
        )}
        <ellipse cx="172" cy="150" rx="50" ry="38" fill="var(--panel)" stroke="var(--line-gold)" strokeWidth="1.2" />
        <text fontSize="11" x="172" y="146" textAnchor="middle" fill="var(--muted)">{captionTop}</text>
        <text fontSize="11" x="172" y="159" textAnchor="middle" fill="var(--muted)">{captionBottom}</text>
        {Array.from({ length: n }, (_, i) => i + 1).map((seat) => {
          const p = pos[seat];
          const isMe = seat === selfSeat;
          const label = formatSeatLabel(seat, selfSeat, seatNames, false);
          const onTeam = teamSeats.includes(seat);
          const isLeader = seat === leaderSeat;
          const tags = identityTags[seat] ?? [];
          const vote = voteMap[seat];
          // 编辑座位图时不接受点击，否则拖动会顺带改掉上车名单或投票。
          const clickable = Boolean(onSeatClick) && !editing;
          const r = seatRadius(seat, selfSeat);
          const fill = vote === "agree" ? "var(--blue)" : vote === "reject" ? "var(--red)" : onTeam ? "var(--gold)" : "var(--panel-raised)";
          const stroke = vote ? "var(--gold-bright)" : onTeam ? "var(--gold-bright)" : isMe ? "var(--muted)" : "var(--line)";
          const textFill = vote || onTeam ? "var(--gold-ink)" : "var(--muted)";
          return (
            <g
              key={seat}
              className={movable ? "seat-node" : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              style={editing ? { cursor: drag?.seat === seat ? "grabbing" : "grab" } : clickable ? { cursor: "pointer" } : undefined}
              onClick={clickable ? () => {
                // 长按拖动结束后浏览器仍会补一次 click，这里吞掉它。
                if (draggedRef.current) {
                  draggedRef.current = false;
                  return;
                }
                onSeatClick?.(seat);
              } : undefined}
              onKeyDown={clickable ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSeatClick?.(seat);
                }
              } : undefined}
              onPointerDown={movable ? (event) => handlePointerDown(seat, event) : undefined}
            >
              <g data-seat={seat}>
                {onTeam ? (
                  <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={r * 0.45} fill={fill} stroke={stroke} strokeWidth={isMe || vote ? 2.5 : 1.8} />
                ) : (
                  <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={stroke} strokeWidth={isMe || vote ? 2.5 : 1.3} />
                )}
                {isLeader ? (
                  onTeam ? (
                    <rect x={p.x - r - 8} y={p.y - r - 8} width={(r + 8) * 2} height={(r + 8) * 2} rx={r * 0.45 + 8} fill="none" stroke="var(--gold-bright)" strokeWidth="2" />
                  ) : (
                    <circle cx={p.x} cy={p.y} r={r + 8} fill="none" stroke="var(--gold-bright)" strokeWidth="2" />
                  )
                ) : null}
                {seat === snapSeat ? (
                  <circle cx={p.x} cy={p.y} r={r + 16} fill="none" stroke="var(--gold-bright)" strokeWidth="2.4" strokeDasharray="3 4" className="seat-snap-ring" />
                ) : null}
                <text fontSize={label.length > 1 ? 12 : isMe ? 13 : 15} fontWeight="700" x={p.x} y={p.y + 5} textAnchor="middle" fill={textFill}>{label}</text>
                {isLeader ? <text fontSize="11" fontWeight="700" x={p.x} y={p.y + r + 19} textAnchor="middle" fill="var(--red)">队长</text> : null}
              </g>
              {tags.map((tag, index) => {
                const bp = badgePosition(p, r, index, tags.length);
                const draggableBadge = Boolean(onTagDragStart);
                return (
                  <g
                    key={tag}
                    style={draggableBadge ? { cursor: "grab" } : undefined}
                    onPointerDown={draggableBadge ? (event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      onTagDragStart?.(seat, tag, event);
                    } : undefined}
                  >
                    <circle cx={bp.x} cy={bp.y} r="9.5" fill="var(--panel)" />
                    <g transform={`translate(${bp.x - 9} ${bp.y - 9})`}>
                      <image href={`/roles/${tag}.png`} x="0" y="0" width="18" height="18" clipPath={`url(#${svgId}-badge-clip)`} />
                    </g>
                    <circle cx={bp.x} cy={bp.y} r="9.5" fill="none" stroke={roleAccent[tag]} strokeWidth="1.4" />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
