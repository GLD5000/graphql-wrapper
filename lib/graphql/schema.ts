import { buildSchema } from "graphql";

const DEFAULT_CRUX_METRICS = [
  "largest_contentful_paint",
  "interaction_to_next_paint",
  "cumulative_layout_shift",
  "first_contentful_paint",
  "experimental_time_to_first_byte",
];

const schemaSource = `
  enum FormFactor {
    PHONE
    DESKTOP
    TABLET
    ALL
  }

  enum PsiStrategy {
    MOBILE
    DESKTOP
  }

  enum PsiCategory {
    PERFORMANCE
    ACCESSIBILITY
    BEST_PRACTICES
    SEO
    PWA
  }

  type CollectionPeriod {
    firstDate: String
    lastDate: String
  }

  type HistogramBin {
    start: Float
    end: Float
    densities: [Float!]!
  }

  type CruxMetricSeries {
    metric: String!
    p75s: [Float]
    histogram: [HistogramBin!]!
  }

  type CruxHistoryResult {
    queriedOrigin: String!
    formFactor: FormFactor!
    collectionPeriods: [CollectionPeriod!]!
    metrics: [CruxMetricSeries!]!
    rawJson: String!
  }

  type PageSpeedCategoryScore {
    id: String!
    score: Float
    title: String
  }

  type PageSpeedResult {
    requestedUrl: String!
    finalUrl: String
    strategy: PsiStrategy!
    fetchTime: String
    lighthouseVersion: String
    categoryScores: [PageSpeedCategoryScore!]!
    performanceScore: Float
    lcpMs: Float
    inpMs: Float
    cls: Float
    fcpMs: Float
    ttfbMs: Float
    rawJson: String!
  }

  type CombinedSummary {
    origin: String!
    strategy: PsiStrategy!
    formFactor: FormFactor!
    performanceScore: Float
    lcpDeltaMs: Float
    inpDeltaMs: Float
    clsDelta: Float
  }

  type CombinedInsights {
    pagespeed: PageSpeedResult!
    crux: CruxHistoryResult!
    summary: CombinedSummary!
  }

  type WebsiteInsights {
    inputUrl: String!
    origin: String!
    pagespeed(strategy: PsiStrategy = MOBILE, categories: [PsiCategory!]): PageSpeedResult!
    crux(formFactor: FormFactor = PHONE, metrics: [String!]): CruxHistoryResult!
    combined(
      strategy: PsiStrategy = MOBILE,
      categories: [PsiCategory!],
      formFactor: FormFactor = PHONE,
      metrics: [String!]
    ): CombinedInsights!
  }

  type Query {
    website(url: String!): WebsiteInsights!
    pagespeed(url: String!, strategy: PsiStrategy = MOBILE, categories: [PsiCategory!]): PageSpeedResult!
    crux(origin: String!, formFactor: FormFactor = PHONE, metrics: [String!]): CruxHistoryResult!
    combined(
      url: String!,
      strategy: PsiStrategy = MOBILE,
      categories: [PsiCategory!],
      formFactor: FormFactor = PHONE,
      metrics: [String!]
    ): CombinedInsights!
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
  switch (category) {
    case "PERFORMANCE":
      return "performance";
    case "ACCESSIBILITY":
      return "accessibility";
    case "BEST_PRACTICES":
      return "best-practices";
    case "SEO":
      return "seo";
    case "PWA":
      return "pwa";
  }
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
 * Finds the last numeric entry in an array.
 *
 * @param values Values to scan.
 * @returns Last numeric value, or null when none exist.
 */
function lastNumber(values: unknown[]): number | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (typeof values[i] === "number") {
      return values[i] as number;
    }
  }

  return null;
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

/**
 * Runs combined PageSpeed and CrUX queries and derives summary deltas.
 *
 * @param args Combined query options.
 * @returns Combined insights with a computed summary.
 */
async function getCombined(args: {
  url: string;
  strategy?: PsiStrategy;
  categories?: PsiCategory[];
  formFactor?: FormFactor;
  metrics?: string[];
}) {
  const origin = parseOrigin(args.url);

  const [pagespeed, crux] = await Promise.all([
    getPageSpeed({
      url: args.url,
      strategy: args.strategy,
      categories: args.categories,
    }),
    getCruxHistory({
      origin,
      formFactor: args.formFactor,
      metrics: args.metrics,
    }),
  ]);

  const lcpSeries =
    crux.metrics.find((item) => item.metric === "largest_contentful_paint")
      ?.p75s ?? [];
  const inpSeries =
    crux.metrics.find((item) => item.metric === "interaction_to_next_paint")
      ?.p75s ?? [];
  const clsSeries =
    crux.metrics.find((item) => item.metric === "cumulative_layout_shift")
      ?.p75s ?? [];

  const cruxLcp = lastNumber(lcpSeries);
  const cruxInp = lastNumber(inpSeries);
  const cruxCls = lastNumber(clsSeries);

  return {
    pagespeed,
    crux,
    summary: {
      origin,
      strategy: args.strategy ?? "MOBILE",
      formFactor: args.formFactor ?? "PHONE",
      performanceScore: pagespeed.performanceScore,
      lcpDeltaMs:
        cruxLcp !== null && pagespeed.lcpMs !== null
          ? pagespeed.lcpMs - cruxLcp
          : null,
      inpDeltaMs:
        cruxInp !== null && pagespeed.inpMs !== null
          ? pagespeed.inpMs - cruxInp
          : null,
      clsDelta:
        cruxCls !== null && pagespeed.cls !== null
          ? pagespeed.cls - cruxCls
          : null,
    },
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
      /**
       * Resolves combined PageSpeed and CrUX insights for the website.
       *
       * @param args Combined query options.
       * @returns Combined insights and computed summary.
       */
      combined: (args: {
        strategy?: PsiStrategy;
        categories?: PsiCategory[];
        formFactor?: FormFactor;
        metrics?: string[];
      }) =>
        getCombined({
          url,
          strategy: args.strategy,
          categories: args.categories,
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

  /**
   * Root resolver for direct combined lookups.
   *
   * @param params Combined resolver input.
   * @returns Combined insights for the requested URL.
   */
  combined: ({
    url,
    strategy,
    categories,
    formFactor,
    metrics,
  }: {
    url: string;
    strategy?: PsiStrategy;
    categories?: PsiCategory[];
    formFactor?: FormFactor;
    metrics?: string[];
  }) =>
    getCombined({
      url,
      strategy,
      categories,
      formFactor,
      metrics,
    }),
};
