import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outputDirectory = join(projectDirectory, "out")

async function findHostedHtml(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await findHostedHtml(path))
    if (entry.isFile() && entry.name.endsWith(".html") && entry.name !== "enclave.html") files.push(path)
  }
  return files
}

for (const path of await findHostedHtml(outputDirectory)) {
  const html = await readFile(path, "utf8")
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1]
  if (!policy || !policy.includes("connect-src 'none'") || policy.includes("'unsafe-eval'")) {
    throw new Error(`${path} does not contain the expected strict hosted CSP`)
  }

  for (const match of html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const hash = `sha256-${createHash("sha256").update(match[1]).digest("base64")}`
    if (!policy.includes(`'${hash}'`)) throw new Error(`${path} does not authorize inline script ${hash}`)
  }
}

const offlinePath = join(outputDirectory, "enclave.html")
const offline = await readFile(offlinePath)
const expectedChecksum = (await readFile(`${offlinePath}.sha256`, "utf8")).trim().split(/\s+/, 1)[0]
const actualChecksum = createHash("sha256").update(offline).digest("hex")
if (actualChecksum !== expectedChecksum) throw new Error("The offline checksum does not match enclave.html")

const vercelConfig = JSON.parse(await readFile(join(projectDirectory, "vercel.json"), "utf8"))
const headers = vercelConfig.headers?.flatMap((entry) => entry.headers ?? []) ?? []
const header = (name) => headers.find((entry) => entry.key.toLowerCase() === name.toLowerCase())?.value
if (!header("Content-Security-Policy")?.includes("connect-src 'none'")) {
  throw new Error("The deployment CSP does not block runtime connections")
}
for (const requiredHeader of [
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
]) {
  if (!header(requiredHeader)) throw new Error(`Missing deployment header: ${requiredHeader}`)
}

console.log("Verified hosted CSP hashes, deployment headers, and offline checksum")
