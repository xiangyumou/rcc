#!/usr/bin/env node

/**
 * Postinstall script to fix node-pty spawn-helper permissions
 * This is needed because the prebuilt binaries may not have execute permissions
 */

const fs = require('fs');
const path = require('path');

const NODE_PTY_DIR = path.join(__dirname, '..', 'node_modules', 'node-pty');
const PREBUILDS_DIR = path.join(NODE_PTY_DIR, 'prebuilds');

function fixPermissions() {
  // Check if node-pty is installed
  if (!fs.existsSync(PREBUILDS_DIR)) {
    console.log('node-pty prebuilds not found, skipping permission fix');
    return;
  }

  try {
    const platforms = fs.readdirSync(PREBUILDS_DIR);
    let fixedCount = 0;

    for (const platform of platforms) {
      const platformDir = path.join(PREBUILDS_DIR, platform);
      const spawnHelper = path.join(platformDir, 'spawn-helper');

      if (fs.existsSync(spawnHelper)) {
        const stats = fs.statSync(spawnHelper);
        const mode = stats.mode;

        // Check if executable bit is set (owner execute = 0o100)
        if (!(mode & 0o100)) {
          fs.chmodSync(spawnHelper, 0o755);
          console.log(`Fixed permissions for ${platform}/spawn-helper`);
          fixedCount++;
        }
      }
    }

    if (fixedCount === 0) {
      console.log('All spawn-helper permissions are correct');
    } else {
      console.log(`Fixed permissions for ${fixedCount} spawn-helper(s)`);
    }
  } catch (error) {
    console.error('Error fixing node-pty permissions:', error.message);
    // Don't exit with error to avoid breaking npm install
  }
}

fixPermissions();
