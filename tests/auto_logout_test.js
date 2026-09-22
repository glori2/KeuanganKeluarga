const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('====================================================');
  console.log(' ⏳ PHASE: AUTO LOGOUT / SESSION TIMEOUT TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  const appDir = path.join(__dirname, '../app');
  const autoLogoutPath = path.join(appDir, 'components', 'AutoLogout.tsx');
  const layoutPath = path.join(appDir, 'layout.tsx');

  // 1. Component Exists
  const componentExists = fs.existsSync(autoLogoutPath);
  assert(componentExists, 'AutoLogout component file exists');
  if (!componentExists) process.exit(1);

  const content = fs.readFileSync(autoLogoutPath, 'utf8');

  // 2. Timeout Constants
  assert(/30 \* 60 \* 1000/.test(content), 'Default idle timeout is 30 minutes (30 * 60 * 1000 ms)');
  assert(/60 \* 1000/.test(content), 'Default warning threshold is 1 minute (60 * 1000 ms)');

  // 3. Unauthenticated/Auth Page skip
  assert(/isAuthPage\s*=\s*pathname\?\.startsWith\('\/login'\)\s*\|\|\s*pathname\?\.startsWith\('\/register'\)/.test(content), 'Auto logout timer skips /login and /register pages');

  // 4. Activity throttler
  assert(/ACTIVITY_THROTTLE_MS/.test(content), 'Activity events are throttled/debounced');

  // 5. Supabase Multi-tab synchronization
  assert(/supabase\.auth\.onAuthStateChange/.test(content), 'Listens to Supabase onAuthStateChange for multi-tab logout synchronization');
  assert(/localStorage\.setItem\('last_activity'/.test(content), 'Saves activity to localStorage for multi-tab activity sync');

  // 6. Security (no window.location.reload as main solution)
  assert(!/window\.location\.reload\(\)/.test(content), 'Does not use window.location.reload()');
  
  // 7. Redirect mechanism (uses router.replace)
  assert(/router\.replace\('\/login'\)/.test(content), 'Uses router.replace(\'/login\') for redirect to avoid loop');

  // 8. Event listeners
  assert(/'mousemove'/.test(content) && /window\.addEventListener/.test(content), 'Listens to mousemove events');
  assert(/'keydown'/.test(content) && /window\.addEventListener/.test(content), 'Listens to keydown events');

  // 9. Injection in layout
  const layoutExists = fs.existsSync(layoutPath);
  assert(layoutExists, 'Root layout file exists');
  if (layoutExists) {
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');
    assert(/<AutoLogout \/>/.test(layoutContent), 'AutoLogout is injected into RootLayout');
  }

  // 10. No Hardcoded Secrets
  assert(!/your-anon-key/.test(content), 'No hardcoded secrets in AutoLogout component');

  console.log('\n====================================================');
  console.log(`🎉 AUTO LOGOUT TEST RESULTS: ${passed} PASS, ${failed} FAIL`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
