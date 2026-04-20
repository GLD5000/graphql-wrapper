# Technical Specification: GraphQL Wrapper

## Overview

This project provides a GraphQL API wrapper for aggregating and exposing web performance metrics (such as PageSpeed, CrUX, and custom summaries) for a given URL. It is built with Next.js (API routes) and TypeScript.

## Architecture

- **Framework:** Next.js (API routes)
- **Language:** TypeScript
- **GraphQL Server:** Implemented in the API route at `app/api/graphql/route.ts`
- **Schema Definition:** Located in `lib/graphql/schema.ts`
- **Frontend:** Not included (API only)

## Features

- Exposes a `/api/graphql` endpoint for querying web performance data.
- Fetches data from multiple sources (e.g., PageSpeed Insights, Chrome UX Report).
- Supports parameterized queries (e.g., URL, strategy, form factor).
- Uses GraphQL enums for strict value constraints (e.g., `strategy`, `formFactor`).
- Returns structured results with detailed metrics.

## GraphQL Schema

- **Queries:**
  - `website(url: String!)`: Get WebsiteInsights for a URL
  - `pagespeed(url: String!, strategy: PsiStrategy, categories: [PsiCategory])`: Get PageSpeed data
  - `crux(origin: String!, formFactor: FormFactor, metrics: [String])`: Get CrUX history data
- **Types:**
  - `WebsiteInsights`: Contains `pagespeed` and `crux` resolvers.
  - `PageSpeedResult`: Raw PageSpeed metrics from Google PageSpeed Insights.
  - `CruxHistoryResult`: Chrome User Experience Report metrics.
- **Enums:**
  - `PsiStrategy`: e.g., `MOBILE`, `DESKTOP`
  - `FormFactor`: e.g., `PHONE`, `TABLET`, `DESKTOP`, `ALL`
  - `PsiCategory`: e.g., `PERFORMANCE`, `ACCESSIBILITY`, `BEST_PRACTICES`, `SEO`, `PWA`

## Example Query

```
query Website($url: String!) {
  website(url: $url) {
    inputUrl
    origin
    pagespeed(strategy: MOBILE) {
      performanceScore
      lcpMs
      inpMs
      cls
    }
    crux(formFactor: PHONE) {
      formFactor
      metrics {
        metric
        p75s
      }
    }
  }
}
```

## API Route

- **Path:** `/api/graphql`
- **File:** `app/api/graphql/route.ts`
- **Method:** POST
- **Request Body:** JSON with `query` and `variables`

## Data Flow

1. Client sends a GraphQL query to `/api/graphql`.
2. The API route parses the query and variables.
3. The resolver fetches and aggregates data from external APIs (e.g., PageSpeed, CrUX).
4. The response is structured according to the GraphQL schema and returned to the client.

## Dependencies

- `next`
- `graphql`
- `typescript`

## Future Improvements

- Add authentication and rate limiting.
- Add web hosting
- Support additional metrics and data sources.
- Add automated tests.
- Provide a frontend UI for query exploration.

## License

MIT See [LICENSE](LICENSE) for details.
