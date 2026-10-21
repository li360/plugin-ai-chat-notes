import { describe, expect, it } from "vitest"
import { parseHTML } from "linkedom"
import { messagesToTranscript, parseHtmlConversation } from "./htmlConversation"

function docOf(html: string): Document {
  return parseHTML(html).document as unknown as Document
}

describe("parseHtmlConversation", () => {
  it("parses data-message-author-role and content blocks", () => {
    const html = `
      <div data-message-author-role="user"><div class="markdown"><p>你好</p></div></div>
      <div data-message-author-role="assistant"><div class="markdown"><p>你好！</p><p>有什么可以帮你？</p></div></div>
    `
    const messages = parseHtmlConversation(html, docOf(html))
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe("user")
    expect(messages[0].text).toContain("你好")
    expect(messages[1].role).toBe("assistant")
    expect(messages[1].text).toContain("有什么可以帮你")
  })

  it("parses class-based roles", () => {
    const html = `
      <div class="chat-message user"><div class="content">问题</div></div>
      <div class="chat-message assistant"><div class="content">回答</div></div>
    `
    expect(parseHtmlConversation(html, docOf(html)).map((m) => m.role)).toEqual(["user", "assistant"])
  })

  it("keeps inner message leaves under a wrapper", () => {
    const html = `
      <main data-testid="conversation-turn">
        <div data-role="user">第一问</div>
        <div data-role="assistant">第一答</div>
      </main>
    `
    const messages = parseHtmlConversation(html, docOf(html))
    expect(messages.map((m) => m.text)).toEqual(["第一问", "第一答"])
  })

  it("returns empty when no role can be inferred", () => {
    const html = `<article><p>没有角色标记</p></article>`
    expect(parseHtmlConversation(html, docOf(html))).toEqual([])
  })

  it("ignores buttons inside message content", () => {
    const html = `<div data-role="assistant"><div class="markdown"><p>回答</p><button>复制</button></div></div>`
    expect(parseHtmlConversation(html, docOf(html))[0].text).toBe("回答")
  })
})

describe("messagesToTranscript", () => {
  it("renders role headings", () => {
    const text = messagesToTranscript([
      { role: "user", text: "问" },
      { role: "assistant", text: "答" },
    ])
    expect(text).toContain("## User\n\n问")
    expect(text).toContain("## Assistant\n\n答")
  })
})
