/**
 * DriveAdapter Tests
 */

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
      mockDriveApp.getRootFolder.mockReturnValue({
        getFolders: jest.fn(() => ({
          hasNext: jest.fn(() => true),
          next: jest.fn(() => mockFolder),
        })),
      });

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
      const mockFolder = {
        getFilesByName: jest.fn(() => ({
          hasNext: jest.fn(() => true),
          next: jest.fn(() => mockFile),
        })),
      };
      mockDriveApp.getRootFolder.mockReturnValue(mockFolder);

      adapter.writeTextFile('MyFolder', 'test.txt', 'hello world');

      expect(mockFile.setContent).toHaveBeenCalledWith('hello world');
    });

    it('should create new file if it does not exist', () => {
      const mockFolder = {
        getFilesByName: jest.fn(() => ({
          hasNext: jest.fn(() => false),
        })),
        createFile: jest.fn(() => ({ getName: jest.fn(() => 'test.txt') })),
      };
      mockDriveApp.getRootFolder.mockReturnValue(mockFolder);

      adapter.writeTextFile('MyFolder', 'test.txt', 'hello world');

      expect(mockFolder.createFile).toHaveBeenCalledWith('test.txt', 'hello world', 'text/plain');
    });
  });
});
