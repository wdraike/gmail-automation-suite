/**
 * Mock Google Apps Script GmailApp Service
 * Provides realistic mock implementations for testing
 */

class MockGmailThread {
  constructor(id, messages = [], labels = []) {
    this.id = id;
    this.messages = messages;
    this.labels = labels;
    this.isUnread = false;
    this.isTrashed = false;
  }

  getId() {
    return this.id;
  }

  getMessages() {
    return this.messages;
  }

  getFirstMessageSubject() {
    return this.messages.length > 0 ? this.messages[0].getSubject() : '';
  }

  getLabels() {
    return this.labels;
  }

  addLabel(label) {
    if (!this.labels.includes(label)) {
      this.labels.push(label);
    }
    return this;
  }

  removeLabel(label) {
    const index = this.labels.indexOf(label);
    if (index > -1) {
      this.labels.splice(index, 1);
    }
    return this;
  }

  isUnread() {
    return this.isUnread;
  }

  markRead() {
    this.isUnread = false;
    return this;
  }

  markUnread() {
    this.isUnread = true;
    return this;
  }

  moveToTrash() {
    this.isTrashed = true;
    return this;
  }

  isInTrash() {
    return this.isTrashed;
  }
}

class MockGmailMessage {
  constructor(id, from, subject, body, date = new Date()) {
    this.id = id;
    this.from = from;
    this.subject = subject;
    this.body = body;
    this.plainBody = body.replace(/<[^>]*>/g, ''); // Strip HTML
    this.date = date;
    this.thread = null;
  }

  getId() {
    return this.id;
  }

  getFrom() {
    return this.from;
  }

  getSubject() {
    return this.subject;
  }

  getBody() {
    return this.body;
  }

  getPlainBody() {
    return this.plainBody;
  }

  getDate() {
    return this.date;
  }

  getThread() {
    return this.thread;
  }

  setThread(thread) {
    this.thread = thread;
  }
}

class MockGmailLabel {
  constructor(name) {
    this.name = name;
    this.id = `label_${name.toLowerCase().replace(/\s+/g, '_')}`;
  }

  getName() {
    return this.name;
  }

  getId() {
    return this.id;
  }
}

class MockGmailApp {
  constructor() {
    this.threads = [];
    this.labels = [];
    this.messages = [];
    this.sentEmails = [];
    this.userEmail = 'test@example.com';
  }

  /**
   * Add a mock thread to the system
   */
  addThread(thread) {
    this.threads.push(thread);
    thread.getMessages().forEach(msg => {
      msg.setThread(thread);
      this.messages.push(msg);
    });
  }

  /**
   * Add a mock label to the system
   */
  addLabel(label) {
    if (!this.labels.find(l => l.getName() === label.getName())) {
      this.labels.push(label);
    }
  }

  getThreadById(id) {
    return this.threads.find(t => t.getId() === id) || null;
  }

  getUserLabelByName(name) {
    return this.labels.find(l => l.getName() === name) || null;
  }

  createLabel(name) {
    let label = this.getUserLabelByName(name);
    if (!label) {
      label = new MockGmailLabel(name);
      this.addLabel(label);
    }
    return label;
  }

  search(query, start = 0, max = 500) {
    // Basic query parsing for common patterns
    let filteredThreads = [...this.threads];

    // Parse label queries: label:name or -label:name
    const labelMatches = query.match(/(-?)label:([^\s]+)/g);
    if (labelMatches) {
      labelMatches.forEach(match => {
        const negate = match.startsWith('-');
        const labelName = match.replace(/^-?label:/, '');

        filteredThreads = filteredThreads.filter(thread => {
          const hasLabel = thread.getLabels().some(l => l.getName() === labelName);
          return negate ? !hasLabel : hasLabel;
        });
      });
    }

    // Parse is:unread
    if (query.includes('is:unread')) {
      filteredThreads = filteredThreads.filter(t => t.isUnread());
    }

    // Parse from: queries
    const fromMatch = query.match(/from:([^\s]+)/);
    if (fromMatch) {
      const fromEmail = fromMatch[1];
      filteredThreads = filteredThreads.filter(thread => {
        return thread.getMessages().some(msg => msg.getFrom().includes(fromEmail));
      });
    }

    // Parse subject: queries
    const subjectMatch = query.match(/subject:"([^"]+)"/);
    if (subjectMatch) {
      const subjectText = subjectMatch[1];
      filteredThreads = filteredThreads.filter(thread => {
        return thread.getFirstMessageSubject().includes(subjectText);
      });
    }

    // Apply pagination
    return filteredThreads.slice(start, start + max);
  }

  sendEmail(recipient, subject, body, options = {}) {
    this.sentEmails.push({
      recipient,
      subject,
      body,
      options,
      timestamp: new Date()
    });
  }

  getUserEmailAddress() {
    return this.userEmail;
  }

  /**
   * Get all sent emails (for test verification)
   */
  getSentEmails() {
    return this.sentEmails;
  }

  /**
   * Clear all sent emails (for test cleanup)
   */
  clearSentEmails() {
    this.sentEmails = [];
  }

  /**
   * Reset the entire mock state
   */
  reset() {
    this.threads = [];
    this.labels = [];
    this.messages = [];
    this.sentEmails = [];
  }
}

module.exports = {
  MockGmailApp,
  MockGmailThread,
  MockGmailMessage,
  MockGmailLabel
};
