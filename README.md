# CrawlVaani Backend API

Backend API for the CrawlVaani SEO Website Crawler.

## Features

- Website crawling and SEO analysis
- PDF and Excel report generation
- AI-powered SEO insights
- Rate limiting and security
- CORS support for frontend integration

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
PORT=4000
OPENROUTER_API_KEY=your-openrouter-api-key
GEMINI_API_KEY=your-gemini-api-key
REPORTS_TOKEN=your-reports-access-token
CORS_ORIGIN=http://localhost:3000
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production

```bash
npm start
```

## API Endpoints

- `POST /api/crawl` - Crawl a website for SEO analysis
- `GET /api/reports/list` - List available reports (protected)
- `GET /api/reports/individual/pdf/:fileName` - Download PDF report (protected)
- `GET /api/reports/individual/excel/:fileName` - Download Excel report (protected)

## Security

- Reports endpoints are protected with token authentication
- Rate limiting is enabled for API endpoints
- CORS is configured for frontend integration

## Deployment

This backend is designed to be deployed on Render.com with the following configuration:

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment Variables**: Set all required environment variables in Render dashboard
