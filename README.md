<p align="center">
  
<img width="100" height="100" alt="logo 100x100" src="https://github.com/user-attachments/assets/687698da-9124-40ca-8ed9-334d3b52fec5" />



<h1 align="center">🔒 Enclave</h1>

# **Secure File Encryption**

Enclave is a privacy-focused lightweight encryption web-app that allows you to encrypt and decrypt any file type locally in your browser without any data ever leaving your device. Built with security and privacy as core principles.

## Purpose

Enclave provides authenticated XChaCha20-Poly1305 encryption for any file type. Files and passwords remain inside the browser throughout encryption and decryption.

**Key Features:**
- 🔐 **XChaCha20-Poly1305 Encryption** - Implemented with [Libsodium](https://github.com/jedisct1/libsodium)
- 📁 **Universal File Support** - Encrypt any file type (documents, images, videos, etc.)
- 📦 **Chunked Processing** - No application-imposed limit; practical limits depend on the browser, memory, and encryption method
- 🌐 **Local Processing** - Zero server communication, complete privacy
- 🎯 **Zero Knowledge** - We never see your files or passwords
- 📱 **Cross-Platform** - Works on any device with a modern browser
- 🆓 **[Open Source](https://github.com/hopeugetherpes/enclave)** - Fully auditable code under [CC0](https://github.com/hopeugetherpes/enclave/blob/main/LICENSE) license

## 📖 Usage

### Getting Started
1. Visit the [🔒 Enclave](https://securelock.rxutn.chatgpt.site) web application
2. Choose your encryption method: [Password](https://github.com/hopeugetherpes/enclave/blob/main/README.md#password-requirements) or [PGP Key](https://pgp.cypherfucker.com)
3. Drag and drop your file or click to select
4. Enter a strong password (minimum 16 characters with numbers, uppercase, and special characters)
5. Click "Encrypt File" to secure your data
6. Download the encrypted file with `.encrypted` extension

### Decryption
1. Select "Decrypt" mode
2. Upload your encrypted `.encrypted` file
3. Enter the same password used for encryption
4. Click "Decrypt File" to restore your original file
5. Download the decrypted file

### Password Requirements
For maximum security, passwords must include:
- ✅ At least 16 characters
- ✅ At least one number
- ✅ At least one uppercase letter  
- ✅ At least one special character


## ⚠️  Limitations

### File Signature

Files encrypted with Enclave are identifiable by looking at the file signature that is used by the app to verify the content of a file. Such signatures are also known as magic numbers or magic bytes. These bytes are authenticated and cannot be changed.

### Safari and Mobile Browsers

Safari and Mobile browsers are limited to a single file with maximum size of 1GB due to some issues related to service-workers. In addition, this limitation also applies when the app fails to register the service-worker (e.g Firefox Private Browsing).

- **Password Recovery**: If you forget your password, your files cannot be recovered. There is no "forgot password" option by design.
- **Browser Compatibility**: Requires a modern browser support (Chrome 37+, Firefox 34+, ~~Safari 7+~~, Edge 12+) **[We strongly advise against using Safari or any WebKit browser](https://github.com/hopeugetherpes/enclave/blob/main/public/safari_libsodium_crypto.md)**
- **Memory Usage**: Very large files may consume significant browser memory during processing
- **File Associations**: Encrypted files lose their original file associations and must be manually renamed after decryption

## 🛡️ Security Architecture

Enclave implements industry-standard cryptographic practices:

- **[XChaCha20-Poly1305](https://libsodium.gitbook.io/doc/secret-key_cryptography/aead/chacha20-poly1305/xchacha20-poly1305_construction)** - authenticated symmetric encryption using Libsodium secret streams
- **[Argon2id](https://github.com/p-h-c/phc-winner-argon2)** - for password-based key derivation: To this day the best password hashing algorithm
- **[X25519](https://cr.yp.to/ecdh.html)** - for key exchange
- **Implementation**: [Libsodium library](https://github.com/jedisct1/libsodium) API


## Development

### Prerequisites
- Node.js 24
- pnpm 10

### Installation
```bash
git clone https://github.com/hopeugetherpes/enclave.git
cd enclave
pnpm install --frozen-lockfile
pnpm dev
```

### Building
```bash
pnpm build
```

The production build is a static export written to `out/`. It also creates a portable offline edition:

- `out/enclave.html` — the complete application in one self-contained file
- `out/enclave.html.sha256` — a SHA-256 checksum for verifying that file

The offline edition embeds its required CSS, JavaScript, Libsodium, and OpenPGP code. Its content-security policy blocks network connections, so it can be opened directly from disk without an internet connection. The **Save offline .html** link in the website footer downloads this edition.

To regenerate only the portable file after `pnpm build:web`, run:

```bash
pnpm build:offline
```

## ▲ Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhopeugetherpes%2Fenclave)

Enclave is configured for a zero-configuration deployment from GitHub:

1. In Vercel, choose **Add New → Project**.
2. Import `https://github.com/hopeugetherpes/enclave`.
3. Click **Deploy** without changing the detected settings.

The repository declares the Next.js framework, build command, static `out/` directory, and Node.js version. Vercel automatically detects pnpm from `pnpm-lock.yaml`. No environment variables, server, database, or external service are required.

## 📄 License

**CC0 1.0 Universal (CC0 1.0) Public Domain Dedication**

This work is dedicated to the public domain. You can copy, modify, distribute and perform the work, even for commercial purposes, all without asking permission.

See [LICENSE](https://github.com/hopeugetherpes/enclave/blob/main/LICENSE) for details.

## 🔗 Links

- **Web-app**: [🔒 Enclave](https://securelock.rxutn.chatgpt.site)
- **Repository**: [GitHub](https://github.com/hopeugetherpes/enclave)
- **License**: [CC0 Public Domain](https://github.com/hopeugetherpes/enclave/blob/main/LICENSE)

---
