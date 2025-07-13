import puppeteer from "puppeteer";

// Function to generate SEO checklist PDF
export async function generateSEOChecklistPDF() {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>25 Quick SEO Fixes to Boost Your Website Traffic</title>
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
            padding: 40px;
            text-align: center;
            border-bottom: 3px solid #4f46e5;
          }
          
          .brand-logo {
            font-size: 3rem;
            font-weight: 800;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
          }
          
          .brand-tagline {
            font-size: 1.2rem;
            opacity: 0.9;
            font-weight: 300;
            margin-bottom: 20px;
          }
          
          .checklist-title {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
          }
          
          .checklist-subtitle {
            font-size: 1.1rem;
            opacity: 0.9;
            font-weight: 300;
          }
          
          .content {
            padding: 40px;
          }
          
          .intro-section {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 40px;
            border-left: 5px solid #3b82f6;
          }
          
          .intro-title {
            font-size: 1.5rem;
            color: #1e293b;
            margin-bottom: 15px;
            font-weight: 600;
          }
          
          .intro-text {
            color: #374151;
            font-size: 1rem;
            line-height: 1.7;
          }
          
          .checklist-grid {
            display: grid;
            gap: 25px;
          }
          
          .checklist-item {
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
          }
          
          .checklist-item:hover {
            border-color: #3b82f6;
            box-shadow: 0 4px 8px rgba(59, 130, 246, 0.1);
            transform: translateY(-2px);
          }
          
          .checklist-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          
          .item-number {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            width: 35px;
            height: 35px;
            border-radius: 50%;
            text-align: center;
            line-height: 35px;
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 15px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          
          .item-title {
            font-size: 1.3rem;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 10px;
            line-height: 1.4;
          }
          
          .item-description {
            color: #64748b;
            font-size: 0.95rem;
            line-height: 1.6;
            margin-bottom: 15px;
          }
          
          .item-actions {
            background: #f8fafc;
            border-radius: 8px;
            padding: 15px;
            border-left: 3px solid #3b82f6;
          }
          
          .action-title {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 8px;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          
          .action-list {
            list-style: none;
            padding: 0;
          }
          
          .action-list li {
            color: #374151;
            font-size: 0.9rem;
            margin-bottom: 5px;
            padding-left: 20px;
            position: relative;
          }
          
          .action-list li::before {
            content: '✓';
            position: absolute;
            left: 0;
            color: #10b981;
            font-weight: bold;
          }
          
          .priority-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 10px;
          }
          
          .priority-high {
            background: #fef2f2;
            color: #dc2626;
            border: 1px solid #fecaca;
          }
          
          .priority-medium {
            background: #fffbeb;
            color: #d97706;
            border: 1px solid #fed7aa;
          }
          
          .priority-low {
            background: #f0fdf4;
            color: #059669;
            border: 1px solid #bbf7d0;
          }
          
          .category-section {
            margin-bottom: 40px;
          }
          
          .category-title {
            font-size: 1.8rem;
            color: #1e293b;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #e2e8f0;
            position: relative;
          }
          
          .category-title::after {
            content: '';
            position: absolute;
            bottom: -3px;
            left: 0;
            width: 60px;
            height: 3px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          
          .footer {
            background: #1e293b;
            color: white;
            text-align: center;
            padding: 30px;
            margin-top: 40px;
          }
          
          .footer-title {
            font-size: 1.3rem;
            margin-bottom: 15px;
            font-weight: 600;
          }
          
          .footer-text {
            color: #cbd5e1;
            font-size: 0.95rem;
            line-height: 1.6;
            margin-bottom: 20px;
          }
          
          .footer-cta {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            border-radius: 25px;
            text-decoration: none;
            font-weight: 600;
            display: inline-block;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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
            
            .checklist-item:hover {
              transform: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="brand-header">
            <div class="brand-logo">CrawlVaani</div>
            <div class="brand-tagline">Crawl Smart. Rank Better.</div>
            <div class="checklist-title">25 Quick SEO Fixes to Boost Your Website Traffic</div>
            <div class="checklist-subtitle">Actionable strategies to improve your search engine rankings and drive more organic traffic</div>
          </div>
          
          <div class="content">
            <div class="intro-section">
              <div class="intro-title">🚀 Ready to Transform Your Website's SEO?</div>
              <div class="intro-text">
                This comprehensive checklist contains 25 proven SEO strategies that can significantly improve your website's search engine rankings and drive more organic traffic. Each fix is categorized by priority and includes specific action steps you can implement immediately. Whether you're a beginner or an experienced SEO professional, these strategies will help you optimize your website for better search engine visibility.
              </div>
            </div>
            
            <div class="page-break"></div>
            
            <div class="category-section">
              <h2 class="category-title">🔴 High Priority Fixes (Critical Impact)</h2>
              <div class="checklist-grid">
                <div class="checklist-item">
                  <div class="priority-badge priority-high">High Priority</div>
                  <div class="item-number">1</div>
                  <div class="item-title">Fix Broken Links</div>
                  <div class="item-description">Broken links hurt user experience and SEO rankings. They signal to search engines that your site may be outdated or poorly maintained.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Use a link checker tool to identify broken links</li>
                      <li>Update or remove broken internal links</li>
                      <li>Set up 301 redirects for important external links</li>
                      <li>Monitor for new broken links regularly</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-high">High Priority</div>
                  <div class="item-number">2</div>
                  <div class="item-title">Optimize Page Loading Speed</div>
                  <div class="item-description">Page speed is a critical ranking factor and directly impacts user experience. Slow pages lead to higher bounce rates.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Compress and optimize images</li>
                      <li>Minimize CSS and JavaScript files</li>
                      <li>Enable browser caching</li>
                      <li>Use a CDN for faster content delivery</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-high">High Priority</div>
                  <div class="item-number">3</div>
                  <div class="item-title">Create Unique Title Tags</div>
                  <div class="item-description">Title tags are one of the most important on-page SEO elements. They appear in search results and influence click-through rates.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Write unique, descriptive titles (50-60 characters)</li>
                      <li>Include primary keywords naturally</li>
                      <li>Avoid duplicate titles across pages</li>
                      <li>Make titles compelling and click-worthy</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-high">High Priority</div>
                  <div class="item-number">4</div>
                  <div class="item-title">Write Compelling Meta Descriptions</div>
                  <div class="item-description">Meta descriptions appear in search results and can significantly impact click-through rates from search engines.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Write unique descriptions (150-160 characters)</li>
                      <li>Include primary keywords naturally</li>
                      <li>Add a clear call-to-action</li>
                      <li>Make them compelling and informative</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-high">High Priority</div>
                  <div class="item-number">5</div>
                  <div class="item-title">Implement Proper Heading Structure</div>
                  <div class="item-description">Proper heading hierarchy (H1, H2, H3) helps search engines understand your content structure and improves accessibility.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Use only one H1 tag per page</li>
                      <li>Create logical heading hierarchy</li>
                      <li>Include relevant keywords in headings</li>
                      <li>Make headings descriptive and user-friendly</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="page-break"></div>
            
            <div class="category-section">
              <h2 class="category-title">🟡 Medium Priority Fixes (Significant Impact)</h2>
              <div class="checklist-grid">
                <div class="checklist-item">
                  <div class="priority-badge priority-medium">Medium Priority</div>
                  <div class="item-number">6</div>
                  <div class="item-title">Add Alt Text to Images</div>
                  <div class="item-description">Alt text helps search engines understand image content and improves accessibility for users with screen readers.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Add descriptive alt text to all images</li>
                      <li>Include relevant keywords naturally</li>
                      <li>Keep alt text under 125 characters</li>
                      <li>Make alt text meaningful and descriptive</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-medium">Medium Priority</div>
                  <div class="item-number">7</div>
                  <div class="item-title">Optimize URL Structure</div>
                  <div class="item-description">Clean, descriptive URLs help users and search engines understand your content better.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Use descriptive, keyword-rich URLs</li>
                      <li>Keep URLs short and readable</li>
                      <li>Use hyphens instead of underscores</li>
                      <li>Avoid unnecessary parameters</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-medium">Medium Priority</div>
                  <div class="item-number">8</div>
                  <div class="item-title">Create XML Sitemap</div>
                  <div class="item-description">XML sitemaps help search engines discover and index your pages more efficiently.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Generate an XML sitemap for your site</li>
                      <li>Submit sitemap to Google Search Console</li>
                      <li>Keep sitemap updated with new content</li>
                      <li>Include only important, indexable pages</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-medium">Medium Priority</div>
                  <div class="item-number">9</div>
                  <div class="item-title">Implement Schema Markup</div>
                  <div class="item-description">Schema markup helps search engines understand your content better and can lead to rich snippets in search results.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Add relevant schema markup to your pages</li>
                      <li>Use Google's Structured Data Testing Tool</li>
                      <li>Focus on business, product, and article schemas</li>
                      <li>Keep schema markup accurate and up-to-date</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-medium">Medium Priority</div>
                  <div class="item-number">10</div>
                  <div class="item-title">Optimize for Mobile</div>
                  <div class="item-description">Mobile-first indexing means Google primarily uses the mobile version of your site for ranking.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Ensure responsive design works properly</li>
                      <li>Test mobile usability and speed</li>
                      <li>Optimize touch targets and navigation</li>
                      <li>Use mobile-friendly fonts and spacing</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-medium">Medium Priority</div>
                  <div class="item-number">11</div>
                  <div class="item-title">Add Internal Links</div>
                  <div class="item-description">Internal linking helps distribute page authority and improves user navigation and engagement.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Link to relevant internal pages naturally</li>
                      <li>Use descriptive anchor text</li>
                      <li>Create a logical site structure</li>
                      <li>Link from high-authority pages to important pages</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-medium">Medium Priority</div>
                  <div class="item-number">12</div>
                  <div class="item-title">Optimize Core Web Vitals</div>
                  <div class="item-description">Core Web Vitals are key metrics that measure user experience and are ranking factors.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Improve Largest Contentful Paint (LCP)</li>
                      <li>Reduce First Input Delay (FID)</li>
                      <li>Minimize Cumulative Layout Shift (CLS)</li>
                      <li>Monitor performance regularly</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-medium">Medium Priority</div>
                  <div class="item-number">13</div>
                  <div class="item-title">Create Quality Content</div>
                  <div class="item-description">High-quality, valuable content is the foundation of good SEO and user engagement.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Write comprehensive, helpful content</li>
                      <li>Address user intent and questions</li>
                      <li>Use natural language and clear structure</li>
                      <li>Update content regularly</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-medium">Medium Priority</div>
                  <div class="item-number">14</div>
                  <div class="item-title">Optimize for Featured Snippets</div>
                  <div class="item-description">Featured snippets appear at the top of search results and can drive significant traffic.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Answer common questions clearly</li>
                      <li>Use structured data markup</li>
                      <li>Create content that directly answers queries</li>
                      <li>Use bullet points and numbered lists</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-medium">Medium Priority</div>
                  <div class="item-number">15</div>
                  <div class="item-title">Improve Site Security</div>
                  <div class="item-description">HTTPS is a ranking factor and builds user trust. Security issues can hurt rankings.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Install SSL certificate (HTTPS)</li>
                      <li>Fix security vulnerabilities</li>
                      <li>Keep software and plugins updated</li>
                      <li>Monitor for security issues</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="page-break"></div>
            
            <div class="category-section">
              <h2 class="category-title">🟢 Low Priority Fixes (Long-term Benefits)</h2>
              <div class="checklist-grid">
                <div class="checklist-item">
                  <div class="priority-badge priority-low">Low Priority</div>
                  <div class="item-number">16</div>
                  <div class="item-title">Add Social Media Meta Tags</div>
                  <div class="item-description">Open Graph and Twitter Card tags improve how your content appears when shared on social media.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Add Open Graph tags for Facebook</li>
                      <li>Include Twitter Card meta tags</li>
                      <li>Use compelling social media images</li>
                      <li>Test social media previews</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-low">Low Priority</div>
                  <div class="item-number">17</div>
                  <div class="item-title">Optimize for Voice Search</div>
                  <div class="item-description">Voice search is growing rapidly and requires different optimization strategies.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Answer questions in natural language</li>
                      <li>Use long-tail keywords</li>
                      <li>Create FAQ content</li>
                      <li>Optimize for local voice searches</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-low">Low Priority</div>
                  <div class="item-number">18</div>
                  <div class="item-title">Create Video Content</div>
                  <div class="item-description">Video content can improve engagement and time on site, which are positive ranking signals.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Create relevant video content</li>
                      <li>Optimize video titles and descriptions</li>
                      <li>Add video sitemaps</li>
                      <li>Embed videos on relevant pages</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-low">Low Priority</div>
                  <div class="item-number">19</div>
                  <div class="item-title">Improve User Experience</div>
                  <div class="item-description">Better user experience leads to lower bounce rates and higher engagement, which helps SEO.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Improve site navigation</li>
                      <li>Reduce page load times</li>
                      <li>Make content easy to scan</li>
                      <li>Optimize for user intent</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-low">Low Priority</div>
                  <div class="item-number">20</div>
                  <div class="item-title">Build Local SEO</div>
                  <div class="item-description">Local SEO helps businesses appear in local search results and Google Maps.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Optimize Google My Business profile</li>
                      <li>Add local keywords to content</li>
                      <li>Get local citations and reviews</li>
                      <li>Create location-specific content</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-low">Low Priority</div>
                  <div class="item-number">21</div>
                  <div class="item-title">Monitor and Analyze Performance</div>
                  <div class="item-description">Regular monitoring helps you identify issues and opportunities for improvement.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Set up Google Analytics and Search Console</li>
                      <li>Monitor key metrics regularly</li>
                      <li>Track keyword rankings</li>
                      <li>Analyze user behavior data</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-low">Low Priority</div>
                  <div class="item-number">22</div>
                  <div class="item-title">Create an SEO Strategy</div>
                  <div class="item-description">A comprehensive SEO strategy helps you focus on the most important improvements.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Define your target keywords</li>
                      <li>Create a content calendar</li>
                      <li>Set measurable goals</li>
                      <li>Plan regular audits and updates</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-low">Low Priority</div>
                  <div class="item-number">23</div>
                  <div class="item-title">Optimize for E-A-T</div>
                  <div class="item-description">Expertise, Authoritativeness, and Trustworthiness are important ranking factors.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Create expert-level content</li>
                      <li>Build author credibility</li>
                      <li>Establish site authority</li>
                      <li>Gain trust through quality content</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-low">Low Priority</div>
                  <div class="item-number">24</div>
                  <div class="item-title">Implement Technical SEO</div>
                  <div class="item-description">Technical SEO ensures search engines can properly crawl and index your site.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Fix crawl errors and issues</li>
                      <li>Optimize robots.txt file</li>
                      <li>Implement proper canonical tags</li>
                      <li>Monitor site health regularly</li>
                    </ul>
                  </div>
                </div>
                
                <div class="checklist-item">
                  <div class="priority-badge priority-low">Low Priority</div>
                  <div class="item-number">25</div>
                  <div class="item-title">Stay Updated with SEO Trends</div>
                  <div class="item-description">SEO is constantly evolving, and staying current helps maintain competitive advantage.</div>
                  <div class="item-actions">
                    <div class="action-title">Action Steps:</div>
                    <ul class="action-list">
                      <li>Follow industry blogs and news</li>
                      <li>Attend SEO conferences and webinars</li>
                      <li>Test new strategies carefully</li>
                      <li>Adapt to algorithm changes</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-title">Ready to Transform Your Website's SEO?</div>
              <div class="footer-text">
                This checklist contains proven strategies that can significantly improve your search engine rankings and drive more organic traffic to your website. Start with the high-priority items and work your way through the list systematically. Remember, SEO is a long-term process, but these fixes will help you see results faster.
              </div>
              <a href="https://crawlvaani.com" class="footer-cta">Get Your Free SEO Audit</a>
            </div>
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
    console.error("Error generating SEO checklist PDF:", error);
    throw new Error(`Failed to generate SEO checklist PDF: ${error.message}`);
  }
}
