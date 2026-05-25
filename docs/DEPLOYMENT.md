# Deployment Guide

## Prerequisites

1. Install clasp globally:
   ```bash
   npm install -g @google/clasp
   ```

2. Login to Google:
   ```bash
   clasp login
   ```

## Deployment Process

### Deploy to Google Apps Script

```bash
npm run deploy
```

This pushes all files from `src/` to Google Apps Script.

### Watch Mode (Development)

```bash
npm run deploy:watch
```

Automatically deploys when files change.

### Other Useful Commands

```bash
# Open the Apps Script project in browser
npm run open

# Pull latest code from Apps Script
npm run pull

# View execution logs
npm run logs
```

## What Gets Deployed

The `.clasp.json` configuration deploys from `src/` directory:

**Included:**
- ✅ `src/core/*.js` - Core services
- ✅ `src/features/*.js` - Email features
- ✅ `src/job-finder/*.js` - Job tracking
- ✅ `src/ui/*.js` - UI components
- ✅ `src/utils/*.js` - Utilities
- ✅ `src/appsscript.json` - Manifest file

**Excluded (via `.claspignore`):**
- ❌ `tests-local/` - Test files
- ❌ `scripts/` - Build tools
- ❌ `node_modules/` - Dependencies
- ❌ Config files (package.json, jest.config.js, etc.)

## File Push Order

Core dependencies are pushed first to prevent reference errors:
1. `core/config.js`
2. `core/cache-service.js`
3. `core/api-service.js`
4. `core/gmail-service.js`
5. All other files

## Development Workflow

1. **Edit code** in `src/` directory
2. **Run tests**: `npm test`
3. **Check linting**: `npm run lint`
4. **Deploy**: `npm run deploy`

## How It Works

All files in `src/` use **conditional exports** that work in both environments:

```javascript
// Works in Google Apps Script (ignores module.exports)
function myFunction() {
  // ...
}

// Works in Jest for testing (uses module.exports)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { myFunction };
}
```

This means:
- ✅ Same files work in Google Apps Script AND Jest
- ✅ No duplicate directories
- ✅ No build step needed
- ✅ Test coverage works correctly

## Troubleshooting

### Error: "scriptId" not found
- Run `clasp login` first
- Check `.clasp.json` has valid scriptId

### Error: Syntax error in deployed code
- Check for uncommitted changes
- Verify conditional exports syntax

### Files not updating
- Check `.claspignore` isn't excluding your files
- Try `clasp push --force`

## Project Structure

```
.
├── src/            # Source code (works in both Apps Script and Node.js)
├── tests-local/    # Jest tests
└── scripts/        # Utility scripts
```

**Simple rule:** Edit `src/`, test with Jest, deploy with clasp!
