# GeWu 第三方插件契约 — AI 对话笔记

> 适用宿主：GeWu 0.36.1 beta（`minAppVersion: 0.36.1`）。

## 1. 项目类型

manifest：

```json
{
  "id": "plugin-ai-chat-notes",
  "name": "AI 对话笔记",
  "version": "0.1.0",
  "minAppVersion": "0.36.1",
  "projectTypes": ["ai-chat"],
  "handles": ["project:open"],
  "capabilities": ["kmgr:read", "kmgr:write"]
}
```

- 文件列表「新建项目」会从 `workspace.getProjectTypes()` 读取 `ai-chat`
- 创建 `.proj` 目录 + `.projmeta.json`：

```json
{
  "id": "proj-xxx",
  "version": 1,
  "type": "ai-chat",
  "title": "我的对话",
  "aiChat": {}
}
```

- 打开时 workspace 读取 meta，按 `viewPlugin`（若存在）或 `type` 路由
- 插件首次打开补：

```json
{
  "viewPlugin": "plugin-ai-chat-notes",
  "aiChat": { "url": "https://chat.deepseek.com/", "provider": "deepseek" }
}
```

## 2. 事件

```ts
on<ProjectOpenPayload>("project:open", (payload) => {
  if (!shouldHandle(payload)) return
  if (payload.meta.type !== "ai-chat") return
  // payload.path / name / meta
})
```

- `createMultiInstanceFilter(containerId)` 必须使用
- `project:open` 由 workspace 在视图插件挂载后延迟投递

## 3. 浏览器 API

```ts
await ctx.browser.open(url, { mode: "embedded" })
```

- 只允许 http/https；`http` 仅限 localhost
- `external` = 内嵌浏览器；`embedded` = GeWu 内嵌浏览器
- 不要直接 `invoke("plugin_browser_open")`
- 也可以 `emit("browser:open", { url, mode })`

v1 只打开对话页，不读取页面内容。

## 4. 文件读写

- `ctx.kmgr.readTextFile(path)` 读 `.projmeta.json` / 已保存对话
- `ctx.kmgr.writeTextFile(path, content)` 写 meta / Markdown
- `ctx.kmgr.createDirectory(conversationsDir)` 首次保存前创建
- `ctx.kmgr.listDirectory(conversationsDir, false)` 列出 `.md`
- 路径使用 `/` 拼接；不要假设库内/库外

## 5. 保存格式

```md
---
source: https://chat.deepseek.com/
capturedAt: 2026-10-20T00:00:00.000Z
---

# 对话标题

## User

...

## Assistant

...
```

- 文件名：`YYYYMMDD-HHmm-标题.md`，过滤 `\/:*?"<>|`
- 无法识别角色时整段保存为 `## 原文`
- 粘贴 > 2 MB 拒绝保存

## 6. 安全

- 不自动读取网页、不注入脚本、不抓 Cookie
- 不联网；唯一外部动作是用户点击「打开对话」
- 不读写 vault / appData / 凭据
- 插件是可信代码；`capabilities` 不是安全边界

## 7. 明确不做（v1）

- 自动捕获 DeepSeek 对话
- 浏览器扩展 / CDP / DOM 注入
- 后台同步

