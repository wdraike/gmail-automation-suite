/**
 * Drive Service Adapter
 * Provides a testable wrapper around DriveApp
 * This adapter allows dependency injection and easier testing
 */

class DriveAdapter {
  constructor(driveApp = DriveApp) {
    this.drive = driveApp;
  }

  /**
   * Get a file by ID
   */
  getFileById(id) {
    return this.drive.getFileById(id);
  }

  /**
   * Get a folder by ID
   */
  getFolderById(id) {
    return this.drive.getFolderById(id);
  }

  /**
   * Get files by name
   */
  getFilesByName(name) {
    return this.drive.getFilesByName(name);
  }

  /**
   * Get folders by name
   */
  getFoldersByName(name) {
    return this.drive.getFoldersByName(name);
  }

  /**
   * Create a file
   */
  createFile(name, content, mimeType = 'text/plain') {
    return this.drive.createFile(name, content, mimeType);
  }

  /**
   * Create a folder
   */
  createFolder(name) {
    return this.drive.createFolder(name);
  }

  /**
   * Get or create a folder
   */
  getOrCreateFolder(folderName, parentFolder = null) {
    const parent = parentFolder || this.drive.getRootFolder();

    // Check if folder already exists by iterating children
    const folderIterator = parent.getFolders();
    while (folderIterator.hasNext()) {
      const folder = folderIterator.next();
      if (folder.getName() === folderName) {
        return folder;
      }
    }

    // Create new folder
    return parent.createFolder(folderName);
  }

  /**
   * Write text to a file (create or update)
   */
  writeTextFile(folderName, fileName, content) {
    const folder = this.getOrCreateFolder(folderName);

    // Check if file already exists
    const existingFiles = folder.getFilesByName(fileName);
    if (existingFiles.hasNext()) {
      const file = existingFiles.next();
      file.setContent(content);
      return file;
    }

    // Create new file
    return folder.createFile(fileName, content, 'text/plain');
  }

  /**
   * Read text from a file
   */
  readTextFile(fileId) {
    const file = this.getFileById(fileId);
    return file.getBlob().getDataAsString();
  }

  /**
   * Search files with query
   */
  searchFiles(query) {
    return this.drive.searchFiles(query);
  }

  /**
   * Get files in a folder
   */
  getFilesInFolder(folder, mimeType = null) {
    const files = [];
    const fileIterator = mimeType
      ? folder.getFilesByType(mimeType)
      : folder.getFiles();

    while (fileIterator.hasNext()) {
      files.push(fileIterator.next());
    }

    return files;
  }

  /**
   * List all files in a folder (non-trashed)
   */
  listFolderFiles(folderName) {
    const folders = this.getFoldersByName(folderName);

    if (!folders.hasNext()) {
      return [];
    }

    const folder = folders.next();
    return this.getFilesInFolder(folder);
  }

  /**
   * Delete a file
   */
  deleteFile(file) {
    file.setTrashed(true);
  }

  /**
   * Get root folder
   */
  getRootFolder() {
    return this.drive.getRootFolder();
  }
}

// Export for both GAS and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DriveAdapter };
}
