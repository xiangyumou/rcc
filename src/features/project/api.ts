import { Router, Request, Response } from 'express';
import { ProjectService } from './service';
import { AddProjectRequest } from './types';
import { sendSuccess, sendError, asyncHandler } from '../../core/router';

/**
 * Create project API router
 */
export function createProjectRouter(projectService: ProjectService): Router {
  const router = Router();

  /**
   * GET /api/recent-projects - List all recent projects
   */
  router.get(
    '/',
    asyncHandler(async (_req: Request, res: Response) => {
      const projects = await projectService.loadProjects();
      sendSuccess(res, projects);
    })
  );

  /**
   * POST /api/recent-projects - Add a project
   */
  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const { path: projectPath }: AddProjectRequest = req.body;

      if (!projectPath) {
        sendError(res, 'BAD_REQUEST', 'Project path is required', 400);
        return;
      }

      const project = await projectService.addProject(projectPath);
      sendSuccess(res, project, 201);
    })
  );

  /**
   * DELETE /api/recent-projects/:projectPath - Remove a project
   */
  router.delete(
    '/:projectPath(*)',
    asyncHandler(async (req: Request, res: Response) => {
      const projectPath = req.params.projectPath;
      const removed = await projectService.removeProject(projectPath);

      if (!removed) {
        sendError(res, 'NOT_FOUND', 'Project not found', 404);
        return;
      }

      sendSuccess(res, { success: true });
    })
  );

  return router;
}
