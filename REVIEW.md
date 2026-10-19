# 第三方插件审查清单 — AI 对话笔记

## 构建

- [ ] `manifest.json` 的 `id` = `plugin-ai-chat-notes`
- [ ] `npm ci` / `npm test` / `npm run typecheck` / `npm run build` 通过
- [ ] `dist/index.js` 含 `export default`
- [ ] React / plugin-protocol / kmgr-api / workspace 保持 external

## 契约

- [ ] `projectTypes: ["ai-chat"]`
- [ ] `handles: ["project:open"]`
- [ ] `createMultiInstanceFilter(containerId)`
- [ ] 读取/写入 `.projmeta.json`，补 `viewPlugin` + `aiChat`
- [ ] 保存到 `conversations/*.md`
- [ ] 无角色标记时保留原文
- [ ] 文件名过滤 Windows 非法字符
- [ ] 粘贴 > 2 MB 拒绝

## 安全

- [ ] 无直接 `invoke`
- [ ] 无自动网页读取 / 脚本注入 / Cookie 访问
- [ ] 无网络请求（浏览器打开由用户点击触发）
- [ ] 无 vault / appData / 凭据读写
- [ ] 不把对话内容发到外部

## UX

- [ ] 新建项目类型可选
- [ ] 打开项目显示标题与地址
- [ ] 打开对话成功/失败提示
- [ ] 保存成功提示，列表刷新
- [ ] 已保存对话可预览
- [ ] 多实例不串

## 发布

- [ ] `HANDOFF.md` 更新
- [ ] 未自行发布 Release
- [ ] 版本号递增（如适用）
