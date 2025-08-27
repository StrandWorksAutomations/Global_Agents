import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { User } from '../models/index.js';
import CacheService from '../services/CacheService.js';

const cache = new CacheService();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

// Password hashing
export const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// JWT token generation
export const generateTokens = (userId, role) => {
  const payload = { userId, role };
  
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'opportunity-scanner',
    audience: 'opportunity-scanner-users'
  });
  
  const refreshToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: 'opportunity-scanner',
    audience: 'opportunity-scanner-refresh'
  });
  
  return { accessToken, refreshToken };
};

// Token verification middleware
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'TOKEN_MISSING'
    });
  }
  
  try {
    // Check if token is blacklisted
    const blacklisted = await cache.exists(`blacklist:${token}`);
    if (blacklisted) {
      return res.status(401).json({ 
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'opportunity-scanner',
      audience: 'opportunity-scanner-users'
    });
    
    // Get user from cache or database
    let user = await cache.get(`user:${decoded.userId}`);
    if (!user) {
      user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return res.status(401).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }
      await cache.set(`user:${decoded.userId}`, user, 300); // 5 min cache
    }
    
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(403).json({ 
      error: 'Invalid token',
      code: 'TOKEN_INVALID'
    });
  }
};

// Role-based authorization
export const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredRoles,
        current: userRoles
      });
    }
    
    next();
  };
};

// API key authentication
export const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  try {
    const user = await User.findOne({ apiKey }).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // Track API usage
    await User.findByIdAndUpdate(user._id, {
      $inc: { 'usage.apiCalls': 1 },
      $set: { 'usage.lastLogin': new Date() }
    });
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Rate limiting configurations
export const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    },
    skip: (req) => {
      // Skip rate limiting for admin users
      return req.user?.role === 'admin';
    }
  });
};

// Specific rate limits
export const loginRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  'Too many login attempts, please try again later'
);

export const apiRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // limit each user to 100 API requests per windowMs
  'Too many API requests, please try again later'
);

export const strictRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  10, // limit each user to 10 requests per minute
  'Rate limit exceeded'
);

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input validation middleware
export const validateInput = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }
    next();
  };
};

// CSRF protection
export const csrfProtection = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;
  
  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

// Blacklist token
export const blacklistToken = async (token) => {
  const decoded = jwt.decode(token);
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
  
  if (expiresIn > 0) {
    await cache.set(`blacklist:${token}`, true, expiresIn);
  }
};

// Logout handler
export const logout = async (req, res) => {
  try {
    // Blacklist the current token
    await blacklistToken(req.token);
    
    // Clear user cache
    await cache.del(`user:${req.user._id}`);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
};

// Password strength validation
export const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export default {
  hashPassword,
  comparePassword,
  generateTokens,
  authenticateToken,
  requireRole,
  authenticateApiKey,
  securityHeaders,
  loginRateLimit,
  apiRateLimit,
  strictRateLimit,
  validateInput,
  csrfProtection,
  blacklistToken,
  logout,
  validatePasswordStrength
};