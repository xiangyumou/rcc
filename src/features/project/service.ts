import * as path from 'path';
import { RecentProject, RecentProjectsData, ProjectServiceConfig, ProjectError } from './types';
import { StorageAdapter, JSONStorageAdapter } from '../../core/storage';

const DEFAULT_MAX_PROJECTS = 10;
const STORAGE_KEY = 'recent-projects';

/**
 * Project Service
 * Manages recent projects list
 */
export class ProjectService {
  private storage: StorageAdapter<RecentProjectsData>;
  private maxProjects: number;

  constructor(config: ProjectServiceConfig) {
    this.storage = new JSONStorageAdapter<RecentProjectsData>({
      baseDir: config.dataDir
    });
    this.maxProjects = config.maxProjects ?? DEFAULT_MAX_PROJECTS;
  }

  /**
   * Load recent projects
   */
  async loadProjects(): Promise<RecentProject[]> {
    try {
      const data = await this.storage.read(STORAGE_KEY);
      return data?.projects ?? [];
    } catch (error) {
      throw new ProjectError(
        `Failed to load projects: ${(error as Error).message}`,
        'LOAD_ERROR'
      );
    }
  }

  /**
   * Add a project to recent list
   */
  async addProject(projectPath: string): Promise<RecentProject> {
    const projects = await this.loadProjects();
    const projectName = path.basename(projectPath);

    // Remove if already exists
    const existingIndex = projects.findIndex(p => p.path === projectPath);
    let openCount = 1;
    if (existingIndex !== -1) {
      openCount = (projects[existingIndex].openCount || 0) + 1;
      projects.splice(existingIndex, 1);
    }

    // Create new project entry
    const project: RecentProject = {
      path: projectPath,
      name: projectName,
      lastOpened: Date.now(),
      openCount
    };

    // Add to front
    projects.unshift(project);

    // Keep only max number
    if (projects.length > this.maxProjects) {
      projects.length = this.maxProjects;
    }

    // Save
    await this.saveProjects(projects);

    return project;
  }

  /**
   * Remove a project from recent list
   */
  async removeProject(projectPath: string): Promise<boolean> {
    const projects = await this.loadProjects();
    const initialLength = projects.length;

    const filtered = projects.filter(p => p.path !== projectPath);

    if (filtered.length !== initialLength) {
      await this.saveProjects(filtered);
      return true;
    }

    return false;
  }

  /**
   * Get a single project by path
   */
  async getProject(projectPath: string): Promise<RecentProject | null> {
    const projects = await this.loadProjects();
    return projects.find(p => p.path === projectPath) ?? null;
  }

  /**
   * Check if a project exists in recent list
   */
  async hasProject(projectPath: string): Promise<boolean> {
    const project = await this.getProject(projectPath);
    return project !== null;
  }

  /**
   * Save projects list
   */
  private async saveProjects(projects: RecentProject[]): Promise<void> {
    try {
      await this.storage.write(STORAGE_KEY, { projects });
    } catch (error) {
      throw new ProjectError(
        `Failed to save projects: ${(error as Error).message}`,
        'SAVE_ERROR'
      );
    }
  }
}
