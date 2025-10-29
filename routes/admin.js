import express from 'express';
import { User, VIPEndpoint } from '../models/index.js';
import { authenticate, authorize, refreshVIPCache } from '../middleware/auth.js';

const router = express.Router();

router.get('/admin/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'role', 'createdAt', 'lastLogin'],
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
    const { path, method, description, requiresVIP } = req.body;

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
        description: description || existingEndpoint.description
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
      requiresVIP: requiresVIP !== undefined ? requiresVIP : true
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

export default router;
