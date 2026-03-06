import { Router, Request, Response } from 'express';
import * as path from 'path';
import { FeatureRouter } from '../../core/router';
import { CommandRegistry } from './registry';
import { sendSuccess, sendError, asyncHandler } from '../../core/router';

export * from './types';
export * from './registry';

const COMMANDS_DIR = path.join(process.cwd(), 'data');

/**
 * Create command registry router
 */
export function createCommandRouter(registry: CommandRegistry): Router {
  const router = Router();

  /**
   * GET /api/commands - Get all commands
   */
  router.get(
    '/',
    asyncHandler(async (_req: Request, res: Response) => {
      const commands = registry.getAllCommands();
      sendSuccess(res, commands);
    })
  );

  /**
   * GET /api/commands/builtin - Get built-in commands
   */
  router.get(
    '/builtin',
    asyncHandler(async (_req: Request, res: Response) => {
      const commands = registry.getBuiltinCommands();
      sendSuccess(res, commands);
    })
  );

  /**
   * GET /api/commands/custom - Get custom commands
   */
  router.get(
    '/custom',
    asyncHandler(async (_req: Request, res: Response) => {
      const commands = registry.getCustomCommands();
      sendSuccess(res, commands);
    })
  );

  /**
   * POST /api/commands/custom - Add custom command
   */
  router.post(
    '/custom',
    asyncHandler(async (req: Request, res: Response) => {
      const { label, text } = req.body;

      if (!label || !text) {
        sendError(res, 'BAD_REQUEST', 'Label and text are required', 400);
        return;
      }

      const command = await registry.addCustomCommand({ label, text });
      sendSuccess(res, command, 201);
    })
  );

  /**
   * DELETE /api/commands/custom/:id - Remove custom command
   */
  router.delete(
    '/custom/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const removed = await registry.removeCustomCommand(id);

      if (!removed) {
        sendError(res, 'NOT_FOUND', 'Command not found', 404);
        return;
      }

      sendSuccess(res, { success: true });
    })
  );

  return router;
}

/**
 * Create commands feature
 */
export function createCommandsFeature(): {
  registry: CommandRegistry;
  router: FeatureRouter;
} {
  const registry = new CommandRegistry(COMMANDS_DIR);

  const router: FeatureRouter = {
    getBasePath: () => '/api/commands',
    getRouter: () => createCommandRouter(registry),
    getRoutes: () => []
  };

  return { registry, router };
}
