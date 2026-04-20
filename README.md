# [graphql-wrapper](https://github.com/GLD5000/graphql-wrapper)

A Next.js GraphQL API wrapper around:

Chrome UX Report History API
PageSpeed Insights API

## Documentation

- [Technical Specification](technical-spec.md)
- [Schema Summary](schema-summary.md)

The endpoint lets clients ask for exactly the fields they need, and only the requested upstream API calls are made.

## 1. Prerequisites

1. Create a [Google Cloud project](https://console.cloud.google.com/).
2. Enable these APIs:

- `Chrome UX Report API`
- `PageSpeed Insights API`

3. Create an API key.

Reference docs:

- https://developers.google.com/speed/docs/insights/v5/get-started#APIKey
- https://developer.chrome.com/docs/crux/history-api#crux_api_key

## 2. Configure environment

Create or update `.env.local`:

```bash
GOOGLE_API_KEY=your_google_api_key_here
```

## 3. Install and run

```bash
npm install
npm run dev
```

GraphQL endpoint:

`POST /api/graphql`

## 4. Query examples

### Query website insights lazily

This requests only specific fields from both providers under one website node.

```graphql
query Website($url: String!) {
  website(url: $url) {
    inputUrl
    origin
    pagespeed(strategy: MOBILE, categories: [PERFORMANCE, SEO]) {
      performanceScore
      lcpMs
      inpMs
      cls
      categoryScores {
        id
        score
      }
    }
    crux(formFactor: PHONE) {
      queriedOrigin
      metrics {
        metric
        p75s
      }
    }
  }
}
```

Variables:

```json
{
  "url": "https://web.dev"
}
```

cURL:

```bash
curl -X POST http://localhost:3000/api/graphql \
    -H "Content-Type: application/json" \
    -d '{
        "query": "query Website($url: String!) { website(url: $url) { inputUrl origin pagespeed(strategy: MOBILE, categories: [PERFORMANCE, SEO]) { performanceScore lcpMs inpMs cls categoryScores { id score } } crux(formFactor: PHONE) { queriedOrigin metrics { metric p75s } } } }",
        "variables": {
            "url": "https://web.dev"
        }
    }'
```

### Direct PageSpeed query

```graphql
query {
  pagespeed(url: "https://example.com", strategy: DESKTOP) {
    finalUrl
    performanceScore
    fcpMs
    lcpMs
  }
}
```

cURL:

```bash
curl -X POST http://localhost:3000/api/graphql \
    -H "Content-Type: application/json" \
    -d '{
        "query": "query { pagespeed(url: \"https://example.com\", strategy: DESKTOP) { finalUrl performanceScore fcpMs lcpMs } }"
    }'
```

### Direct CrUX query

```graphql
query {
  crux(origin: "https://example.com", formFactor: PHONE) {
    collectionPeriods {
      firstDate
      lastDate
    }
    metrics {
      metric
      p75s
      histogram {
        start
        end
        densities
      }
    }
  }
}
```

cURL:

```bash
curl -X POST http://localhost:3000/api/graphql \
    -H "Content-Type: application/json" \
    -d '{
        "query": "query { crux(origin: \"https://example.com\", formFactor: PHONE) { collectionPeriods { firstDate lastDate } metrics { metric p75s histogram { start end densities } } } }"
    }'
```

## Notes

- The API requires `GOOGLE_API_KEY` at runtime.
- If an upstream Google API request fails, GraphQL returns the error in the `errors` array.
- `rawJson` fields are available on both `PageSpeedResult` and `CruxHistoryResult` when full payload debugging is needed.
