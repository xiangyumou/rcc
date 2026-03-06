import * as path from 'path';
import { FeatureRouter } from '../../core/router';
import { ProjectService } from './service';
import { createProjectRouter } from './api';

export * from './types';
export * from './service';
export * from './api';

const PROJECTS_DIR = path.join(process.cwd(), 'data');

/**
 * Create project feature
 */
export function createProjectFeature(): {
  service: ProjectService;
  router: FeatureRouter;
} {
  const service = new ProjectService({
    dataDir: PROJECTS_DIR,
    maxProjects: 10
  });

  const router: FeatureRouter = {
    getBasePath: () => '/api/recent-projects',
    getRouter: () => createProjectRouter(service),
    getRoutes: () => []
  };

  return { service, router };
}
