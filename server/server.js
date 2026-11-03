import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

async function start() {
  try {
    await connectDB();
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('\n✗ Could not connect to MongoDB Atlas.');
    console.error(`  ${error.message}`);
    console.error(
      '\n  Check that MONGO_URI in .env is correct and that your current IP is allow-listed in Atlas.\n'
    );
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`✓ Mrskariza API running on http://localhost:${env.port}`);
    console.log(`  Environment: ${env.nodeEnv}`);
  });
}

start();
