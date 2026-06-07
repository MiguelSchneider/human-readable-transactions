import { makeDataSource } from "@/explorer/datasource";
import { extractSolana } from "@/explorer/solana";
import { buildReportModel } from "@/model/build";
import { buildSolanaReportModel } from "@/model/buildSolana";
import type { ReportModel } from "@/model/types";
import { renderTypeA } from "@/report/typeA";
import { renderTypeB } from "@/report/typeB";
import type { ProgressFn } from "@/explorer/types";
import type { Target } from "@/explorer/parseUrl";

export interface GeneratedReport {
  model: ReportModel;
  typeAHtml: string;
  typeBHtml: string;
}

export async function generateReport(target: Target, onProgress: ProgressFn, signal?: AbortSignal): Promise<GeneratedReport> {
  let model: ReportModel;

  if (target.kind === "evm") {
    const source = makeDataSource(target.chain);
    onProgress({ phase: `Connecting · ${source.label}` });
    const data = await source.extract(target.address, onProgress, signal);
    onProgress({ phase: "Building the report model" });
    model = buildReportModel(data, target.chain, new Date());
  } else {
    onProgress({ phase: `Connecting · Solana ${target.cluster}` });
    const data = await extractSolana(target.address, target.cluster, onProgress, signal);
    onProgress({ phase: "Building the report model" });
    model = buildSolanaReportModel(data, new Date());
  }

  onProgress({ phase: "Rendering reports" });
  return { model, typeAHtml: renderTypeA(model), typeBHtml: renderTypeB(model) };
}
