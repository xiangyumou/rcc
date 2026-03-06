/**
 * Storage Adapter Interface
 * Abstracts storage operations for any backend (file, database, memory, etc.)
 */
export interface StorageAdapter<T> {
  /** Read value by key, returns null if not found */
  read(key: string): Promise<T | null>;

  /** Write value to key */
  write(key: string, value: T): Promise<void>;

  /** Delete value by key */
  delete(key: string): Promise<void>;

  /** List all keys */
  list(): Promise<string[]>;
}

/**
 * Storage configuration options
 */
export interface StorageConfig {
  /** Base directory for file-based storage */
  baseDir: string;

  /** File extension for stored files */
  extension?: string;
}

/**
 * Storage error types
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: 'READ_ERROR' | 'WRITE_ERROR' | 'DELETE_ERROR' | 'LIST_ERROR'
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
