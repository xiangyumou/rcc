import { Router, Request, Response, NextFunction } from 'express';

/**
 * Route definition
 */
export interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  handler: RouteHandler;
  middleware?: RouteMiddleware[];
}

/**
 * Route handler function
 */
export type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Route middleware function
 */
export type RouteMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Feature router interface
 * Each feature module implements this to register its routes
 */
export interface FeatureRouter {
  /** Get the base path for this feature's routes */
  getBasePath(): string;

  /** Get all route definitions */
  getRoutes(): RouteDefinition[];

  /** Get the Express router (optional, for custom route setup) */
  getRouter?(): Router;
}

/**
 * API response envelope
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: APIError | null;
  meta?: APIMeta;
}

/**
 * API error structure
 */
export interface APIError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * API metadata for paginated responses
 */
export interface APIMeta {
  total?: number;
  page?: number;
  limit?: number;
}

/**
 * Create a success response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: APIMeta
): APIResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown
): APIResponse<null> {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details
    }
  };
}
