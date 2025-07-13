import XLSX from "xlsx";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

// Function to read all Excel files from the reports directory
export function getAllReportFiles(reportsDir = "reports") {
  const fullPath = path.join(process.cwd(), reportsDir);
  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const files = fs.readdirSync(fullPath);
  return files
    .filter((file) => file.endsWith(".xlsx") && file.includes("SEO-Report"))
    .map((file) => path.join(fullPath, file));
}

// Function to extract data from a single Excel file
export function extractReportData(filePath) {
  try {
    console.log(`Attempting to read file: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      return null;
    }

    const workbook = XLSX.readFile(filePath);
    console.log(
      `Successfully read workbook. Sheet names: ${workbook.SheetNames.join(
        ", "
      )}`
    );

    const data = {};

    // Extract data from each sheet
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      data[sheetName] = jsonData;
      console.log(`Sheet "${sheetName}" has ${jsonData.length} rows`);
    });

    // Extract domain name from filename
    const fileName = path.basename(filePath);
    const domainMatch = fileName.match(/SEO-Report-(.+?)-/);
    const domain = domainMatch
      ? domainMatch[1].replace(/-/g, ".")
      : "Unknown Domain";

    console.log(`Extracted domain: ${domain}`);

    return {
      domain,
      fileName,
      filePath,
      data,
      crawlDate: new Date().toISOString().split("T")[0], // Extract date from filename if possible
    };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    console.error(`Error stack:`, error.stack);
    return null;
  }
}

// Function to consolidate all reports into a single summary
export function consolidateReports(reportFiles) {
  const consolidatedData = {
    summary: {
      totalReports: reportFiles.length,
      totalPagesScanned: 0,
      totalWorkingLinks: 0,
      totalBrokenLinks: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      domains: [],
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

  let totalResponseTime = 0;
  let responseTimeCount = 0;

  reportFiles.forEach((report) => {
    if (!report) return;

    const { domain, data } = report;
    consolidatedData.summary.domains.push(domain);

    // Process Crawl Summary
    if (data["Crawl Summary"] && data["Crawl Summary"].length > 0) {
      const summary = data["Crawl Summary"][0];
      consolidatedData.summary.totalPagesScanned += parseInt(
        summary["Pages Scanned"] || 0
      );
      consolidatedData.summary.totalWorkingLinks += parseInt(
        summary["Working Links"] || 0
      );
      consolidatedData.summary.totalBrokenLinks += parseInt(
        summary["Broken Links"] || 0
      );
      consolidatedData.summary.totalErrors += parseInt(summary["Errors"] || 0);

      if (summary["Average Response Time (ms)"]) {
        totalResponseTime += parseFloat(summary["Average Response Time (ms)"]);
        responseTimeCount++;
      }
    }

    // Process Critical Issues
    if (data["Missing SEO Issues"]) {
      data["Missing SEO Issues"].forEach((issue) => {
        consolidatedData.criticalIssues.push({
          domain,
          ...issue,
        });
      });
    }

    // Process SEO Insights
    if (data["SEO Info"]) {
      data["SEO Info"].forEach((insight) => {
        consolidatedData.seoInsights.push({
          domain,
          ...insight,
        });
      });
    }

    // Process Performance Metrics
    if (data["Performance Metrics"]) {
      data["Performance Metrics"].forEach((metric) => {
        consolidatedData.performanceMetrics.push({
          domain,
          ...metric,
        });
      });
    }

    // Process Accessibility Issues
    if (data["Accessibility Issues"]) {
      data["Accessibility Issues"].forEach((issue) => {
        consolidatedData.accessibilityIssues.push({
          domain,
          ...issue,
        });
      });
    }

    // Process Technical SEO
    if (data["Technical SEO"]) {
      data["Technical SEO"].forEach((tech) => {
        consolidatedData.technicalSeo.push({
          domain,
          ...tech,
        });
      });
    }

    // Process Keyword Analysis
    if (data["Keyword Density"]) {
      data["Keyword Density"].forEach((keyword) => {
        consolidatedData.keywordAnalysis.push({
          domain,
          ...keyword,
        });
      });
    }

    // Process Broken Links
    if (data["Broken Links"]) {
      data["Broken Links"].forEach((link) => {
        consolidatedData.brokenLinks.push({
          domain,
          ...link,
        });
      });
    }
  });

  // Calculate averages
  if (responseTimeCount > 0) {
    consolidatedData.summary.averageResponseTime =
      totalResponseTime / responseTimeCount;
  }

  return consolidatedData;
}

// Function to generate actionable insights from consolidated data
export function generateActionableInsights(consolidatedData) {
  const insights = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  // Analyze critical issues
  const criticalIssues = consolidatedData.criticalIssues;
  if (criticalIssues.length > 0) {
    insights.critical.push({
      title: "Critical SEO Issues Found",
      description: `${criticalIssues.length} critical SEO issues across all domains`,
      action:
        "Address these issues immediately as they significantly impact search rankings",
      count: criticalIssues.length,
    });
  }

  // Analyze broken links
  const brokenLinks = consolidatedData.brokenLinks;
  if (brokenLinks.length > 0) {
    insights.high.push({
      title: "Broken Links Detected",
      description: `${brokenLinks.length} broken links found across all domains`,
      action: "Fix or redirect broken links to improve user experience and SEO",
      count: brokenLinks.length,
    });
  }

  // Analyze performance issues
  const performanceIssues = consolidatedData.performanceMetrics.filter(
    (metric) => (metric.performanceScore || 0) < 70
  );
  if (performanceIssues.length > 0) {
    insights.high.push({
      title: "Performance Issues",
      description: `${performanceIssues.length} pages with poor performance scores`,
      action: "Optimize page speed and Core Web Vitals for better rankings",
      count: performanceIssues.length,
    });
  }

  // Analyze accessibility issues
  const accessibilityIssues = consolidatedData.accessibilityIssues;
  if (accessibilityIssues.length > 0) {
    insights.medium.push({
      title: "Accessibility Issues",
      description: `${accessibilityIssues.length} accessibility issues found`,
      action: "Improve accessibility for better user experience and compliance",
      count: accessibilityIssues.length,
    });
  }

  // Analyze technical SEO
  const technicalIssues = consolidatedData.technicalSeo.filter(
    (tech) => tech.duplicateTitle === "Yes" || tech.duplicateDesc === "Yes"
  );
  if (technicalIssues.length > 0) {
    insights.medium.push({
      title: "Technical SEO Issues",
      description: `${technicalIssues.length} pages with duplicate titles or descriptions`,
      action: "Create unique titles and descriptions for each page",
      count: technicalIssues.length,
    });
  }

  return insights;
}

// Function to generate professional PDF report
export function generatePDFReport(consolidatedData, insights) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: "SEO Analysis Report",
          Author: "SEO Crawler",
          Subject: "Comprehensive SEO Analysis Report",
          Keywords: "SEO, Analysis, Report, Website Audit",
          CreationDate: new Date(),
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      // Add header
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .fillColor("#1f2937")
        .text("SEO Analysis Report", { align: "center" });

      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .font("Helvetica")
        .fillColor("#6b7280")
        .text(`Generated on ${new Date().toLocaleDateString()}`, {
          align: "center",
        });

      doc.moveDown(2);

      // Executive Summary
      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .fillColor("#1f2937")
        .text("Executive Summary");

      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .font("Helvetica")
        .fillColor("#374151")
        .text(
          `This report analyzes ${consolidatedData.summary.totalReports} website(s) with a total of ${consolidatedData.summary.totalPagesScanned} pages scanned.`
        );

      // Summary Table
      doc.moveDown(1);
      const summaryTable = [
        ["Metric", "Value"],
        ["Total Reports", consolidatedData.summary.totalReports.toString()],
        [
          "Total Pages Scanned",
          consolidatedData.summary.totalPagesScanned.toString(),
        ],
        [
          "Total Working Links",
          consolidatedData.summary.totalWorkingLinks.toString(),
        ],
        [
          "Total Broken Links",
          consolidatedData.summary.totalBrokenLinks.toString(),
        ],
        ["Total Errors", consolidatedData.summary.totalErrors.toString()],
        [
          "Average Response Time",
          `${consolidatedData.summary.averageResponseTime.toFixed(2)}ms`,
        ],
      ];

      drawTable(doc, summaryTable, 50, doc.y + 20);

      // Critical Issues
      if (insights.critical.length > 0) {
        doc.moveDown(2);
        doc
          .fontSize(16)
          .font("Helvetica-Bold")
          .fillColor("#dc2626")
          .text("🚨 Critical Issues");

        insights.critical.forEach((issue) => {
          doc.moveDown(0.5);
          doc
            .fontSize(12)
            .font("Helvetica-Bold")
            .fillColor("#374151")
            .text(issue.title);

          doc
            .fontSize(10)
            .font("Helvetica")
            .fillColor("#6b7280")
            .text(issue.description);

          doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .fillColor("#059669")
            .text(`Action Required: ${issue.action}`);
        });
      }

      // High Priority Issues
      if (insights.high.length > 0) {
        doc.moveDown(2);
        doc
          .fontSize(16)
          .font("Helvetica-Bold")
          .fillColor("#ea580c")
          .text("⚠️ High Priority Issues");

        insights.high.forEach((issue) => {
          doc.moveDown(0.5);
          doc
            .fontSize(12)
            .font("Helvetica-Bold")
            .fillColor("#374151")
            .text(issue.title);

          doc
            .fontSize(10)
            .font("Helvetica")
            .fillColor("#6b7280")
            .text(issue.description);

          doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .fillColor("#059669")
            .text(`Action Required: ${issue.action}`);
        });
      }

      // Medium Priority Issues
      if (insights.medium.length > 0) {
        doc.moveDown(2);
        doc
          .fontSize(16)
          .font("Helvetica-Bold")
          .fillColor("#d97706")
          .text("📋 Medium Priority Issues");

        insights.medium.forEach((issue) => {
          doc.moveDown(0.5);
          doc
            .fontSize(12)
            .font("Helvetica-Bold")
            .fillColor("#374151")
            .text(issue.title);

          doc
            .fontSize(10)
            .font("Helvetica")
            .fillColor("#6b7280")
            .text(issue.description);

          doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .fillColor("#059669")
            .text(`Action Required: ${issue.action}`);
        });
      }

      // Detailed Analysis
      doc.moveDown(2);
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .fillColor("#1f2937")
        .text("Detailed Analysis");

      // Performance Analysis
      if (consolidatedData.performanceMetrics.length > 0) {
        doc.moveDown(1);
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#374151")
          .text("Performance Analysis");

        const avgPerformance =
          consolidatedData.performanceMetrics.reduce(
            (sum, metric) => sum + (metric.performanceScore || 0),
            0
          ) / consolidatedData.performanceMetrics.length;

        doc
          .fontSize(10)
          .font("Helvetica")
          .fillColor("#6b7280")
          .text(`Average Performance Score: ${avgPerformance.toFixed(1)}/100`);

        const performanceTable = [
          ["Performance Range", "Pages", "Percentage"],
          [
            "Excellent (90-100)",
            consolidatedData.performanceMetrics
              .filter((m) => (m.performanceScore || 0) >= 90)
              .length.toString(),
            `${(
              (consolidatedData.performanceMetrics.filter(
                (m) => (m.performanceScore || 0) >= 90
              ).length /
                consolidatedData.performanceMetrics.length) *
              100
            ).toFixed(1)}%`,
          ],
          [
            "Good (70-89)",
            consolidatedData.performanceMetrics
              .filter(
                (m) =>
                  (m.performanceScore || 0) >= 70 &&
                  (m.performanceScore || 0) < 90
              )
              .length.toString(),
            `${(
              (consolidatedData.performanceMetrics.filter(
                (m) =>
                  (m.performanceScore || 0) >= 70 &&
                  (m.performanceScore || 0) < 90
              ).length /
                consolidatedData.performanceMetrics.length) *
              100
            ).toFixed(1)}%`,
          ],
          [
            "Needs Improvement (0-69)",
            consolidatedData.performanceMetrics
              .filter((m) => (m.performanceScore || 0) < 70)
              .length.toString(),
            `${(
              (consolidatedData.performanceMetrics.filter(
                (m) => (m.performanceScore || 0) < 70
              ).length /
                consolidatedData.performanceMetrics.length) *
              100
            ).toFixed(1)}%`,
          ],
        ];

        drawTable(doc, performanceTable, 50, doc.y + 20);
      }

      // Recommendations
      doc.moveDown(2);
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .fillColor("#1f2937")
        .text("Recommendations");

      const recommendations = [
        "1. Fix all broken links to improve user experience and SEO rankings",
        "2. Optimize page loading speed for better Core Web Vitals scores",
        "3. Create unique, descriptive titles and meta descriptions for each page",
        "4. Improve accessibility by adding alt text to images and proper heading structure",
        "5. Implement structured data markup for better search engine understanding",
        "6. Ensure mobile responsiveness across all pages",
        "7. Create and submit XML sitemaps to search engines",
        "8. Monitor and improve Core Web Vitals regularly",
      ];

      recommendations.forEach((rec) => {
        doc.moveDown(0.3);
        doc.fontSize(10).font("Helvetica").fillColor("#374151").text(rec);
      });

      // Footer
      doc.moveDown(3);
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#9ca3af")
        .text(
          "This report was generated by SEO Crawler. For detailed analysis, please refer to the individual Excel reports.",
          { align: "center" }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to draw tables in PDF
function drawTable(doc, data, x, y) {
  const cellPadding = 5;
  const cellHeight = 20;
  const colWidths = [];

  // Calculate column widths
  for (let col = 0; col < data[0].length; col++) {
    let maxWidth = 0;
    for (let row = 0; row < data.length; row++) {
      const textWidth = doc
        .font("Helvetica")
        .fontSize(10)
        .widthOfString(data[row][col] || "");
      maxWidth = Math.max(maxWidth, textWidth);
    }
    colWidths[col] = maxWidth + cellPadding * 2;
  }

  // Draw table
  for (let row = 0; row < data.length; row++) {
    let currentX = x;

    for (let col = 0; col < data[row].length; col++) {
      // Draw cell border
      doc
        .rect(currentX, y + row * cellHeight, colWidths[col], cellHeight)
        .stroke();

      // Add text
      doc
        .fontSize(10)
        .font(row === 0 ? "Helvetica-Bold" : "Helvetica")
        .fillColor(row === 0 ? "#1f2937" : "#374151")
        .text(
          data[row][col] || "",
          currentX + cellPadding,
          y + row * cellHeight + cellHeight / 2 - 5,
          { width: colWidths[col] - cellPadding * 2 }
        );

      currentX += colWidths[col];
    }
  }

  // Update document position
  doc.y = y + data.length * cellHeight + 20;
}

// Function to create consolidated Excel report
export function createConsolidatedExcelReport(consolidatedData, insights) {
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData = [
    {
      "Total Reports": consolidatedData.summary.totalReports,
      "Total Pages Scanned": consolidatedData.summary.totalPagesScanned,
      "Total Working Links": consolidatedData.summary.totalWorkingLinks,
      "Total Broken Links": consolidatedData.summary.totalBrokenLinks,
      "Total Errors": consolidatedData.summary.totalErrors,
      "Average Response Time (ms)":
        consolidatedData.summary.averageResponseTime.toFixed(2),
      "Domains Analyzed": consolidatedData.summary.domains.join(", "),
    },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Critical Issues Sheet
  if (consolidatedData.criticalIssues.length > 0) {
    const criticalSheet = XLSX.utils.json_to_sheet(
      consolidatedData.criticalIssues
    );
    XLSX.utils.book_append_sheet(workbook, criticalSheet, "Critical Issues");
  }

  // Actionable Insights Sheet
  const insightsData = [];
  Object.entries(insights).forEach(([priority, items]) => {
    items.forEach((item) => {
      insightsData.push({
        Priority: priority.charAt(0).toUpperCase() + priority.slice(1),
        Issue: item.title,
        Description: item.description,
        "Action Required": item.action,
        Count: item.count,
      });
    });
  });

  if (insightsData.length > 0) {
    const insightsSheet = XLSX.utils.json_to_sheet(insightsData);
    XLSX.utils.book_append_sheet(
      workbook,
      insightsSheet,
      "Actionable Insights"
    );
  }

  // Performance Analysis Sheet
  if (consolidatedData.performanceMetrics.length > 0) {
    const performanceSheet = XLSX.utils.json_to_sheet(
      consolidatedData.performanceMetrics
    );
    XLSX.utils.book_append_sheet(
      workbook,
      performanceSheet,
      "Performance Analysis"
    );
  }

  // Broken Links Sheet
  if (consolidatedData.brokenLinks.length > 0) {
    const brokenLinksSheet = XLSX.utils.json_to_sheet(
      consolidatedData.brokenLinks
    );
    XLSX.utils.book_append_sheet(workbook, brokenLinksSheet, "Broken Links");
  }

  // Technical SEO Sheet
  if (consolidatedData.technicalSeo.length > 0) {
    const technicalSheet = XLSX.utils.json_to_sheet(
      consolidatedData.technicalSeo
    );
    XLSX.utils.book_append_sheet(workbook, technicalSheet, "Technical SEO");
  }

  // Accessibility Issues Sheet
  if (consolidatedData.accessibilityIssues.length > 0) {
    const accessibilitySheet = XLSX.utils.json_to_sheet(
      consolidatedData.accessibilityIssues
    );
    XLSX.utils.book_append_sheet(
      workbook,
      accessibilitySheet,
      "Accessibility Issues"
    );
  }

  return workbook;
}

// Function to generate comprehensive individual PDF report
async function generateIndividualPDFReport(domain, reportPath) {
  try {
    console.log(`Generating PDF report for ${domain} from ${reportPath}`);

    // Read the Excel file
    const workbook = XLSX.readFile(reportPath);
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      throw new Error("No sheets found in Excel file");
    }

    console.log("Available sheets:", sheetNames);

    // Extract data from all sheets
    const allData = {};
    sheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length > 1) {
        const headers = jsonData[0];
        const rows = jsonData
          .slice(1)
          .map((row) => {
            const obj = {};
            headers.forEach((header, index) => {
              if (header && row[index] !== undefined) {
                obj[header] = row[index];
              }
            });
            return obj;
          })
          .filter((row) => Object.keys(row).length > 0);

        allData[sheetName] = rows;
        console.log(`Extracted ${rows.length} rows from ${sheetName}`);
      }
    });

    console.log("Extracted data sheets:", Object.keys(allData));

    // Generate comprehensive HTML content with all data
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SEO Report - ${domain}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8fafc;
            padding: 20px;
          }
          
          .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          
          .brand-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
            text-align: center;
            border-bottom: 3px solid #4f46e5;
          }
          
          .brand-logo {
            font-size: 2.8rem;
            font-weight: 800;
            margin-bottom: 5px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
          }
          
          .brand-tagline {
            font-size: 1.1rem;
            opacity: 0.9;
            font-weight: 300;
          }
          
          .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 40px;
            text-align: center;
          }
          
          .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 700;
          }
          
          .header p {
            font-size: 1.1rem;
            opacity: 0.9;
          }
          
          .report-info {
            background: #f8fafc;
            padding: 20px 40px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .report-info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
          }
          
          .info-item {
            text-align: center;
          }
          
          .info-label {
            font-size: 0.875rem;
            color: #64748b;
            margin-bottom: 5px;
          }
          
          .info-value {
            font-size: 1.125rem;
            font-weight: 600;
            color: #1e293b;
          }
          
          .content {
            padding: 40px;
          }
          
          .section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          
          .section h2 {
            font-size: 1.5rem;
            color: #1e293b;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
            position: relative;
          }
          
          .section h2::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 60px;
            height: 2px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          
          .section h3 {
            font-size: 1.2rem;
            color: #374151;
            margin: 25px 0 15px 0;
            border-left: 4px solid #3b82f6;
            padding-left: 15px;
          }
          
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            font-size: 0.8rem;
            table-layout: fixed;
          }
          
          .data-table th {
            background: #f1f5f9;
            padding: 12px 15px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border-bottom: 1px solid #e2e8f0;
            font-size: 0.75rem;
            word-wrap: break-word;
          }
          
          .data-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 0.75rem;
            vertical-align: top;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
          }
          
          .data-table tr:hover {
            background: #f8fafc;
          }
          
          .url-column {
            width: 35%;
            min-width: 250px;
            max-width: 400px;
          }
          
          .url-display {
            word-break: break-all;
            word-wrap: break-word;
            overflow-wrap: break-word;
            line-height: 1.4;
            max-width: 100%;
          }
          
          .url-display a {
            color: #3b82f6;
            text-decoration: underline;
            word-break: break-all;
            word-wrap: break-word;
            overflow-wrap: break-word;
            line-height: 1.4;
          }
          
          .status-badge {
            display: inline-block;
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 500;
            text-transform: uppercase;
          }
          
          .status-success {
            background: #dcfce7;
            color: #166534;
          }
          
          .status-warning {
            background: #fef3c7;
            color: #92400e;
          }
          
          .status-error {
            background: #fee2e2;
            color: #991b1b;
          }
          
          .issue-item {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          
          .issue-item.success {
            border-left: 4px solid #10b981;
          }
          
          .issue-item.warning {
            border-left: 4px solid #f59e0b;
          }
          
          .issue-item.error {
            border-left: 4px solid #ef4444;
          }
          
          .issue-title {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 5px;
            font-size: 0.9rem;
          }
          
          .issue-details {
            color: #64748b;
            font-size: 0.8rem;
          }
          
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 25px;
          }
          
          .summary-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          
          .summary-number {
            font-size: 1.8rem;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 5px;
          }
          
          .summary-label {
            color: #64748b;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          
          .footer {
            background: #1e293b;
            color: white;
            text-align: center;
            padding: 20px;
            font-size: 0.875rem;
          }
          
          .page-break {
            page-break-before: always;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
            }
            
            .container {
              box-shadow: none;
              border-radius: 0;
            }
            
            .data-table {
              box-shadow: none;
              border: 1px solid #e2e8f0;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="brand-header">
            <div class="brand-logo">CrawlVaani</div>
            <div class="brand-tagline">Professional Website Analysis & SEO Reporting</div>
          </div>
          
          <div class="header">
            <h1>SEO Analysis Report</h1>
            <p>Comprehensive website analysis for ${domain}</p>
          </div>
          
          <div class="report-info">
            <div class="report-info-grid">
              <div class="info-item">
                <div class="info-label">Domain Analyzed</div>
                <div class="info-value">${domain}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Report Generated</div>
                <div class="info-value">${new Date().toLocaleDateString()}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Total Data Sheets</div>
                <div class="info-value">${Object.keys(allData).length}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Report Type</div>
                <div class="info-value">Individual Analysis</div>
              </div>
            </div>
          </div>
          
          <div class="content">
            ${generateComprehensiveDataSections(allData, domain)}
          </div>
          
          <div class="footer">
            <p>Generated by CrawlVaani - Professional Website Analysis Tool</p>
            <p>Report generated on ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
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
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "20mm",
        bottom: "20mm",
        left: "20mm",
      },
    });

    await browser.close();

    return pdfBuffer;
  } catch (error) {
    console.error("Error generating PDF report:", error);
    throw new Error(`Failed to generate PDF report: ${error.message}`);
  }
}

function generateComprehensiveDataSections(allData, domain) {
  let sections = "";

  // Executive Summary
  sections += generateExecutiveSummary(allData, domain);

  // SEO Information
  if (allData["SEO Info"]) {
    sections += generateSEOInfoSection(allData["SEO Info"]);
  }

  // Meta Tag Audit
  if (allData["Meta Tag Audit"]) {
    sections += generateMetaTagSection(allData["Meta Tag Audit"]);
  }

  // Technical SEO
  if (allData["Technical SEO"]) {
    sections += generateTechnicalSEOSection(allData["Technical SEO"]);
  }

  // Working Links
  if (allData["Working Links"]) {
    sections += generateWorkingLinksSection(allData["Working Links"]);
  }

  // Broken Links
  if (allData["Broken Links"]) {
    sections += generateBrokenLinksSection(allData["Broken Links"]);
  }

  // Accessibility Issues
  if (allData["Accessibility Issues"]) {
    sections += generateAccessibilitySection(allData["Accessibility Issues"]);
  }

  // Missing SEO Issues
  if (allData["Missing SEO Issues"]) {
    sections += generateMissingSEOSection(allData["Missing SEO Issues"]);
  }

  // Image ALT Tags
  if (allData["Image ALT Tags"]) {
    sections += generateImageALTSection(allData["Image ALT Tags"]);
  }

  // Performance Metrics
  if (allData["Performance Metrics"]) {
    sections += generatePerformanceSection(allData["Performance Metrics"]);
  }

  // Recommendations
  sections += generateRecommendationsSection(allData);

  return sections;
}

function generateExecutiveSummary(allData, domain) {
  const totalPages = allData["SEO Info"] ? allData["SEO Info"].length : 0;
  const workingLinks = allData["Working Links"]
    ? allData["Working Links"].length
    : 0;
  const brokenLinks = allData["Broken Links"]
    ? allData["Broken Links"].length
    : 0;
  const externalLinks = allData["External Links"]
    ? allData["External Links"].length
    : 0;
  const accessibilityIssues = allData["Accessibility Issues"]
    ? allData["Accessibility Issues"].length
    : 0;
  const structuredData = allData["Structured Data"]
    ? allData["Structured Data"].length
    : 0;

  // Calculate SEO score
  let seoScore = 100;
  if (brokenLinks > 0) seoScore -= Math.min(30, brokenLinks * 2);
  if (accessibilityIssues > 0)
    seoScore -= Math.min(20, accessibilityIssues * 3);
  if (allData["SEO Info"]) {
    const missingTitles = allData["SEO Info"].filter(
      (seo) => !seo.TITLE || seo.TITLE === ""
    ).length;
    seoScore -= Math.min(25, missingTitles * 5);
  }
  seoScore = Math.max(0, seoScore);

  return `
    <div class="section">
      <h2>Executive Summary</h2>
      <p style="margin-bottom: 20px; color: #374151; font-size: 14px; line-height: 1.6;">
        This comprehensive SEO analysis provides detailed insights into the website's search engine optimization, 
        performance, and technical health. The analysis covers <strong>${totalPages}</strong> pages with extensive 
        examination of SEO elements, performance metrics, and technical issues.
      </p>
      
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-number">${seoScore}</div>
          <div class="summary-label">SEO Score</div>
        </div>
        <div class="summary-card">
          <div class="summary-number">${totalPages}</div>
          <div class="summary-label">Pages Analyzed</div>
        </div>
        <div class="summary-card">
          <div class="summary-number">${workingLinks}</div>
          <div class="summary-label">Working Links</div>
        </div>
        <div class="summary-card">
          <div class="summary-number">${brokenLinks}</div>
          <div class="summary-label">Broken Links</div>
        </div>
        <div class="summary-card">
          <div class="summary-number">${externalLinks}</div>
          <div class="summary-label">External Links</div>
        </div>
        <div class="summary-card">
          <div class="summary-number">${accessibilityIssues}</div>
          <div class="summary-label">Accessibility Issues</div>
        </div>
      </div>
      
      <div style="margin-top: 20px;">
        <h3 style="color: #1e293b; margin-bottom: 15px;">Key Findings</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">
          <div class="issue-item ${brokenLinks === 0 ? "success" : "error"}">
            <div class="issue-title">Link Health</div>
            <div class="issue-details">
              ${
                brokenLinks === 0
                  ? "All links are working properly"
                  : `${brokenLinks} broken links need to be fixed`
              }
            </div>
          </div>
          <div class="issue-item ${
            accessibilityIssues === 0 ? "success" : "warning"
          }">
            <div class="issue-title">Accessibility</div>
            <div class="issue-details">
              ${
                accessibilityIssues === 0
                  ? "No accessibility issues found"
                  : `${accessibilityIssues} accessibility issues need attention`
              }
            </div>
          </div>
          <div class="issue-item ${
            seoScore >= 80 ? "success" : seoScore >= 60 ? "warning" : "error"
          }">
            <div class="issue-title">Overall SEO Health</div>
            <div class="issue-details">
              ${
                seoScore >= 80
                  ? "Excellent SEO performance"
                  : seoScore >= 60
                  ? "Good SEO performance with room for improvement"
                  : "SEO needs significant improvement"
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function generateCrawlSummarySection(crawlSummary) {
  if (!crawlSummary || crawlSummary.length === 0) {
    return `
      <div class="section">
        <h2>Crawl Summary</h2>
        <div class="issue-item">
          <div class="issue-title">No crawl summary data available</div>
          <div class="issue-details">Crawl summary information could not be extracted.</div>
        </div>
      </div>
    `;
  }

  const summary = crawlSummary[0];
  const pagesScanned = summary["Pages Scanned"] || summary["pagesScanned"] || 0;
  const workingLinks = summary["Working Links"] || summary["workingLinks"] || 0;
  const brokenLinks = summary["Broken Links"] || summary["brokenLinks"] || 0;
  const errors = summary["Errors"] || summary["errors"] || 0;
  const avgResponseTime =
    summary["Average Response Time (ms)"] || summary["avgResponseTime"] || 0;

  return `
    <div class="section">
      <h2>Crawl Summary</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-number">${pagesScanned}</div>
          <div class="summary-label">Pages Scanned</div>
        </div>
        <div class="summary-card">
          <div class="summary-number">${workingLinks}</div>
          <div class="summary-label">Working Links</div>
        </div>
        <div class="summary-card">
          <div class="summary-number">${brokenLinks}</div>
          <div class="summary-label">Broken Links</div>
        </div>
        <div class="summary-card">
          <div class="summary-number">${errors}</div>
          <div class="summary-label">Total Errors</div>
        </div>
        <div class="summary-card">
          <div class="summary-number">${avgResponseTime}ms</div>
          <div class="summary-label">Avg Response Time</div>
        </div>
      </div>
      
      <table class="data-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Pages Scanned</td>
            <td>${pagesScanned}</td>
            <td><span class="status-badge status-success">Complete</span></td>
          </tr>
          <tr>
            <td>Working Links</td>
            <td>${workingLinks}</td>
            <td><span class="status-badge status-success">Good</span></td>
          </tr>
          <tr>
            <td>Broken Links</td>
            <td>${brokenLinks}</td>
            <td>${
              brokenLinks > 0
                ? '<span class="status-badge status-error">Needs Fixing</span>'
                : '<span class="status-badge status-success">Excellent</span>'
            }</td>
          </tr>
          <tr>
            <td>Total Errors</td>
            <td>${errors}</td>
            <td>${
              errors > 0
                ? '<span class="status-badge status-warning">Issues Found</span>'
                : '<span class="status-badge status-success">Clean</span>'
            }</td>
          </tr>
          <tr>
            <td>Average Response Time</td>
            <td>${avgResponseTime}ms</td>
            <td>${
              avgResponseTime < 1000
                ? '<span class="status-badge status-success">Fast</span>'
                : '<span class="status-badge status-warning">Slow</span>'
            }</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function generateSEOInfoSection(seoInfo) {
  if (!seoInfo || seoInfo.length === 0) {
    return `
      <div class="section">
        <h2>SEO Information Analysis</h2>
        <div class="issue-item">
          <div class="issue-title">No SEO data available</div>
          <div class="issue-details">SEO information could not be extracted from this report.</div>
        </div>
      </div>
    `;
  }

  const missingTitles = seoInfo.filter(
    (seo) => !seo.TITLE || seo.TITLE === ""
  ).length;
  const missingDescriptions = seoInfo.filter(
    (seo) => !seo.DESCRIPTION || seo.DESCRIPTION === ""
  ).length;
  const pagesWithH1 = seoInfo.filter(
    (seo) => (seo.H1COUNT || seo.h1Count || 0) > 0
  ).length;

  return `
    <div class="section">
      <h2>SEO Information Analysis</h2>
      <p style="margin-bottom: 15px; color: #374151; font-size: 13px;">
        Detailed analysis of key SEO elements across <strong>${
          seoInfo.length
        }</strong> pages:
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
        <div class="issue-item ${missingTitles === 0 ? "success" : "error"}">
          <div class="issue-title">Missing Titles</div>
          <div class="issue-details">${missingTitles} pages missing title tags</div>
        </div>
        <div class="issue-item ${
          missingDescriptions === 0 ? "success" : "warning"
        }">
          <div class="issue-title">Missing Descriptions</div>
          <div class="issue-details">${missingDescriptions} pages missing meta descriptions</div>
        </div>
        <div class="issue-item ${
          pagesWithH1 === seoInfo.length ? "success" : "warning"
        }">
          <div class="issue-title">H1 Tags</div>
          <div class="issue-details">${pagesWithH1} out of ${
    seoInfo.length
  } pages have H1 tags</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
        ${seoInfo
          .map((seo, index) => {
            const title = seo.TITLE || seo.title || "";
            const description = seo.DESCRIPTION || seo.description || "";
            const h1Count = seo.H1COUNT || seo.h1Count || 0;
            const wordCount = seo.WORDCOUNT || seo.wordCount || 0;
            const imageCount = seo.IMAGECOUNT || seo.imageCount || 0;
            const linkCount = seo.LINKCOUNT || seo.linkCount || 0;
            const url = seo.URL || seo.url || "";

            // Handle special cases for robots.txt and sitemap.xml
            const isSpecialFile =
              url.includes("robots.txt") || url.includes("sitemap.xml");

            let status = "Good";
            if (isSpecialFile) {
              status = "success";
            } else if (!title || title === "") {
              status = "Critical";
            } else if (!description || description === "") {
              status = "Warning";
            } else if (h1Count === 0) {
              status = "Warning";
            }

            return `
            <div class="issue-item ${
              status === "Critical"
                ? "error"
                : status === "Warning"
                ? "warning"
                : "success"
            }" style="margin-bottom: 15px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div class="issue-title">Page ${index + 1}</div>
                <div>
                  ${
                    status === "Critical"
                      ? '<span class="status-badge status-error">Critical</span>'
                      : status === "Warning"
                      ? '<span class="status-badge status-warning">Warning</span>'
                      : status === "success"
                      ? '<span class="status-badge status-success">Special File</span>'
                      : '<span class="status-badge status-success">Good</span>'
                  }
                </div>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>URL:</strong> 
                <a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">${url}</a>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Title:</strong> 
                <span style="color: ${
                  isSpecialFile
                    ? "#6b7280"
                    : !title || title === ""
                    ? "#dc2626"
                    : "#374151"
                };">
                  ${isSpecialFile ? "N/A (Special File)" : title || "Missing"}
                </span>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Description:</strong> 
                <span style="color: ${
                  isSpecialFile
                    ? "#6b7280"
                    : !description || description === ""
                    ? "#f59e0b"
                    : "#374151"
                };">
                  ${
                    isSpecialFile
                      ? "N/A (Special File)"
                      : description || "Missing"
                  }
                </span>
              </div>
              
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px;">
                <div style="text-align: center; padding: 8px; background: #f8fafc; border-radius: 4px;">
                  <div style="font-size: 0.8rem; color: #64748b;">H1 Count</div>
                  <div style="font-weight: 600; color: #1e293b;">${h1Count}</div>
                </div>
                <div style="text-align: center; padding: 8px; background: #f8fafc; border-radius: 4px;">
                  <div style="font-size: 0.8rem; color: #64748b;">Word Count</div>
                  <div style="font-weight: 600; color: #1e293b;">${wordCount}</div>
                </div>
                <div style="text-align: center; padding: 8px; background: #f8fafc; border-radius: 4px;">
                  <div style="font-size: 0.8rem; color: #64748b;">Image Count</div>
                  <div style="font-weight: 600; color: #1e293b;">${imageCount}</div>
                </div>
                <div style="text-align: center; padding: 8px; background: #f8fafc; border-radius: 4px;">
                  <div style="font-size: 0.8rem; color: #64748b;">Link Count</div>
                  <div style="font-weight: 600; color: #1e293b;">${linkCount}</div>
                </div>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function generateMetaTagSection(metaTagAudit) {
  if (!metaTagAudit || metaTagAudit.length === 0) {
    return `
      <div class="section">
        <h2>Meta Tag Audit</h2>
        <div class="issue-item">
          <div class="issue-title">No meta tag data available</div>
          <div class="issue-details">Meta tag audit could not be performed.</div>
        </div>
      </div>
    `;
  }

  const missingKeywords = metaTagAudit.filter(
    (meta) => !meta.KEYWORDS || meta.KEYWORDS === ""
  ).length;
  const missingAuthor = metaTagAudit.filter(
    (meta) => !meta.AUTHOR || meta.AUTHOR === ""
  ).length;
  const missingCanonical = metaTagAudit.filter(
    (meta) => !meta.CANONICAL || meta.CANONICAL === ""
  ).length;

  return `
    <div class="section">
      <h2>Meta Tag Audit</h2>
      <p style="margin-bottom: 15px; color: #374151; font-size: 13px;">
        Comprehensive meta tag analysis across <strong>${
          metaTagAudit.length
        }</strong> pages:
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
        <div class="issue-item ${
          missingKeywords === 0 ? "success" : "warning"
        }">
          <div class="issue-title">Keywords</div>
          <div class="issue-details">${
            missingKeywords === 0
              ? "All pages have keywords"
              : `${missingKeywords} pages missing keywords`
          }</div>
        </div>
        <div class="issue-item ${missingAuthor === 0 ? "success" : "warning"}">
          <div class="issue-title">Author Tags</div>
          <div class="issue-details">${
            missingAuthor === 0
              ? "All pages have author tags"
              : `${missingAuthor} pages missing author tags`
          }</div>
        </div>
        <div class="issue-item ${
          missingCanonical === 0 ? "success" : "warning"
        }">
          <div class="issue-title">Canonical URLs</div>
          <div class="issue-details">${
            missingCanonical === 0
              ? "All pages have canonical URLs"
              : `${missingCanonical} pages missing canonical URLs`
          }</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
        ${metaTagAudit
          .map((meta, index) => {
            const url = meta.URL || meta.url || "";
            const keywords = meta.KEYWORDS || meta.keywords || "Missing";
            const author = meta.AUTHOR || meta.author || "Missing";
            const language = meta.LANGUAGE || meta.language || "Missing";
            const canonical = meta.CANONICAL || meta.canonical || "Missing";

            let status = "Good";
            if (!keywords || keywords === "Missing") status = "Warning";
            if (!author || author === "Missing") status = "Warning";
            if (!canonical || canonical === "Missing") status = "Critical";

            return `
            <div class="issue-item ${
              status === "Critical"
                ? "error"
                : status === "Warning"
                ? "warning"
                : "success"
            }" style="margin-bottom: 15px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div class="issue-title">Page ${index + 1}</div>
                <div>
                  ${
                    status === "Critical"
                      ? '<span class="status-badge status-error">Critical</span>'
                      : status === "Warning"
                      ? '<span class="status-badge status-warning">Warning</span>'
                      : '<span class="status-badge status-success">Good</span>'
                  }
                </div>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>URL:</strong> 
                <a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">${url}</a>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Keywords:</strong> 
                <span style="color: ${
                  !keywords || keywords === "Missing" ? "#f59e0b" : "#374151"
                };">
                  ${keywords === "Missing" ? "Missing" : keywords}
                </span>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Author:</strong> 
                <span style="color: ${
                  !author || author === "Missing" ? "#f59e0b" : "#374151"
                };">
                  ${author}
                </span>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Language:</strong> 
                <span style="color: #374151;">
                  ${language}
                </span>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Canonical:</strong> 
                <span style="color: ${
                  !canonical || canonical === "Missing" ? "#dc2626" : "#374151"
                };">
                  ${
                    canonical === "Missing"
                      ? "Missing"
                      : `<a href="${canonical}" target="_blank" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">${canonical}</a>`
                  }
                </span>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function generateTechnicalSEOSection(technicalSEO) {
  if (!technicalSEO || technicalSEO.length === 0) {
    return `
      <div class="section">
        <h2>Technical SEO Analysis</h2>
        <div class="issue-item success">
          <div class="issue-title">No Technical Issues Found</div>
          <div class="issue-details">The website appears to have good technical SEO implementation.</div>
        </div>
      </div>
    `;
  }

  const duplicateTitles = technicalSEO.filter(
    (tech) => tech.DUPLICATETITLE === "Yes"
  ).length;
  const duplicateDescs = technicalSEO.filter(
    (tech) => tech.DUPLICATEDESC === "Yes"
  ).length;
  const hasStructuredData = technicalSEO.filter(
    (tech) => tech.HASSTRUCTUREDDATA === true
  ).length;
  const hasOpenGraph = technicalSEO.filter(
    (tech) => tech.HASOPENGRAPH === true
  ).length;
  const hasTwitterCards = technicalSEO.filter(
    (tech) => tech.HASTWITTERCARDS === true
  ).length;

  return `
    <div class="section">
      <h2>Technical SEO Analysis</h2>
      <p style="margin-bottom: 15px; color: #374151; font-size: 13px;">
        Technical SEO analysis across <strong>${
          technicalSEO.length
        }</strong> pages:
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
        <div class="issue-item ${duplicateTitles === 0 ? "success" : "error"}">
          <div class="issue-title">Duplicate Titles</div>
          <div class="issue-details">${
            duplicateTitles === 0
              ? "No duplicate titles found"
              : `${duplicateTitles} pages have duplicate titles`
          }</div>
        </div>
        <div class="issue-item ${duplicateDescs === 0 ? "success" : "error"}">
          <div class="issue-title">Duplicate Descriptions</div>
          <div class="issue-details">${
            duplicateDescs === 0
              ? "No duplicate descriptions found"
              : `${duplicateDescs} pages have duplicate descriptions`
          }</div>
        </div>
        <div class="issue-item ${
          hasStructuredData > 0 ? "success" : "warning"
        }">
          <div class="issue-title">Structured Data</div>
          <div class="issue-details">${hasStructuredData} pages have structured data</div>
        </div>
        <div class="issue-item ${hasOpenGraph > 0 ? "success" : "warning"}">
          <div class="issue-title">Open Graph Tags</div>
          <div class="issue-details">${hasOpenGraph} pages have Open Graph tags</div>
        </div>
        <div class="issue-item ${hasTwitterCards > 0 ? "success" : "warning"}">
          <div class="issue-title">Twitter Cards</div>
          <div class="issue-details">${hasTwitterCards} pages have Twitter cards</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
        ${technicalSEO
          .map((tech, index) => {
            const url = tech.URL || tech.url || "";
            const duplicateTitle =
              tech.DUPLICATETITLE || tech.duplicateTitle || "No";
            const duplicateDesc =
              tech.DUPLICATEDESC || tech.duplicateDesc || "No";
            const hasStructuredData =
              tech.HASSTRUCTUREDDATA || tech.hasStructuredData || false;
            const hasOpenGraph =
              tech.HASOPENGRAPH || tech.hasOpenGraph || false;
            const hasTwitterCards =
              tech.HASTWITTERCARDS || tech.hasTwitterCards || false;

            let status = "Good";
            if (duplicateTitle === "Yes" || duplicateDesc === "Yes")
              status = "Critical";
            else if (!hasStructuredData || !hasOpenGraph || !hasTwitterCards)
              status = "Warning";

            return `
            <div class="issue-item ${
              status === "Critical"
                ? "error"
                : status === "Warning"
                ? "warning"
                : "success"
            }" style="margin-bottom: 15px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div class="issue-title">Page ${index + 1}</div>
                <div>
                  ${
                    status === "Critical"
                      ? '<span class="status-badge status-error">Critical</span>'
                      : status === "Warning"
                      ? '<span class="status-badge status-warning">Warning</span>'
                      : '<span class="status-badge status-success">Good</span>'
                  }
                </div>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>URL:</strong> 
                <a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">${url}</a>
              </div>
              
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 10px;">
                <div style="padding: 8px; background: #f8fafc; border-radius: 4px;">
                  <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Duplicate Title</div>
                  <div style="font-weight: 600; color: ${
                    duplicateTitle === "Yes" ? "#dc2626" : "#059669"
                  };">${duplicateTitle}</div>
                </div>
                <div style="padding: 8px; background: #f8fafc; border-radius: 4px;">
                  <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Duplicate Description</div>
                  <div style="font-weight: 600; color: ${
                    duplicateDesc === "Yes" ? "#dc2626" : "#059669"
                  };">${duplicateDesc}</div>
                </div>
                <div style="padding: 8px; background: #f8fafc; border-radius: 4px;">
                  <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Structured Data</div>
                  <div style="font-weight: 600; color: ${
                    hasStructuredData ? "#059669" : "#f59e0b"
                  };">${hasStructuredData ? "Yes" : "No"}</div>
                </div>
                <div style="padding: 8px; background: #f8fafc; border-radius: 4px;">
                  <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Open Graph</div>
                  <div style="font-weight: 600; color: ${
                    hasOpenGraph ? "#059669" : "#f59e0b"
                  };">${hasOpenGraph ? "Yes" : "No"}</div>
                </div>
                <div style="padding: 8px; background: #f8fafc; border-radius: 4px;">
                  <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Twitter Cards</div>
                  <div style="font-weight: 600; color: ${
                    hasTwitterCards ? "#059669" : "#f59e0b"
                  };">${hasTwitterCards ? "Yes" : "No"}</div>
                </div>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function generateWorkingLinksSection(workingLinks) {
  if (!workingLinks || workingLinks.length === 0) {
    return `
      <div class="section">
        <h2>Working Links Analysis</h2>
        <div class="issue-item success">
          <div class="issue-title">No working links data available</div>
          <div class="issue-details">Working links analysis could not be performed.</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="section">
      <h2>Working Links Analysis</h2>
      <p style="margin-bottom: 15px; color: #374151; font-size: 13px;">
        All <strong>${
          workingLinks.length
        }</strong> internal links are functioning properly:
      </p>
      
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th class="url-column">Link URL</th>
            <th style="width: 15%;">Status Code</th>
            <th style="width: 10%;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${workingLinks
            .slice(0, 50)
            .map((link, index) => {
              const url = link.URL || link.url || link.link || "";
              const status =
                link.STATUS || link.status || link.statusCode || "Unknown";
              return `
              <tr>
                <td>${index + 1}</td>
                <td class="url-display">
                  <a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: underline;">${url}</a>
                </td>
                <td>${status}</td>
                <td><span class="status-badge status-success">Working</span></td>
              </tr>
            `;
            })
            .join("")}
          ${
            workingLinks.length > 50
              ? `<tr><td colspan="4" style="text-align: center; color: #6b7280; font-style: italic;">... and ${
                  workingLinks.length - 50
                } more working links</td></tr>`
              : ""
          }
        </tbody>
      </table>
    </div>
  `;
}

function generateBrokenLinksSection(brokenLinks) {
  if (!brokenLinks || brokenLinks.length === 0) {
    return `
      <div class="section">
        <h2>Broken Links Analysis</h2>
        <div class="issue-item success">
          <div class="issue-title">✅ No Broken Links Found</div>
          <div class="issue-details">All links on the website are working properly.</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="section">
      <h2>Broken Links Analysis</h2>
      <p style="margin-bottom: 15px; color: #374151; font-size: 13px;">
        Found <strong>${
          brokenLinks.length
        }</strong> broken links that need to be fixed:
      </p>
      
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th class="url-column">Broken Link URL</th>
            <th style="width: 15%;">Status Code</th>
            <th style="width: 10%;">Priority</th>
          </tr>
        </thead>
        <tbody>
          ${brokenLinks
            .map((link, index) => {
              const url = link.URL || link.url || link.link || "";
              const status =
                link.STATUS || link.status || link.statusCode || "Unknown";
              return `
              <tr>
                <td>${index + 1}</td>
                <td class="url-display">
                  <a href="${url}" target="_blank" style="color: #dc2626; text-decoration: underline;">${url}</a>
                </td>
                <td>${status}</td>
                <td><span class="status-badge status-error">High</span></td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function generateExternalLinksSection(externalLinks) {
  if (!externalLinks || externalLinks.length === 0) {
    return `
      <div class="section">
        <h2>External Links Analysis</h2>
        <div class="issue-item">
          <div class="issue-title">No external links found</div>
          <div class="issue-details">No external links were detected on the website.</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="section">
      <h2>External Links Analysis</h2>
      <p style="margin-bottom: 15px; color: #374151; font-size: 13px;">
        Found <strong>${
          externalLinks.length
        }</strong> external links on the website:
      </p>
      
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th class="url-column">External Link URL</th>
            <th style="width: 15%;">Type</th>
            <th style="width: 15%;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${externalLinks
            .slice(0, 50)
            .map((link, index) => {
              // Try multiple possible column names for external links
              const url =
                link.URL ||
                link.url ||
                link.link ||
                link.LINK ||
                link.externalLink ||
                link.EXTERNALLINK ||
                link.external_url ||
                link.EXTERNAL_URL ||
                "";
              const type =
                link.TYPE ||
                link.type ||
                link.linkType ||
                link.LINKTYPE ||
                "External";

              return `
              <tr>
                <td>${index + 1}</td>
                <td class="url-display">
                  ${
                    url
                      ? `<a href="${url}" target="_blank" style="color: #1e40af; text-decoration: underline;">${url}</a>`
                      : "URL not found"
                  }
                </td>
                <td><span class="status-badge status-success">${type}</span></td>
                <td><span class="status-badge status-success">Active</span></td>
              </tr>
            `;
            })
            .join("")}
          ${
            externalLinks.length > 50
              ? `<tr><td colspan="4" style="text-align: center; color: #6b7280; font-style: italic;">... and ${
                  externalLinks.length - 50
                } more external links</td></tr>`
              : ""
          }
        </tbody>
      </table>
    </div>
  `;
}

function generateAccessibilitySection(accessibilityIssues) {
  if (!accessibilityIssues || accessibilityIssues.length === 0) {
    return `
      <div class="section">
        <h2>Accessibility Analysis</h2>
        <div class="issue-item success">
          <div class="issue-title">✅ No Accessibility Issues Found</div>
          <div class="issue-details">The website appears to have good accessibility implementation.</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="section">
      <h2>Accessibility Analysis</h2>
      <p style="margin-bottom: 15px; color: #374151; font-size: 13px;">
        Found <strong>${
          accessibilityIssues.length
        }</strong> accessibility issues:
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
        ${accessibilityIssues
          .map((issue, index) => {
            const issueText =
              issue.ISSUE ||
              issue.issue ||
              issue.NOTE ||
              issue.note ||
              "Accessibility Issue";
            const url =
              issue.URL || issue.url || issue.PAGE || issue.page || "";
            const details =
              issue.DETAILS ||
              issue.details ||
              issue.NOTE ||
              issue.note ||
              "No additional details";

            return `
            <div class="issue-item warning" style="margin-bottom: 15px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div class="issue-title">Issue ${index + 1}</div>
                <div>
                  <span class="status-badge status-warning">Medium Priority</span>
                </div>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Issue:</strong> 
                <span style="color: #374151;">${issueText}</span>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Page URL:</strong> 
                ${
                  url
                    ? `<a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">${url}</a>`
                    : '<span style="color: #6b7280;">N/A</span>'
                }
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Details:</strong> 
                <span style="color: #64748b;">${details}</span>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function generateStructuredDataSection(structuredData) {
  if (!structuredData || structuredData.length === 0) {
    return `
      <div class="section">
        <h2>Structured Data Analysis</h2>
        <div class="issue-item">
          <div class="issue-title">No structured data available</div>
          <div class="issue-details">Structured data analysis could not be performed.</div>
        </div>
      </div>
    `;
  }

  const validStructured = structuredData.filter(
    (item) => item.VALID === "Yes" || item.valid === true
  ).length;

  return `
    <div class="section">
      <h2>Structured Data Analysis</h2>
      <p style="margin-bottom: 15px; color: #374151; font-size: 13px;">
        Structured data analysis across <strong>${
          structuredData.length
        }</strong> pages:
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
        <div class="issue-item ${
          validStructured === structuredData.length ? "success" : "warning"
        }">
          <div class="issue-title">Valid Structured Data</div>
          <div class="issue-details">${validStructured} out of ${
    structuredData.length
  } pages have valid structured data</div>
        </div>
      </div>
      
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Page URL</th>
            <th>Type</th>
            <th>Valid</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${structuredData
            .map((item, index) => {
              const url = item.URL || item.url || "";
              const type = item.TYPE || item.type || "Unknown";
              const valid = item.VALID || item.valid || false;

              return `
              <tr>
                <td>${index + 1}</td>
                <td class="url-display">
                  ${
                    url
                      ? `<a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: underline;">${url}</a>`
                      : "N/A"
                  }
                </td>
                <td>${type}</td>
                <td>${
                  valid === "Yes" || valid === true
                    ? '<span class="status-badge status-success">Yes</span>'
                    : '<span class="status-badge status-error">No</span>'
                }</td>
                <td>
                  ${
                    valid === "Yes" || valid === true
                      ? '<span class="status-badge status-success">Valid</span>'
                      : '<span class="status-badge status-error">Invalid</span>'
                  }
                </td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function generateMissingSEOSection(missingSEOIssues) {
  if (!missingSEOIssues || missingSEOIssues.length === 0) {
    return `
      <div class="section">
        <h2>SEO Issues</h2>
        <div class="issue-item success">
          <div class="issue-title">✅ No SEO Issues Found</div>
          <div class="issue-details">All SEO elements appear to be properly implemented.</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="section">
      <h2>SEO Issues</h2>
      <p style="margin-bottom: 15px; color: #374151; font-size: 13px;">
        Found <strong>${
          missingSEOIssues.length
        }</strong> SEO issues that need attention:
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
        ${missingSEOIssues
          .map((issue, index) => {
            const issueText =
              issue.ISSUE ||
              issue.issue ||
              issue.NOTE ||
              issue.note ||
              "SEO Issue";
            const url =
              issue.URL || issue.url || issue.PAGE || issue.page || "";
            const details =
              issue.DETAILS ||
              issue.details ||
              issue.NOTE ||
              issue.note ||
              "No additional details";

            return `
            <div class="issue-item error" style="margin-bottom: 15px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div class="issue-title">Issue ${index + 1}</div>
                <div>
                  <span class="status-badge status-error">High Priority</span>
                </div>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Issue:</strong> 
                <span style="color: #374151;">${issueText}</span>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Page URL:</strong> 
                ${
                  url
                    ? `<a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">${url}</a>`
                    : '<span style="color: #6b7280;">N/A</span>'
                }
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Details:</strong> 
                <span style="color: #64748b;">${details}</span>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function generateImageALTSection(imageALTTags) {
  if (!imageALTTags || imageALTTags.length === 0) {
    return `
      <div class="section">
        <h2>Image ALT Tags Analysis</h2>
        <div class="issue-item">
          <div class="issue-title">No image data available</div>
          <div class="issue-details">Image ALT tag analysis could not be performed.</div>
        </div>
      </div>
    `;
  }

  const missingAltTags = imageALTTags.filter(
    (img) => !img.altText || img.altText === "Missing"
  ).length;

  return `
    <div class="section">
      <h2>Image ALT Tags Analysis</h2>
      <p style="margin-bottom: 15px; color: #374151; font-size: 13px;">
        Image accessibility analysis across <strong>${
          imageALTTags.length
        }</strong> images:
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
        <div class="issue-item ${missingAltTags === 0 ? "success" : "warning"}">
          <div class="issue-title">Missing ALT Tags</div>
          <div class="issue-details">${
            missingAltTags === 0
              ? "All images have ALT tags"
              : `${missingAltTags} images missing ALT tags`
          }</div>
        </div>
        <div class="issue-item success">
          <div class="issue-title">Images with ALT Tags</div>
          <div class="issue-details">${
            imageALTTags.length - missingAltTags
          } images have proper ALT tags</div>
        </div>
      </div>
      
      ${
        missingAltTags > 0
          ? `
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Image URL</th>
              <th>ALT Text</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${imageALTTags
              .filter((img) => !img.altText || img.altText === "Missing")
              .slice(0, 20)
              .map(
                (img, index) => `
              <tr>
                <td>${index + 1}</td>
                <td class="url-display">
                  <a href="${
                    img.url || img.imageUrl || "#"
                  }" target="_blank" style="color: #3b82f6; text-decoration: underline;">${
                  img.url || img.imageUrl || "N/A"
                }</a>
                </td>
                <td>${img.altText || "Missing"}</td>
                <td><span class="status-badge status-error">Missing ALT</span></td>
              </tr>
            `
              )
              .join("")}
            ${
              missingAltTags > 20
                ? `<tr><td colspan="4" style="text-align: center; color: #6b7280; font-style: italic;">... and ${
                    missingAltTags - 20
                  } more images missing ALT tags</td></tr>`
                : ""
            }
          </tbody>
        </table>
      `
          : '<p style="color: #059669; font-weight: 600;">✅ All images have proper ALT tags!</p>'
      }
    </div>
  `;
}

function generateKeywordDensitySection(keywordDensity) {
  if (!keywordDensity || keywordDensity.length === 0) {
    return `
      <div class="section">
        <h2>Keyword Density Analysis</h2>
        <div class="issue-item">
          <div class="issue-title">No keyword data available</div>
          <div class="issue-details">Keyword density analysis could not be performed.</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="section">
      <h2>Keyword Density Analysis</h2>
      <p style="margin-bottom: 15px; color: #374151; font-size: 13px;">
        Keyword analysis across <strong>${
          keywordDensity.length
        }</strong> keywords:
      </p>
      
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Keyword</th>
            <th>Count</th>
            <th>Density (%)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${keywordDensity
            .slice(0, 30)
            .map((keyword, index) => {
              const keywordText =
                keyword.KEYWORD || keyword.keyword || keyword.word || "";
              const count =
                keyword.COUNT || keyword.count || keyword.occurrences || 0;
              const density =
                keyword.DENSITY || keyword.density || keyword.percentage || 0;

              let status = "Good";
              if (density > 5) status = "Warning"; // Over-optimization
              else if (density < 0.5) status = "Warning"; // Under-optimization

              return `
              <tr>
                <td>${index + 1}</td>
                <td>${keywordText}</td>
                <td>${count}</td>
                <td>${density}%</td>
                <td>
                  ${
                    status === "Warning"
                      ? '<span class="status-badge status-warning">Review</span>'
                      : '<span class="status-badge status-success">Good</span>'
                  }
                </td>
              </tr>
            `;
            })
            .join("")}
          ${
            keywordDensity.length > 30
              ? `<tr><td colspan="5" style="text-align: center; color: #6b7280; font-style: italic;">... and ${
                  keywordDensity.length - 30
                } more keywords</td></tr>`
              : ""
          }
        </tbody>
      </table>
    </div>
  `;
}

function generatePerformanceSection(performanceMetrics) {
  if (!performanceMetrics || performanceMetrics.length === 0) {
    return `
      <div class="section">
        <h2>Performance Metrics</h2>
        <div class="issue-item">
          <div class="issue-title">No performance data available</div>
          <div class="issue-details">Performance metrics could not be extracted.</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="section">
      <h2>Performance Metrics</h2>
      <p style="margin-bottom: 15px; color: #374151; font-size: 13px;">
        Performance analysis across <strong>${
          performanceMetrics.length
        }</strong> pages:
      </p>
      
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Page URL</th>
            <th>Load Time (ms)</th>
            <th>Performance Score</th>
            <th>SEO Score</th>
            <th>Accessibility Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${performanceMetrics
            .map((metric, index) => {
              const url = metric.URL || metric.url || "";
              const loadTime =
                metric.LOADTIME || metric.loadTime || metric.loadTimeMs || 0;
              const performanceScore =
                metric.PERFORMANCESCORE || metric.performanceScore || 0;
              const seoScore = metric.SEOSCORE || metric.seoScore || 0;
              const accessibilityScore =
                metric.ACCESSIBILITYSCORE || metric.accessibilityScore || 0;

              let status = "Good";
              if (
                performanceScore < 70 ||
                seoScore < 70 ||
                accessibilityScore < 70
              )
                status = "Warning";
              if (
                performanceScore < 50 ||
                seoScore < 50 ||
                accessibilityScore < 50
              )
                status = "Critical";

              return `
              <tr>
                <td>${index + 1}</td>
                <td class="url-display">
                  <a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: underline;">${url}</a>
                </td>
                <td>${loadTime}ms</td>
                <td>${performanceScore}/100</td>
                <td>${seoScore}/100</td>
                <td>${accessibilityScore}/100</td>
                <td>
                  ${
                    status === "Critical"
                      ? '<span class="status-badge status-error">Critical</span>'
                      : status === "Warning"
                      ? '<span class="status-badge status-warning">Warning</span>'
                      : '<span class="status-badge status-success">Good</span>'
                  }
                </td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function generateRecommendationsSection(allData) {
  const recommendations = [];

  if (allData["Broken Links"] && allData["Broken Links"].length > 0) {
    recommendations.push(
      `Fix ${allData["Broken Links"].length} broken links to improve user experience and SEO rankings`
    );
  }

  if (allData["SEO Info"]) {
    const missingTitles = allData["SEO Info"].filter(
      (seo) => !seo.TITLE || seo.TITLE === ""
    ).length;
    if (missingTitles > 0) {
      recommendations.push(
        `Add title tags to ${missingTitles} pages for better SEO`
      );
    }
  }

  if (
    allData["Accessibility Issues"] &&
    allData["Accessibility Issues"].length > 0
  ) {
    recommendations.push(
      `Address ${allData["Accessibility Issues"].length} accessibility issues for better user experience`
    );
  }

  if (allData["Structured Data"]) {
    const invalidStructured = allData["Structured Data"].filter(
      (item) => item.VALID !== "Yes" && item.valid !== true
    ).length;
    if (invalidStructured > 0) {
      recommendations.push(
        `Fix structured data markup for ${invalidStructured} pages for better search engine understanding`
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Continue monitoring SEO performance and maintain current optimization levels"
    );
  }

  return `
    <div class="section">
      <h2>SEO Recommendations</h2>
      <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #0369a1; margin-bottom: 15px;">Priority Actions</h3>
        <ol style="margin-left: 20px; color: #1e293b;">
          ${recommendations
            .map((rec, index) => `<li style="margin-bottom: 8px;">${rec}</li>`)
            .join("")}
        </ol>
      </div>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
        <h3 style="color: #1e293b; margin-bottom: 15px;">Next Steps</h3>
        <ul style="margin-left: 20px; color: #374151;">
          <li style="margin-bottom: 8px;">Implement the priority recommendations above</li>
          <li style="margin-bottom: 8px;">Monitor search console for any new issues</li>
          <li style="margin-bottom: 8px;">Re-run this analysis after implementing changes</li>
          <li style="margin-bottom: 8px;">Track improvements in search rankings and traffic</li>
        </ul>
      </div>
    </div>
  `;
}

// Export the new function
export { generateIndividualPDFReport };
