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

### [REORGANIZATION-SUMMARY.md](REORGANIZATION-SUMMARY.md)
**File structure reorganization changelog**
- What changed and why
- Before/after comparison
- File move summary
- Zero breaking changes

---

## 🚀 Getting Started

### [DEPLOYMENT.md](DEPLOYMENT.md) ⭐
**How to deploy and configure**
- Initial setup with clasp
- Configuration steps
- Deployment commands
- Troubleshooting tips

---

## 🔧 Improvements & Best Practices

### [IMPROVEMENT-RECOMMENDATIONS.md](IMPROVEMENT-RECOMMENDATIONS.md) ⭐
**Comprehensive improvement roadmap**
- Performance optimizations (67% faster execution)
- Memory reduction strategies (33% less memory)
- Code organization improvements
- Testing recommendations
- Prioritized implementation plan

---

## 🧪 Testing

### [TESTING-SUMMARY.md](TESTING-SUMMARY.md)
**Testing approach and coverage**
- Current test coverage: 25.59%
- Hybrid module system explanation
- 282 passing tests
- How to run tests locally

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
| Email Categorization | `src/features/email-sorter/` | `categorizeEmail()`, `sortEmails()` |
| Job Finder | `src/features/job-finder/` | `processJobEmailsMain()`, `testCompleteJobWorkflow()` |
| Email Retention | `src/features/email-retention-manager.js` | Retention policies |
| Label Management | `src/features/enhanced-label-manager.js` | Label operations |

### Core Services

| Service | File | Purpose |
|---------|------|---------|
| Gemini API | `src/core/api-service.js` | All Gemini API calls, Drive logging |
| Gmail | `src/core/gmail-service.js` | Gmail operations wrapper |
| Caching | `src/core/cache-service.js` | Cache management |
| Config | `src/core/config.js` | All configuration constants |

---

## 🔍 Quick Reference

| I need to... | See |
|--------------|-----|
| Deploy the project | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Find a specific file | [FILE-STRUCTURE.md](FILE-STRUCTURE.md) |
| Improve performance | [IMPROVEMENT-RECOMMENDATIONS.md](IMPROVEMENT-RECOMMENDATIONS.md) |
| Debug job extraction | [GEMINI-DEBUG-LOGGING.md](GEMINI-DEBUG-LOGGING.md) |
| Run tests | [TESTING-SUMMARY.md](TESTING-SUMMARY.md) |
| See recent changes | [REORGANIZATION-SUMMARY.md](REORGANIZATION-SUMMARY.md) |

---

## 📊 Project Overview

```
Gmail Automation Suite
├── 12,129 lines of code
├── 19 JavaScript files
├── 282 passing tests
├── 25.59% test coverage
└── 4 main features
```

### File Organization
```
src/
├── core/              # Shared services (4 files)
├── features/          # Main features
│   ├── email-sorter/  # Email categorization (2 files)
│   └── job-finder/    # Job extraction (5 files)
├── ui/                # User interfaces (3 files)
├── utils/             # Utilities (1 file)
└── dev/               # Tests (3 files, not deployed)
```

---

## 🎯 Recommended Reading Order

**For New Developers:**
1. Start: [FILE-STRUCTURE.md](FILE-STRUCTURE.md) - Understand the codebase layout
2. Then: [DEPLOYMENT.md](DEPLOYMENT.md) - Set up your environment
3. Finally: [IMPROVEMENT-RECOMMENDATIONS.md](IMPROVEMENT-RECOMMENDATIONS.md) - See what's next

**For Debugging:**
1. Check: [GEMINI-DEBUG-LOGGING.md](GEMINI-DEBUG-LOGGING.md) - View API interactions
2. Review: Drive folder "Gemini API Debug Logs"
3. Test: Run `testCompleteJobWorkflow()` in Apps Script

**For Contributing:**
1. Review: [TESTING-SUMMARY.md](TESTING-SUMMARY.md) - Testing approach
2. Check: [IMPROVEMENT-RECOMMENDATIONS.md](IMPROVEMENT-RECOMMENDATIONS.md) - Priority tasks
3. Follow: File structure guidelines in [FILE-STRUCTURE.md](FILE-STRUCTURE.md)

---

**Last Updated:** 2025-10-04
