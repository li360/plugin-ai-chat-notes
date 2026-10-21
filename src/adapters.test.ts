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
