# graphql-wrapper

A Graph QL API wrapper for the CRUX History and PageSpeed Insights API

## Get an API Key

Visit https://developers.google.com/speed/docs/insights/v5/get-started#APIKey or https://developer.chrome.com/docs/crux/history-api#crux_api_key and follow the instructions to get your own (free) API key.

- **N.B. You will need to enable [`Chrome UX Report API`](https://console.cloud.google.com/apis/api/chromeuxreport.googleapis.com/metrics?project=psi-crux-gld&supportedpurview=project) and [`PageSpeed Insights API`](https://console.cloud.google.com/apis/api/pagespeedonline.googleapis.com/metrics?project=psi-crux-gld&supportedpurview=project) in your GCC project**

## Test your API Key

1. Add your API key to `.env.local` with key `GOOGLE_API_KEY`
2. In terminal export environmental variables: `$ export $(grep -v '^#' .env.local | xargs)`
3. Run curl command:

```
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://web.dev/&key=$GOOGLE_API_KEY"
```

```
curl -s --request POST "https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=$GOOGLE_API_KEY" \
    --header 'Accept: application/json' \
    --header 'Content-Type: application/json' \
    --data '{"formFactor":"PHONE","origin":"https://www.example.com","metrics":["largest_contentful_paint", "experimental_time_to_first_byte"]}'
```

## Run a GraphQL query
