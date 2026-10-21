# HANDOFF

## 2026-10-21 v1.2（0.2.1，项目内嵌浏览器 + 手动提取）

- [x] 项目视图内嵌浏览器面板（复用 `gewu-content`）
- [x] 嵌入 / 弹出切换
- [x] 阅读模式隐藏浏览器面板
- [x] 「从页面提取」：用户点击后 capture 当前 HTML 快照，预览后保存
- [x] 全局单例所有权；被占用时明确报错
- [x] 15 项测试 / typecheck / build
- [ ] 宿主安装后手动验收（需 0.36.5+）

## 2026-10-21 v1.1.5（0.1.2，剪贴板 HTML）

- [x] 粘贴时读取 `text/html`，解析消息快照
- [x] 识别 `data-message-author-role` / `data-role` / 常见 message 容器
- [x] 解析成功转成规范 `## User` / `## Assistant` 文本
- [x] 解析失败回退普通粘贴
- [x] 15 项测试 / typecheck / build

## 2026-10-21 v1.1（对话摘录）

- [x] 显示名改为「对话摘录」，type 仍 `ai-chat`
- [x] 首次使用合规提示（localStorage 记忆）
- [x] 手动粘贴 → 解析 → 预览 → 保存
- [x] 来源 URL / 时间写入 frontmatter
- [x] 阅读模式：隐藏采集区，左侧列表 + 右侧全文
- [x] 删除已保存 Markdown
- [x] 复制 Markdown 到剪贴板
- [x] 9 项测试 / typecheck / build
- [ ] 宿主安装后手动验收（新建 → 粘贴 → 保存 → 阅读 → 删除/复制）
- [ ] v1.2：内嵌浏览器分栏 + 折叠 + 手动 DOM 提取（见 DESIGN.md）

已知问题：

- 内嵌浏览器为全局单例；与内置浏览器插件同时使用会提示占用。
- 页面结构差异可能导致提取失败，失败时回退手动粘贴。
- 删除使用 `window.confirm`，不是系统原生对话框。
- 复制依赖 `navigator.clipboard`（Tauri webview 可用；失败会提示）。

测试结果：

- `npm test`：9 passed
- `npm run typecheck`：0
- `npm run build`：0

## 2026-10-20 初始 v1（宿主提供脚手架）

- [x] 独立仓库与构建骨架
- [x] 项目类型 `ai-chat` + `project:open`
- [x] `.projmeta.json` 读取/补全 `viewPlugin` + `aiChat`
- [x] `ctx.browser.open` 打开对话页
- [x] 粘贴解析（Markdown / 粗体 / 行首 / 中文角色）
- [x] 保存到 `conversations/*.md`
- [x] 已保存对话列表 + 预览
- [x] 多实例过滤
- [x] 9 项测试
- [ ] 宿主安装验收（新建项目 → 打开 → 保存）
- [ ] 自动捕获（明确 v1 不做）

已知问题：

- 依赖 0.36.1 宿主（`ctx.browser.open` / `viewPlugin`）。
- v1 只能手动粘贴，不能读取 DeepSeek DOM。
- 角色解析是启发式；无法识别时保留原文。

测试结果：

- `npm test`：9 passed
- `npm run typecheck`：0
- `npm run build`：0




