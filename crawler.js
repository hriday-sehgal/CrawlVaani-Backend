import axios from "axios";
import * as cheerio from "cheerio";
import XLSX from "xlsx";
import { isUri } from "valid-url";
import pLimit from "p-limit";
import puppeteer from "puppeteer";
import lighthouse from "lighthouse";
import analyzeKeywords from "./utils/keywordDensity.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Rate limiting and performance settings
const MAX_PAGES = 50000; // Free tier limit
const CONCURRENT_REQUESTS = 15; // Reduced for better performance
const REQUEST_TIMEOUT = 15000; // 15 seconds
const PUPPETEER_TIMEOUT = 60000; // 60 seconds
const RATE_LIMIT_DELAY = 100; // 100ms between requests

// Global state
const visited = new Set();
const workingLinks = [];
const brokenLinks = [];
const seoInsights = [];
const imageAlts = [];
const keywordStats = [];
const externalLinks = [];
const missingAnchorTexts = [];
const accessibilityIssues = [];
const metaTagAudit = [];
const structuredData = [];
const technicalSeo = [];
const ogTags = [];
const metaTags = [];
const pagePerformanceMetrics = [];
const webCoreVitals = [];
const duplicateContentIssues = [];
const contentHashes = new Map(); // url -> hash
const brokenResources = [];
const sitemapRobotsInfo = [];
const missingSeoIssues = [];
let pagesScanned = 0; // Track total pages scanned

// Rate limiting
const crawlLimit = pLimit(CONCURRENT_REQUESTS);
let requestCount = 0;
const startTime = Date.now();

// Performance monitoring
const performanceMetrics = {
  startTime: Date.now(),
  pagesCrawled: 0,
  errors: 0,
  averageResponseTime: 0,
  totalResponseTime: 0,
};

// Lighthouse configuration
const lighthouseConfig = {
  extends: "lighthouse:default",
  settings: {
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    formFactor: "desktop",
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    emulatedUserAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  },
};

function autoFitColumns(data) {
  const cols = Object.keys(data[0] || {});
  return cols.map((col) => ({
    wch: Math.min(
      Math.max(
        col.length,
        ...data.map((row) => (row[col] ? String(row[col]).length : 0))
      ) + 2,
      50
    ),
  }));
}

function capitalizeHeaders(ws) {
  Object.keys(ws)
    .filter((k) => k.match(/^[A-Z]+1$/))
    .forEach((cell) => {
      const val = ws[cell].v;
      ws[cell].v = String(val).toUpperCase();
      ws[cell].s = {
        font: { bold: true },
        alignment: { horizontal: "center" },
      };
    });
}

function formatSheet(data) {
  const ws = XLSX.utils.json_to_sheet(data, { skipHeader: false });
  if (data.length > 0) {
    ws["!cols"] = autoFitColumns(data);
    capitalizeHeaders(ws);
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let R = 1; R <= range.e.r; ++R) {
      for (let C = 0; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell) {
          cell.s = cell.s || {};
          cell.s.fill = cell.s.fill || {};
          if (R % 2 === 0) {
            cell.s.fill.fgColor = { rgb: "F3F4F6" };
          } else {
            cell.s.fill.fgColor = { rgb: "FFFFFF" };
          }
        }
      }
    }
  }
  return ws;
}

// Enhanced meta tag extraction
function extractMetaTags($, currentUrl) {
  const metaTags = [];
  const ogTags = [];

  // Extract all meta tags
  $("meta").each((_, el) => {
    const $el = $(el);
    const name = $el.attr("name") || $el.attr("property") || "";
    const content = $el.attr("content") || "";
    const charset = $el.attr("charset") || "";

    if (name || charset) {
      metaTags.push({
        url: currentUrl,
        name: name || "charset",
        content: content || charset,
        type: name.startsWith("og:")
          ? "Open Graph"
          : name.startsWith("twitter:")
          ? "Twitter"
          : name.startsWith("fb:")
          ? "Facebook"
          : "Standard",
      });
    }
  });

  // Extract Open Graph tags specifically
  $('meta[property^="og:"]').each((_, el) => {
    const $el = $(el);
    ogTags.push({
      url: currentUrl,
      property: $el.attr("property"),
      content: $el.attr("content") || "",
      type: "Open Graph",
    });
  });

  return { metaTags, ogTags };
}

// Enhanced link extraction with better filtering
function extractLinks($, currentUrl, base) {
  const links = [];
  const internalLinks = [];
  const externalLinks = [];

  $("a[href]").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href")?.split("#")[0].trim();
    const text = $el.text().trim();

    if (
      !href ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      return;
    }

    let fullHref = href;
    if (!href.startsWith("http")) {
      try {
        fullHref = new URL(href, base).href;
      } catch (e) {
        return; // Skip invalid URLs
      }
    }

    const linkData = {
      from: currentUrl,
      to: fullHref,
      text: text,
      hasText: text.length > 0,
      isInternal: fullHref.startsWith(base),
    };

    links.push(linkData);

    if (fullHref.startsWith(base)) {
      internalLinks.push(fullHref);
    } else {
      externalLinks.push(linkData);
    }
  });

  return { links, internalLinks, externalLinks };
}

async function crawlPage(currentUrl, queue, base, mainPageUrl, baseDomain) {
  if (visited.has(currentUrl) || visited.size >= MAX_PAGES) return;

  visited.add(currentUrl);
  pagesScanned++; // Increment pages scanned counter
  performanceMetrics.pagesCrawled++;

  console.log(`🌐 Crawling: ${currentUrl} (${visited.size}/${MAX_PAGES})`);

  const pageStartTime = Date.now();
  let html = "";
  let $;
  let browser = null;

  try {
    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));

    // Use Puppeteer for JavaScript-heavy sites
    browser = await puppeteer.launch({
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
        "--disable-web-security",
        "--disable-xss-auditor",
        "--force-color-profile=srgb",
        "--metrics-recording-only",
        "--no-default-browser-check",
        "--no-first-run",
        "--no-pings",
        "--no-zygote",
        "--password-store=basic",
        "--use-mock-keychain",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=VizDisplayCompositor",
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });

    const page = await browser.newPage();

    // Set user agent and viewport
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate with timeout
    await page.goto(currentUrl, {
      waitUntil: "domcontentloaded",
      timeout: PUPPETEER_TIMEOUT,
    });

    // Wait for content to load using proper delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    html = await page.content();
    $ = cheerio.load(html);

    // --- Duplicate Content Detection ---
    const mainText = $("body").text().replace(/\s+/g, " ").trim().toLowerCase();
    const hash = crypto.createHash("sha256").update(mainText).digest("hex");
    if (contentHashes.has(hash)) {
      duplicateContentIssues.push({
        url: currentUrl,
        duplicateOf: contentHashes.get(hash),
        issue: "Duplicate content detected",
      });
    } else {
      // Check for near-duplicates (simple Jaccard similarity)
      let foundNear = false;
      for (const [prevHash, prevUrl] of contentHashes.entries()) {
        const prevText = prevHash; // Not storing text for memory, so skip for now
        // For advanced: store text, compute similarity
      }
      contentHashes.set(hash, currentUrl);
    }
    // --- Enhanced Accessibility & SEO Audits ---
    // Accessibility: missing alt, missing labels, heading structure
    $("input, textarea, select").each((_, el) => {
      if (
        !$(el).attr("aria-label") &&
        !$(el).attr("aria-labelledby") &&
        !$(el).attr("id")
      ) {
        accessibilityIssues.push({
          page: currentUrl,
          issue: "Form element missing label or aria attributes",
          type: "accessibility",
        });
      }
    });
    // Heading structure: check for skipped heading levels
    const headings = $("h1, h2, h3, h4, h5, h6")
      .map((_, el) => parseInt(el.tagName[1]))
      .get();
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] - headings[i - 1] > 1) {
        accessibilityIssues.push({
          page: currentUrl,
          issue: `Skipped heading level from h${headings[i - 1]} to h${
            headings[i]
          }`,
          type: "accessibility",
        });
      }
    }
    // SEO: missing title, description, canonical, lang
    if (!$("title").text().trim()) {
      missingSeoIssues.push({
        url: currentUrl,
        issue: "Missing <title> tag",
        type: "seo",
      });
    } else {
      // Title Tag Length Check
      const title = $("title").text().trim();
      const titleLength = title.length;
      if (titleLength < 50) {
        missingSeoIssues.push({
          url: currentUrl,
          issue: `Title tag too short: ${titleLength} characters (should be 50-60)`,
          type: "seo",
        });
      } else if (titleLength > 60) {
        missingSeoIssues.push({
          url: currentUrl,
          issue: `Title tag too long: ${titleLength} characters (should be 50-60)`,
          type: "seo",
        });
      }
    }
    if (!$('meta[name="description"]').attr("content")) {
      missingSeoIssues.push({
        url: currentUrl,
        issue: "Missing meta description",
        type: "seo",
      });
    } else {
      // Meta Description Length Check
      const description = $('meta[name="description"]').attr("content");
      const descLength = description.length;
      if (descLength < 120) {
        missingSeoIssues.push({
          url: currentUrl,
          issue: `Meta description too short: ${descLength} characters (should be 120-160)`,
          type: "seo",
        });
      } else if (descLength > 160) {
        missingSeoIssues.push({
          url: currentUrl,
          issue: `Meta description too long: ${descLength} characters (should be 120-160)`,
          type: "seo",
        });
      }
    }
    if (!$('link[rel="canonical"]').attr("href")) {
      missingSeoIssues.push({
        url: currentUrl,
        issue: "Missing canonical tag",
        type: "seo",
      });
    }
    if (!$("html").attr("lang")) {
      missingSeoIssues.push({
        url: currentUrl,
        issue: "Missing lang attribute on <html>",
        type: "seo",
      });
    }

    // Extract links using Puppeteer for better accuracy
    const links = await page.$$eval("a[href]", (anchors) =>
      anchors
        .map((a) => {
          const href = a.getAttribute("href");
          const text = a.textContent?.trim() || "";
          return { href, text };
        })
        .filter((item) => item.href && item.href.trim())
    );

    // Process links
    links.forEach(({ href, text }) => {
      const cleaned = href.split("#")[0].trim();
      if (
        !cleaned ||
        cleaned.startsWith("mailto:") ||
        cleaned.startsWith("tel:") ||
        cleaned.startsWith("javascript:") ||
        cleaned.startsWith("data:") ||
        cleaned.startsWith("blob:")
      ) {
        return;
      }

      let fullHref = cleaned;
      if (!cleaned.startsWith("http")) {
        try {
          fullHref = new URL(cleaned, base).href;
        } catch (e) {
          return;
        }
      }

      // Process internal links
      if (fullHref.startsWith(base) || fullHref.startsWith(baseDomain)) {
        if (visited.size < MAX_PAGES) {
          if (!visited.has(fullHref) && !queue.includes(fullHref)) {
            queue.push(fullHref);
          }
        }
      } else if (
        !fullHref.startsWith(base) &&
        !fullHref.startsWith(baseDomain)
      ) {
        externalLinks.push({ from: currentUrl, to: fullHref });
      }
    });

    // Extract all meta tags and OG tags from Puppeteer content
    const { metaTags: pageMetaTags, ogTags: pageOgTags } = extractMetaTags(
      $,
      currentUrl
    );
    metaTags.push(...pageMetaTags);
    ogTags.push(...pageOgTags);

    // Enhanced SEO data extraction from Puppeteer content
    const title = $("title").text().trim();
    const description = $('meta[name="description"]').attr("content") || "";
    const h1Count = $("h1").length;
    const canonical = $('link[rel="canonical"]').attr("href") || "";
    const ogTitle = $('meta[property="og:title"]').attr("content") || "";
    const ogImage = $('meta[property="og:image"]').attr("content") || "";
    const ogDescription =
      $('meta[property="og:description"]').attr("content") || "";
    const ogType = $('meta[property="og:type"]').attr("content") || "";
    const ogUrl = $('meta[property="og:url"]').attr("content") || "";
    const twitterCard = $('meta[name="twitter:card"]').attr("content") || "";
    const twitterTitle = $('meta[name="twitter:title"]').attr("content") || "";
    const twitterDescription =
      $('meta[name="twitter:description"]').attr("content") || "";
    const twitterImage = $('meta[name="twitter:image"]').attr("content") || "";
    const robots = $('meta[name="robots"]').attr("content") || "";
    const viewport = $('meta[name="viewport"]').attr("content") || "";
    const favicon = $('link[rel="icon"]').attr("href") || "";
    const language = $("html").attr("lang") || "";
    const charset = $("meta[charset]").attr("charset") || "";

    seoInsights.push({
      url: currentUrl,
      title,
      description,
      h1Count,
      canonical,
      ogTitle,
      ogImage,
      ogDescription,
      ogType,
      ogUrl,
      twitterCard,
      twitterTitle,
      twitterDescription,
      twitterImage,
      robots,
      viewport,
      favicon,
      language,
      charset,
      wordCount: $("body").text().split(/\s+/).length,
      imageCount: $("img").length,
      linkCount: $("a").length,
    });

    metaTagAudit.push({
      url: currentUrl,
      keywords: $('meta[name="keywords"]').attr("content") || "",
      author: $('meta[name="author"]').attr("content") || "",
      language: language,
      charset: charset,
      viewport: viewport,
      robots: robots,
      canonical: canonical,
    });

    technicalSeo.push({
      url: currentUrl,
      httpRedirect: currentUrl.startsWith("https") ? "Yes" : "No",
      canonicalMismatch: canonical && canonical !== currentUrl ? "Yes" : "No",
      hTagStructure: $("h1, h2, h3, h4, h5, h6")
        .map((_, el) => el.tagName)
        .get()
        .join(", "),
      duplicateTitle:
        title &&
        seoInsights.some((p) => p.title === title && p.url !== currentUrl)
          ? "Yes"
          : "No",
      duplicateDesc:
        description &&
        seoInsights.some(
          (p) => p.description === description && p.url !== currentUrl
        )
          ? "Yes"
          : "No",
      noindexNofollow: robots,
      viewportMeta: viewport,
      lazyImages: $('img[loading="lazy"]').length,
      hasStructuredData: $('script[type="application/ld+json"]').length > 0,
      hasSchema: $("[itemscope]").length > 0,
      hasOpenGraph: $('meta[property^="og:"]').length > 0,
      hasTwitterCards: $('meta[name^="twitter:"]').length > 0,
    });

    // Image analysis
    $("img").each((_, img) => {
      const src = $(img).attr("src");
      const alt = $(img).attr("alt") || "";
      const title = $(img).attr("title") || "";
      const loading = $(img).attr("loading") || "";
      const width = $(img).attr("width") || "";
      const height = $(img).attr("height") || "";

      imageAlts.push({
        page: currentUrl,
        src,
        alt,
        title,
        loading,
        width,
        height,
        hasAlt: alt.length > 0,
        hasTitle: title.length > 0,
      });

      if (!alt) {
        accessibilityIssues.push({
          page: currentUrl,
          issue: `Image missing alt text: ${src}`,
          type: "accessibility",
        });
      }
    });

    // Link analysis
    const {
      links: extractedLinks,
      internalLinks,
      externalLinks: pageExternalLinks,
    } = extractLinks($, currentUrl, base);
    externalLinks.push(...pageExternalLinks);

    $("a").each((_, a) => {
      const text = $(a).text().trim();
      const href = $(a).attr("href")?.split("#")[0].trim();
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:"))
        return;

      if (text.length === 0) {
        missingAnchorTexts.push({ page: currentUrl, link: href });
      }
    });

    // Structured data analysis
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonData = JSON.parse($(el).html());
        structuredData.push({
          page: currentUrl,
          type: "JSON-LD",
          schemaType: jsonData["@type"] || "Unknown",
          snippet: $(el).html().slice(0, 200),
        });
      } catch (e) {
        structuredData.push({
          page: currentUrl,
          type: "JSON-LD",
          schemaType: "Invalid JSON",
          snippet: $(el).html().slice(0, 200),
        });
      }
    });

    $("[itemscope]").each((_, el) => {
      structuredData.push({
        page: currentUrl,
        type: "Microdata",
        tag: $(el).get(0).tagName,
        itemType: $(el).attr("itemtype") || "Unknown",
      });
    });

    // Keyword analysis
    const bodyText = $("body").text().replace(/\s+/g, " ");
    const keywords = analyzeKeywords(bodyText, 20);
    keywords.forEach((k) =>
      keywordStats.push({ url: currentUrl, keyword: k.keyword, count: k.count })
    );

    // --- Broken Resource Detection ---
    // Images
    const resourceChecks = [];
    $("img").each((_, img) => {
      const src = $(img).attr("src");
      if (src) {
        let fullSrc = src;
        if (!src.startsWith("http")) {
          try {
            fullSrc = new URL(src, currentUrl).href;
          } catch {}
        }
        resourceChecks.push(
          axios.head(fullSrc, { timeout: 5000 }).catch((err) => {
            brokenResources.push({
              url: currentUrl,
              resource: fullSrc,
              type: "image",
              status: err.response?.status || err.code || "error",
            });
          })
        );
      }
    });
    // Scripts
    $("script[src]").each((_, script) => {
      const src = $(script).attr("src");
      if (src) {
        let fullSrc = src;
        if (!src.startsWith("http")) {
          try {
            fullSrc = new URL(src, currentUrl).href;
          } catch {}
        }
        resourceChecks.push(
          axios.head(fullSrc, { timeout: 5000 }).catch((err) => {
            brokenResources.push({
              url: currentUrl,
              resource: fullSrc,
              type: "script",
              status: err.response?.status || err.code || "error",
            });
          })
        );
      }
    });
    // CSS
    $("link[rel='stylesheet']").each((_, link) => {
      const href = $(link).attr("href");
      if (href) {
        let fullHref = href;
        if (!href.startsWith("http")) {
          try {
            fullHref = new URL(href, currentUrl).href;
          } catch {}
        }
        resourceChecks.push(
          axios.head(fullHref, { timeout: 5000 }).catch((err) => {
            brokenResources.push({
              url: currentUrl,
              resource: fullHref,
              type: "css",
              status: err.response?.status || err.code || "error",
            });
          })
        );
      }
    });
    await Promise.all(resourceChecks);

    // Update performance metrics
    const pageEndTime = Date.now();
    const pageResponseTime = pageEndTime - pageStartTime;
    performanceMetrics.totalResponseTime += pageResponseTime;
    performanceMetrics.averageResponseTime =
      performanceMetrics.totalResponseTime / performanceMetrics.pagesCrawled;

    // Only run Lighthouse for the main page
    if (currentUrl === mainPageUrl) {
      console.log(`🔍 Running Lighthouse analysis for ${currentUrl}...`);
      const lighthouseResults = await runLighthouseAnalysis(currentUrl);
      pagePerformanceMetrics.push(lighthouseResults);
      webCoreVitals.push({
        url: currentUrl,
        lcp: lighthouseResults.lcp,
        fid: lighthouseResults.fid,
        cls: lighthouseResults.cls,
        ttfb: lighthouseResults.ttfb,
        lcpStatus: lighthouseResults.lcpStatus,
        fidStatus: lighthouseResults.fidStatus,
        clsStatus: lighthouseResults.clsStatus,
        ttfbStatus: lighthouseResults.ttfbStatus,
      });
    }

    // Mark as working link
    workingLinks.push({ url: currentUrl, status: 200 });
  } catch (err) {
    performanceMetrics.errors++;
    const status =
      err.response?.status || err.code || err.message || "Unknown Error";
    brokenLinks.push({ url: currentUrl, status });
    console.log(`❌ Failed (Puppeteer): ${currentUrl} (${status})`);

    // Fallback to axios for failed Puppeteer requests
    try {
      const response = await axios.get(currentUrl, {
        timeout: REQUEST_TIMEOUT,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      $ = cheerio.load(response.data);
      workingLinks.push({ url: currentUrl, status: response.status });

      // Extract meta tags from fallback
      const { metaTags: pageMetaTags, ogTags: pageOgTags } = extractMetaTags(
        $,
        currentUrl
      );
      metaTags.push(...pageMetaTags);
      ogTags.push(...pageOgTags);

      // Basic SEO extraction for fallback
      const title = $("title").text().trim();
      const description = $('meta[name="description"]').attr("content") || "";
      const canonical = $('link[rel="canonical"]').attr("href") || "";

      seoInsights.push({
        url: currentUrl,
        title,
        description,
        h1Count: $("h1").length,
        canonical,
        ogTitle: $('meta[property="og:title"]').attr("content") || "",
        ogImage: $('meta[property="og:image"]').attr("content") || "",
        ogDescription:
          $('meta[property="og:description"]').attr("content") || "",
        ogType: $('meta[property="og:type"]').attr("content") || "",
        ogUrl: $('meta[property="og:url"]').attr("content") || "",
        twitterCard: $('meta[name="twitter:card"]').attr("content") || "",
        twitterTitle: $('meta[name="twitter:title"]').attr("content") || "",
        twitterDescription:
          $('meta[name="twitter:description"]').attr("content") || "",
        twitterImage: $('meta[name="twitter:image"]').attr("content") || "",
        robots: $('meta[name="robots"]').attr("content") || "",
        viewport: $('meta[name="viewport"]').attr("content") || "",
        favicon: $('link[rel="icon"]').attr("href") || "",
        language: $("html").attr("lang") || "",
        charset: $("meta[charset]").attr("charset") || "",
        wordCount: $("body").text().split(/\s+/).length,
        imageCount: $("img").length,
        linkCount: $("a").length,
      });
    } catch (axiosErr) {
      console.log(`❌ Failed (axios fallback): ${currentUrl}`);
    }
  } finally {
    // Always close the browser
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.log(`⚠️ Error closing browser: ${closeErr.message}`);
      }
    }
  }
}

// Function to run Lighthouse analysis
async function runLighthouseAnalysis(url) {
  try {
    const { launch } = await import("chrome-launcher");
    const chrome = await launch({
      chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
    });

    const options = {
      logLevel: "info",
      output: "json",
      port: chrome.port,
      ...lighthouseConfig,
    };

    const runnerResult = await lighthouse(url, options);
    const reportResults = runnerResult.lhr;

    await chrome.kill();

    // Extract Web Core Vitals
    const lcp =
      reportResults.audits["largest-contentful-paint"]?.numericValue || 0;
    const fid = reportResults.audits["max-potential-fid"]?.numericValue || 0;
    const cls =
      reportResults.audits["cumulative-layout-shift"]?.numericValue || 0;
    const ttfb =
      reportResults.audits["server-response-time"]?.numericValue || 0;

    // Extract performance scores
    const performanceScore = Math.round(
      reportResults.categories.performance.score * 100
    );
    const accessibilityScore = Math.round(
      reportResults.categories.accessibility.score * 100
    );
    const bestPracticesScore = Math.round(
      reportResults.categories["best-practices"].score * 100
    );
    const seoScore = Math.round(reportResults.categories.seo.score * 100);

    // Extract additional performance metrics
    const firstContentfulPaint =
      reportResults.audits["first-contentful-paint"]?.numericValue || 0;
    const speedIndex = reportResults.audits["speed-index"]?.numericValue || 0;
    const totalBlockingTime =
      reportResults.audits["total-blocking-time"]?.numericValue || 0;
    const timeToInteractive =
      reportResults.audits["interactive"]?.numericValue || 0;

    return {
      url,
      lcp: Math.round(lcp),
      fid: Math.round(fid),
      cls: cls.toFixed(3),
      ttfb: Math.round(ttfb),
      performanceScore,
      accessibilityScore,
      bestPracticesScore,
      seoScore,
      firstContentfulPaint: Math.round(firstContentfulPaint),
      speedIndex: Math.round(speedIndex),
      totalBlockingTime: Math.round(totalBlockingTime),
      timeToInteractive: Math.round(timeToInteractive),
      lcpStatus:
        lcp <= 2500 ? "Good" : lcp <= 4000 ? "Needs Improvement" : "Poor",
      fidStatus:
        fid <= 100 ? "Good" : fid <= 300 ? "Needs Improvement" : "Poor",
      clsStatus:
        cls <= 0.1 ? "Good" : cls <= 0.25 ? "Needs Improvement" : "Poor",
      ttfbStatus:
        ttfb <= 800 ? "Good" : ttfb <= 1800 ? "Needs Improvement" : "Poor",
    };
  } catch (error) {
    console.log(`❌ Lighthouse analysis failed for ${url}: ${error.message}`);
    return {
      url,
      lcp: 0,
      fid: 0,
      cls: 0,
      ttfb: 0,
      performanceScore: 0,
      accessibilityScore: 0,
      bestPracticesScore: 0,
      seoScore: 0,
      firstContentfulPaint: 0,
      speedIndex: 0,
      totalBlockingTime: 0,
      timeToInteractive: 0,
      lcpStatus: "Failed",
      fidStatus: "Failed",
      clsStatus: "Failed",
      ttfbStatus: "Failed",
    };
  }
}

export async function runCrawl(targetUrl, outputDir = "reports") {
  // Reset all stateful arrays and sets
  visited.clear();
  workingLinks.length = 0;
  brokenLinks.length = 0;
  seoInsights.length = 0;
  imageAlts.length = 0;
  keywordStats.length = 0;
  externalLinks.length = 0;
  missingAnchorTexts.length = 0;
  accessibilityIssues.length = 0;
  metaTagAudit.length = 0;
  structuredData.length = 0;
  technicalSeo.length = 0;
  ogTags.length = 0;
  metaTags.length = 0;
  pagePerformanceMetrics.length = 0;
  webCoreVitals.length = 0;
  duplicateContentIssues.length = 0;
  brokenResources.length = 0;
  sitemapRobotsInfo.length = 0;
  missingSeoIssues.length = 0;
  pagesScanned = 0; // Reset pages scanned counter

  // Reset performance metrics
  performanceMetrics.startTime = Date.now();
  performanceMetrics.pagesCrawled = 0;
  performanceMetrics.errors = 0;
  performanceMetrics.totalResponseTime = 0;
  performanceMetrics.averageResponseTime = 0;

  const base = targetUrl.endsWith("/") ? targetUrl : targetUrl + "/";

  // Also create a base domain for better link matching
  const baseDomain = new URL(targetUrl).origin;

  async function generateReport() {
    console.log(`🔍 Starting crawl of ${base}... (Max ${MAX_PAGES} pages)`);
    const queue = [base];

    try {
      await axios.get(base + "robots.txt");
      seoInsights.push({ url: base + "robots.txt", note: "robots.txt found" });
      sitemapRobotsInfo.push({ url: base + "robots.txt", status: "found" });
    } catch {
      seoInsights.push({
        url: base + "robots.txt",
        note: "robots.txt missing",
      });
      sitemapRobotsInfo.push({ url: base + "robots.txt", status: "missing" });
    }

    try {
      await axios.get(base + "sitemap.xml");
      seoInsights.push({
        url: base + "sitemap.xml",
        note: "sitemap.xml found",
      });
      sitemapRobotsInfo.push({ url: base + "sitemap.xml", status: "found" });
    } catch {
      seoInsights.push({
        url: base + "sitemap.xml",
        note: "sitemap.xml missing",
      });
      sitemapRobotsInfo.push({ url: base + "sitemap.xml", status: "missing" });
    }

    while (queue.length > 0 && visited.size < MAX_PAGES) {
      const batch = queue.splice(0, CONCURRENT_REQUESTS);
      await Promise.all(
        batch.map((link) =>
          crawlLimit(() => crawlPage(link, queue, base, base, baseDomain))
        )
      );
    }

    console.log(
      `\n✅ Crawl completed! Pages crawled: ${visited.size}/${MAX_PAGES}`
    );
    console.log(`📊 Total pages scanned: ${pagesScanned}`);
    console.log(
      `⏱️  Total time: ${(
        (Date.now() - performanceMetrics.startTime) /
        1000
      ).toFixed(2)}s`
    );
    console.log(
      `📊 Average response time: ${performanceMetrics.averageResponseTime.toFixed(
        2
      )}ms`
    );
    console.log(`❌ Errors: ${performanceMetrics.errors}`);

    const wb = XLSX.utils.book_new();
    const sheets = [
      {
        name: "Crawl Summary",
        data: [
          {
            "Pages Scanned": pagesScanned,
            "Working Links": workingLinks.length,
            "Broken Links": brokenLinks.length,
            "Total Time (seconds)": (
              (Date.now() - performanceMetrics.startTime) /
              1000
            ).toFixed(2),
            "Average Response Time (ms)":
              performanceMetrics.averageResponseTime.toFixed(2),
            Errors: performanceMetrics.errors,
            "Max Pages Limit": MAX_PAGES,
          },
        ],
      },
      { name: "Working Links", data: workingLinks },
      { name: "Broken Links", data: brokenLinks },
      { name: "SEO Info", data: seoInsights },
      { name: "Meta Tag Audit", data: metaTagAudit },
      { name: "Open Graph Tags", data: ogTags },
      { name: "All Meta Tags", data: metaTags },
      { name: "Image ALT Tags", data: imageAlts },
      { name: "Missing Anchors", data: missingAnchorTexts },
      { name: "Accessibility Issues", data: accessibilityIssues },
      { name: "Keyword Density", data: keywordStats },
      { name: "External Links", data: externalLinks },
      { name: "Structured Data", data: structuredData },
      { name: "Technical SEO", data: technicalSeo },
      { name: "Performance Metrics", data: pagePerformanceMetrics },
      { name: "Web Core Vitals", data: webCoreVitals },
      { name: "Duplicate Content", data: duplicateContentIssues },
      { name: "Broken Resources", data: brokenResources },
      { name: "Sitemap & robots.txt", data: sitemapRobotsInfo },
      { name: "Missing SEO Issues", data: missingSeoIssues },
    ];

    sheets.forEach(({ name, data }) => {
      if (data.length > 0) {
        const ws = formatSheet(data);
        XLSX.utils.book_append_sheet(wb, ws, name);
      }
    });

    const reportsDir = path.join(process.cwd(), outputDir);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir);
    }

    const { hostname } = new URL(base);
    const sanitizedHost = hostname.replace(/\./g, "-");
    const timestamp = new Date()
      .toISOString()
      .replace(/[:T]/g, "-")
      .split(".")[0];
    const fileName = `SEO-Report-${sanitizedHost}-${timestamp}.xlsx`;
    const filePath = path.join(reportsDir, fileName);
    XLSX.writeFile(wb, filePath);
    console.log(`✅ Report saved as ${filePath}`);
    return filePath;
  }

  return await generateReport();
}

// Export all data arrays for the dashboard
export {
  workingLinks,
  brokenLinks,
  seoInsights,
  metaTagAudit,
  imageAlts,
  missingAnchorTexts,
  accessibilityIssues,
  keywordStats,
  externalLinks,
  structuredData,
  technicalSeo,
  ogTags,
  metaTags,
  pagePerformanceMetrics,
  webCoreVitals,
  performanceMetrics,
  pagesScanned,
  duplicateContentIssues,
  brokenResources,
  sitemapRobotsInfo,
  missingSeoIssues,
};
