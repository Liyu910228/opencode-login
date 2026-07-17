const http = require("http")
const net = require("net")
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const childProcess = require("child_process")
const zlib = require("zlib")

const LISTEN_HOST = "0.0.0.0"
const LISTEN_PORT = 4096
const UPSTREAM_HOST = "127.0.0.1"
const UPSTREAM_PORT = 4097
const USERNAME = process.env.LOGIN_USERNAME || "opencode"
const PASSWORD = process.env.LOGIN_PASSWORD
const SECRET = process.env.LOGIN_COOKIE_SECRET
if (!PASSWORD || !SECRET) {
  throw new Error("LOGIN_PASSWORD and LOGIN_COOKIE_SECRET are required")
}
const COOKIE_NAME = "opencode_login"
const TERMINAL_COOKIE_NAME = "opencode_terminal"
const TERMINAL_PASSWORD = process.env.SERVER_TERMINAL_PASSWORD || PASSWORD
const CONFIG_DIR = "/var/lib/opencode/.config/opencode"
const CONFIG_PATH = path.join(CONFIG_DIR, "opencode.json")
const SKILLS_DIR = path.join(CONFIG_DIR, "skills")
const LOCAL_PROJECTS_DIR =
  "/opt/service-management/copied-services/8.160.163.200/opencode-web-20260528-053907/files/opt/opencode-workspace/local-projects"
const WORKSPACE_PROJECTS_DIR = path.dirname(LOCAL_PROJECTS_DIR)
const PROJECT_PREVIEW_ROOTS = [LOCAL_PROJECTS_DIR, WORKSPACE_PROJECTS_DIR]
const PREVIEW_DIR = "/srv/opencode-previews"
const PROJECT_PREVIEW_DIRNAME = ".public-preview"
const PREVIEW_BASE_PATH = "/preview"
const PREVIEW_PUBLIC_BASE_URL = process.env.PREVIEW_PUBLIC_BASE_URL || PREVIEW_BASE_PATH
const FIXED_PROJECT_DIR =
  process.env.OPENCODE_FIXED_PROJECT_DIR || path.join(LOCAL_PROJECTS_DIR, "innovation-business-dashboard")
const ASSET_CACHE = new Map()

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
}

function sign(value) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex")
}

function sessionValue() {
  const value = USERNAME + ":" + Date.now()
  return value + "." + sign(value)
}

function isAuthed(req) {
  const cookie = req.headers.cookie || ""
  const match = cookie.match(new RegExp(COOKIE_NAME + "=([^;]+)"))
  if (!match) return false
  const raw = decodeURIComponent(match[1])
  const dot = raw.lastIndexOf(".")
  if (dot < 0) return false
  const value = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  return sig === sign(value) && value.indexOf(USERNAME + ":") === 0
}

function isTerminalAuthed(req) {
  const cookie = req.headers.cookie || ""
  const match = cookie.match(new RegExp(TERMINAL_COOKIE_NAME + "=([^;]+)"))
  if (!match) return false
  const raw = decodeURIComponent(match[1])
  const dot = raw.lastIndexOf(".")
  if (dot < 0) return false
  const value = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  return sig === sign(value) && value.indexOf("terminal:") === 0
}

function terminalSessionValue() {
  const value = "terminal:" + Date.now()
  return value + "." + sign(value)
}

function parseBody(req, callback) {
  let data = ""
  req.on("data", function (chunk) {
    data += chunk
    if (data.length > 1024 * 1024) req.destroy()
  })
  req.on("end", function () {
    callback(new URLSearchParams(data))
  })
}

function parseJson(req, callback) {
  let data = ""
  req.on("data", function (chunk) {
    data += chunk
    if (data.length > 1024 * 1024) req.destroy()
  })
  req.on("end", function () {
    try {
      callback(null, data ? JSON.parse(data) : {})
    } catch (err) {
      callback(err)
    }
  })
}

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

function sendShellCss(res) {
  res.writeHead(200, {
    "content-type": "text/css; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(`
body.dataagent-shell-ready #root > div:first-child > header {
  display: none !important;
}

body.dataagent-shell-ready #root header {
  display: none !important;
}

/* 隐藏最左侧 workspace 项目栏,保留会话区 */
body.dataagent-shell-ready nav[aria-label] div.w-16.shrink-0 {
  display: none !important;
}

/* 会话区顶栏:替换为 logo + snowharness,高度加高 */
body.dataagent-shell-ready nav[aria-label] div[class*="rounded-tl"] > div.shrink-0[data-snowharness-header="1"] {
  height: 72px !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
}
.snowharness-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 100%;
  padding: 0 16px;
}
.snowharness-logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
  flex-shrink: 0;
}
.snowharness-name {
  font-size: 17px;
  font-weight: 650;
  letter-spacing: 0.2px;
  color: var(--text-strong, #111);
}
/* 落地页 logo 呼吸动画(一暗一暗,模仿 opencode 原加载效果) */
.snowharness-landing-logo {
  animation: snowharness-breathe 2.4s ease-in-out infinite;
}
@keyframes snowharness-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@media (prefers-reduced-motion: reduce) {
  .snowharness-landing-logo { animation: none; }
}

/* 空会话欢迎页:加载时提前隐藏原内容,避免 JS 改造前闪现原样。
   基于 1.14.48 session-new-view.tsx 结构:max-w-200 容器内 gap-6 是 logo+标题,gap-4 是信息区。
   - logo(gap-6 内标题前的 svg)隐藏
   - 信息区(gap-6 的兄弟 gap-4 容器)隐藏
   - 标题加载时不可见,JS 改完文字后恢复显示(避免闪现"构建任何东西") */
main div.max-w-200 > div.gap-6 > svg:first-child { display: none !important; }
main div.max-w-200 > div.gap-4 { display: none !important; }
main div.max-w-200 > div.gap-6 > div.text-text-strong { visibility: hidden; }

/* 空状态:保留主内容区原始高度,只把聊天框上移到标题下方。
   不能改 NewSessionView 的 flex/padding,否则会把整块浅灰底容器压短,出现上下两段底色。
   这里保留标题位置微调,聊天框单独通过 session-prompt-dock 上移。 */
main div.pb-30.flex.items-center.justify-center:has(> div.max-w-200) {
  align-items: flex-start !important;
  padding-top: 200px !important;
}
main div.flex.flex-col:has(> div.flex-1 div.max-w-200) > [data-component="session-prompt-dock"] {
  position: relative;
  transform: translateY(-116px);
  z-index: 5;
}

/* 会话面板占满侧边栏宽度(跟随拖拽)。
   源码:panel 宽度 = sidebar.width - 64(sidebar-rail 宽),但 rail 已用 CSS 隐藏,
   所以 panel 应占满父级(flex-1)。覆盖内联 width,让 panel = 100%,拖拽时跟随父级宽度变化。 */
nav[aria-label] div.flex-1.flex.h-full > div[style*="width"] {
  width: 100% !important;
}
`)

}

function sendPreflightJs(res) {
  res.writeHead(200, {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(`
(function () {
  "use strict"

  var layoutKey = "opencode.global.dat:layout"

  // 规范 layout:展开 sidebar、折叠 workspace 栏(保留会话列表)、关闭审查面板和终端。
  // 经验证:workspace 折叠状态(workspacesDefault=false)下会话列表才正常渲染,
  // workspace 栏的 DOM 隐藏由 CSS(div.w-16.shrink-0 { display:none })处理。
  // sidebar.opened 强制展开:1.14.48 下 sidebar 折叠时整个会话面板不渲染,
  // 新用户默认折叠会看不到会话列表;width 仍交给 opencode 自管。
  function normalizeLayout() {
    try {
      var raw = localStorage.getItem(layoutKey)
      var layout = raw ? JSON.parse(raw) : {}
      if (!layout || typeof layout !== "object" || Array.isArray(layout)) layout = {}
      if (!layout.sidebar || typeof layout.sidebar !== "object" || Array.isArray(layout.sidebar)) layout.sidebar = {}
      if (!layout.review || typeof layout.review !== "object" || Array.isArray(layout.review)) layout.review = {}
      if (!layout.terminal || typeof layout.terminal !== "object" || Array.isArray(layout.terminal)) layout.terminal = {}

      var changed = false
      // sidebar 强制展开(见函数头注释)
      if (layout.sidebar.opened !== true) { layout.sidebar.opened = true; changed = true }
      // workspace 全折叠(会话列表在此状态下渲染)
      if (layout.sidebar.workspacesDefault !== false) { layout.sidebar.workspacesDefault = false; changed = true }
      if (!layout.sidebar.workspaces || typeof layout.sidebar.workspaces !== "object") layout.sidebar.workspaces = {}
      Object.keys(layout.sidebar.workspaces).forEach(function (key) {
        if (layout.sidebar.workspaces[key] !== false) { layout.sidebar.workspaces[key] = false; changed = true }
      })
      if (!layout.workspaceExpanded || typeof layout.workspaceExpanded !== "object") layout.workspaceExpanded = {}
      Object.keys(layout.workspaceExpanded).forEach(function (key) {
        if (layout.workspaceExpanded[key] !== false) { layout.workspaceExpanded[key] = false; changed = true }
      })
      // review:关闭审查面板(默认会打开,占满屏幕)
      if (layout.review.panelOpened !== false) { layout.review.panelOpened = false; changed = true }
      // terminal:关闭终端
      if (layout.terminal.opened !== false) { layout.terminal.opened = false; changed = true }

      if (changed) localStorage.setItem(layoutKey, JSON.stringify(layout))
    } catch (err) {}
  }

  // 1.14.48 新用户首次访问时 SPA 不会自动打开/激活默认 project:sidebar-rail 无项目图标、
  // 会话面板停在 getting-started 空态,会话列表不渲染(同事清缓存后看不到会话列表的根因)。
  // 按当前 URL 的目录预设已打开项目。每个项目目录都有独立会话列表，不能总是覆盖成固定项目。
  function normalizeProject() {
    try {
      var origin = location.origin
      var dir = currentProjectDirectory()
      var serverKey = "opencode.global.dat:server"
      var server = {}
      try { server = JSON.parse(localStorage.getItem(serverKey) || "{}") } catch (e) {}
      if (!server || typeof server !== "object" || Array.isArray(server)) server = {}
      if (!server.projects) server.projects = {}
      if (!server.projects[origin]) server.projects[origin] = []
      var arr = server.projects[origin]
      var exists = false
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].worktree === dir) { arr[i].expanded = true; exists = true; break }
      }
      if (!exists) arr.push({ worktree: dir, expanded: true })
      if (!server.lastProject) server.lastProject = {}
      server.lastProject[origin] = dir
      localStorage.setItem(serverKey, JSON.stringify(server))
    } catch (err) {}
  }

  function currentProjectDirectory() {
    var segment = location.pathname.split("/").filter(Boolean)[0]
    if (!segment) return ${JSON.stringify(FIXED_PROJECT_DIR)}
    try {
      var normalized = segment.replace(/-/g, "+").replace(/_/g, "/")
      normalized += "=".repeat((4 - normalized.length % 4) % 4)
      var binary = atob(normalized)
      var bytes = new Uint8Array(binary.length)
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      var dir = new TextDecoder().decode(bytes)
      return dir && dir.charAt(0) === "/" ? dir : ${JSON.stringify(FIXED_PROJECT_DIR)}
    } catch (err) {
      return ${JSON.stringify(FIXED_PROJECT_DIR)}
    }
  }

  normalizeLayout()
  normalizeProject()
})()
`)
}

function sendEntryJs(res) {
  res.writeHead(200, {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(`
(function () {
  "use strict"

  var BRAND_TITLE = "SnowHarness"
  document.title = BRAND_TITLE
  // 持续守护 title:opencode 运行时会把它改成会话标题/OpenCode,改回 SnowHarness
  try {
    var titleEl = document.querySelector("title")
    if (titleEl) {
      new MutationObserver(function () {
        if (document.title !== BRAND_TITLE) document.title = BRAND_TITLE
      }).observe(titleEl, { childList: true, characterData: true, subtree: true })
    }
  } catch (e) {}

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true })
    else fn()
  }

  function currentProjectDirectory() {
    var segment = location.pathname.split("/").filter(Boolean)[0]
    if (!segment) return ${JSON.stringify(FIXED_PROJECT_DIR)}
    try {
      var normalized = segment.replace(/-/g, "+").replace(/_/g, "/")
      normalized += "=".repeat((4 - normalized.length % 4) % 4)
      var binary = atob(normalized)
      var bytes = new Uint8Array(binary.length)
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      var dir = new TextDecoder().decode(bytes)
      return dir && dir.charAt(0) === "/" ? dir : ${JSON.stringify(FIXED_PROJECT_DIR)}
    } catch (err) {
      return ${JSON.stringify(FIXED_PROJECT_DIR)}
    }
  }

  // 1.14.48 + login proxy 架构:URL 形如 /<base64>/session,pathname 永远不是 "/"。
  // 旧版 openDefaultSession 用 pathname==="/" 判断 + 裸 /session fetch + "/#/session/" 跳转,全失效:
  //   1) 触发条件永不满足;2) 裸 /session 返回 HTML 不是 JSON;3) "/#/session/" 丢 base 路径。
  // 新版:无有效 session hash 时,按当前 URL 对应的项目目录查 /session?directory=... 拿最新会话,
  // 跳到 <当前 path>#/session/<id>(保留 base)。SPA 因 normalizeProject 已激活 project,可正常渲染。
  function openDefaultSession() {
    if (location.hash && location.hash.indexOf("#/session/") === 0) return
    // 临时调试:设 sessionStorage __snowharness_debug=1 可暂停自动跳转,便于观察落地页
    if (sessionStorage.getItem("__snowharness_debug") === "1") return
    var dir = currentProjectDirectory()
    var base = location.pathname + location.search
    fetch("/session?directory=" + encodeURIComponent(dir) + "&roots=true&limit=55", { headers: { accept: "application/json" } })
      .then(function (response) { return response.json() })
      .then(function (sessions) {
        var list = Array.isArray(sessions) ? sessions : []
        var local = list.filter(function (item) {
          return item && item.directory && item.directory !== "/"
        })
        local.sort(function (left, right) {
          return ((right.time && right.time.updated) || 0) - ((left.time && left.time.updated) || 0)
        })
        if (local.length) {
          location.replace(base + "#/session/" + local[0].id)
          return
        }
        return fetch("/session?directory=" + encodeURIComponent(dir), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
          .then(function (response) { return response.json() })
          .then(function (session) {
            if (session && session.id) location.replace(base + "#/session/" + session.id)
          })
      })
      .catch(function () {})
  }

  function replaceVisibleText(root) {
    var walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        if (/^(A|SCRIPT|STYLE|TEXTAREA|INPUT|CODE|PRE)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT
        if (parent.closest("[role='log'], [data-message-id]")) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    })
    var node
    while ((node = walker.nextNode())) {
      var value = node.nodeValue
      var trimmed = value.trim()
      var next = value
      if (trimmed === "OpenCode" || trimmed === "OpenCode Desktop") next = value.replace(trimmed, "SnowHarness")
      if (trimmed === "No projects open") next = value.replace(trimmed, "正在打开默认会话")
      if (trimmed === "Open a project to get started") next = value.replace(trimmed, "进入工作台后即可继续对话")
      if (trimmed === "119.45.222.120:4096") next = value.replace(trimmed, "SnowHarness 工作台")
      if (next !== value) node.nodeValue = next
    }
  }

  function softenLanding() {
    // 落地页大 logo(原 opencode 标识)替换为 snowharness logo
    document.querySelectorAll("main img, [role='main'] img").forEach(function (image) {
      var rect = image.getBoundingClientRect()
      if (rect.width > 240 && rect.height > 50) {
        if (image.getAttribute("data-snowharness-logo") !== "1") {
          image.setAttribute("data-snowharness-logo", "1")
          image.src = "/snowharness-logo.png"
          image.srcset = ""
          image.style.display = ""
          image.style.maxWidth = "180px"
          image.style.height = "auto"
          image.style.objectFit = "contain"
        }
      }
    })
    // 落地页中央的 opencode logo(一个 64x80 的内联 SVG,在 h-dvh w-screen 居中容器内)
    // 替换为 snowharness logo 并放大显示
    document.querySelectorAll("svg").forEach(function (svg) {
      var rect = svg.getBoundingClientRect()
      var parent = svg.parentElement
      var parentCls = parent ? (parent.className && parent.className.toString ? parent.className.toString() : "") : ""
      // 命中条件:高度>40 且父容器是落地页居中布局(h-dvh w-screen / items-center)
      var isLandingCentered = parentCls.indexOf("items-center") >= 0 && (parentCls.indexOf("h-dvh") >= 0 || parentCls.indexOf("w-screen") >= 0)
      if (rect.height > 40 && isLandingCentered && svg.getAttribute("data-snowharness-covered") !== "1") {
        svg.setAttribute("data-snowharness-covered", "1")
        svg.style.display = "none"
        if (!svg.previousElementSibling || !svg.previousElementSibling.classList || !svg.previousElementSibling.classList.contains("snowharness-landing-logo")) {
          var img = document.createElement("img")
          img.src = "/snowharness-logo.png"
          img.className = "snowharness-landing-logo"
          img.style.width = "120px"
          img.style.height = "auto"
          img.style.objectFit = "contain"
          svg.parentNode.insertBefore(img, svg)
        }
      }
    })
    document.querySelectorAll("button").forEach(function (button) {
      if (/SnowHarness 工作台|119\\.45\\.222\\.120/.test(button.textContent || "")) {
        button.setAttribute("data-dataagent-muted", "true")
      }
    })
  }

  function trimShellWhenReady() {
    var hasSessionLayout = location.pathname !== "/" && document.querySelector("nav[aria-label]")
    var hasMainContent = document.querySelector("main [role='log'], main textarea, main [role='textbox']")
    document.body.classList.toggle("dataagent-shell-ready", Boolean(hasSessionLayout && hasMainContent))
  }

  // 把会话区顶栏(项目标识 + 三个点)替换成 logo + snowharness
  function replaceSidebarHeader() {
    var nav = document.querySelector("nav[aria-label]")
    if (!nav) return
    // 会话面板:NAV 内带 rounded-tl 的 div
    var panel = nav.querySelector("div[class*='rounded-tl']")
    if (!panel) return
    var header = panel.querySelector(":scope > div.shrink-0")
    if (!header) return
    if (header.getAttribute("data-snowharness-header") === "1") return
    header.setAttribute("data-snowharness-header", "1")
    header.innerHTML =
        '<div class="snowharness-brand">' +
        '<img class="snowharness-logo" src="/snowharness-logo.png" alt="SnowHarness" />' +
        '<span class="snowharness-name">SnowHarness</span>' +
      '</div>'
  }

  // 空会话欢迎页:隐藏 logo,标题改文案,隐藏项目目录/主分支/最后修改时间
  // 基于 1.14.48 session-new-view.tsx 源码结构,精准定位,不全局扫描。
  // 结构:div.gap-6 > [svg(logo), div.text-text-strong(标题)];gap-6 的兄弟 div.gap-4 是信息区。
  function decorateEmptyState() {
    // 只在找到"构建任何东西"标题时才处理,确保是空状态页
    var titleEl = null
    var candidates = document.querySelectorAll("main div.text-text-strong, main div[class*='text-20-medium']")
    for (var i = 0; i < candidates.length; i++) {
      if ((candidates[i].textContent || "").trim() === "构建任何东西") { titleEl = candidates[i]; break }
    }
    if (!titleEl) return
    var block = titleEl.parentElement  // gap-6 容器
    if (!block || (block.className || "").toString().indexOf("gap-6") < 0) return

    // 1. 隐藏 logo(block 内标题之前的 svg)
    var prev = titleEl.previousElementSibling
    while (prev) {
      if (prev.tagName === "svg" || prev.tagName.toLowerCase() === "svg") {
        if (prev.getAttribute("data-sh-hidden") !== "1") {
          prev.setAttribute("data-sh-hidden", "1")
          prev.style.display = "none"
        }
        break
      }
      prev = prev.previousElementSibling
    }

    // 2. 标题改文案,并恢复显示(CSS 加载时设了 visibility:hidden 避免闪现原文字)
    if (titleEl.getAttribute("data-sh-retitled") !== "1") {
      titleEl.setAttribute("data-sh-retitled", "1")
      titleEl.textContent = "你想聊点什么?"
    }
    titleEl.style.visibility = "visible"

    // 3. 隐藏信息区(gap-6 的下一个兄弟:项目目录/主分支/最后修改时间)
    var sibling = block.nextElementSibling
    while (sibling) {
      var cls = (sibling.className || "").toString()
      // 信息区是 div.w-full.flex.flex-col...gap-4
      if (sibling.tagName.toLowerCase() === "div" && cls.indexOf("flex") >= 0 && cls.indexOf("flex-col") >= 0 && cls.indexOf("gap-4") >= 0) {
        if (sibling.getAttribute("data-sh-hidden") !== "1") {
          sibling.setAttribute("data-sh-hidden", "1")
          sibling.style.display = "none"
        }
        break
      }
      sibling = sibling.nextElementSibling
    }
  }

  function decorate() {
    replaceVisibleText(document.body)
    softenLanding()
    trimShellWhenReady()
    replaceSidebarHeader()
    decorateEmptyState()
  }

  ready(function () {
    decorate()
    openDefaultSession()
    var timer = 0
    new MutationObserver(function () {
      clearTimeout(timer)
      timer = setTimeout(decorate, 80)
    }).observe(document.body, { childList: true, subtree: true, characterData: true })
  })
})()
`)
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function ensurePreviewDir() {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true })
}

function insideDir(rootPath, targetPath) {
  const root = path.resolve(rootPath)
  const target = path.resolve(targetPath)
  return target === root || target.indexOf(root + path.sep) === 0
}

function previewSegments(req) {
  const pathname = new URL(req.url, "http://localhost").pathname
  if (pathname !== PREVIEW_BASE_PATH && pathname.indexOf(PREVIEW_BASE_PATH + "/") !== 0) return null
  const raw = pathname.slice(PREVIEW_BASE_PATH.length).replace(/^\/+/, "")
  if (!raw) return []
  try {
    return raw
      .split("/")
      .filter(Boolean)
      .map(function (part) {
        return decodeURIComponent(part)
      })
      .filter(function (part) {
        return part && part !== "." && part !== ".."
      })
  } catch (err) {
    return null
  }
}

function findProjectPreview(projectName) {
  for (const rootDir of PROJECT_PREVIEW_ROOTS) {
    const projectDir = path.join(rootDir, projectName)
    const basePath = path.join(projectDir, PROJECT_PREVIEW_DIRNAME)
    if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) continue
    if (!fs.existsSync(basePath) || !fs.statSync(basePath).isDirectory()) continue
    return {
      projectDir: projectDir,
      basePath: basePath,
      rootDir: rootDir,
    }
  }
  return null
}

function listProjectPreviewEntries() {
  const entries = []
  const seen = new Set()
  for (const rootDir of PROJECT_PREVIEW_ROOTS) {
    if (!fs.existsSync(rootDir)) continue
    for (const item of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (!item.isDirectory()) continue
      if (seen.has(item.name)) continue
      const previewRoot = path.join(rootDir, item.name, PROJECT_PREVIEW_DIRNAME)
      if (!fs.existsSync(previewRoot) || !fs.statSync(previewRoot).isDirectory()) continue
      seen.add(item.name)
      entries.push({
        name: item.name,
        href: previewHref([item.name], true),
        kind: "project",
      })
    }
  }
  return entries
}

function previewRequestInfo(req) {
  const parts = previewSegments(req)
  if (!parts) return null
  if (!parts.length) {
    return {
      kind: "root",
      title: "DataAgent 公开预览",
      hrefParts: [],
    }
  }

  const projectName = parts[0]
  const projectPreview = findProjectPreview(projectName)
  if (projectPreview) {
    const relativeParts = parts.slice(1)
    const resolvedPath = path.resolve(projectPreview.basePath, relativeParts.join("/"))
    if (!insideDir(projectPreview.basePath, resolvedPath)) return null
    return {
      kind: "project",
      title: "DataAgent 预览 / " + parts.join("/"),
      projectName: projectName,
      basePath: projectPreview.basePath,
      hrefParts: parts,
      relativeParts: relativeParts,
      relativePath: relativeParts.join("/"),
      resolvedPath: resolvedPath,
    }
  }

  ensurePreviewDir()
  const resolvedPath = path.resolve(PREVIEW_DIR, parts.join("/"))
  if (!insideDir(PREVIEW_DIR, resolvedPath)) return null
  return {
    kind: "legacy",
    title: "DataAgent 预览 / " + parts.join("/"),
    basePath: PREVIEW_DIR,
    hrefParts: parts,
    relativeParts: parts,
    relativePath: parts.join("/"),
    resolvedPath: resolvedPath,
  }
}

function previewHref(parts, isDirectory) {
  const safe = parts
    .filter(Boolean)
    .map(function (part) {
      return encodeURIComponent(part)
    })
    .join("/")
  let href = PREVIEW_BASE_PATH
  if (safe) href += "/" + safe
  if (isDirectory && href[href.length - 1] !== "/") href += "/"
  return href
}

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream"
}

function sendPreviewRoot(res) {
  ensurePreviewDir()
  const projectEntries = listProjectPreviewEntries()

  const legacyEntries = fs
    .readdirSync(PREVIEW_DIR, { withFileTypes: true })
    .map(function (item) {
      return {
        name: item.name + (item.isDirectory() ? "/" : ""),
        href: previewHref([item.name], item.isDirectory()),
        kind: "legacy",
      }
    })

  const allEntries = projectEntries.concat(legacyEntries)
  const list = allEntries.length
    ? allEntries
        .map(function (item) {
          const label = item.kind === "project" ? "项目预览 · " + item.name + "/" : "公共目录 · " + item.name
          return '<li><a href="' + item.href + '">' + escapeHtml(label) + "</a></li>"
        })
        .join("")
    : '<li class="empty">当前还没有可访问的公开预览。</li>'

  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DataAgent 公开预览</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7fb;
      --card: #ffffff;
      --ink: #111827;
      --muted: #6b7280;
      --line: #dbe3ef;
      --accent: #0f766e;
      --accent-soft: #ccfbf1;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 18px;
      background: radial-gradient(circle at top, #e6fffb, transparent 30%), var(--bg);
      color: var(--ink);
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .card {
      max-width: 880px;
      margin: 0 auto;
      padding: 28px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: var(--card);
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
    }
    p {
      margin: 0 0 16px;
      color: var(--muted);
    }
    .meta {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 14px;
      margin-bottom: 18px;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      border-top: 1px solid var(--line);
    }
    li {
      border-bottom: 1px solid var(--line);
    }
    li a, .empty {
      display: block;
      padding: 14px 0;
      color: inherit;
      text-decoration: none;
    }
    li a:hover {
      color: var(--accent);
    }
    .empty {
      color: var(--muted);
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="meta">公开目录 · <code>${escapeHtml(PREVIEW_PUBLIC_BASE_URL)}</code></div>
    <h1>DataAgent 公开预览</h1>
    <p>项目内预览使用 <code>项目目录/.public-preview/</code>，再通过公网路由映射出来。</p>
    <ul>${list}</ul>
  </main>
</body>
</html>`)
}

function sendPreviewListing(res, info, diskPath) {
  const entries = fs
    .readdirSync(diskPath, { withFileTypes: true })
    .map(function (item) {
      return {
        name: item.name,
        isDirectory: item.isDirectory(),
      }
    })
    .sort(function (a, b) {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  const list = entries.length
    ? entries
        .map(function (item) {
          const childParts = info.hrefParts.concat(item.name)
          const suffix = item.isDirectory ? "/" : ""
          return (
            '<li><a href="' +
            previewHref(childParts, item.isDirectory) +
            '">' +
            escapeHtml(item.name + suffix) +
            "</a></li>"
          )
        })
        .join("")
    : '<li class="empty">当前目录还没有可预览内容。</li>'

  const parentParts = info.hrefParts.slice(0, -1)
  const parentLink = info.hrefParts.length ? '<a class="back" href="' + previewHref(parentParts, true) + '">返回上一级</a>' : ""

  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(info.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7fb;
      --card: #ffffff;
      --ink: #111827;
      --muted: #6b7280;
      --line: #dbe3ef;
      --accent: #0f766e;
      --accent-soft: #ccfbf1;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 18px;
      background: radial-gradient(circle at top, #e6fffb, transparent 30%), var(--bg);
      color: var(--ink);
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .card {
      max-width: 880px;
      margin: 0 auto;
      padding: 28px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: var(--card);
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
    }
    p {
      margin: 0 0 16px;
      color: var(--muted);
    }
    .meta {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 14px;
      margin-bottom: 18px;
    }
    .back {
      display: inline-block;
      margin-bottom: 18px;
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      border-top: 1px solid var(--line);
    }
    li {
      border-bottom: 1px solid var(--line);
    }
    li a, .empty {
      display: block;
      padding: 14px 0;
      color: inherit;
      text-decoration: none;
    }
    li a:hover {
      color: var(--accent);
    }
    .empty {
      color: var(--muted);
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="meta">公开目录 · <code>${escapeHtml(PREVIEW_PUBLIC_BASE_URL)}</code></div>
    <h1>${escapeHtml(info.title)}</h1>
    <p>这里展示通过 DataAgent 生成并发布出来的可直接访问页面。</p>
    ${parentLink}
    <ul>${list}</ul>
  </main>
</body>
</html>`)
}

function sendPreviewFile(req, res, filePath) {
  const stream = fs.createReadStream(filePath)
  stream.on("error", function () {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" })
    res.end("Preview file could not be read.")
  })
  res.writeHead(200, {
    "content-type": contentType(filePath),
    "cache-control": "no-store",
  })
  if (req.method === "HEAD") {
    res.end()
    stream.destroy()
    return
  }
  stream.pipe(res)
}

function handlePreview(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" })
    res.end()
    return
  }

  const info = previewRequestInfo(req)
  if (!info) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" })
    res.end("Invalid preview path.")
    return
  }

  if (info.kind === "root") {
    sendPreviewRoot(res)
    return
  }

  if (info.kind === "legacy") ensurePreviewDir()
  if (!fs.existsSync(info.resolvedPath)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
    res.end("Preview not found.")
    return
  }

  const stats = fs.statSync(info.resolvedPath)
  if (stats.isDirectory()) {
    const indexPath = path.join(info.resolvedPath, "index.html")
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      sendPreviewFile(req, res, indexPath)
      return
    }
    sendPreviewListing(res, info, info.resolvedPath)
    return
  }

  sendPreviewFile(req, res, info.resolvedPath)
}

function ensureConfigDirs() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.mkdirSync(SKILLS_DIR, { recursive: true })
}

function readConfigText() {
  ensureConfigDirs()
  if (!fs.existsSync(CONFIG_PATH)) return "{\n  \"mcp\": {},\n  \"plugin\": []\n}\n"
  return fs.readFileSync(CONFIG_PATH, "utf8")
}

function readSkills() {
  ensureConfigDirs()
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(function (item) {
      return item.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, item.name, "SKILL.md"))
    })
    .map(function (item) {
      return {
        name: item.name,
        content: fs.readFileSync(path.join(SKILLS_DIR, item.name, "SKILL.md"), "utf8"),
      }
    })
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function chownConfigBestEffort() {
  childProcess.exec("chown -R opencode:opencode /var/lib/opencode/.config/opencode", function () {})
}

function base64Url(value) {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function authCookie() {
  return COOKIE_NAME + "=" + encodeURIComponent(sessionValue()) + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400"
}

function fixedProjectPath() {
  return "/" + base64Url(FIXED_PROJECT_DIR)
}

function fixedProjectSessionPath() {
  return fixedProjectPath() + "/session"
}

function redirectWithAuth(res, location) {
  res.writeHead(302, {
    location: location,
    "set-cookie": authCookie(),
    "cache-control": "no-store",
  })
  res.end()
}

function redirectWithoutAuth(res, location, extraCookies) {
  const headers = {
    location: location,
    "cache-control": "no-store",
  }
  if (extraCookies) headers["set-cookie"] = extraCookies
  res.writeHead(302, headers)
  res.end()
}

function requestPathname(req) {
  return new URL(req.url, "http://localhost").pathname
}

function parseMultipart(req, callback) {
  const contentType = req.headers["content-type"] || ""
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
  if (!match) return callback(new Error("missing multipart boundary"))
  const boundary = Buffer.from("--" + (match[1] || match[2]))
  const chunks = []
  let size = 0
  req.on("data", function (chunk) {
    size += chunk.length
    if (size > 250 * 1024 * 1024) {
      req.destroy()
      return
    }
    chunks.push(chunk)
  })
  req.on("end", function () {
    const body = Buffer.concat(chunks)
    const fields = {}
    const files = {}
    let start = body.indexOf(boundary)
    while (start >= 0) {
      start += boundary.length
      if (body[start] === 45 && body[start + 1] === 45) break
      if (body[start] === 13 && body[start + 1] === 10) start += 2
      const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), start)
      if (headerEnd < 0) break
      const header = body.slice(start, headerEnd).toString("utf8")
      const next = body.indexOf(boundary, headerEnd + 4)
      if (next < 0) break
      let content = body.slice(headerEnd + 4, next)
      if (content.length >= 2 && content[content.length - 2] === 13 && content[content.length - 1] === 10) {
        content = content.slice(0, content.length - 2)
      }
      const nameMatch = header.match(/name="([^"]+)"/)
      const filenameMatch = header.match(/filename="([^"]*)"/)
      if (nameMatch) {
        if (filenameMatch && filenameMatch[1]) files[nameMatch[1]] = { filename: filenameMatch[1], content: content }
        else fields[nameMatch[1]] = content.toString("utf8")
      }
      start = next
    }
    callback(null, fields, files)
  })
  req.on("error", callback)
}

function extractZip(zipPath, destDir, callback) {
  const script = [
    "import os, sys, zipfile",
    "zip_path, dest = sys.argv[1], sys.argv[2]",
    "os.makedirs(dest, exist_ok=True)",
    "root = os.path.abspath(dest)",
    "with zipfile.ZipFile(zip_path) as z:",
    "    for info in z.infolist():",
    "        name = info.filename.replace('\\\\', '/')",
    "        if not name or name.startswith('/') or '..' in name.split('/'):",
    "            raise SystemExit('unsafe zip path: ' + info.filename)",
    "        target = os.path.abspath(os.path.join(root, name))",
    "        if not target.startswith(root + os.sep) and target != root:",
    "            raise SystemExit('unsafe zip path: ' + info.filename)",
    "    z.extractall(root)",
  ].join("\n")
  childProcess.execFile("python3", ["-c", script, zipPath, destDir], callback)
}

function sendLogin(res, error) {
  res.writeHead(error ? 401 : 200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DataAgent 登录</title>
  <style>
    :root {
      --red: #d9123f;
      --red-dark: #b80d33;
      --cyan: #00d7ff;
      --ink: #131722;
      --muted: #7e8593;
      --line: #e9edf3;
      --paper: #ffffff;
      font-family: Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      background: #eef2f7;
    }
    .page {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 520px;
    }
    .brand {
      position: relative;
      overflow: hidden;
      padding: 44px 56px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      color: #fff;
      background:
        linear-gradient(90deg, rgba(15, 17, 26, .88), rgba(15, 17, 26, .70)),
        radial-gradient(circle at 30% 35%, rgba(116, 19, 45, .72), transparent 30%),
        radial-gradient(circle at 63% 24%, rgba(0, 215, 255, .22), transparent 24%),
        linear-gradient(135deg, #260916 0%, #10141d 50%, #1d2630 100%);
    }
    .brand::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 50% 45%, rgba(255,255,255,.11), transparent 13%),
        linear-gradient(100deg, transparent 42%, rgba(255,255,255,.13) 43%, rgba(255,255,255,.02) 49%, transparent 50%);
      filter: blur(.2px);
      opacity: .9;
    }
    .brand::after {
      content: "";
      position: absolute;
      width: 310px;
      height: 420px;
      left: 38%;
      top: 24%;
      border-radius: 0 0 48% 48%;
      border: 2px solid rgba(255,255,255,.14);
      border-top: 0;
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.01));
      transform: rotate(-8deg);
    }
    .brand > * { position: relative; z-index: 1; }
    .logo-row {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .mark {
      width: 62px;
      height: 62px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      background: rgba(255,255,255,.13);
      border: 1px solid rgba(255,255,255,.20);
      box-shadow: inset 0 1px 14px rgba(255,255,255,.15);
    }
    .spark {
      width: 30px;
      height: 30px;
      background: var(--cyan);
      clip-path: polygon(50% 0, 62% 34%, 96% 18%, 74% 50%, 100% 64%, 64% 64%, 74% 100%, 50% 73%, 26% 100%, 36% 64%, 0 64%, 26% 50%, 4% 18%, 38% 34%);
      filter: drop-shadow(0 0 12px rgba(0,215,255,.8));
    }
    .eyebrow {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 5px;
      opacity: .76;
    }
    .title {
      margin: 0;
      font-size: 34px;
      line-height: 1.08;
      font-weight: 900;
    }
    .statement {
      max-width: 620px;
      font-size: 35px;
      line-height: 1.45;
      font-weight: 900;
      letter-spacing: 0;
      text-wrap: balance;
    }
    .metric-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .metric {
      min-height: 88px;
      border-radius: 12px;
      padding: 20px;
      background: rgba(255,255,255,.10);
      border: 1px solid rgba(255,255,255,.18);
      backdrop-filter: blur(16px);
    }
    .metric strong {
      display: block;
      color: var(--cyan);
      font-size: 22px;
      line-height: 1;
      margin-bottom: 14px;
    }
    .metric span {
      color: rgba(255,255,255,.68);
      font-size: 14px;
      font-weight: 700;
    }
    .panel-wrap {
      display: grid;
      place-items: center;
      padding: 36px;
      background:
        linear-gradient(180deg, rgba(255,255,255,.90), rgba(245,248,252,.92)),
        radial-gradient(circle at 50% 22%, rgba(216, 18, 63, .10), transparent 24%);
    }
    .login-card {
      width: min(100%, 420px);
      border-radius: 22px;
      padding: 40px;
      background: rgba(255,255,255,.94);
      box-shadow: 0 30px 80px rgba(23, 30, 45, .18);
      border: 1px solid rgba(255,255,255,.9);
    }
    .card-kicker {
      margin: 0 0 14px;
      color: var(--red);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 4px;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 32px;
      line-height: 1.15;
      font-weight: 900;
    }
    .hint {
      margin: 0 0 30px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.7;
      font-weight: 600;
    }
    label {
      display: block;
      margin: 18px 0 10px;
      font-size: 14px;
      font-weight: 800;
    }
    input {
      width: 100%;
      height: 54px;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 0 18px;
      font-size: 15px;
      outline: none;
      transition: border-color .18s ease, box-shadow .18s ease;
    }
    input:focus {
      border-color: rgba(217, 18, 63, .5);
      box-shadow: 0 0 0 4px rgba(217, 18, 63, .10);
    }
    .password-field { position: relative; }
    .password-field input { padding-right: 48px; }
    .eye {
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: #8d94a1;
      font-size: 18px;
      pointer-events: none;
    }
    .error {
      min-height: 22px;
      margin: 12px 0 4px;
      color: var(--red);
      font-size: 13px;
      font-weight: 700;
    }
    button {
      width: 100%;
      height: 58px;
      border: 0;
      border-radius: 12px;
      color: #fff;
      font-size: 16px;
      font-weight: 900;
      background: linear-gradient(135deg, #ed164a, var(--red-dark));
      box-shadow: 0 18px 30px rgba(217, 18, 63, .22);
      cursor: pointer;
      transition: transform .18s ease, box-shadow .18s ease;
    }
    button:hover {
      transform: translateY(-1px);
      box-shadow: 0 22px 34px rgba(217, 18, 63, .27);
    }
    .credentials {
      margin-top: 28px;
      padding: 18px 22px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: linear-gradient(180deg, #fff, #fafbfd);
    }
    .cred-row {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      padding: 8px 0;
      font-size: 14px;
      font-weight: 800;
    }
    .cred-row span { color: #4e5563; }
    .cred-row code {
      font-family: "SFMono-Regular", Consolas, monospace;
      color: #1d2430;
      font-size: 13px;
    }
    @media (max-width: 960px) {
      .page { grid-template-columns: 1fr; }
      .brand {
        min-height: 43vh;
        padding: 28px;
      }
      .statement { font-size: 26px; }
      .metric-row { display: none; }
      .panel-wrap { padding: 28px 18px; }
      .login-card { padding: 30px 24px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="brand">
      <div class="logo-row">
        <div class="mark"><div class="spark"></div></div>
        <div>
          <p class="eyebrow">DATAAGENT</p>
          <h1 class="title">公司 AI 工作台</h1>
        </div>
      </div>
      <div class="statement">统一管理项目代码、智能会话与开发协作，让团队更快完成研发交付。</div>
      <div class="metric-row">
        <div class="metric"><strong>AI</strong><span>代码协作</span></div>
        <div class="metric"><strong>API</strong><span>服务联调</span></div>
        <div class="metric"><strong>CLI</strong><span>远程开发</span></div>
      </div>
    </section>
    <section class="panel-wrap">
      <form class="login-card" method="post" action="/login">
        <p class="card-kicker">ACCOUNT LOGIN</p>
        <h2>欢迎回来</h2>
        <p class="hint">登录后继续使用 DataAgent 进行代码分析、修复、构建与部署。</p>
        <label for="username">账号</label>
        <input id="username" name="username" autocomplete="username" placeholder="请输入账号" />
        <label for="password">密码</label>
        <div class="password-field">
          <input id="password" name="password" type="password" autocomplete="current-password" placeholder="请输入密码" />
          <span class="eye">◎</span>
        </div>
        <div class="error">${error ? "账号或密码不正确" : ""}</div>
        <button type="submit">登录系统&nbsp;&nbsp;→</button>
        <div class="credentials">
          <div class="cred-row"><span>账号</span><code>opencode</code></div>
          <div class="cred-row"><span>密码</span><code>opencode</code></div>
        </div>
      </form>
    </section>
  </main>
</body>
</html>`)
}

function sendSettings(res) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DataAgent 配置中心</title>
  <style>
    :root {
      --red: #d9123f;
      --cyan: #00d7ff;
      --ink: #151922;
      --muted: #707888;
      --line: #e6eaf0;
      --bg: #f5f7fb;
      font-family: Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; color: var(--ink); background: var(--bg); }
    .topbar {
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
      background: rgba(255,255,255,.92);
      border-bottom: 1px solid var(--line);
      position: sticky;
      top: 0;
      z-index: 5;
      backdrop-filter: blur(16px);
    }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 900; }
    .mark {
      width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
      color: #fff; background: linear-gradient(135deg, #17202d, #d9123f);
    }
    .actions { display: flex; gap: 10px; align-items: center; }
    a, button { font: inherit; }
    .ghost, .primary {
      min-height: 38px; border-radius: 10px; padding: 0 14px; cursor: pointer; font-weight: 800;
    }
    .ghost { border: 1px solid var(--line); color: var(--ink); background: #fff; text-decoration: none; display: inline-flex; align-items: center; }
    .primary { border: 0; color: #fff; background: linear-gradient(135deg, #ed164a, #b80d33); }
    .page { max-width: 1280px; margin: 0 auto; padding: 28px; }
    .hero {
      display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 18px; align-items: stretch; margin-bottom: 18px;
    }
    .hero-main, .side-note, .panel {
      background: #fff; border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 18px 42px rgba(24,32,48,.07);
    }
    .hero-main { padding: 24px; }
    .hero-main h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.15; }
    .hero-main p { margin: 0; color: var(--muted); line-height: 1.7; font-weight: 600; }
    .side-note { padding: 20px; display: grid; gap: 10px; }
    .pill { display: flex; justify-content: space-between; gap: 16px; padding: 10px 12px; background: #f8fafc; border-radius: 10px; font-weight: 800; }
    .pill span { color: var(--muted); }
    .grid { display: grid; grid-template-columns: 380px minmax(0, 1fr); gap: 18px; align-items: start; }
    .panel { padding: 18px; }
    .panel h2 { margin: 0 0 14px; font-size: 18px; }
    .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
    .tab {
      height: 40px; border: 1px solid var(--line); border-radius: 10px; background: #fff; cursor: pointer; font-weight: 900;
    }
    .tab.active { color: #fff; border-color: transparent; background: #151922; }
    .section { display: none; }
    .section.active { display: block; }
    label { display: block; margin: 14px 0 8px; font-size: 13px; font-weight: 900; }
    input, select, textarea {
      width: 100%; border: 1px solid var(--line); border-radius: 10px; background: #fff; color: var(--ink);
      font: inherit; outline: none; transition: border-color .18s ease, box-shadow .18s ease;
    }
    input, select { height: 42px; padding: 0 12px; }
    textarea { min-height: 120px; padding: 12px; resize: vertical; font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; line-height: 1.55; }
    input:focus, select:focus, textarea:focus { border-color: rgba(217,18,63,.5); box-shadow: 0 0 0 4px rgba(217,18,63,.09); }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .help { color: var(--muted); font-size: 12px; line-height: 1.6; margin-top: 8px; }
    .list { display: grid; gap: 8px; margin-top: 12px; }
    .item { padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; background: #fafbfe; display: flex; justify-content: space-between; gap: 10px; align-items: center; }
    .item strong { font-size: 13px; }
    .item code { color: var(--muted); font-size: 12px; }
    .editor textarea { min-height: 520px; }
    .status { min-height: 22px; margin-top: 12px; color: var(--muted); font-size: 13px; font-weight: 800; }
    .danger { color: var(--red); }
    @media (max-width: 960px) {
      .hero, .grid { grid-template-columns: 1fr; }
      .page { padding: 16px; }
      .topbar { padding: 0 14px; }
      .actions { gap: 6px; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand"><div class="mark">✦</div><span>DataAgent 配置中心</span></div>
    <div class="actions">
      <a class="ghost" href="/">返回 DataAgent</a>
      <button class="ghost" id="restartBtn" type="button">重启服务</button>
      <button class="primary" id="saveBtn" type="button">保存配置</button>
    </div>
  </header>
  <main class="page">
    <section class="hero">
      <div class="hero-main">
        <h1>在界面上配置 MCP、插件和 Skill</h1>
        <p>这里写入 DataAgent 全局配置：MCP 和插件保存到 opencode.json，Skill 保存为独立的 SKILL.md。保存后重启服务即可让新配置加载。</p>
      </div>
      <div class="side-note">
        <div class="pill"><span>配置文件</span><code>~/.config/opencode/opencode.json</code></div>
        <div class="pill"><span>Skills</span><code>~/.config/opencode/skills</code></div>
        <div class="pill"><span>入口</span><code>当前访问地址</code></div>
      </div>
    </section>
    <section class="grid">
      <aside class="panel">
        <div class="tabs">
          <button class="tab active" data-tab="mcp" type="button">MCP</button>
          <button class="tab" data-tab="plugin" type="button">插件</button>
          <button class="tab" data-tab="skill" type="button">Skill</button>
        </div>
        <div class="section active" id="tab-mcp">
          <h2>新增 MCP</h2>
          <label>MCP 名称</label>
          <input id="mcpName" placeholder="context7" />
          <label>类型</label>
          <select id="mcpType"><option value="remote">远程 URL</option><option value="local">本地命令</option></select>
          <label>URL 或命令</label>
          <input id="mcpTarget" placeholder="https://mcp.context7.com/mcp" />
          <label>环境变量 JSON（可选）</label>
          <textarea id="mcpEnv" placeholder='{"API_KEY":"xxx"}'></textarea>
          <button class="primary" id="addMcpBtn" type="button">添加到配置</button>
          <p class="help">本地命令示例：<code>npx -y @modelcontextprotocol/server-filesystem /data</code></p>
          <div class="list" id="mcpList"></div>
        </div>
        <div class="section" id="tab-plugin">
          <h2>新增插件</h2>
          <label>npm 包名</label>
          <input id="pluginName" placeholder="opencode-wakatime" />
          <button class="primary" id="addPluginBtn" type="button">添加到配置</button>
          <p class="help">插件会写入 <code>plugin</code> 数组，服务启动时会安装/加载。</p>
          <div class="list" id="pluginList"></div>
        </div>
        <div class="section" id="tab-skill">
          <h2>创建 / 编辑 Skill</h2>
          <label>Skill 名称</label>
          <input id="skillName" placeholder="deploy-helper" />
          <label>SKILL.md 内容</label>
          <textarea id="skillContent" placeholder="---&#10;description: 这个 skill 的用途&#10;---&#10;&#10;# 使用说明&#10;"></textarea>
          <button class="primary" id="saveSkillBtn" type="button">保存 Skill</button>
          <div class="list" id="skillList"></div>
        </div>
      </aside>
      <section class="panel editor">
        <h2>全局配置 JSON</h2>
        <textarea id="configText" spellcheck="false"></textarea>
        <div class="status" id="status">正在加载配置...</div>
      </section>
    </section>
  </main>
  <script>
    const statusEl = document.getElementById("status")
    const configText = document.getElementById("configText")
    let skills = []

    function setStatus(text, danger) {
      statusEl.textContent = text
      statusEl.className = "status" + (danger ? " danger" : "")
    }
    function config() {
      return JSON.parse(configText.value || "{}")
    }
    function setConfig(next) {
      configText.value = JSON.stringify(next, null, 2)
      renderLists()
    }
    async function load() {
      const res = await fetch("/api/settings")
      const data = await res.json()
      configText.value = data.configText
      skills = data.skills || []
      renderLists()
      setStatus("配置已加载")
    }
    function renderLists() {
      let cfg = {}
      try { cfg = config() } catch (err) {}
      const mcp = cfg.mcp || {}
      document.getElementById("mcpList").innerHTML = Object.keys(mcp).map(name => (
        '<div class="item"><strong>' + name + '</strong><code>' + (mcp[name].url || (mcp[name].command || []).join(" ")) + '</code></div>'
      )).join("") || '<div class="help">暂无 MCP</div>'
      const plugins = Array.isArray(cfg.plugin) ? cfg.plugin : []
      document.getElementById("pluginList").innerHTML = plugins.map(name => (
        '<div class="item"><strong>' + name + '</strong><code>npm</code></div>'
      )).join("") || '<div class="help">暂无插件</div>'
      document.getElementById("skillList").innerHTML = skills.map(item => (
        '<button class="item" type="button" data-skill="' + item.name + '"><strong>' + item.name + '</strong><code>SKILL.md</code></button>'
      )).join("") || '<div class="help">暂无 Skill</div>'
    }
    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"))
        document.querySelectorAll(".section").forEach(x => x.classList.remove("active"))
        btn.classList.add("active")
        document.getElementById("tab-" + btn.dataset.tab).classList.add("active")
      })
    })
    document.getElementById("addMcpBtn").onclick = () => {
      const name = document.getElementById("mcpName").value.trim()
      const type = document.getElementById("mcpType").value
      const target = document.getElementById("mcpTarget").value.trim()
      if (!name || !target) return setStatus("请填写 MCP 名称和 URL/命令", true)
      const cfg = config()
      cfg.mcp = cfg.mcp || {}
      const item = type === "remote" ? { type: "remote", url: target } : { type: "local", command: target.split(/\\s+/) }
      const envText = document.getElementById("mcpEnv").value.trim()
      if (envText) item.env = JSON.parse(envText)
      cfg.mcp[name] = item
      setConfig(cfg)
      setStatus("MCP 已添加到配置，点击保存配置生效")
    }
    document.getElementById("addPluginBtn").onclick = () => {
      const name = document.getElementById("pluginName").value.trim()
      if (!name) return setStatus("请填写插件 npm 包名", true)
      const cfg = config()
      cfg.plugin = Array.isArray(cfg.plugin) ? cfg.plugin : []
      if (!cfg.plugin.includes(name)) cfg.plugin.push(name)
      setConfig(cfg)
      setStatus("插件已添加到配置，点击保存配置生效")
    }
    document.getElementById("skillList").onclick = e => {
      const btn = e.target.closest("[data-skill]")
      if (!btn) return
      const item = skills.find(x => x.name === btn.dataset.skill)
      if (!item) return
      document.getElementById("skillName").value = item.name
      document.getElementById("skillContent").value = item.content
    }
    document.getElementById("saveSkillBtn").onclick = async () => {
      const res = await fetch("/api/settings/skill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: document.getElementById("skillName").value,
          content: document.getElementById("skillContent").value,
        }),
      })
      const data = await res.json()
      if (!res.ok) return setStatus(data.error || "Skill 保存失败", true)
      skills = data.skills
      renderLists()
      setStatus("Skill 已保存，重启服务后可加载")
    }
    document.getElementById("saveBtn").onclick = async () => {
      try { JSON.parse(configText.value) } catch (err) { return setStatus("JSON 格式错误：" + err.message, true) }
      const res = await fetch("/api/settings/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ configText: configText.value }),
      })
      const data = await res.json()
      if (!res.ok) return setStatus(data.error || "保存失败", true)
      setStatus("配置已保存，建议点击重启服务")
    }
    document.getElementById("restartBtn").onclick = async () => {
      setStatus("正在重启服务...")
      const res = await fetch("/api/settings/restart", { method: "POST" })
      const data = await res.json()
      setStatus(data.message || "重启完成")
    }
    configText.addEventListener("input", renderLists)
    load().catch(err => setStatus("加载失败：" + err.message, true))
  </script>
</body>
</html>`)
}

function listLocalProjects() {
  fs.mkdirSync(LOCAL_PROJECTS_DIR, { recursive: true })
  return fs
    .readdirSync(LOCAL_PROJECTS_DIR, { withFileTypes: true })
    .filter(function (entry) {
      return entry.isDirectory() && entry.name.charAt(0) !== "."
    })
    .map(function (entry) {
      const directory = path.join(LOCAL_PROJECTS_DIR, entry.name)
      return {
        name: entry.name,
        directory: directory,
        href: "/" + base64Url(directory) + "/session",
      }
    })
    .sort(function (left, right) {
      return left.name.localeCompare(right.name)
    })
}

function sendProjects(res, message) {
  const projects = listLocalProjects()
  const projectList = projects.length
    ? projects
        .map(function (project) {
          return (
            '<li><div><strong>' +
            escapeHtml(project.name) +
            '</strong><code>' +
            escapeHtml(project.directory) +
            '</code></div><a href="' +
            project.href +
            '">打开</a></li>'
          )
        })
        .join("")
    : '<li class="empty">当前没有可打开的项目。</li>'

  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>项目目录</title>
  <style>
    :root { --red:#d9123f; --ink:#151922; --muted:#707888; --line:#e6eaf0; font-family: Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; background:#f5f7fb; color:var(--ink); display:grid; place-items:center; padding:24px; }
    .card { width:min(860px,100%); background:#fff; border:1px solid var(--line); border-radius:18px; box-shadow:0 24px 70px rgba(24,32,48,.13); padding:34px; }
    .top { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:24px; }
    h1 { margin:0 0 8px; font-size:28px; line-height:1.15; }
    h2 { margin:30px 0 10px; font-size:18px; }
    p { margin:0; color:var(--muted); line-height:1.7; font-weight:600; }
    a { color:var(--ink); text-decoration:none; font-weight:800; border:1px solid var(--line); border-radius:10px; padding:10px 14px; background:#fff; }
    label { display:block; margin:18px 0 8px; font-weight:900; font-size:14px; }
    input { width:100%; height:46px; border:1px solid var(--line); border-radius:12px; padding:0 14px; font:inherit; }
    input[type=file] { height:auto; padding:14px; background:#fafbfe; }
    button { margin-top:22px; width:100%; height:54px; border:0; border-radius:12px; color:#fff; font:900 16px Inter,system-ui,sans-serif; background:linear-gradient(135deg,#ed164a,#b80d33); cursor:pointer; }
    ul { list-style:none; margin:0; padding:0; border-top:1px solid var(--line); }
    li { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 0; border-bottom:1px solid var(--line); }
    li strong, li code { display:block; }
    li code { margin-top:5px; color:var(--muted); font-size:12px; overflow-wrap:anywhere; }
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:28px; }
    .note { margin-top:18px; padding:14px 16px; border-radius:12px; background:#f8fafc; border:1px solid var(--line); color:var(--muted); font-size:13px; line-height:1.7; }
    .msg { margin-bottom:16px; color:var(--red); font-weight:800; }
    .empty { color:var(--muted); }
    @media (max-width:700px) { .two-col { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <main class="card">
    <div class="top">
      <div>
        <h1>项目目录</h1>
        <p>每个项目目录对应独立的 OpenCode 会话和文件上下文。切换目录后再新建会话，不会读取其他项目的需求文档或文件。</p>
      </div>
      <a href="/">返回 DataAgent</a>
    </div>
    ${message ? '<div class="msg">' + message + '</div>' : ""}
    <h2>服务器已有项目</h2>
    <ul>${projectList}</ul>
    <div class="two-col">
      <section>
        <h2>新建空项目</h2>
        <form action="/projects/create" method="post">
          <label for="newProjectName">项目名称</label>
          <input id="newProjectName" name="projectName" placeholder="my-project" required />
          <button type="submit">新建并打开项目</button>
        </form>
      </section>
      <section>
        <h2>上传本地项目</h2>
        <form action="/projects/upload" method="post" enctype="multipart/form-data">
          <label for="projectName">项目名称</label>
          <input id="projectName" name="projectName" placeholder="my-project" required />
          <label for="projectZip">项目 zip 文件</label>
          <input id="projectZip" name="projectZip" type="file" accept=".zip,application/zip" required />
          <button type="submit">上传并打开项目</button>
        </form>
      </section>
    </div>
    <div class="note">新项目位于服务器工作区。上传前请排除 <code>node_modules</code>、构建产物和敏感配置。</div>
  </main>
</body>
</html>`)
}

function sendServerLogin(res, error) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>登录服务器</title>
  <style>
    :root { --red:#d9123f; --ink:#151922; --muted:#707888; --line:#e6eaf0; font-family: Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; background:#f5f7fb; color:var(--ink); display:grid; place-items:center; padding:24px; }
    .card { width:min(720px,100%); background:#fff; border:1px solid var(--line); border-radius:18px; box-shadow:0 24px 70px rgba(24,32,48,.13); padding:34px; }
    .top { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:24px; }
    h1 { margin:0 0 8px; font-size:28px; line-height:1.15; }
    p { margin:0; color:var(--muted); line-height:1.7; font-weight:600; }
    a { color:var(--ink); text-decoration:none; font-weight:800; border:1px solid var(--line); border-radius:10px; padding:10px 14px; background:#fff; }
    .grid { display:grid; gap:12px; }
    .row { display:flex; justify-content:space-between; gap:16px; padding:14px 16px; border:1px solid var(--line); border-radius:12px; background:#fafbfe; }
    .row span { color:var(--muted); font-weight:800; }
    code { font-family:"SFMono-Regular",Consolas,monospace; font-size:14px; }
    .actions { display:flex; gap:10px; margin-top:22px; flex-wrap:wrap; }
    .primary { color:#fff; background:#151922; border-color:#151922; }
    .danger { color:var(--red); border-color:#ffd6df; }
    .note { margin-top:18px; padding:14px 16px; border-radius:12px; background:#fff7fa; border:1px solid #ffd6df; color:#8a4151; font-size:13px; line-height:1.7; }
  </style>
</head>
<body>
  <main class="card">
    <div class="top">
      <div>
        <h1>登录公司服务器</h1>
        <p>输入服务器登录口令后，会直接进入网页终端。</p>
      </div>
      <a href="/">返回 DataAgent</a>
    </div>
    ${error ? '<div style="margin-bottom:14px;color:#d9123f;font-weight:900">密码不正确，请重新输入。</div>' : ""}
    <form method="post" action="/server-login">
      <label style="display:block;margin:0 0 8px;font-weight:900">服务器密码</label>
      <input name="password" type="password" autocomplete="current-password" placeholder="请输入服务器密码" style="width:100%;height:48px;border:1px solid var(--line);border-radius:12px;padding:0 14px;font:inherit" />
      <button class="primary" type="submit" style="margin-top:18px;width:100%;height:48px;border-radius:12px;font-weight:900;cursor:pointer">登录服务器终端</button>
    </form>
    <div class="grid" style="margin-top:22px">
      <div class="row"><span>服务器</span><code>当前工作台服务器</code></div>
      <div class="row"><span>终端用户</span><code>root</code></div>
      <div class="row"><span>DataAgent 服务</span><code>opencode-login.service / opencode-web.service</code></div>
    </div>
    <div class="actions">
      <a href="/settings">配置中心</a>
      <a href="/projects">本地项目</a>
      <a class="danger" href="/logout">退出登录</a>
    </div>
    <div class="note">这是网页内置终端，适合执行部署、查看日志、重启服务等命令。不要在公共网络环境长时间保持打开。</div>
  </main>
</body>
</html>`)
}

function sendTerminal(res) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>服务器终端</title>
  <style>
    * { box-sizing: border-box; }
    body { margin:0; height:100vh; background:#10131a; color:#e8edf6; font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace; display:flex; flex-direction:column; }
    header { height:48px; display:flex; align-items:center; justify-content:space-between; padding:0 16px; background:#171b24; border-bottom:1px solid #2b3140; font-family:Inter,system-ui,sans-serif; }
    header strong { font-size:14px; }
    header nav { display:flex; gap:8px; }
    header a { color:#e8edf6; text-decoration:none; border:1px solid #343b4c; border-radius:8px; padding:7px 10px; font-size:13px; font-weight:700; }
    #out { flex:1; overflow:auto; padding:16px; white-space:pre-wrap; line-height:1.55; font-size:14px; }
    form { display:flex; gap:8px; padding:12px; background:#171b24; border-top:1px solid #2b3140; }
    input { flex:1; height:40px; border:1px solid #343b4c; border-radius:10px; background:#0d1017; color:#e8edf6; padding:0 12px; font:inherit; outline:none; }
    button { width:88px; border:0; border-radius:10px; background:#e11d48; color:#fff; font-weight:900; cursor:pointer; }
  </style>
</head>
<body>
  <header>
    <strong>root@8.160.163.200</strong>
    <nav><a href="/">DataAgent</a><a href="/server-login">重新登录</a><a href="/logout">退出</a></nav>
  </header>
  <pre id="out">正在连接服务器终端...\\n</pre>
  <form id="form"><input id="cmd" autocomplete="off" autofocus placeholder="输入命令，回车执行" /><button>发送</button></form>
  <script>
    const out = document.getElementById("out")
    const input = document.getElementById("cmd")
    const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/terminal/ws")
    function write(text) { out.textContent += text; out.scrollTop = out.scrollHeight }
    ws.onopen = () => write("已连接。\\n")
    ws.onmessage = (event) => write(event.data)
    ws.onclose = () => write("\\n连接已关闭。\\n")
    ws.onerror = () => write("\\n连接错误。\\n")
    document.getElementById("form").addEventListener("submit", (event) => {
      event.preventDefault()
      const value = input.value
      if (!value || ws.readyState !== WebSocket.OPEN) return
      ws.send(value + "\\n")
      input.value = ""
    })
  </script>
</body>
</html>`)
}


function sendClipboardFix(res) {
  const script = `
;(function () {
  var lastPointer = null
  document.addEventListener("pointerdown", function (event) {
    lastPointer = event.target
  }, true)

  function fallbackCopy(text) {
    return new Promise(function (resolve, reject) {
      try {
        var value = String(text == null ? "" : text)
        var ta = document.createElement("textarea")
        ta.value = value
        ta.setAttribute("readonly", "")
        ta.style.position = "fixed"
        ta.style.top = "-1000px"
        ta.style.left = "-1000px"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        ta.setSelectionRange(0, ta.value.length)
        var ok = document.execCommand("copy")
        document.body.removeChild(ta)
        ok ? resolve() : reject(new Error("copy command failed"))
      } catch (err) {
        reject(err)
      }
    })
  }

  function visibleText(el) {
    if (!el) return ""
    var clone = el.cloneNode(true)
    var junk = clone.querySelectorAll("button,[role=button],nav,.opencode-top-nav,svg,style,script")
    for (var i = 0; i < junk.length; i++) junk[i].remove()
    return (clone.innerText || clone.textContent || "").replace(/\\n{3,}/g, "\\n\\n").trim()
  }

  function isCopyButton(btn) {
    if (!btn) return false
    var label = ((btn.getAttribute("aria-label") || "") + " " + (btn.getAttribute("title") || "") + " " + (btn.innerText || btn.textContent || "")).trim()
    return /copy|copied|复制|已复制/i.test(label)
  }

  function isBadClipboardText(text) {
    var value = String(text == null ? "" : text).trim()
    return !value || value === "opencode"
  }

  function textBeforeButton(btn) {
    var child = btn
    var parent = child && child.parentElement
    var depth = 0
    while (parent && parent !== document.body && depth < 12) {
      var parts = []
      for (var i = 0; i < parent.children.length; i++) {
        var item = parent.children[i]
        if (item === child) break
        var text = visibleText(item)
        if (text && text !== "opencode") parts.push(text)
      }
      var candidate = parts.join("\\n").trim()
      if (candidate && candidate.length > 8) return candidate
      child = parent
      parent = parent.parentElement
      depth++
    }
    return ""
  }

  function nearestMessageText() {
    var el = lastPointer
    if (!el) return ""
    var btn = el.closest && el.closest("button,[role=button],[aria-label],[title]")
    if (!isCopyButton(btn)) return ""

    var before = textBeforeButton(btn)
    if (before) return before

    var selectors = ["[data-message-id]", "[data-testid*=message]", "[class*=message]", "article", "li", "section"]
    var smallest = ""
    for (var s = 0; s < selectors.length; s++) {
      var box = btn.closest(selectors[s])
      var candidate = visibleText(box)
      if (candidate && candidate !== "opencode" && candidate.length > 8) {
        if (!smallest || candidate.length < smallest.length) smallest = candidate
      }
    }
    return smallest
  }

  var nativeClipboard = navigator.clipboard
  var nativeWrite = nativeClipboard && nativeClipboard.writeText ? nativeClipboard.writeText.bind(nativeClipboard) : null
  var shim = {
    writeText: function (text) {
      if (isBadClipboardText(text)) {
        var better = nearestMessageText()
        if (better) text = better
      }
      if (nativeWrite) {
        try {
          return nativeWrite(text).catch(function () {
            return fallbackCopy(text)
          })
        } catch (err) {
          return fallbackCopy(text)
        }
      }
      return fallbackCopy(text)
    },
    readText: function () {
      return nativeClipboard && nativeClipboard.readText ? nativeClipboard.readText.call(nativeClipboard) : Promise.resolve("")
    },
  }
  try {
    Object.defineProperty(navigator, "clipboard", { value: shim, configurable: true })
  } catch (err) {
    navigator.clipboard = shim
  }
  window.__opencodeClipboardFallback = true
  window.__opencodeClipboardMessageFix = true
  window.__opencodeClipboardScopedFix = true
})()
`
  res.writeHead(200, {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(script)
}

function isSessionListRequest(req) {
  if (req.method !== "GET") return false
  const pathname = new URL(req.url, "http://localhost").pathname
  return pathname === "/api/session" || pathname === "/session"
}

function sendPossiblyCompatSessionList(req, res, upstreamRes) {
  if (!isSessionListRequest(req)) return false

  const contentType = String(upstreamRes.headers["content-type"] || "")
  if (contentType.indexOf("application/json") < 0) return false

  const chunks = []
  upstreamRes.on("data", function (chunk) {
    chunks.push(chunk)
  })
  upstreamRes.on("end", function () {
    const body = Buffer.concat(chunks)
    let payload = null
    try {
      payload = JSON.parse(body.toString("utf8"))
    } catch (err) {}

    const responseHeaders = Object.assign({}, upstreamRes.headers)
    delete responseHeaders["content-length"]
    delete responseHeaders["transfer-encoding"]

    if (payload && !Array.isArray(payload) && Array.isArray(payload.items)) {
      const rewritten = Buffer.from(JSON.stringify(payload.items))
      responseHeaders["content-type"] = "application/json; charset=utf-8"
      responseHeaders["content-length"] = String(rewritten.length)
      responseHeaders["cache-control"] = "no-store"
      res.writeHead(upstreamRes.statusCode, responseHeaders)
      res.end(rewritten)
      return
    }

    responseHeaders["content-length"] = String(body.length)
    res.writeHead(upstreamRes.statusCode, responseHeaders)
    res.end(body)
  })
  return true
}

function isCacheableAssetRequest(req) {
  if (req.method !== "GET") return false
  const pathname = new URL(req.url, "http://localhost").pathname
  return /^\/assets\/.+\.(?:js|css|mjs|woff2?|ttf|otf|svg|png|jpe?g|gif|webp|wasm)$/i.test(pathname)
}

function acceptsGzip(req) {
  return /\bgzip\b/i.test(String(req.headers["accept-encoding"] || ""))
}

function cacheHeaders(upstreamHeaders, contentLength, gzip) {
  const headers = Object.assign({}, upstreamHeaders)
  delete headers["content-length"]
  delete headers["transfer-encoding"]
  headers["cache-control"] = "public, max-age=31536000, immutable"
  headers["content-length"] = String(contentLength)
  if (gzip) {
    headers["content-encoding"] = "gzip"
    headers.vary = "Accept-Encoding"
  }
  return headers
}

function sendOptimizedAsset(req, res, upstreamRes) {
  if (!isCacheableAssetRequest(req) || upstreamRes.statusCode !== 200) return false

  const gzip = acceptsGzip(req) && !upstreamRes.headers["content-encoding"]
  const cacheKey = req.url + "|gzip=" + (gzip ? "1" : "0")
  const cached = ASSET_CACHE.get(cacheKey)
  if (cached) {
    res.writeHead(200, cacheHeaders(upstreamRes.headers, cached.length, gzip))
    res.end(cached)
    upstreamRes.resume()
    return true
  }

  const chunks = []
  upstreamRes.on("data", function (chunk) {
    chunks.push(chunk)
  })
  upstreamRes.on("end", function () {
    const body = Buffer.concat(chunks)
    if (!gzip) {
      ASSET_CACHE.set(cacheKey, body)
      res.writeHead(200, cacheHeaders(upstreamRes.headers, body.length, false))
      res.end(body)
      return
    }

    zlib.gzip(body, { level: 6 }, function (err, compressed) {
      if (err) {
        res.writeHead(200, cacheHeaders(upstreamRes.headers, body.length, false))
        res.end(body)
        return
      }
      ASSET_CACHE.set(cacheKey, compressed)
      res.writeHead(200, cacheHeaders(upstreamRes.headers, compressed.length, true))
      res.end(compressed)
    })
  })
  return true
}

function proxy(req, res) {
  const headers = Object.assign({}, req.headers)
  headers.host = UPSTREAM_HOST + ":" + UPSTREAM_PORT
  headers.authorization = "Basic " + Buffer.from(USERNAME + ":" + PASSWORD).toString("base64")

  const upstream = http.request(
    {
      hostname: UPSTREAM_HOST,
      port: UPSTREAM_PORT,
      method: req.method,
      path: req.url,
      headers: headers,
    },
    function (upstreamRes) {
      const contentType = String(upstreamRes.headers["content-type"] || "")
      if (sendPossiblyCompatSessionList(req, res, upstreamRes)) return
      if (sendOptimizedAsset(req, res, upstreamRes)) return
      if (contentType.indexOf("text/html") >= 0) {
        let body = ""
        upstreamRes.setEncoding("utf8")
        upstreamRes.on("data", function (chunk) {
          body += chunk
        })
        upstreamRes.on("end", function () {
          const preflightJs = '<script src="/opencode-preflight.js"></script>'
          const shellHtml = '<link rel="stylesheet" href="/opencode-shell.css">'
          const clipboardFix = '<script src="/opencode-clipboard-fix.js"></script>'
          const entryJs = '<script src="/opencode-entry.js"></script>'
          // favicon / apple-touch-icon 换成正方形 snowharness favicon(避免拉伸变形)
          // 带 ?v= 版本号,强制浏览器重新请求,绕过顽固的 favicon 缓存
          let branded = body.replace(
            /(<link\b[^>]*rel=["'][^"']*(?:icon|apple-touch)[^"']*["'][^>]*href=["'])([^"']+)(["'])/gi,
            '$1/snowharness-favicon.png?v=3$3'
          )
          // title 固定为 SnowHarness(双保险,不等 JS)
          branded = branded.replace(/<title>[^<]*<\/title>/i, "<title>SnowHarness</title>")
          const withPreflight = branded.replace(
            "</head>",
            preflightJs + shellHtml + "</head>",
          )
          const injected = withPreflight.replace(
            "</body>",
            clipboardFix + entryJs + "</body>",
          )
          const responseHeaders = Object.assign({}, upstreamRes.headers)
          delete responseHeaders["content-length"]
          responseHeaders["content-type"] = "text/html; charset=utf-8"
          res.writeHead(upstreamRes.statusCode, responseHeaders)
          res.end(injected)
        })
        return
      }
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )
  upstream.on("error", function () {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" })
    res.end("DataAgent upstream is not available.")
  })
  req.pipe(upstream)
}

function handleSettingsApi(req, res) {
  if (req.url === "/api/settings" && req.method === "GET") {
    return json(res, 200, {
      configText: readConfigText(),
      skills: readSkills(),
    })
  }
  if (req.url === "/api/settings/config" && req.method === "POST") {
    return parseJson(req, function (err, body) {
      if (err) return json(res, 400, { error: "请求 JSON 格式错误" })
      try {
        const parsed = JSON.parse(String(body.configText || "{}"))
        ensureConfigDirs()
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(parsed, null, 2) + "\n")
        chownConfigBestEffort()
        return json(res, 200, { ok: true })
      } catch (writeErr) {
        return json(res, 400, { error: writeErr.message })
      }
    })
  }
  if (req.url === "/api/settings/skill" && req.method === "POST") {
    return parseJson(req, function (err, body) {
      if (err) return json(res, 400, { error: "请求 JSON 格式错误" })
      const name = normalizeName(body.name)
      if (!name) return json(res, 400, { error: "Skill 名称不能为空，只支持字母、数字、-、_" })
      ensureConfigDirs()
      const dir = path.join(SKILLS_DIR, name)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, "SKILL.md"), String(body.content || ""))
      chownConfigBestEffort()
      return json(res, 200, { ok: true, skills: readSkills() })
    })
  }
  if (req.url === "/api/settings/restart" && req.method === "POST") {
    childProcess.exec("systemctl restart opencode-web.service", function (err) {
      if (err) return json(res, 500, { error: err.message })
      return json(res, 200, { ok: true, message: "服务已重启" })
    })
    return
  }
  json(res, 404, { error: "not found" })
}

function handleProjectUpload(req, res) {
  parseMultipart(req, function (err, fields, files) {
    if (err) return sendProjects(res, "上传格式错误：" + err.message)
    const upload = files.projectZip
    const projectName = normalizeName(fields.projectName)
    if (!projectName) return sendProjects(res, "请填写有效项目名称")
    if (!upload || !upload.content || !upload.filename.toLowerCase().endsWith(".zip")) {
      return sendProjects(res, "请选择 zip 格式的项目压缩包")
    }

    fs.mkdirSync(LOCAL_PROJECTS_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)
    const destDir = path.join(LOCAL_PROJECTS_DIR, projectName + "-" + stamp)
    const tmpZip = path.join("/tmp", "opencode-upload-" + process.pid + "-" + Date.now() + ".zip")
    fs.writeFileSync(tmpZip, upload.content)

    extractZip(tmpZip, destDir, function (extractErr) {
      fs.unlink(tmpZip, function () {})
      if (extractErr) return sendProjects(res, "解压失败：" + extractErr.message)
      childProcess.execFileSync("chown", ["-R", "opencode:opencode", destDir])
      redirectWithAuth(res, "/" + base64Url(destDir) + "/session")
    })
  })
}

function handleProjectCreate(req, res) {
  parseBody(req, function (body) {
    const projectName = normalizeName(body.get("projectName"))
    if (!projectName) return sendProjects(res, "请填写有效项目名称")

    const destDir = path.join(LOCAL_PROJECTS_DIR, projectName)
    if (fs.existsSync(destDir)) return sendProjects(res, "该项目名称已存在，请直接打开或换一个名称")

    fs.mkdirSync(destDir, { recursive: true })
    childProcess.execFileSync("chown", ["-R", "opencode:opencode", destDir])
    redirectWithAuth(res, "/" + base64Url(destDir) + "/session")
  })
}

function websocketAccept(key) {
  return crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64")
}

function wsSend(socket, text) {
  const payload = Buffer.from(String(text), "utf8")
  let header
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length])
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 126
    header.writeUInt16BE(payload.length, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x81
    header[1] = 127
    header.writeBigUInt64BE(BigInt(payload.length), 2)
  }
  socket.write(Buffer.concat([header, payload]))
}

function wsParse(buffer) {
  if (buffer.length < 2) return null
  const opcode = buffer[0] & 0x0f
  let length = buffer[1] & 0x7f
  let offset = 2
  if (length === 126) {
    if (buffer.length < 4) return null
    length = buffer.readUInt16BE(2)
    offset = 4
  } else if (length === 127) {
    if (buffer.length < 10) return null
    length = Number(buffer.readBigUInt64BE(2))
    offset = 10
  }
  const masked = (buffer[1] & 0x80) !== 0
  if (!masked) return { opcode, text: "" }
  if (buffer.length < offset + 4 + length) return null
  const mask = buffer.slice(offset, offset + 4)
  offset += 4
  const payload = Buffer.alloc(length)
  for (let i = 0; i < length; i++) payload[i] = buffer[offset + i] ^ mask[i % 4]
  return { opcode, text: payload.toString("utf8"), consumed: offset + length }
}

function handleTerminalWs(req, socket) {
  const key = req.headers["sec-websocket-key"]
  if (!key) {
    socket.destroy()
    return
  }
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Accept: " +
      websocketAccept(key) +
      "\r\n\r\n",
  )
  const shell = childProcess.spawn("/bin/bash", ["-i"], {
    cwd: "/root",
    env: Object.assign({}, process.env, {
      HOME: "/root",
      TERM: "xterm-256color",
      PS1: "\\u@\\h:\\w# ",
    }),
  })
  wsSend(socket, "已进入服务器 shell。\\n")
  shell.stdout.on("data", function (data) {
    wsSend(socket, data.toString("utf8"))
  })
  shell.stderr.on("data", function (data) {
    wsSend(socket, data.toString("utf8"))
  })
  shell.on("exit", function (code) {
    wsSend(socket, "\\nShell 已退出：" + code + "\\n")
    socket.end()
  })
  let pending = Buffer.alloc(0)
  socket.on("data", function (chunk) {
    pending = Buffer.concat([pending, chunk])
    while (pending.length) {
      const frame = wsParse(pending)
      if (!frame) break
      pending = pending.slice(frame.consumed || pending.length)
      if (frame.opcode === 8) {
        shell.kill()
        socket.end()
        return
      }
      if (frame.opcode === 1) shell.stdin.write(frame.text)
    }
  })
  socket.on("close", function () {
    shell.kill()
  })
  socket.on("error", function () {
    shell.kill()
  })
}

const server = http.createServer(function (req, res) {
  const requestUrl = new URL(req.url, "http://localhost")
  const pathname = requestUrl.pathname
  const rootProjectPath = "/" + base64Url("/")
  const fixedPath = fixedProjectPath()
  const fixedSession = fixedProjectSessionPath()

  if (req.url === "/snowharness-logo.png" || req.url.indexOf("/snowharness-logo.png?") === 0) {
    try {
      const data = fs.readFileSync("/opt/snowharness-assets/snowharness-logo.png")
      res.writeHead(200, {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
      })
      res.end(data)
    } catch (e) {
      res.writeHead(404)
      res.end("not found")
    }
    return
  }

  if (req.url === "/snowharness-favicon.png" || req.url.indexOf("/snowharness-favicon.png?") === 0) {
    try {
      const data = fs.readFileSync("/opt/snowharness-assets/snowharness-favicon.png")
      res.writeHead(200, {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
      })
      res.end(data)
    } catch (e) {
      res.writeHead(404)
      res.end("not found")
    }
    return
  }

  if (req.url === "/opencode-clipboard-fix.js") {
    sendClipboardFix(res)
    return
  }

  if (req.url === "/opencode-shell.css") {
    sendShellCss(res)
    return
  }

  if (req.url === "/opencode-preflight.js") {
    sendPreflightJs(res)
    return
  }

  if (req.url === "/opencode-entry.js") {
    sendEntryJs(res)
    return
  }

  if (previewRequestInfo(req)) {
    handlePreview(req, res)
    return
  }

  if (
    req.method === "GET" &&
    (pathname === "/" ||
      (pathname === "/session" && requestUrl.search === "") ||
      pathname === rootProjectPath ||
      pathname === rootProjectPath + "/session" ||
      pathname === fixedPath)
  ) {
    redirectWithAuth(res, fixedSession)
    return
  }

  if (req.url === "/login" && req.method === "POST") {
    parseBody(req, function (body) {
      if (body.get("username") === USERNAME && body.get("password") === PASSWORD) {
        redirectWithAuth(res, fixedSession)
      } else {
        sendLogin(res, true)
      }
    })
    return
  }

  if (req.url === "/logout") {
    redirectWithoutAuth(
      res,
      fixedSession,
      [
        COOKIE_NAME + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        TERMINAL_COOKIE_NAME + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      ],
    )
    return
  }

  if (!isAuthed(req)) {
    // 静态资源(manifest/favicon/js/css/字体/图片等)直接放行给上游,
    // 避免未鉴权时 302 回自身 URL 造成 ERR_TOO_MANY_REDIRECTS 死循环。
    // 上游 opencode 本身用 Basic Auth,代理转发时已自动带上,无需 cookie。
    var reqPath = req.url.split("?")[0]
    var isStaticAsset = /\.(js|css|png|jpe?g|svg|ico|webmanifest|json|woff2?|ttf|otf|gif|map|mjs|wasm)(\b|\/|$)/i.test(reqPath) ||
      reqPath.indexOf("/assets/") === 0 || reqPath.indexOf("/favicon") === 0
    if (isStaticAsset) {
      proxy(req, res)
      return
    }
    redirectWithAuth(res, req.url)
    return
  }

  if (req.url === "/settings" && req.method === "GET") {
    sendSettings(res)
    return
  }

  if (req.url === "/server-login" && req.method === "GET") {
    res.writeHead(302, {
      location: "/server-terminal",
      "set-cookie":
        TERMINAL_COOKIE_NAME +
        "=" +
        encodeURIComponent(terminalSessionValue()) +
        "; Path=/; HttpOnly; SameSite=Lax; Max-Age=21600",
    })
    res.end()
    return
  }

  if (req.url === "/server-login" && req.method === "POST") {
    parseBody(req, function (body) {
      if (body.get("password") === TERMINAL_PASSWORD) {
        res.writeHead(302, {
          location: "/server-terminal",
          "set-cookie":
            TERMINAL_COOKIE_NAME +
            "=" +
            encodeURIComponent(terminalSessionValue()) +
            "; Path=/; HttpOnly; SameSite=Lax; Max-Age=21600",
        })
        res.end()
      } else {
        sendServerLogin(res, true)
      }
    })
    return
  }

  if (req.url === "/server-terminal" && req.method === "GET") {
    if (!isTerminalAuthed(req)) {
      res.writeHead(302, { location: "/server-login" })
      res.end()
      return
    }
    sendTerminal(res)
    return
  }

  if (req.url === "/projects" && req.method === "GET") {
    sendProjects(res, "")
    return
  }

  if (req.url === "/projects/create" && req.method === "POST") {
    handleProjectCreate(req, res)
    return
  }

  if (req.url === "/projects/upload" && req.method === "POST") {
    handleProjectUpload(req, res)
    return
  }

  if (req.url.indexOf("/api/settings") === 0) {
    handleSettingsApi(req, res)
    return
  }

  proxy(req, res)
})

server.on("upgrade", function (req, socket, head) {
  if (!isAuthed(req)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n")
    socket.destroy()
    return
  }
  if (req.url === "/terminal/ws") {
    if (!isTerminalAuthed(req)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n")
      socket.destroy()
      return
    }
    handleTerminalWs(req, socket)
    return
  }
  const upstream = net.connect(UPSTREAM_PORT, UPSTREAM_HOST, function () {
    const headers = []
    headers.push(req.method + " " + req.url + " HTTP/" + req.httpVersion)
    Object.keys(req.headers).forEach(function (name) {
      if (name.toLowerCase() === "host") headers.push("Host: " + UPSTREAM_HOST + ":" + UPSTREAM_PORT)
      else if (name.toLowerCase() !== "authorization") headers.push(name + ": " + req.headers[name])
    })
    headers.push("Authorization: Basic " + Buffer.from(USERNAME + ":" + PASSWORD).toString("base64"))
    upstream.write(headers.join("\r\n") + "\r\n\r\n")
    if (head && head.length) upstream.write(head)
    socket.pipe(upstream).pipe(socket)
  })
  upstream.on("error", function () {
    socket.destroy()
  })
})

server.listen(LISTEN_PORT, LISTEN_HOST)
