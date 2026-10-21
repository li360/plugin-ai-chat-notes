/** 站点适配器 — 定义“网页中哪些节点是对话消息”。
 *  只处理用户主动粘贴/点击提取得到的 HTML 快照，不访问页面。 */
import type { ChatMessage } from "./conversation"
import { extractText, parseHtmlConversation } from "./htmlConversation"

export interface SiteAdapter {
  id: string
  label: string
  /** 匹配的 host 后缀，如 ["chatglm.cn"] */
  hosts: string[]
  /** 从 HTML 文档解析消息；返回 [] 时调用方回退通用解析 */
  parse: (doc: Document) => ChatMessage[]
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
      const text = extractText((content ?? node) as Element)
      if (!text) continue
      messages.push({ role: isUser ? "user" : "assistant", text })
    }
    return messages
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

/** 根据 URL + 可选 adapterId 选择适配器；auto 时按 host 匹配，最后回退通用 */
export function resolveAdapter(url: string, adapterId?: string): SiteAdapter {
  if (adapterId && adapterId !== "auto") {
    const explicit = BUILTIN_ADAPTERS.find((a) => a.id === adapterId)
    if (explicit) return explicit
  }
  let host = ""
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    // 无效 URL 直接走通用
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
