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
- Aggregates data from multiple sources (e.g., PageSpeed, CrUX).
- Supports parameterized queries (e.g., URL, strategy, form factor).
- Uses GraphQL enums for strict value constraints (e.g., `strategy`, `formFactor`).
- Returns structured results with summary and detailed metrics.

## GraphQL Schema

- **Query:** `combined(url: String!, strategy: StrategyEnum, formFactor: FormFactorEnum): CombinedResult`
- **Types:**
  - `CombinedResult`: Contains `summary`, `pagespeed`, and `crux` fields.
  - `Summary`: Aggregated performance metrics.
  - `PageSpeed`: Raw PageSpeed metrics.
  - `CrUX`: Chrome User Experience Report metrics.
- **Enums:**
  - `StrategyEnum`: e.g., `MOBILE`, `DESKTOP`
  - `FormFactorEnum`: e.g., `PHONE`, `TABLET`, `DESKTOP`

## Example Query

```
query Combined($url: String!) {
  combined(url: $url, strategy: MOBILE, formFactor: PHONE) {
    summary {
      origin
      performanceScore
      lcpDeltaMs
      inpDeltaMs
      clsDelta
    }
    pagespeed {
      lcpMs
      inpMs
      cls
    }
    crux {
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
