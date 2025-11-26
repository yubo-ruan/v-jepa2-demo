#!/usr/bin/env node
/**
 * Frontend E2E test using Playwright
 * Tests the model management flow and loaded model display
 */

import { chromium } from 'playwright';

async function testFrontend() {
  console.log('🚀 Starting frontend test...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the app
    console.log('📱 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Test 1: Check initial page load
    console.log('\n✓ Page loaded successfully');
    const title = await page.title();
    console.log(`  Page title: ${title}`);

    // Test 2: Navigate to Config tab
    console.log('\n📋 Test: Navigate to Config tab...');
    await page.click('text=Config');
    await page.waitForTimeout(1500);
    console.log('✓ Config tab opened');

    // Test 3: Check model table
    console.log('\n📊 Test: Check model table...');
    const modelTable = await page.locator('table').first();
    const isVisible = await modelTable.isVisible();
    console.log(`✓ Model table visible: ${isVisible}`);

    // Test 4: Check loaded model status in table
    console.log('\n🔍 Test: Check loaded model status in Config table...');
    const loadedModelRow = await page.locator('tr:has-text("V-JEPA2 ViT-Large")').first();
    const loadedStatus = await loadedModelRow.locator('text=Loaded').isVisible();
    console.log(`✓ Model shows "Loaded" status: ${loadedStatus}`);

    // Test 5: Navigate back to Inference tab
    console.log('\n📋 Test: Navigate to Inference tab...');
    await page.click('text=Inference');
    await page.waitForTimeout(1500);
    console.log('✓ Inference tab opened');

    // Test 6: Check loaded model display in Planning Controls
    console.log('\n🎯 Test: Check loaded model in Planning Controls...');

    // Wait for the model info to load (not "Loading...")
    await page.waitForTimeout(2000);

    // Check if it shows the loaded model or "No model loaded"
    const planningControls = await page.locator('text=Planning Controls').locator('..').first();
    const hasLoadedModel = await planningControls.locator('text=V-JEPA2 ViT-Large').isVisible();
    const hasNoModelButton = await planningControls.locator('text=No model loaded').isVisible();

    console.log(`  Loaded model displayed: ${hasLoadedModel}`);
    console.log(`  "No model loaded" button: ${hasNoModelButton}`);

    if (hasLoadedModel) {
      console.log('✅ SUCCESS: Loaded model is displayed correctly!');

      // Check for the "Loaded" indicator
      const loadedIndicator = await planningControls.locator('text=Loaded').isVisible();
      console.log(`  "Loaded" indicator visible: ${loadedIndicator}`);
    } else {
      console.log('❌ FAIL: Loaded model is NOT displayed');
    }

    // Test 7: Take screenshots
    console.log('\n📸 Taking screenshots...');
    await page.screenshot({ path: '/tmp/inference-page.png', fullPage: true });
    console.log('✓ Screenshot saved: /tmp/inference-page.png');

    // Test 8: Check browser console for errors
    console.log('\n🔍 Checking browser console logs...');
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.log(`  ❌ Console Error: ${text}`);
      } else if (text.includes('[ModelsContext]') || text.includes('[UploadPage]')) {
        console.log(`  📝 ${text}`);
      }
    });

    // Test 9: Check the model selector display value
    console.log('\n🔍 Test: Get model display text...');
    const modelDisplayText = await planningControls.textContent();
    console.log(`  Planning Controls text content includes: ${modelDisplayText.includes('ViT-Large') ? 'ViT-Large ✓' : 'NOT FOUND ✗'}`);

    console.log('\n✅ All tests completed!');
    console.log('\nTest Summary:');
    console.log('='.repeat(50));
    console.log(`Model table visible: ${isVisible ? '✅' : '❌'}`);
    console.log(`Config shows loaded status: ${loadedStatus ? '✅' : '❌'}`);
    console.log(`Inference shows loaded model: ${hasLoadedModel ? '✅' : '❌'}`);
    console.log(`No "No model loaded" button: ${!hasNoModelButton ? '✅' : '❌'}`);
    console.log('='.repeat(50));

    // Keep browser open for 5 seconds so you can see the result
    console.log('\n⏳ Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ Error during test:', error.message);
    await page.screenshot({ path: '/tmp/error-screenshot.png', fullPage: true });
    console.log('Error screenshot saved to /tmp/error-screenshot.png');
  } finally {
    await browser.close();
    console.log('\n👋 Browser closed. Test complete!');
  }
}

testFrontend().catch(console.error);
