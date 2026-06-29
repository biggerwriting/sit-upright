# 设计文档：体验版页面 + 多语言 + SEO

**日期：** 2026-06-29  
**范围：** `index.html`（改）、`free-demo.html`（新）、`sitemap.xml`（新）、`robots.txt`（新）

---

## 背景

产品转型为完全免费，不再需要注册/登录/付费。现有 `posture-static-demo.html` 保留（付费 token 用户通过专属 URL 访问），但首页不再链接它。新建完全免费无限制的体验版页面，首页换上多语言支持，并补齐 SEO 基础设施。

---

## 一、文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `index.html` | 修改 | 加语言切换、修复 canonical/og:url、按钮指向 free-demo |
| `free-demo.html` | 新建 | 基于 posture-static-demo.html，去除所有鉴权/配额逻辑 |
| `sitemap.xml` | 新建 | 包含首页 + free-demo 两个 URL |
| `robots.txt` | 新建 | 允许全量爬取，指向 sitemap |
| `posture-static-demo.html` | 不动 | 付费用户专属，首页移除入口链接 |

---

## 二、free-demo.html

### 2.1 基础结构

直接复制 `posture-static-demo.html`，做以下裁减和修改。

### 2.2 删除的代码

**配置常量：**
- `SUPABASE_FUNC_URL`
- `WECHAT_ID`

**删除的变量：**
- `accessMode`、`quotaSecs`、`activeToken`、`tokenExpiresAt`
- `reportTimer`、`unreportedSecs`

**删除的函数：**
- `checkAccess()` — 整个鉴权主流程
- `showPaywall()` — 付费引导弹窗
- `getDeviceId()` — 设备 ID（仅试用鉴权用）
- `updateQuotaBar()` — 配额条更新

**删除的 DOM 元素：**
- `#auth-overlay` 内的 `state-checking`、`state-paywall`、`state-invalid` 三个子卡片
- `#quota-bar`（配额条）
- `#expiry-bar`（到期提示条）

**删除的逻辑：**
- `tick()` 里的 `quotaSecs--`、`updateQuotaBar()`、`showPaywall()` 分支
- `startDetection()` 里的 token 上报定时器（`reportTimer` setInterval）
- `stopDetection()` 里的 unreported 秒数补报 fetch

### 2.3 保留的代码

- 模型加载流程（进度条 + model-loading + model-error + 重试按钮）
- 全部 MediaPipe 初始化与推理循环
- 坐姿分析 `analyzePosture()`
- 每秒 `tick()` 统计（去掉配额部分）
- 时间轴渲染 `renderTimeline()`
- 语音提醒 `playAudio()`
- 报告弹窗 `showReport()`
- 开始/停止检测 `startDetection()` / `stopDetection()`

### 2.4 修改的初始化流程

```
// 旧流程（posture-static-demo.html）
init().then(() => checkAccess())

// 新流程（free-demo.html）
init().then(() => readyToDetect())   // 模型就绪后直接解锁按钮，无需鉴权
```

`#auth-overlay` 保留但仅用于 model-loading 和 model-error 两个状态，鉴权相关三个状态删除。

### 2.5 新增内容

- 页面顶部导航条：`← 返回首页` 链接（href="/"）+ 语言切换器
- SEO meta 标签（见第四节）
- 语言切换 JS（与 index.html 共用同一套逻辑，inline 复制）

### 2.6 语言覆盖范围（free-demo.html）

| data-i18n key | zh | en | fr | es |
|---|---|---|---|---|
| `page-title` | 免费坐姿检测 | Free Posture Check | Vérif. posture gratuite | Detector gratis |
| `btn-start` | 开始检测 | Start | Démarrer | Iniciar |
| `btn-stop` | 停止检测 | Stop | Arrêter | Detener |
| `btn-loading` | 正在加载模型… | Loading model… | Chargement… | Cargando… |
| `badge-ready` | 就绪，点击开始 | Ready, click start | Prêt | Listo |
| `badge-good` | 坐姿良好 ✓ | Good posture ✓ | Bonne posture ✓ | Buena postura ✓ |
| `badge-bad` | 检测到弓腰 | Hunching detected | Courbure détectée | Encorvamiento |
| `badge-stopped` | 检测已停止 | Detection stopped | Détection arrêtée | Detección detenida |
| `label-good` | 优秀坐姿 | Good posture | Bonne posture | Buena postura |
| `label-bad` | 不良坐姿 | Poor posture | Mauvaise posture | Mala postura |
| `label-total` | 总时长 | Total time | Durée totale | Tiempo total |
| `label-timeline` | 坐姿时间轴 | Posture timeline | Chronologie | Cronología |
| `report-title` | 📊 本次检测报告 | 📊 Session Report | 📊 Rapport | 📊 Informe |
| `report-duration` | 检测时长 | Duration | Durée | Duración |
| `report-good` | 优秀坐姿 | Good posture | Bonne posture | Buena postura |
| `report-bad` | 不良坐姿 | Poor posture | Mauvaise posture | Mala postura |
| `report-rate` | 优秀率 | Good rate | Taux bon | Tasa buena |
| `report-close` | 关闭 | Close | Fermer | Cerrar |
| `back-home` | ← 返回首页 | ← Home | ← Accueil | ← Inicio |
| `model-loading-text` | 正在加载推理引擎… | Loading AI engine… | Chargement IA… | Cargando IA… |
| `model-error-title` | ⚠️ 模型加载失败 | ⚠️ Load failed | ⚠️ Échec | ⚠️ Error |
| `model-retry` | 🔄 重新加载 | 🔄 Retry | 🔄 Réessayer | 🔄 Reintentar |
| `badge-warn` | 请坐直！已弓腰 {n}s | Sit up! {n}s hunching | Redressez-vous! {n}s | ¡Siéntate recto! {n}s |
| `badge-camera-denied` | ❌ 摄像头权限被拒 | ❌ Camera denied | ❌ Caméra refusée | ❌ Cámara denegada |

**注意：** `badge-warn` 含动态插值，实现时用 `t('badge-warn').replace('{n}', continuousBad)` 而非直接 `textContent = ...`。`badge-good` / `badge-bad` / `badge-stopped` 等静态 badge 在 JS 里直接赋值，不走 `data-i18n`，需在 `tick()` 和 `stopDetection()` 里取翻译值。

---

## 三、index.html 多语言

### 3.1 实现方式

纯 inline JS，无外部依赖：

1. 所有需要翻译的 DOM 节点加 `data-i18n="key"` 属性
2. JS 翻译对象 `TRANSLATIONS = { zh: {...}, en: {...}, fr: {...}, es: {...} }`
3. `applyLang(lang)` 遍历所有 `[data-i18n]` 节点，设置 `textContent`（部分含 HTML 的用 `innerHTML`）
4. 页面加载时调用 `applyLang(detectLang())`

### 3.2 语言检测逻辑

```js
function detectLang() {
  const saved = localStorage.getItem('lang')
  if (saved && ['zh','en','fr','es'].includes(saved)) return saved
  const browser = (navigator.language || 'zh').slice(0, 2).toLowerCase()
  return ['zh','en','fr','es'].includes(browser) ? browser : 'zh'
}
```

### 3.3 语言切换器 UI

位置：导航栏右侧，"定价"链接与"免费体验"按钮之间。

```html
<div class="lang-switcher">
  <button id="lang-btn">🌐 <span id="lang-label">中文</span> ▾</button>
  <div class="lang-menu" id="lang-menu">
    <button data-lang="zh">中文</button>
    <button data-lang="en">English</button>
    <button data-lang="fr">Français</button>
    <button data-lang="es">Español</button>
  </div>
</div>
```

点击 `lang-btn` 展开/收起菜单；点击语言项调用 `setLang(lang)`：
```js
function setLang(lang) {
  localStorage.setItem('lang', lang)
  applyLang(lang)
  // 更新 lang-label 显示当前语言
}
```

菜单在点击外部区域时自动收起（document click 监听）。

### 3.4 需要翻译的区域

- 导航：定价链接文字、CTA 按钮
- Hero：tag、标题 h1、副标题、3 个 badge、两个按钮、注脚
- 痛点区（section.pain）：tag、h2、副标题；3 张卡片的 h3、p、after
- 功能区（section.features）：tag、h2、副标题；6 张卡片的 h3、p
- 效果区（section.outcomes）：tag、h2；3 张卡片的 p
- 步骤区（section.how）：tag、h2；3 步的 h3、p
- 定价区（section.pricing）：tag、h2、副标题；3 个套餐的名称、单位、规格文字、性价比文字；底部链接文字
- CTA 区：h2、p、按钮、两行注脚
- 微信联系区：tag、h2、p、微信号下方说明
- Footer：主文案、链接文字

### 3.5 修改的静态内容

- `<link rel="canonical">` href 改为 `https://situpright.netlify.app/`
- `og:url` 改为 `https://situpright.netlify.app/`
- 首页 "免费试用 5 分钟" 按钮改为带 `data-i18n` 的多语言版，href 改为 `free-demo.html`
- "了解功能" 按钮文字同步多语言
- 现有定价区段内链接到 `posture-static-demo.html` 的文字按钮不做修改（保留但不重点展示）

---

## 四、free-demo.html SEO Meta

```html
<title>免费坐姿检测 · 无需注册，无限使用 | SitUpright</title>
<meta name="description" content="免费 AI 坐姿检测，无需注册、无时间限制。弓腰超 5 秒自动语音提醒。Free posture monitor, détecteur de posture gratuit, detector de postura gratuito." />
<meta name="keywords" content="free posture monitor,坐姿检测免费,détecteur posture gratuit,detector postura gratis,AI posture check" />
<link rel="canonical" href="https://situpright.netlify.app/free-demo.html" />
<meta property="og:type"        content="website" />
<meta property="og:title"       content="免费坐姿检测 · 无限使用 | SitUpright" />
<meta property="og:description" content="AI 实时坐姿检测，完全免费，无需注册，无时间限制。" />
<meta property="og:url"         content="https://situpright.netlify.app/free-demo.html" />
```

---

## 五、sitemap.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://situpright.netlify.app/</loc>
    <lastmod>2026-06-29</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://situpright.netlify.app/free-demo.html</loc>
    <lastmod>2026-06-29</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

---

## 六、robots.txt

```
User-agent: *
Allow: /

Sitemap: https://situpright.netlify.app/sitemap.xml
```

---

## 七、不在本次范围内

- `posture-static-demo.html` 内容不做任何修改
- Next.js frontend（`/frontend`）不做任何修改
- 定价/登录/注册页面保留，仅移除首页入口链接
- 不新增任何 npm 依赖
