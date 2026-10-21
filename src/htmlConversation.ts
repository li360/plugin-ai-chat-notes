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

export function extractText(el: Element): string {
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

/** 把消息节点转成 Markdown：保留标题/列表/表格/代码/链接，避免阅读时丢格式。 */
export function htmlToMarkdown(el: Element): string {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll("button, script, style, svg, noscript, [aria-hidden='true']").forEach((n) => n.remove())
  const md = blockToMarkdown(clone)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return md || extractText(clone)
}

function childrenToMarkdown(el: Element): string {
  return Array.from(el.childNodes)
    .map((node) => (node.nodeType === 3 ? (node.textContent ?? "") : node.nodeType === 1 ? blockToMarkdown(node as Element) : ""))
    .join("")
}

function inlineToMarkdown(el: Element): string {
  return Array.from(el.childNodes).map((node) => {
    if (node.nodeType === 3) return node.textContent ?? ""
    if (node.nodeType !== 1) return ""
    const e = node as Element
    const tag = e.tagName.toLowerCase()
    const inner = inlineToMarkdown(e)
    switch (tag) {
      case "br": return "\n"
      case "strong":
      case "b": return `**${inner}**`
      case "em":
      case "i": return `*${inner}*`
      case "del":
      case "s": return `~~${inner}~~`
      case "code": return `\`${(e.textContent ?? "").replace(/`/g, "\\`")}\``
      case "a": {
        const href = e.getAttribute("href")
        return href ? `[${inner || href}](${href})` : inner
      }
      case "img": {
        const src = e.getAttribute("src")
        if (!src || src.startsWith("data:")) return ""
        return `![${e.getAttribute("alt") ?? ""}](${src})`
      }
      default: return inner
    }
  }).join("")
}

function tableToMarkdown(table: Element): string {
  const rows = Array.from(table.querySelectorAll("tr"))
  if (rows.length === 0) return ""
  const matrix = rows.map((row) =>
    Array.from(row.querySelectorAll("th,td")).map((cell) =>
      inlineToMarkdown(cell).replace(/\|/g, "\\|").replace(/\n+/g, "<br>").trim()
    )
  ).filter((r) => r.length > 0)
  if (matrix.length === 0) return ""
  const cols = Math.max(...matrix.map((r) => r.length))
  const pad = (r: string[]) => [...r, ...Array(cols - r.length).fill("")]
  const header = pad(matrix[0])
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...matrix.slice(1).map((r) => `| ${pad(r).join(" | ")} |`),
    "",
  ].join("\n")
}

function blockToMarkdown(el: Element): string {
  const tag = el.tagName.toLowerCase()
  switch (tag) {
    case "pre": {
      const code = el.querySelector("code")
      const lang = (code?.className.match(/language-([\w-]+)/)?.[1] ?? "").trim()
      const body = (code?.textContent ?? el.textContent ?? "").replace(/\n$/, "")
      return `\n\n\`\`\`${lang}\n${body}\n\`\`\`\n\n`
    }
    case "table":
      return `\n\n${tableToMarkdown(el)}\n\n`
    case "h1": return `\n\n# ${inlineToMarkdown(el).trim()}\n\n`
    case "h2": return `\n\n## ${inlineToMarkdown(el).trim()}\n\n`
    case "h3": return `\n\n### ${inlineToMarkdown(el).trim()}\n\n`
    case "h4": return `\n\n#### ${inlineToMarkdown(el).trim()}\n\n`
    case "h5": return `\n\n##### ${inlineToMarkdown(el).trim()}\n\n`
    case "h6": return `\n\n###### ${inlineToMarkdown(el).trim()}\n\n`
    case "p": return `\n\n${inlineToMarkdown(el).trim()}\n\n`
    case "blockquote": {
      const body = childrenToMarkdown(el).trim().split("\n").map((l) => `> ${l}`).join("\n")
      return `\n\n${body}\n\n`
    }
    case "hr": return "\n\n---\n\n"
    case "ul":
    case "ol": {
      const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === "li")
      const ordered = tag === "ol"
      return `\n\n${items.map((li, i) => {
        const marker = ordered ? `${i + 1}.` : "-"
        const body = childrenToMarkdown(li).trim().replace(/\n/g, "\n  ")
        return `${marker} ${body}`
      }).join("\n")}\n\n`
    }
    case "br": return "\n"
    default:
      return childrenToMarkdown(el)
  }
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
      (el): el is Element => !!el && extractText(el).length > 0
    )
    const text = htmlToMarkdown(content ?? node)
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

