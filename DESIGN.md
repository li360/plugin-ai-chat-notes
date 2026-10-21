# DESIGN — AI 对话摘录（手动保存）

> 状态：方案评审稿 + **v1.1/v1.1.5 已实现**（2026-10-21）；v1.2/v2 仍为设计。  
> 产品定位：**对话摘录 / 手动保存助手**，不自动抓取网页。  
> 关联宿主：GeWu 0.36.4+。
> 宿主 API 细节见 [plugin-browser-panel-spec.md](https://github.com/li360/gewu-project/blob/main/docs/design/plugin-browser-panel-spec.md)。

## v1.1.5 实现记录（0.1.2）

- 粘贴时读取剪贴板 `text/html`，用 DOMParser 解析消息快照
- 识别 `data-message-author-role` / `data-role` / 常见 message 容器
- 解析成功则转成规范 `## User` / `## Assistant` 文本，用户可检查/编辑后保存
- 解析失败/无角色标记时回退普通粘贴
- 仍然只处理用户主动粘贴的内容，不读取页面 DOM

## v1.1 实现记录

已实现（插件 0.1.2）：

- 显示名改为「对话摘录」，项目类型仍为 `ai-chat`
- 首次使用合规提示（localStorage 记忆，可再次清除）
- 手动粘贴 + 解析预览 + 保存 Markdown
- 来源 URL / 保存时间写入 frontmatter
- 阅读模式：隐藏采集区/URL/打开按钮，左侧列表 + 右侧全文
- 删除已保存对话（确认后 `kmgr.deleteFile`）
- 复制 Markdown 到剪贴板（导出）
- 仍**不读取 DOM**、不自动抓取

未实现（按计划）：内嵌浏览器分栏、折叠浏览器、DOM 模板提取。

## 1. 目标与非目标

### 目标

1. 用户主动复制 AI 网页对话，插件帮助整理、预览、保存为项目内 Markdown。
2. 保存前用户可检查/编辑；保存后只存本地项目。
3. 复用 GeWu 已内置浏览器的“嵌入 / 弹出”体验，减少窗口割裂。
4. 给高级用户提供“手动触发 + 自定义模板”的页面内容提取，但不做后台自动抓取。
5. 明确提醒用户遵守目标网站的服务条款、版权与隐私规则。

### 非目标（v1）

- 不自动轮询网页、不自动滚动、不自动点击“复制”。
- 不读取 Cookie / Token / 密码库。
- 不绕过登录、付费墙、验证码或反爬。
- 不把对话上传到任何服务器。
- 不承诺“个人使用一定合法”；合规责任由用户确认。

## 2. 产品命名与文案

建议显示名：

> **对话摘录**  
> 手动保存 AI 网页对话到本地项目

首次使用提示（非阻断，可再次查看）：

> 本插件不会自动读取网页。请只保存你有权保存的内容，并遵守目标网站的服务条款、版权与隐私规定。内容默认仅保存在本地项目中。

不要写“协议允许个人使用”这类确定性法律结论。

## 3. 数据模型

### 3.1 项目

```json
{
  "type": "ai-chat",
  "viewPlugin": "plugin-ai-chat-notes",
  "aiChat": {
    "schemaVersion": 1,
    "sourceUrl": "https://chat.deepseek.com/",
    "provider": "deepseek",
    "captureMode": "manual-paste",
    "templates": []
  }
}
```

### 3.2 会话 Markdown

```md
---
source: https://chat.deepseek.com/
capturedAt: 2026-10-21T00:00:00.000Z
provider: deepseek
template: deepseek-chat@1
---

# 标题

## User

...

## Assistant

...
```

### 3.3 消息

```ts
interface ChatMessage {
  role: "user" | "assistant" | "unknown"
  text: string
  at?: string
}
```

## 4. 阶段划分

### v1.1 — 纯手动（不改宿主）

- 手动粘贴文本 / 从剪贴板读取 HTML（用户主动点击）
- 现有角色解析 + 预览 + 保存
- 首次使用合规提示
- “阅读模式”：隐藏采集区，专注看已保存对话
- 已保存对话删除/导出
- 来源 URL、保存时间写入 frontmatter

**验收**：不打开浏览器也能完成“粘贴 → 预览 → 保存 → 阅读”。

### v1.2 — 复用内置浏览器的嵌入/弹出

> 修正：`plugin-webview-tauri` **已经支持**主窗口内嵌子 WebView 与独立窗口两种模式，并有切换按钮。此前“只能独立窗口”的判断不准确。

目标体验：

1. 项目视图内预留浏览器区域（分栏）。
2. 点击“打开对话” → 内嵌浏览器加载 URL。
3. 工具栏提供“嵌入 / 弹出”切换，和现有浏览器插件一致。
4. 查看已保存笔记时，可折叠/隐藏浏览器区域。
5. 用户点击“从当前页面提取”才读取 DOM；不自动。

实现路径：**宿主提供通用 browser panel API，复用现有 Rust inline 命令**，而不是让 AI 插件直接 `invoke`。

建议 API：

```ts
ctx.browser.open(url, { mode: "inline" | "popup" })
ctx.browser.setBounds(rect)       // inline 时由插件 ResizeObserver 上报
ctx.browser.setVisible(visible)   // 阅读模式折叠
ctx.browser.close()
ctx.browser.capture()             // 手动触发，返回 { html, title, url, capturedAt }
ctx.browser.pick()                // 可选：用户点选元素，返回 outerHTML
```

宿主已有能力（需包装/授权）：

- `open_browser_inline` / `open_browser_window`
- `update_browser_inline_rect`
- `show_browser_inline`
- `close_browser_inline`
- `browser_capture_content` / `content:picked`

约束：

- 全局只有一个 `gewu-content` 子 WebView；AI 插件与内置浏览器插件不能同时占用，需要 host 侧 session 所有权。
- 切换项目/关闭项目必须释放浏览器，避免残留。
- inline 子 WebView 覆盖 DOM，插件必须正确上报 rect 和缩放。
- 只允许 http/https；登录态使用独立浏览器 profile，不读取 Cookie。

**验收**：在项目视图内打开对话，切换嵌入/弹出，折叠后笔记全宽，截图/录屏无割裂。

### v2 — 手动模板提取

在 v1.2 的 `capture()` 基础上，增加模板：

```json
{
  "id": "deepseek-chat",
  "version": 1,
  "match": ["chat.deepseek.com"],
  "selectors": {
    "message": "[data-testid='message']",
    "role": "[data-role]",
    "content": ".markdown"
  },
  "roleMap": { "user": "user", "assistant": "assistant" },
  "textOnly": true
}
```

流程：

```text
用户点“从页面提取”
→ capture() 返回 HTML（不自动）
→ DOMParser 解析
→ 按模板选择器提取
→ 预览消息列表
→ 用户确认/编辑
→ 保存 Markdown
```

模板能力：

- 内置常见站点模板（可关闭）
- 用户自定义 CSS selector
- 可视化点选（后续）
- 解析失败时回退到手动粘贴，不丢内容
- 只取文本，不存原始 HTML；除非用户显式勾选“保留原始 HTML 以便调试”

安全：

- 解析结果必须 `textContent`，不把 HTML 注入 React
- 丢弃 script/style/hidden 元素
- 不自动下载图片/附件
- 不执行页面脚本（capture 只读取）

合规：

- 仍然是“用户主动点击 + 预览确认 + 手动保存”
- 不后台轮询、不自动保存、不批量抓取
- 页面结构解析可能仍受网站条款限制；首次使用模板时提示用户确认
- 对明确禁止自动提取的站点，不内置模板

## 5. 浏览器嵌入方案对比

| 方案 | 可行性 | 体验 | 风险/成本 |
|------|--------|------|-----------|
| 继续独立窗口 | 已有 | 割裂 | 低 |
| iframe 嵌入 | 多数站点禁止 | 好 | 不可行 |
| **复用 Tauri inline 子 WebView** | 宿主已有 | 接近原生嵌入 | 中：rect/焦点/单实例 |
| 新 child webview API | 可行 | 最好 | 高：多实例/安全/生命周期 |
| 浏览器扩展 | 可行 | 依赖安装 | 高：分发/权限/审核 |

推荐：**复用 inline 子 WebView**，不新造一套 WebView；先做单实例 + 折叠，再评估多实例。

## 6. 合规清单

- [ ] 首次使用显示“手动保存 / 遵守条款 / 本地存储”提示
- [ ] 不自动读取页面；只有用户点击“提取”才 capture
- [ ] 保存前预览，用户可编辑/取消
- [ ] 不读取 Cookie/Token/密码库
- [ ] 不绕过登录/付费墙/验证码
- [ ] 不上传对话；无遥测
- [ ] 提供删除/导出
- [ ] 对敏感内容提示脱敏
- [ ] 不内置明确禁止提取的站点模板
- [ ] 文案不承诺“个人使用一定合法”

## 7. 待讨论

1. host browser panel API 的命名/所有权：`ctx.browser` 扩展还是新 `ctx.webview`？
2. 与内置 `plugin-webview-tauri` 同时打开时的冲突策略：拒绝第二个 / 复用 / 切换。
3. `capture()` 返回整页 HTML 还是仅可见区域？隐私与性能取舍。
4. 模板格式、版本迁移、内置模板维护者。
5. 是否提供“仅从剪贴板 HTML 解析”作为无浏览器方案（推荐先做）。
6. 阅读模式布局：左右分栏 / 上下分栏 / 全宽笔记。

## 8. 本阶段结论

- 合规方向正确：**手动保存 + 明确提示**是底线。
- 浏览器嵌入可行，且应复用现有 inline WebView，不另造轮子。
- DOM 模板提取可行，但必须：**用户点击触发、预览确认、只取文本、可回退手动粘贴**。
- 先做 v1.1（纯手动 + 阅读模式），再做 v1.2（inline 浏览器 + capture），最后 v2（模板/点选）。

