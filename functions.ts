export function result(res: { [key: string]: any }): { [key: string]: any } {
  return Object.assign({}, res);
}

export function notFound(notFoundUrl: string): { [key: string]: any } {
  // if not found page specified redirect (temporarily!) to that page
  if (notFoundUrl) {
    return result({
      status: 302,
      headers: {
        Location: notFoundUrl,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  // otherwise just return a basic 404
  return result({
    status: 404,
    body: `404: I don't know that one ¯\\_(ツ)_/¯`,
  });
}
