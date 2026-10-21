/** 从剪贴板 HTML 解析对话。纯函数，文档对象由调用方注入（测试用 linkedom，运行时用 DOMParser）。 */
import type { ChatMessage, Role } from "./conversation"

const MESSAGE_SELECTORS = [
  "[data-message-author-role]",
  '[data-role="user"], [data-role="assistant"]',
  '[data-testid="conversation-turn"]',
  "article[data-testid]",
  ".chat-message",
  ".message",
]

const CONTENT_SELECTORS = [
  ".markdown",
  ".prose",
  "[data-message-content]",
  '[data-testid="message-content"]',
  ".content",
  ".ds-markdown",
]

const ROLE_MAP: Record<string, Role> = {
  user: "user",
  human: "user",
  "用户": "user",
  "我": "user",
  assistant: "assistant",
  ai: "assistant",
  bot: "assistant",
  "助手": "assistant",
  deepseek: "assistant",
}

function normalizeRole(raw: string | null | undefined): Role | null {
  if (!raw) return null
  return ROLE_MAP[raw.trim().toLowerCase()] ?? null
}

function inferRole(el: Element): Role | null {
  const attr =
    el.getAttribute("data-message-author-role") ??
    el.getAttribute("data-role") ??
    el.getAttribute("data-author") ??
    el.getAttribute("aria-label")
  const direct = normalizeRole(attr)
  if (direct) return direct

  const className = typeof el.className === "string" ? el.className.toLowerCase() : ""
  if (/(^|[\s_-])user([\s_-]|$)/.test(className) || className.includes("human")) return "user"
  if (/(^|[\s_-])assistant([\s_-]|$)/.test(className) || className.includes("bot")) return "assistant"
  return null
}

function textOf(el: Element): string {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll("button, script, style, svg, noscript, [aria-hidden='true']").forEach((n) => n.remove())
  const html = clone as HTMLElement
  const text = typeof html.innerText === "string" ? html.innerText : clone.textContent ?? ""
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** 解析整页/片段 HTML。识别不到角色时返回 []，由调用方回退到纯文本粘贴。 */
export function parseHtmlConversation(html: string, doc?: Document): ChatMessage[] {
  if (!html.trim()) return []
  const document = doc ?? new DOMParser().parseFromString(html, "text/html")
  const selector = MESSAGE_SELECTORS.join(", ")
  const all = Array.from(document.querySelectorAll(selector))

  // 只保留最内层候选，避免外层容器和内部消息重复
  const leaves = all.filter((node) => !all.some((other) => other !== node && node.contains(other)))
  const messages: ChatMessage[] = []
  for (const node of leaves) {
    const role = inferRole(node)
    if (!role) continue
    const content = CONTENT_SELECTORS.map((sel) => node.querySelector(sel)).find(
      (el): el is Element => !!el && textOf(el).length > 0
    )
    const text = textOf(content ?? node)
    if (text) messages.push({ role, text })
  }
  return messages
}

/** 转成 textarea 可编辑的规范文本；保存时仍走 parseConversation。 */
export function messagesToTranscript(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      const label = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "原文"
      return `## ${label}\n\n${m.text}`
    })
    .join("\n\n")
}
