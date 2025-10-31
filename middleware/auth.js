import jwt from 'jsonwebtoken';
import { User, VIPEndpoint, ApiEndpoint } from '../models/index.js';
import { Op } from 'sequelize';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '7d';

export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      vipExpiresAt: user.vipExpiresAt
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
};

export const isVIPValid = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'vip') return false;
  
  if (!user.vipExpiresAt) return true;
  
  const now = new Date();
  const expiresAt = new Date(user.vipExpiresAt);
  return expiresAt > now;
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
const CACHE_DURATION = 5000;

export const checkVIPAccess = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.id, {
          attributes: ['id', 'email', 'role', 'vipExpiresAt']
        });
        
        if (user) {
          if (user.role === 'admin') {
            req.user = user;
            return next();
          }
          
          req.user = user;
        }
      } catch (err) {
      }
    }
    
    const currentTime = Date.now();
    
    if (!vipEndpointsCache || (currentTime - cacheTimestamp) > CACHE_DURATION) {
      const wasNull = !vipEndpointsCache;
      
      // Query from primary database (ApiEndpoint table)
      try {
        vipEndpointsCache = await ApiEndpoint.findAll({
          where: { 
            status: { [Op.in]: ['vip', 'premium'] },
            isActive: true
          },
          attributes: ['path', 'method', 'name', 'description', 'status']
        });
        cacheTimestamp = currentTime;
        console.log(`📥 VIP Cache ${wasNull ? 'loaded' : 'refreshed'}: ${vipEndpointsCache.length} VIP/Premium endpoint(s)`);
      } catch (endpointDbError) {
        // Fallback to old VIPEndpoint table if ApiEndpoint is not available
        console.log('⚠️  ApiEndpoint table not available, falling back to VIPEndpoint table');
        vipEndpointsCache = await VIPEndpoint.findAll({
          where: { requiresVIP: true },
          attributes: ['path', 'method', 'name', 'description']
        });
        cacheTimestamp = currentTime;
        console.log(`📥 VIP Cache ${wasNull ? 'loaded' : 'refreshed'} from fallback: ${vipEndpointsCache.length} VIP endpoint(s)`);
      }
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
    
    if (!token || !req.user) {
      return res.status(401).json({
        success: false,
        error: '🔒 Endpoint Premium - Login Required',
        message: 'Endpoint ini memerlukan akses VIP. Silakan login terlebih dahulu atau hubungi admin untuk upgrade ke VIP.',
        vipRequired: true,
        isAuthenticated: false,
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

    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'role', 'vipExpiresAt']
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        isAuthenticated: false
      });
    }

    if (user.role === 'admin') {
      req.user = user;
      return next();
    }

    const vipValid = isVIPValid(user);
    
    if (!vipValid) {
      const isExpired = user.role === 'vip' && user.vipExpiresAt && new Date(user.vipExpiresAt) <= new Date();
      
      return res.status(403).json({
        success: false,
        error: isExpired ? '⏰ VIP Expired - Renewal Required' : '⭐ Upgrade ke VIP Required',
        message: isExpired 
          ? `VIP Anda telah expired pada ${new Date(user.vipExpiresAt).toLocaleDateString()}. Hubungi admin untuk perpanjang akses VIP!`
          : `Maaf, endpoint "${vipEndpoint.name || vipEndpoint.path}" hanya tersedia untuk member VIP. Upgrade sekarang untuk akses unlimited!`,
        vipRequired: true,
        vipExpired: isExpired,
        endpoint: {
          path: vipEndpoint.path,
          name: vipEndpoint.name,
          description: vipEndpoint.description
        },
        user: {
          email: user.email,
          currentRole: user.role,
          isAuthenticated: true,
          vipExpiresAt: user.vipExpiresAt
        },
        upgrade: {
          whatsapp: adminWhatsApp,
          whatsappUrl: whatsappUrl,
          message: isExpired ? 'Klik untuk chat admin dan perpanjang VIP' : 'Klik untuk chat admin dan upgrade VIP',
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
  const oldCacheSize = vipEndpointsCache ? vipEndpointsCache.length : 0;
  vipEndpointsCache = null;
  cacheTimestamp = 0;
  console.log(`🔄 VIP Cache cleared! Previous cache had ${oldCacheSize} VIP endpoint(s). Next request will reload from database.`);
};
