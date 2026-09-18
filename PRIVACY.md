# Privacy and threat model

Enclave performs encryption and decryption in the browser. The application has no analytics, advertising, account,
database, upload endpoint, or runtime API. A restrictive Content Security Policy blocks `fetch`, XHR, WebSocket,
EventSource, and beacon connections, and prevents remote scripts, images, fonts, media, frames, and form submissions.

## What the hosted service can observe

Loading <https://enclave.anatole.co> still creates ordinary HTTPS requests for the page and its same-origin static
assets. The hosting provider can therefore observe connection metadata such as IP address, time, requested path, and
user agent. Files, passwords, PGP keys, filenames, and decrypted content are never sent by the application.

Following a link to GitHub or another site creates a request to that site. Enclave uses a no-referrer policy and
`rel="noreferrer"` so the destination does not receive the Enclave page URL as a referrer.

For the strongest protection against a compromised host, DNS, or live deployment, download the signed offline HTML
from a GitHub Release, verify its Sigstore signature and SHA-256 checksum, disconnect from the network, and then open
the verified file locally. The offline edition has a separate policy with `connect-src 'none'` and embeds all runtime
resources.

## What encrypted files reveal

- Ciphertext length reveals the approximate plaintext size.
- Password-encrypted files contain a recognizable Enclave format marker plus non-secret KDF parameters, salt, and a
  secretstream header. The original filename and media type are encrypted in the current format.
- Legacy Enclave files supported for decryption stored their filename, media type, and size in plaintext metadata.
- OpenPGP ciphertext is recognizable as OpenPGP data. Recipient-key information may be discoverable from ordinary
  OpenPGP packet metadata unless the protocol and key configuration hide it.

## Security boundaries

Enclave cannot protect data from a compromised browser, extension, operating system, keyboard, clipboard, or device.
JavaScript strings such as passwords and armored private keys cannot be reliably overwritten; they are cleared from UI
state after use and become eligible for garbage collection. Mutable key and plaintext byte buffers are overwritten on a
best-effort basis after use, but the browser and runtime may retain internal copies.

Authenticated decryption proves that ciphertext was not altered under the password or recipient key. It does not scan
the recovered file for malware. Password mode does not identify the sender, and Enclave's OpenPGP mode encrypts but does
not sign files. Verify public-key fingerprints out of band and treat unexpected decrypted files as untrusted.

There is no password recovery, escrow, or server-side copy. Losing the password or usable private key permanently loses
access to the data.
