const INVALID_FILENAME_CHARACTERS = /[<>:"/\\|?*]/g
const CONTROL_AND_BIDI_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

function utf8Length(value: string) {
  return new TextEncoder().encode(value).length
}

function truncateUtf8(value: string, maximumBytes: number) {
  if (utf8Length(value) <= maximumBytes) return value

  let result = ""
  let bytes = 0
  const encoder = new TextEncoder()

  for (const character of value) {
    const characterBytes = encoder.encode(character).length
    if (bytes + characterBytes > maximumBytes) break
    result += character
    bytes += characterBytes
  }

  return result
}

export function sanitizeDownloadName(
  value: string,
  fallback = "download",
  maximumBytes = 240,
) {
  let name = value
    .normalize("NFC")
    .replace(INVALID_FILENAME_CHARACTERS, "_")
    .replace(CONTROL_AND_BIDI_CHARACTERS, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[. ]+/g, "")
    .replace(/[. ]+$/g, "")

  if (!name || name === "." || name === "..") name = fallback
  if (WINDOWS_RESERVED_NAME.test(name)) name = `_${name}`

  name = truncateUtf8(name, maximumBytes)
  return name || fallback
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = sanitizeDownloadName(fileName)
  anchor.hidden = true
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Firefox may not start the download until the current task completes.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
