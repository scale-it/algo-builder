import path from "path";

import { loadKMDAccounts } from "../../../lib/account";
import type { NetworkConfig, ResolvedAlgobConfig, RuntimeArgs, StrMap } from "../../../types";
import { BuilderContext } from "../../context";
import { loadPluginFile } from "../plugins";
import { getUserConfigPath } from "../project-structure";
import { resolveConfig } from "./config-resolution";
import { validateConfig } from "./config-validation";

async function importCsjOrEsModule (filePath: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const imported = await require(filePath); // eslint-disable-line @typescript-eslint/no-var-requires
  return imported.default !== undefined ? imported.default : imported;
}

export async function loadConfigAndTasks (
  runtimeArgs?: Partial<RuntimeArgs>
): Promise<ResolvedAlgobConfig> {
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
  const defaultConfig = await importCsjOrEsModule("./default-config");
  const userConfig = configPath !== undefined ? await importCsjOrEsModule(configPath) : defaultConfig;
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
    if (net !== undefined) { await _loadKMDAccounts(net); }
  }

  return cfg;
}

// loads KMD accoutns if the net.kmdCfg is specified and merges them into net.accounts
async function _loadKMDAccounts (net: NetworkConfig): Promise<void> {
  if (net.kmdCfg === undefined) { return; }
  const kmdAccounts = await loadKMDAccounts(net.kmdCfg);
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
