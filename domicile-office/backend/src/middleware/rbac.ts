import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authenticateToken.js';

/**
 * Normalizes department string for consistent comparison.
 */
export function normalizeDept(dept?: string): string {
  if (!dept || typeof dept !== 'string') return '';
  return dept.trim().toLowerCase().replace(/_/g, '-');
}

/**
 * Enforces role-based access control.
 * Requires authenticateToken middleware to have run previously.
 */
export function requireRole(...roles: (string | string[])[]) {
  const allowedRoles = roles.flat();
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required. No user principal attached.'
      });
      return;
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Access denied. Role "${authReq.user.role}" does not have permission for this resource.`
      });
      return;
    }

    next();
  };
}

/**
 * Enforces department boundary authorization.
 * Requires authenticateToken middleware to have run previously.
 */
export function requireDepartment(...departments: (string | string[])[]) {
  const allowedDepts = departments.flat().map(normalizeDept);
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required. No user principal attached.'
      });
      return;
    }

    const userDept = normalizeDept(authReq.user.dept);
    if (!allowedDepts.includes(userDept)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Access denied. Department "${authReq.user.dept}" is not authorized for this resource.`
      });
      return;
    }

    next();
  };
}
