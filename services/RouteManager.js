import chalk from 'chalk';
import { readdirSync } from 'fs';
import path from 'path';
import express from 'express';
import { VIPEndpoint } from '../models/index.js';
import sequelize from '../config/database.js';
import { refreshVIPCache } from '../middleware/auth.js';

class RouteManager {
  constructor(routesPath) {
    this.routesPath = routesPath;
    this.activeRouter = null;
    this.allEndpoints = [];
    this.isReloading = false;
    this.status = 'initializing';
    this.lastReloadTime = null;
    this.lastError = null;
    this.stats = {
      totalReloads: 0,
      successfulReloads: 0,
      failedReloads: 0,
      lastReloadDuration: 0
    };
  }

  async reload() {
    if (this.isReloading) {
      console.log(chalk.yellow('⏳ Reload already in progress, skipping...'));
      return {
        success: false,
        message: 'Reload already in progress',
        skipped: true
      };
    }

    this.isReloading = true;
    this.status = 'loading';
    const startTime = Date.now();

    try {
      console.log(chalk.cyan('\n🔄 Starting route reload...\n'));

      const endpoints = await this.loadAllRoutes();
      
      const newRouter = await this.buildRouterSnapshot(endpoints);
      
      await this.syncDatabase(endpoints);
      
      this.swapActiveRouter(newRouter, endpoints);
      
      const duration = Date.now() - startTime;
      this.stats.totalReloads++;
      this.stats.successfulReloads++;
      this.stats.lastReloadDuration = duration;
      this.lastReloadTime = new Date();
      this.lastError = null;
      this.status = 'ready';

      console.log(chalk.green(`\n✅ Route reload completed in ${duration}ms\n`));

      return {
        success: true,
        message: 'Routes reloaded successfully',
        duration,
        totalEndpoints: endpoints.length
      };

    } catch (error) {
      this.stats.totalReloads++;
      this.stats.failedReloads++;
      this.lastError = {
        message: error.message,
        timestamp: new Date()
      };
      this.status = 'error';

      console.error(chalk.red('✗ Route reload failed:'), error.message);
      console.error(error.stack);

      return {
        success: false,
        message: 'Route reload failed',
        error: error.message
      };

    } finally {
      this.isReloading = false;
    }
  }

  async loadAllRoutes() {
    const endpoints = [];
    
    try {
      const routeFiles = readdirSync(this.routesPath).filter(file => file.endsWith('.js'));
      
      console.log(chalk.cyan(`📂 Scanning ${routeFiles.length} route files...\n`));

      for (const file of routeFiles) {
        try {
          const routePath = path.join(this.routesPath, file);
          
          const route = await import(`file://${routePath}?t=${Date.now()}`);
          
          console.log(chalk.yellow(`  🔍 Processing ${file}:`));
          console.log(chalk.gray(`     - Has default export: ${!!route.default}`));
          console.log(chalk.gray(`     - Default type: ${typeof route.default}`));

          if (!route.default) {
            console.log(chalk.red(`  ⚠️  Skipping ${file}: No default export`));
            continue;
          }

          if (typeof route.default !== 'function') {
            console.log(chalk.red(`  ⚠️  Skipping ${file}: Default export is not a router`));
            continue;
          }

          if (route.metadata) {
            const metadata = Array.isArray(route.metadata) ? route.metadata : [route.metadata];
            endpoints.push(...metadata);
            console.log(chalk.green(`  ✓ Collected ${metadata.length} endpoint(s) metadata`));
          } else {
            console.log(chalk.gray(`  ℹ  No metadata exported`));
          }

        } catch (error) {
          console.error(chalk.red(`  ✗ Failed to load ${file}:`), error.message);
        }
      }

      console.log(chalk.cyan(`\n✅ Loaded ${endpoints.length} total endpoints\n`));
      
      return endpoints;

    } catch (error) {
      console.error(chalk.red('✗ Failed to scan routes directory:'), error.message);
      throw error;
    }
  }

  async buildRouterSnapshot(endpoints) {
    console.log(chalk.cyan('🔨 Building new router snapshot...\n'));

    const newRouter = express.Router();

    try {
      const routeFiles = readdirSync(this.routesPath).filter(file => file.endsWith('.js'));

      for (const file of routeFiles) {
        try {
          const routePath = path.join(this.routesPath, file);
          const route = await import(`file://${routePath}?t=${Date.now()}`);

          if (route.default && typeof route.default === 'function') {
            newRouter.use(route.default);
            console.log(chalk.green(`  ✓ Mounted router: ${file}`));
            
            if (route.default.stack) {
              route.default.stack.forEach(layer => {
                if (layer.route) {
                  const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
                  console.log(chalk.blue(`    → ${methods} ${layer.route.path}`));
                }
              });
            }
          }

        } catch (error) {
          console.error(chalk.red(`  ✗ Failed to mount ${file}:`), error.message);
        }
      }

      console.log(chalk.green('\n✓ Router snapshot built successfully\n'));
      
      return newRouter;

    } catch (error) {
      console.error(chalk.red('✗ Failed to build router snapshot:'), error.message);
      throw error;
    }
  }

  swapActiveRouter(newRouter, endpoints) {
    console.log(chalk.cyan('🔄 Swapping active router...\n'));

    this.activeRouter = newRouter;
    this.allEndpoints = endpoints;

    refreshVIPCache();

    console.log(chalk.green('✓ Router swapped successfully\n'));
  }

  async syncDatabase(endpoints) {
    const transaction = await sequelize.transaction();

    try {
      console.log(chalk.cyan('💾 Syncing endpoints to database...\n'));

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const endpoint of endpoints) {
        try {
          const path = endpoint.path || endpoint.route;
          const method = endpoint.method || 'GET';

          if (!path) {
            skipped++;
            continue;
          }

          const [record, isCreated] = await VIPEndpoint.findOrCreate({
            where: { path, method },
            defaults: {
              path,
              method,
              name: endpoint.name || path,
              description: endpoint.description || endpoint.desc || null,
              category: endpoint.category || null,
              parameters: endpoint.parameters || endpoint.params || null,
              requiresVIP: false
            },
            transaction
          });

          if (isCreated) {
            created++;
            console.log(chalk.green(`  ✓ Created: ${method} ${path}`));
          } else {
            await record.update({
              name: endpoint.name || record.name || path,
              description: endpoint.description || endpoint.desc || record.description,
              category: endpoint.category || record.category,
              parameters: endpoint.parameters || endpoint.params || record.parameters
            }, { transaction });
            updated++;
            console.log(chalk.blue(`  ↻ Updated: ${method} ${path}`));
          }

        } catch (err) {
          console.error(chalk.red(`  ✗ Error syncing endpoint:`), err.message);
          skipped++;
        }
      }

      await transaction.commit();

      console.log(chalk.cyan(`\n📊 Sync Summary:`));
      console.log(chalk.green(`  ✓ Created: ${created}`));
      console.log(chalk.blue(`  ↻ Updated: ${updated}`));
      console.log(chalk.yellow(`  ⊘ Skipped: ${skipped}`));
      console.log(chalk.cyan(`  ━ Total: ${endpoints.length}\n`));

      refreshVIPCache();

      return { created, updated, skipped };

    } catch (error) {
      await transaction.rollback();
      console.error(chalk.red('✗ Database sync failed, transaction rolled back:'), error.message);
      throw error;
    }
  }

  getStatus() {
    return {
      status: this.status,
      isReloading: this.isReloading,
      totalEndpoints: this.allEndpoints.length,
      lastReloadTime: this.lastReloadTime,
      lastError: this.lastError,
      stats: {
        ...this.stats
      }
    };
  }

  getActiveRouter() {
    return this.activeRouter;
  }

  getAllEndpoints() {
    return this.allEndpoints;
  }
}

export default RouteManager;
