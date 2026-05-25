# Email Retention Manager Dependency Tree

## Main Entry Points

### 1. `runAllRetentionRules()`
- **File**: email-retention-manager.js
- **Calls**:
  - `initializeRetentionManager()` - email-retention-manager.js
  - `processRetentionRule()` - email-retention-manager.js
  - `PropertiesService.getScriptProperties().setProperty()` - Google Apps Script built-in
  - `Utilities.sleep()` - Google Apps Script built-in
  - `Logger.log()` - Google Apps Script built-in

### 2. `setupRetentionTrigger(frequency, time)`
- **File**: email-retention-manager.js
- **Calls**:
  - `ScriptApp.getProjectTriggers()` - Google Apps Script built-in
  - `ScriptApp.deleteTrigger()` - Google Apps Script built-in
  - `ScriptApp.newTrigger()` - Google Apps Script built-in
    - `.timeBased()` - Google Apps Script built-in
    - `.atHour()` - Google Apps Script built-in
    - `.nearMinute()` - Google Apps Script built-in
    - `.everyDays()` - Google Apps Script built-in
    - `.onWeekDay()` - Google Apps Script built-in
    - `.create()` - Google Apps Script built-in
  - `Logger.log()` - Google Apps Script built-in

### 3. `processRetentionRule(rule)`
- **File**: email-retention-manager.js
- **Calls**:
  - `GmailApp.getUserLabelByName()` - Google Apps Script built-in
  - `formatDateForQuery()` - email-retention-manager.js
  - `GmailApp.search()` - Google Apps Script built-in
  - `saveRetentionRules()` - email-retention-manager.js
  - `thread.moveToTrash()` - Google Apps Script built-in
  - `thread.addLabel()` - Google Apps Script built-in
  - `thread.removeLabel()` - Google Apps Script built-in
  - `thread.getFirstMessageSubject()` - Google Apps Script built-in
  - `Logger.log()` - Google Apps Script built-in

## Supporting Functions

### 4. `initializeRetentionManager()`
- **File**: email-retention-manager.js
- **Calls**:
  - `PropertiesService.getScriptProperties().getProperty()` - Google Apps Script built-in
  - `JSON.parse()` - JavaScript built-in
  - `setupDefaultRetentionRules()` - email-retention-manager.js
  - `Logger.log()` - Google Apps Script built-in

### 5. `getRetentionRules()`
- **File**: email-retention-manager.js
- **Calls**:
  - `initializeRetentionManager()` - email-retention-manager.js
  - `Logger.log()` - Google Apps Script built-in

### 6. `saveRetentionRules()`
- **File**: email-retention-manager.js
- **Calls**:
  - `PropertiesService.getScriptProperties().setProperty()` - Google Apps Script built-in
  - `JSON.stringify()` - JavaScript built-in
  - `UnifiedCacheService.retentionRules.update()` - cache-service.js
  - `Logger.log()` - Google Apps Script built-in

### 7. `getRetentionRule(ruleId)`
- **File**: email-retention-manager.js
- **Calls**:
  - `getRetentionRules()` - email-retention-manager.js
  - `Logger.log()` - Google Apps Script built-in

### 8. `addRetentionRule(labelName, retentionDays, description, enabled, action, targetLabel)`
- **File**: email-retention-manager.js
- **Calls**:
  - `parseInt()` - JavaScript built-in
  - `GmailApp.getUserLabelByName()` - Google Apps Script built-in
  - `generateRuleId()` - email-retention-manager.js
  - `saveRetentionRules()` - email-retention-manager.js
  - `Logger.log()` - Google Apps Script built-in

### 9. `updateRetentionRule(labelName, retentionDays, action, targetLabel)`
- **File**: email-retention-manager.js
- **Calls**:
  - `initializeRetentionManager()` - email-retention-manager.js
  - `parseInt()` - JavaScript built-in
  - `saveRetentionRules()` - email-retention-manager.js
  - `addRetentionRule()` - email-retention-manager.js
  - `Logger.log()` - Google Apps Script built-in

### 10. `deleteRetentionRuleByLabel(labelName)`
- **File**: email-retention-manager.js
- **Calls**:
  - `initializeRetentionManager()` - email-retention-manager.js
  - `saveRetentionRules()` - email-retention-manager.js
  - `Logger.log()` - Google Apps Script built-in

### 11. `setRuleEnabled(ruleId, enabled)`
- **File**: email-retention-manager.js
- **Calls**:
  - `initializeRetentionManager()` - email-retention-manager.js
  - `saveRetentionRules()` - email-retention-manager.js
  - `Logger.log()` - Google Apps Script built-in

### 12. `runRetentionRule(ruleId)`
- **File**: email-retention-manager.js
- **Calls**:
  - `initializeRetentionManager()` - email-retention-manager.js
  - `processRetentionRule()` - email-retention-manager.js
  - `Logger.log()` - Google Apps Script built-in

### 13. `runAllRetentionRulesFromUI()`
- **File**: email-retention-manager.js
- **Calls**:
  - `runAllRetentionRules()` - email-retention-manager.js
  - `logRetentionActivity()` - **MISSING**
  - `Logger.log()` - Google Apps Script built-in

### 14. `runRetentionRuleFromUI(ruleId)`
- **File**: email-retention-manager.js
- **Calls**:
  - `runRetentionRule()` - email-retention-manager.js
  - `logRetentionActivity()` - **MISSING**
  - `Logger.log()` - Google Apps Script built-in

### 15. `getRetentionForLabels(labelNames)`
- **File**: email-retention-manager.js
- **Calls**:
  - `getRetentionRules()` - email-retention-manager.js
  - `Logger.log()` - Google Apps Script built-in

### 16. `setupDefaultRetentionRules()`
- **File**: email-retention-manager.js
- **Calls**:
  - `GmailApp.getUserLabelByName()` - Google Apps Script built-in
  - `addRetentionRule()` - email-retention-manager.js
  - `saveRetentionRules()` - email-retention-manager.js
  - `Logger.log()` - Google Apps Script built-in

### 17. `generateRuleId()`
- **File**: email-retention-manager.js
- **Calls**:
  - `Math.random()` - JavaScript built-in
  - `Date()` - JavaScript built-in

### 18. `formatDateForQuery(date)`
- **File**: email-retention-manager.js
- **Calls**:
  - `date.getFullYear()` - JavaScript built-in
  - `date.getMonth()` - JavaScript built-in
  - `date.getDate()` - JavaScript built-in
  - `String().padStart()` - JavaScript built-in

## External Dependencies

### 19. `UnifiedCacheService.retentionRules.update(rules)`
- **File**: cache-service.js
- **Calls**:
  - `UnifiedCacheCore.set()` - cache-service.js

### 20. `UnifiedCacheCore.set(key, data, duration, storageType)`
- **File**: cache-service.js
- **Calls**:
  - `JSON.stringify()` - JavaScript built-in
  - `CacheService.getScriptCache().put()` - Google Apps Script built-in
  - `PropertiesService.getScriptProperties().setProperty()` - Google Apps Script built-in
  - `_setDriveData()` - cache-service.js
  - `Logger.log()` - Google Apps Script built-in

### 21. `logRetentionActivity(message, ruleId)`
- **Status**: **MISSING**
- This function is called by UI wrapper functions but is not defined in the codebase

## Google Apps Script Built-in Functions Used

1. **PropertiesService**
   - `getScriptProperties()`
   - `getProperty()`
   - `setProperty()`
   - `deleteProperty()`

2. **CacheService**
   - `getScriptCache()`
   - `put()`
   - `get()`
   - `remove()`
   - `removeAll()`

3. **GmailApp**
   - `getUserLabelByName()`
   - `createLabel()`
   - `search()`

4. **ScriptApp**
   - `getProjectTriggers()`
   - `deleteTrigger()`
   - `newTrigger()`
   - `timeBased()`
   - `atHour()`
   - `nearMinute()`
   - `everyDays()`
   - `onWeekDay()`
   - `WeekDay.SUNDAY`
   - `create()`

5. **GmailThread Methods**
   - `moveToTrash()`
   - `addLabel()`
   - `removeLabel()`
   - `getFirstMessageSubject()`

6. **Utilities**
   - `sleep()`

7. **Logger**
   - `log()`

## Missing Functions Summary

1. **`logRetentionActivity(message, ruleId)`** - This function is called by the UI wrapper functions (`runAllRetentionRulesFromUI()` and `runRetentionRuleFromUI()`) but is not defined in the codebase. It's likely intended to log retention rule executions for user auditing purposes.

## Dependency Analysis

The email retention manager has a well-structured architecture with:

1. Core functions for rule management (adding, updating, deleting, enabling/disabling)
2. Execution functions for running rules (individually or in batch)
3. UI wrapper functions for user-friendly output
4. Proper integration with the UnifiedCacheService for data persistence

The only significant missing function is `logRetentionActivity()`, which should be implemented to ensure proper auditing of retention rule executions.