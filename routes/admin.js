import express from 'express';
import { User, VIPEndpoint } from '../models/index.js';
import { authenticate, authorize, refreshVIPCache } from '../middleware/auth.js';

const router = express.Router();

router.get('/admin/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'role', 'vipExpiresAt', 'createdAt', 'lastLogin'],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      total: users.length,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

router.put('/admin/users/:id/role', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'vip', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be user, vip, or admin'
      });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.update({ role });

    res.json({
      success: true,
      message: 'User role updated successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role'
    });
  }
});

router.post('/admin/users/:id/grant-vip', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { duration } = req.body;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const now = new Date();
    let expiresAt = new Date();

    switch (duration) {
      case '7d':
        expiresAt.setDate(now.getDate() + 7);
        break;
      case '30d':
        expiresAt.setDate(now.getDate() + 30);
        break;
      case '90d':
        expiresAt.setDate(now.getDate() + 90);
        break;
      case '1y':
        expiresAt.setFullYear(now.getFullYear() + 1);
        break;
      case 'lifetime':
        expiresAt = new Date('2099-12-31');
        break;
      case 'permanent':
        expiresAt = null;
        break;
      default:
        if (req.body.customDate) {
          expiresAt = new Date(req.body.customDate);
        } else {
          expiresAt.setDate(now.getDate() + 30);
        }
    }

    await user.update({ 
      role: 'vip',
      vipExpiresAt: expiresAt 
    });

    res.json({
      success: true,
      message: 'VIP access granted successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        vipExpiresAt: user.vipExpiresAt
      }
    });
  } catch (error) {
    console.error('Grant VIP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to grant VIP access'
    });
  }
});

router.put('/admin/users/:id/force-update', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, vipExpiresAt } = req.body;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const updates = {};
    if (role !== undefined) {
      updates.role = role;
    }
    if (vipExpiresAt !== undefined) {
      updates.vipExpiresAt = vipExpiresAt === null ? null : new Date(vipExpiresAt);
    }

    await user.update(updates);

    res.json({
      success: true,
      message: 'User forcefully updated by admin - no restrictions applied',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        vipExpiresAt: user.vipExpiresAt
      }
    });
  } catch (error) {
    console.error('Force update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force update user'
    });
  }
});

router.post('/admin/users/bulk-update', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { userIds, role, vipExpiresAt } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userIds array is required and must not be empty'
      });
    }

    const updates = {};
    if (role !== undefined) {
      updates.role = role;
    }
    if (vipExpiresAt !== undefined) {
      updates.vipExpiresAt = vipExpiresAt === null ? null : new Date(vipExpiresAt);
    }

    const [updatedCount] = await User.update(updates, {
      where: { id: userIds }
    });

    res.json({
      success: true,
      message: `${updatedCount} users updated by admin - no restrictions applied`,
      updatedCount,
      updates
    });
  } catch (error) {
    console.error('Bulk update users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update users'
    });
  }
});

router.post('/admin/users/:id/revoke-vip', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.update({ 
      role: 'user',
      vipExpiresAt: null 
    });

    res.json({
      success: true,
      message: 'VIP access revoked successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        vipExpiresAt: user.vipExpiresAt
      }
    });
  } catch (error) {
    console.error('Revoke VIP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke VIP access'
    });
  }
});

router.put('/admin/users/:id/extend-vip', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { extendBy, customDate } = req.body;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentExpiry = user.vipExpiresAt ? new Date(user.vipExpiresAt) : new Date();
    let newExpiresAt;

    if (customDate) {
      newExpiresAt = new Date(customDate);
    } else {
      newExpiresAt = new Date(currentExpiry);
      
      switch (extendBy) {
        case '7d':
          newExpiresAt.setDate(currentExpiry.getDate() + 7);
          break;
        case '30d':
          newExpiresAt.setDate(currentExpiry.getDate() + 30);
          break;
        case '90d':
          newExpiresAt.setDate(currentExpiry.getDate() + 90);
          break;
        case '1y':
          newExpiresAt.setFullYear(currentExpiry.getFullYear() + 1);
          break;
        default:
          newExpiresAt.setDate(currentExpiry.getDate() + 30);
      }
    }

    await user.update({ 
      role: 'vip',
      vipExpiresAt: newExpiresAt 
    });

    res.json({
      success: true,
      message: 'VIP access extended successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        vipExpiresAt: user.vipExpiresAt
      }
    });
  } catch (error) {
    console.error('Extend VIP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extend VIP access'
    });
  }
});

router.get('/admin/vip-endpoints', authenticate, authorize('admin'), async (req, res) => {
  try {
    const endpoints = await VIPEndpoint.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      total: endpoints.length,
      endpoints
    });
  } catch (error) {
    console.error('Get VIP endpoints error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch VIP endpoints'
    });
  }
});

router.post('/admin/vip-endpoints', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { path, method, description, requiresVIP, name, category } = req.body;

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint path is required'
      });
    }

    const endpointMethod = method || 'GET';

    const existingEndpoint = await VIPEndpoint.findOne({ 
      where: { path, method: endpointMethod } 
    });

    if (existingEndpoint) {
      await existingEndpoint.update({ 
        requiresVIP: requiresVIP !== undefined ? requiresVIP : true,
        description: description || existingEndpoint.description,
        name: name !== undefined ? name : existingEndpoint.name,
        category: category !== undefined ? category : existingEndpoint.category
      });

      refreshVIPCache();

      return res.json({
        success: true,
        message: 'VIP endpoint updated',
        endpoint: existingEndpoint
      });
    }

    const endpoint = await VIPEndpoint.create({
      path,
      method: endpointMethod,
      description: description || null,
      requiresVIP: requiresVIP !== undefined ? requiresVIP : true,
      name: name || null,
      category: category || null
    });

    refreshVIPCache();

    res.status(201).json({
      success: true,
      message: 'VIP endpoint created',
      endpoint
    });
  } catch (error) {
    console.error('Create VIP endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create VIP endpoint'
    });
  }
});

router.delete('/admin/vip-endpoints/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const endpoint = await VIPEndpoint.findByPk(id);

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'VIP endpoint not found'
      });
    }

    await endpoint.destroy();
    refreshVIPCache();

    res.json({
      success: true,
      message: 'VIP endpoint deleted'
    });
  } catch (error) {
    console.error('Delete VIP endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete VIP endpoint'
    });
  }
});

router.get('/admin/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const totalUsers = await User.count();
    const vipUsers = await User.count({ where: { role: 'vip' } });
    const adminUsers = await User.count({ where: { role: 'admin' } });
    const regularUsers = await User.count({ where: { role: 'user' } });
    const totalVIPEndpoints = await VIPEndpoint.count({ where: { requiresVIP: true } });
    const totalEndpoints = await VIPEndpoint.count();

    res.json({
      success: true,
      stats: {
        totalUsers,
        vipUsers,
        adminUsers,
        regularUsers,
        totalVIPEndpoints,
        totalEndpoints,
        freeEndpoints: totalEndpoints - totalVIPEndpoints
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

router.get('/admin/endpoints/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { premium, search, category, page = 1, limit = 50 } = req.query;
    
    const where = {};
    
    if (premium !== undefined) {
      where.requiresVIP = premium === 'true';
    }
    
    if (search) {
      const { Op } = await import('sequelize');
      where[Op.or] = [
        { path: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (category) {
      where.category = category;
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await VIPEndpoint.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit)),
      endpoints: rows
    });
  } catch (error) {
    console.error('Get all endpoints error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoints'
    });
  }
});

router.put('/admin/endpoints/:id/toggle-premium', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const endpoint = await VIPEndpoint.findByPk(id);
    
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }
    
    await endpoint.update({
      requiresVIP: !endpoint.requiresVIP
    });
    
    refreshVIPCache();
    
    res.json({
      success: true,
      message: `Endpoint ${endpoint.requiresVIP ? 'set to PREMIUM' : 'set to FREE'}`,
      endpoint: {
        id: endpoint.id,
        path: endpoint.path,
        name: endpoint.name,
        requiresVIP: endpoint.requiresVIP
      }
    });
  } catch (error) {
    console.error('Toggle premium error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle premium status'
    });
  }
});

router.put('/admin/endpoints/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { requiresVIP, description, category, name } = req.body;
    
    const endpoint = await VIPEndpoint.findByPk(id);
    
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    }
    
    const updates = {};
    if (requiresVIP !== undefined) updates.requiresVIP = requiresVIP;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (name !== undefined) updates.name = name;
    
    await endpoint.update(updates);
    
    refreshVIPCache();
    
    res.json({
      success: true,
      message: 'Endpoint updated successfully',
      endpoint
    });
  } catch (error) {
    console.error('Update endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update endpoint'
    });
  }
});

router.post('/admin/endpoints/bulk-premium', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { ids, requiresVIP } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ids array is required and must not be empty'
      });
    }
    
    if (requiresVIP === undefined) {
      return res.status(400).json({
        success: false,
        error: 'requiresVIP field is required'
      });
    }
    
    const updated = await VIPEndpoint.update(
      { requiresVIP },
      { where: { id: ids } }
    );
    
    refreshVIPCache();
    
    res.json({
      success: true,
      message: `${updated[0]} endpoints updated`,
      updated: updated[0],
      status: requiresVIP ? 'PREMIUM' : 'FREE'
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update endpoints'
    });
  }
});

router.post('/admin/cache/refresh', authenticate, authorize('admin'), async (req, res) => {
  try {
    refreshVIPCache();
    
    res.json({
      success: true,
      message: 'VIP cache refreshed successfully'
    });
  } catch (error) {
    console.error('Refresh cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh cache'
    });
  }
});

router.get('/admin/categories', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { Op } = await import('sequelize');
    const categories = await VIPEndpoint.findAll({
      attributes: ['category'],
      where: {
        category: { [Op.ne]: null }
      },
      group: ['category']
    });
    
    const uniqueCategories = [...new Set(categories.map(c => c.category).filter(Boolean))];
    
    res.json({
      success: true,
      categories: uniqueCategories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

router.get('/admin/endpoints/category/:category', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await VIPEndpoint.findAndCountAll({
      where: { category },
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      category,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / parseInt(limit)),
      endpoints: rows
    });
  } catch (error) {
    console.error('Get endpoints by category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoints by category'
    });
  }
});

router.post('/admin/reload/trigger', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { routeManager } = await import('../server.js');
    
    console.log('\n🔄 Admin triggered manual route reload...\n');
    
    const result = await routeManager.reload();
    
    if (result.success) {
      return res.json({
        success: true,
        message: 'Routes reloaded successfully',
        duration: result.duration,
        totalEndpoints: result.totalEndpoints,
        timestamp: new Date().toISOString()
      });
    } else if (result.skipped) {
      return res.status(409).json({
        success: false,
        message: 'Reload already in progress',
        skipped: true
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Route reload failed',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Manual reload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger route reload',
      details: error.message
    });
  }
});

router.get('/admin/reload/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { routeManager } = await import('../server.js');
    
    const status = routeManager.getStatus();
    
    res.json({
      success: true,
      status: {
        currentStatus: status.status,
        isReloading: status.isReloading,
        totalEndpoints: status.totalEndpoints,
        lastReloadTime: status.lastReloadTime,
        lastError: status.lastError,
        statistics: {
          totalReloads: status.stats.totalReloads,
          successfulReloads: status.stats.successfulReloads,
          failedReloads: status.stats.failedReloads,
          lastReloadDuration: status.stats.lastReloadDuration
        }
      }
    });
  } catch (error) {
    console.error('Get reload status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reload status',
      details: error.message
    });
  }
});

export default router;
