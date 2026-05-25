# 🚀 Master Test Runner

## Quick Start

Run **everything** with one command:

```bash
npm run test:all
```

Or directly:

```bash
./run-all-tests.sh
```

---

## What It Does

The master test runner executes:

1. ✅ **Unit Tests** - All 74 mocked tests (<1 second)
2. 📊 **Coverage Report** - Shows code coverage metrics
3. 🔍 **Linting** - ESLint code quality checks
4. 🌐 **Integration Test Check** - Reports if enabled/disabled
5. 📈 **Statistics** - File counts, lines of code
6. 📋 **Summary** - Complete test results overview

---

## Sample Output

```
🚀 Gmail Automation - Master Test Suite
========================================

📦 Running Unit Tests (Fast, Mocked)
-------------------------------------------
✅ Unit tests passed!

📊 Generating Test Coverage Report
-------------------------------------------
✅ Coverage report generated!

🔍 Running ESLint
-------------------------------------------
⚠️  Linting warnings found (non-critical)

🌐 Checking Integration Tests
-------------------------------------------
⏭️  Integration tests are DISABLED (skipped)

📈 Project Statistics
-------------------------------------------
JavaScript Files: 34
Test Files: 3
Total Lines of Code: 15911 total

========================================
📋 TEST SUMMARY
========================================

Unit Tests: 74 passed, 74 total
Coverage: 55% average

✅ ALL TESTS PASSED!

🎉 Your code is ready for deployment!
```

---

## Individual Test Commands

```bash
# Unit tests only (fast)
npm run test:unit

# Integration tests only (real API)
npm run test:integration

# Coverage report
npm run test:coverage

# Watch mode (re-run on changes)
npm run test:watch

# Lint code
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

---

## Exit Codes

- `0` - All tests passed ✅
- `1` - Some tests failed ❌

Use in CI/CD:

```bash
npm run test:all
if [ $? -eq 0 ]; then
  echo "Deploy!"
else
  echo "Fix tests first!"
fi
```

---

## Continuous Integration

Add to your CI/CD pipeline:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:all
```

---

## Troubleshooting

### "Permission denied"

```bash
chmod +x run-all-tests.sh
```

### "ESLint couldn't find configuration"

Create `.eslintrc.json`:

```json
{
  "env": {
    "browser": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 12
  },
  "rules": {}
}
```

### Coverage shows 0%

This is expected - coverage only tracks files that are actually imported and executed in tests. The test files themselves run in an isolated environment.

---

## What's Next?

After tests pass, you're ready to:

1. ✅ Deploy to Google Apps Script
2. ✅ Run integration tests (optional)
3. ✅ Create a pull request
4. ✅ Ship to production

Happy testing! 🎉
