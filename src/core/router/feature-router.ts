import { Router, Request, Response, NextFunction } from 'express';
import {
  FeatureRouter,
  RouteDefinition,
  RouteHandler,
  APIResponse,
  createSuccessResponse,
  createErrorResponse
} from './types';

/**
 * Create an Express router from a feature router
 */
export function createExpressRouter(featureRouter: FeatureRouter): Router {
  const router = Router();
  const basePath = featureRouter.getBasePath();

  // If feature provides a custom router, use it
  if (featureRouter.getRouter) {
    return featureRouter.getRouter();
  }

  // Otherwise, register routes from definitions
  const routes = featureRouter.getRoutes();

  for (const route of routes) {
    const fullPath = basePath + route.path;
    const handlers: RouteHandler[] = [
      ...(route.middleware || []),
      wrapHandler(route.handler)
    ];

    router[route.method](route.path, ...handlers);
  }

  return router;
}

/**
 * Wrap a route handler to automatically handle async errors
 * and standardize responses
 */
function wrapHandler(handler: RouteHandler): RouteHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Send a standardized success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: { total?: number; page?: number; limit?: number }
): void {
  const response: APIResponse<T> = createSuccessResponse(data, meta);
  res.status(statusCode).json(response);
}

/**
 * Send a standardized error response
 */
export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 500,
  details?: unknown
): void {
  const response: APIResponse<null> = createErrorResponse(code, message, details);
  res.status(statusCode).json(response);
}

/**
 * Async handler wrapper for Express routes
 * Automatically catches async errors and passes them to next()
 */
export function asyncHandler(
  fn: RouteHandler
): RouteHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Combine multiple feature routers into a single Express router
 */
export function combineRouters(...featureRouters: FeatureRouter[]): Router {
  const combined = Router();

  for (const featureRouter of featureRouters) {
    const router = createExpressRouter(featureRouter);
    const basePath = featureRouter.getBasePath();
    combined.use(basePath, router);
  }

  return combined;
}
