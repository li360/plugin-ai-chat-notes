import { describe, expect, it } from "vitest"
import { parseHTML } from "linkedom"
import { BUILTIN_ADAPTERS, parseHtmlWithAdapter, resolveAdapter } from "./adapters"

function docOf(html: string): Document {
  return parseHTML(html).document as unknown as Document
}

const CHATGLM_HTML = `
<div class="conversation-list">
  <div class="item conversation-item">
    <div class="conversation question pr">
      <div class="user-name">访客_x</div>
      <div class="question-txt">你好，请介绍一下你自己</div>
    </div>
    <div class="answer">
      <div class="assistant-name">ChatGLM</div>
      <div class="answer-content-wrap text-advance-thinking-content"><div class="markdown-body">思考过程</div></div>
      <div class="answer-content-wrap"><div class="markdown-body">我是 GLM，很高兴认识你。</div></div>
    </div>
  </div>
</div>
`

describe("chatglm adapter", () => {
  it("extracts user/assistant and skips thinking", () => {
    const adapter = resolveAdapter("https://chatglm.cn/main/alltoolsdetail", "auto")
    expect(adapter.id).toBe("chatglm")
    const messages = parseHtmlWithAdapter(CHATGLM_HTML, docOf(CHATGLM_HTML), adapter)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: "user", text: "你好，请介绍一下你自己" })
    expect(messages[1].text).toBe("我是 GLM，很高兴认识你。")
    expect(messages[1].text).not.toContain("思考过程")
  })

  it("falls back to generic when explicit adapter has no structure", () => {
    const adapter = BUILTIN_ADAPTERS.find((a) => a.id === "chatglm")!
    const html = `<div data-role="user">问</div><div data-role="assistant">答</div>`
    const messages = parseHtmlWithAdapter(html, docOf(html), adapter)
    expect(messages.map((m) => m.text)).toEqual(["问", "答"])
  })
})

describe("deepseek adapter", () => {
  it("parses user/assistant and excludes thinking", () => {
    const adapter = BUILTIN_ADAPTERS.find((a) => a.id === "deepseek")!
    const html = `
      <div class="fbb737a4">旧虚拟化是否可以下线？</div>
      <div class="ds-think-content"><div class="ds-markdown">思考过程</div></div>
      <div class="ds-assistant-message-main-content">
        <table><tr><th>项目</th><th>结论</th></tr><tr><td>VMware</td><td>迁移后可下线</td></tr></table>
      </div>
    `
    const messages = parseHtmlWithAdapter(html, docOf(html), adapter)
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe("user")
    expect(messages[1].role).toBe("assistant")
    expect(messages[1].text).toContain("| 项目 | 结论 |")
    expect(messages[1].text).not.toContain("思考过程")
  })
})

describe("custom template", () => {
  it("uses user/assistant selectors and content selector", () => {
    const html = `
      <div class="mine"><div class="md">问题</div></div>
      <div class="bot"><div class="md"><table><tr><th>A</th></tr><tr><td>1</td></tr></table></div></div>
    `
    const template = {
      label: "测试站点",
      host: "example.com",
      userSelector: ".mine",
      assistantSelector: ".bot",
      contentSelector: ".md",
    }
    const adapter = resolveAdapter("https://example.com/chat", "custom", template)
    expect(adapter.id).toBe("custom")
    const messages = parseHtmlWithAdapter(html, docOf(html), adapter)
    expect(messages[0]).toEqual({ role: "user", text: "问题" })
    expect(messages[1].role).toBe("assistant")
    expect(messages[1].text).toContain("| A |")
  })
})
