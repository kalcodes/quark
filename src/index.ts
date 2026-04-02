// Quark - tiny API wrapper for cloudflare workers
// Authored by: kalcodes
// ----------------------------------------------------------

type Method = "GET" | "POST" | "PUT" | "UPDATE" | "DELETE";
type Handler = (request: Request) => Promise<HandlerResult> | HandlerResult;
type HandlerResult = Response | Object | string | void;
type RouteHandlerMap = Map<string, { [M in Method]?: Handler }>;

class Quark {
  baseUrl?: string;
  handlers: RouteHandlerMap;

  constructor(baseUrl?: string) {
    this.handlers = new Map();
    this.baseUrl = baseUrl;
  }

  _normalize(path: string, base?: boolean) {
    let fullPath = path;

    if (this.baseUrl && base) {
      fullPath = `/${this.baseUrl}/${path}/`;
    } else {
      fullPath = `/${path}/`;
    }
    return fullPath.replace(/\/{2,}/g, "/");
  }

  _fetch = async (request: Request) => {
    const { url, method } = request;
    let { pathname } = new URL(url);

    const route = this.handlers.get(this._normalize(pathname)) || {};
    const handler = route[method as Method];
    if (!handler) return new Response("Not Found", { status: 404 });

    let result = handler(request);
    if (result instanceof Promise) {
      result = (await result) as HandlerResult;
    }

    if (result instanceof Response) {
      return result;
    }

    const resultType = typeof result;
    switch (resultType) {
      case "undefined":
        return new Response();

      case "string":
        return new Response(result as string, {
          headers: { "Content-Type": "text/plain" },
        });

      case "object":
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
    }
  };

  _registerRoute(path: string, method: Method, callback: Handler) {
    const handlers = this.handlers.get(path);

    if (handlers && method in handlers)
      throw new Error(`Handler for "${method} - ${path}" already registered!`);

    this.handlers.set(this._normalize(path, true), {
      ...handlers,
      [method]: callback,
    });
  }

  get(path: string, handler: Handler) {
    this._registerRoute(path, "GET", handler);
  }
  post(path: string, handler: Handler) {
    this._registerRoute(path, "POST", handler);
  }
  put(path: string, handler: Handler) {
    this._registerRoute(path, "PUT", handler);
  }
  update(path: string, handler: Handler) {
    this._registerRoute(path, "UPDATE", handler);
  }
  delete(path: string, handler: Handler) {
    this._registerRoute(path, "DELETE", handler);
  }
}

export default Quark;
