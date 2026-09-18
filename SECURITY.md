# Security Policy

## Supported version

Security fixes are applied to the latest version on the `main` branch and to the current deployment at <https://enclave.anatole.co>.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Send the report privately using the contact information published at <https://anatole.co>. Include:

- a clear description of the issue and its impact;
- reproducible steps or a minimal proof of concept;
- the affected browser, operating system, and Enclave revision;
- any suggested remediation, if available.

Do not access, modify, retain, or disclose another person's data while researching or demonstrating an issue. Use only files, keys, accounts, and systems that you own or are explicitly authorized to test.

There is currently no paid vulnerability-reward program. Good-faith reports will be handled responsibly, and public disclosure should be coordinated with the maintainer after a fix is available.

## Threat model and privacy limitations

The security boundary, metadata exposure, host visibility, offline verification procedure, PGP limitations, and memory
handling caveats are documented in [PRIVACY.md](PRIVACY.md). These limitations are part of the security model, not
promises that the browser platform can eliminate.

The latest repository review, fixed findings, verification scope, and residual risks are recorded in
[SECURITY_AUDIT.md](SECURITY_AUDIT.md).
