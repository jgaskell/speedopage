/**
 * Authentication Middleware for SpeedoPage
 *
 * Provides JWT-based authentication and authorization
 */

const jwt = require('jsonwebtoken');

// JWT secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'speedopage-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate JWT token for a user
 */
function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    displayName: user.displayName
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from request
 * Supports:
 * - Authorization header: "Bearer <token>"
 * - Cookie: "token=<token>"
 * - Query param: "?token=<token>"
 */
function extractToken(req) {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  // Try query param (for share links)
  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
}

/**
 * Middleware: Require authentication
 * Use this on routes that require a logged-in user
 */
function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NO_TOKEN'
    });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }

  // Attach user info to request
  req.user = decoded;
  next();
}

/**
 * Middleware: Optional authentication
 * Attaches user info if token is valid, but doesn't require it
 * Useful for routes that work for both logged-in and anonymous users
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }

  next();
}

/**
 * Middleware: Check if user owns the resource
 * Use after requireAuth to ensure user can only access their own data
 */
function requireOwnership(resourceUserIdParam = 'userId') {
  return (req, res, next) => {
    const resourceUserId = parseInt(req.params[resourceUserIdParam]);
    const currentUserId = req.user.userId;

    if (resourceUserId !== currentUserId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN'
      });
    }

    next();
  };
}

module.exports = {
  generateToken,
  verifyToken,
  extractToken,
  requireAuth,
  optionalAuth,
  requireOwnership,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
