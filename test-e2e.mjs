#!/usr/bin/env node
/**
 * Complete E2E test for V-JEPA2 Demo
 * Tests: Model management, image upload, and planning execution
 */

import { chromium } from 'playwright';
import path from 'path';

async function runE2ETest() {
  console.log('🚀 V-JEPA2 Demo - Complete E2E Test\n');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();

  const testResults = [];

  try {
    // Test 1: Load application
    console.log('\n📱 Test 1: Loading application...');
    await page.goto('http://localhost:3000', { timeout: 60000 });
    await page.waitForTimeout(3000);
    testResults.push({ test: 'Page Load', status: '✅' });
    console.log('✅ Application loaded');

    // Test 2: Check Config page - Model status
    console.log('\n📋 Test 2: Checking Config page...');
    await page.click('text=Config');
    await page.waitForTimeout(1500);

    const modelTable = await page.locator('table').first().isVisible();
    const loadedModel = await page.locator('text=V-JEPA2 ViT-Large').isVisible();
    const loadedStatus = await page.locator('tr:has-text("V-JEPA2 ViT-Large")').locator('text=Loaded').isVisible();

    testResults.push({ test: 'Config - Model Table', status: modelTable ? '✅' : '❌' });
    testResults.push({ test: 'Config - Loaded Model', status: loadedModel && loadedStatus ? '✅' : '❌' });
    console.log(`✅ Model table visible: ${modelTable}`);
    console.log(`✅ Model loaded status: ${loadedStatus}`);

    // Test 3: Navigate to Inference page
    console.log('\n📋 Test 3: Navigating to Inference page...');
    await page.click('text=Inference');
    await page.waitForTimeout(1500);
    testResults.push({ test: 'Navigation - Inference', status: '✅' });
    console.log('✅ Inference page opened');

    // Test 4: Check loaded model in Planning Controls
    console.log('\n🎯 Test 4: Checking loaded model display...');
    await page.waitForTimeout(2000); // Wait for model status to load

    const hasModelName = await page.locator('text=V-JEPA2 ViT-Large').first().isVisible();
    const hasLoadedIndicator = await page.locator('text=Loaded').first().isVisible();
    const hasNoModelButton = await page.locator('text=No model loaded').isVisible();

    testResults.push({
      test: 'Planning Controls - Model Display',
      status: hasModelName && hasLoadedIndicator && !hasNoModelButton ? '✅' : '❌'
    });
    console.log(`✅ Model name displayed: ${hasModelName}`);
    console.log(`✅ Loaded indicator: ${hasLoadedIndicator}`);
    console.log(`✅ No "No model loaded" button: ${!hasNoModelButton}`);

    // Test 5: Upload current state image
    console.log('\n📤 Test 5: Uploading current state image...');
    const currentImageInput = await page.locator('#current-image-input');
    await currentImageInput.setInputFiles('/tmp/current_state.png');
    await page.waitForTimeout(1000);

    const currentImageUploaded = await page.locator('text=Current image uploaded').isVisible();
    testResults.push({ test: 'Upload - Current Image', status: currentImageUploaded ? '✅' : '❌' });
    console.log(`✅ Current image uploaded: ${currentImageUploaded}`);

    // Test 6: Upload goal state image
    console.log('\n📤 Test 6: Uploading goal state image...');
    const goalImageInput = await page.locator('#goal-image-input');
    await goalImageInput.setInputFiles('/tmp/goal_state.png');
    await page.waitForTimeout(1000);

    const goalImageUploaded = await page.locator('text=Goal image uploaded').isVisible();
    testResults.push({ test: 'Upload - Goal Image', status: goalImageUploaded ? '✅' : '❌' });
    console.log(`✅ Goal image uploaded: ${goalImageUploaded}`);

    // Test 7: Take screenshot of setup
    console.log('\n📸 Test 7: Capturing screenshots...');
    await page.screenshot({ path: '/tmp/test-setup-complete.png', fullPage: true });
    console.log('✅ Screenshot saved: /tmp/test-setup-complete.png');

    // Test 8: Check Generate Plan button is enabled
    console.log('\n🚀 Test 8: Checking Generate Plan button...');
    const generateButton = await page.locator('button:has-text("Generate Plan")');
    const isEnabled = await generateButton.isEnabled();
    testResults.push({ test: 'Generate Button - Enabled', status: isEnabled ? '✅' : '❌' });
    console.log(`✅ Generate Plan button enabled: ${isEnabled}`);

    // Test 9: Click Generate Plan (if you want to actually run planning)
    console.log('\n🎯 Test 9: Starting planning...');
    if (isEnabled) {
      await generateButton.click();
      await page.waitForTimeout(2000);

      // Check if processing started
      const processingStarted = await page.locator('text=Processing').isVisible() ||
                                await page.locator('text=Loading Model').isVisible();
      testResults.push({ test: 'Planning - Started', status: processingStarted ? '✅' : '❌' });
      console.log(`✅ Planning started: ${processingStarted}`);

      // Wait a bit and take a screenshot
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/test-planning-in-progress.png', fullPage: true });
      console.log('✅ Planning screenshot: /tmp/test-planning-in-progress.png');

      // Note: We won't wait for completion as it may take a while
      // Click cancel to stop the planning
      const cancelButton = await page.locator('button:has-text("Cancel")');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        await page.waitForTimeout(1000);
        console.log('✅ Planning cancelled');
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    testResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.test.padEnd(35)} ${result.status}`);
    });
    console.log('='.repeat(60));

    const passedTests = testResults.filter(r => r.status === '✅').length;
    const totalTests = testResults.length;
    console.log(`\n✅ Passed: ${passedTests}/${totalTests}`);

    if (passedTests === totalTests) {
      console.log('\n🎉 ALL TESTS PASSED!');
    } else {
      console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed`);
    }

    // Keep browser open for inspection
    console.log('\n⏳ Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    await page.screenshot({ path: '/tmp/test-error.png', fullPage: true });
    console.log('Error screenshot: /tmp/test-error.png');
    testResults.push({ test: 'Execution', status: '❌' });
  } finally {
    await browser.close();
    console.log('\n👋 Test complete. Browser closed.');
  }
}

runE2ETest().catch(console.error);
