# GraphQL Schema Summary

## Main Concepts

- **Website Insights**: The main entry point for querying performance data about a website. You provide a URL, and you can request:
  - PageSpeed results
  - CrUX results

- **PageSpeedResult**: Contains metrics from Google PageSpeed Insights, such as:
  - Performance score
  - Largest Contentful Paint (LCP)
  - Interaction to Next Paint (INP)
  - Cumulative Layout Shift (CLS)
  - First Contentful Paint (FCP)
  - Time to First Byte (TTFB)
  - Category scores (e.g., Performance, SEO)

- **CruxHistoryResult**: Contains metrics from the Chrome UX Report, including:
  - User experience metrics (LCP, INP, CLS, FCP, TTFB)
  - Histograms of metric distributions
  - Data for different devices (form factors)
  - Collection periods (date ranges)

## Key Types and Fields

- **Enums**:
  - `FormFactor`: Device type (PHONE, DESKTOP, TABLET, ALL)
  - `PsiStrategy`: PageSpeed strategy (MOBILE, DESKTOP)
  - `PsiCategory`: PageSpeed categories (PERFORMANCE, ACCESSIBILITY, BEST_PRACTICES, SEO, PWA)

- **Queries**:
  - `website(url: String!)`: Get all insights for a website
  - `pagespeed(url: String!, ...)`: Get only PageSpeed data
  - `crux(origin: String!, ...)`: Get only CrUX data

- **Arguments**:
  - You can filter by device type (form factor), strategy (mobile/desktop), and which metrics or categories to include.

## Example Usage

- Query a website's performance for mobile phones:
  - `website(url: "https://example.com") { pagespeed(strategy: MOBILE) { ... } crux(formFactor: PHONE) { ... } }`

## Notes

- All main types include a `rawJson` field for debugging, containing the full upstream API response.
- The schema is designed to let clients request only the data they need, minimizing unnecessary API calls.
