/**
 * Gmail Service Adapter
 * Provides a testable wrapper around GmailApp
 * This adapter allows dependency injection and easier testing
 */

class GmailAdapter {
  constructor(gmailApp = GmailApp) {
    this.gmail = gmailApp;
  }

  /**
   * Get a thread by ID
   */
  getThreadById(id) {
    return this.gmail.getThreadById(id);
  }

  /**
   * Get or create a label
   */
  getUserLabelByName(name) {
    return this.gmail.getUserLabelByName(name);
  }

  /**
   * Create a new label
   */
  createLabel(name) {
    return this.gmail.createLabel(name);
  }

  /**
   * Search for threads
   */
  search(query, start = 0, max = 500) {
    return this.gmail.search(query, start, max);
  }

  /**
   * Get inbox threads
   */
  getInboxThreads(start = 0, max = 50) {
    return this.gmail.getInboxThreads(start, max);
  }

  /**
   * Send an email
   */
  sendEmail(recipient, subject, body, options = {}) {
    return MailApp.sendEmail(recipient, subject, body, options);
  }

  /**
   * Get user's email address
   */
  getUserEmailAddress() {
    return Session.getEffectiveUser().getEmail();
  }

  /**
   * Get a message by ID
   */
  getMessageById(id) {
    return this.gmail.getMessageById(id);
  }

  /**
   * Get all raw user-label objects (GmailLabel[]). Callers that need the live
   * label objects (e.g. to read getName()/getThreads()) use this; callers that
   * want plain cached {name,type} records use getAllLabels().
   */
  getUserLabels() {
    return this.gmail.getUserLabels();
  }

  /**
   * Safely get a label by name; returns null (not throw) on error.
   * Relocated from the legacy GmailLabelService.getLabelSafe (D5).
   */
  getLabelSafe(labelName) {
    try {
      return this.getUserLabelByName(labelName);
    } catch (error) {
      Logger.log(`Label not found: ${labelName}`);
      return null;
    }
  }

  /**
   * Get or create a Gmail label, creating each level of a nested path
   * (e.g. "Work/Projects/Q1") as needed. Relocated from the legacy
   * GmailLabelService.getOrCreateLabel (D5) so callers consolidate on
   * GmailAdapter.
   */
  getOrCreateLabel(labelPath) {
    let label = this.getUserLabelByName(labelPath);
    if (label) return label;

    if (labelPath.includes('/')) {
      const parts = labelPath.split('/');
      let currentPath = '';
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!this.getUserLabelByName(currentPath)) {
          this.createLabel(currentPath);
          Logger.log(`Created label: ${currentPath}`);
        }
      }
      return this.getUserLabelByName(labelPath);
    }

    return this.createLabel(labelPath);
  }

  /**
   * Get threads from a label with pagination. Returns [] when the label does
   * not exist. Relocated from the legacy GmailThreadService.getThreadsFromLabel
   * (D5).
   */
  getThreadsFromLabel(labelName, start = 0, max = 100) {
    try {
      const label = this.getLabelSafe(labelName);
      if (!label) return [];
      return label.getThreads(start, max);
    } catch (error) {
      Logger.log(`Error getting threads from ${labelName}: ${error}`);
      return [];
    }
  }

  /**
   * Extract metadata for a thread. Returns null on error. Relocated from the
   * legacy GmailThreadService.getThreadMetadata (D5).
   */
  getThreadMetadata(thread) {
    try {
      const messages = thread.getMessages();
      const firstMessage = messages[0];
      const lastMessage = messages[messages.length - 1];

      return {
        id: thread.getId(),
        subject: thread.getFirstMessageSubject(),
        messageCount: messages.length,
        isUnread: thread.isUnread(),
        isImportant: thread.isImportant(),
        labels: thread.getLabels().map(l => l.getName()),
        firstMessageDate: firstMessage.getDate(),
        lastMessageDate: lastMessage.getDate(),
        from: firstMessage.getFrom(),
        hasAttachments: messages.some(m => m.getAttachments().length > 0)
      };
    } catch (error) {
      Logger.log(`Error getting thread metadata: ${error}`);
      return null;
    }
  }

  /**
   * Get all user labels with caching + system labels.
   *
   * Relocated verbatim from the legacy GmailLabelService.getAllLabels so feature
   * code can consolidate onto GmailAdapter. The 5-minute CacheService cache, the
   * prepended system labels, and the `return []` on error are pre-existing behavior
   * preserved exactly (not a new fallback).
   *
   * @param {boolean} forceRefresh - Force refresh the cache
   * @returns {Array<Object>} Array of label objects with name and type
   */
  getAllLabels(forceRefresh = false) {
    const cacheKey = 'GMAIL_LABELS_CACHE';
    const cacheExpiry = 300; // 5 minutes

    if (!forceRefresh) {
      const cached = CacheService.getScriptCache().get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    try {
      const labels = this.gmail.getUserLabels();

      const labelData = labels.map(label => ({
        name: label.getName(),
        type: 'user'
      }));

      // Add system labels
      const systemLabels = ['INBOX', 'STARRED', 'IMPORTANT', 'SENT', 'DRAFT', 'SPAM', 'TRASH'];
      systemLabels.forEach(name => {
        labelData.unshift({ name, type: 'system' });
      });

      // Cache the results
      CacheService.getScriptCache().put(cacheKey, JSON.stringify(labelData), cacheExpiry);

      return labelData;
    } catch (error) {
      Logger.log(`Error getting labels: ${error}`);
      return [];
    }
  }

  /**
   * Search for threads with a specific label
   */
  searchByLabel(labelName, start = 0, max = 500) {
    return this.search(`label:${labelName}`, start, max);
  }

  /**
   * Search for unread threads with a specific label
   */
  searchUnreadByLabel(labelName, start = 0, max = 500) {
    return this.search(`label:${labelName} is:unread`, start, max);
  }

  /**
   * Batch process threads with rate limiting
   */
  async batchProcessThreads(threads, processor, batchSize = 5, delayMs = 1000) {
    const results = [];

    for (let i = 0; i < threads.length; i += batchSize) {
      const batch = threads.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(thread => processor(thread))
      );

      results.push(...batchResults);

      // Delay between batches
      if (i + batchSize < threads.length && delayMs > 0) {
        Utilities.sleep(delayMs);
      }
    }

    return results;
  }
}

// Export for both GAS and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GmailAdapter };
}
