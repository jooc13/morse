const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class FileService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.ensureUploadDir();
  }

  async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir);
    } catch (error) {
      await fs.mkdir(this.uploadDir, { recursive: true });
      console.log(`Created upload directory: ${this.uploadDir}`);
    }
  }

  parseFilename(filename) {
    const match = filename.match(/^([^_]+)_(\d+)\.(mp3|wav)$/);
    if (!match) {
      throw new Error('Invalid filename format. Expected: deviceId_timestamp.mp3');
    }

    const [, deviceUuid, timestamp] = match;
    return {
      deviceUuid,
      timestamp: parseInt(timestamp),
      timestampDate: new Date(parseInt(timestamp))
    };
  }

  async saveFile(file, originalFilename) {
    const fileId = uuidv4();
    const fileExtension = path.extname(originalFilename);
    const fileName = `${fileId}${fileExtension}`;
    const filePath = path.join(this.uploadDir, fileName);

    await fs.writeFile(filePath, file.buffer);

    return {
      fileId,
      fileName,
      filePath: path.resolve(filePath),
      fileSize: file.size
    };
  }

  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      console.log(`Deleted file: ${filePath}`);
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error.message);
    }
  }

  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      };
    } catch (error) {
      return { exists: false };
    }
  }

  validateFileType(file) {
    const allowedTypes = ['audio/mpeg', 'audio/mp3','audio/wav'];
    const allowedExtensions = ['.mp3','.wav'];
    
    const hasValidMimeType = allowedTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.includes(
      path.extname(file.originalname).toLowerCase()
    );

    return hasValidMimeType || hasValidExtension;
  }

  validateFileSize(file, maxSizeMB = 50) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }
}

module.exports = new FileService();