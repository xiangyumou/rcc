import { StorageAdapter, StorageError } from '../../src/core/storage/types';

/**
 * Mock storage implementation for testing
 */
export class MockStorage<T> implements StorageAdapter<T> {
  private data = new Map<string, T>();
  private shouldFailOnRead = false;
  private shouldFailOnWrite = false;

  /**
   * Enable read failure simulation
   */
  setFailOnRead(fail: boolean): void {
    this.shouldFailOnRead = fail;
  }

  /**
   * Enable write failure simulation
   */
  setFailOnWrite(fail: boolean): void {
    this.shouldFailOnWrite = fail;
  }

  async read(key: string): Promise<T | null> {
    if (this.shouldFailOnRead) {
      throw new StorageError('Mock read error', 'READ_ERROR');
    }
    return this.data.get(key) ?? null;
  }

  async write(key: string, value: T): Promise<void> {
    if (this.shouldFailOnWrite) {
      throw new StorageError('Mock write error', 'WRITE_ERROR');
    }
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(): Promise<string[]> {
    return Array.from(this.data.keys());
  }

  /**
   * Get all stored data (for assertions)
   */
  getAll(): Map<string, T> {
    return new Map(this.data);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Get stored value directly (for assertions)
   */
  getDirect(key: string): T | undefined {
    return this.data.get(key);
  }
}

/**
 * Create a fresh mock storage instance
 */
export function createMockStorage<T>(): MockStorage<T> {
  return new MockStorage<T>();
}
