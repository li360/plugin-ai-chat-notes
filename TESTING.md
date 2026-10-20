# 手动验收步骤

## 构建

```powershell
cd E:\GeWu\plugin-ai-chat-notes
npm install
npm test
npm run typecheck
npm run build
```

## 安装

1. 把 `dist/index.js` + `dist/manifest.json` 打成 ZIP（根目录）
2. GeWu → 工具 → 插件管理 → 手动安装
3. 启用「对话摘录」

## 验收

### A. 新建项目

1. 文件列表空白处右键 → 新建项目
2. 类型下拉应出现「对话摘录」
3. 输入名称创建

期望：
- 生成 `<名称>.proj` + `.projmeta.json`
- 打开后容器显示「对话摘录」

### B. 打开对话

1. 项目视图里地址默认 `https://chat.deepseek.com/`
2. 点「打开对话」
3. 期望：内嵌浏览器打开 DeepSeek 页面

### C. 粘贴与保存

1. 从对话页复制一段对话
2. 粘贴到文本框
3. 期望：显示「解析到 N 段」
4. 点「保存对话」
5. 期望：`conversations/` 下出现 Markdown；列表出现该文件
6. 点击列表项，预览内容正确

### C2. 合规提示

1. 首次打开项目（清除 localStorage 后）显示「仅手动保存」提示
2. 点「我已知晓」后消失；重启后不再出现
3. 提示文案包含遵守服务条款/版权/隐私

### C3. 阅读模式

1. 点「阅读」
2. 期望：隐藏 URL/保存地址/打开对话/采集区
3. 左侧显示已保存列表，右侧显示全文
4. 点「返回采集」恢复

### C4. 删除 / 复制

1. 阅读模式或列表里点「删除」→ 确认 → 文件消失
2. 点「复制 Markdown」→ 剪贴板内容为当前全文
3. 删除当前激活文件后，右侧清空

### D. 角色解析

用 `test-fixtures/sample-conversation.md` 测试：

- `## User` / `## Assistant`
- `**User**` / `**Assistant**`
- `用户：` / `助手：`
- 无角色标记 → 保存为 `## 原文`

### E. 边界

1. 空内容保存 → 提示
2. 超过 2 MB → 提示拒绝
3. 地址改成 `file:///...` → 打开被宿主拒绝
4. 无知识库 API（纯前端）→ 明确错误

### F. 多实例

两个容器分别打开不同项目，期望互不覆盖。

### G. 安全

```powershell
git grep -n "invoke(" -- src
git grep -n "fetch\|XMLHttpRequest\|WebSocket" -- src
```

期望无结果（`ctx.browser.open` 是宿主 API，不是直接 invoke）。

