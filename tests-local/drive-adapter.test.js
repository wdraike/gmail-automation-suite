/**
 * DriveAdapter Tests
 */

const { DriveAdapter } = require('../src/core/services/drive-adapter.js');

describe('DriveAdapter', () => {
  let adapter;
  let mockDriveApp;

  beforeEach(() => {
    mockDriveApp = {
      getFileById: jest.fn(),
      getFolderById: jest.fn(),
      getFilesByName: jest.fn(),
      getFoldersByName: jest.fn(),
      createFile: jest.fn(),
      createFolder: jest.fn(),
      getRootFolder: jest.fn(),
      getFolders: jest.fn(() => ({ hasNext: jest.fn(() => false) })),
    };
    adapter = new DriveAdapter(mockDriveApp);
  });

  describe('getFileById', () => {
    it('should delegate to drive.getFileById', () => {
      const mockFile = { getName: jest.fn(() => 'test.txt') };
      mockDriveApp.getFileById.mockReturnValue(mockFile);

      const result = adapter.getFileById('file-id');

      expect(mockDriveApp.getFileById).toHaveBeenCalledWith('file-id');
      expect(result).toBe(mockFile);
    });
  });

  describe('getFolderById', () => {
    it('should delegate to drive.getFolderById', () => {
      const mockFolder = { getName: jest.fn(() => 'TestFolder') };
      mockDriveApp.getFolderById.mockReturnValue(mockFolder);

      const result = adapter.getFolderById('folder-id');

      expect(mockDriveApp.getFolderById).toHaveBeenCalledWith('folder-id');
      expect(result).toBe(mockFolder);
    });
  });

  describe('getFilesByName', () => {
    it('should delegate to drive.getFilesByName', () => {
      mockDriveApp.getFilesByName.mockReturnValue({ hasNext: jest.fn(() => false) });

      const result = adapter.getFilesByName('test.txt');

      expect(mockDriveApp.getFilesByName).toHaveBeenCalledWith('test.txt');
      expect(result).toBeDefined();
    });
  });

  describe('createFile', () => {
    it('should delegate to drive.createFile with default mimeType', () => {
      const mockFile = { getName: jest.fn(() => 'test.txt') };
      mockDriveApp.createFile.mockReturnValue(mockFile);

      const result = adapter.createFile('test.txt', 'content');

      expect(mockDriveApp.createFile).toHaveBeenCalledWith('test.txt', 'content', 'text/plain');
      expect(result).toBe(mockFile);
    });

    it('should accept custom mimeType', () => {
      const mockFile = { getName: jest.fn(() => 'test.json') };
      mockDriveApp.createFile.mockReturnValue(mockFile);

      adapter.createFile('test.json', '{"a":1}', 'application/json');

      expect(mockDriveApp.createFile).toHaveBeenCalledWith('test.json', '{"a":1}', 'application/json');
    });
  });

  describe('createFolder', () => {
    it('should delegate to drive.createFolder', () => {
      const mockFolder = { getName: jest.fn(() => 'NewFolder') };
      mockDriveApp.createFolder.mockReturnValue(mockFolder);

      const result = adapter.createFolder('NewFolder');

      expect(mockDriveApp.createFolder).toHaveBeenCalledWith('NewFolder');
      expect(result).toBe(mockFolder);
    });
  });

  describe('getOrCreateFolder', () => {
    it('should return existing folder if found', () => {
      const mockFolder = { getName: jest.fn(() => 'Existing') };
      const mockRoot = {
        getFolders: jest.fn(() => ({
          hasNext: jest.fn(() => true),
          next: jest.fn(() => mockFolder),
        })),
      };
      mockDriveApp.getRootFolder.mockReturnValue(mockRoot);

      const result = adapter.getOrCreateFolder('Existing');

      expect(result).toBe(mockFolder);
    });

    it('should create folder if not found', () => {
      const mockFolder = { getName: jest.fn(() => 'New') };
      const mockRoot = {
        getFolders: jest.fn(() => ({
          hasNext: jest.fn(() => false),
        })),
        createFolder: jest.fn(() => mockFolder),
      };
      mockDriveApp.getRootFolder.mockReturnValue(mockRoot);

      const result = adapter.getOrCreateFolder('New');

      expect(mockRoot.createFolder).toHaveBeenCalledWith('New');
      expect(result).toBe(mockFolder);
    });
  });

  describe('writeTextFile', () => {
    it('should write content to an existing file', () => {
      const mockFile = { setContent: jest.fn(), getName: jest.fn(() => 'test.txt') };
      const mockSubFolder = {
        getFilesByName: jest.fn(() => ({
          hasNext: jest.fn(() => true),
          next: jest.fn(() => mockFile),
        })),
      };
      const mockFolder = {
        getFolders: jest.fn(() => ({ hasNext: jest.fn(() => false) })),
        createFolder: jest.fn(() => mockSubFolder),
      };
      mockDriveApp.getRootFolder.mockReturnValue(mockFolder);

      adapter.writeTextFile('MyFolder', 'test.txt', 'hello world');

      expect(mockFile.setContent).toHaveBeenCalledWith('hello world');
    });

    it('should create new file if it does not exist', () => {
      const mockSubFolder = {
        getFilesByName: jest.fn(() => ({
          hasNext: jest.fn(() => false),
        })),
        createFile: jest.fn(() => ({ getName: jest.fn(() => 'test.txt') })),
      };
      const mockFolder = {
        getFolders: jest.fn(() => ({ hasNext: jest.fn(() => false) })),
        createFolder: jest.fn(() => mockSubFolder),
      };
      mockDriveApp.getRootFolder.mockReturnValue(mockFolder);

      adapter.writeTextFile('MyFolder', 'test.txt', 'hello world');

      expect(mockSubFolder.createFile).toHaveBeenCalledWith('test.txt', 'hello world', 'text/plain');
    });
  });

  describe('getFoldersByName', () => {
    it('delegates to drive.getFoldersByName', () => {
      const iter = { hasNext: jest.fn(() => false) };
      mockDriveApp.getFoldersByName.mockReturnValue(iter);
      expect(adapter.getFoldersByName('Docs')).toBe(iter);
      expect(mockDriveApp.getFoldersByName).toHaveBeenCalledWith('Docs');
    });
  });

  describe('getOrCreateFolder with an explicit parent', () => {
    it('searches the given parent folder, not the root', () => {
      const child = { getName: () => 'Child' };
      const parent = {
        getFolders: jest.fn(() => ({
          hasNext: jest.fn().mockReturnValueOnce(true).mockReturnValue(false),
          next: jest.fn(() => child),
        })),
      };
      const result = adapter.getOrCreateFolder('Child', parent);
      expect(result).toBe(child);
      // Root folder must NOT be consulted when a parent is supplied.
      expect(mockDriveApp.getRootFolder).not.toHaveBeenCalled();
    });

    it('skips a non-matching folder then creates the requested one', () => {
      const other = { getName: () => 'Other' };
      const created = { getName: () => 'Wanted' };
      const parent = {
        getFolders: jest.fn(() => ({
          hasNext: jest.fn().mockReturnValueOnce(true).mockReturnValue(false),
          next: jest.fn(() => other),
        })),
        createFolder: jest.fn(() => created),
      };
      const result = adapter.getOrCreateFolder('Wanted', parent);
      expect(parent.createFolder).toHaveBeenCalledWith('Wanted');
      expect(result).toBe(created);
    });
  });

  describe('readTextFile', () => {
    it('reads a file blob as a string', () => {
      mockDriveApp.getFileById.mockReturnValue({
        getBlob: () => ({ getDataAsString: () => 'file contents' }),
      });
      expect(adapter.readTextFile('file-1')).toBe('file contents');
      expect(mockDriveApp.getFileById).toHaveBeenCalledWith('file-1');
    });
  });

  describe('searchFiles', () => {
    it('delegates to drive.searchFiles with the query', () => {
      const iter = { hasNext: jest.fn(() => false) };
      mockDriveApp.searchFiles = jest.fn(() => iter);
      expect(adapter.searchFiles('title contains "x"')).toBe(iter);
      expect(mockDriveApp.searchFiles).toHaveBeenCalledWith('title contains "x"');
    });
  });

  describe('getFilesInFolder', () => {
    it('collects all files via getFiles when no mimeType is given', () => {
      const f1 = { getName: () => 'a' };
      const f2 = { getName: () => 'b' };
      const folder = {
        getFiles: jest.fn(() => {
          let i = 0;
          const items = [f1, f2];
          return { hasNext: () => i < items.length, next: () => items[i++] };
        }),
        getFilesByType: jest.fn(),
      };
      const result = adapter.getFilesInFolder(folder);
      expect(result).toEqual([f1, f2]);
      expect(folder.getFilesByType).not.toHaveBeenCalled();
    });

    it('uses getFilesByType when a mimeType is given', () => {
      const f1 = { getName: () => 'doc' };
      const folder = {
        getFiles: jest.fn(),
        getFilesByType: jest.fn(() => {
          let i = 0;
          const items = [f1];
          return { hasNext: () => i < items.length, next: () => items[i++] };
        }),
      };
      const result = adapter.getFilesInFolder(folder, 'application/pdf');
      expect(folder.getFilesByType).toHaveBeenCalledWith('application/pdf');
      expect(result).toEqual([f1]);
    });
  });

  describe('listFolderFiles', () => {
    it('returns [] when the named folder does not exist', () => {
      mockDriveApp.getFoldersByName.mockReturnValue({ hasNext: jest.fn(() => false) });
      expect(adapter.listFolderFiles('Missing')).toEqual([]);
    });

    it('returns the files of the first matching folder', () => {
      const file = { getName: () => 'f' };
      const folder = {
        getFiles: jest.fn(() => {
          let done = false;
          return { hasNext: () => !done, next: () => { done = true; return file; } };
        }),
      };
      mockDriveApp.getFoldersByName.mockReturnValue({
        hasNext: jest.fn(() => true),
        next: jest.fn(() => folder),
      });
      expect(adapter.listFolderFiles('Docs')).toEqual([file]);
    });
  });

  describe('deleteFile', () => {
    it('trashes the given file', () => {
      const file = { setTrashed: jest.fn() };
      adapter.deleteFile(file);
      expect(file.setTrashed).toHaveBeenCalledWith(true);
    });
  });

  describe('getRootFolder', () => {
    it('delegates to drive.getRootFolder', () => {
      const root = { getName: () => 'root' };
      mockDriveApp.getRootFolder.mockReturnValue(root);
      expect(adapter.getRootFolder()).toBe(root);
    });
  });

  describe('default DriveApp dependency', () => {
    it('uses the global DriveApp when none is injected', () => {
      // setup.js provides a global DriveApp mock.
      const defaultAdapter = new DriveAdapter();
      const file = { getName: () => 'g' };
      DriveApp.getFileById = jest.fn(() => file);
      expect(defaultAdapter.getFileById('id')).toBe(file);
      expect(DriveApp.getFileById).toHaveBeenCalledWith('id');
    });
  });
});
