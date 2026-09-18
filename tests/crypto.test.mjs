import assert from "node:assert/strict"
import { test } from "node:test"
import * as openpgp from "openpgp"
import { decryptFile, encryptFile, inspectPGPKey } from "../lib/crypto.ts"
import { sanitizeDownloadName } from "../lib/download.ts"

const PASSWORD = "Correct Horse Battery Staple! 42"

function asFile(blob, name = "payload.encrypted") {
  return new File([blob], name, { type: "application/octet-stream" })
}

test("password encryption round-trips data and sanitizes hostile metadata", async () => {
  const source = new File(
    [new TextEncoder().encode("private payload")],
    "../report\u202Efdp.exe",
    { type: "text/plain" },
  )

  const encrypted = await encryptFile(source, PASSWORD, "password")
  const decrypted = await decryptFile(asFile(encrypted), PASSWORD, "password")

  assert.equal(await decrypted.blob.text(), "private payload")
  assert.equal(decrypted.blob.type, "application/octet-stream")
  assert.equal(decrypted.fileName, "_reportfdp.exe")
})

test("password decryption rejects a wrong password and tampered ciphertext", async () => {
  const source = new File(["authenticated payload"], "payload.txt")
  const encrypted = await encryptFile(source, PASSWORD, "password")

  await assert.rejects(
    decryptFile(asFile(encrypted), "Definitely the wrong password! 7", "password"),
    /Decryption failed/,
  )

  const tampered = new Uint8Array(await encrypted.arrayBuffer())
  tampered[tampered.length - 1] ^= 1
  await assert.rejects(decryptFile(asFile(new Blob([tampered])), PASSWORD, "password"))
})

test("PGP encryption round-trips data and exposes a verifiable fingerprint", async () => {
  const passphrase = "PGP test passphrase"
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: "curve25519",
    userIDs: [{ name: "Enclave test", email: "test@example.invalid" }],
    passphrase,
  })
  const info = await inspectPGPKey(publicKey, "public")
  assert.match(info.fingerprint, /^(?:[0-9A-F]{4} )+[0-9A-F]{4}$/)

  const source = new File(["PGP payload"], "pgp.txt", { type: "text/plain" })
  const encrypted = await encryptFile(source, publicKey, "pgp")
  const decrypted = await decryptFile(asFile(encrypted), privateKey, "pgp", undefined, passphrase)

  assert.equal(await decrypted.blob.text(), "PGP payload")
  assert.equal(decrypted.fileName, "pgp.txt")
  assert.equal(decrypted.blob.type, "application/octet-stream")
})

test("download names remove path separators, controls, bidi overrides, and reserved names", () => {
  assert.equal(sanitizeDownloadName("../../secret\\name\u202Etxt.exe"), "_.._secret_nametxt.exe")
  assert.equal(sanitizeDownloadName("CON.txt"), "_CON.txt")
  assert.equal(sanitizeDownloadName("\u0000\u202E"), "download")
  assert.ok(new TextEncoder().encode(sanitizeDownloadName("😀".repeat(200))).length <= 240)
})
