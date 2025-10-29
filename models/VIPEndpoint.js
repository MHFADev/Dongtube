import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const VIPEndpoint = sequelize.define('VIPEndpoint', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  path: {
    type: DataTypes.STRING(200),
    allowNull: false,
    unique: true
  },
  requiresVIP: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'requires_vip'
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'vip_endpoints',
  timestamps: true,
  updatedAt: false
});

export default VIPEndpoint;
