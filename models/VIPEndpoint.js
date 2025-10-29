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
    allowNull: false
  },
  method: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'GET'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  requiresVIP: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'requires_vip'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  parameters: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'vip_endpoints',
  timestamps: true,
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['path', 'method']
    }
  ]
});

export default VIPEndpoint;
