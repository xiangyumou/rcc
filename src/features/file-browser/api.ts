import { Router, Request, Response } from 'express';
import { FileBrowserService } from './service';
import { sendSuccess, sendError, asyncHandler } from '../../core/router';

/**
 * Create file browser API router
 */
export function createFileBrowserRouter(fileBrowserService: FileBrowserService): Router {
  const router = Router();

  /**
   * GET /api/fs/home - Get home directory
   */
  router.get(
    '/home',
    asyncHandler(async (_req: Request, res: Response) => {
      const homePath = await fileBrowserService.getHomeDirectory();
      sendSuccess(res, { path: homePath });
    })
  );

  /**
   * GET /api/fs/list - List directory contents
   */
  router.get(
    '/list',
    asyncHandler(async (req: Request, res: Response) => {
      const dirPath = req.query.path as string;

      if (!dirPath) {
        sendError(res, 'BAD_REQUEST', 'Path is required', 400);
        return;
      }

      // Security: prevent directory traversal
      if (dirPath.includes('..')) {
        sendError(res, 'BAD_REQUEST', 'Invalid path', 400);
        return;
      }

      const listing = await fileBrowserService.listDirectory(dirPath);
      sendSuccess(res, listing);
    })
  );

  /**
   * GET /api/fs/quick-access - Get quick access directories
   */
  router.get(
    '/quick-access',
    asyncHandler(async (_req: Request, res: Response) => {
      const dirs = await fileBrowserService.getQuickAccessDirs();
      sendSuccess(res, dirs);
    })
  );

  /**
   * GET /api/fs/validate - Validate if path is a directory
   */
  router.get(
    '/validate',
    asyncHandler(async (req: Request, res: Response) => {
      const dirPath = req.query.path as string;

      if (!dirPath) {
        sendError(res, 'BAD_REQUEST', 'Path is required', 400);
        return;
      }

      const isValid = await fileBrowserService.validateDirectory(dirPath);
      sendSuccess(res, { valid: isValid, path: dirPath });
    })
  );

  return router;
}
