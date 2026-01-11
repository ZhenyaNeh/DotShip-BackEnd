import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { createClient } from 'webdav';
import type { WebDAVClient } from 'webdav/dist/node/types';

import { MulterFile } from './interfaces/multer-file.interface';
import { UploadFileResult } from './interfaces/upload-file-result.interface';
import {
  WebDAVFileStat,
  WebDAVResponse,
} from './interfaces/webdav-response.interface';

@Injectable()
export class YandexDiskService {
  private client!: WebDAVClient;
  private baseUrl: string = undefined;

  constructor(private configService: ConfigService) {
    this.client = this.initializeClient();
  }

  private initializeClient(): WebDAVClient {
    this.baseUrl = this.configService.getOrThrow<string>('WEB_DAV_URL');

    const username = this.configService.getOrThrow<string>(
      'YANDEX_DISK_USERNAME'
    );
    const password = this.configService.getOrThrow<string>(
      'YANDEX_DISK_PASSWORD'
    );

    if (!username || !password) {
      throw new Error('Missing Yandex Disk credentials');
    }

    return createClient(this.baseUrl, { username, password });
  }

  async uploadUserAvatar(
    id: string,
    file: MulterFile,
    category = 'avatars'
  ): Promise<UploadFileResult> {
    if (!this.client) {
      throw new Error('Yandex Disk client is not initialized');
    }
    try {
      this.validateFile(file);

      const fileExtension = this.getFileExtension(file.originalname);
      const filename = this.generateFilename(id, fileExtension);
      const remotePath = `/${category}/${filename}.${fileExtension}`;
      const existFile = await this.fileExists(remotePath);

      if (existFile) {
        await this.cleanupOldUserFiles(id, category);
      }

      await this.client.putFileContents(remotePath, file.buffer, {
        overwrite: true,
        contentLength: file.size,
      });

      return {
        url: `${this.baseUrl}${remotePath}`,
        path: remotePath,
        filename,
        size: file.size,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to upload file: ${error.message}`);
      } else {
        throw new Error('Failed to upload file: Unknown error occurred');
      }
    }
  }

  /**
   * Получение файла как stream
   */
  async streamFile(filename: string, res: Response, category = 'avatars') {
    try {
      const remotePath = `/${category}/${filename}`;

      await this.checkFileExists(remotePath);

      this.validateFileType(filename);

      const readStream = this.client.createReadStream(remotePath);

      this.setResponseHeaders(filename, res);

      readStream.pipe(res);

      readStream.on('error', error => {
        console.error(`Stream error for ${remotePath}:`, error);
        if (!res.headersSent) {
          res.status(500).send('Error reading file');
        }
      });
    } catch (error) {
      console.error('Error in getPhoto:', error);
      if (!res.headersSent && error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).send('File not found');
        } else {
          res.status(500).send('Internal server error');
        }
      }
    }
  }

  /**
   * Удаление файла
   */
  async deleteFile(remotePath: string): Promise<void> {
    try {
      await this.client.deleteFile(remotePath);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete file: ${error.message}`);
      } else {
        throw new Error('Failed to delete file: Unknown error occurred');
      }
    }
  }

  /**
   * Получение публичного URL файла
   */
  getFileUrl(remotePath: string): string {
    return `${this.baseUrl}${remotePath}`;
  }

  /**
   * Проверка существования файла
   */
  async fileExists(remotePath: string): Promise<boolean> {
    try {
      await this.client.stat(remotePath);
      return true;
    } catch {
      return false;
    }
  }

  private validateFile(file: MulterFile): void {
    if (!file?.buffer || file.size === 0) {
      throw new Error('File buffer is empty or file size is zero');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 10MB limit');
    }
  }

  private getFileExtension(originalname: string): string {
    const extension = originalname.includes('.')
      ? originalname.split('.').pop().toLowerCase()
      : 'jpg';

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    if (!allowedExtensions.includes(extension)) {
      throw new Error(`File extension ${extension} is not allowed`);
    }

    return extension === 'jpeg' ? 'jpg' : extension;
  }

  private generateFilename(userId: string, extension: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${userId}-${timestamp}-${random}.${extension}`;
  }

  private async cleanupOldUserFiles(
    userId: string,
    category: string
  ): Promise<void> {
    try {
      const files: WebDAVResponse = await this.client.getDirectoryContents(
        `/${category}`
      );
      const userFiles: WebDAVFileStat[] = this.filterUserFiles(files, userId);

      for (const file of userFiles) {
        await this.deleteFile(file.filename);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to cleanup file: ${error.message}`);
      } else {
        throw new Error('Failed to cleanup file: Unknown error occurred');
      }
    }
  }

  private filterUserFiles(
    files: WebDAVResponse,
    userId: string
  ): WebDAVFileStat[] {
    const fileList: WebDAVFileStat[] = Array.isArray(files)
      ? files
      : files.data || [];

    return fileList.filter((item: WebDAVFileStat) => {
      return item.basename.startsWith(`${userId}-`) && item.type === 'file';
    });
  }

  private async checkFileExists(remotePath: string): Promise<void> {
    const exists = await this.fileExists(remotePath);
    if (!exists) {
      throw new Error('File not found');
    }
  }

  private validateFileType(filename: string): void {
    const extension = filename.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    if (!extension || !allowedExtensions.includes(extension)) {
      throw new Error('Invalid file type');
    }
  }

  private setResponseHeaders(filename: string, res: Response): void {
    const extension = filename.split('.').pop()?.toLowerCase();
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };

    res.set({
      'Content-Type': mimeTypes[extension] || 'image/jpeg',
      'Cache-Control': 'public, max-age=604800, immutable', // 1 неделя
      'Content-Disposition': `inline; filename="${filename}"`,
    });
  }
}
