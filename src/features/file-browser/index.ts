import { FeatureRouter } from '../../core/router';
import { FileBrowserService } from './service';
import { createFileBrowserRouter } from './api';

export * from './types';
export * from './service';
export * from './api';

/**
 * Create file browser feature
 */
export function createFileBrowserFeature(): {
  service: FileBrowserService;
  router: FeatureRouter;
} {
  const service = new FileBrowserService();

  const router: FeatureRouter = {
    getBasePath: () => '/api/fs',
    getRouter: () => createFileBrowserRouter(service),
    getRoutes: () => []
  };

  return { service, router };
}
