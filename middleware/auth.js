import jwt from 'jsonwebtoken';
import { User, VIPEndpoint } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dongtube-secret-key-change-in-production-2025';
const JWT_EXPIRES = '7d';

export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
};

export const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'role', 'lastLogin']
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.',
        requiredRoles: allowedRoles,
        yourRole: req.user.role
      });
    }

    next();
  };
};

let vipEndpointsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000;

export const checkVIPAccess = async (req, res, next) => {
  try {
    const currentTime = Date.now();
    
    if (!vipEndpointsCache || (currentTime - cacheTimestamp) > CACHE_DURATION) {
      vipEndpointsCache = await VIPEndpoint.findAll({
        where: { requiresVIP: true },
        attributes: ['path']
      });
      cacheTimestamp = currentTime;
    }

    const requestPath = req.path;
    const isVIPEndpoint = vipEndpointsCache.some(endpoint => 
      requestPath.startsWith(endpoint.path)
    );

    if (!isVIPEndpoint) {
      return next();
    }

    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'This endpoint requires VIP access. Please login.',
        vipRequired: true
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'role']
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.role !== 'vip' && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'This endpoint requires VIP membership',
        vipRequired: true,
        upgradeUrl: '/upgrade-to-vip'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token. Please login again.',
        vipRequired: true
      });
    }
    next();
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findByPk(decoded.id, {
        attributes: ['id', 'email', 'role']
      });
      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
  }
  next();
};

export const refreshVIPCache = () => {
  vipEndpointsCache = null;
  cacheTimestamp = 0;
};
