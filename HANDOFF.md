# HANDOFF

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
