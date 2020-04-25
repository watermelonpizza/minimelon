# minimelon
A url shortener using azure functions and azure table storage

## functions 
### lookup
`/lookup?slug={slug}&no_redir=true`

**slug** (required)

The shortened url part

**no_redir** (optional)

Don't redirect, just return the full url in the body.

#### Returns 302/200
`Location` header to the url or `{url}` as plain/text in the body if not a url.

### shorten
`/shorten?code={azure function code}&url={url}&slug={slug}`

**code** (required, depending on config)

The azure function code to access the function (if you set the azure function permissions not to be anonymous)

**url** (required)

The url to shorten (or plain text if it isn't a url)

**slug** (optional)

A custom slug to use instead of the auto-generated one.

#### Returns 200
`<functions domain or CUSTOM_DOMAIN>/{slug}` in the body as plain/text.

## proxies.json
This redirects your custom domain to the `lookup` function passing through the slug and other query parameters. e.g. `https://example.com/d2t44Z` proxies to `https://myazurefunction.azurewebsites.net/api/lookup?slug=d2t44Z` or `https://example.com/d2t44Z?no_redir=true` proxies to `https://myazurefunction.azurewebsites.net/api/lookup?slug=d2t44Z&no_redir=true` 

## environment variables
#### `CUSTOM_DOMAIN` (required, depending on your setup)
Default url of azure function. This will not usually be what you want.

You should set the custom domain to where the proxy directing away from.

Current I cannot get the proxy for the shorten url working so this is required otherwise the returned shotened url will be azure functions url.

#### `SLUG_ALPHABET`
Default `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`

Custom alphabet to generate for the slugs (note that you shouldn't use anythihng that will cause issues in urls!)

#### `SLUG_SIZE`
Default `6`

The size of the generated slugs

#### `SLUG_MAX_LENGTH`
Default `250`

The maximum allowed length for user custom slugs

#### `SLUG_VALIDATION_REGEX`
Default `^[\\d\\w-]+$`

Regex for matching slugs to ensure users don't use unwanted characters

#### `AzureWebJobsStorage`
Default azure should set this to the storage the functions are hosted on

Connection string to the azure table storage

#### `AZURE_TABLE_NAME`
Default `minimelons`

The table of the azure table storage table to store the shortened urls in
