import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageAdapter, StorageConfig, StorageError } from './types';

/**
 * JSON file-based storage implementation
 * Stores each value as a separate JSON file
 */
export class JSONStorageAdapter<T> implements StorageAdapter<T> {
  private readonly extension: string;

  constructor(private readonly config: StorageConfig) {
    this.extension = config.extension ?? '.json';
  }

  /**
   * Ensure the base directory exists
   */
  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.baseDir, { recursive: true });
    } catch (error) {
      throw new StorageError(
        `Failed to create storage directory: ${this.config.baseDir}`,
        'WRITE_ERROR'
      );
    }
  }

  /**
   * Get full file path for a key
   */
  private getFilePath(key: string): string {
    // Sanitize key to prevent directory traversal
    const sanitizedKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.config.baseDir, `${sanitizedKey}${this.extension}`);
  }

  async read(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new StorageError(
        `Failed to read key "${key}": ${(error as Error).message}`,
        'READ_ERROR'
      );
    }
  }

  async write(key: string, value: T): Promise<void> {
    await this.ensureDir();
    const filePath = this.getFilePath(key);

    try {
      const data = JSON.stringify(value, null, 2);
      await fs.writeFile(filePath, data, 'utf-8');
    } catch (error) {
      throw new StorageError(
        `Failed to write key "${key}": ${(error as Error).message}`,
        'WRITE_ERROR'
      );
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new StorageError(
          `Failed to delete key "${key}": ${(error as Error).message}`,
          'DELETE_ERROR'
        );
      }
    }
  }

  async list(): Promise<string[]> {
    try {
      await this.ensureDir();
      const files = await fs.readdir(this.config.baseDir);
      return files
        .filter(f => f.endsWith(this.extension))
        .map(f => f.slice(0, -this.extension.length));
    } catch (error) {
      throw new StorageError(
        `Failed to list keys: ${(error as Error).message}`,
        'LIST_ERROR'
      );
    }
  }
}
