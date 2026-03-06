import { Router, Request, Response } from 'express';
import { SessionManager } from './manager';
import {
  CreateSessionRequest,
  CreateSessionResponse,
  SessionError
} from './types';
import { sendSuccess, sendError, asyncHandler } from '../../core/router';

/**
 * Create session API router
 */
export function createSessionRouter(sessionManager: SessionManager): Router {
  const router = Router();

  /**
   * GET /api/sessions - List all sessions
   */
  router.get(
    '/',
    asyncHandler(async (_req: Request, res: Response) => {
      const sessions = await sessionManager.getAllSessions();
      sendSuccess(res, sessions);
    })
  );

  /**
   * POST /api/sessions - Create new session
   */
  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const { projectPath, claudeOptions = [] }: CreateSessionRequest = req.body;

      if (!projectPath) {
        sendError(res, 'BAD_REQUEST', 'Project path is required', 400);
        return;
      }

      const sessionWithPTY = await sessionManager.createSession(
        projectPath,
        claudeOptions
      );

      const response: CreateSessionResponse = {
        session: sessionWithPTY.session,
        wsUrl: `/ws?sessionId=${sessionWithPTY.session.id}`
      };

      sendSuccess(res, response, 201);
    })
  );

  /**
   * GET /api/sessions/:sessionId - Get session details
   */
  router.get(
    '/:sessionId',
    asyncHandler(async (req: Request, res: Response) => {
      const { sessionId } = req.params;
      const sessionWithPTY = await sessionManager.getSession(sessionId);

      if (!sessionWithPTY) {
        sendError(res, 'NOT_FOUND', 'Session not found', 404);
        return;
      }

      sendSuccess(res, sessionWithPTY.session);
    })
  );

  /**
   * DELETE /api/sessions/:sessionId - Terminate session
   */
  router.delete(
    '/:sessionId',
    asyncHandler(async (req: Request, res: Response) => {
      const { sessionId } = req.params;
      const terminated = await sessionManager.terminateSession(sessionId);

      if (!terminated) {
        sendError(res, 'NOT_FOUND', 'Session not found', 404);
        return;
      }

      sendSuccess(res, { success: true });
    })
  );

  /**
   * POST /api/sessions/:sessionId/reconnect - Reconnect to session
   */
  router.post(
    '/:sessionId/reconnect',
    asyncHandler(async (req: Request, res: Response) => {
      const { sessionId } = req.params;
      const sessionWithPTY = await sessionManager.reconnectSession(sessionId);

      if (!sessionWithPTY) {
        sendError(res, 'NOT_FOUND', 'Session not found or cannot be reconnected', 404);
        return;
      }

      const response: CreateSessionResponse = {
        session: sessionWithPTY.session,
        wsUrl: `/ws?sessionId=${sessionWithPTY.session.id}`
      };

      sendSuccess(res, response);
    })
  );

  return router;
}
