import _sodium from "libsodium-wrappers-sumo"
import * as openpgp from "openpgp"
import { sanitizeDownloadName } from "./download.ts"

const STREAM_CHUNK_SIZE = 4 * 1024 * 1024
const LEGACY_CHUNK_SIZE = 64 * 1024 * 1024
const MAGIC = new Uint8Array([0x53, 0x4c, 0x4f, 0x43, 0x4b, 0x03, 0x0d, 0x0a])
const PASSWORD_MODE = 1
const SALT_BYTES = 16
const METADATA_LIMIT = 16 * 1024
const FILE_NAME_LIMIT = 1024
const MIME_TYPE_LIMIT = 255
export const MAX_PGP_KEY_LENGTH = 5 * 1024 * 1024

let sodiumInstance: typeof _sodium | null = null

async function initSodium() {
  if (!sodiumInstance) {
    await _sodium.ready
    sodiumInstance = _sodium
  }
  return sodiumInstance
}

function concatBytes(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function asBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.buffer instanceof ArrayBuffer) {
    return bytes as Uint8Array<ArrayBuffer>
  }
  return new Uint8Array(bytes)
}

function uint32(value: number) {
  const output = new Uint8Array(4)
  new DataView(output.buffer).setUint32(0, value, true)
  return output
}

function readUint32(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true)
}

async function readSlice(file: Blob, start: number, length: number) {
  return new Uint8Array(await file.slice(start, start + length).arrayBuffer())
}

function isCurrentFormat(bytes: Uint8Array) {
  return bytes.length >= MAGIC.length && MAGIC.every((byte, index) => bytes[index] === byte)
}

function parseMetadata(bytes: Uint8Array) {
  try {
    const metadata = JSON.parse(new TextDecoder().decode(bytes)) as {
      name?: unknown
      type?: unknown
      size?: unknown
    }
    if (
      typeof metadata.name !== "string" ||
      metadata.name.length === 0 ||
      metadata.name.length > FILE_NAME_LIMIT ||
      typeof metadata.type !== "string" ||
      metadata.type.length > MIME_TYPE_LIMIT ||
      typeof metadata.size !== "number" ||
      !Number.isSafeInteger(metadata.size) ||
      metadata.size < 0
    ) {
      throw new Error("INVALID_FILE_FORMAT")
    }
    return {
      name: sanitizeDownloadName(metadata.name, "decrypted-file"),
      size: metadata.size,
    }
  } catch {
    throw new Error("INVALID_FILE_FORMAT")
  }
}

export async function encryptFile(
  file: File,
  secret: string,
  method: "password" | "pgp",
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  return method === "password"
    ? encryptFileWithPassword(file, secret, onProgress)
    : encryptFileWithPGP(file, secret, onProgress)
}

export async function decryptFile(
  file: File,
  secret: string,
  method: "password" | "pgp",
  onProgress?: (progress: number) => void,
  pgpPassphrase?: string,
): Promise<{ blob: Blob; fileName: string }> {
  return method === "password"
    ? decryptFileWithPassword(file, secret, onProgress)
    : decryptFileWithPGP(file, secret, onProgress, pgpPassphrase)
}

async function encryptFileWithPassword(
  file: File,
  password: string,
  onProgress?: (progress: number) => void,
) {
  const sodium = await initSodium()
  const salt = sodium.randombytes_buf(SALT_BYTES)
  const opsLimit = sodium.crypto_pwhash_OPSLIMIT_MODERATE
  const memLimit = sodium.crypto_pwhash_MEMLIMIT_MODERATE
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES,
    password,
    salt,
    opsLimit,
    memLimit,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  )

  try {
    const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key)
    const metadata = new TextEncoder().encode(
      JSON.stringify({ name: file.name, type: file.type, size: file.size }),
    )
    const encryptedMetadata = sodium.crypto_secretstream_xchacha20poly1305_push(
      state,
      metadata,
      null,
      sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE,
    )
    sodium.memzero(metadata)

    const prefix = concatBytes([
      MAGIC,
      new Uint8Array([PASSWORD_MODE]),
      uint32(opsLimit),
      uint32(memLimit),
      salt,
      header,
      uint32(encryptedMetadata.length),
      encryptedMetadata,
    ])
    const output: BlobPart[] = [prefix]

    if (file.size === 0) {
      output.push(
        asBlobPart(
          sodium.crypto_secretstream_xchacha20poly1305_push(
            state,
            new Uint8Array(0),
            null,
            sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL,
          ),
        ),
      )
    } else {
      let offset = 0
      while (offset < file.size) {
        const end = Math.min(offset + STREAM_CHUNK_SIZE, file.size)
        const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer())
        const tag = end === file.size
          ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
          : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE
        output.push(
          asBlobPart(sodium.crypto_secretstream_xchacha20poly1305_push(state, chunk, null, tag)),
        )
        sodium.memzero(chunk)
        offset = end
        onProgress?.(Math.round((offset / file.size) * 100))
      }
    }

    onProgress?.(100)
    return new Blob(output, { type: "application/octet-stream" })
  } finally {
    sodium.memzero(key)
  }
}

async function decryptFileWithPassword(
  file: File,
  password: string,
  onProgress?: (progress: number) => void,
) {
  const firstBytes = await readSlice(file, 0, MAGIC.length)
  return isCurrentFormat(firstBytes)
    ? decryptCurrentPasswordFormat(file, password, onProgress)
    : decryptLegacyPasswordFormat(file, password, onProgress)
}

async function decryptCurrentPasswordFormat(
  file: File,
  password: string,
  onProgress?: (progress: number) => void,
) {
  const sodium = await initSodium()
  const fixedHeaderSize =
    MAGIC.length + 1 + 4 + 4 + SALT_BYTES + sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES + 4

  if (file.size < fixedHeaderSize + sodium.crypto_secretstream_xchacha20poly1305_ABYTES * 2) {
    throw new Error("INVALID_FILE_FORMAT")
  }

  const headerBytes = await readSlice(file, 0, fixedHeaderSize)
  let position = MAGIC.length
  const mode = headerBytes[position]
  position += 1
  if (mode !== PASSWORD_MODE) throw new Error("INVALID_FILE_FORMAT")

  const opsLimit = readUint32(headerBytes, position)
  position += 4
  const memLimit = readUint32(headerBytes, position)
  position += 4
  if (
    opsLimit < sodium.crypto_pwhash_OPSLIMIT_MIN ||
    opsLimit > sodium.crypto_pwhash_OPSLIMIT_MODERATE ||
    memLimit < sodium.crypto_pwhash_MEMLIMIT_MIN ||
    memLimit > sodium.crypto_pwhash_MEMLIMIT_MODERATE
  ) {
    throw new Error("INVALID_FILE_FORMAT")
  }

  const salt = headerBytes.slice(position, position + SALT_BYTES)
  position += SALT_BYTES
  const streamHeader = headerBytes.slice(
    position,
    position + sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES,
  )
  position += sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES
  const encryptedMetadataLength = readUint32(headerBytes, position)
  if (
    encryptedMetadataLength < sodium.crypto_secretstream_xchacha20poly1305_ABYTES ||
    encryptedMetadataLength > METADATA_LIMIT ||
    fixedHeaderSize + encryptedMetadataLength >= file.size
  ) {
    throw new Error("INVALID_FILE_FORMAT")
  }

  const key = sodium.crypto_pwhash(
    sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES,
    password,
    salt,
    opsLimit,
    memLimit,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  )
  const output: Uint8Array<ArrayBuffer>[] = []

  try {
    const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(streamHeader, key)
    const encryptedMetadata = await readSlice(file, fixedHeaderSize, encryptedMetadataLength)
    const metadataResult = sodium.crypto_secretstream_xchacha20poly1305_pull(state, encryptedMetadata, null)
    if (!metadataResult || metadataResult.tag !== sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE) {
      throw new Error("Decryption failed. Please check your password.")
    }
    let metadata: ReturnType<typeof parseMetadata>
    try {
      metadata = parseMetadata(metadataResult.message)
    } finally {
      sodium.memzero(metadataResult.message)
    }

    let encryptedOffset = fixedHeaderSize + encryptedMetadataLength
    let decryptedSize = 0
    let finalSeen = false

    while (encryptedOffset < file.size) {
      const encryptedLength = Math.min(
        STREAM_CHUNK_SIZE + sodium.crypto_secretstream_xchacha20poly1305_ABYTES,
        file.size - encryptedOffset,
      )
      const encryptedChunk = await readSlice(file, encryptedOffset, encryptedLength)
      const result = sodium.crypto_secretstream_xchacha20poly1305_pull(state, encryptedChunk, null)
      if (!result) throw new Error("Decryption failed. Please check your password.")

      output.push(asBlobPart(result.message))
      decryptedSize += result.message.length
      encryptedOffset += encryptedLength
      finalSeen = result.tag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL

      if (finalSeen && encryptedOffset !== file.size) throw new Error("INVALID_FILE_FORMAT")
      if (finalSeen) break
      onProgress?.(Math.round((encryptedOffset / file.size) * 100))
    }

    if (!finalSeen || decryptedSize !== metadata.size || encryptedOffset !== file.size) {
      throw new Error("INVALID_FILE_FORMAT")
    }

    onProgress?.(100)
    return {
      blob: new Blob(output, { type: "application/octet-stream" }),
      fileName: metadata.name,
    }
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_FILE_FORMAT") throw error
    throw new Error("Decryption failed. Please check your password or file integrity.")
  } finally {
    for (const part of output) sodium.memzero(part)
    sodium.memzero(key)
  }
}

async function decryptLegacyPasswordFormat(
  file: File,
  password: string,
  onProgress?: (progress: number) => void,
) {
  const sodium = await initSodium()
  const metadataLengthBytes = await readSlice(file, 0, 4)
  if (metadataLengthBytes.length !== 4) throw new Error("INVALID_FILE_FORMAT")
  const metadataLength = readUint32(metadataLengthBytes, 0)
  const legacyHeaderSize = 4 + metadataLength + SALT_BYTES + sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES
  if (metadataLength < 10 || metadataLength > 10_000 || legacyHeaderSize >= file.size) {
    throw new Error("INVALID_FILE_FORMAT")
  }

  const metadataBytes = await readSlice(file, 4, metadataLength)
  let metadata: ReturnType<typeof parseMetadata>
  try {
    metadata = parseMetadata(metadataBytes)
  } finally {
    sodium.memzero(metadataBytes)
  }
  let position = 4 + metadataLength
  const salt = await readSlice(file, position, SALT_BYTES)
  position += SALT_BYTES
  const streamHeader = await readSlice(file, position, sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES)
  position += sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  )
  const output: Uint8Array<ArrayBuffer>[] = []

  try {
    const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(streamHeader, key)
    let decryptedSize = 0
    let finalSeen = false

    while (position < file.size) {
      const encryptedLength = Math.min(
        LEGACY_CHUNK_SIZE + sodium.crypto_secretstream_xchacha20poly1305_ABYTES,
        file.size - position,
      )
      const encryptedChunk = await readSlice(file, position, encryptedLength)
      const result = sodium.crypto_secretstream_xchacha20poly1305_pull(state, encryptedChunk, null)
      if (!result) throw new Error("Decryption failed. Please check your password.")
      output.push(asBlobPart(result.message))
      decryptedSize += result.message.length
      position += encryptedLength
      finalSeen = result.tag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
      if (finalSeen) break
      onProgress?.(Math.round((position / file.size) * 100))
    }

    if (!finalSeen || position !== file.size || decryptedSize !== metadata.size) {
      throw new Error("INVALID_FILE_FORMAT")
    }
    onProgress?.(100)
    return {
      blob: new Blob(output, { type: "application/octet-stream" }),
      fileName: metadata.name,
    }
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_FILE_FORMAT") throw error
    throw new Error("Decryption failed. Please check your password.")
  } finally {
    for (const part of output) sodium.memzero(part)
    sodium.memzero(key)
  }
}

async function encryptFileWithPGP(
  file: File,
  publicKeyArmored: string,
  onProgress?: (progress: number) => void,
) {
  if (publicKeyArmored.length > MAX_PGP_KEY_LENGTH) throw new Error("The PGP public key is too large.")
  const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored })
  await publicKey.verifyPrimaryKey()
  if (await publicKey.isRevoked()) {
    throw new Error("The PGP public key is revoked and must not be used.")
  }
  const expirationTime = await publicKey.getExpirationTime()
  if (expirationTime instanceof Date && expirationTime.getTime() <= Date.now()) {
    throw new Error("The PGP public key is expired and must not be used.")
  }
  await publicKey.getEncryptionKey()

  const metadata = new TextEncoder().encode(
    JSON.stringify({ name: file.name, type: file.type, size: file.size }),
  )
  const fileData = new Uint8Array(await file.arrayBuffer())
  const combined = concatBytes([uint32(metadata.length), metadata, fileData])

  try {
    onProgress?.(50)
    const encrypted = await openpgp.encrypt({
      message: await openpgp.createMessage({ binary: combined }),
      encryptionKeys: publicKey,
      format: "binary",
    })
    onProgress?.(100)
    return new Blob([asBlobPart(encrypted as Uint8Array)], { type: "application/octet-stream" })
  } finally {
    fileData.fill(0)
    metadata.fill(0)
    combined.fill(0)
  }
}

async function decryptFileWithPGP(
  file: File,
  privateKeyArmored: string,
  onProgress?: (progress: number) => void,
  passphrase?: string,
) {
  if (privateKeyArmored.length > MAX_PGP_KEY_LENGTH) throw new Error("The PGP private key is too large.")
  let privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored })
  if (!privateKey.isDecrypted()) {
    try {
      privateKey = await openpgp.decryptKey({ privateKey, passphrase: passphrase || "" })
    } catch {
      throw new Error("Failed to unlock the PGP private key. Please check its passphrase.")
    }
  }

  onProgress?.(20)
  const message = await openpgp.readMessage({ binaryMessage: new Uint8Array(await file.arrayBuffer()) })
  onProgress?.(40)
  const { data } = await openpgp.decrypt({ message, decryptionKeys: privateKey, format: "binary" })
  onProgress?.(80)
  const decrypted = data as Uint8Array
  try {
    if (decrypted.length < 4) throw new Error("INVALID_FILE_FORMAT")
    const metadataLength = readUint32(decrypted, 0)
    if (metadataLength < 10 || metadataLength > METADATA_LIMIT || 4 + metadataLength > decrypted.length) {
      throw new Error("INVALID_FILE_FORMAT")
    }
    const metadata = parseMetadata(decrypted.slice(4, 4 + metadataLength))
    const fileData = decrypted.slice(4 + metadataLength)
    if (fileData.length !== metadata.size) throw new Error("INVALID_FILE_FORMAT")
    onProgress?.(100)
    return {
      blob: new Blob([fileData], { type: "application/octet-stream" }),
      fileName: metadata.name,
    }
  } finally {
    decrypted.fill(0)
  }
}

export async function inspectPGPKey(armoredKey: string, kind: "public" | "private") {
  if (armoredKey.length > MAX_PGP_KEY_LENGTH) throw new Error("The PGP key is too large.")
  const key = kind === "public"
    ? await openpgp.readKey({ armoredKey })
    : await openpgp.readPrivateKey({ armoredKey })

  if (kind === "public") {
    await key.verifyPrimaryKey()
    if (await key.isRevoked()) throw new Error("The PGP public key is revoked.")
    const expirationTime = await key.getExpirationTime()
    if (expirationTime instanceof Date && expirationTime.getTime() <= Date.now()) {
      throw new Error("The PGP public key is expired.")
    }
    await key.getEncryptionKey()
  }

  const fingerprint = key.getFingerprint().toUpperCase().match(/.{1,4}/g)?.join(" ") ?? ""

  return {
    fingerprint,
    identity: key.getUserIDs()[0]?.slice(0, 200) ?? "No identity included",
  }
}
