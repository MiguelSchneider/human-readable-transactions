import type { ChainDef } from "./chains";
import type { DataSource } from "./types";
import { BlockscoutSource } from "./blockscout";
import { RoutescanSource } from "./routescan";

export function makeDataSource(chain: ChainDef): DataSource {
  switch (chain.backend) {
    case "blockscout":
      return new BlockscoutSource(chain);
    case "routescan":
      return new RoutescanSource(chain);
    default:
      throw new Error(`Backend no soportado para ${chain.name}.`);
  }
}
