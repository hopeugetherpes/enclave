<h1 align="center">🔒 Enclave</h1>

# **Secure File Encryption**

Enclave is a privacy-focused lightweight encryption web-app that allows you to encrypt and decrypt any file type locally in your browser without any data ever leaving your device. Built with security and privacy as core principles.

## Purpose

Enclave provides authenticated XChaCha20-Poly1305 password encryption and OpenPGP public-key encryption for any file type. Files, passwords, and keys remain inside the browser throughout encryption and decryption.

**Key Features:**
- 🔐 **XChaCha20-Poly1305 Encryption** - Implemented with [Libsodium](https://github.com/jedisct1/libsodium)
- 📁 **Universal File Support** - Encrypt any file type (documents, images, videos, etc.)
- 📦 **Chunked Processing** - No application-imposed limit; practical limits depend on the browser, memory, and encryption method
- 🌐 **Local Processing** - No file, password, or key upload and no runtime API connection
- 🎯 **No Application Data Collection** - No analytics, account, database, or telemetry in the application
- 📱 **Cross-Platform** - Works on any device with a modern browser
- 🆓 **[Open Source](https://github.com/hopeugetherpes/enclave)** - Fully auditable code under [CC0](https://github.com/hopeugetherpes/enclave/blob/main/LICENSE) license

## 📖 Usage

### Getting Started
1. Visit the [🔒 Enclave](https://enclave.anatole.co) web application
2. Choose your encryption method: [Password](https://github.com/hopeugetherpes/enclave/blob/main/README.md#password-requirements) or PGP Key
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

Password-encrypted files use a recognizable Enclave magic number so the app can select the current format. Changing the marker makes the file invalid, but the marker itself is not secret. OpenPGP output is identifiable as OpenPGP ciphertext.

### Safari and Mobile Browsers

Safari, browsers on iPhone, and memory-constrained mobile browsers may fail on large files because of browser and WebAssembly memory limits. There is no reliable universal 1 GB threshold. Enclave does not use a service worker.

- **Password Recovery**: If you forget your password, your files cannot be recovered. There is no "forgot password" option by design.
- **Browser Compatibility**: Use a currently supported desktop browser. **[Safari and WebKit have additional limitations](https://github.com/hopeugetherpes/enclave/blob/main/public/safari_libsodium_crypto.md).**
- **Memory Usage**: Password mode processes file content in chunks. OpenPGP mode currently loads the complete file and may require several times its size in free memory.
- **File Safety**: Authenticated decryption does not scan recovered content for malware and does not prove who sent it.

## 🛡️ Security Architecture

Enclave implements industry-standard cryptographic practices:

- **[XChaCha20-Poly1305](https://libsodium.gitbook.io/doc/secret-key_cryptography/aead/chacha20-poly1305/xchacha20-poly1305_construction)** - authenticated symmetric encryption using Libsodium secret streams
- **[Argon2id](https://github.com/p-h-c/phc-winner-argon2)** - password-based key derivation using Libsodium's moderate limits for newly encrypted files
- **OpenPGP.js** - recipient-key encryption and decryption; the exact public-key algorithm comes from the supplied PGP key
- **Implementation**: [Libsodium](https://github.com/jedisct1/libsodium) for password mode and OpenPGP.js for PGP mode

Read [PRIVACY.md](PRIVACY.md) for the complete threat model, host metadata, ciphertext leakage, browser-memory caveats, and offline verification guidance. The dated findings and remediations from the repository review are recorded in [SECURITY_AUDIT.md](SECURITY_AUDIT.md).


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

The offline edition embeds its required CSS, JavaScript, Libsodium, and OpenPGP code. Its content-security policy blocks network connections, so it can be opened directly from disk without an internet connection. The hosted HTML receives a separate hash-based policy, while Vercel adds defense-in-depth security headers. The **Save offline .html** link in the website footer downloads the portable edition.

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

---
