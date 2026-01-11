/**
 * API Structure Validation Test
 * Validates that all required API endpoints are properly implemented
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, 'api');

// Expected API endpoints structure
const EXPECTED_ENDPOINTS = {
  'auth/login.ts': {
    requiredExports: ['onRequestPost'],
    description: 'POST /api/auth/login - User login'
  },
  'auth/register.ts': {
    requiredExports: ['onRequestPost'],
    description: 'POST /api/auth/register - User registration'
  },
  'feeds/index.ts': {
    requiredExports: ['onRequestGet', 'onRequestPost'],
    description: 'GET/POST /api/feeds - List and add feeds'
  },
  'feeds/[id].ts': {
    requiredExports: ['onRequestDelete'],
    description: 'DELETE /api/feeds/:id - Delete feed'
  },
  'articles/index.ts': {
    requiredExports: ['onRequestGet'],
    description: 'GET /api/articles - List articles'
  },
  'articles/[id]/read.ts': {
    requiredExports: ['onRequestPost'],
    description: 'POST /api/articles/:id/read - Mark as read'
  },
  'articles/[id]/favorite.ts': {
    requiredExports: ['onRequestPost', 'onRequestDelete'],
    description: 'POST/DELETE /api/articles/:id/favorite - Manage favorites'
  },
  'refresh.ts': {
    requiredExports: ['onRequestPost'],
    description: 'POST /api/refresh - Refresh all feeds'
  },
};

console.log('🔍 Validating API Structure...\n');

let allValid = true;
let foundEndpoints = 0;

// Check each expected endpoint
for (const [filePath, config] of Object.entries(EXPECTED_ENDPOINTS)) {
  const fullPath = path.join(API_DIR, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`❌ Missing: ${filePath}`);
    console.log(`   Description: ${config.description}\n`);
    allValid = false;
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');

  // Check for required exports
  const missingExports = [];
  for (const exportName of config.requiredExports) {
    if (!content.includes(`export async function ${exportName}`)) {
      missingExports.push(exportName);
    }
  }

  if (missingExports.length > 0) {
    console.log(`⚠️  ${filePath}: Missing exports: ${missingExports.join(', ')}`);
    allValid = false;
  } else {
    console.log(`✅ ${filePath}`);
    console.log(`   ${config.description}`);
    console.log(`   Exports: ${config.requiredExports.join(', ')}\n`);
    foundEndpoints++;
  }
}

// Check for lib files
console.log('\n🔍 Checking support libraries...\n');

const LIB_FILES = {
  'lib/firebase.ts': ['initializeFirebaseAdmin', 'getAdminAuth', 'getAdminFirestore'],
  'lib/auth.ts': ['verifyAuthToken', 'requireAuth', 'unauthorizedResponse'],
};

for (const [filePath, expectedFunctions] of Object.entries(LIB_FILES)) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`❌ Missing: ${filePath}`);
    allValid = false;
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const missingFunctions = expectedFunctions.filter(fn => !content.includes(`function ${fn}`) && !content.includes(`export ${fn}`));

  if (missingFunctions.length > 0) {
    console.log(`⚠️  ${filePath}: Missing functions: ${missingFunctions.join(', ')}`);
    allValid = false;
  } else {
    console.log(`✅ ${filePath}`);
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`\n📊 Summary:`);
console.log(`   Found endpoints: ${foundEndpoints}/${Object.keys(EXPECTED_ENDPOINTS).length}`);
console.log(`   Status: ${allValid ? '✅ All checks passed' : '❌ Some checks failed'}\n`);

if (allValid) {
  console.log('✨ API structure is valid and ready for deployment!\n');
  process.exit(0);
} else {
  console.log('⚠️  Please fix the issues above before deploying.\n');
  process.exit(1);
}
