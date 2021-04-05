import path from "path";

import { KMDOperator } from "../../../lib/account";
import { createKmdClient } from "../../../lib/driver";
import type { NetworkConfig, ResolvedConfig, RuntimeArgs } from "../../../types";
import { BuilderContext } from "../../context";
import { loadPluginFile } from "../plugins";
import { getUserConfigPath } from "../project-structure";
import { resolveConfig } from "./config-resolution";
import { validateConfig } from "./config-validation";

function importCsjOrEsModule (filePath: string): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  const imported = require(filePath); // eslint-disable-line @typescript-eslint/no-var-requires
  return imported.default !== undefined ? imported.default : imported;
}

export async function loadConfigAndTasks (
  runtimeArgs?: Partial<RuntimeArgs>
): Promise<ResolvedConfig> {
  let configPath =
    runtimeArgs !== undefined ? runtimeArgs.config : undefined;

  if (configPath === undefined) {
    configPath = getUserConfigPath();
  } else {
    if (!path.isAbsolute(configPath)) {
      configPath = path.join(process.cwd(), configPath);
      configPath = path.normalize(configPath);
    }
  }

  // Before loading the builtin tasks, the default and user's config we expose
  // the config env in the global object.
  const configEnv = require("./config-env"); // eslint-disable-line @typescript-eslint/no-var-requires

  const globalAsAny = global as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  Object.entries(configEnv).forEach(
    ([key, value]) => (globalAsAny[key] = value)
  );

  loadPluginFile(path.join(__dirname, "..", "tasks", "builtin-tasks"));
  const defaultConfig = importCsjOrEsModule("./default-config");
  const userConfig = configPath !== undefined ? importCsjOrEsModule(configPath) : defaultConfig;
  validateConfig(userConfig);

  // To avoid bad practices we remove the previously exported stuff
  Object.keys(configEnv).forEach((key) => (globalAsAny[key] = undefined));

  const cfg = resolveConfig(
    configPath,
    defaultConfig,
    userConfig,
    BuilderContext.getBuilderContext().configExtenders
  );

  const netname = runtimeArgs?.network;
  if (netname !== undefined) {
    const net = cfg.networks[netname];
    if (net?.kmdCfg !== undefined) {
      const kmdOp = new KMDOperator(createKmdClient(net.kmdCfg));
      await loadKMDAccounts(net, kmdOp);
    }
  }

  return cfg;
}

// loads KMD accounts if the net.kmdCfg is specified and merges them into net.accounts
export async function loadKMDAccounts (net: NetworkConfig, kmdOp: KMDOperator): Promise<void> {
  if (net.kmdCfg === undefined) { return; }
  const kmdAccounts = await kmdOp.loadKMDAccounts(net.kmdCfg);
  const accounts = new Set();
  for (const a of net.accounts) { accounts.add(a.name); }
  for (const a of kmdAccounts) {
    if (accounts.has(a.name)) {
      console.warn("KMD account name conflict: KmdConfig and network.accounts both define an account with same name: ", a.name);
    } else {
      net.accounts.push(a);
    }
  }
}
