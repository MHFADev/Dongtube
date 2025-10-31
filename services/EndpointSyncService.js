import { readdirSync } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { ApiEndpoint, EndpointCategory } from '../models/index.js';
import { Op } from 'sequelize';
import endpointEventEmitter from './EndpointEventEmitter.js';

class EndpointSyncService {
  constructor(routesPath) {
    this.routesPath = routesPath;
    this.syncInProgress = false;
  }

  /**
   * Sync all routes from routes folder to endpoint database
   */
  async syncRoutesToDatabase() {
    if (this.syncInProgress) {
      console.log(chalk.yellow('⏸️  Endpoint sync already in progress, skipping...'));
      return { success: false, skipped: true };
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      console.log(chalk.cyan('\n🔄 Starting endpoint sync to database...\n'));

      // Load all route metadata
      const routeFiles = readdirSync(this.routesPath).filter(file => file.endsWith('.js'));
      const allEndpoints = [];
      const processedFiles = [];

      console.log(chalk.cyan(`📂 Scanning ${routeFiles.length} route files...\n`));

      for (const file of routeFiles) {
        // Skip admin and auth routes
        if (file === 'admin.js' || file === 'auth.js' || file === 'sse.js' || file === 'admin-tools.js') {
          console.log(chalk.gray(`  ⏭️  Skipping system file: ${file}`));
          continue;
        }

        try {
          const routePath = path.join(this.routesPath, file);
          const route = await import(`file://${routePath}?t=${Date.now()}`);

          if (route.metadata) {
            const metadata = Array.isArray(route.metadata) ? route.metadata : [route.metadata];
            
            for (const meta of metadata) {
              allEndpoints.push({
                ...meta,
                sourceFile: file
              });
            }

            processedFiles.push(file);
            console.log(chalk.green(`  ✓ Loaded ${metadata.length} endpoint(s) from ${file}`));
          } else {
            console.log(chalk.gray(`  ℹ  No metadata in ${file}`));
          }
        } catch (error) {
          console.error(chalk.red(`  ✗ Failed to load ${file}:`), error.message);
        }
      }

      console.log(chalk.cyan(`\n📊 Total endpoints loaded: ${allEndpoints.length}\n`));

      // Sync to database
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const endpoint of allEndpoints) {
        try {
          const {
            path: endpointPath,
            method,
            name,
            description,
            category,
            params,
            parameters,
            examples,
            placeholder,
            responseBinary,
            sourceFile
          } = endpoint;

          if (!endpointPath || !name) {
            console.log(chalk.yellow(`  ⚠️  Skipping endpoint without path or name: ${JSON.stringify(endpoint)}`));
            skipped++;
            continue;
          }

          // Handle multiple methods (e.g., "GET, POST")
          const methods = method ? method.split(',').map(m => m.trim()) : ['GET'];

          for (const singleMethod of methods) {
            const [existingEndpoint, wasCreated] = await ApiEndpoint.findOrCreate({
              where: {
                path: endpointPath,
                method: singleMethod
              },
              defaults: {
                name,
                description: description || null,
                category: category || 'other',
                status: 'free', // Default to free
                isActive: true,
                parameters: parameters || params || [],
                examples: examples || null,
                responseBinary: responseBinary || false,
                sourceFile: sourceFile || null,
                lastSyncedAt: new Date(),
                tags: category ? [category] : [],
                metadata: {
                  placeholder: placeholder || null,
                  syncedFrom: sourceFile,
                  syncedAt: new Date().toISOString()
                }
              }
            });

            if (wasCreated) {
              created++;
              console.log(chalk.green(`  ✓ Created: ${singleMethod} ${endpointPath}`));
            } else {
              // Update existing endpoint (except status - don't override manual changes)
              await existingEndpoint.update({
                name,
                description: description || existingEndpoint.description,
                category: category || existingEndpoint.category,
                parameters: parameters || params || existingEndpoint.parameters,
                examples: examples || existingEndpoint.examples,
                responseBinary: responseBinary || existingEndpoint.responseBinary,
                sourceFile: sourceFile || existingEndpoint.sourceFile,
                lastSyncedAt: new Date(),
                // Don't update status, isActive - preserve manual settings
                metadata: {
                  ...existingEndpoint.metadata,
                  placeholder: placeholder || existingEndpoint.metadata?.placeholder,
                  syncedFrom: sourceFile,
                  lastSyncedAt: new Date().toISOString()
                }
              });
              updated++;
              console.log(chalk.blue(`  ↻ Updated: ${singleMethod} ${endpointPath}`));
            }
          }
        } catch (error) {
          console.error(chalk.red(`  ✗ Failed to sync endpoint:`), error.message);
          skipped++;
        }
      }

      // Mark endpoints that are no longer in route files as inactive
      const allPaths = allEndpoints.flatMap(ep => {
        const methods = ep.method ? ep.method.split(',').map(m => m.trim()) : ['GET'];
        return methods.map(m => ({ path: ep.path, method: m }));
      });

      const orphanedEndpoints = await ApiEndpoint.findAll({
        where: {
          [Op.or]: allPaths.map(p => ({
            [Op.and]: {
              path: { [Op.ne]: p.path },
              method: { [Op.ne]: p.method }
            }
          })),
          sourceFile: { [Op.ne]: null }
        }
      });

      let deactivated = 0;
      for (const orphan of orphanedEndpoints) {
        const stillExists = allPaths.some(p => p.path === orphan.path && p.method === orphan.method);
        if (!stillExists && orphan.sourceFile) {
          await orphan.update({ isActive: false });
          deactivated++;
          console.log(chalk.yellow(`  ⚠️  Deactivated orphaned: ${orphan.method} ${orphan.path}`));
        }
      }

      const duration = Date.now() - startTime;

      console.log(chalk.bgGreen.black(`\n ✓ Endpoint sync completed in ${duration}ms `));
      console.log(chalk.green(`   Created: ${created}`));
      console.log(chalk.blue(`   Updated: ${updated}`));
      console.log(chalk.yellow(`   Skipped: ${skipped}`));
      if (deactivated > 0) {
        console.log(chalk.yellow(`   Deactivated: ${deactivated}`));
      }
      console.log();

      this.syncInProgress = false;

      return {
        success: true,
        duration,
        created,
        updated,
        skipped,
        deactivated,
        total: allEndpoints.length
      };
    } catch (error) {
      console.error(chalk.red('\n✗ Endpoint sync failed:'), error.message);
      this.syncInProgress = false;
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      syncInProgress: this.syncInProgress
    };
  }

  /**
   * Auto-categorize endpoint based on path
   */
  autoDetectCategory(path, name, description) {
    const pathLower = path.toLowerCase();
    const nameLower = (name || '').toLowerCase();
    const descLower = (description || '').toLowerCase();

    const categoryMap = {
      'social-media': ['tiktok', 'instagram', 'youtube', 'facebook', 'twitter', 'xiaohongshu'],
      'tools': ['tool', 'convert', 'qr', 'screenshot', 'download'],
      'ai': ['ai', 'generate', 'ideogram', 'image', 'bot'],
      'search': ['search', 'find', 'lookup', 'query'],
      'image': ['image', 'photo', 'picture', 'removebg', 'ocr'],
      'entertainment': ['anime', 'mal', 'anilist', 'manga', 'music'],
      'news': ['news', 'kompas', 'article']
    };

    for (const [category, keywords] of Object.entries(categoryMap)) {
      for (const keyword of keywords) {
        if (pathLower.includes(keyword) || nameLower.includes(keyword) || descLower.includes(keyword)) {
          return category;
        }
      }
    }

    return 'other';
  }

  /**
   * Get statistics
   */
  async getStats() {
    try {
      const total = await ApiEndpoint.count();
      const active = await ApiEndpoint.count({ where: { isActive: true } });
      const free = await ApiEndpoint.count({ where: { status: 'free', isActive: true } });
      const vip = await ApiEndpoint.count({ where: { status: 'vip', isActive: true } });
      const premium = await ApiEndpoint.count({ where: { status: 'premium', isActive: true } });
      const disabled = await ApiEndpoint.count({ where: { status: 'disabled' } });

      const categories = await EndpointCategory.findAll({
        attributes: ['name', 'displayName'],
        where: { isActive: true }
      });

      const categoryStats = {};
      for (const cat of categories) {
        const count = await ApiEndpoint.count({
          where: { category: cat.name, isActive: true }
        });
        categoryStats[cat.name] = {
          displayName: cat.displayName,
          count
        };
      }

      return {
        total,
        active,
        inactive: total - active,
        byStatus: { free, vip, premium, disabled },
        byCategory: categoryStats
      };
    } catch (error) {
      console.error('Failed to get endpoint stats:', error);
      return null;
    }
  }
}

export default EndpointSyncService;
