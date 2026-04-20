import { buildSchema } from "graphql";

/**
 * Default Metrics for CRUX History calls
 */
const DEFAULT_CRUX_METRICS = [
  "largest_contentful_paint",
  "interaction_to_next_paint",
  "cumulative_layout_shift",
  "first_contentful_paint",
  "experimental_time_to_first_byte",
];

const schemaSource = `
  """Device form factor used when querying CrUX data."""
  enum FormFactor {
    """Mobile phone."""
    PHONE
    """Desktop computer."""
    DESKTOP
    """Tablet device."""
    TABLET
    """Aggregate across all form factors."""
    ALL
  }

  """Strategy used when running a PageSpeed Insights audit."""
  enum PsiStrategy {
    """Simulate a mobile device."""
    MOBILE
    """Simulate a desktop device."""
    DESKTOP
  }

  """Lighthouse audit category to include in a PageSpeed Insights run."""
  enum PsiCategory {
    """Core performance metrics and diagnostics."""
    PERFORMANCE
    """Accessibility best practices."""
    ACCESSIBILITY
    """Modern web best practices."""
    BEST_PRACTICES
    """Search engine optimisation."""
    SEO
    """Progressive Web App checks."""
    PWA
  }

  """Date range covered by a single CrUX collection period."""
  type CollectionPeriod {
    """First day of the collection period (JSON-encoded date object)."""
    firstDate: String
    """Last day of the collection period (JSON-encoded date object)."""
    lastDate: String
  }

  """A single bin in a CrUX metric histogram timeseries."""
  type HistogramBin {
    """Lower bound of this bin in the metric's native unit."""
    start: Float
    """Upper bound of this bin in the metric's native unit."""
    end: Float
    """Fraction of sessions in this bin for each collection period."""
    densities: [Float!]!
  }

  """Historical p75 and histogram data for a single CrUX metric."""
  type CruxMetricSeries {
    """Metric name as returned by the CrUX API (e.g. largest_contentful_paint)."""
    metric: String!
    """75th-percentile values across collection periods."""
    p75s: [Float]
    """Histogram bins across collection periods."""
    histogram: [HistogramBin!]!
  }

  """CrUX history response for an origin."""
  type CruxHistoryResult {
    """Origin that was queried."""
    queriedOrigin: String!
    """Form factor the data is segmented by."""
    formFactor: FormFactor!
    """Ordered list of collection periods covered by this response."""
    collectionPeriods: [CollectionPeriod!]!
    """Metric series included in this response."""
    metrics: [CruxMetricSeries!]!
    """Raw JSON response from the CrUX API."""
    rawJson: String!
  }

  """Lighthouse score for a single audit category."""
  type PageSpeedCategoryScore {
    """Category identifier (e.g. performance, seo)."""
    id: String!
    """Score between 0 and 1, or null if not available."""
    score: Float
    """Human-readable category title."""
    title: String
  }

  """PageSpeed Insights result for a URL."""
  type PageSpeedResult {
    """URL that was originally requested."""
    requestedUrl: String!
    """Final URL after redirects."""
    finalUrl: String
    """Strategy used for the audit."""
    strategy: PsiStrategy!
    """ISO 8601 timestamp of when the audit was fetched."""
    fetchTime: String
    """Lighthouse version used for the audit."""
    lighthouseVersion: String
    """Scores for each requested Lighthouse category."""
    categoryScores: [PageSpeedCategoryScore!]!
    """Overall Lighthouse performance score (0-1)."""
    performanceScore: Float
    """Largest Contentful Paint in milliseconds."""
    lcpMs: Float
    """Interaction to Next Paint in milliseconds."""
    inpMs: Float
    """Cumulative Layout Shift score."""
    cls: Float
    """First Contentful Paint in milliseconds."""
    fcpMs: Float
    """Time to First Byte in milliseconds."""
    ttfbMs: Float
    """Raw JSON response from the PageSpeed Insights API."""
    rawJson: String!
  }

  """Combined PageSpeed and CrUX insights scoped to a single website."""
  type WebsiteInsights {
    """Original URL supplied by the caller."""
    inputUrl: String!
    """Normalized origin derived from the input URL."""
    origin: String!
    """PageSpeed Insights audit for this website."""
    pagespeed(
      """Audit strategy. Defaults to MOBILE."""
      strategy: PsiStrategy = MOBILE
      """Lighthouse categories to audit. Defaults to PERFORMANCE."""
      categories: [PsiCategory!]
    ): PageSpeedResult!
    """CrUX history for this website's origin."""
    crux(
      """Form factor to segment data by. Defaults to PHONE."""
      formFactor: FormFactor = PHONE
      """Metrics to return. Defaults to LCP, INP, CLS, FCP, and TTFB."""
      metrics: [String!]
    ): CruxHistoryResult!
  }

  type Query {
    """Fetch combined PageSpeed and CrUX insights for a URL."""
    website(
      """Full URL of the page to analyse."""
      url: String!
    ): WebsiteInsights!
    """Run a PageSpeed Insights audit directly for a URL."""
    pagespeed(
      """Full URL of the page to audit."""
      url: String!
      """Audit strategy. Defaults to MOBILE."""
      strategy: PsiStrategy = MOBILE
      """Lighthouse categories to audit. Defaults to PERFORMANCE."""
      categories: [PsiCategory!]
    ): PageSpeedResult!
    """Fetch CrUX history directly for an origin."""
    crux(
      """Origin or URL whose origin will be queried."""
      origin: String!
      """Form factor to segment data by. Defaults to PHONE."""
      formFactor: FormFactor = PHONE
      """Metrics to return. Defaults to LCP, INP, CLS, FCP, and TTFB."""
      metrics: [String!]
    ): CruxHistoryResult!
  }
`;

type PsiCategory =
  | "PERFORMANCE"
  | "ACCESSIBILITY"
  | "BEST_PRACTICES"
  | "SEO"
  | "PWA";

type PsiStrategy = "MOBILE" | "DESKTOP";
type FormFactor = "PHONE" | "DESKTOP" | "TABLET" | "ALL";

/**
 * Reads and validates the Google API key from environment variables.
 *
 * @returns The configured Google API key.
 * @throws Error When GOOGLE_API_KEY is not configured.
 */
function requireApiKey(): string {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY environment variable.");
  }

  return apiKey;
}

/**
 * Normalizes an input URL or host into an origin string.
 *
 * @param value Raw URL or hostname.
 * @returns Normalized origin including protocol.
 */
function parseOrigin(value: string): string {
  const normalized = value.startsWith("http") ? value : `https://${value}`;
  return new URL(normalized).origin;
}

/**
 * Maps GraphQL PSI category values to PageSpeed API category parameters.
 *
 * @param category PSI category enum value.
 * @returns PageSpeed API category parameter.
 */
function psiCategoryToParam(category: PsiCategory): string {
  return category.toLowerCase().replaceAll("_", "-");
}

/**
 * Converts GraphQL PSI strategy enum to the PageSpeed API strategy format.
 *
 * @param strategy Strategy enum value.
 * @returns Lowercase strategy string.
 */
function strategyToParam(strategy: PsiStrategy): string {
  return strategy.toLowerCase();
}

/**
 * Returns numeric values and normalizes non-numeric values to null.
 *
 * @param value Unknown input value.
 * @returns Number when the value is numeric, otherwise null.
 */
function safeNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

/**
 * Fetches JSON and throws a detailed error for non-success responses.
 *
 * @param url Request URL.
 * @param init Optional fetch options.
 * @returns Parsed JSON payload.
 * @throws Error When the response status is not OK.
 */
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`External API error (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

/**
 * Queries PageSpeed Insights and maps relevant fields into API output.
 *
 * @param args PageSpeed query options.
 * @returns Normalized PageSpeed result object.
 */
async function getPageSpeed(args: {
  url: string;
  strategy?: PsiStrategy;
  categories?: PsiCategory[];
}) {
  const apiKey = requireApiKey();
  const strategy = args.strategy ?? "MOBILE";
  const url = args.url;

  const params = new URLSearchParams({
    url,
    key: apiKey,
    strategy: strategyToParam(strategy),
  });

  for (const category of args.categories ?? ["PERFORMANCE"]) {
    params.append("category", psiCategoryToParam(category));
  }

  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;

  const raw = await fetchJson<Record<string, unknown>>(endpoint);
  const lighthouse = (raw.lighthouseResult ?? {}) as Record<string, unknown>;
  const audits = (lighthouse.audits ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const categories = (lighthouse.categories ?? {}) as Record<
    string,
    Record<string, unknown>
  >;

  const categoryScores = Object.entries(categories).map(([id, details]) => ({
    id,
    score: safeNumber(details.score),
    title: (details.title as string) ?? null,
  }));

  return {
    requestedUrl: url,
    finalUrl:
      (lighthouse.finalDisplayedUrl as string) ?? (raw.id as string) ?? null,
    strategy,
    fetchTime: (lighthouse.fetchTime as string) ?? null,
    lighthouseVersion: (lighthouse.lighthouseVersion as string) ?? null,
    categoryScores,
    performanceScore: safeNumber(categories.performance?.score),
    lcpMs: safeNumber(audits["largest-contentful-paint"]?.numericValue),
    inpMs: safeNumber(audits["interaction-to-next-paint"]?.numericValue),
    cls: safeNumber(audits["cumulative-layout-shift"]?.numericValue),
    fcpMs: safeNumber(audits["first-contentful-paint"]?.numericValue),
    ttfbMs: safeNumber(audits["server-response-time"]?.numericValue),
    rawJson: JSON.stringify(raw),
  };
}

/**
 * Queries CrUX history for an origin and maps metric series data.
 *
 * @param args CrUX history query options.
 * @returns Normalized CrUX history result object.
 */
async function getCruxHistory(args: {
  origin: string;
  formFactor?: FormFactor;
  metrics?: string[];
}) {
  const apiKey = requireApiKey();
  const formFactor = args.formFactor ?? "PHONE";

  const payload: Record<string, unknown> = {
    origin: args.origin,
    metrics: args.metrics?.length ? args.metrics : DEFAULT_CRUX_METRICS,
  };

  if (formFactor !== "ALL") {
    payload.formFactor = formFactor;
  }

  const endpoint = `https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=${encodeURIComponent(apiKey)}`;
  const raw = await fetchJson<Record<string, unknown>>(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const record = (raw.record ?? {}) as Record<string, unknown>;
  const metrics = (record.metrics ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const periods = (
    (record.collectionPeriods ?? []) as Array<Record<string, unknown>>
  ).map((period) => ({
    firstDate: period.firstDate ? JSON.stringify(period.firstDate) : null,
    lastDate: period.lastDate ? JSON.stringify(period.lastDate) : null,
  }));

  const metricSeries = Object.entries(metrics).map(([metric, details]) => {
    const p75s = Array.isArray(details.percentilesTimeseries)
      ? []
      : (((details.percentilesTimeseries as Record<string, unknown>)
          ?.p75s as unknown[]) ?? []);

    const binsRaw =
      (details.histogramTimeseries as Array<Record<string, unknown>>) ?? [];
    const histogram = binsRaw.map((bin) => ({
      start: safeNumber(bin.start),
      end: safeNumber(bin.end),
      densities: Array.isArray(bin.densities)
        ? bin.densities.filter(
            (value): value is number => typeof value === "number",
          )
        : [],
    }));

    return {
      metric,
      p75s: Array.isArray(p75s) ? p75s.map((value) => safeNumber(value)) : [],
      histogram,
    };
  });

  return {
    queriedOrigin: args.origin,
    formFactor,
    collectionPeriods: periods,
    metrics: metricSeries,
    rawJson: JSON.stringify(raw),
  };
}

export const schema = buildSchema(schemaSource);

export const rootValue = {
  /**
   * Root resolver for website-scoped insights.
   *
   * @param params Website resolver input.
   * @returns Website context object with nested resolvers.
   */
  website: ({ url }: { url: string }) => {
    const origin = parseOrigin(url);

    return {
      inputUrl: url,
      origin,
      /**
       * Resolves PageSpeed data for the current website context.
       *
       * @param args PageSpeed options.
       * @returns PageSpeed insights for the website URL.
       */
      pagespeed: (args: {
        strategy?: PsiStrategy;
        categories?: PsiCategory[];
      }) =>
        getPageSpeed({
          url,
          strategy: args.strategy,
          categories: args.categories,
        }),
      /**
       * Resolves CrUX history for the current website context.
       *
       * @param args CrUX options.
       * @returns CrUX history for the website origin.
       */
      crux: (args: { formFactor?: FormFactor; metrics?: string[] }) =>
        getCruxHistory({
          origin,
          formFactor: args.formFactor,
          metrics: args.metrics,
        }),
    };
  },

  /**
   * Root resolver for direct PageSpeed lookups.
   *
   * @param params PageSpeed resolver input.
   * @returns PageSpeed insights for the requested URL.
   */
  pagespeed: ({
    url,
    strategy,
    categories,
  }: {
    url: string;
    strategy?: PsiStrategy;
    categories?: PsiCategory[];
  }) => getPageSpeed({ url, strategy, categories }),

  /**
   * Root resolver for direct CrUX lookups.
   *
   * @param params CrUX resolver input.
   * @returns CrUX history for the requested origin.
   */
  crux: ({
    origin,
    formFactor,
    metrics,
  }: {
    origin: string;
    formFactor?: FormFactor;
    metrics?: string[];
  }) =>
    getCruxHistory({
      origin: parseOrigin(origin),
      formFactor,
      metrics,
    }),
};
