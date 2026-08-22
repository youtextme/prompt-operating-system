/**
 * Hub entry — delegates to POS enforce gateway.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const gatewayRel = existsSync(join(__dir, "..", "enforce", "gateway.mjs"))
  ? "../enforce/gateway.mjs"
  : "../kernel/enforce/gateway.mjs";

const gateway = await import(new URL(gatewayRel, import.meta.url).href);

export const startServer = gateway.startGateway;
export const loadConfig = gateway.loadEnforceConfig;
export const createGatewayServer = gateway.createGatewayServer;

if (process.argv[1]?.endsWith("server.mjs")) {
  gateway.startGateway();
}
