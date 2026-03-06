import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSONStorageAdapter } from '../../../src/core/storage/json-storage';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MockStorage } from '../../mocks/storage';

describe('Storage', () => {
  describe('JSONStorageAdapter', () => {
    let tempDir: string;
    let storage: JSONStorageAdapter<{ name: string; value: number }>;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'storage-test-'));
      storage = new JSONStorageAdapter({ baseDir: tempDir });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true });
    });

    it('should write and read data', async () => {
      const data = { name: 'test', value: 123 };
      await storage.write('test-key', data);
      const result = await storage.read('test-key');
      expect(result).toEqual(data);
    });

    it('should return null for non-existent key', async () => {
      const result = await storage.read('non-existent');
      expect(result).toBeNull();
    });

    it('should delete data', async () => {
      await storage.write('key', { name: 'test', value: 1 });
      await storage.delete('key');
      const result = await storage.read('key');
      expect(result).toBeNull();
    });

    it('should list all keys', async () => {
      await storage.write('key1', { name: 'a', value: 1 });
      await storage.write('key2', { name: 'b', value: 2 });
      const keys = await storage.list();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should sanitize keys with special characters', async () => {
      const data = { name: 'test', value: 1 };
      await storage.write('key/with/slashes', data);
      const result = await storage.read('key/with/slashes');
      expect(result).toEqual(data);
    });

    it('should update existing key', async () => {
      await storage.write('key', { name: 'old', value: 1 });
      await storage.write('key', { name: 'new', value: 2 });
      const result = await storage.read('key');
      expect(result).toEqual({ name: 'new', value: 2 });
    });
  });

  describe('MockStorage', () => {
    let storage: MockStorage<{ data: string }>;

    beforeEach(() => {
      storage = new MockStorage();
    });

    it('should store and retrieve data', async () => {
      await storage.write('key', { data: 'value' });
      const result = await storage.read('key');
      expect(result).toEqual({ data: 'value' });
    });

    it('should return null for missing key', async () => {
      const result = await storage.read('missing');
      expect(result).toBeNull();
    });

    it('should delete data', async () => {
      await storage.write('key', { data: 'value' });
      await storage.delete('key');
      expect(await storage.read('key')).toBeNull();
    });

    it('should list all keys', async () => {
      await storage.write('a', { data: '1' });
      await storage.write('b', { data: '2' });
      const keys = await storage.list();
      expect(keys).toHaveLength(2);
      expect(keys).toContain('a');
      expect(keys).toContain('b');
    });

    it('should simulate read failure', async () => {
      storage.setFailOnRead(true);
      await expect(storage.read('key')).rejects.toThrow('Mock read error');
    });

    it('should simulate write failure', async () => {
      storage.setFailOnWrite(true);
      await expect(storage.write('key', { data: 'value' })).rejects.toThrow('Mock write error');
    });

    it('should clear all data', async () => {
      await storage.write('key', { data: 'value' });
      storage.clear();
      const keys = await storage.list();
      expect(keys).toHaveLength(0);
    });
  });
});
