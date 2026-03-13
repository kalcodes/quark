// Quark - tiny API wrapper for cloudflare workers
// Authored by: kalcodes
// ----------------------------------------------------------

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Handler = (request: Request) => Promise<HandlerResult> | HandlerResult;
type HandlerResult = Response | Object | string | number | void;
type RouteHandlerMap = Map<string, { [M in Method]?: Handler }>;
type QuarkOptions = {
  notFoundHandler?: Handler;
};

class Quark {
  baseUrl?: string | null;
  handlers: RouteHandlerMap;
  notFoundHandler?: Handler;

  constructor(baseUrl?: string | null, options?: QuarkOptions) {
    this.handlers = new Map();
    this.baseUrl = baseUrl;
    this.notFoundHandler = options?.notFoundHandler;
  }

  _normalize(path: string, base?: boolean) {
    const normPath =
      this.baseUrl && base ? `/${this.baseUrl}/${path}/` : `/${path}/`;

    return normPath.replace(/\/{2,}/g, "/");
  }

  _registerRoute(path: string, method: Method, callback: Handler) {
    const normPath = this._normalize(path, true);
    const handlers = this.handlers.get(normPath);

    if (handlers && method in handlers)
      throw new Error(`Handler for "${method} - ${path}" already registered!`);

    this.handlers.set(normPath, {
      ...handlers,
      [method]: callback,
    });
  }

  _resolver = async (
    result: Promise<HandlerResult> | HandlerResult,
  ): Promise<Response> => {
    if (result instanceof Promise) {
      result = (await result) as HandlerResult;
    }

    // Return result as response
    if (result instanceof Response) return result;

    const resultType = typeof result;
    // Return HTTP status code
    if (resultType === "number") {
      return new Response(null, { status: result as number });
    }

    // Return content-type: application/json
    if (resultType === "object")
      return new Response(JSON.stringify(result) as string, {
        headers: { "content-type": "application/json" },
      });

    // Return content-type: text/plain
    if (["string", "bigint", "boolean"].includes(resultType))
      return new Response(String(result), {
        headers: { "content-type": "text/plain" },
      });

    // Return HTTP 200
    return new Response();
  };

  fetch = async (request: Request) => {
    const { url, method } = request;
    let { pathname } = new URL(url);

    const route = this.handlers.get(this._normalize(pathname)) || {};
    const handler = route[method as Method];

    if (handler) {
      let result = handler(request);
      return await this._resolver(result);
    }

    // Handle Unknown Routes
    if (this.notFoundHandler)
      return await this._resolver(this.notFoundHandler(request));
    else return new Response(null, { status: 404 });
  };

  get(path: string, handler: Handler) {
    this._registerRoute(path, "GET", handler);
  }
  post(path: string, handler: Handler) {
    this._registerRoute(path, "POST", handler);
  }
  put(path: string, handler: Handler) {
    this._registerRoute(path, "PUT", handler);
  }
  patch(path: string, handler: Handler) {
    this._registerRoute(path, "PATCH", handler);
  }
  delete(path: string, handler: Handler) {
    this._registerRoute(path, "DELETE", handler);
  }
}

export default Quark;
