import express from "express";
import cors from "cors";
import path from "path";
import { runCrawl } from "./crawler.js";
// Import the raw data arrays for dashboard
import {
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
} from "./crawler.js";
import PDFDocument from "pdfkit";
import { Readable } from "stream";
// Import report consolidation utilities
import {
  getAllReportFiles,
  extractReportData,
  consolidateReports,
  generateActionableInsights,
  generatePDFReport,
  createConsolidatedExcelReport,
  generateIndividualPDFReport,
} from "./utils/reportConsolidator.js";
import { generateSEOChecklistPDF } from "./utils/seoChecklistGenerator.js";
import XLSX from "xlsx";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 4000;

// OpenRouter AI API Configuration
const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || "your-api-key-here";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Gemini API Configuration for fallback
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "your-gemini-key-here";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Check if Gemini API key is configured
if (GEMINI_API_KEY === "your-gemini-key-here") {
  console.warn(
    "⚠️  WARNING: Gemini API key not configured. Please set GEMINI_API_KEY environment variable."
  );
}

// AI Analysis timeout configuration
const AI_ANALYSIS_TIMEOUT = 300000; // 5 minutes timeout for AI analysis

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 5; // 5 requests per hour per IP

// Rate limiting middleware
const rateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 0, resetTime: now + RATE_LIMIT_WINDOW });
  }

  const userData = requestCounts.get(ip);

  if (now > userData.resetTime) {
    userData.count = 0;
    userData.resetTime = now + RATE_LIMIT_WINDOW;
  }

  if (userData.count >= MAX_REQUESTS_PER_HOUR) {
    return res.status(429).json({
      error:
        "Rate limit exceeded. Maximum 5 requests per hour. Please try again later.",
    });
  }

  userData.count++;
  next();
};

// Clean up old rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // List of allowed origins
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://crawlvaani.vercel.app",
      "https://*.vercel.app",
      "https://*.onrender.com",
      "https://crawlvaani-frontend.vercel.app",
      "https://crawlvaani-frontend.vercel.app/reports",
      "https://crawlvaani-frontend.onrender.com",
    ];

    // Check if origin is allowed
    const isAllowed = allowedOrigins.some((allowedOrigin) => {
      if (allowedOrigin.includes("*")) {
        // Handle wildcard domains
        const domain = allowedOrigin.replace("*.", "");
        return origin.endsWith(domain);
      }
      return origin === allowedOrigin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked request from: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
// Increased body size limits to handle large website crawl data (120+ pages)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve reports statically
app.use("/reports", express.static(path.join(process.cwd(), "reports")));

// AI Analysis Functions with Fallback
async function callOpenRouterAI(
  prompt,
  systemPrompt = "",
  useFallback = false
) {
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("AI analysis timeout")),
        AI_ANALYSIS_TIMEOUT
      );
    });

    let fetchPromise;

    if (useFallback) {
      // Use DeepSeek as fallback
      console.log("Using DeepSeek as fallback...");
      fetchPromise = fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://your-seo-crawler.com",
          "X-Title": "SEO Crawler AI Analysis",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1-0528:free",
          messages: [
            {
              role: "system",
              content:
                systemPrompt ||
                "You are an expert SEO consultant with 15+ years of experience in digital marketing and search engine optimization. Provide detailed, actionable insights in a professional, structured format. Use clear headings, bullet points, and specific recommendations. Always explain the 'why' behind your suggestions and provide implementation steps.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 3000,
        }),
      });
    } else {
      // Use Gemini as primary (better quality)
      console.log("Using Gemini 2.0 Flash as primary...");
      fetchPromise = fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${
                    systemPrompt ||
                    "You are an expert SEO consultant. Provide detailed, actionable insights in a professional, structured format."
                  }\n\n${prompt}`,
                },
              ],
            },
          ],
        }),
      });
    }

    // Race between fetch and timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      if (response.status === 429) {
        if (!useFallback) {
          console.log("Rate limit hit on Gemini, trying DeepSeek fallback...");
          return callOpenRouterAI(prompt, systemPrompt, true);
        }
        throw new Error(
          "Rate limit exceeded on both APIs. Please wait 30 seconds and try again."
        );
      }
      if (response.status === 503) {
        if (!useFallback) {
          console.log(
            "Service unavailable on Gemini, trying DeepSeek fallback..."
          );
          return callOpenRouterAI(prompt, systemPrompt, true);
        }
        throw new Error(
          "Both AI services are temporarily unavailable. Please try again later."
        );
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Check if this is a Gemini response (has candidates array)
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      if (
        !data.candidates[0].content.parts ||
        !data.candidates[0].content.parts[0]
      ) {
        console.error("Unexpected Gemini response structure:", data);
        throw new Error("Invalid Gemini API response format");
      }
      return data.candidates[0].content.parts[0].text;
    }
    // Check if this is an OpenRouter response (has choices array)
    else if (data.choices && data.choices[0] && data.choices[0].message) {
      console.log("Detected OpenRouter response format");
      return data.choices[0].message.content;
    }
    // Unknown response format
    else {
      console.error("Unknown API response structure:", data);
      throw new Error("Unknown API response format");
    }
  } catch (error) {
    console.error("AI API Error:", error);
    if (error.message === "AI analysis timeout") {
      throw new Error(
        "AI analysis timed out. The website data is too large. Please try with a smaller website or contact support."
      );
    }
    if (error.message.includes("Rate limit exceeded")) {
      if (!useFallback) {
        console.log("Rate limit error, trying DeepSeek fallback...");
        return callOpenRouterAI(prompt, systemPrompt, true);
      }
      throw new Error(
        "AI service is busy. Please wait 30 seconds and try again."
      );
    }
    throw new Error("AI analysis failed. Please try again later.");
  }
}

// Enhanced AI Content Quality Analysis
async function analyzeContentQuality(crawlData) {
  const prompt = `
You are conducting a comprehensive website audit for a client. Analyze this detailed crawl data and provide a professional, thorough assessment.

WEBSITE CRAWL SUMMARY:
- Total Pages Scanned: ${crawlData.pagesScanned || 0}
- Working Links Found: ${crawlData.workingLinks?.length || 0}
- Broken Links Found: ${crawlData.brokenLinks?.length || 0}
- External Links: ${crawlData.externalLinks?.length || 0}
- Duplicate Content Issues: ${crawlData.duplicateContentIssues?.length || 0}

CRITICAL SEO ISSUES:
${
  crawlData.missingSeoIssues
    ?.map((issue, index) => `${index + 1}. ${issue.issue} (URL: ${issue.url})`)
    .join("\n") || "No critical SEO issues detected"
}

TECHNICAL SEO ASSESSMENT:
${
  crawlData.technicalSeo
    ?.slice(0, 10)
    .map(
      (item) => `
Page: ${item.url}
- H-tag Structure: ${item.hTagStructure || "Not analyzed"}
- Open Graph Tags: ${item.hasOpenGraph ? "Present" : "Missing"}
- Twitter Cards: ${item.hasTwitterCards ? "Present" : "Missing"}
- Structured Data: ${item.hasStructuredData ? "Present" : "Missing"}
- Duplicate Title: ${item.duplicateTitle === "Yes" ? "CRITICAL ISSUE" : "No"}
- Duplicate Description: ${
        item.duplicateDesc === "Yes" ? "CRITICAL ISSUE" : "No"
      }
- Canonical Mismatch: ${item.canonicalMismatch === "Yes" ? "ISSUE" : "No"}`
    )
    .join("\n") || "No technical SEO data available"
}

KEYWORD ANALYSIS (Top 15):
${
  crawlData.keywordStats
    ?.slice(0, 15)
    .map(
      (kw, index) =>
        `${index + 1}. "${kw.keyword}": ${kw.count} occurrences (${
          kw.density
        }% density)`
    )
    .join("\n") || "No keyword data available"
}

ACCESSIBILITY ISSUES:
${
  crawlData.accessibilityIssues
    ?.slice(0, 10)
    .map((issue, index) => `${index + 1}. ${issue.issue} (Page: ${issue.page})`)
    .join("\n") || "No accessibility issues found"
}

PERFORMANCE METRICS:
${
  crawlData.pagePerformanceMetrics
    ?.map(
      (perf, index) => `
Page ${index + 1}: ${perf.url}
- Performance Score: ${perf.performanceScore}/100
- SEO Score: ${perf.seoScore}/100
- Accessibility Score: ${perf.accessibilityScore}/100
- Best Practices Score: ${perf.bestPracticesScore}/100`
    )
    .join("\n") || "No performance data available"
}

BROKEN RESOURCES:
${
  crawlData.brokenResources
    ?.slice(0, 10)
    .map(
      (resource, index) =>
        `${index + 1}. ${resource.type}: ${resource.resource} (Page: ${
          resource.url
        })`
    )
    .join("\n") || "No broken resources found"
}

DETAILED DATA ANALYSIS:
${
  crawlData.missingSeoIssues?.length > 0
    ? `Missing SEO Issues Found: ${crawlData.missingSeoIssues
        .slice(0, 10)
        .map((issue) => `- ${issue.issue || issue}`)
        .join("\n")}`
    : "No missing SEO issues detected"
}
${
  crawlData.technicalSeo?.length > 0
    ? `Technical SEO Issues: ${crawlData.technicalSeo
        .slice(0, 10)
        .map((issue) => `- ${issue.issue || issue}`)
        .join("\n")}`
    : "No technical SEO issues detected"
}
${
  crawlData.accessibilityIssues?.length > 0
    ? `Accessibility Issues: ${crawlData.accessibilityIssues
        .slice(0, 10)
        .map((issue) => `- ${issue.issue || issue}`)
        .join("\n")}`
    : "No accessibility issues detected"
}
${
  crawlData.brokenLinks?.length > 0
    ? `Broken Links Found: ${crawlData.brokenLinks
        .slice(0, 10)
        .map((link) => `- ${link.url || link}`)
        .join("\n")}`
    : "No broken links detected"
}

Based on this comprehensive data, provide a detailed analysis in the following structured format:

## EXECUTIVE SUMMARY
Provide a high-level overview of the website's current SEO health, major strengths, and critical weaknesses. Include specific metrics and data points from the crawl results. Analyze the overall content quality, technical performance, and user experience factors.

## CONTENT QUALITY ASSESSMENT
- Content Strategy Analysis: Evaluate the current content approach and identify gaps
- Content Gap Identification: Find missing content opportunities based on keyword analysis
- Content Optimization Opportunities: Specific improvements for existing content
- Keyword Strategy Evaluation: Assess keyword targeting and optimization
- Content Performance Metrics: Analyze content effectiveness

## TECHNICAL SEO ANALYSIS
- Technical Issues and Impact Assessment: Critical technical problems and their SEO impact
- Performance Optimization Opportunities: Speed and Core Web Vitals improvements
- Structured Data and Schema Recommendations: Schema markup opportunities
- Mobile Optimization Status: Mobile-friendliness assessment
- Core Web Vitals Analysis: Performance metrics evaluation

## USER EXPERIENCE EVALUATION
- Accessibility Compliance: WCAG compliance and accessibility issues
- Navigation Structure: Site architecture and internal linking
- Page Speed and Performance: Loading times and user experience
- Mobile Responsiveness: Mobile optimization status
- User Journey Optimization: Conversion path improvements

## CONTENT STRATEGY RECOMMENDATIONS
- Content Improvement Priorities: Top content optimization tasks
- Keyword Optimization Strategy: Keyword targeting and optimization
- Content Gap Filling: Missing content opportunities
- Content Calendar Suggestions: Content planning recommendations
- Content Performance Tracking: Analytics and measurement

## TECHNICAL IMPROVEMENTS
- Critical Technical Fixes: Immediate technical issues to address
- Performance Optimization Steps: Speed and performance improvements
- Schema Markup Implementation: Structured data opportunities
- Mobile Optimization Actions: Mobile-specific improvements
- Security and HTTPS Status: Security and trust signals

## COMPETITIVE POSITIONING
- Market Position Assessment: Current competitive standing
- Competitive Advantages: Unique strengths and differentiators
- Differentiation Opportunities: Ways to stand out from competitors
- Industry Benchmarking: Performance vs. industry standards

## ACTION PLAN
- Immediate Actions (Next 7 days): Critical fixes with immediate impact
- Short-term Improvements (30 days): Medium-priority optimizations
- Long-term Strategy (90 days): Strategic improvements and planning
- Success Metrics and KPIs: How to measure improvements

Please provide specific, actionable recommendations with clear implementation steps, expected impact, and timeline for each suggestion. Use professional language and structure the response with clear headings and bullet points. Include specific data points from the crawl results in your analysis. Focus on providing detailed, actionable insights that can be immediately implemented.
`;

  const systemPrompt = `You are a senior SEO consultant with 15+ years of experience in digital marketing and search engine optimization. You provide comprehensive, professional analysis that includes:

1. Detailed technical assessments
2. Strategic content recommendations
3. Performance optimization insights
4. Competitive positioning analysis
5. Actionable implementation plans

Always structure your response with clear headings, use bullet points for clarity, provide specific examples, and explain the business impact of each recommendation. Think of this as a premium SEO consultation report.

IMPORTANT: Do not use any emojis, emoticons, or special characters in your responses. Keep the language professional and business-focused.`;

  const aiResponse = await callOpenRouterAI(prompt, systemPrompt);
  return { analysis: aiResponse };
}

// Enhanced AI SEO Suggestions
async function generateSEOSuggestions(crawlData) {
  const prompt = `
As a senior SEO strategist, conduct a comprehensive analysis of this website's SEO performance and provide detailed strategic recommendations.

WEBSITE PERFORMANCE DATA:
- Total Pages: ${crawlData.pagesScanned || 0}
- Working Internal Links: ${crawlData.workingLinks?.length || 0}
- Broken Links: ${crawlData.brokenLinks?.length || 0}
- External Links: ${crawlData.externalLinks?.length || 0}
- Duplicate Content: ${crawlData.duplicateContentIssues?.length || 0} issues

CRITICAL SEO ISSUES:
${
  crawlData.missingSeoIssues
    ?.map((issue, index) => `${index + 1}. ${issue.issue} (URL: ${issue.url})`)
    .join("\n") || "No critical issues detected"
}

TECHNICAL SEO STATUS:
${
  crawlData.technicalSeo
    ?.slice(0, 8)
    .map(
      (item) => `
Page: ${item.url}
- Open Graph: ${item.hasOpenGraph ? "✓" : "✗"}
- Twitter Cards: ${item.hasTwitterCards ? "✓" : "✗"}
- Structured Data: ${item.hasStructuredData ? "✓" : "✗"}
- Duplicate Title: ${item.duplicateTitle === "Yes" ? "CRITICAL" : "✓"}
- Duplicate Description: ${item.duplicateDesc === "Yes" ? "CRITICAL" : "✓"}`
    )
    .join("\n") || "No technical data available"
}

PERFORMANCE METRICS:
${
  crawlData.pagePerformanceMetrics
    ?.map(
      (perf, index) => `
Page ${index + 1}: ${perf.url}
- Performance: ${perf.performanceScore}/100
- SEO Score: ${perf.seoScore}/100
- Accessibility: ${perf.accessibilityScore}/100
- Best Practices: ${perf.bestPracticesScore}/100`
    )
    .join("\n") || "No performance data"
}

KEYWORD PROFILE:
${
  crawlData.keywordStats
    ?.slice(0, 12)
    .map(
      (kw, index) => `${index + 1}. "${kw.keyword}": ${kw.count} occurrences`
    )
    .join("\n") || "No keyword data available"
}

ACCESSIBILITY ISSUES:
${
  crawlData.accessibilityIssues
    ?.slice(0, 8)
    .map((issue, index) => `${index + 1}. ${issue.issue} (Page: ${issue.page})`)
    .join("\n") || "No accessibility issues found"
}

Based on this comprehensive data, provide a detailed SEO strategy in the following format:

## SEO PERFORMANCE OVERVIEW
Provide an executive summary of the website's current SEO health and major areas of concern. Include specific metrics from the crawl data.

## CRITICAL ISSUES & IMMEDIATE ACTIONS
- Priority 1: Critical fixes (implement within 7 days) - Address issues that are actively hurting rankings
- Priority 2: High-impact improvements (implement within 30 days) - Optimizations that will show significant results
- Priority 3: Strategic enhancements (implement within 90 days) - Long-term improvements for sustained growth

## TECHNICAL SEO OPTIMIZATION
- Core Web Vitals improvements: Focus on LCP, FID, and CLS metrics
- Page speed optimization: Server response times and resource optimization
- Mobile optimization: Mobile-first indexing considerations
- Schema markup implementation: Structured data opportunities
- Technical SEO fixes: Indexing and crawling issues
- Security enhancements: HTTPS and security headers

## CONTENT STRATEGY & OPTIMIZATION
- Content gap analysis: Identify missing content based on keyword research
- Keyword optimization strategy: Target high-value keywords with low competition
- Content improvement recommendations: Enhance existing content quality
- Content calendar planning: Regular content publishing schedule
- Content performance tracking: Measure content effectiveness

## ON-PAGE SEO ENHANCEMENTS
- Title tag optimization: Compelling, keyword-rich titles under 60 characters
- Meta description improvements: Descriptive summaries that encourage clicks
- Header tag structure: Proper H1-H6 hierarchy for content organization
- Internal linking strategy: Strategic internal links for page authority
- Image optimization: Alt text, compression, and responsive images
- URL structure optimization: Clean, descriptive URLs

## OFF-PAGE SEO STRATEGY
- Link building opportunities: High-quality backlink acquisition
- Social media integration: Social signals and brand awareness
- Local SEO optimization: Local search visibility improvements
- Brand mention monitoring: Track and leverage brand mentions
- Influencer outreach strategy: Partner with industry influencers

## PERFORMANCE MONITORING
- Key performance indicators: Track organic traffic, rankings, and conversions
- Tracking implementation: Set up proper analytics and monitoring
- Regular audit schedule: Monthly technical and content audits
- Competitive monitoring: Track competitor performance and strategies
- Success measurement: Define and track success metrics

## IMPLEMENTATION ROADMAP
- Week 1-2: Critical fixes - Address immediate technical issues
- Month 1: Technical improvements - Optimize site performance
- Month 2-3: Content optimization - Enhance content quality and targeting
- Month 3-6: Strategic enhancements - Long-term competitive advantages

## EXPECTED OUTCOMES
- Traffic growth projections: Realistic organic traffic increase estimates
- Ranking improvement estimates: Expected keyword ranking improvements
- Conversion rate optimization: User experience and conversion improvements
- ROI expectations: Return on investment for SEO efforts

Please provide specific, actionable recommendations with clear implementation steps, expected timeline, and projected impact for each suggestion. Include specific data points from the crawl results and provide detailed technical guidance.
`;

  const systemPrompt = `You are a senior SEO strategist with extensive experience in technical SEO, content optimization, and performance marketing. Provide comprehensive, actionable SEO recommendations that include:

1. Technical SEO improvements
2. Content optimization strategies
3. Performance enhancement tactics
4. Competitive positioning
5. Implementation roadmaps

Structure your response professionally with clear sections, use bullet points for actionable items, provide specific implementation steps, and include expected outcomes and timelines.

IMPORTANT: Do not use any emojis, emoticons, or special characters in your responses. Keep the language professional and business-focused.`;

  const aiResponse = await callOpenRouterAI(prompt, systemPrompt);
  return { suggestions: aiResponse };
}

// Enhanced AI Competitor Analysis
async function analyzeCompetitors(crawlData) {
  const prompt = `
As a competitive intelligence expert, analyze this website's competitive position and provide strategic insights for market differentiation.

WEBSITE COMPETITIVE PROFILE:
- Total Pages: ${crawlData.pagesScanned || 0}
- Internal Links: ${crawlData.workingLinks?.length || 0}
- External Links: ${crawlData.externalLinks?.length || 0}
- Broken Links: ${crawlData.brokenLinks?.length || 0}
- Content Issues: ${crawlData.missingSeoIssues?.length || 0}
- Duplicate Content: ${crawlData.duplicateContentIssues?.length || 0}

TECHNICAL COMPETITIVE POSITION:
${
  crawlData.pagePerformanceMetrics
    ?.map(
      (perf, index) => `
Page ${index + 1}: ${perf.url}
- Performance: ${perf.performanceScore}/100
- SEO Score: ${perf.seoScore}/100
- Accessibility: ${perf.accessibilityScore}/100
- Best Practices: ${perf.bestPracticesScore}/100`
    )
    .join("\n") || "No performance data available"
}

KEYWORD COMPETITIVE ANALYSIS:
${
  crawlData.keywordStats
    ?.slice(0, 15)
    .map(
      (kw, index) =>
        `${index + 1}. "${kw.keyword}": ${kw.count} occurrences (${
          kw.density
        }% density)`
    )
    .join("\n") || "No keyword data available"
}

TECHNICAL SEO COMPETITIVE STATUS:
${
  crawlData.technicalSeo
    ?.slice(0, 8)
    .map(
      (item) => `
Page: ${item.url}
- Open Graph: ${
        item.hasOpenGraph ? "Competitive Advantage" : "Competitive Disadvantage"
      }
- Twitter Cards: ${
        item.hasTwitterCards
          ? "Competitive Advantage"
          : "Competitive Disadvantage"
      }
- Structured Data: ${
        item.hasStructuredData
          ? "Competitive Advantage"
          : "Competitive Disadvantage"
      }
- Technical Issues: ${
        item.duplicateTitle === "Yes" || item.duplicateDesc === "Yes"
          ? "Competitive Disadvantage"
          : "No Issues"
      }`
    )
    .join("\n") || "No technical data available"
}

CONTENT COMPETITIVE ANALYSIS:
${
  crawlData.missingSeoIssues
    ?.slice(0, 10)
    .map((issue, index) => `${index + 1}. ${issue.issue} (URL: ${issue.url})`)
    .join("\n") || "No content issues detected"
}

Based on this comprehensive competitive data, provide detailed analysis in the following format:

## COMPETITIVE POSITIONING ANALYSIS
- Current market position assessment
- Competitive advantages identification
- Competitive disadvantages analysis
- Market share estimation
- Industry benchmarking

## COMPETITIVE CONTENT STRATEGY
- Content gap analysis vs competitors
- Content quality assessment
- Content differentiation opportunities
- Content strategy recommendations
- Content competitive advantages

## TECHNICAL COMPETITIVE ANALYSIS
- Technical SEO vs competitors
- Performance competitive position
- Technical innovation opportunities
- Technical competitive advantages
- Technical improvement priorities

## KEYWORD COMPETITIVE LANDSCAPE
- Keyword difficulty assessment
- Competitive keyword opportunities
- Long-tail keyword strategy
- Keyword gap analysis
- Competitive keyword positioning

## COMPETITIVE DIFFERENTIATION STRATEGY
- Unique value proposition development
- Competitive moat building
- Market differentiation tactics
- Competitive positioning strategy
- Brand differentiation opportunities

## COMPETITIVE MONITORING FRAMEWORK
- Competitor tracking strategy
- Competitive intelligence tools
- Monitoring frequency and metrics
- Alert system implementation
- Competitive response strategy

## COMPETITIVE ADVANTAGE BUILDING
- Sustainable competitive advantages
- Innovation opportunities
- Market positioning tactics
- Competitive response strategies
- Long-term competitive strategy

## COMPETITIVE INTELLIGENCE PLAN
- Competitor analysis framework
- Market research strategy
- Competitive benchmarking
- Industry trend monitoring
- Competitive response planning

Please provide strategic insights with specific competitive analysis, market positioning recommendations, and actionable strategies for building competitive advantages. Include detailed competitive landscape analysis and specific tactics for outperforming competitors.
`;

  const systemPrompt = `You are a competitive intelligence expert with deep experience in market analysis, competitive positioning, and strategic planning. Provide comprehensive competitive analysis that includes:

1. Detailed competitive landscape assessment
2. Strategic positioning recommendations
3. Competitive advantage building tactics
4. Market differentiation strategies
5. Competitive monitoring frameworks

Structure your response professionally with clear competitive insights, use strategic frameworks, provide specific competitive tactics, and include detailed market positioning recommendations.

IMPORTANT: Do not use any emojis, emoticons, or special characters in your responses. Keep the language professional and business-focused.`;

  const aiResponse = await callOpenRouterAI(prompt, systemPrompt);
  return { analysis: aiResponse };
}

app.post("/api/crawl", rateLimit, async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing or invalid url" });
  }

  try {
    const filePath = await runCrawl(url);
    // Return a download link relative to the server
    const fileName = path.basename(filePath);
    const downloadUrl = `/reports/${fileName}`;
    // Return the raw data for dashboard
    res.json({
      success: true,
      downloadUrl,
      performanceMetrics,
      pagesScanned,
      data: {
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
        duplicateContentIssues,
        brokenResources,
        sitemapRobotsInfo,
        missingSeoIssues,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Crawl failed" });
  }
});

// AI Analysis Endpoints
app.post("/api/ai/content-analysis", rateLimit, async (req, res) => {
  try {
    const crawlData = req.body;

    // Validate and sanitize input data
    if (!crawlData || typeof crawlData !== "object") {
      return res.status(400).json({ error: "Invalid crawl data provided" });
    }

    const analysis = await analyzeContentQuality(crawlData);
    res.json({ success: true, analysis });
  } catch (error) {
    console.error("Content analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/seo-suggestions", rateLimit, async (req, res) => {
  try {
    const crawlData = req.body;

    // Validate and sanitize input data
    if (!crawlData || typeof crawlData !== "object") {
      return res.status(400).json({ error: "Invalid crawl data provided" });
    }

    const suggestions = await generateSEOSuggestions(crawlData);
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error("SEO suggestions error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/competitor-analysis", rateLimit, async (req, res) => {
  try {
    const crawlData = req.body;

    // Validate and sanitize input data
    if (!crawlData || typeof crawlData !== "object") {
      return res.status(400).json({ error: "Invalid crawl data provided" });
    }

    const analysis = await analyzeCompetitors(crawlData);
    res.json({ success: true, analysis });
  } catch (error) {
    console.error("Competitor analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Comprehensive AI Analysis
app.post("/api/ai/comprehensive-analysis", rateLimit, async (req, res) => {
  try {
    const crawlData = req.body;

    // Validate and sanitize input data
    if (!crawlData || typeof crawlData !== "object") {
      return res.status(400).json({ error: "Invalid crawl data provided" });
    }

    console.log(
      `AI Analysis Request - Pages: ${
        crawlData.pagesScanned || 0
      }, Working Links: ${crawlData.workingLinks?.length || 0}, Broken Links: ${
        crawlData.brokenLinks?.length || 0
      }`
    );

    const [contentAnalysis, seoSuggestions, competitorAnalysis] =
      await Promise.all([
        analyzeContentQuality(crawlData),
        generateSEOSuggestions(crawlData),
        analyzeCompetitors(crawlData),
      ]);

    console.log("AI Analysis completed successfully");

    res.json({
      success: true,
      analysis: {
        contentQuality: contentAnalysis,
        seoSuggestions: seoSuggestions,
        competitorAnalysis: competitorAnalysis,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Comprehensive analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Test AI API endpoint
app.post("/api/ai/test", async (req, res) => {
  try {
    const testResponse = await callOpenRouterAI(
      "Say 'Hello, AI is working!'",
      "You are a helpful assistant."
    );
    res.json({ success: true, message: testResponse });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Gemini API endpoint
app.post("/api/ai/test-gemini", async (req, res) => {
  try {
    console.log("Testing Gemini API directly...");
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Say 'Hello, Gemini is working!'",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log("Gemini test response:", JSON.stringify(data, null, 2));
    res.json({
      success: true,
      message: data.candidates[0].content.parts[0].text,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Consolidated Reports Endpoints
app.get("/api/reports/consolidated", rateLimit, async (req, res) => {
  try {
    // Get all report files
    const reportFiles = getAllReportFiles();

    if (reportFiles.length === 0) {
      return res.status(404).json({
        error: "No SEO reports found. Please run some crawls first.",
      });
    }

    // Extract data from all reports
    const reportData = reportFiles
      .map((filePath) => extractReportData(filePath))
      .filter(Boolean);

    // Consolidate the data
    const consolidatedData = consolidateReports(reportData);

    // Generate actionable insights
    const insights = generateActionableInsights(consolidatedData);

    res.json({
      success: true,
      summary: consolidatedData.summary,
      insights,
      reportCount: reportFiles.length,
      domains: consolidatedData.summary.domains,
    });
  } catch (error) {
    console.error("Error generating consolidated report:", error);
    res.status(500).json({ error: "Failed to generate consolidated report" });
  }
});

app.get("/api/reports/consolidated/excel", rateLimit, async (req, res) => {
  try {
    // Get all report files
    const reportFiles = getAllReportFiles();

    if (reportFiles.length === 0) {
      return res.status(404).json({
        error: "No SEO reports found. Please run some crawls first.",
      });
    }

    // Extract data from all reports
    const reportData = reportFiles
      .map((filePath) => extractReportData(filePath))
      .filter(Boolean);

    // Consolidate the data
    const consolidatedData = consolidateReports(reportData);

    // Generate actionable insights
    const insights = generateActionableInsights(consolidatedData);

    // Create consolidated Excel report
    const workbook = createConsolidatedExcelReport(consolidatedData, insights);

    // Generate filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[:T]/g, "-")
      .split(".")[0];
    const fileName = `Consolidated-SEO-Report-${timestamp}.xlsx`;

    // Set headers for file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    // Write to buffer and send
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.send(buffer);
  } catch (error) {
    console.error("Error generating consolidated Excel report:", error);
    res
      .status(500)
      .json({ error: "Failed to generate consolidated Excel report" });
  }
});

app.get("/api/reports/consolidated/pdf", rateLimit, async (req, res) => {
  try {
    // Get all report files
    const reportFiles = getAllReportFiles();

    if (reportFiles.length === 0) {
      return res.status(404).json({
        error: "No SEO reports found. Please run some crawls first.",
      });
    }

    // Extract data from all reports
    const reportData = reportFiles
      .map((filePath) => extractReportData(filePath))
      .filter(Boolean);

    // Consolidate the data
    const consolidatedData = consolidateReports(reportData);

    // Generate actionable insights
    const insights = generateActionableInsights(consolidatedData);

    // Generate PDF report using the new function
    console.log("Generating PDF report...");
    const pdfBuffer = await generateIndividualPDFReport(
      reportData.domain,
      filePath
    );

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    // Generate filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[:T]/g, "-")
      .split(".")[0];
    const pdfFileName = `SEO-Report-${reportData.domain}-${timestamp}.pdf`;

    // Set headers for file download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pdfFileName}"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    // Send the PDF
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating individual PDF report:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to generate individual PDF report" });
  }
});

// Get list of available reports
app.get("/api/reports/list", async (req, res) => {
  try {
    const reportFiles = getAllReportFiles();
    const reports = reportFiles.map((filePath) => {
      const fileName = path.basename(filePath);
      const domainMatch = fileName.match(/SEO-Report-(.+?)-/);
      const domain = domainMatch
        ? domainMatch[1].replace(/-/g, ".")
        : "Unknown Domain";
      const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
      const crawlDate = dateMatch ? dateMatch[1] : "Unknown Date";

      // Create full URL based on domain
      let fullUrl = `https://${domain}`;

      // Handle special cases for known domains
      if (domain === "hridaysehgal.vercel.app") {
        fullUrl = "https://hridaysehgal.vercel.app/";
      } else if (domain === "thehealth24.com") {
        fullUrl = "https://thehealth24.com/";
      } else if (domain.includes("www.")) {
        fullUrl = `https://${domain}`;
      } else {
        fullUrl = `https://www.${domain}`;
      }

      return {
        fileName,
        domain,
        fullUrl,
        crawlDate,
        filePath: `/reports/${fileName}`,
        size: fs.statSync(filePath).size,
        timestamp: dateMatch ? new Date(dateMatch[1]).getTime() : 0,
      };
    });

    // Sort by latest date first
    reports.sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      success: true,
      reports,
      totalReports: reports.length,
    });
  } catch (error) {
    console.error("Error listing reports:", error);
    res.status(500).json({ error: "Failed to list reports" });
  }
});

// Generate individual PDF report for a specific domain
app.get(
  "/api/reports/individual/pdf/:fileName",
  rateLimit,
  async (req, res) => {
    try {
      const { fileName } = req.params;
      console.log(`PDF request for file: ${fileName}`);

      const reportsDir = path.join(process.cwd(), "reports");
      const filePath = path.join(reportsDir, fileName);
      console.log(`Full file path: ${filePath}`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({ error: "Report file not found" });
      }

      // Extract data from the specific report
      const reportData = extractReportData(filePath);
      if (!reportData) {
        console.error(`Failed to extract data from: ${filePath}`);
        return res.status(500).json({ error: "Failed to read report data" });
      }

      console.log(
        `Successfully extracted data for domain: ${reportData.domain}`
      );

      // Generate PDF report using the new function
      console.log("Generating PDF report...");
      const pdfBuffer = await generateIndividualPDFReport(
        reportData.domain,
        filePath
      );

      console.log(
        `PDF generated successfully, size: ${pdfBuffer.length} bytes`
      );

      // Generate filename
      const timestamp = new Date()
        .toISOString()
        .replace(/[:T]/g, "-")
        .split(".")[0];
      const pdfFileName = `SEO-Report-${reportData.domain}-${timestamp}.pdf`;

      // Set headers for file download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${pdfFileName}"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);

      // Send the PDF
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating individual PDF report:", error);
      console.error("Error stack:", error.stack);
      res
        .status(500)
        .json({ error: "Failed to generate individual PDF report" });
    }
  }
);

// Generate individual Excel report for a specific domain (enhanced version)
app.get(
  "/api/reports/individual/excel/:fileName",
  rateLimit,
  async (req, res) => {
    try {
      const { fileName } = req.params;
      console.log(`Excel request for file: ${fileName}`);

      const reportsDir = path.join(process.cwd(), "reports");
      const filePath = path.join(reportsDir, fileName);
      console.log(`Full file path: ${filePath}`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({ error: "Report file not found" });
      }

      // Extract data from the specific report
      const reportData = extractReportData(filePath);
      if (!reportData) {
        console.error(`Failed to extract data from: ${filePath}`);
        return res.status(500).json({ error: "Failed to read report data" });
      }

      console.log(
        `Successfully extracted data for domain: ${reportData.domain}`
      );

      // Create consolidated data structure for single report
      const singleReportData = {
        summary: {
          totalReports: 1,
          totalPagesScanned: 0,
          totalWorkingLinks: 0,
          totalBrokenLinks: 0,
          totalErrors: 0,
          averageResponseTime: 0,
          domains: [reportData.domain],
        },
        criticalIssues: [],
        seoInsights: [],
        performanceMetrics: [],
        accessibilityIssues: [],
        technicalSeo: [],
        keywordAnalysis: [],
        brokenLinks: [],
        missingSeoIssues: [],
      };

      // Process the data from the single report
      const { data } = reportData;
      console.log(`Available sheets: ${Object.keys(data).join(", ")}`);

      // Process Crawl Summary
      if (data["Crawl Summary"] && data["Crawl Summary"].length > 0) {
        const summary = data["Crawl Summary"][0];
        singleReportData.summary.totalPagesScanned = parseInt(
          summary["Pages Scanned"] || 0
        );
        singleReportData.summary.totalWorkingLinks = parseInt(
          summary["Working Links"] || 0
        );
        singleReportData.summary.totalBrokenLinks = parseInt(
          summary["Broken Links"] || 0
        );
        singleReportData.summary.totalErrors = parseInt(summary["Errors"] || 0);
        singleReportData.summary.averageResponseTime = parseFloat(
          summary["Average Response Time (ms)"] || 0
        );
        console.log(
          `Processed crawl summary: ${singleReportData.summary.totalPagesScanned} pages scanned`
        );
      }

      // Process all other data sections
      if (data["Missing SEO Issues"]) {
        singleReportData.criticalIssues = data["Missing SEO Issues"].map(
          (issue) => ({
            domain: reportData.domain,
            ...issue,
          })
        );
        console.log(
          `Processed ${singleReportData.criticalIssues.length} critical issues`
        );
      }

      if (data["SEO Info"]) {
        singleReportData.seoInsights = data["SEO Info"].map((insight) => ({
          domain: reportData.domain,
          ...insight,
        }));
        console.log(
          `Processed ${singleReportData.seoInsights.length} SEO insights`
        );
      }

      if (data["Performance Metrics"]) {
        singleReportData.performanceMetrics = data["Performance Metrics"].map(
          (metric) => ({
            domain: reportData.domain,
            ...metric,
          })
        );
        console.log(
          `Processed ${singleReportData.performanceMetrics.length} performance metrics`
        );
      }

      if (data["Accessibility Issues"]) {
        singleReportData.accessibilityIssues = data["Accessibility Issues"].map(
          (issue) => ({
            domain: reportData.domain,
            ...issue,
          })
        );
        console.log(
          `Processed ${singleReportData.accessibilityIssues.length} accessibility issues`
        );
      }

      if (data["Technical SEO"]) {
        singleReportData.technicalSeo = data["Technical SEO"].map((tech) => ({
          domain: reportData.domain,
          ...tech,
        }));
        console.log(
          `Processed ${singleReportData.technicalSeo.length} technical SEO items`
        );
      }

      if (data["Keyword Density"]) {
        singleReportData.keywordAnalysis = data["Keyword Density"].map(
          (keyword) => ({
            domain: reportData.domain,
            ...keyword,
          })
        );
        console.log(
          `Processed ${singleReportData.keywordAnalysis.length} keyword items`
        );
      }

      if (data["Broken Links"]) {
        singleReportData.brokenLinks = data["Broken Links"].map((link) => ({
          domain: reportData.domain,
          ...link,
        }));
        console.log(
          `Processed ${singleReportData.brokenLinks.length} broken links`
        );
      }

      // Generate actionable insights
      const insights = generateActionableInsights(singleReportData);
      console.log(
        `Generated insights: ${Object.keys(insights)
          .map((k) => `${k}: ${insights[k].length}`)
          .join(", ")}`
      );

      // Create enhanced Excel report
      console.log("Creating enhanced Excel report...");
      const workbook = createConsolidatedExcelReport(
        singleReportData,
        insights
      );
      console.log(`Excel workbook created successfully`);

      // Generate filename
      const domainName = reportData.domain.replace(/\./g, "-");
      const timestamp = new Date()
        .toISOString()
        .replace(/[:T]/g, "-")
        .split(".")[0];
      const excelFileName = `Enhanced-SEO-Report-${domainName}-${timestamp}.xlsx`;

      // Set headers for file download
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${excelFileName}"`
      );

      // Write to buffer and send
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      console.log(`Excel buffer created, size: ${buffer.length} bytes`);
      res.send(buffer);
    } catch (error) {
      console.error("Error generating individual Excel report:", error);
      console.error("Error stack:", error.stack);
      res
        .status(500)
        .json({ error: "Failed to generate individual Excel report" });
    }
  }
);

// Generate SEO Checklist PDF
app.get("/api/seo-checklist/pdf", rateLimit, async (req, res) => {
  try {
    console.log("Generating SEO checklist PDF...");
    const pdfBuffer = await generateSEOChecklistPDF();

    console.log(
      `SEO checklist PDF generated successfully, size: ${pdfBuffer.length} bytes`
    );

    // Generate filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[:T]/g, "-")
      .split(".")[0];
    const pdfFileName = `SEO-Checklist-25-Quick-Fixes-${timestamp}.pdf`;

    // Set headers for file download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pdfFileName}"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    // Send the PDF
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating SEO checklist PDF:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to generate SEO checklist PDF" });
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "CrawlVaani Backend API is running",
    version: "1.0.0",
    endpoints: {
      crawl: "/api/crawl",
      aiAnalysis: "/api/ai/comprehensive-analysis",
      seoChecklist: "/api/seo-checklist/pdf",
      reports: "/api/reports/*",
    },
    //hello test
    cors: {
      enabled: true,
      allowedOrigins: [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://crawlvaani.vercel.app",
        "https://crawlvaani-frontend.vercel.app",
        "https://crawlvaani.onrender.com",
        "https://crawlvaani.com",
        "https://crawlvaani.in",
        "https://*.vercel.app",
        "https://*.onrender.com",
      ],
    },
  });
});

app.listen(PORT, () => {
  console.log(`SEO Crawler backend running on http://localhost:${PORT}`);
  console.log(`Rate limit: ${MAX_REQUESTS_PER_HOUR} requests per hour per IP`);
  console.log(`Page limit: 50000 pages per crawl`);
  console.log(`AI Analysis: Available via /api/ai/* endpoints`);
  console.log(`CORS: Enabled for frontend domains`);
});
