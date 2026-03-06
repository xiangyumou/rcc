import * as fs from 'fs/promises';
import * as path from 'path';
import { FileItem, DirectoryListing, QuickAccessDir, FileBrowserError } from './types';

/**
 * File Browser Service
 * Handles directory listing and file system operations
 */
export class FileBrowserService {
  /**
   * List directory contents
   */
  async listDirectory(dirPath: string): Promise<DirectoryListing> {
    // Resolve to absolute path
    const absolutePath = path.resolve(dirPath);

    // Check if path exists
    let stats;
    try {
      stats = await fs.stat(absolutePath);
    } catch (error) {
      throw new FileBrowserError(
        `Path does not exist: ${absolutePath}`,
        'PATH_NOT_FOUND'
      );
    }

    if (!stats.isDirectory()) {
      throw new FileBrowserError(
        `Path is not a directory: ${absolutePath}`,
        'NOT_DIRECTORY'
      );
    }

    // Check if we can read the directory
    try {
      await fs.access(absolutePath, fs.constants.R_OK | fs.constants.X_OK);
    } catch {
      throw new FileBrowserError(
        `Permission denied: ${absolutePath}`,
        'PERMISSION_DENIED'
      );
    }

    // Get parent path
    const parentPath = path.dirname(absolutePath);
    const hasParent = parentPath !== absolutePath;

    // Read directory
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });

    // Map to file items
    const items: FileItem[] = [];

    for (const entry of entries) {
      // Skip hidden files
      if (entry.name.startsWith('.')) {
        continue;
      }

      const itemPath = path.join(absolutePath, entry.name);

      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          path: itemPath,
          type: 'directory'
        });
      } else if (entry.isFile()) {
        try {
          const fileStats = await fs.stat(itemPath);
          items.push({
            name: entry.name,
            path: itemPath,
            type: 'file',
            size: fileStats.size,
            modifiedAt: fileStats.mtime.getTime()
          });
        } catch {
          // Skip files we can't stat
        }
      }
    }

    // Sort: directories first, then by name
    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      currentPath: absolutePath,
      parentPath: hasParent ? parentPath : null,
      items
    };
  }

  /**
   * Get home directory
   */
  async getHomeDirectory(): Promise<string> {
    const candidates = [
      process.env.HOME,
      process.env.USERPROFILE,
      '/tmp'
    ];

    for (const dir of candidates) {
      if (dir) {
        try {
          const stats = await fs.stat(dir);
          if (stats.isDirectory()) {
            return dir;
          }
        } catch {
          // Continue to next candidate
        }
      }
    }

    return '/';
  }

  /**
   * Validate if path is a valid directory
   */
  async validateDirectory(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get quick access directories
   */
  async getQuickAccessDirs(): Promise<QuickAccessDir[]> {
    const home = await this.getHomeDirectory();
    const dirs: QuickAccessDir[] = [
      { name: 'Home', path: home },
      { name: 'Root', path: '/' }
    ];

    // Add common dev directories if they exist
    const commonDirs = ['Projects', 'project', 'workspace', 'Workspace', 'dev', 'code'];
    for (const dir of commonDirs) {
      const dirPath = path.join(home, dir);
      dirs.push({ name: dir, path: dirPath });
    }

    // Filter to only existing directories
    const existingDirs: QuickAccessDir[] = [];
    for (const dir of dirs) {
      const exists = await this.validateDirectory(dir.path);
      if (exists) {
        existingDirs.push(dir);
      }
    }

    return existingDirs;
  }
}
