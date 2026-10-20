# plugin-ai-chat-notes

GeWu 第三方插件：**AI 对话笔记**项目类型。

> 独立第三方仓库，位于 `E:\GeWu\plugin-ai-chat-notes`，不修改 `../MyProj`。

## v1 能力（手动捕获）

- 新建「AI 对话笔记」项目（`.proj`，`type: "ai-chat"`）
- 打开项目 → 显示对话页地址（默认 `https://chat.deepseek.com/`）
- 「打开对话」按钮通过宿主 `ctx.browser.open` 打开内嵌浏览器
- 从对话页复制内容，粘贴到插件
- 解析 `## User` / `**User**` / `User:` / 中文角色标记
- 保存为项目内 `conversations/YYYYMMDD-HHmm-标题.md`
- 查看已保存对话列表与内容

## v1 不做

- 不自动读取网页 DOM
- 不注入浏览器脚本
- 不抓取 Cookie / 登录态
- 不联网（除用户点击打开浏览器）

自动捕获是后续的宿主能力（`GW-PLUG-009`），不是本插件 v1 的责任。

## 开发

```powershell
cd E:\GeWu\plugin-ai-chat-notes
npm install
npm test
npm run typecheck
npm run build
```

> 若 `npm ci` 在 npm 11 上报 `@esbuild/*` 的 `notsup` 平台错误，改用 `npm install` 或 `npm ci --force`。

产物：`dist/index.js` + `dist/manifest.json`。

类型依赖来自 `plugin-sdk/` tarball，不需要 MyProj 源码。

## 安装

1. 把 `dist/index.js` + `dist/manifest.json` 打成 ZIP（根目录）
2. GeWu → 工具 → 插件管理 → 手动安装
3. 启用后，在文件列表空白处右键 → 新建项目 → 类型选「AI 对话笔记」
4. 打开项目，配置地址并打开对话

## 项目结构

```text
我的对话.proj/
  .projmeta.json
  conversations/
    20261020-0012-如何学习 Rust.md
```

`.projmeta.json` 由文件列表创建；插件首次打开时补 `viewPlugin` 与 `aiChat` 默认配置。

