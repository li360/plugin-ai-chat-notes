import { describe, expect, it } from "vitest"
import plugin from "./index"

describe("plugin manifest", () => {
  it("default-exports an ai-chat project view plugin", () => {
    expect(plugin.id).toBe("plugin-ai-chat-notes")
    expect(plugin.projectTypes).toEqual(["ai-chat"])
    expect(plugin.projectTypeDescriptors?.[0]?.label).toBe("对话摘录")
    expect(plugin.handles).toContain("project:open")
    expect(typeof plugin.component).toBe("function")
    expect(plugin.minAppVersion).toBe("0.36.1")
    expect(plugin.version).toBe("0.2.1")
  })
})



