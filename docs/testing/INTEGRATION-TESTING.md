# Integration Testing with Real Gemini API

## Overview

This project includes **two types of tests**:

1. **Unit Tests** (default) - Fast, mocked, zero API calls ✅
2. **Integration Tests** (optional) - Real API calls, validates actual behavior ⚠️

## Why Integration Tests?

Integration tests with real Gemini API calls are useful for:

✅ **Verifying your API key works**
✅ **Testing actual Gemini responses**
✅ **Validating prompt engineering**
✅ **Checking real-world performance**
✅ **Confirming categorization accuracy**

## ⚠️ Important Warnings

Integration tests:
- **Cost money** - Use your Gemini API quota
- **Require internet** - Must connect to googleapis.com
- **Are slower** - Network latency + API processing time
- **Can fail** - API issues, rate limits, network problems

**Only run these when you need to validate real API behavior!**

---

## Quick Start

### Step 1: Get Your API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key (starts with `AIza...`)

### Step 2: Set Environment Variable

**macOS/Linux:**
```bash
export GEMINI_API_KEY="AIzaSy..."
```

**Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="AIzaSy..."
```

**Or create a `.env` file:**
```bash
# .env
GEMINI_API_KEY=AIzaSy...
```

### Step 3: Enable Integration Tests

Edit `tests-local/api-service.integration.test.js`:

Change this:
```javascript
describe.skip('Gemini API - Real Integration Tests', () => {
```

To this:
```javascript
describe('Gemini API - Real Integration Tests', () => {
```

### Step 4: Run Integration Tests

```bash
# Run ONLY integration tests
npm test -- tests-local/api-service.integration.test.js

# Run with verbose output
npm test -- tests-local/api-service.integration.test.js --verbose
```

---

## What Tests Are Included

### 1. Real Categorization Tests (3 tests)

Tests actual email categorization with Gemini:

```javascript
✅ should successfully categorize a work email
✅ should successfully categorize a shopping email
✅ should successfully categorize a finance email
```

**Example output:**
```
✅ Work email result: work
✅ Shopping email result: shopping
✅ Finance email result: finance
```

### 2. Rate Limiting Test (1 test)

Validates rate limiting works with real API:

```javascript
✅ should respect rate limiting
```

Makes 15 calls rapidly and verifies rate limit kicks in.

### 3. Error Handling Tests (3 tests)

Tests edge cases with real API:

```javascript
✅ should handle invalid API responses gracefully
✅ should handle empty prompts
✅ should handle extremely long prompts
```

### 4. Statistics Test (1 test)

Verifies monitoring tracks real API calls:

```javascript
✅ should track API call statistics
```

---

## Expected Results

When you run integration tests, you should see:

```bash
 PASS  tests-local/api-service.integration.test.js
  Gemini API - Real Integration Tests
    Real API Calls
      ✓ should successfully categorize a work email (2547ms)
      ✓ should successfully categorize a shopping email (1832ms)
      ✓ should successfully categorize a finance email (1654ms)
      ✓ should handle invalid API responses gracefully (3421ms)
      ✓ should respect rate limiting (45232ms)
    API Statistics
      ✓ should track API call statistics (1923ms)
    Error Handling
      ✓ should handle empty prompts (5ms)
      ✓ should handle extremely long prompts (4231ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Time:        61.845 s
```

**Note:** Integration tests are MUCH slower (60+ seconds vs <1 second for unit tests)

---

## Troubleshooting

### "GEMINI_API_KEY not set"

**Problem:** Environment variable not found

**Solution:**
```bash
export GEMINI_API_KEY="your-key-here"
# Then run tests in same terminal
npm test -- tests-local/api-service.integration.test.js
```

### "API returned status 401"

**Problem:** Invalid API key

**Solutions:**
1. Verify API key is correct (starts with `AIza`)
2. Check API key is enabled in Google AI Studio
3. Ensure no extra spaces in environment variable

### "API returned status 429"

**Problem:** Rate limit exceeded

**Solutions:**
1. Wait 60 seconds and try again
2. Reduce number of tests
3. Check your API quota limits

### Tests time out

**Problem:** Network too slow or API unresponsive

**Solutions:**
1. Check internet connection
2. Increase timeout in test (change `10000` to `30000`)
3. Try again later

### "Error parsing Gemini category"

**Problem:** Unexpected API response format

**This is actually good!** It means:
1. Your API call succeeded
2. But the response format was unexpected
3. The error handling worked correctly (returned 'other')

---

## Cost Considerations

### Gemini API Pricing (as of 2024)

**Free Tier:**
- 15 requests per minute
- 1,500 requests per day
- 1 million requests per month

**Paid Tier:**
- Higher rate limits
- Pay per 1,000 characters

### Integration Test Costs

Running the full integration test suite:
- **8 tests** = ~8 API calls
- **Total cost:** FREE (well within free tier)
- **Time:** ~60 seconds

You can run integration tests **thousands of times per month** for free.

---

## Best Practices

### ✅ DO:

- Run integration tests before deploying to production
- Use integration tests to validate new prompts
- Run integration tests when debugging API issues
- Keep integration tests `.skip`ped by default
- Use environment variables for API keys

### ❌ DON'T:

- Commit API keys to git
- Run integration tests on every code change
- Run integration tests in CI/CD (unless you want to)
- Share API keys in test files
- Leave integration tests enabled by default

---

## Comparison: Unit vs Integration Tests

| Feature | Unit Tests | Integration Tests |
|---------|-----------|------------------|
| **Speed** | ⚡ <1 second | 🐌 ~60 seconds |
| **Cost** | 💰 FREE (no API) | 💰 FREE (uses quota) |
| **Internet** | ✅ Works offline | ❌ Requires connection |
| **API Key** | ✅ Not needed | ❌ Required |
| **Reliability** | ✅ 100% reliable | ⚠️ Can fail (network) |
| **Real Behavior** | ❌ Mocked | ✅ Actual API |
| **Use Case** | TDD, Development | Validation, Debugging |

---

## Running Both Test Types

### Option 1: Run All Unit Tests (Default)

```bash
npm test
```

**Result:** 74 tests, <1 second, zero API calls ✅

### Option 2: Run Only Integration Tests

```bash
npm test -- tests-local/api-service.integration.test.js
```

**Result:** 8 tests, ~60 seconds, 8+ API calls ⚠️

### Option 3: Run Everything (Not Recommended)

First enable integration tests, then:

```bash
npm test
```

**Result:** 82 tests, ~60 seconds, 8+ API calls

---

## Example: Validating a New Prompt

Let's say you want to test a new categorization prompt:

### 1. Add a Test

Edit `tests-local/api-service.integration.test.js`:

```javascript
it('should categorize newsletter emails', async () => {
  const prompt = `Categorize this email:
    Subject: Weekly Newsletter - Tech Updates
    From: newsletter@techsite.com
    Body: Here are this week's top tech stories...

    Return JSON: {"category": "newsletters"}`;

  const result = callGemini(prompt);

  expect(result).toBe('newsletters');
  console.log('✅ Newsletter result:', result);
}, 10000);
```

### 2. Enable Integration Tests

Change `describe.skip` to `describe`

### 3. Set API Key

```bash
export GEMINI_API_KEY="your-key"
```

### 4. Run the Test

```bash
npm test -- tests-local/api-service.integration.test.js
```

### 5. Check Result

If the test passes, your prompt works! If not, adjust the prompt and try again.

---

## Security

### ⚠️ NEVER Commit API Keys

**Bad:**
```javascript
setApiKey('AIzaSyABC123...'); // DON'T DO THIS!
```

**Good:**
```javascript
const apiKey = process.env.GEMINI_API_KEY;
setApiKey(apiKey);
```

### Add to `.gitignore`

```
# API Keys
.env
.env.local
*.key
```

### Revoke Compromised Keys

If you accidentally commit an API key:
1. Immediately revoke it in Google AI Studio
2. Generate a new key
3. Update your environment variable
4. Remove the key from git history

---

## Summary

Integration tests with real Gemini API are:

✅ **Available** - File created and ready to use
✅ **Optional** - Disabled by default (`.skip`)
✅ **Safe** - Uses environment variables for API keys
✅ **Free** - Well within free tier limits
✅ **Useful** - Validates real API behavior

**When to use:**
- Before production deployment
- When debugging API issues
- When testing new prompts
- When validating categorization accuracy

**When NOT to use:**
- During regular development (use unit tests)
- On every code change (too slow)
- If you're worried about quota (stick to unit tests)

---

## Need Help?

Common issues:

1. **No API key** → Get one from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Tests skipped** → Change `describe.skip` to `describe`
3. **401 errors** → Check API key is valid
4. **429 errors** → Wait 60 seconds, try again
5. **Timeout** → Increase timeout or check internet

For more help, see the [test documentation](../../tests-local/README.md).
