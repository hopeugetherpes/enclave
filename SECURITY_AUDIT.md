# Security review — 2026-09-18

This review covers the application source, cryptographic file handling, browser privacy controls, direct and transitive
dependencies, GitHub Actions, release signing, repository rules, and the committed Git history at baseline commit
`e5d935155d96f5b4b64536b51d5e0a057cf6babc`.

It is an engineering security review, not a formal independent cryptographic audit or a guarantee that no vulnerability
exists.

## Remediated findings

| Severity | Finding | Remediation |
| --- | --- | --- |
| High | The release job installed dependencies and executed the build while holding `contents: write` and `id-token: write`. Compromised build-time code could steal release authority. | The build now runs in a read-only job. Only its checksummed artifact crosses into a minimal signing/publishing job with write and OIDC permissions. |
| Medium | The hosted application had no committed CSP or defense-in-depth response headers. A future injection bug or compromised same-origin resource would have had fewer containment barriers. | Vercel now sends a network-denying CSP, HSTS, no-referrer, anti-framing, MIME-sniffing, opener/resource isolation, and restrictive permissions headers. Generated hosted HTML adds a second, hash-based CSP that authorizes only its exact inline scripts and does not allow JavaScript `eval`. |
| Medium | New password files used Libsodium's interactive Argon2id limits, which are intentionally optimized for interactive authentication rather than offline file protection. | New files use Libsodium's moderate Argon2id operations and memory limits. The parameters remain stored in the format, so existing files continue to decrypt. |
| Medium | Authenticated metadata could supply path separators, bidirectional overrides, control characters, reserved device names, or extremely long names. Its media type was reused for the plaintext Blob. | Metadata lengths are bounded, recovered names are normalized and sanitized, download names are UTF-8 length-limited, and decrypted content is always offered as `application/octet-stream`. |
| Medium | PGP encryption did not explicitly reject revoked, expired, invalid, or non-encryption-capable public keys, and the UI did not show a fingerprint. | Public keys are validated before encryption. The UI displays the primary identity and fingerprint and tells users to verify it out of band. Armored key input is size-limited. |
| Low | Mutable plaintext buffers survived until garbage collection after several password and PGP operations. | Plaintext chunks, combined PGP input, decrypted PGP data, metadata bytes, and derived symmetric keys are overwritten on a best-effort basis after use. |
| Low | Direct dependency ranges included `latest` and caret ranges, an unused runtime dependency was shipped, and install lifecycle scripts were enabled by default. | Direct versions and pnpm are pinned, the unused dependency was removed, lockfile integrity remains enforced, and lifecycle scripts are disabled in project configuration and CI. |
| Low | Documentation overstated the authentication of the format marker, described an unsupported fixed Safari limit, implied all modes used Libsodium, and omitted host/request metadata. | README, UI copy, the security policy, and `PRIVACY.md` now state the actual algorithms, metadata, host visibility, memory limits, and trust boundaries. |

## Checks with no finding

- `pnpm audit --prod --audit-level low`: no known vulnerable production dependency at review time.
- No application source call to `fetch`, XHR, WebSocket, EventSource, `sendBeacon`, cookies, local storage, or session
  storage was found. Build-only package-manager and release traffic is separate from the browser application.
- No credential-like token, private-key block, sensitive filename, or environment file was found in the committed Git
  history by the review's pattern scan.
- GitHub Actions are pinned to full commit SHAs. CodeQL, dependency review, Dependabot, signed checksums, and protected
  pull-request merges were already present.
- Password ciphertext uses authenticated Libsodium secret streams; current-format metadata is encrypted and
  authenticated; file length and final-stream state are checked during decryption.

## Residual risks and deliberate limitations

- A live hosted cryptography tool inherits trust in the domain, hosting platform, delivered JavaScript, browser,
  extensions, operating system, and device. Use the verified signed offline release for high-risk data.
- The hosting provider sees ordinary request metadata such as IP address, time, path, and user agent, but the application
  does not send files, passwords, keys, filenames, or plaintext.
- JavaScript strings cannot be reliably overwritten. Password and armored-key state is cleared after use, but runtime or
  browser copies may remain until garbage collection.
- OpenPGP mode loads the complete file into memory and may use multiple copies. Password mode is chunked. Browser memory
  limits remain unavoidable.
- Enclave encrypts but does not sign OpenPGP files. Decryption integrity is not malware scanning and, without an external
  signature, does not authenticate the sender.
- Ciphertext length leaks approximate plaintext size. Enclave/OpenPGP format identification and ordinary PGP packet
  metadata are not hidden. Legacy Enclave files had plaintext filename/type/size metadata.
- The portable Next.js build uses inline evaluation to boot embedded application chunks. Its offline CSP blocks all
  network connections, and releases include a SHA-256 checksum and keyless Sigstore signature. Verification remains
  essential because a modified local HTML file can modify its own policy and code.
- The project has not received an independent third-party cryptographic audit. Security-sensitive users should treat
  this review and the automated tests as evidence, not a proof of security.

## Verification added

CI now exercises password and PGP round trips, wrong-password and ciphertext-tampering rejection, hostile filename
handling, CSP hash authorization, deployment headers, offline checksums, TypeScript, production builds, dependency
advisories, CodeQL, and dependency review.
