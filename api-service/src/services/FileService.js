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
    // Try the specific format first: deviceId_timestamp.mp3
    const specificMatch = filename.match(/^([^_]+)_(\d+)\.(mp3|m4a)$/i);
    if (specificMatch) {
      const [, deviceUuid, timestamp] = specificMatch;
      return {
        deviceUuid,
        timestamp: parseInt(timestamp),
        timestampDate: new Date(parseInt(timestamp))
      };
    }

    // Fallback for regular filenames - generate a device UUID and use current time
    const { v4: uuidv4 } = require('uuid');
    const currentTime = Date.now();

    // Extract just the name without extension for device UUID
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const deviceUuid = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '') || 'default-device';

    return {
      deviceUuid: deviceUuid.substring(0, 20), // Limit length
      timestamp: currentTime,
      timestampDate: new Date(currentTime)
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
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'];
    const allowedExtensions = ['.mp3', '.m4a'];

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