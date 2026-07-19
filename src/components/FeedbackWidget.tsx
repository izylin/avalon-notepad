"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { AnnotationCanvas, type AnnotationHandle, type AnnotationTool } from "./AnnotationCanvas";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

const TOOLS: { id: AnnotationTool; label: string; hint: string }[] = [
  { id: "rect", label: "方框", hint: "框出问题区域" },
  { id: "arrow", label: "箭头", hint: "指向问题位置" },
  { id: "pen", label: "画笔", hint: "自由圈画" },
  { id: "mask", label: "遮盖", hint: "涂掉不想上传的内容" }
];

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("截图解码失败"));
    img.src = dataUrl;
  });
}

export function FeedbackWidget({ screen }: { screen: string }) {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [shot, setShot] = useState<HTMLImageElement | null>(null);
  const [shotError, setShotError] = useState<string | null>(null);
  const [tool, setTool] = useState<AnnotationTool>("rect");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const annotation = useRef<AnnotationHandle>(null);

  async function capture() {
    setCapturing(true);
    setShotError(null);
    // html-to-image copies computed styles (animation-* included) onto its clone, and the clone is
    // rasterised at t=0. Anything mid-animation — or animating from opacity 0, like .screen's fadeIn —
    // would otherwise be captured blank. Pin everything to its settled state for the duration.
    const freeze = document.createElement("style");
    freeze.textContent = "*, *::before, *::after { animation: none !important; transition: none !important; }";
    try {
      document.head.appendChild(freeze);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const dataUrl = await toPng(document.body, {
        // The widget must not appear inside the screenshot of the page it is reporting on.
        filter: (node) => !(node instanceof HTMLElement && node.dataset.feedbackRoot === "true"),
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        backgroundColor: getComputedStyle(document.body).backgroundColor
      });
      setShot(await loadImage(dataUrl));
    } catch {
      setShotError("截图失败，你仍然可以只提交文字描述。");
      setShot(null);
    } finally {
      freeze.remove();
      setCapturing(false);
    }
  }

  async function openPanel() {
    setStatus({ kind: "idle" });
    await capture();
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    setShot(null);
    setShotError(null);
    setMessage("");
    setContact("");
    setTool("rect");
    setStatus({ kind: "idle" });
  }

  async function submit() {
    if (!message.trim()) return;
    setStatus({ kind: "sending" });
    try {
      const image = shot ? await annotation.current?.export() : null;
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          contact: contact.trim() || null,
          screenshot: image?.dataUrl ?? null,
          screenshotType: image?.mimeType ?? null,
          context: {
            screen,
            path: window.location.pathname,
            theme: document.documentElement.dataset.theme ?? "dark",
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            userAgent: navigator.userAgent,
            version: process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev",
            at: new Date().toISOString()
          }
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `提交失败（${res.status}）`);
      }
      setStatus({ kind: "sent" });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "提交失败，请重试。" });
    }
  }

  return (
    <div data-feedback-root="true">
      {!open && (
        <button className="fb-fab" onClick={openPanel} disabled={capturing} aria-label="反馈问题">
          {capturing ? "…" : "反馈"}
        </button>
      )}

      {open && (
        <div className="fb-overlay" role="dialog" aria-modal="true" aria-label="提交反馈">
          <div className="fb-panel">
            <div className="fb-head">
              <h3>反馈问题</h3>
              <button className="fb-close" onClick={closePanel} aria-label="关闭">✕</button>
            </div>

            {status.kind === "sent" ? (
              <div className="fb-done">
                <strong>反馈已收到</strong>
                <p>谢谢，我们会尽快看。</p>
                <button className="fb-primary" onClick={closePanel}>关闭</button>
              </div>
            ) : (
              <>
                <div className="fb-body">
                  {shot && (
                    <>
                      <div className="fb-tools">
                        {TOOLS.map((t) => (
                          <button
                            key={t.id}
                            className={`fb-tool${tool === t.id ? " is-on" : ""}`}
                            onClick={() => setTool(t.id)}
                            title={t.hint}
                          >
                            {t.label}
                          </button>
                        ))}
                        <span className="fb-tools-gap" />
                        <button className="fb-tool" onClick={() => annotation.current?.undo()}>撤销</button>
                        <button className="fb-tool" onClick={() => annotation.current?.clear()}>清空</button>
                      </div>
                      <div className="fb-shot">
                        <AnnotationCanvas image={shot} tool={tool} handleRef={annotation} />
                      </div>
                      <p className="fb-note">在截图上圈出问题。用「遮盖」抹掉你不想上传的内容。</p>
                    </>
                  )}

                  {shotError && <p className="fb-warn">{shotError}</p>}

                  <label className="fb-label" htmlFor="fb-message">问题描述</label>
                  <textarea
                    id="fb-message"
                    className="fb-input"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="遇到了什么问题？或者你希望我们做什么？"
                  />

                  <label className="fb-label" htmlFor="fb-contact">联系方式（选填）</label>
                  <input
                    id="fb-contact"
                    className="fb-input"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="微信 / 邮箱，方便我们追问"
                  />

                  <p className="fb-note">
                    将随反馈一起上传：{shot ? "你标注后的截图、" : ""}当前页面、浏览器与屏幕信息、主题、时间。
                    不会上传玩家昵称与身份。
                  </p>
                </div>

                <div className="fb-foot">
                  {status.kind === "error" && <span className="fb-error">{status.message}</span>}
                  <button className="fb-ghost" onClick={closePanel}>取消</button>
                  <button
                    className="fb-primary"
                    onClick={submit}
                    disabled={!message.trim() || status.kind === "sending"}
                  >
                    {status.kind === "sending" ? "提交中…" : status.kind === "error" ? "重试" : "提交"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
