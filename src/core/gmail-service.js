/**
 * Gmail Service
 * Centralized service for all Gmail operations
 * Provides a clean interface for label management, email operations, and thread handling
 */

/**
 * Gmail label operations
 */
const GmailLabelService = {
  /**
   * Get or create a Gmail label with support for nested paths
   * @param {string} labelPath - Label path (e.g., "Work/Projects/Q1")
   * @returns {GmailLabel} The Gmail label object
   */
  getOrCreateLabel(labelPath) {
    try {
      // Try to get existing label
      let label = GmailApp.getUserLabelByName(labelPath);
      if (label) return label;
      
      // Create label hierarchy if needed
      if (labelPath.includes('/')) {
        const parts = labelPath.split('/');
        let currentPath = '';
        
        for (const part of parts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          
          let currentLabel = GmailApp.getUserLabelByName(currentPath);
          if (!currentLabel) {
            currentLabel = GmailApp.createLabel(currentPath);
            Logger.log(`Created label: ${currentPath}`);
          }
        }
        
        return GmailApp.getUserLabelByName(labelPath);
      } else {
        // Simple label
        return GmailApp.createLabel(labelPath);
      }
    } catch (error) {
      Logger.log(`Error creating label ${labelPath}: ${error}`);
      throw error;
    }
  },
  
  /**
   * Safely get a label by name
   * @param {string} labelName - The label name
   * @returns {GmailLabel|null} The label or null if not found
   */
  getLabelSafe(labelName) {
    try {
      return GmailApp.getUserLabelByName(labelName);
    } catch (error) {
      Logger.log(`Label not found: ${labelName}`);
      return null;
    }
  },
  
  /**
   * Get all user labels with caching support
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
      const labels = GmailApp.getUserLabels();
      
      // Debug: Log raw Gmail labels
      Logger.log(`Found ${labels.length} Gmail labels`);
      labels.forEach((label, index) => {
        const name = label.getName();
        if (name.includes('/')) {
          const parts = name.split('/');
          Logger.log(`Gmail Label ${index}: ${name} (${parts.length} levels)`);
        }
      });
      
      const labelData = labels.map(label => ({
        name: label.getName(),
        type: label.getName().includes('/') ? 'user' : 'user'
      }));
      
      // Debug: Check for deep labels
      const deepLabels = labelData.filter(label => label.name.split('/').length >= 3);
      Logger.log(`Found ${deepLabels.length} labels with 3+ levels in Gmail service`);
      
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
  },
  
  /**
   * Apply a label to a thread
   * @param {GmailThread} thread - The thread to label
   * @param {string} labelName - The label name to apply
   * @returns {boolean} Success status
   */
  applyLabel(thread, labelName) {
    try {
      const label = this.getOrCreateLabel(labelName);
      thread.addLabel(label);
      return true;
    } catch (error) {
      Logger.log(`Error applying label ${labelName}: ${error}`);
      return false;
    }
  },
  
  /**
   * Remove a label from a thread
   * @param {GmailThread} thread - The thread
   * @param {string} labelName - The label to remove
   * @returns {boolean} Success status
   */
  removeLabel(thread, labelName) {
    try {
      const label = this.getLabelSafe(labelName);
      if (label) {
        thread.removeLabel(label);
      }
      return true;
    } catch (error) {
      Logger.log(`Error removing label ${labelName}: ${error}`);
      return false;
    }
  },
  
  /**
   * Move a thread by changing its labels
   * @param {GmailThread} thread - The thread to move
   * @param {string} fromLabel - Label to remove
   * @param {string} toLabel - Label to add
   * @returns {boolean} Success status
   */
  moveThread(thread, fromLabel, toLabel) {
    try {
      if (fromLabel) this.removeLabel(thread, fromLabel);
      if (toLabel) this.applyLabel(thread, toLabel);
      return true;
    } catch (error) {
      Logger.log(`Error moving thread: ${error}`);
      return false;
    }
  }
};

/**
 * Gmail thread operations
 */
const GmailThreadService = {
  /**
   * Get threads from a label with pagination
   * @param {string} labelName - The label name
   * @param {number} start - Start index
   * @param {number} max - Maximum threads to return
   * @returns {GmailThread[]} Array of threads
   */
  getThreadsFromLabel(labelName, start = 0, max = 100) {
    try {
      const label = GmailLabelService.getLabelSafe(labelName);
      if (!label) return [];
      
      return label.getThreads(start, max);
    } catch (error) {
      Logger.log(`Error getting threads from ${labelName}: ${error}`);
      return [];
    }
  },
  
  /**
   * Search for threads with a query
   * @param {string} query - Gmail search query
   * @param {number} start - Start index
   * @param {number} max - Maximum threads
   * @returns {GmailThread[]} Array of threads
   */
  searchThreads(query, start = 0, max = 100) {
    try {
      return GmailApp.search(query, start, max);
    } catch (error) {
      Logger.log(`Error searching threads: ${error}`);
      return [];
    }
  },
  
  /**
   * Get thread metadata
   * @param {GmailThread} thread - The thread
   * @returns {Object} Thread metadata
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
  },
  
  /**
   * Archive threads
   * @param {GmailThread[]} threads - Threads to archive
   * @returns {number} Number of threads archived
   */
  archiveThreads(threads) {
    let count = 0;
    threads.forEach(thread => {
      try {
        thread.moveToArchive();
        count++;
      } catch (error) {
        Logger.log(`Error archiving thread: ${error}`);
      }
    });
    return count;
  },
  
  /**
   * Trash threads
   * @param {GmailThread[]} threads - Threads to trash
   * @returns {number} Number of threads trashed
   */
  trashThreads(threads) {
    let count = 0;
    threads.forEach(thread => {
      try {
        thread.moveToTrash();
        count++;
      } catch (error) {
        Logger.log(`Error trashing thread: ${error}`);
      }
    });
    return count;
  }
};

/**
 * Gmail message operations
 */
const GmailMessageService = {
  /**
   * Extract email addresses from a message
   * @param {GmailMessage} message - The message
   * @returns {Object} Object with from, to, cc, bcc arrays
   */
  extractEmailAddresses(message) {
    try {
      const from = message.getFrom();
      const to = message.getTo();
      const cc = message.getCc();
      const bcc = message.getBcc();
      
      return {
        from: this.parseEmailAddress(from),
        to: this.parseEmailAddresses(to),
        cc: this.parseEmailAddresses(cc),
        bcc: this.parseEmailAddresses(bcc)
      };
    } catch (error) {
      Logger.log(`Error extracting email addresses: ${error}`);
      return { from: null, to: [], cc: [], bcc: [] };
    }
  },
  
  /**
   * Parse a single email address
   * @param {string} emailString - Email string like "Name <email@example.com>"
   * @returns {Object} Object with email and name
   */
  parseEmailAddress(emailString) {
    if (!emailString) return null;
    
    const match = emailString.match(/^(.*?)\s*<(.+?)>$/);
    if (match) {
      return {
        email: match[2].trim(),
        name: match[1].trim().replace(/^["']|["']$/g, '')
      };
    }
    
    // Plain email address
    return {
      email: emailString.trim(),
      name: ''
    };
  },
  
  /**
   * Parse multiple email addresses
   * @param {string} emailString - Comma-separated emails
   * @returns {Array<Object>} Array of email objects
   */
  parseEmailAddresses(emailString) {
    if (!emailString) return [];
    
    return emailString.split(',').map(email => this.parseEmailAddress(email)).filter(e => e);
  },
  
  /**
   * Get domain from email address
   * @param {string} email - Email address
   * @returns {string} Domain name
   */
  getDomain(email) {
    const parsed = email.includes('<') ? this.parseEmailAddress(email) : { email };
    return parsed.email.split('@')[1] || '';
  }
};

/**
 * Gmail utility functions
 */
const GmailUtilityService = {
  /**
   * Check if email is from a no-reply address
   * @param {string} email - Email address
   * @returns {boolean} True if no-reply
   */
  isNoReplyEmail(email) {
    const noReplyPatterns = [
      /no-?reply/i,
      /do-?not-?reply/i,
      /notifications?/i,
      /automated/i,
      /system/i,
      /mailer-daemon/i
    ];
    
    return noReplyPatterns.some(pattern => pattern.test(email));
  },
  
  /**
   * Clean a label name for use
   * @param {string} name - Raw label name
   * @returns {string} Cleaned label name
   */
  cleanLabelName(name) {
    return name
      .trim()
      .replace(/[^\w\s\-\/]/g, '') // Remove special chars except dash and slash
      .replace(/\s+/g, '-')         // Replace spaces with dashes
      .replace(/\-+/g, '-')         // Remove multiple dashes
      .replace(/\/+/g, '/')         // Remove multiple slashes
      .replace(/^\/|\/$/g, '');     // Remove leading/trailing slashes
  },
  
  /**
   * Batch process threads with rate limiting
   * @param {GmailThread[]} threads - Threads to process
   * @param {Function} processFunc - Function to process each thread
   * @param {number} batchSize - Batch size
   * @param {number} delayMs - Delay between batches
   * @returns {Array} Results from processing
   */
  async batchProcess(threads, processFunc, batchSize = 100, delayMs = 1000) {
    const results = [];
    
    for (let i = 0; i < threads.length; i += batchSize) {
      const batch = threads.slice(i, i + batchSize);
      
      for (const thread of batch) {
        try {
          const result = await processFunc(thread);
          results.push(result);
        } catch (error) {
          Logger.log(`Error processing thread: ${error}`);
          results.push({ error: error.toString() });
        }
      }
      
      // Delay between batches
      if (i + batchSize < threads.length) {
        Utilities.sleep(delayMs);
      }
    }
    
    return results;
  }
};

// Export the services as a single GmailService object
const GmailService = {
  labels: GmailLabelService,
  threads: GmailThreadService,
  messages: GmailMessageService,
  utils: GmailUtilityService
};

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GmailLabelService,
    GmailThreadService,
    GmailMessageService,
    GmailUtilityService,
    GmailService
  };
}
