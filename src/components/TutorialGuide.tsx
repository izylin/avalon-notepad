"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type TutorialStep = {
  selector: string;
  title: string;
  description: string;
};

type SpotlightRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const spotlightPadding = 8;
const tooltipGap = 18;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function TutorialGuide({
  open,
  steps,
  onClose
}: {
  open: boolean;
  steps: TutorialStep[];
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 344, height: 218 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const step = steps[stepIndex];


  useEffect(() => {
    if (!open || !step) return;
    let frame = 0;
    let delayedFrame = 0;

    function updateRect() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(step.selector);
        if (!target) {
          setRect(null);
          return;
        }
        const next = target.getBoundingClientRect();
        setRect({
          top: next.top,
          left: next.left,
          right: next.right,
          bottom: next.bottom,
          width: next.width,
          height: next.height
        });
      });
    }

    const target = document.querySelector<HTMLElement>(step.selector);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
    updateRect();
    delayedFrame = window.setTimeout(updateRect, 280) as unknown as number;

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(delayedFrame);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open || !tooltipRef.current) return;
    const element = tooltipRef.current;
    const update = () => {
      const measured = element.getBoundingClientRect();
      setTooltipSize({ width: measured.width, height: measured.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, stepIndex]);

  const finishTour = useCallback(() => {
    setStepIndex(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        finishTour();
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        if (stepIndex === steps.length - 1) finishTour();
        else setStepIndex((index) => Math.min(index + 1, steps.length - 1));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStepIndex((index) => Math.max(index - 1, 0));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finishTour, open, stepIndex, steps.length]);

  const layout = useMemo(() => {
    if (typeof window === "undefined") return null;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(tooltipSize.width, viewportWidth - 32);

    if (!rect) {
      return {
        left: Math.max(16, (viewportWidth - width) / 2),
        top: Math.max(16, (viewportHeight - tooltipSize.height) / 2),
        placement: "center" as const,
        arrowLeft: width / 2
      };
    }

    const roomBelow = viewportHeight - rect.bottom;
    const roomAbove = rect.top;
    const placement = roomBelow >= tooltipSize.height + tooltipGap + 16 || roomBelow >= roomAbove ? "below" : "above";
    const left = clamp(rect.left + rect.width / 2 - width / 2, 16, Math.max(16, viewportWidth - width - 16));
    const desiredTop = placement === "below"
      ? rect.bottom + tooltipGap
      : rect.top - tooltipSize.height - tooltipGap;
    const top = clamp(desiredTop, 16, Math.max(16, viewportHeight - tooltipSize.height - 16));
    return {
      left,
      top,
      placement,
      arrowLeft: clamp(rect.left + rect.width / 2 - left, 24, width - 24)
    };
  }, [rect, tooltipSize]);

  if (typeof document === "undefined" || !open || !step || !layout) return null;

  const padded = rect ? {
    top: Math.max(0, rect.top - spotlightPadding),
    left: Math.max(0, rect.left - spotlightPadding),
    right: Math.min(window.innerWidth, rect.right + spotlightPadding),
    bottom: Math.min(window.innerHeight, rect.bottom + spotlightPadding)
  } : null;

  return createPortal(
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="新手操作指引">
      {padded ? (
        <>
          <div className="tour-shade" style={{ inset: `0 0 auto 0`, height: padded.top }} />
          <div className="tour-shade" style={{ top: padded.top, left: 0, width: padded.left, height: padded.bottom - padded.top }} />
          <div className="tour-shade" style={{ top: padded.top, left: padded.right, right: 0, height: padded.bottom - padded.top }} />
          <div className="tour-shade" style={{ top: padded.bottom, right: 0, bottom: 0, left: 0 }} />
          <div
            className="tour-spotlight"
            style={{
              top: padded.top,
              left: padded.left,
              width: padded.right - padded.left,
              height: padded.bottom - padded.top
            }}
          />
          <div
            className="tour-spotlight-blocker"
            style={{
              top: padded.top,
              left: padded.left,
              width: padded.right - padded.left,
              height: padded.bottom - padded.top
            }}
          />
        </>
      ) : <div className="tour-shade tour-shade-full" />}

      <div
        ref={tooltipRef}
        className={`tour-card tour-card-${layout.placement}`}
        style={{ left: layout.left, top: layout.top }}
      >
        {layout.placement !== "center" && (
          <span className="tour-arrow" style={{ left: layout.arrowLeft }} aria-hidden="true" />
        )}
        <div className="tour-card-head">
          <span className="tour-kicker">操作指引 · {stepIndex + 1}/{steps.length}</span>
          <button className="tour-close" type="button" aria-label="关闭指引" onClick={finishTour}>×</button>
        </div>
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        <div className="tour-progress" aria-hidden="true">
          {steps.map((_, index) => <i key={index} className={index === stepIndex ? "active" : ""} />)}
        </div>
        <div className="tour-actions">
          <button className="tour-skip" type="button" onClick={finishTour}>跳过</button>
          <div>
            <button className="ghost-btn tour-nav-btn" type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}>上一步</button>
            <button
              className="primary-btn tour-nav-btn"
              type="button"
              onClick={() => stepIndex === steps.length - 1 ? finishTour() : setStepIndex((index) => Math.min(steps.length - 1, index + 1))}
            >
              {stepIndex === steps.length - 1 ? "完成" : "下一步"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
