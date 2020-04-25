import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import * as azure from "azure-storage";
import { result, notFound } from "../functions";

// optional not found url to redirect to
const notFoundPageUrl = process.env["NOT_FOUND_URL"];

// create the azure table service
const tableService = azure.createTableService(
  process.env["AzureWebJobsStorage"]
);

const tableName = process.env["AZURE_TABLE_NAME"] || "minimelons";

interface MiniMelonUrlRetrieval {
  // index on the first character of the short url
  // no reason other than slightly faster retrieval so you don't have
  // unique partitions for every shortened url
  PartitionKey: string;
  // set the key to the whole shotened url (including the first charater)
  RowKey: string;
  // the full url that was shortened,
  // azure table storage returns the url wrapped in a blank object
  // (probably due to how they store it)
  url: { _: string };
}

// wrap the callback system into a promise
// so we can use await in the main function
function getUrl(slug: string): Promise<string> {
  return new Promise((res, rej) => {
    tableService.retrieveEntity<MiniMelonUrlRetrieval>(
      tableName,
      slug[0],
      slug,
      (error, result) => {
        if (error) {
          rej(error);
          return;
        }

        res(result.url._);
      }
    );
  });
}

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log(
    context.invocationId,
    "HTTP trigger function processed a lookup request.",
    req.query,
    req.headers
  );

  // grab the slug from either the
  // query `?slug=...` or a header `x-slug`
  const slug = req.query.slug || req.headers["x-slug"];

  // if the slug isn't provided, return with 400 error
  if (!slug) {
    context.res = notFound(notFoundPageUrl);
    return;
  }

  try {
    const url = await getUrl(slug);

    // Ensure the shortened url is an actual url
    // if it isn't just serve up the url as text
    try {
      new URL(url);

      // if the query has no_redir as a parameter
      // then just return the url it will redirect to
      if (req.query.no_redir) {
        context.res = result({
          status: 200,
          headers: { "Content-Type": "text/plain" },
          body: url,
        });

        return;
      }

      context.res = result({
        status: 302,
        headers: { Location: url, "Content-Type": "text/html; charset=utf-8" },
      });

      return;
    } catch (error) {
      context.res = result({
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: url,
      });

      return;
    }
  } catch (error) {
    // if the azure table storage doesn't see it
    // just return a 404 page
    if (error.statusCode === 404) {
      context.res = notFound(notFoundPageUrl);
      return;
    } else {
      // something bad happened here. log it.
      context.log(
        context.invocationId,
        `Error retreiving the url from the slug ${slug}`,
        error
      );

      context.res = result({
        status: 500,
        body: `500: OOPSIE WOOPSIE!! Uwu We make a fucky wucky!! A wittle fucko boingo! The code monkeys at our headquarters are working VEWY HAWD to fix this! [_trace:${context.invocationId}]`,
      });

      return;
    }
  }
};

export default httpTrigger;
