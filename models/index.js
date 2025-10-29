import sequelize from '../config/database.js';
import User from './User.js';
import VIPEndpoint from './VIPEndpoint.js';
import crypto from 'crypto';

const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');
    
    await sequelize.sync({ alter: true });
    console.log('✓ Database tables synced');
    
    const adminExists = await User.findOne({ where: { role: 'admin' } });
    if (!adminExists) {
      const bcrypt = await import('bcryptjs');
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 12);
      await User.create({
        email: 'admin@dongtube.com',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('\n' + '='.repeat(70));
      console.log('✓ ADMIN ACCOUNT CREATED');
      console.log('='.repeat(70));
      console.log('  Email:    admin@dongtube.com');
      console.log('  Password: ' + randomPassword);
      console.log('='.repeat(70));
      console.log('⚠️  IMPORTANT: Save this password now! It will not be shown again.');
      console.log('='.repeat(70) + '\n');
    }
    
    return true;
  } catch (error) {
    console.error('✗ Database error:', error.message);
    return false;
  }
};

export { sequelize, User, VIPEndpoint, initDatabase };
