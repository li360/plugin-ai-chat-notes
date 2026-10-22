/** 站点适配器 — 定义“网页中哪些节点是对话消息”。
 *  只处理用户主动粘贴/点击提取得到的 HTML 快照，不访问页面。 */
import type { ChatMessage } from "./conversation"
import { htmlToMarkdown, parseHtmlConversation } from "./htmlConversation"

export interface SiteAdapter {
  id: string
  label: string
  /** 匹配的 host 后缀，如 ["chatglm.cn"] */
  hosts: string[]
  /** 从 HTML 文档解析消息；返回 [] 时调用方回退通用解析 */
  parse: (doc: Document) => ChatMessage[]
  /** 页面中可识别的消息节点数（用于提示是否只渲染了一部分） */
  count?: (doc: Document) => number
}

/** 用户自定义模板 — 用户选择器负责 user/assistant，contentSelector 可选 */
export interface CustomTemplate {
  label: string
  host?: string
  userSelector: string
  assistantSelector: string
  contentSelector?: string
}

function hostMatches(host: string, candidates: string[]): boolean {
  return candidates.some((h) => host === h || host.endsWith(`.${h}`))
}

function isValidSelector(selector: string): boolean {
  try {
    new DOMParser().parseFromString("<div></div>", "text/html").querySelector(selector)
    return true
  } catch {
    return false
  }
}

export function validateTemplate(t: Partial<CustomTemplate>): string | null {
  if (!t.userSelector?.trim()) return "请填写用户消息选择器"
  if (!t.assistantSelector?.trim()) return "请填写 AI 消息选择器"
  if (!isValidSelector(t.userSelector)) return "用户消息选择器格式无效"
  if (!isValidSelector(t.assistantSelector)) return "AI 消息选择器格式无效"
  if (t.contentSelector?.trim() && !isValidSelector(t.contentSelector)) return "内容选择器格式无效"
  return null
}

export function customAdapter(template: CustomTemplate): SiteAdapter {
  return {
    id: "custom",
    label: template.label || "自定义模板",
    hosts: template.host ? [template.host] : [],
    parse(doc) {
      const userSel = template.userSelector.trim()
      const assistantSel = template.assistantSelector.trim()
      const contentSel = template.contentSelector?.trim()
      let nodes: Element[]
      try {
        nodes = Array.from(doc.querySelectorAll(`${userSel}, ${assistantSel}`))
      } catch {
        return []
      }
      const messages: ChatMessage[] = []
      for (const node of nodes) {
        const isUser = node.matches(userSel)
        const content = contentSel ? node.querySelector(contentSel) : null
        const text = htmlToMarkdown((content ?? node) as Element)
        if (text) messages.push({ role: isUser ? "user" : "assistant", text })
      }
      return messages
    },
    count(doc) {
      try {
        return doc.querySelectorAll(`${template.userSelector.trim()}, ${template.assistantSelector.trim()}`).length
      } catch {
        return 0
      }
    },
  }
}

/** 智谱清言（chatglm.cn）— 2026-10 匿名页面结构 */
const chatglmAdapter: SiteAdapter = {
  id: "chatglm",
  label: "智谱清言",
  hosts: ["chatglm.cn"],
  parse(doc) {
    const list = doc.querySelector(".conversation-list")
    if (!list) return []
    const nodes = Array.from(list.querySelectorAll(".conversation.question, .answer"))
    const messages: ChatMessage[] = []
    for (const node of nodes) {
      const isUser = node.classList.contains("question")
      const content = isUser
        ? node.querySelector(".question-txt, .question-text-style")
        : node.querySelector(".answer-content-wrap:not(.text-advance-thinking-content)") ??
          node.querySelector(".markdown-body:not(.text-advance-thinking-content)") ??
          node.querySelector(".markdown-body")
      const text = htmlToMarkdown((content ?? node) as Element)
      if (!text) continue
      messages.push({ role: isUser ? "user" : "assistant", text })
    }
    return messages
  },
  count(doc) {
    const list = doc.querySelector(".conversation-list")
    return list ? list.querySelectorAll(".conversation.question, .answer").length : 0
  },
}

/** 通用适配器 — 依赖 data-role / message 容器等通用结构 */
const genericAdapter: SiteAdapter = {
  id: "generic",
  label: "通用识别",
  hosts: [],
  parse(doc) {
    return parseHtmlConversation(doc.documentElement.outerHTML, doc)
  },
}

export const BUILTIN_ADAPTERS: SiteAdapter[] = [chatglmAdapter, genericAdapter]

/** 常用站点预设 — 仅作为自定义模板的起点，使用前先「测试模板」 */
export const TEMPLATE_PRESETS: Array<CustomTemplate & { id: string }> = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    host: "chatgpt.com",
    userSelector: '[data-message-author-role="user"]',
    assistantSelector: '[data-message-author-role="assistant"]',
    contentSelector: ".markdown",
  },
  {
    id: "claude",
    label: "Claude",
    host: "claude.ai",
    userSelector: '[data-testid="user-message"]',
    assistantSelector: ".font-claude-message",
    contentSelector: "",
  },
  {
    id: "gemini",
    label: "Gemini",
    host: "gemini.google.com",
    userSelector: "user-query",
    assistantSelector: "model-response",
    contentSelector: ".query-text, message-content",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    host: "chat.deepseek.com",
    userSelector: '[data-role="user"]',
    assistantSelector: '[data-role="assistant"]',
    contentSelector: ".ds-markdown",
  },
]

/** 根据 URL + adapterId + 自定义模板选择适配器；auto 时按 host 匹配 */
export function resolveAdapter(url: string, adapterId?: string, template?: CustomTemplate): SiteAdapter {
  let host = ""
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    // 无效 URL 直接走通用
  }
  if (template && (adapterId === "custom" || (adapterId === "auto" && template.host && hostMatches(host, [template.host])))) {
    return customAdapter(template)
  }
  if (adapterId && adapterId !== "auto") {
    const explicit = BUILTIN_ADAPTERS.find((a) => a.id === adapterId)
    if (explicit) return explicit
  }
  const matched = BUILTIN_ADAPTERS.find((a) => a.hosts.some((h) => host === h || host.endsWith(`.${h}`)))
  return matched ?? genericAdapter
}

/** 解析 HTML：先适配器，再通用回退 */
export function parseHtmlWithAdapter(html: string, doc: Document, adapter: SiteAdapter): ChatMessage[] {
  const viaAdapter = adapter.parse(doc)
  if (viaAdapter.length > 0) return viaAdapter
  return genericAdapter.parse(doc)
}

