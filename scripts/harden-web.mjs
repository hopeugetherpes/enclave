import { createHash } from "node:crypto"
import { readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outputDirectory = join(projectDirectory, "out")

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function scriptHash(source) {
  return `'sha256-${createHash("sha256").update(source).digest("base64")}'`
}

async function findHtmlFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await findHtmlFiles(path))
    if (entry.isFile() && entry.name.endsWith(".html") && entry.name !== "enclave.html") files.push(path)
  }
  return files
}

function assertNoRemoteSubresources(html, path) {
  const resourceTags = html.matchAll(/<(?:script|link|img|source|audio|video|iframe)\b[^>]*>/gi)
  for (const match of resourceTags) {
    const tag = match[0]
    const urlMatch = tag.match(/\b(?:src|href|poster)\s*=\s*(["'])(.*?)\1/i)
    const url = urlMatch?.[2]
    if (url && /^(?:https?:)?\/\//i.test(url)) {
      throw new Error(`${path} contains a remote subresource: ${url}`)
    }
  }
}

for (const path of await findHtmlFiles(outputDirectory)) {
  let html = await readFile(path, "utf8")
  if (/http-equiv=["']Content-Security-Policy["']/i.test(html)) {
    throw new Error(`${path} already contains a content-security policy`)
  }

  assertNoRemoteSubresources(html, path)

  const hashes = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => scriptHash(match[1]))
  const policy = [
    "default-src 'none'",
    "base-uri 'none'",
    "connect-src 'none'",
    "font-src 'self' data:",
    "form-action 'none'",
    "img-src 'self' data: blob:",
    "manifest-src 'self'",
    "media-src 'self' data: blob:",
    "object-src 'none'",
    `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")}`.trim(),
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
  ].join("; ")

  const securityMetadata = [
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}"/>`,
    '<meta name="referrer" content="no-referrer"/>',
    '<meta name="enclave-edition" content="hosted"/>',
  ].join("")

  html = html.replace("<head>", `<head>${securityMetadata}`)
  if (!html.includes("connect-src 'none'")) throw new Error(`Failed to harden ${path}`)
  await writeFile(path, html)
}

console.log("Added hash-based CSP policies to the hosted HTML files")
