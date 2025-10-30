import jwt from 'jsonwebtoken';
import { User, VIPEndpoint } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET;
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
      attributes: ['id', 'email', 'role', 'vipExpiresAt', 'lastLogin']
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
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.id, {
          attributes: ['id', 'email', 'role', 'vipExpiresAt']
        });
        
        if (user && user.role === 'admin') {
          req.user = user;
          return next();
        }
      } catch (err) {
      }
    }
    
    const currentTime = Date.now();
    
    if (!vipEndpointsCache || (currentTime - cacheTimestamp) > CACHE_DURATION) {
      vipEndpointsCache = await VIPEndpoint.findAll({
        where: { requiresVIP: true },
        attributes: ['path', 'method', 'name', 'description']
      });
      cacheTimestamp = currentTime;
    }

    const requestPath = req.path;
    const requestMethod = req.method;
    
    const vipEndpoint = vipEndpointsCache.find(endpoint => {
      const endpointPath = endpoint.path;
      
      let pathMatches = false;
      if (requestPath === endpointPath) {
        pathMatches = true;
      } else if (requestPath.startsWith(endpointPath)) {
        const charAfterPath = requestPath[endpointPath.length];
        if (charAfterPath === '/' || charAfterPath === '?') {
          pathMatches = true;
        }
      }
      
      if (!pathMatches) return false;
      
      if (endpoint.method && endpoint.method !== 'ALL') {
        const allowedMethods = endpoint.method.toUpperCase().split(',').map(m => m.trim());
        return allowedMethods.includes(requestMethod.toUpperCase());
      }
      
      return true;
    });

    if (!vipEndpoint) {
      return next();
    }

    const adminWhatsApp = process.env.ADMIN_WHATSAPP_NUMBER || '6281234567890';
    const whatsappUrl = `https://wa.me/${adminWhatsApp}?text=${encodeURIComponent('Halo! Saya ingin upgrade ke VIP untuk akses premium API 🚀')}`;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: '🔒 Endpoint Premium - Login Required',
        message: 'Endpoint ini memerlukan akses VIP. Silakan login terlebih dahulu atau hubungi admin untuk upgrade ke VIP.',
        vipRequired: true,
        endpoint: {
          path: vipEndpoint.path,
          name: vipEndpoint.name,
          description: vipEndpoint.description
        },
        upgrade: {
          whatsapp: adminWhatsApp,
          whatsappUrl: whatsappUrl,
          message: 'Hubungi admin via WhatsApp untuk upgrade VIP'
        }
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'role', 'vipExpiresAt']
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
        error: '⭐ Upgrade ke VIP Required',
        message: `Maaf, endpoint "${vipEndpoint.name || vipEndpoint.path}" hanya tersedia untuk member VIP. Upgrade sekarang untuk akses unlimited!`,
        vipRequired: true,
        endpoint: {
          path: vipEndpoint.path,
          name: vipEndpoint.name,
          description: vipEndpoint.description
        },
        user: {
          email: user.email,
          currentRole: user.role
        },
        upgrade: {
          whatsapp: adminWhatsApp,
          whatsappUrl: whatsappUrl,
          message: 'Klik untuk chat admin dan upgrade VIP',
          benefits: [
            '✅ Akses semua endpoint premium',
            '✅ Rate limit lebih tinggi',
            '✅ Priority support',
            '✅ Akses fitur terbaru'
          ]
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      const adminWhatsApp = process.env.ADMIN_WHATSAPP_NUMBER || '6281234567890';
      const whatsappUrl = `https://wa.me/${adminWhatsApp}?text=${encodeURIComponent('Halo! Saya ingin upgrade ke VIP untuk akses premium API 🚀')}`;
      
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        message: 'Token Anda tidak valid atau sudah expired. Silakan login kembali.',
        vipRequired: true,
        upgrade: {
          whatsapp: adminWhatsApp,
          whatsappUrl: whatsappUrl
        }
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
        attributes: ['id', 'email', 'role', 'vipExpiresAt']
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
