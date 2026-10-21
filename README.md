# plugin-ai-chat-notes

GeWu 第三方插件：**对话摘录**项目类型（手动保存 AI 网页对话）。

> 独立第三方仓库，位于 `E:\GeWu\plugin-ai-chat-notes`，不修改 `../MyProj`。

## 方案文档

先读 [DESIGN.md](./DESIGN.md)（v1.1 / v1.2 已实现；v2 为设计）。

## v1.1 / v1.2 能力

- 新建「对话摘录」项目（`.proj`，`type: "ai-chat"`）
- 打开项目 → 显示对话页地址（默认 `https://chat.deepseek.com/`）
- 「打开对话」按钮通过宿主 `ctx.browser.open` 打开内嵌浏览器
- 项目内嵌浏览器面板（65% 主区域），可切换嵌入 / 弹出
- 站点适配器：智谱清言（chatglm.cn）自动识别；其他站点回退通用
- 「从页面提取」：用户点击后读取当前页面快照并解析
- 从对话页复制内容，粘贴到插件
- 支持从剪贴板 HTML 自动识别消息（用户主动粘贴，不读取页面 DOM）
- 解析 `## User` / `**User**` / `User:` / 中文角色标记
- 保存为项目内 `conversations/YYYYMMDD-HHmm-标题.md`
- 阅读模式：隐藏采集区/浏览器面板，左侧列表 + 右侧全文
- 删除已保存对话 / 复制 Markdown 到剪贴板
- 首次使用合规提示

## 不做

- 后台自动抓取网页
- 注入浏览器脚本 / 读取 Cookie
- 用户自定义模板（v2 设计）
- 不联网（除用户点击打开浏览器）
- 不做用户自定义模板 / 后台自动抓取（v2 设计）

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
3. 启用后，在文件列表空白处右键 → 新建项目 → 类型选「对话摘录」
4. 打开项目，配置地址并打开对话

## 项目结构

```text
我的对话.proj/
  .projmeta.json
  conversations/
    20261020-0012-如何学习 Rust.md
```

`.projmeta.json` 由文件列表创建；插件首次打开时补 `viewPlugin` 与 `aiChat` 默认配置。




