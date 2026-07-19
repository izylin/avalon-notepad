"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";

export type AnnotationTool = "rect" | "arrow" | "pen" | "mask";

type Point = { x: number; y: number };

type BoxShape = { tool: "rect" | "arrow" | "mask"; from: Point; to: Point };
type PenShape = { tool: "pen"; points: Point[] };
type Shape = BoxShape | PenShape;

export type AnnotationHandle = {
  undo: () => void;
  clear: () => void;
  isEmpty: () => boolean;
  /** Flattens the screenshot plus annotations into a single encoded image. */
  export: () => Promise<{ dataUrl: string; mimeType: string } | null>;
};

const STROKE = "#ff3b30";
const MASK_FILL = "#101010";
/** Keeps the uploaded image small enough for the request body cap in /api/feedback. */
const MAX_EXPORT_EDGE = 1600;

function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, width: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const head = Math.max(width * 3.2, Math.min(len * 0.32, width * 7));
  const angle = Math.atan2(dy, dx);
  const spread = Math.PI / 7;
  // Stop the shaft short of the tip so the head reads as solid rather than crossed by the line.
  const shaftEnd = { x: to.x - Math.cos(angle) * head * 0.72, y: to.y - Math.sin(angle) * head * 0.72 };

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(shaftEnd.x, shaftEnd.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - Math.cos(angle - spread) * head, to.y - Math.sin(angle - spread) * head);
  ctx.lineTo(to.x - Math.cos(angle + spread) * head, to.y - Math.sin(angle + spread) * head);
  ctx.closePath();
  ctx.fill();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, width: number) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = STROKE;
  ctx.fillStyle = STROKE;

  if (shape.tool === "pen") {
    ctx.beginPath();
    shape.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    return;
  }

  if (shape.tool === "mask") {
    // Opaque fill, not blur: the covered pixels must not survive into the export at all.
    ctx.fillStyle = MASK_FILL;
    ctx.fillRect(
      Math.min(shape.from.x, shape.to.x),
      Math.min(shape.from.y, shape.to.y),
      Math.abs(shape.to.x - shape.from.x),
      Math.abs(shape.to.y - shape.from.y)
    );
    return;
  }

  if (shape.tool === "rect") {
    ctx.strokeRect(
      Math.min(shape.from.x, shape.to.x),
      Math.min(shape.from.y, shape.to.y),
      Math.abs(shape.to.x - shape.from.x),
      Math.abs(shape.to.y - shape.from.y)
    );
    return;
  }

  drawArrow(ctx, shape.from, shape.to, width);
}

async function encode(canvas: HTMLCanvasElement) {
  const webp = canvas.toDataURL("image/webp", 0.85);
  // Safari <16 silently falls back to PNG here, so trust the prefix rather than the requested type.
  if (webp.startsWith("data:image/webp")) return { dataUrl: webp, mimeType: "image/webp" };
  return { dataUrl: canvas.toDataURL("image/png"), mimeType: "image/png" };
}

export function AnnotationCanvas({
  image,
  tool,
  handleRef
}: {
  image: HTMLImageElement;
  tool: AnnotationTool;
  handleRef: RefObject<AnnotationHandle | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);

  // Scale strokes to the screenshot's own pixel size so they look the same on a phone and a desktop capture.
  const strokeWidth = Math.max(2, Math.round(Math.max(image.width, image.height) / 320));

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const shape of shapes) drawShape(ctx, shape, strokeWidth);
    if (draft) drawShape(ctx, draft, strokeWidth);
  }, [image, shapes, draft, strokeWidth]);

  useEffect(redraw, [redraw]);

  useImperativeHandle(handleRef, () => ({
    undo: () => setShapes((cur) => cur.slice(0, -1)),
    clear: () => setShapes([]),
    isEmpty: () => shapes.length === 0,
    export: async () => {
      const scale = Math.min(1, MAX_EXPORT_EDGE / Math.max(image.width, image.height));
      const out = document.createElement("canvas");
      out.width = Math.round(image.width * scale);
      out.height = Math.round(image.height * scale);
      const ctx = out.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(image, 0, 0, out.width, out.height);
      ctx.scale(scale, scale);
      for (const shape of shapes) drawShape(ctx, shape, strokeWidth);
      return encode(out);
    }
  }), [image, shapes, strokeWidth]);

  function toImageSpace(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * image.width,
      y: ((e.clientY - rect.top) / rect.height) * image.height
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = toImageSpace(e);
    setDraft(tool === "pen" ? { tool: "pen", points: [at] } : { tool, from: at, to: at });
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!draft) return;
    const at = toImageSpace(e);
    setDraft(draft.tool === "pen" ? { tool: "pen", points: [...draft.points, at] } : { ...draft, to: at });
  }

  function onPointerUp() {
    if (!draft) return;
    // Drop taps that never became a shape, so a stray click doesn't add an invisible entry to the undo stack.
    const meaningful =
      draft.tool === "pen"
        ? draft.points.length > 1
        : Math.hypot(draft.to.x - draft.from.x, draft.to.y - draft.from.y) > strokeWidth * 2;
    if (meaningful) setShapes((cur) => [...cur, draft]);
    setDraft(null);
  }

  return (
    <canvas
      ref={canvasRef}
      className="fb-canvas"
      width={image.width}
      height={image.height}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
