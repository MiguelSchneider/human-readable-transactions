import type { ChainDef } from "@/explorer/chains";
import { makeDataSource } from "@/explorer/datasource";
import { buildReportModel } from "@/model/build";
import type { ReportModel } from "@/model/types";
import { renderTypeA } from "@/report/typeA";
import { renderTypeB } from "@/report/typeB";
import type { ProgressFn } from "@/explorer/types";

export interface GeneratedReport {
  model: ReportModel;
  typeAHtml: string;
  typeBHtml: string;
}

export async function generateReport(
  chain: ChainDef,
  tokenAddress: string,
  onProgress: ProgressFn,
  signal?: AbortSignal,
): Promise<GeneratedReport> {
  const source = makeDataSource(chain);
  onProgress({ phase: `Connecting · ${source.label}` });
  const data = await source.extract(tokenAddress, onProgress, signal);
  onProgress({ phase: "Building the report model" });
  const model = buildReportModel(data, chain, new Date());
  onProgress({ phase: "Rendering reports" });
  return {
    model,
    typeAHtml: renderTypeA(model),
    typeBHtml: renderTypeB(model),
  };
}
