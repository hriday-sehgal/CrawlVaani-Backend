#!/usr/bin/env node

import fetch from "node-fetch";

const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testCORS(backendUrl) {
  log("\n🔧 Testing CORS Configuration...", "blue");

  try {
    // Test basic connectivity
    const response = await fetch(backendUrl);
    if (response.ok) {
      log("✅ Backend is accessible", "green");
    } else {
      log(`❌ Backend returned status: ${response.status}`, "red");
      return false;
    }

    // Test CORS preflight request
    const corsResponse = await fetch(`${backendUrl}/api/crawl`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://crawlvaani.vercel.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    if (corsResponse.ok) {
      log("✅ CORS preflight request successful", "green");
      log(
        `Access-Control-Allow-Origin: ${corsResponse.headers.get(
          "access-control-allow-origin"
        )}`,
        "yellow"
      );
      log(
        `Access-Control-Allow-Methods: ${corsResponse.headers.get(
          "access-control-allow-methods"
        )}`,
        "yellow"
      );
      log(
        `Access-Control-Allow-Headers: ${corsResponse.headers.get(
          "access-control-allow-headers"
        )}`,
        "yellow"
      );
    } else {
      log(`❌ CORS preflight failed: ${corsResponse.status}`, "red");
    }

    // Test actual POST request
    const postResponse = await fetch(`${backendUrl}/api/crawl`, {
      method: "POST",
      headers: {
        Origin: "https://crawlvaani.vercel.app",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com" }),
    });

    if (postResponse.ok || postResponse.status === 429) {
      log("✅ POST request successful (rate limit expected)", "green");
    } else {
      log(`❌ POST request failed: ${postResponse.status}`, "red");
    }

    return true;
  } catch (error) {
    log(`❌ CORS test failed: ${error.message}`, "red");
    return false;
  }
}

async function main() {
  log("🚀 CORS Test for CrawlVaani Backend", "blue");
  log("==============================", "blue");

  const backendUrl =
    process.argv[2] || "https://crawlvaani-backend.onrender.com";

  log(`\n📋 Testing backend: ${backendUrl}`, "yellow");

  const corsOk = await testCORS(backendUrl);

  log("\n📊 Test Results:", "blue");
  log(`CORS: ${corsOk ? "✅ PASS" : "❌ FAIL"}`, corsOk ? "green" : "red");

  if (corsOk) {
    log("\n🎉 CORS is configured correctly!", "green");
    log(
      "🌐 Your frontend should be able to communicate with the backend.",
      "blue"
    );
  } else {
    log("\n❌ CORS configuration needs attention.", "red");
    log("📚 Check the backend logs and CORS configuration.", "yellow");
  }
}

main().catch(console.error);
