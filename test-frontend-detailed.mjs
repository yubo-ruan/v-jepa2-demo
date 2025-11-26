#!/usr/bin/env node
/**
 * Detailed frontend test - capture model display section
 */

import { chromium } from 'playwright';

async function testModelDisplay() {
  console.log('🚀 Testing model display in Planning Controls...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1024 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Navigate to Inference tab
    await page.click('text=Inference');
    await page.waitForTimeout(2000);

    // Scroll to Planning Controls
    await page.locator('text=Planning Controls').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Take focused screenshot of Planning Controls
    const planningControls = await page.locator('text=Planning Controls').locator('..').first();
    await planningControls.screenshot({ path: '/tmp/planning-controls.png' });
    console.log('✓ Screenshot saved: /tmp/planning-controls.png');

    // Get the model display info
    const modelDisplay = await planningControls.locator('div').filter({ hasText: /V-JEPA2|No model loaded/ }).first();
    const modelText = await modelDisplay.textContent();
    console.log(`\n📊 Model Display Text: "${modelText}"`);

    // Check specific elements
    const hasModelName = await planningControls.locator('text=V-JEPA2 ViT-Large').isVisible();
    const hasLoadedIndicator = await planningControls.locator('text=Loaded').isVisible();
    const hasNoModelButton = await planningControls.locator('text=No model loaded').isVisible();

    console.log(`\n✅ Test Results:`);
    console.log(`   Model name visible: ${hasModelName ? '✅' : '❌'}`);
    console.log(`   "Loaded" indicator: ${hasLoadedIndicator ? '✅' : '❌'}`);
    console.log(`   "No model loaded" button: ${hasNoModelButton ? '❌ (should be false)' : '✅ (correctly hidden)'}`);

    // Take full page screenshot
    await page.screenshot({ path: '/tmp/full-page.png', fullPage: true });
    console.log('\n✓ Full page screenshot: /tmp/full-page.png');

    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: '/tmp/error.png', fullPage: true });
  } finally {
    await browser.close();
    console.log('\n👋 Test complete!');
  }
}

testModelDisplay().catch(console.error);
