import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, extname, join, normalize, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outputDirectory = join(projectDirectory, "out")
const sourcePath = join(outputDirectory, "index.html")
const offlinePath = join(outputDirectory, "enclave.html")
const checksumPath = `${offlinePath}.sha256`

const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

const contentSecurityPolicy = [
  "default-src 'none'",
  "connect-src 'none'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "style-src 'unsafe-inline' data:",
  "script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "worker-src blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ")

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function escapeInlineScript(value) {
  return value.replace(/<\/script/gi, "<\\/script")
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))
  return match?.[2]
}

function isLocalUrl(value) {
  return value.startsWith("/") && !value.startsWith("//")
}

function outputFileForUrl(value) {
  if (!isLocalUrl(value)) {
    throw new Error(`Expected a local output URL, received: ${value}`)
  }

  const pathname = decodeURIComponent(value.split(/[?#]/, 1)[0])
  const relativePath = normalize(pathname.slice(1))
  const resolvedPath = resolve(outputDirectory, relativePath)
  const outputPrefix = `${resolve(outputDirectory)}${sep}`

  if (!resolvedPath.startsWith(outputPrefix)) {
    throw new Error(`Refusing to read outside the static export: ${value}`)
  }

  return resolvedPath
}

async function asDataUrl(value) {
  const filePath = outputFileForUrl(value)
  const mimeType = mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream"
  const contents = await readFile(filePath)
  return `data:${mimeType};base64,${contents.toString("base64")}`
}

async function inlineCssUrls(css, stylesheetUrl) {
  const matches = [...css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)]
  if (matches.length === 0) return css

  let result = ""
  let cursor = 0

  for (const match of matches) {
    const [fullMatch, , value] = match
    const index = match.index ?? 0
    result += css.slice(cursor, index)

    if (/^(?:data:|#)/i.test(value)) {
      result += fullMatch
    } else if (/^(?:blob:|https?:|\/\/)/i.test(value)) {
      throw new Error(`Stylesheet ${stylesheetUrl} contains a remote asset: ${value}`)
    } else {
      const assetUrl = new URL(value, `https://offline.enclave.invalid${stylesheetUrl}`).pathname
      result += `url("${await asDataUrl(assetUrl)}")`
    }

    cursor = index + fullMatch.length
  }

  return result + css.slice(cursor)
}

function patchAssetPrefix(chunk, sourceUrl) {
  const exportIndex = chunk.indexOf('"getAssetPrefix"')
  if (exportIndex === -1) return chunk

  const currentScriptIndex = chunk.indexOf("document.currentScript", exportIndex)
  const functionStart = chunk.lastIndexOf("function ", currentScriptIndex)
  const signatureEnd = chunk.indexOf("(){", functionStart)
  const functionEnd = chunk.indexOf('}("function"==typeof', currentScriptIndex)

  if (
    currentScriptIndex === -1 ||
    functionStart === -1 ||
    signatureEnd === -1 ||
    functionEnd === -1
  ) {
    throw new Error(`Could not make Next.js asset-prefix detection portable in ${sourceUrl}`)
  }

  return `${chunk.slice(0, signatureEnd + 3)}return""${chunk.slice(functionEnd)}`
}

function patchOfflineChunkLoader(chunk, sourceUrl) {
  const original = "if(r.loadingStarted)return r.promise;"
  const replacement = "if(r.loadingStarted||r.resolved)return r.promise;"
  const occurrences = chunk.split(original).length - 1

  if (occurrences !== 1) {
    throw new Error(`Could not make Next.js chunk loading portable in ${sourceUrl}`)
  }

  return chunk.replace(original, replacement)
}

function replaceEverywhere(html, from, to) {
  return html.split(from).join(to)
}

function assertPortable(html) {
  const executableSource = html.match(/<script\b(?=[^>]*\bsrc\s*=)[^>]*>/i)
  if (executableSource) {
    throw new Error(`Offline build still contains an external script: ${executableSource[0]}`)
  }

  for (const link of html.matchAll(/<link\b[^>]*>/gi)) {
    const href = getAttribute(link[0], "href")
    if (href && !/^(?:data:|blob:|#)/i.test(href)) {
      throw new Error(`Offline build still contains an external link resource: ${link[0]}`)
    }
  }

  for (const media of html.matchAll(/<(?:img|source|audio|video|iframe)\b[^>]*>/gi)) {
    const source = getAttribute(media[0], "src")
    if (source && !/^(?:data:|blob:)/i.test(source)) {
      throw new Error(`Offline build still contains an external media resource: ${media[0]}`)
    }
  }

  if (!html.includes("connect-src 'none'")) {
    throw new Error("Offline build is missing its network-blocking content-security policy")
  }

  if (!html.includes("data-enclave-offline")) {
    throw new Error("Offline build is missing its portable-edition marker")
  }
}

let html = await readFile(sourcePath, "utf8")

html = html.replace(
  "<head>",
  `<head><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(contentSecurityPolicy)}"/><meta name="enclave-edition" content="offline"/>`,
)
html = html.replace("<html ", '<html data-enclave-offline="true" ')
html = html.replace(
  "</head>",
  "<style>html[data-enclave-offline] [data-offline-download]{display:none}</style></head>",
)

const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0])
for (const tag of linkTags) {
  const href = getAttribute(tag, "href")
  const rel = getAttribute(tag, "rel")?.toLowerCase() ?? ""

  if (!href || !isLocalUrl(href)) continue

  if (rel.split(/\s+/).some((value) => value === "preload" || value === "modulepreload")) {
    html = html.replace(tag, "")
    continue
  }

  if (rel === "stylesheet") {
    const css = await inlineCssUrls(await readFile(outputFileForUrl(href), "utf8"), href)
    const dataUrl = `data:text/css;base64,${Buffer.from(css).toString("base64")}`
    html = replaceEverywhere(html, href, dataUrl)
    continue
  }

  if (rel.split(/\s+/).includes("icon")) {
    html = replaceEverywhere(html, href, await asDataUrl(href))
  }
}

const embeddedMediaUrls = new Map()
for (const tag of html.matchAll(/<(?:img|source|audio|video)\b[^>]*>/gi)) {
  for (const attribute of ["src", "poster"]) {
    const value = getAttribute(tag[0], attribute)
    if (value && isLocalUrl(value) && !embeddedMediaUrls.has(value)) {
      embeddedMediaUrls.set(value, await asDataUrl(value))
    }
  }
}
for (const [sourceUrl, dataUrl] of embeddedMediaUrls) {
  html = replaceEverywhere(html, sourceUrl, dataUrl)
}

const externalScripts = []
for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*><\/script>/gi)) {
  const tag = match[0]
  const sourceUrl = match[2]
  if (!isLocalUrl(sourceUrl)) {
    throw new Error(`The application contains a remote script and cannot be made offline: ${sourceUrl}`)
  }

  let contents = await readFile(outputFileForUrl(sourceUrl), "utf8")
  const isRuntime = /\/turbopack-[^/]+\.js(?:[?#].*)?$/.test(sourceUrl)
  contents = patchAssetPrefix(contents, sourceUrl)
  if (isRuntime) contents = patchOfflineChunkLoader(contents, sourceUrl)
  contents = contents.replace(/^\s*\/\/[#@]\s*sourceMappingURL=.*$/gm, "")

  externalScripts.push({
    tag,
    index: match.index ?? 0,
    sourceUrl,
    contents,
    noModule: /\bnoModule(?:\s*=|\s|>)/i.test(tag),
    isTurbopackChunk: contents.includes("TURBOPACK") && contents.includes("document.currentScript"),
    isRuntime,
  })
}

const runtimeIndex = externalScripts.findIndex((script) => script.isRuntime)
if (runtimeIndex === -1) {
  throw new Error("Could not locate the Next.js runtime needed by the offline edition")
}

const queuedChunkPaths = externalScripts
  .slice(0, runtimeIndex + 1)
  .filter((script) => script.isTurbopackChunk)
  .map((script) => script.sourceUrl)
  .reverse()

if (queuedChunkPaths.length === 0) {
  throw new Error("No boot-time Next.js chunks were found for the offline edition")
}

for (const script of [...externalScripts].reverse()) {
  const attributes = [
    'type="application/x-enclave-chunk"',
    `data-source="${escapeAttribute(script.sourceUrl)}"`,
    script.isTurbopackChunk ? 'data-turbopack="true"' : "",
    script.isRuntime ? 'data-runtime="true"' : "",
    script.noModule ? 'data-no-module="true"' : "",
  ].filter(Boolean).join(" ")

  const holder = `<script ${attributes}>${escapeInlineScript(script.contents)}</script>`
  html = `${html.slice(0, script.index)}${holder}${html.slice(script.index + script.tag.length)}`
}

const runner = `
<script data-enclave-runner>
(() => {
  const chunks = [...document.querySelectorAll('script[type="application/x-enclave-chunk"]')]
  const runtimeIndex = chunks.findIndex((chunk) => chunk.dataset.runtime === "true")
  const queuedPaths = chunks
    .slice(0, runtimeIndex + 1)
    .filter((chunk) => chunk.dataset.turbopack === "true")
    .map((chunk) => chunk.dataset.source)
    .reverse()

  globalThis.TURBOPACK_NEXT_CHUNK_URLS = queuedPaths

  for (const [index, chunk] of chunks.entries()) {
    if (chunk.dataset.noModule === "true" && "noModule" in HTMLScriptElement.prototype) {
      chunk.remove()
      continue
    }

    const source = chunk.dataset.source
    if (index > runtimeIndex && chunk.dataset.turbopack === "true") {
      globalThis.TURBOPACK_NEXT_CHUNK_URLS.push(source)
    }

    ;(0, eval)(chunk.textContent + "\\n//# sourceURL=" + source)
    chunk.remove()
  }
})()
</script>`

html = html.replace("</body>", `${runner}</body>`)
assertPortable(html)

await writeFile(offlinePath, html)
const checksum = createHash("sha256").update(html).digest("hex")
await writeFile(checksumPath, `${checksum}  enclave.html\n`)

const size = Buffer.byteLength(html)
console.log(`Created out/enclave.html (${(size / 1024 / 1024).toFixed(2)} MiB)`)
console.log(`SHA-256: ${checksum}`)
