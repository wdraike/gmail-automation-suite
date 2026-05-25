# Integration Testing Quick Start

## TL;DR

**Want to test with real Gemini API calls?**

```bash
# 1. Get API key from https://makersuite.google.com/app/apikey
export GEMINI_API_KEY="your-key-here"

# 2. Edit api-service.integration.test.js
#    Change: describe.skip → describe

# 3. Run integration tests
npm run test:integration
```

---

## What's the Difference?

### Unit Tests (Default)
```bash
npm test                # Fast, mocked, FREE
```
- ⚡ <1 second
- 💰 Zero API calls
- ✅ 74 tests
- 🎯 For development

### Integration Tests (Optional)
```bash
npm run test:integration    # Slow, real API, uses quota
```
- 🐌 ~60 seconds
- 💰 8+ API calls
- ✅ 8 tests
- 🎯 For validation

---

## Quick Commands

```bash
# Run only unit tests (default)
npm run test:unit

# Run only integration tests
npm run test:integration

# Run all tests (unit + integration)
npm test

# Watch mode for unit tests
npm run test:watch
```

---

## Enable Integration Tests

**File:** `tests-local/api-service.integration.test.js`

**Change this line:**
```javascript
describe.skip('Gemini API - Real Integration Tests', () => {
```

**To this:**
```javascript
describe('Gemini API - Real Integration Tests', () => {
```

---

## Troubleshooting

### Tests are skipped
- Change `describe.skip` to `describe` in integration test file

### "GEMINI_API_KEY not set"
```bash
export GEMINI_API_KEY="your-key-here"
```

### 401 Unauthorized
- Check API key is valid
- Get new key from https://makersuite.google.com/app/apikey

### 429 Rate Limit
- Wait 60 seconds
- Try again

---

## Full Documentation

See [INTEGRATION-TESTING.md](../INTEGRATION-TESTING.md) for complete guide.
