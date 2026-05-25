/**
 * Mock Google Apps Script Utilities Service
 * Provides realistic mock implementations for testing
 */

class MockUtilities {
  static sleep(milliseconds) {
    // In tests, we don't want to actually sleep
    // Just track that it was called
    if (!this.sleepCalls) this.sleepCalls = [];
    this.sleepCalls.push({ milliseconds, timestamp: new Date() });
  }

  static formatDate(date, timeZone, format) {
    // Basic date formatting - simplified version
    const pad = (num) => String(num).padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    let formatted = format
      .replace('yyyy', year)
      .replace('MM', month)
      .replace('dd', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);

    return formatted;
  }

  static base64Encode(data) {
    if (typeof data === 'string') {
      return Buffer.from(data).toString('base64');
    }
    return Buffer.from(data).toString('base64');
  }

  static base64Decode(encoded) {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  }

  static base64EncodeWebSafe(data) {
    return this.base64Encode(data)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  static base64DecodeWebSafe(encoded) {
    let base64 = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // Add padding
    while (base64.length % 4) {
      base64 += '=';
    }

    return this.base64Decode(base64);
  }

  static computeDigest(algorithm, value, charset = 'UTF_8') {
    const crypto = require('crypto');

    const algoMap = {
      'MD5': 'md5',
      'SHA_1': 'sha1',
      'SHA_256': 'sha256',
      'SHA_384': 'sha384',
      'SHA_512': 'sha512'
    };

    const algo = algoMap[algorithm] || 'md5';
    const hash = crypto.createHash(algo);

    if (typeof value === 'string') {
      hash.update(value);
    } else {
      hash.update(Buffer.from(value));
    }

    return Array.from(hash.digest());
  }

  static computeHmacSha256Signature(value, key) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(value);
    return Array.from(hmac.digest());
  }

  static newBlob(data, mimeType, name) {
    return {
      data,
      mimeType,
      name,
      getDataAsString: () => data,
      getBytes: () => Buffer.from(data),
      getContentType: () => mimeType,
      getName: () => name,
      setName: (newName) => { name = newName; }
    };
  }

  static parseCsv(csv, delimiter = ',') {
    const rows = [];
    const lines = csv.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      const row = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          row.push(current);
          current = '';
        } else {
          current += char;
        }
      }

      row.push(current);
      rows.push(row);
    }

    return rows;
  }

  static jsonParse(jsonString) {
    return JSON.parse(jsonString);
  }

  static jsonStringify(obj) {
    return JSON.stringify(obj);
  }

  static getUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get sleep calls (for test verification)
   */
  static getSleepCalls() {
    return this.sleepCalls || [];
  }

  /**
   * Clear sleep calls (for test cleanup)
   */
  static clearSleepCalls() {
    this.sleepCalls = [];
  }

  /**
   * Reset the entire mock state
   */
  static reset() {
    this.sleepCalls = [];
  }
}

// Enum-like objects for algorithms
MockUtilities.DigestAlgorithm = {
  MD5: 'MD5',
  SHA_1: 'SHA_1',
  SHA_256: 'SHA_256',
  SHA_384: 'SHA_384',
  SHA_512: 'SHA_512'
};

MockUtilities.Charset = {
  US_ASCII: 'US_ASCII',
  UTF_8: 'UTF_8'
};

module.exports = {
  MockUtilities
};
