import 'dotenv/config';
import express from "express";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import chokidar from "chokidar";
import { initDatabase, VIPEndpoint, User } from "./models/index.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import sseRoutes from "./routes/sse.js";
import { checkVIPAccess, optionalAuth } from "./middleware/auth.js";
import RouteManager from "./services/RouteManager.js";

if (!process.env.JWT_SECRET) {
  console.error(chalk.bgRed.white('\n ✗ FATAL: JWT_SECRET environment variable is required but not set! \n'));
  console.error(chalk.yellow('\n📝 Instructions to fix this:'));
  console.error(chalk.yellow('   1. Go to the "Secrets" tab in Replit (Tools > Secrets)'));
  console.error(chalk.yellow('   2. Add a new secret with key: JWT_SECRET'));
  console.error(chalk.yellow('   3. For the value, use a secure random string like:'));
  console.error(chalk.cyan('      bceb46bd7eaa9c68cb865ed242912bbab4fd5e2023f431ba5337f02d3d5b591943c883cdd607bcc912a7bc88a610794ff1853bb55ec3e5c5844afcf7796d4225'));
  console.error(chalk.yellow('\n   Or generate a new one with:'));
  console.error(chalk.cyan('      node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'));
  console.error(chalk.yellow('\n   4. Restart the Repl\n'));
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use('/asset', express.static(path.join(__dirname, "asset")));

// Cache
const cache = new Map();

// ==================== ROUTE MANAGER ====================
const routesPath = path.join(__dirname, "routes");
const routeManager = new RouteManager(routesPath);

app.use(optionalAuth);

// ==================== FILE WATCHER ====================
let debounceTimer = null;
const DEBOUNCE_DELAY = 500;

function startFileWatcher() {
  console.log(chalk.cyan('\n👁️  Starting file watcher for hot-reload...\n'));

  const watcher = chokidar.watch(routesPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });

  watcher
    .on('add', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      console.log(chalk.green(`\n📄 File added: ${path.basename(filePath)}`));
      scheduleReload('add', filePath);
    })
    .on('change', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      console.log(chalk.yellow(`\n📝 File changed: ${path.basename(filePath)}`));
      scheduleReload('change', filePath);
    })
    .on('unlink', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      console.log(chalk.red(`\n🗑️  File deleted: ${path.basename(filePath)}`));
      scheduleReload('unlink', filePath);
    })
    .on('error', (error) => {
      console.error(chalk.red('\n✗ File watcher error:'), error.message);
    })
    .on('ready', () => {
      console.log(chalk.green('✓ File watcher is ready and monitoring routes/\n'));
    });

  function scheduleReload(event, filePath) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      console.log(chalk.cyan(`\n⚡ Triggering hot-reload (event: ${event})...\n`));
      
      try {
        const result = await routeManager.reload();
        
        if (result.success) {
          console.log(chalk.bgGreen.black(`\n ✓ Hot-reload successful in ${result.duration}ms `));
          console.log(chalk.green(`   Total endpoints: ${result.totalEndpoints}\n`));
        } else if (result.skipped) {
          console.log(chalk.yellow('\n⏸️  Hot-reload skipped (already in progress)\n'));
        } else {
          console.log(chalk.bgRed.white('\n ✗ Hot-reload failed '));
          console.log(chalk.red(`   Error: ${result.error}\n`));
        }
      } catch (error) {
        console.error(chalk.red('\n✗ Hot-reload error:'), error.message);
      }
    }, DEBOUNCE_DELAY);
  }
}

// Export routeManager for admin endpoints
export { routeManager };

// ==================== START SERVER ====================
async function startServer() {
  try {
    // STEP 0: Initialize database
    console.log(chalk.cyan("🗄️  Initializing database...\n"));
    const dbInitialized = await initDatabase();
    
    if (!dbInitialized) {
      console.error(chalk.red("Failed to initialize database. Exiting..."));
      process.exit(1);
    }
    
    console.log(chalk.green("✓ Database initialized\n"));
    
    // STEP 1: Register auth routes
    console.log(chalk.cyan("🔐 Registering authentication routes...\n"));
    app.use(authRoutes);
    app.use(adminRoutes);
    app.use(sseRoutes);
    console.log(chalk.green("✓ Auth routes registered\n"));
    console.log(chalk.cyan("📡 SSE real-time updates enabled\n"));
    
    // STEP 2: Register core routes
    console.log(chalk.cyan("⚙️  Registering core routes...\n"));
    
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        total_endpoints: routeManager.getAllEndpoints().length,
        routeManager: routeManager.getStatus()
      });
    });

    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    app.get("/api", (req, res) => {
      const allEndpoints = routeManager.getAllEndpoints();
      res.json({
        name: "Dongtube API Server",
        version: "2.0.0",
        total_endpoints: allEndpoints.length,
        endpoints: allEndpoints.map(e => ({
          name: e.name,
          path: e.path,
          method: e.method
        }))
      });
    });

    app.get("/api/docs", async (req, res) => {
      const allEndpoints = routeManager.getAllEndpoints();
      
      // Check user authentication and role
      let hasPremiumAccess = false;
      try {
        const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
        if (token) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findByPk(decoded.id, {
            attributes: ['id', 'email', 'role']
          });
          if (user && (user.role === 'vip' || user.role === 'admin')) {
            hasPremiumAccess = true;
          }
        }
      } catch (authError) {
        // User not authenticated or token invalid, keep hasPremiumAccess = false
      }
      
      try {
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('ETag', `"endpoints-${allEndpoints.length}"`);
        
        const vipEndpoints = await VIPEndpoint.findAll({
          attributes: ['path', 'method', 'requiresVIP']
        });
        
        // Build VIP map using composite key (method:path) to handle mixed-access endpoints
        const vipMap = new Map();
        vipEndpoints.forEach(ep => {
          const compositeKey = `${ep.method}:${ep.path}`;
          vipMap.set(compositeKey, ep.requiresVIP);
        });
        
        const endpointsWithVIPStatus = allEndpoints.map(ep => {
          // Check VIP status using composite key for each method
          const methods = ep.method.split(',').map(m => m.trim());
          const isVIPForAnyMethod = methods.some(method => {
            const compositeKey = `${method}:${ep.path}`;
            return vipMap.get(compositeKey) === true;
          });
          const isVIPEndpoint = isVIPForAnyMethod;
          
          // Sanitize premium endpoint details for non-premium users
          if (isVIPEndpoint && !hasPremiumAccess) {
            return {
              path: ep.path,
              method: ep.method,
              name: ep.name,
              description: 'Premium endpoint - VIP access required',
              category: ep.category,
              requiresVIP: true,
              params: [],
              parameters: [],
              examples: undefined,
              placeholder: undefined,
              responseBinary: false
            };
          }
          
          return {
            ...ep,
            requiresVIP: isVIPEndpoint
          };
        });
        
        res.json({
          success: true,
          total: endpointsWithVIPStatus.length,
          endpoints: endpointsWithVIPStatus
        });
      } catch (error) {
        console.error('Error fetching VIP endpoint status:', error);
        
        // Even on error, sanitize premium endpoints for non-premium users
        const sanitizedEndpoints = allEndpoints.map(ep => {
          // Since we can't check VIP status from DB on error, treat all as free
          // This is safer than leaking premium data
          return {
            path: ep.path,
            method: ep.method,
            name: ep.name,
            description: ep.description || ep.name,
            category: ep.category,
            requiresVIP: false,
            params: hasPremiumAccess ? (ep.params || ep.parameters || []) : [],
            parameters: hasPremiumAccess ? (ep.parameters || ep.params || []) : [],
            examples: hasPremiumAccess ? ep.examples : undefined,
            responseBinary: ep.responseBinary || false
          };
        });
        
        res.json({
          success: true,
          total: sanitizedEndpoints.length,
          endpoints: sanitizedEndpoints
        });
      }
    });

    app.get("/debug/routes", (req, res) => {
      const routes = [];
      
      app._router.stack.forEach(middleware => {
        if (middleware.route) {
          routes.push({
            path: middleware.route.path,
            methods: Object.keys(middleware.route.methods)
          });
        } else if (middleware.name === 'router') {
          middleware.handle.stack.forEach(handler => {
            if (handler.route) {
              routes.push({
                path: handler.route.path,
                methods: Object.keys(handler.route.methods)
              });
            }
          });
        }
      });
      
      res.json({
        total: routes.length,
        routes: routes
      });
    });
    
    console.log(chalk.green("✓ Core routes registered\n"));
    
    // STEP 3: Apply VIP protection middleware (before loading routes)
    console.log(chalk.cyan("🔒 Applying VIP protection middleware...\n"));
    app.use(checkVIPAccess);
    console.log(chalk.green("✓ VIP middleware active\n"));
    
    // STEP 4: Mount dynamic router proxy
    console.log(chalk.cyan("🔧 Mounting dynamic route proxy...\n"));
    app.use((req, res, next) => {
      const activeRouter = routeManager.getActiveRouter();
      if (activeRouter) {
        activeRouter(req, res, next);
      } else {
        next();
      }
    });
    console.log(chalk.green("✓ Dynamic router proxy mounted\n"));
    
    // STEP 4.5: Initial route load
    console.log(chalk.cyan("📦 Loading initial routes...\n"));
    await routeManager.reload();
    console.log(chalk.green("✓ Initial routes loaded\n"));
    
    // STEP 5: Register 404 handler (MUST BE LAST!)
    console.log(chalk.cyan("⚙️  Registering error handlers...\n"));
    
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: "Endpoint not found",
        path: req.path,
        method: req.method,
        hint: "Visit /debug/routes to see all routes"
      });
    });

    app.use((err, req, res, next) => {
      console.error(chalk.red("Error:"), err.message);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        details: err.message
      });
    });
    
    console.log(chalk.green("✓ Error handlers registered\n"));
    
    // STEP 6: Start listening FIRST (before DB sync)
    const PORT = process.env.PORT || 5000;
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(chalk.bgGreen.black(`\n ✓ Server running on port ${PORT} `));
      console.log(chalk.bgBlue.white(` ℹ Total endpoints: ${routeManager.getAllEndpoints().length} `));
      console.log(chalk.cyan(`\n📚 Home: http://localhost:${PORT}`));
      console.log(chalk.cyan(`📚 API Docs: http://localhost:${PORT}/api/docs`));
      console.log(chalk.cyan(`📚 Debug: http://localhost:${PORT}/debug/routes`));
      console.log(chalk.yellow(`\n🔥 Test endpoint: http://localhost:${PORT}/api/test\n`));
      
      // STEP 6.5: Start file watcher for hot-reload
      startFileWatcher();
    });
    
  } catch (err) {
    console.error(chalk.bgRed.white(` Failed: ${err.message} `));
    process.exit(1);
  }
}

startServer();

export default app;