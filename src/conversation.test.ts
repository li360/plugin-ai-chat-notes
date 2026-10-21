import { describe, expect, it } from "vitest"
import {
  conversationTitle,
  parseConversation,
  parseSavedConversation,
  renderConversationMarkdown,
  safeFileBase,
} from "./conversation"

describe("parseConversation", () => {
  it("parses markdown headings and preserves multiline content", () => {
    const raw = "## User\n你好\n\n## Assistant\n你好！\n有什么可以帮你？"
    const messages = parseConversation(raw)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: "user", text: "你好" })
    expect(messages[1]).toEqual({ role: "assistant", text: "你好！\n有什么可以帮你？" })
  })

  it("parses bold and inline roles", () => {
    const raw = "**User**\n第一问\n\n**Assistant**\n回答一\n\n用户：第二问"
    const messages = parseConversation(raw)
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"])
    expect(messages[0].text).toBe("第一问")
    expect(messages[1].text).toBe("回答一")
    expect(messages[2].text).toBe("第二问")
  })

  it("parses Chinese headings", () => {
    const raw = "### 用户\n问题\n\n### 助手\n回答"
    expect(parseConversation(raw).map((m) => m.role)).toEqual(["user", "assistant"])
  })

  it("keeps raw text when no role marker exists", () => {
    const messages = parseConversation("一段没有角色标记的对话原文")
    expect(messages).toEqual([{ role: "unknown", text: "一段没有角色标记的对话原文" }])
  })

  it("returns empty for empty input", () => {
    expect(parseConversation(" \r\n ")).toEqual([])
  })
})

describe("renderConversationMarkdown", () => {
  it("renders frontmatter and role sections", () => {
    const md = renderConversationMarkdown(
      [
        { role: "user", text: "问" },
        { role: "assistant", text: "答" },
      ],
      { title: "测试对话", source: "https://chat.deepseek.com/", capturedAt: "2026-10-20T00:00:00Z" }
    )
    expect(md).toContain("source: https://chat.deepseek.com/")
    expect(md).toContain("# 测试对话")
    expect(md).toContain("## User\n\n问")
    expect(md).toContain("## Assistant\n\n答")
  })
})

describe("title/file name", () => {
  it("uses first user line and truncates", () => {
    expect(conversationTitle([{ role: "user", text: "第一行\n第二行" }], "fallback")).toBe("第一行")
    const long = "a".repeat(60)
    expect(conversationTitle([{ role: "user", text: long }], "fallback")).toHaveLength(41)
  })

  it("strips invalid Windows filename characters", () => {
    const name = safeFileBase('a/b:c*?"<>|', new Date(2026, 9, 20, 1, 2))
    expect(name).not.toMatch(/[\\/:*?"<>|]/)
    expect(name).toContain("20261020-0102")
  })
})

describe("parseSavedConversation", () => {
  it("drops frontmatter/title and returns roles", () => {
    const md = `---\nsource: https://chatglm.cn/\n---\n\n# 标题\n\n## User\n\n问\n\n## Assistant\n\n答\n`
    expect(parseSavedConversation(md)).toEqual([
      { role: "user", text: "问" },
      { role: "assistant", text: "答" },
    ])
  })
})
