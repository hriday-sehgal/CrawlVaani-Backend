#!/usr/bin/env node

import puppeteer from "puppeteer";

async function testPuppeteer() {
  console.log("🧪 Testing Puppeteer on Render...");

  let browser = null;

  try {
    const puppeteerOptions = {
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-field-trial-config",
        "--disable-ipc-flooding-protection",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--disable-translate",
        "--hide-scrollbars",
        "--mute-audio",
        "--no-default-browser-check",
        "--safebrowsing-disable-auto-update",
        "--disable-client-side-phishing-detection",
        "--disable-component-update",
        "--disable-domain-reliability",
        "--disable-features=TranslateUI",
        "--disable-llm",
        "--disable-logging",
        "--disable-notifications",
        "--disable-popup-blocking",
        "--disable-prompt-on-repost",
        "--disable-sync-preferences",
        "--disable-web-resources",
        "--disable-xss-auditor",
        "--force-color-profile=srgb",
        "--metrics-recording-only",
        "--no-pings",
        "--password-store=basic",
        "--use-mock-keychain",
        "--disable-blink-features=AutomationControlled",
        "--single-process",
        "--disable-gpu-sandbox",
        "--disable-software-rasterizer",
      ],
    };

    // Try to find Chrome executable in common locations
    const possiblePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/opt/google/chrome/chrome",
      "/opt/google/chrome/chrome-linux/chrome",
    ];

    // Check if any of the possible paths exist
    for (const path of possiblePaths) {
      if (path && require("fs").existsSync(path)) {
        puppeteerOptions.executablePath = path;
        console.log(`✅ Found Chrome at: ${path}`);
        break;
      }
    }

    // If no Chrome found, try to use system Chrome
    if (!puppeteerOptions.executablePath) {
      console.log("🔍 No Chrome executable found, trying system Chrome...");
      try {
        const { execSync } = require("child_process");
        const chromePath = execSync(
          "which google-chrome || which chromium-browser || which chromium",
          { encoding: "utf8" }
        ).trim();
        if (chromePath) {
          puppeteerOptions.executablePath = chromePath;
          console.log(`✅ Using system Chrome: ${chromePath}`);
        }
      } catch (error) {
        console.log(
          "⚠️ No system Chrome found, using default Puppeteer Chrome"
        );
      }
    }

    console.log("🚀 Launching Puppeteer...");
    browser = await puppeteer.launch(puppeteerOptions);
    console.log("✅ Puppeteer launched successfully");

    const page = await browser.newPage();
    console.log("📄 Created new page");

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );
    console.log("👤 Set user agent");

    await page.goto("https://example.com", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    console.log("🌐 Navigated to example.com");

    const title = await page.title();
    console.log(`📝 Page title: ${title}`);

    const content = await page.content();
    console.log(`📄 Page content length: ${content.length} characters`);

    console.log("✅ All tests passed! Puppeteer is working correctly.");
  } catch (error) {
    console.error(`❌ Puppeteer test failed: ${error.message}`);
    console.log(
      "🔄 This means the crawler will fall back to basic HTTP requests"
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log("🔒 Browser closed successfully");
      } catch (error) {
        console.log(`⚠️ Error closing browser: ${error.message}`);
      }
    }
  }
}

testPuppeteer().catch(console.error);
