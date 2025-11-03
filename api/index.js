import app, { initializeApp } from '../server.js';

let isInitialized = false;

async function handler(req, res) {
  if (!isInitialized) {
    try {
      await initializeApp();
      isInitialized = true;
      console.log('✓ Vercel serverless function initialized');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize application',
        details: error.message
      });
    }
  }
  
  return app(req, res);
}

export default handler;
