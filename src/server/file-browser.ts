import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: number;
}

export interface DirectoryListing {
  currentPath: string;
  parentPath: string | null;
  items: FileItem[];
}

/**
 * List directory contents
 */
export async function listDirectory(dirPath: string): Promise<DirectoryListing> {
  // Resolve to absolute path
  const absolutePath = path.resolve(dirPath);

  // Check if path exists
  let stats;
  try {
    stats = await fs.stat(absolutePath);
  } catch (error) {
    throw new Error(`Path does not exist: ${absolutePath}`);
  }

  if (!stats.isDirectory()) {
    throw new Error('Path is not a directory');
  }

  // Check if we can read the directory
  try {
    await fs.access(absolutePath, fs.constants.R_OK | fs.constants.X_OK);
  } catch {
    throw new Error(`Permission denied: ${absolutePath}`);
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
export async function getHomeDirectory(): Promise<string> {
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
 * Validate if path is a valid project directory
 */
export async function validateProjectDir(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get common starting directories
 */
export async function getQuickAccessDirs(): Promise<{ name: string; path: string }[]> {
  const home = await getHomeDirectory();
  const dirs = [
    { name: 'Home', path: home },
    { name: 'Root', path: '/' }
  ];

  // Add common dev directories if they exist
  const commonDirs = ['Projects', 'project', 'workspace', 'Workspace', 'dev', 'code'];
  for (const dir of commonDirs) {
    dirs.push({ name: dir, path: path.join(home, dir) });
  }

  return dirs;
}
