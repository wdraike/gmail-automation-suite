# Gmail Automation - Documentation

## 📚 Essential Documentation

All current, useful documentation for the project.

---

## 📁 Project Structure

### [FILE-STRUCTURE.md](FILE-STRUCTURE.md) ⭐
**Current file organization guide**
- Visual directory structure
- Feature-based organization
- File naming conventions
- Where to find each feature's code

### [ARCHITECTURE.md](../ARCHITECTURE.md) ⭐
**Hexagonal architecture model**
- Layers, ports, and adapters
- The SDK-touching ring (`src/core/services/`)
- How to add an adapter

---

## 🚀 Getting Started

### [DEPLOYMENT.md](DEPLOYMENT.md) ⭐
**How to deploy and configure**
- Initial setup with clasp
- Configuration steps
- Deployment commands
- Troubleshooting tips

---

## 🧪 Testing

**Current state:** 100% coverage gate enforced (statements/branches/functions/lines).
Run locally with `npx jest --coverage --runInBand`.

- [testing/TESTING-OVERVIEW.md](testing/TESTING-OVERVIEW.md) — testing approach
- [testing/TEST-RUNNER-README.md](testing/TEST-RUNNER-README.md) — how to run tests
- [testing/TESTABLE-CODE-PATTERNS.md](testing/TESTABLE-CODE-PATTERNS.md) — patterns
- [testing/NO-REAL-API-CALLS.md](testing/NO-REAL-API-CALLS.md) — mocking policy

---

## 🤖 Debugging

### [GEMINI-DEBUG-LOGGING.md](GEMINI-DEBUG-LOGGING.md)
**Debug Gemini API interactions**
- How Drive logging works
- View prompts and responses
- Troubleshoot extraction issues
- Check "Gemini API Debug Logs" folder

---

## 🗂️ Quick Navigation

### By Feature

| Feature | Code Location | Key Functions |
|---------|---------------|---------------|
| Email Categorization | `src/features/email-sorter/` | `categorizeEmails()` |
| Job Finder | `src/features/job-finder/` | `processJobEmailsMain()`, `testCompleteJobWorkflow()` |
| Email Retention | `src/features/email-retention-manager.js` | Retention policies |
| Label Management | `src/features/enhanced-label-manager.js` | Label operations |

### Core Services

| Service | File | Purpose |
|---------|------|---------|
| Gemini API | `src/core/api-service.js` | Gemini infrastructure (`callGeminiApi`), wrapped by `GeminiAdapter` |
| Adapters (ports) | `src/core/services/` | The SDK-touching ring: Gmail/Drive/Spreadsheet/Properties/Utilities/Http/Cache/Gemini |
| Caching | `src/core/cache-service.js` | `UnifiedCacheService` cache management |
| Config | `src/core/config.js` | All configuration constants |

---

## 🔍 Quick Reference

| I need to... | See |
|--------------|-----|
| Deploy the project | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Find a specific file | [FILE-STRUCTURE.md](FILE-STRUCTURE.md) |
| Understand the architecture | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| Debug job extraction | [GEMINI-DEBUG-LOGGING.md](GEMINI-DEBUG-LOGGING.md) |
| Run tests | [testing/TEST-RUNNER-README.md](testing/TEST-RUNNER-README.md) |
| Review the a11y record | [UX-REVIEW.md](UX-REVIEW.md) |
| See historical/archived docs | [archive/](archive/) |

---

## 📊 Project Overview

```
Gmail Automation Suite
├── Hexagonal architecture (ports + adapters)
├── 100% test coverage gate (statements/branches/functions/lines)
├── 1218+ Jest tests
└── 4 main features
```

### File Organization
```
src/
├── core/              # Shared services + the adapter ring
│   └── services/      # Ports/adapters (the only SDK-touching layer)
├── features/          # Main features
│   ├── email-sorter/  # Email categorization
│   └── job-finder/    # Job extraction
├── ui/                # User interfaces
└── utils/             # Utilities
```

---

## 🎯 Recommended Reading Order

**For New Developers:**
1. Start: [FILE-STRUCTURE.md](FILE-STRUCTURE.md) - Understand the codebase layout
2. Then: [ARCHITECTURE.md](../ARCHITECTURE.md) - Understand the hexagonal model
3. Finally: [DEPLOYMENT.md](DEPLOYMENT.md) - Set up your environment

**For Debugging:**
1. Check: [GEMINI-DEBUG-LOGGING.md](GEMINI-DEBUG-LOGGING.md) - View API interactions
2. Review: Drive folder "Gemini API Debug Logs"
3. Test: Run `testCompleteJobWorkflow()` in Apps Script

**For Contributing:**
1. Review: [testing/TESTING-OVERVIEW.md](testing/TESTING-OVERVIEW.md) - Testing approach (100% gate)
2. Check: [ARCHITECTURE.md](../ARCHITECTURE.md) - Ports/adapters invariant
3. Follow: File structure guidelines in [FILE-STRUCTURE.md](FILE-STRUCTURE.md)

---

**Last Updated:** 2026-06-07
