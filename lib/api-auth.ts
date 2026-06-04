import crypto from "node:crypto";
import { config } from "./config";

function unauthorizedResponse() {
  return new Response("Unauthorized.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Bearer realm="ProofSpend"',
    },
  });
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBytes, rightBytes);
}

export function assertRunApiAuthorized(request: Request) {
  if (!config.apiAuthKey) {
    return null;
  }

  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  const [scheme, token] = authHeader.split(/\s+/, 2);

  if (scheme !== "Bearer" || !token) {
    return unauthorizedResponse();
  }

  if (!constantTimeEqual(token, config.apiAuthKey)) {
    return unauthorizedResponse();
  }

  return null;
}
