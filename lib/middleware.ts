import { raw } from "body-parser";
import * as http from "http";
import { JSONParseError, SignatureValidationFailed } from "./exceptions";
import validateSignature from "./validate-signature";

export type Request = http.IncomingMessage & { body: any };
export type Response = http.ServerResponse;
export type NextCallback = (err?: Error) => void;

export type Middleware = (req: Request, res: Response, next: NextCallback) => void;

export default function middleware(config: Line.Config & Line.MiddlewareConfig): Middleware {
  if (!config.channelSecret) {
    throw new Error("no channel secret");
  }

  const secret = config.channelSecret;

  return (req, res, next) => {
    // header names are lower-cased
    // https://nodejs.org/api/http.html#http_message_headers
    const signature = req.headers["x-line-signature"] as string;

    if (!signature) {
      next();
      return;
    }

    const validate = (body: string | Buffer) => {
      if (!validateSignature(body, secret, signature)) {
        next(new SignatureValidationFailed("signature validation failed", signature));
        return;
      }

      const strBody = Buffer.isBuffer(body) ? body.toString() : body;

      try {
        req.body = JSON.parse(strBody);
        next();
      } catch (err) {
        next(new JSONParseError(err.message, strBody));
      }
    };

    if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
      return validate(req.body);
    }

    // if body is not parsed yet, parse it to a buffer
    raw({ type: "*/*" })(req as any, res as any, () => validate(req.body));
  };
}
