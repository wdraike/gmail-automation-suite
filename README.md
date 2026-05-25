# Gmail Automation Suite

A comprehensive Google Apps Script solution for automating Gmail organization, email retention management, and job alert tracking.

## Features

### 🏷️ Email Categorization
- **AI-Powered Classification** - Uses Google's Gemini API to automatically categorize emails
- **Smart Caching** - Remembers sender patterns to reduce API calls
- **Custom Categories** - Define your own categories and rules
- **Label Management** - Automatically applies Gmail labels based on categories

### 🗑️ Email Retention Management
- **Automated Cleanup** - Delete or archive old emails based on configurable rules
- **Per-Label Rules** - Different retention policies for different labels
- **Flexible Actions** - Choose between delete, archive, or custom actions
- **Safe Execution** - Preview mode and dry-run capabilities

### 💼 Job Alert Processing
- **Automatic Extraction** - Parse job listings from recruitment emails
- **Spreadsheet Integration** - Track jobs in Google Sheets
- **Duplicate Detection** - Prevent duplicate job entries
- **CSV Export** - Export job data for external processing

### 📊 Web Dashboard
- **Visual Interface** - Manage all features from a web UI
- **Category Management** - Create, edit, and delete categories
- **Statistics** - View processing stats and insights
- **Configuration** - Set up API keys and preferences

## Project Structure

```
gmail-automation/
├── src/                            # Apps Script source (auto-generated)
│   ├── core/                       # Core services
│   ├── features/                   # Feature modules
│   ├── job-finder/                # Job alert processing
│   ├── ui/                        # User interface
│   └── utils/                     # Utilities
│
├── src-modules/                    # Source of truth (Node.js modules)
│   └── (same structure as src/)   # Develop here, test here
│
├── tests/                         # Apps Script tests
│   ├── test-framework.js          # Custom test framework
│   └── *.test.js                  # In-script test suites
│
├── tests-local/                   # Jest tests (282 tests)
│   ├── setup.js                   # Mock Google services
│   └── *.test.js                  # Local unit tests
│
├── docs/                          # Documentation
│   ├── testing/                   # Testing guides
│   ├── coverage/                  # Coverage reports (25.56%)
│   └── guides/                    # User guides
│
├── scripts/                       # Build/automation scripts
│   ├── convert-to-modules.js      # Apps Script → Modules
│   ├── build-for-apps-script.js   # Modules → Apps Script
│   └── run-all-tests.sh           # Test runner
│   ├── pre-push.js                # Pre-deployment validation
│   ├── setup-script.js            # Setup utilities
│   ├── run-all-tests.sh           # Master test runner
│   └── appsscript.json            # Apps Script config
│
└── package.json                   # NPM configuration
```

## Setup

### Prerequisites

- Google account
- Google Apps Script access
- Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))
- Node.js and npm (for clasp deployment)

### Installation

1. **Clone/Copy the Project**
   ```bash
   git clone <repository-url>
   cd email-tools
   ```

2. **Install clasp (Google Apps Script CLI)**
   ```bash
   npm install -g @google/clasp
   clasp login
   ```

3. **Create a New Apps Script Project**
   ```bash
   clasp create --type standalone --title "Gmail Automation"
   ```

4. **Build Apps Script Code**
   ```bash
   # Convert modules to Apps Script format
   npm run build

   # This runs:
   # 1. npm run modules (src → src-modules with module.exports)
   # 2. Strips module.exports for clean Apps Script
   ```

5. **Push the Code**
   ```bash
   # IMPORTANT: Run tests first!
   npm test

   # Then push to Apps Script
   clasp push
   ```

5. **Configure API Key**
   - Open the Apps Script editor
   - Run the `setApiKey()` function with your Gemini API key
   ```javascript
   setApiKey('YOUR_GEMINI_API_KEY_HERE')
   ```

6. **Initialize the System**
   ```javascript
   // Run in Apps Script editor
   runInitialSetup()
   ```

7. **Deploy Web App** (Optional)
   - In Apps Script editor: Deploy > New deployment
   - Type: Web app
   - Execute as: Me
   - Who has access: Only myself (or as needed)
   - Click "Deploy"

### First-Time Configuration

After deployment, configure the system:

1. **Set Up Categories**
   ```javascript
   initializeCategorizerCache()
   ```

2. **Create Retention Rules** (Optional)
   ```javascript
   // Example: Delete emails in "Newsletters" older than 30 days
   createRetentionRule({
     labelName: 'Newsletters',
     retentionDays: 30,
     action: 'delete',
     enabled: true
   })
   ```

3. **Set Up Job Finder** (Optional)
   ```javascript
   // Create a Google Sheet for job tracking
   setSpreadsheetId('YOUR_SPREADSHEET_ID')
   ```

## Development Workflow

### Making Changes

1. **Edit code in `src-modules/`** (not `src/`)
   ```bash
   vim src-modules/core/my-feature.js
   ```

2. **Write tests**
   ```bash
   vim tests-local/my-feature.test.js
   ```

3. **Run tests locally**
   ```bash
   npm test
   npm run test:coverage  # Check coverage
   ```

4. **Build for Apps Script**
   ```bash
   npm run build  # Creates src/ from src-modules/
   ```

5. **Deploy**
   ```bash
   clasp push
   ```

### Commands

```bash
# Development
npm run modules          # Convert src → src-modules (add module.exports)
npm run build           # Convert src-modules → src (remove module.exports)

# Testing
npm test                # Run all Jest tests
npm run test:coverage   # Run with coverage report
npm run test:watch      # Watch mode
npm run test:all        # Run both Jest + Apps Script tests

# Deployment
clasp push              # Push to Apps Script
clasp open              # Open in browser
```

## Usage

### Email Categorization

#### Manual Run
```javascript
categorizeEmails()
```

#### Automated Schedule
```javascript
// Set up hourly categorization
createCategorizationTrigger()
```

#### From Dashboard
- Open the web app URL
- Navigate to "Categories" tab
- Click "Run Categorization"

### Retention Management

#### Create a Rule
```javascript
createRetentionRule({
  labelName: 'Promotions',
  retentionDays: 90,
  action: 'delete',  // or 'archive'
  enabled: true
})
```

#### Run Rules Manually
```javascript
runAllRetentionRules()
```

#### Schedule Automatic Execution
```javascript
createRetentionTrigger()  // Runs daily
```

### Job Alert Processing

#### Process New Job Emails
```javascript
processNewJobAlerts()
```

#### Export Jobs to CSV
```javascript
exportJobListingsToCsv()
```

## Testing

### Local Testing (Jest) ✅ 282 Tests

```bash
# Run all tests
npm test

# With coverage (25.56% overall, 48% core modules)
npm run test:coverage

# Watch mode
npm run test:watch

# Specific file
npm test -- tests-local/api-service.test.js
```

**Coverage Status:**
- ✅ Core modules: 48.34%
- ✅ Feature modules: 45.63%
- ⚠️ Job finder: 0% (not yet tested)
- ⚠️ UI layer: 0% (not yet tested)

See [docs/coverage/](docs/coverage/) for detailed coverage reports.

### Apps Script Testing

```javascript
// Run all Apps Script tests
runAllTests()

// Pre-deployment validation
validateBeforeDeploy()

// Module-specific
runTestsForModule('categorization')
runTestsForModule('retention')
runTestsForModule('cache')
runTestsForModule('api')
```

See [docs/testing/](docs/testing/) for testing guides.

## Configuration

### Script Properties

All configuration is stored in Script Properties:

| Key | Description | Example |
|-----|-------------|---------|
| `API_KEY` | Gemini API key | `AIza...` |
| `SPREADSHEET_ID` | Job tracker spreadsheet | `1AbC...` |
| `CACHE_FILE_ID` | Drive file for cache | `1XyZ...` |
| `ENABLE_DYNAMIC_CATEGORIES` | Enable AI categories | `true` |

### Config File

Edit `config.js` to modify:

```javascript
const EMAIL_SORTER_CONFIG = {
  CHECK_INTERVAL_MINUTES: 1,
  MAX_GEMINI_CALLS_PER_MINUTE: 15,
  ENABLE_DYNAMIC_CATEGORIES: true,
  DEFAULT_CATEGORIES: {
    // Your categories here
  }
};
```

## API Reference

### Core Functions

#### Email Categorization
- `categorizeEmails()` - Process unread emails
- `getAllCategories()` - Get all defined categories
- `addCategory(key, displayName, label)` - Create new category
- `updateCategoryForEmail(email, category)` - Assign email to category

#### Retention Management
- `createRetentionRule(rule)` - Create new retention rule
- `runRetentionRule(ruleId)` - Execute specific rule
- `runAllRetentionRules()` - Execute all enabled rules
- `getRetentionRules()` - List all rules

#### Job Finder
- `processNewJobAlerts()` - Process new job emails
- `addJobToSpreadsheet(job)` - Add job to tracking sheet
- `exportJobListingsToCsv()` - Export jobs as CSV

### Utility Functions

- `resetCache(keepBackup)` - Reset categorization cache
- `getDataLayerStats()` - Get cache statistics
- `exportCacheData()` - Export all cache data
- `importCacheData(data)` - Import cache data

## Troubleshooting

### Common Issues

#### "API Key Not Set" Error
```javascript
// Solution: Set your API key
setApiKey('YOUR_API_KEY')
```

#### "Rate Limit Exceeded"
```javascript
// Solution: Check rate limit status
getRemainingApiCalls()

// Or wait and retry
Utilities.sleep(60000)  // Wait 1 minute
```

#### "Cache Not Initialized"
```javascript
// Solution: Initialize the cache
initializeCategorizerCache()
```

#### Tests Failing
```javascript
// Run individual test suites to isolate issues
runTestsForModule('categorization')

// Check logs for specific errors
Logger.log(...)
```

### Debug Mode

Enable verbose logging:

```javascript
// In config.js
const DEBUG_MODE = true;
```

### Reset Everything

If you need to start fresh:

```javascript
// WARNING: This deletes all data!
resetCache(false)  // Don't keep backup
PropertiesService.getScriptProperties().deleteAllProperties()
```

## Performance

### Optimization Tips

1. **Rate Limiting**
   - Default: 15 API calls/minute
   - Adjust in `EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE`

2. **Caching**
   - Cache is automatically managed
   - Force refresh: `refreshCache()`

3. **Batch Processing**
   - Process emails in batches to avoid timeouts
   - Adjust batch size in code if needed

4. **Triggers**
   - Don't run categorization too frequently
   - Recommended: Every 15-30 minutes

## Security

### Best Practices

- ✓ Store API keys in Script Properties (encrypted)
- ✓ Use OAuth for user authentication
- ✓ Limit web app access to "Only myself"
- ✓ Review Apps Script permissions before authorizing
- ✓ Don't share your deployed web app URL publicly

### Data Privacy

- Email content is sent to Gemini API for categorization
- Job data is stored in your Google Sheets
- No data is sent to external servers (except Gemini API)
- All data stays in your Google account

## Contributing

### Code Style

- Use JSDoc comments for functions
- Follow existing naming conventions
- Add tests for new features
- Run `validateBeforeDeploy()` before pushing

### Testing

- Write tests first (TDD)
- Maintain >60% code coverage
- All tests must pass before merging

### Pull Requests

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass
5. Submit pull request with description

## Changelog

### v1.0.0 (Current)
- Initial release
- Email categorization with Gemini AI
- Email retention management
- Job alert processing
- Web dashboard
- Gmail add-on integration
- Comprehensive test suite

## License

MIT License - see LICENSE file

## Support

For issues, questions, or contributions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review test documentation

## Acknowledgments

- Google Gemini API for AI categorization
- Google Apps Script platform
- All contributors

---

**Built with ❤️ using Google Apps Script**
