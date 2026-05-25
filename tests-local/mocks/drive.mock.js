/**
 * Mock Google Apps Script Drive Service
 * Provides realistic mock implementations for testing
 */

class MockFile {
  constructor(name, content = '', mimeType = 'text/plain') {
    this.id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.content = content;
    this.mimeType = mimeType;
    this.createdDate = new Date();
    this.lastUpdated = new Date();
    this.trashed = false;
    this.parent = null;
  }

  getId() {
    return this.id;
  }

  getName() {
    return this.name;
  }

  setName(name) {
    this.name = name;
    this.lastUpdated = new Date();
    return this;
  }

  getBlob() {
    return {
      getDataAsString: () => this.content,
      getBytes: () => Buffer.from(this.content),
      getContentType: () => this.mimeType
    };
  }

  getAs(contentType) {
    return {
      getDataAsString: () => this.content,
      getBytes: () => Buffer.from(this.content),
      getContentType: () => contentType
    };
  }

  setContent(content, mimeType) {
    this.content = content;
    if (mimeType) this.mimeType = mimeType;
    this.lastUpdated = new Date();
    return this;
  }

  getUrl() {
    return `https://drive.google.com/file/d/${this.id}/view`;
  }

  getDownloadUrl() {
    return `https://drive.google.com/uc?id=${this.id}&export=download`;
  }

  getDateCreated() {
    return this.createdDate;
  }

  getLastUpdated() {
    return this.lastUpdated;
  }

  getMimeType() {
    return this.mimeType;
  }

  setTrashed(trashed) {
    this.trashed = trashed;
    return this;
  }

  isTrashed() {
    return this.trashed;
  }

  makeCopy(name, folder) {
    const copy = new MockFile(name, this.content, this.mimeType);
    if (folder) {
      copy.parent = folder;
    }
    return copy;
  }

  moveTo(folder) {
    this.parent = folder;
    return this;
  }

  getParents() {
    // Return a mock iterator of parent folders
    const parents = this.parent ? [this.parent] : [];
    return new MockFolderIterator(parents);
  }
}

class MockFolder {
  constructor(name) {
    this.id = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = name;
    this.files = [];
    this.folders = [];
    this.parent = null;
  }

  getId() {
    return this.id;
  }

  getName() {
    return this.name;
  }

  setName(name) {
    this.name = name;
    return this;
  }

  getFiles() {
    return new MockFileIterator(this.files);
  }

  getFilesByName(name) {
    const matches = this.files.filter(f => f.getName() === name);
    return new MockFileIterator(matches);
  }

  getFilesByType(mimeType) {
    const matches = this.files.filter(f => f.getMimeType() === mimeType);
    return new MockFileIterator(matches);
  }

  getFolders() {
    return new MockFolderIterator(this.folders);
  }

  getFoldersByName(name) {
    const matches = this.folders.filter(f => f.getName() === name);
    return new MockFolderIterator(matches);
  }

  createFile(name, content, mimeType = 'text/plain') {
    const file = new MockFile(name, content, mimeType);
    file.parent = this;
    this.files.push(file);
    return file;
  }

  createFolder(name) {
    const folder = new MockFolder(name);
    folder.parent = this;
    this.folders.push(folder);
    return folder;
  }

  addFile(file) {
    if (!this.files.includes(file)) {
      this.files.push(file);
      file.parent = this;
    }
    return this;
  }

  addFolder(folder) {
    if (!this.folders.includes(folder)) {
      this.folders.push(folder);
      folder.parent = this;
    }
    return this;
  }

  removeFile(file) {
    const index = this.files.indexOf(file);
    if (index > -1) {
      this.files.splice(index, 1);
    }
    return this;
  }

  getUrl() {
    return `https://drive.google.com/drive/folders/${this.id}`;
  }
}

class MockFileIterator {
  constructor(files) {
    this.files = [...files];
    this.index = 0;
  }

  hasNext() {
    return this.index < this.files.length;
  }

  next() {
    return this.files[this.index++];
  }
}

class MockFolderIterator {
  constructor(folders) {
    this.folders = [...folders];
    this.index = 0;
  }

  hasNext() {
    return this.index < this.folders.length;
  }

  next() {
    return this.folders[this.index++];
  }
}

class MockDriveApp {
  constructor() {
    this.files = [];
    this.folders = [];
    this.rootFolder = new MockFolder('My Drive');
    this.folders.push(this.rootFolder);
  }

  createFile(nameOrBlob, content, mimeType = 'text/plain') {
    // Handle blob parameter (from Utilities.newBlob)
    if (typeof nameOrBlob === 'object' && nameOrBlob.name) {
      const blob = nameOrBlob;
      const file = new MockFile(blob.name, blob.content || blob.getDataAsString(), blob.mimeType);
      this.files.push(file);
      this.rootFolder.addFile(file);
      return file;
    }

    // Handle regular parameters
    const file = new MockFile(nameOrBlob, content, mimeType);
    this.files.push(file);
    this.rootFolder.addFile(file);
    return file;
  }

  createFolder(name) {
    const folder = new MockFolder(name);
    this.folders.push(folder);
    this.rootFolder.addFolder(folder);
    return folder;
  }

  getFileById(id) {
    return this.files.find(f => f.getId() === id) || null;
  }

  getFolderById(id) {
    return this.folders.find(f => f.getId() === id) || null;
  }

  getFilesByName(name) {
    const matches = this.files.filter(f => f.getName() === name && !f.isTrashed());
    return new MockFileIterator(matches);
  }

  getFoldersByName(name) {
    const matches = this.folders.filter(f => f.getName() === name);
    return new MockFolderIterator(matches);
  }

  getFilesByType(mimeType) {
    const matches = this.files.filter(f => f.getMimeType() === mimeType && !f.isTrashed());
    return new MockFileIterator(matches);
  }

  getRootFolder() {
    return this.rootFolder;
  }

  searchFiles(query) {
    // Basic query parsing
    let matches = [...this.files.filter(f => !f.isTrashed())];

    // Parse mimeType (handles both = and == with single or double quotes)
    const mimeMatch = query.match(/mimeType\s*=+\s*["']([^"']+)["']/);
    if (mimeMatch) {
      const mimeType = mimeMatch[1];
      matches = matches.filter(f => f.getMimeType() === mimeType);
    }

    // Parse title contains (handles both single and double quotes)
    const titleMatches = query.matchAll(/title contains ["']([^"']+)["']/g);
    const titleTexts = [...titleMatches].map(m => m[1]);
    if (titleTexts.length > 0) {
      // If multiple title conditions with "or", match any
      if (query.includes(' or ')) {
        matches = matches.filter(f =>
          titleTexts.some(text => f.getName().includes(text))
        );
      } else {
        // Otherwise require all
        matches = matches.filter(f =>
          titleTexts.every(text => f.getName().includes(text))
        );
      }
    }

    // Parse trashed
    if (query.includes('trashed = false')) {
      matches = matches.filter(f => !f.isTrashed());
    } else if (query.includes('trashed = true')) {
      matches = matches.filter(f => f.isTrashed());
    }

    return new MockFileIterator(matches);
  }

  searchFolders(query) {
    let matches = [...this.folders];

    // Parse title contains
    const titleMatch = query.match(/title contains '([^']+)'/);
    if (titleMatch) {
      const titleText = titleMatch[1];
      matches = matches.filter(f => f.getName().includes(titleText));
    }

    return new MockFolderIterator(matches);
  }

  /**
   * Add a file to the mock system
   */
  addFile(file) {
    if (!this.files.includes(file)) {
      this.files.push(file);
    }
  }

  /**
   * Add a folder to the mock system
   */
  addFolder(folder) {
    if (!this.folders.includes(folder)) {
      this.folders.push(folder);
    }
  }

  /**
   * Reset the entire mock state
   */
  reset() {
    this.files = [];
    this.folders = [];
    this.rootFolder = new MockFolder('My Drive');
    this.folders.push(this.rootFolder);
  }
}

module.exports = {
  MockDriveApp,
  MockFolder,
  MockFile,
  MockFileIterator,
  MockFolderIterator
};
