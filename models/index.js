import sequelize from '../config/database.js';
import User from './User.js';
import VIPEndpoint from './VIPEndpoint.js';

const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');
    
    await sequelize.sync({ alter: false });
    console.log('✓ Database tables synced');
    
    const adminExists = await User.findOne({ where: { role: 'admin' } });
    if (!adminExists) {
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await User.create({
        email: 'admin@dongtube.com',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('✓ Default admin created: admin@dongtube.com / admin123');
    }
    
    return true;
  } catch (error) {
    console.error('✗ Database error:', error.message);
    return false;
  }
};

export { sequelize, User, VIPEndpoint, initDatabase };
