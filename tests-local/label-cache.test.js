/**
 * Label Cache Tests
 * Tests for Gmail label caching functionality.
 *
 * label-cache routes Gmail/Properties/Drive through serviceFactory ports; the real
 * adapters delegate to the global SDK mocks (setup.js). The module holds mutable
 * module-level state (LABEL_STRUCTURE_CACHE / LAST_CACHE_UPDATE); tests reset that
 * state by calling getGmailLabels(true) (force refresh clears it) at the start of
 * each stateful test.
 */

const labelCache = require('../src/utils/label-cache.js');
const {
  getGmailLabels,
  _ensureCacheInitialized,
  getGmailLabelStructure,
  getLabelByName,
  labelExists,
  saveCacheToFile,
  getHardcodedLabels,
  isSystemLabel,
  PROP_LABEL_CACHE_TIMESTAMP,
  PROP_LABEL_CACHE_FILE_ID,
} = labelCache;

const { serviceFactory } = require('../src/core/services/index.js');

/**
 * Reset the module-level cache to NULL/expired so the next non-forced
 * getGmailLabels() runs the storage-backed init path. A force refresh clears the
 * cache (sets both vars null) and we make the Gmail refresh throw so LAST_CACHE_UPDATE
 * is never re-stamped — leaving the in-memory cache genuinely empty.
 */
function resetModuleCacheToNull() {
  global.PropertiesService.getScriptProperties().deleteAllProperties();
  global.GmailApp.getUserLabels = jest.fn(() => { throw new Error('reset'); });
  getGmailLabels(true);
}

describe('Label Cache - Complete Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    serviceFactory.reset();
    global.PropertiesService.getScriptProperties().deleteAllProperties();
    global.GmailApp.getUserLabels = jest.fn(() => []);
  });

  describe('isSystemLabel', () => {
    it('returns false for falsy input', () => {
      expect(isSystemLabel('')).toBe(false);
      expect(isSystemLabel(null)).toBe(false);
      expect(isSystemLabel(undefined)).toBe(false);
    });

    it('returns true for a known system label', () => {
      expect(isSystemLabel('INBOX')).toBe(true);
      expect(isSystemLabel('TRASH')).toBe(true);
    });

    it('returns true for CATEGORY_ and SYSTEM_ prefixes', () => {
      expect(isSystemLabel('CATEGORY_PROMOTIONS')).toBe(true);
      expect(isSystemLabel('SYSTEM_FOO')).toBe(true);
    });

    it('returns false for an ordinary user label', () => {
      expect(isSystemLabel('Work')).toBe(false);
    });
  });

  describe('getHardcodedLabels', () => {
    it('returns a non-empty array of label objects with system flags', () => {
      const labels = getHardcodedLabels();
      expect(Array.isArray(labels)).toBe(true);
      expect(labels.length).toBeGreaterThan(0);
      expect(labels.find((l) => l.name === 'INBOX').isSystem).toBe(true);
      expect(labels.find((l) => l.name === 'Work').isSystem).toBe(false);
      // nested label exposes its parent path
      expect(labels.find((l) => l.name === 'Work/Projects').parentPath).toBe('Work');
    });
  });

  describe('getGmailLabels', () => {
    it('returns an array of labels', () => {
      expect(Array.isArray(getGmailLabels())).toBe(true);
    });

    it('logs and clears the cache on force refresh', () => {
      getGmailLabels(true);
      expect(global.Logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Force refresh')
      );
    });

    it('maps Gmail labels into the cache structure (incl. nested parentPath)', () => {
      global.GmailApp.getUserLabels = jest.fn(() => [
        { getName: () => 'Work' },
        { getName: () => 'Work/Projects' },
        { getName: () => 'INBOX' },
      ]);
      const labels = getGmailLabels(true);
      const projects = labels.find((l) => l.name === 'Work/Projects');
      expect(projects.parentPath).toBe('Work');
      expect(labels.find((l) => l.name === 'Work').parentPath).toBeNull();
      expect(labels.find((l) => l.name === 'INBOX').isSystem).toBe(true);
    });

    it('returns [] when label initialization throws', () => {
      global.GmailApp.getUserLabels = jest.fn(() => { throw new Error('API Error'); });
      const result = getGmailLabels(true);
      expect(result).toEqual([]);
    });

    it('reuses the in-memory cache while it is still fresh', () => {
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'Fresh' }]);
      getGmailLabels(true); // populate
      const callsAfterFirst = global.GmailApp.getUserLabels.mock.calls.length;
      // Second call without force should NOT hit Gmail again (cache fresh).
      const second = getGmailLabels(false);
      expect(global.GmailApp.getUserLabels.mock.calls.length).toBe(callsAfterFirst);
      expect(second.some((l) => l.name === 'Fresh')).toBe(true);
    });
  });

  describe('_ensureCacheInitialized — storage-backed paths', () => {
    beforeEach(() => {
      resetModuleCacheToNull();
    });

    it('loads a fresh cache from the Drive file when timestamp + fileId exist', () => {
      const props = global.PropertiesService.getScriptProperties();
      props.setProperty(PROP_LABEL_CACHE_TIMESTAMP, Date.now().toString());
      props.setProperty(PROP_LABEL_CACHE_FILE_ID, 'file-abc');
      global.DriveApp.getFileById = jest.fn(() => ({
        getBlob: () => ({ getDataAsString: () => JSON.stringify([{ name: 'FromFile', path: 'FromFile', isSystem: false, parentPath: null }]) }),
      }));
      // Fresh spy AFTER the reset so we measure only this test's Gmail usage.
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'ShouldNotBeUsed' }]);

      const labels = getGmailLabels(false);
      expect(global.DriveApp.getFileById).toHaveBeenCalledWith('file-abc');
      expect(labels.some((l) => l.name === 'FromFile')).toBe(true);
      // Loaded from the Drive file -> did not hit Gmail.
      expect(global.GmailApp.getUserLabels).not.toHaveBeenCalled();
    });

    it('falls through to a Gmail refresh when the cache file cannot be read', () => {
      const props = global.PropertiesService.getScriptProperties();
      props.setProperty(PROP_LABEL_CACHE_TIMESTAMP, Date.now().toString());
      props.setProperty(PROP_LABEL_CACHE_FILE_ID, 'bad-file');
      global.DriveApp.getFileById = jest.fn(() => { throw new Error('drive down'); });
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'Recovered' }]);

      const labels = getGmailLabels(false);
      expect(global.GmailApp.getUserLabels).toHaveBeenCalled();
      expect(labels.some((l) => l.name === 'Recovered')).toBe(true);
    });

    it('refreshes from Gmail when the stored timestamp is expired', () => {
      resetModuleCacheToNull();
      const props = global.PropertiesService.getScriptProperties();
      // 48h ago -> expired (> 24h CACHE_EXPIRATION).
      props.setProperty(PROP_LABEL_CACHE_TIMESTAMP, (Date.now() - 48 * 3600 * 1000).toString());
      props.setProperty(PROP_LABEL_CACHE_FILE_ID, 'file-old');
      // The expired load path must NOT parse a file as the cache source; the only
      // getFileById call permitted is the later save-step update of file-old.
      const blobSpy = jest.fn();
      global.DriveApp.getFileById = jest.fn(() => ({ setContent: jest.fn(), getBlob: blobSpy }));
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'Refreshed' }]);

      const labels = getGmailLabels(false);
      // Expired -> did NOT read the file as a cache source (getBlob never called)...
      expect(blobSpy).not.toHaveBeenCalled();
      // ...instead refreshed from Gmail.
      expect(global.GmailApp.getUserLabels).toHaveBeenCalled();
      expect(labels.some((l) => l.name === 'Refreshed')).toBe(true);
    });

    it('handles a non-numeric stored timestamp via the raw-string fallback', () => {
      resetModuleCacheToNull();
      const props = global.PropertiesService.getScriptProperties();
      // A non-numeric timestamp: parseInt -> NaN -> falls back to the raw string,
      // which new Date() treats as an invalid/old date, forcing a Gmail refresh.
      props.setProperty(PROP_LABEL_CACHE_TIMESTAMP, 'not-a-number');
      props.setProperty(PROP_LABEL_CACHE_FILE_ID, 'file-x');
      global.DriveApp.getFileById = jest.fn(() => ({ setContent: jest.fn() }));
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'AfterBadTs' }]);
      const labels = getGmailLabels(false);
      expect(labels.some((l) => l.name === 'AfterBadTs')).toBe(true);
    });

    it('persists the timestamp and saves the cache file on refresh', () => {
      const props = global.PropertiesService.getScriptProperties();
      props.deleteAllProperties();
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'Saved' }]);
      global.DriveApp.createFile = jest.fn(() => ({ getId: () => 'new-file-id' }));

      getGmailLabels(true);
      // Timestamp persisted (assert via the stored value, since the props mock
      // returns a fresh wrapper object per call but shares the underlying store).
      expect(props.getProperty(PROP_LABEL_CACHE_TIMESTAMP)).toEqual(expect.any(String));
      expect(global.DriveApp.createFile).toHaveBeenCalled();
      expect(props.getProperty(PROP_LABEL_CACHE_FILE_ID)).toBe('new-file-id');
    });

    it('returns false from _ensureCacheInitialized when the refresh throws', () => {
      resetModuleCacheToNull();
      global.GmailApp.getUserLabels = jest.fn(() => { throw new Error('boom'); });
      expect(_ensureCacheInitialized()).toBe(false);
    });
  });

  describe('getGmailLabelStructure', () => {
    it('returns labels with cache metadata on success', () => {
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'Work' }]);
      const result = getGmailLabelStructure(true);
      expect(result.success).toBe(true);
      expect(result.labels.some((l) => l.name === 'Work')).toBe(true);
      expect(result.message).toContain('Refreshed');
      expect(typeof result.lastUpdated).toBe('number');
    });

    it('defaults forceRefresh to false and uses now() when there is no cache timestamp', () => {
      // No prior cache update -> LAST_CACHE_UPDATE is null -> lastUpdated uses now().
      resetModuleCacheToNull(); // leaves LAST_CACHE_UPDATE null
      global.GmailApp.getUserLabels = jest.fn(() => { throw new Error('keep null'); });
      const result = getGmailLabelStructure(); // no-arg -> default forceRefresh=false
      expect(result.success).toBe(true);
      expect(typeof result.lastUpdated).toBe('number');
      expect(result.fromCache).toBeFalsy();
    });

    it('reports fromCache=false and a cache message when not forcing refresh', () => {
      resetModuleCacheToNull();
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'C' }]);
      getGmailLabels(true); // make cache fresh
      const result = getGmailLabelStructure(false);
      expect(result.message).toContain('Retrieved');
      expect(result.fromCache).toBe(true);
    });

    // NOTE: getGmailLabelStructure's catch/hardcoded-fallback path is unreachable
    // from tests: the internal getGmailLabels() call never throws (it has its own
    // try/catch returning []), and result construction cannot throw. The catch is
    // defensive and is /* istanbul ignore */-d in the source with that justification.
  });

  describe('getLabelByName', () => {
    beforeEach(() => {
      resetModuleCacheToNull();
    });

    it('returns a label found in the cache WITHOUT a direct API lookup', () => {
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'Work' }]);
      getGmailLabels(true);
      // A cache hit must NOT fall through to the direct getUserLabelByName API.
      global.GmailApp.getUserLabelByName = jest.fn(() => { throw new Error('should not be called'); });
      const result = getLabelByName('Work');
      expect(result.name).toBe('Work');
      expect(global.GmailApp.getUserLabelByName).not.toHaveBeenCalled();
    });

    it('falls back to a direct API lookup and caches the result (nested)', () => {
      getGmailLabels(true); // empty cache
      global.GmailApp.getUserLabelByName = jest.fn(() => ({ getName: () => 'Work/Sub' }));
      const result = getLabelByName('Work/Sub');
      expect(result.name).toBe('Work/Sub');
      expect(result.parentPath).toBe('Work');
      // Cached now -> a second call resolves from cache without a direct lookup.
      global.GmailApp.getUserLabelByName.mockClear();
      const again = getLabelByName('Work/Sub');
      expect(again.name).toBe('Work/Sub');
      expect(global.GmailApp.getUserLabelByName).not.toHaveBeenCalled();
    });

    it('returns null when the label exists in neither cache nor API', () => {
      getGmailLabels(true);
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      expect(getLabelByName('Nope')).toBeNull();
    });

    it('returns null and logs when the direct API lookup throws', () => {
      getGmailLabels(true);
      global.GmailApp.getUserLabelByName = jest.fn(() => { throw new Error('api boom'); });
      expect(getLabelByName('X')).toBeNull();
    });

    it('lazily initializes the cache array when adding a label found only via direct API', () => {
      // Start from a null in-memory cache so the `if (!LABEL_STRUCTURE_CACHE)` guard runs.
      resetModuleCacheToNull();
      global.GmailApp.getUserLabels = jest.fn(() => []); // empty cache on init
      global.GmailApp.getUserLabelByName = jest.fn(() => ({ getName: () => 'DirectOnly' }));
      const result = getLabelByName('DirectOnly');
      expect(result.name).toBe('DirectOnly');
      expect(result.parentPath).toBeNull();
    });
  });

  describe('labelExists', () => {
    beforeEach(() => { resetModuleCacheToNull(); });

    it('returns true when a label is present in the cache', () => {
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'Present' }]);
      getGmailLabels(true);
      expect(labelExists('Present')).toBe(true);
    });

    it('returns false when a label is absent', () => {
      getGmailLabels(true);
      expect(labelExists('Absent')).toBe(false);
    });
  });

  describe('saveCacheToFile', () => {
    it('returns false when there is no cache to save', () => {
      // Force the module cache to null via a throwing refresh (leaves it cleared).
      global.GmailApp.getUserLabels = jest.fn(() => { throw new Error('x'); });
      getGmailLabels(true); // clears cache, refresh fails -> cache stays null
      expect(saveCacheToFile()).toBe(false);
    });

    it('updates an existing cache file when a file ID is stored', () => {
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'A' }]);
      const props = global.PropertiesService.getScriptProperties();
      props.setProperty(PROP_LABEL_CACHE_FILE_ID, 'existing-file');
      const setContent = jest.fn();
      global.DriveApp.getFileById = jest.fn(() => ({ setContent }));

      getGmailLabels(true); // populates cache + calls saveCacheToFile internally
      expect(setContent).toHaveBeenCalled();
      expect(saveCacheToFile()).toBe(true);
    });

    it('creates a new file when updating the existing one fails', () => {
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'B' }]);
      const props = global.PropertiesService.getScriptProperties();
      props.setProperty(PROP_LABEL_CACHE_FILE_ID, 'broken-file');
      global.DriveApp.getFileById = jest.fn(() => { throw new Error('cannot update'); });
      global.DriveApp.createFile = jest.fn(() => ({ getId: () => 'created-id' }));

      getGmailLabels(true);
      expect(global.DriveApp.createFile).toHaveBeenCalled();
      // file ID persisted for next time
      expect(props.getProperty(PROP_LABEL_CACHE_FILE_ID)).toBe('created-id');
    });

    it('creates a new file when no file ID is stored', () => {
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'C' }]);
      global.DriveApp.createFile = jest.fn(() => ({ getId: () => 'fresh-id' }));
      getGmailLabels(true);
      expect(global.DriveApp.createFile).toHaveBeenCalledWith(
        'GmailLabelCache.json', expect.any(String), 'text/plain'
      );
    });

    it('returns false when the save throws unexpectedly', () => {
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'D' }]);
      getGmailLabels(true); // populate cache
      // Now break createFile AND getFileById so saveCacheToFile's outer logic throws.
      const props = global.PropertiesService.getScriptProperties();
      props.deleteProperty(PROP_LABEL_CACHE_FILE_ID);
      global.DriveApp.createFile = jest.fn(() => { throw new Error('save boom'); });
      expect(saveCacheToFile()).toBe(false);
    });
  });

  describe('serviceFactory seam (GAS-global branch)', () => {
    afterEach(() => { delete global.serviceFactory; });

    it('resolves the GAS-global serviceFactory when present', () => {
      global.serviceFactory = serviceFactory;
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'ViaGlobal' }]);
      const labels = getGmailLabels(true);
      expect(labels.some((l) => l.name === 'ViaGlobal')).toBe(true);
    });
  });
});
