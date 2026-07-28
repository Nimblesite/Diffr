<!-- agent-pmo:a72c926 -->

# Security Policy

GitHub surfaces this file on the repository's **Security** tab and on the
"Report a vulnerability" page. See GitHub's docs:

- Add a security policy: https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy
- Configure private vulnerability reporting: https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Report privately through GitHub's **private vulnerability reporting**: go to the
repository's **Security** tab → **Report a vulnerability** (or
https://github.com/Nimblesite/Diffr/security/advisories/new). This opens a
private, structured advisory only the maintainers can see.

If you cannot use that channel, email **cftools@nimblesite.co**.

When reporting, please include:

- The type of issue (e.g. command injection through a git argument, path
  traversal via a `diffr://` URI, arbitrary file read, secret exposure in logs).
- The affected version(s), file(s), and any relevant configuration.
- Steps to reproduce, ideally a minimal proof of concept.
- The impact: what an attacker can achieve.

## What to Expect

- **Acknowledgement** within **3 business days**.
- An assessment and a remediation plan (or a reasoned decline) within **10 business days**.
- Coordinated disclosure: we will agree a disclosure timeline with you and credit
  you in the advisory unless you prefer to remain anonymous.

## Supported Versions

Diffr ships from the VS Code Marketplace. Security fixes land on the latest
released version only; upgrade to the newest release to receive them.

| Version         | Supported |
| --------------- | --------- |
| latest release  | ✅        |
| any earlier tag | ❌        |
