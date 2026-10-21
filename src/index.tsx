import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ClipboardEvent } from "react"
import {
  createMultiInstanceFilter,
  type PluginContext,
  type PluginManifest,
  type ProjectMeta,
} from "plugin-protocol"
import {
  conversationTitle,
  parseConversation,
  renderConversationMarkdown,
  safeFileBase,
  type ChatMessage,
} from "./conversation"
import { messagesToTranscript, parseHtmlConversation } from "./htmlConversation"

const PLUGIN_ID = "plugin-ai-chat-notes"
const PLUGIN_NAME = "对话摘录"
const DEFAULT_URL = "https://chat.deepseek.com/"
const META_FILE = ".projmeta.json"
const CONVERSATIONS_DIR = "conversations"
const NOTICE_KEY = "gewu-ai-chat-notes:notice-v1"

interface AiChatConfig {
  url: string
  provider: string
}

interface AiChatProjectMeta extends ProjectMeta {
  aiChat?: Partial<AiChatConfig>
}

interface ProjectOpenPayload {
  path: string
  name: string
  meta: ProjectMeta
  __targetContainer?: string
}

interface ConversationFile {
  name: string
  path: string
  modifiedAt: string
}

function joinPath(base: string, name: string): string {
  return `${base.replace(/[\\/]+$/, "")}/${name}`
}

function normalizeConfig(meta: AiChatProjectMeta): AiChatConfig {
  return {
    url: typeof meta.aiChat?.url === "string" && meta.aiChat.url.trim() ? meta.aiChat.url.trim() : DEFAULT_URL,
    provider: typeof meta.aiChat?.provider === "string" && meta.aiChat.provider.trim() ? meta.aiChat.provider.trim() : "deepseek",
  }
}

function readNoticeAck(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === "1"
  } catch {
    return false
  }
}

export function AiChatNotes({ containerId, emit, on, kmgr, browser }: PluginContext) {
  const [project, setProject] = useState<{ path: string; name: string } | null>(null)
  const [config, setConfig] = useState<AiChatConfig>({ url: DEFAULT_URL, provider: "deepseek" })
  const [urlDraft, setUrlDraft] = useState(DEFAULT_URL)
  const [paste, setPaste] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationFile[]>([])
  const [active, setActive] = useState<{ name: string; content: string } | null>(null)
  const [readingMode, setReadingMode] = useState(false)
  const [noticeAck, setNoticeAck] = useState(readNoticeAck)

  const messages: ChatMessage[] = useMemo(() => parseConversation(paste), [paste])
  const title = useMemo(() => conversationTitle(messages, project?.name ?? "对话"), [messages, project?.name])

  const metaPath = project ? joinPath(project.path, META_FILE) : ""
  const conversationsDir = project ? joinPath(project.path, CONVERSATIONS_DIR) : ""
  const activeFile = active ? conversations.find((c) => c.name === active.name) : undefined

  const loadConversations = useCallback(async () => {
    if (!kmgr || !project) return
    try {
      const entries = await kmgr.listDirectory(conversationsDir, false)
      const files = entries
        .filter((e) => !e.is_dir && e.ext.toLowerCase() === ".md")
        .map((e) => ({ name: e.name, path: e.path, modifiedAt: e.modifiedAt }))
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
      setConversations(files)
      emit("statusbar:update", { id: "ai-chat:count", value: String(files.length) })
    } catch {
      // 目录尚未创建是正常情况
      setConversations([])
      emit("statusbar:update", { id: "ai-chat:count", value: "0" })
    }
  }, [conversationsDir, emit, kmgr, project])

  const loadProject = useCallback(
    async (payload: ProjectOpenPayload) => {
      if (!kmgr) {
        setError("知识库 API 不可用")
        return
      }
      setError(null)
      setNotice(null)
      setActive(null)
      setPaste("")
      setReadingMode(false)
      try {
        const raw = await kmgr.readTextFile(joinPath(payload.path, META_FILE))
        const meta = JSON.parse(raw) as AiChatProjectMeta
        if (meta.type !== "ai-chat") throw new Error(`项目类型不是 ai-chat: ${meta.type}`)

        const cfg = normalizeConfig(meta)
        const nextMeta: AiChatProjectMeta = {
          ...meta,
          viewPlugin: PLUGIN_ID,
          aiChat: cfg,
        }
        if (meta.viewPlugin !== PLUGIN_ID || !meta.aiChat?.url) {
          await kmgr.writeTextFile(joinPath(payload.path, META_FILE), JSON.stringify(nextMeta, null, 2))
        }

        setProject({ path: payload.path, name: meta.title || payload.name })
        setConfig(cfg)
        setUrlDraft(cfg.url)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [kmgr]
  )

  useEffect(() => {
    const shouldHandle = createMultiInstanceFilter(containerId)
    const off = on<ProjectOpenPayload>("project:open", (payload) => {
      if (!shouldHandle(payload)) return
      if (payload.meta?.type !== "ai-chat") return
      void loadProject(payload)
    })
    return () => off()
  }, [containerId, loadProject, on])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  const acknowledgeNotice = useCallback(() => {
    try {
      localStorage.setItem(NOTICE_KEY, "1")
    } catch {
      // localStorage 不可用时仅本次会话忽略
    }
    setNoticeAck(true)
  }, [])

  const persistConfig = useCallback(async () => {
    if (!kmgr || !project) return
    const url = urlDraft.trim()
    if (!/^https?:\/\//i.test(url)) {
      setError("对话地址必须以 http:// 或 https:// 开头")
      return
    }
    const raw = await kmgr.readTextFile(metaPath)
    const meta = JSON.parse(raw) as AiChatProjectMeta
    const next: AiChatProjectMeta = {
      ...meta,
      viewPlugin: PLUGIN_ID,
      aiChat: { ...normalizeConfig(meta), url },
    }
    await kmgr.writeTextFile(metaPath, JSON.stringify(next, null, 2))
    setConfig(normalizeConfig(next))
    setNotice("对话地址已保存。")
  }, [kmgr, metaPath, project, urlDraft])

  const openChat = useCallback(async () => {
    setError(null)
    if (!config.url) {
      setError("请先配置对话地址")
      return
    }
    if (!browser) {
      setError("宿主未提供浏览器 API（需要 GeWu 0.36.1+）")
      return
    }
    try {
      await browser.open(config.url, { mode: "embedded" })
      emit("toast:show", { type: "success", message: "已在内嵌浏览器打开对话页" })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [browser, config.url, emit])

  const saveConversation = useCallback(async () => {
    if (!kmgr || !project) return
    if (paste.length > 2 * 1024 * 1024) {
      setError("粘贴内容超过 2 MB，请分段保存")
      return
    }
    if (messages.length === 0) {
      setError("没有解析到对话内容，请先粘贴")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await kmgr.createDirectory(conversationsDir).catch(() => {
        // 目录已存在
      })
      const now = new Date()
      const fileName = `${safeFileBase(title, now)}.md`
      const content = renderConversationMarkdown(messages, {
        title,
        source: config.url,
        capturedAt: now.toISOString(),
      })
      await kmgr.writeTextFile(joinPath(conversationsDir, fileName), content)
      setPaste("")
      setActive({ name: fileName, content })
      setNotice(`已保存：${fileName}`)
      await loadConversations()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [config.url, conversationsDir, kmgr, loadConversations, messages, project, title])

  const openConversation = useCallback(
    async (file: ConversationFile) => {
      if (!kmgr) return
      try {
        setActive({ name: file.name, content: await kmgr.readTextFile(file.path) })
        setNotice(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [kmgr]
  )

  const deleteConversation = useCallback(
    async (file: ConversationFile) => {
      if (!kmgr) return
      if (!window.confirm(`删除「${file.name}」？此操作不可撤销。`)) return
      try {
        await kmgr.deleteFile(file.path)
        if (active?.name === file.name) setActive(null)
        setNotice(`已删除：${file.name}`)
        await loadConversations()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [active?.name, kmgr, loadConversations]
  )

  const copyActive = useCallback(async () => {
    if (!active) return
    try {
      await navigator.clipboard.writeText(active.content)
      emit("toast:show", { type: "success", message: "已复制 Markdown 到剪贴板" })
    } catch (e) {
      setError(`复制失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }, [active, emit])

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData?.getData("text/html")
    if (!html) return
    const imported = parseHtmlConversation(html)
    if (imported.length === 0) return
    e.preventDefault()
    setPaste(messagesToTranscript(imported))
    setError(null)
    setNotice(`已从剪贴板 HTML 解析 ${imported.length} 段，请检查后保存。`)
  }, [])

  const renderConversationList = (compact: boolean) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {conversations.map((file) => (
        <div key={file.path} style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button
            onClick={() => void openConversation(file)}
            title={file.name}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: "left",
              fontSize: 11,
              padding: "4px 6px",
              border: "1px solid transparent",
              borderRadius: 4,
              background: "transparent",
              color: active?.name === file.name ? "var(--color-primary)" : "var(--color-text-secondary)",
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {file.name}
          </button>
          <button
            onClick={() => void deleteConversation(file)}
            title="删除"
            style={{ ...btn, padding: "2px 5px", color: "var(--color-text-disabled)" }}
          >
            删除
          </button>
        </div>
      ))}
      {!compact && conversations.length === 0 && (
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>还没有保存的对话。</div>
      )}
    </div>
  )

  if (!project) {
    return (
      <div style={{ padding: 24, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{PLUGIN_NAME}</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>
          请从文件列表打开一个「{PLUGIN_NAME}」类型的项目；或在文件列表空白处右键 → 新建项目 → 选择「{PLUGIN_NAME}」。
        </div>
        {error && <div style={{ marginTop: 12, color: "var(--color-danger, #d33)", fontSize: 12 }}>{error}</div>}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "var(--font-sans)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid var(--color-border)",
          flex: "0 0 auto",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 16 }}>💬</span>
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 120 }}>{project.name}</span>
        {readingMode ? (
          <>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>阅读模式 · 浏览器窗口可手动最小化</span>
            <button onClick={() => setReadingMode(false)} style={btn}>
              返回采集
            </button>
          </>
        ) : (
          <>
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              title="对话地址"
              style={{
                width: 220,
                fontSize: 11,
                padding: "3px 6px",
                border: "1px solid var(--color-border)",
                borderRadius: 4,
                background: "var(--color-bg-secondary)",
                color: "var(--color-text-primary)",
              }}
            />
            <button onClick={() => void persistConfig()} style={btn}>
              保存地址
            </button>
            <button onClick={() => void openChat()} style={{ ...btn, background: "var(--color-primary)", color: "var(--color-on-primary)" }}>
              打开对话
            </button>
            <button onClick={() => setReadingMode(true)} style={btn}>
              阅读
            </button>
          </>
        )}
      </div>

      {!noticeAck && (
        <div
          role="note"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            padding: "8px 12px",
            fontSize: 11,
            lineHeight: 1.6,
            background: "var(--color-warning-bg, rgba(255, 193, 7, 0.12))",
            borderBottom: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          <div style={{ flex: 1 }}>
            <strong style={{ color: "var(--color-text-primary)" }}>仅手动保存</strong>
            ：本插件不会自动读取网页。请确认你有权保存该对话，并遵守目标网站的服务条款、版权与隐私规定。
            内容默认只保存在本地项目中。
          </div>
          <button onClick={acknowledgeNotice} style={btn}>
            我已知晓
          </button>
        </div>
      )}

      {(error || notice) && (
        <div style={{ padding: "6px 12px", fontSize: 12, color: error ? "var(--color-danger, #d33)" : "var(--color-text-secondary)" }}>
          {error ?? notice}
        </div>
      )}

      {readingMode ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, padding: 12 }}>
          <aside style={{ width: 220, flex: "0 0 220px", overflow: "auto" }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>已保存（{conversations.length}）</div>
            {conversations.length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>还没有保存的对话。</div>
            ) : (
              renderConversationList(true)
            )}
          </aside>
          <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {active ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {active.name}
                  </div>
                  <button onClick={() => void copyActive()} style={btn}>
                    复制 Markdown
                  </button>
                  {activeFile && (
                    <button onClick={() => void deleteConversation(activeFile)} style={btn}>
                      删除
                    </button>
                  )}
                </div>
                <pre
                  style={{
                    flex: 1,
                    minHeight: 0,
                    margin: 0,
                    padding: 10,
                    overflow: "auto",
                    fontSize: 12,
                    lineHeight: 1.6,
                    background: "var(--color-bg-secondary)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 4,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {active.content}
                </pre>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>从左侧选择一条已保存的对话。</div>
            )}
          </main>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            从对话页复制内容后粘贴到下面（支持直接粘贴网页富文本，或 <code>## User</code> / <code>**User**</code> / <code>User:</code> 等角色标记），
            保存为项目内 Markdown。本版本不自动读取网页。
          </div>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            onPaste={handlePaste}
            placeholder="粘贴对话内容…"
            style={{
              width: "100%",
              minHeight: 150,
              resize: "vertical",
              padding: 8,
              fontSize: 12,
              lineHeight: 1.5,
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              background: "var(--color-bg-secondary)",
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-mono, monospace)",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => void saveConversation()} disabled={saving} style={{ ...btn, background: "var(--color-primary)", color: "var(--color-on-primary)" }}>
              {saving ? "保存中…" : "保存对话"}
            </button>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
              {messages.length > 0 ? `解析到 ${messages.length} 段 · ${title}` : "尚未解析到内容"}
            </span>
          </div>

          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>已保存对话（{conversations.length}）</div>
            {renderConversationList(false)}
          </div>

          {active && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {active.name}
                </div>
                <button onClick={() => void copyActive()} style={btn}>
                  复制 Markdown
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 8,
                  maxHeight: 260,
                  overflow: "auto",
                  fontSize: 11,
                  lineHeight: 1.5,
                  background: "var(--color-bg-secondary)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 4,
                  whiteSpace: "pre-wrap",
                }}
              >
                {active.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const btn: CSSProperties = {
  fontSize: 11,
  padding: "3px 8px",
  border: "1px solid var(--color-border)",
  borderRadius: 4,
  background: "transparent",
  color: "var(--color-text-secondary)",
  cursor: "pointer",
}

export const aiChatNotesPlugin: PluginManifest = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  icon: "💬",
  component: AiChatNotes,
  emits: ["toast:show", "statusbar:update"],
  handles: ["project:open"],
  projectTypes: ["ai-chat"],
  projectTypeDescriptors: [{ id: "ai-chat", label: PLUGIN_NAME, icon: "💬" }],
  capabilities: ["kmgr:read", "kmgr:write"],
  minAppVersion: "0.36.1",
  version: "0.1.2",
  description: "手动保存 AI 网页对话到本地项目：粘贴、预览、阅读、删除/复制 Markdown",
  author: "GeWu 第三方插件试点",
  statusBarItems: [{ id: "ai-chat:count", label: "摘录", value: "-", priority: 46, align: "right" }],
}

export default aiChatNotesPlugin

