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
    const { path, description, requiresVIP } = req.body;

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint path is required'
      });
    }

    const existingEndpoint = await VIPEndpoint.findOne({ where: { path } });

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

    res.json({
      success: true,
      stats: {
        totalUsers,
        vipUsers,
        adminUsers,
        regularUsers,
        totalVIPEndpoints
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

export default router;
