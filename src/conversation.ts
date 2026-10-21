/** 解析从 AI 网页复制出来的对话文本。纯函数，便于单测。
 *  支持：
 *  - Markdown 标题：## User / ## 用户 / ## Assistant / ## 助手
 *  - 粗体角色：**User** / **Assistant**
 *  - 行首角色：User: ... / 用户：... / Assistant: ...
 *  无法识别角色时，整段作为一条 unknown 记录保存。 */

export type Role = "user" | "assistant" | "unknown"

export interface ChatMessage {
  role: Role
  text: string
}

const ROLE_NAMES: Record<string, Role> = {
  user: "user",
  "用户": "user",
  you: "user",
  human: "user",
  "我": "user",
  assistant: "assistant",
  ai: "assistant",
  deepseek: "assistant",
  "助手": "assistant",
  bot: "assistant",
}

const ROLE_PATTERN = "user|用户|you|human|我|assistant|ai|deepseek|助手|bot"

function roleOf(raw: string): Role | null {
  return ROLE_NAMES[raw.trim().toLowerCase()] ?? null
}

function matchHeading(line: string): { role: Role; rest: string } | null {
  const m = line.match(new RegExp(`^\\s*#{1,6}\\s*(${ROLE_PATTERN})\\s*[:：]?\\s*(.*)$`, "i"))
  if (!m) return null
  const role = roleOf(m[1])
  return role ? { role, rest: m[2] ?? "" } : null
}

function matchBold(line: string): { role: Role; rest: string } | null {
  const m = line.match(new RegExp(`^\\s*\\*\\*\\s*(${ROLE_PATTERN})\\s*\\*\\*\\s*[:：]?\\s*(.*)$`, "i"))
  if (!m) return null
  const role = roleOf(m[1])
  return role ? { role, rest: m[2] ?? "" } : null
}

function matchInline(line: string): { role: Role; rest: string } | null {
  const m = line.match(new RegExp(`^\\s*(${ROLE_PATTERN})\\s*[:：]\\s*(.*)$`, "i"))
  if (!m) return null
  const role = roleOf(m[1])
  return role ? { role, rest: m[2] ?? "" } : null
}

export function parseConversation(raw: string): ChatMessage[] {
  const content = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim()
  if (!content) return []

  const lines = content.split("\n")
  const messages: ChatMessage[] = []
  let current: ChatMessage | null = null
  let sawRole = false

  const pushLine = (line: string) => {
    if (!current) {
      current = { role: "unknown", text: "" }
      messages.push(current)
    }
    current.text = current.text ? `${current.text}\n${line}` : line
  }

  for (const line of lines) {
    const marker = matchHeading(line) ?? matchBold(line) ?? matchInline(line)
    if (marker) {
      sawRole = true
      current = { role: marker.role, text: "" }
      messages.push(current)
      if (marker.rest.trim()) pushLine(marker.rest)
      continue
    }
    pushLine(line)
  }

  // 没有识别到任何角色：保留整段原文，避免丢失内容
  if (!sawRole) {
    const text = content.trim()
    return text ? [{ role: "unknown", text }] : []
  }

  return messages
    .map((m) => ({ ...m, text: m.text.trim() }))
    .filter((m) => m.text.length > 0)
}

/** 生成保存到项目里的 Markdown。用户/AI 的原文按原样保留，方便后续搜索。 */
export function renderConversationMarkdown(
  messages: ChatMessage[],
  meta: { title: string; source: string; capturedAt: string }
): string {
  const lines: string[] = [
    "---",
    `source: ${meta.source}`,
    `capturedAt: ${meta.capturedAt}`,
    "---",
    "",
    `# ${meta.title}`,
    "",
  ]
  for (const m of messages) {
    const label = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "原文"
    lines.push(`## ${label}`, "", m.text, "")
  }
  return lines.join("\n").trimEnd() + "\n"
}

/** 从保存的 Markdown 还原消息 — 去掉 frontmatter 与标题，忽略 preamble */
export function parseSavedConversation(markdown: string): ChatMessage[] {
  const body = markdown
    .replace(/^\uFEFF/, "")
    .replace(/^---\s*[\s\S]*?\n---\s*\n/, "")
    .replace(/^#\s+.*\n/, "")
  return parseConversation(body).filter((m) => m.role !== "unknown")
}

export function conversationTitle(messages: ChatMessage[], fallback: string): string {
  const firstUser = messages.find((m) => m.role === "user" && m.text.trim())
  const base = (firstUser?.text ?? messages[0]?.text ?? fallback).split("\n")[0].trim()
  const title = base.length > 40 ? `${base.slice(0, 40)}…` : base
  return title || fallback
}

export function safeFileBase(title: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
  return `${stamp}-${cleaned || "对话"}`
}
