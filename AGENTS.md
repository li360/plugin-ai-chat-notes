# AGENTS.md — plugin-ai-chat-notes

> 你是**第三方插件开发者**。本仓库独立，宿主 `../MyProj` 只读。
> 先读 [CONTRACT.md](./CONTRACT.md)、[README.md](./README.md)、[REVIEW.md](./REVIEW.md)。

## 身份与边界

- 只能修改 `E:\GeWu\plugin-ai-chat-notes`。
- 禁止修改 `../MyProj` 或其他仓库；不要为让插件跑起来去改宿主。
- 插件是外部插件，安装到 `%APPDATA%\com.gewu.desktop\plugins\plugin-ai-chat-notes\`。
- 只通过 `PluginContext` 访问宿主；禁止直接 `invoke` Tauri 命令。

## 任务（v1）

实现「AI 对话笔记」项目类型：

1. 声明 `projectTypes: ["ai-chat"]`，处理 `project:open`；
2. 读取/补全 `.projmeta.json`：`viewPlugin` + `aiChat.url`；
3. 「打开对话」通过 `ctx.browser.open(url, { mode: "embedded" })`；
4. 粘贴对话，解析 user/assistant 角色；
5. 保存到项目 `conversations/*.md`，并列出/查看已保存对话；
6. 多实例隔离（`createMultiInstanceFilter`）。

## 硬约束

1. 不自动读取网页 DOM、不注入脚本、不抓取 Cookie/登录态。
2. 不联网；唯一外部动作是用户点击「打开对话」。
3. 不读写 `vault/`、appData、凭据；不把内容发到外部。
4. 角色解析失败时保留原文，不丢用户内容。
5. 文件名必须过滤 Windows 非法字符 `\/:*?"<>|`。
6. 大文本保护：粘贴超过 2 MB 时提示并拒绝保存。
7. 所有用户可见文案中文；代码注释中文。
8. `manifest.json` 的 `id` 必须与源码一致。

## 构建

```powershell
npm install
npm test
npm run typecheck
npm run build
```

产物必须包含 `export default`；`build.mjs` 会校验。

## 验收

见 [TESTING.md](./TESTING.md)。至少：

- 新建项目类型可选「AI 对话笔记」
- 打开项目 → 打开对话 → 粘贴 → 保存
- 角色解析正确；无角色时保留原文
- 多实例不串
- 无 `invoke`、无网络请求

## 交付

- 提交信息 `type(scope): 描述`；
- 更新 `HANDOFF.md`（完成/未完成/测试结果）；
- 不自行发布 Release。

