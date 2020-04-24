import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { customAlphabet } from "nanoid/async";
import * as azure from "azure-storage";

// specify a custom alphabet for the nanoid generator
const alphabet =
  process.env["NANOID_ALPHABET"] ||
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// create the nanoid generator
const nanoid = customAlphabet(
  alphabet,
  // set the length of the generated ids
  Number.parseInt(process.env["NANOID_SIZE"]) || 6
);

// create the azure table service
const tableService = azure.createTableService(
  process.env["AZURE_TABLE_CONNECTION_STRING"] || "UseDevelopmentStorage=true"
);

const tableName = process.env["AZURE_TABLE_NAME"] || "minimelons";

// ability to specify a custom root url (i.e. https://some-custom-url.com)
// otherwise will use the base url for the create method.
const customDomain = process.env["CUSTOM_DOMAIN"];

const maxSlugLength = process.env["MAX_SLUG_LENGTH"] || 250;

const slugValidationRegex = new RegExp(
  process.env["SLUG_VALIDATION_REGEX"] || "^[\\d\\w-]+$"
);

interface MiniMelonUrl {
  // index on the first character of the short url
  // no reason other than slightly faster retrieval so you don't have
  // unique partitions for every shortened url
  PartitionKey: string;
  // set the key to the whole shotened url (including the first charater)
  RowKey: string;
  // the full url that was shortened
  url: string;
}

// wrap the callback system into a promise
// so we can use await in the main function
function insertEntity(slug: string, url: string): Promise<unknown> {
  return new Promise((res, rej) => {
    tableService.insertEntity<MiniMelonUrl>(
      tableName,
      {
        PartitionKey: slug[0],
        RowKey: slug,
        url,
      },
      (error, result) => {
        // reject the promise if there is an error
        if (error) {
          rej(error);
          return;
        }

        // otherwise just return the result.
        // not that we need it in this application.
        res(result);
      }
    );
  });
}

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log("HTTP trigger function processed a request.");

  // try to grab the url from either
  // the query `?url=...` or the body `{url:...}` or a header `x-url: ...`
  const url = req.query.url || req.body?.url || req.headers["x-url"];

  // only continue if we have the url
  if (url) {
    // grab the slug from either the
    // query `?slug=...` or the body `{slug:...}` or a header `x-slug`
    // or generate if none of the above is specified
    const slug =
      req.query.slug ||
      req.body?.slug ||
      req.headers["x-slug"] ||
      (await nanoid());

    // ensure the slug doesn't go over the set length
    if (slug.length > maxSlugLength) {
      context.res = {
        status: 400,
        body: `400: The slug '${
          // just grab the first 25 characters of the slug
          // so the response isn't blasted out back to the user
          (slug as string).substr(0, 25) + (slug.length > 25 ? "..." : "")
        }' is too large, max length is ${maxSlugLength} characters`,
      };

      return;
      // ensure the slug passes the regex validation
    } else if (!slugValidationRegex.test(slug)) {
      context.res = {
        status: 400,
        body: `400: The slug '${
          // just grab the first 25 characters of the slug
          // so the response isn't blasted out back to the user
          (slug as string).substr(0, 25) + (slug.length > 25 ? "..." : "")
        }' may contain only letters, numbers or dashes (${
          slugValidationRegex.source
        })`,
      };

      return;
    }

    context.log(`saving new shortened id ${slug} for url ${url}`);

    try {
      await insertEntity(slug, url);
      const domain = customDomain || new URL(req.url).origin;

      context.res = {
        status: 200,
        body: domain + (domain.endsWith("/") ? "" : "/") + slug,
      };

      return;
    } catch (error) {
      context.log(
        context.invocationId,
        `Error saving new shortened id ${slug} for url ${url}`,
        error
      );

      // resource already exists, let the user know
      if (error.statusCode === 409) {
        context.res = {
          status: 400,
          body: `400: The slug '${slug}' already exists`,
        };

        return;
      } else {
        context.res = {
          status: 500,
          body: `500: OOPSIE WOOPSIE!! Uwu We make a fucky wucky!! A wittle fucko boingo! The code monkeys at our headquarters are working VEWY HAWD to fix this! _trace ${context.invocationId}`,
        };

        return;
      }
    }
  } else {
    // otherwise just return an error on how to use it
    context.res = {
      status: 400,
      body:
        "400: You must specify a url in the query '?url=...' or the body '{url:...}' or a header 'x-url:...'",
    };

    return;
  }
};

export default httpTrigger;
