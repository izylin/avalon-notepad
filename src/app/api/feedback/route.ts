import { NextResponse } from "next/server";

/** Feedback is collected as GitHub issues; credentials stay server-side. */

const MAX_BODY_BYTES = 3 * 1024 * 1024;
const MAX_MESSAGE_CHARS = 2000;
const MAX_CONTACT_CHARS = 120;
const RATE_LIMIT = { windowMs: 60_000, max: 3 };

const ALLOWED_IMAGE_TYPES = new Set(["image/webp", "image/png"]);

// 单实例内存限流：够挡住误触和手滑连点。Serverless 多实例下不可靠，
// 选定后端时需要换成共享存储（见 issue #26 的防刷讨论）。
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  if (recent.length >= RATE_LIMIT.max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  // 控制字符会污染日志/后续的 issue 正文，且对反馈内容没有意义。
  const trimmed = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function validScreenshot(dataUrl: unknown, mimeType: unknown) {
  if (dataUrl === null || dataUrl === undefined) return null;
  if (typeof dataUrl !== "string" || typeof mimeType !== "string") return null;
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) return null;
  if (!dataUrl.startsWith(`data:${mimeType};base64,`)) return null;
  return { dataUrl, base64: dataUrl.slice(`data:${mimeType};base64,`.length), mimeType };
}

function githubConfig() {
  const token = process.env.FEEDBACK_GITHUB_TOKEN;
  const repository = process.env.FEEDBACK_GITHUB_REPOSITORY;
  if (!token || !repository) return null;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) return null;
  return { token, repository, branch: process.env.FEEDBACK_GITHUB_BRANCH || "main" };
}

async function githubRequest(config: NonNullable<ReturnType<typeof githubConfig>>, path: string, init: RequestInit) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`GitHub 返回 ${response.status}`);
  return response;
}

function quote(value: string | null) {
  return value ? value.replace(/`/g, "\\`") : "（未提供）";
}

async function deliver(feedback: {
  message: string;
  contact: string | null;
  screenshot: ReturnType<typeof validScreenshot>;
  context: Record<string, string | null>;
}) {
  const config = githubConfig();
  if (!config) throw new Error("反馈服务尚未配置，请联系管理员。");

  let screenshotUrl: string | null = null;
  if (feedback.screenshot) {
    const extension = feedback.screenshot.mimeType === "image/webp" ? "webp" : "png";
    const path = `feedback-attachments/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${extension}`;
    const upload = await githubRequest(config, `/repos/${config.repository}/contents/${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `chore(feedback): add screenshot ${path.split("/").at(-1)}`,
        content: feedback.screenshot.base64,
        branch: config.branch
      })
    });
    const uploaded = await upload.json() as { content?: { download_url?: string } };
    screenshotUrl = uploaded.content?.download_url ?? `https://raw.githubusercontent.com/${config.repository}/${config.branch}/${path}`;
  }

  const title = `反馈：${feedback.message.replace(/\s+/g, " ").slice(0, 72)}`;
  const body = [
    "## 用户反馈",
    feedback.message,
    "## 联系方式",
    quote(feedback.contact),
    "## 截图",
    screenshotUrl ? `![用户标注截图](${screenshotUrl})` : "（未附截图）",
    "## 自动附带的上下文",
    `- 页面：\`${quote(feedback.context.screen)}\``,
    `- 路由：\`${quote(feedback.context.path)}\``,
    `- 版本：\`${quote(feedback.context.version)}\``,
    `- 视口：\`${quote(feedback.context.viewport)}\``,
    `- 主题：\`${quote(feedback.context.theme)}\``,
    `- 浏览器：\`${quote(feedback.context.userAgent)}\``,
    `- 客户端时间：\`${quote(feedback.context.at)}\``
  ].join("\n\n");

  await githubRequest(config, `/repos/${config.repository}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, labels: ["feedback"] })
  });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "提交太频繁，请稍后再试。" }, { status: 429 });
  }

  const raw = await req.text();
  // Blob 里每个字符都可能是多字节，用字节数而不是长度来卡上限。
  if (new Blob([raw]).size > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "内容过大，请减少标注或改用文字描述。" }, { status: 413 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "请求格式有误。" }, { status: 400 });
  }

  const message = clean(payload.message, MAX_MESSAGE_CHARS);
  if (!message) {
    return NextResponse.json({ error: "请填写问题描述。" }, { status: 400 });
  }

  const context = (payload.context ?? {}) as Record<string, unknown>;
  const screenshot = validScreenshot(payload.screenshot, payload.screenshotType);
  if (payload.screenshot && !screenshot) {
    return NextResponse.json({ error: "截图格式有误，请重新截取或只提交文字描述。" }, { status: 400 });
  }

  const feedback = {
    message,
    contact: clean(payload.contact, MAX_CONTACT_CHARS),
    screenshot,
    context: {
      screen: clean(context.screen, 40),
      path: clean(context.path, 200),
      theme: clean(context.theme, 10),
      viewport: clean(context.viewport, 20),
      userAgent: clean(context.userAgent, 300),
      version: clean(context.version, 60),
      at: clean(context.at, 40)
    }
  };

  try {
    await deliver(feedback);
  } catch (error) {
    console.error("[feedback] delivery failed", error);
    return NextResponse.json({ error: "暂时无法提交反馈，请稍后重试。" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
