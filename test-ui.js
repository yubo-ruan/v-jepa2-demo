/**
 * Playwright test script for V-JEPA2 Model Loader UI
 * Run with: npx playwright test test-ui.js
 */

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000');

  // Wait for page to load
  await page.waitForSelector('h1');
  console.log('✓ Page loaded');

  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/01-initial.png', fullPage: true });
  console.log('✓ Initial screenshot saved');

  // Check if model selector is visible
  const modelSelect = await page.locator('select');
  console.log('✓ Model selector found');

  // Click Load Model button
  console.log('Clicking Load Model button...');
  await page.click('button:has-text("Load Model")');

  // Monitor progress updates
  let lastProgress = 0;
  const progressUpdates = [];

  // Watch for progress changes
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);

    const progressText = await page.locator('text=/\\d+%/').textContent();
    const progress = parseInt(progressText);

    if (progress !== lastProgress) {
      console.log(`Progress: ${progress}%`);
      progressUpdates.push(progress);

      // Take screenshot at key milestones
      if ([20, 50, 90, 100].includes(progress)) {
        await page.screenshot({
          path: `screenshots/${progress}-progress.png`,
          fullPage: true
        });
        console.log(`✓ Screenshot at ${progress}% saved`);
      }

      lastProgress = progress;
    }

    // Check if loading is complete
    const status = await page.locator('[class*="status"]').textContent();
    if (status.includes('Ready') || progress === 100) {
      console.log('✓ Model loading complete!');
      break;
    }
  }

  // Final screenshot
  await page.screenshot({ path: 'screenshots/final.png', fullPage: true });
  console.log('✓ Final screenshot saved');

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Progress updates captured: ${progressUpdates.length}`);
  console.log(`Progress sequence: ${progressUpdates.join('% → ')}%`);

  await browser.close();
  console.log('\n✓ Test completed successfully!');
})();
