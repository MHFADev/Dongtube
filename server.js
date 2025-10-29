import 'dotenv/config';
import express from "express";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";
import cookieParser from "cookie-parser";
import { initDatabase } from "./models/index.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import { checkVIPAccess, optionalAuth } from "./middleware/auth.js";

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

// ==================== AUTO-LOAD ROUTES ====================
let allEndpoints = [];

app.use(optionalAuth);

async function loadRoutes() {
  const routesPath = path.join(__dirname, "routes");
  const routeFiles = readdirSync(routesPath).filter(file => file.endsWith(".js"));
  
  console.log(chalk.cyan("\n🔄 Loading routes...\n"));
  
  for (const file of routeFiles) {
    try {
      const routePath = path.join(routesPath, file);
      const route = await import(`file://${routePath}?t=${Date.now()}`);
      
      console.log(chalk.yellow(`  🔍 Debug ${file}:`));
      console.log(chalk.gray(`     - Has default export: ${!!route.default}`));
      console.log(chalk.gray(`     - Default type: ${typeof route.default}`));
      
      // Register router
      if (route.default && typeof route.default === 'function') {
        app.use(route.default);
        console.log(chalk.green(`  ✓ Router registered: ${file}`));
        
        // Log routes
        if (route.default.stack) {
          route.default.stack.forEach(layer => {
            if (layer.route) {
              const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
              console.log(chalk.blue(`    → ${methods} ${layer.route.path}`));
            }
          });
        }
      }
      
      // Collect metadata
      if (route.metadata) {
        if (Array.isArray(route.metadata)) {
          allEndpoints.push(...route.metadata);
        } else {
          allEndpoints.push(route.metadata);
        }
        console.log(chalk.green(`  ✓ Metadata collected`));
      }
      
    } catch (error) {
      console.error(chalk.red(`  ✗ Failed: ${file}`), error.message);
    }
  }
  
  console.log(chalk.cyan(`\n✅ Total ${allEndpoints.length} endpoints loaded\n`));
}

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
    console.log(chalk.green("✓ Auth routes registered\n"));
    
    // STEP 2: Register core routes
    console.log(chalk.cyan("⚙️  Registering core routes...\n"));
    
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        total_endpoints: allEndpoints.length
      });
    });

    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    app.get("/api", (req, res) => {
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

    app.get("/api/docs", (req, res) => {
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('ETag', `"endpoints-${allEndpoints.length}"`);
      
      res.json({
        success: true,
        total: allEndpoints.length,
        endpoints: allEndpoints
      });
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
    
    // STEP 4: Load dynamic routes
    await loadRoutes();
    
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
    
    // STEP 6: Start listening
    const PORT = process.env.PORT || 5000;
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(chalk.bgGreen.black(`\n ✓ Server running on port ${PORT} `));
      console.log(chalk.bgBlue.white(` ℹ Total endpoints: ${allEndpoints.length} `));
      console.log(chalk.cyan(`\n📚 Home: http://localhost:${PORT}`));
      console.log(chalk.cyan(`📚 API Docs: http://localhost:${PORT}/api/docs`));
      console.log(chalk.cyan(`📚 Debug: http://localhost:${PORT}/debug/routes`));
      console.log(chalk.yellow(`\n🔥 Test endpoint: http://localhost:${PORT}/api/test\n`));
    });
    
  } catch (err) {
    console.error(chalk.bgRed.white(` Failed: ${err.message} `));
    process.exit(1);
  }
}

startServer();

export default app;