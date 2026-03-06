/**
 * Recent project information
 */
export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
  openCount: number;
}

/**
 * Recent projects data storage format
 */
export interface RecentProjectsData {
  projects: RecentProject[];
}

/**
 * Add project request
 */
export interface AddProjectRequest {
  path: string;
}

/**
 * Project service configuration
 */
export interface ProjectServiceConfig {
  dataDir: string;
  maxProjects?: number;
}

/**
 * Project error
 */
export class ProjectError extends Error {
  constructor(
    message: string,
    public readonly code: 'LOAD_ERROR' | 'SAVE_ERROR' | 'INVALID_PATH'
  ) {
    super(message);
    this.name = 'ProjectError';
  }
}
