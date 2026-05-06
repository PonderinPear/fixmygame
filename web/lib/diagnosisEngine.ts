export type DiagnosisPipelineParams<TAi = unknown, TSignals = unknown> = {
  rawLog: string;
  detectedGame: string;
  detectedSignals: TSignals;
  aiResult: TAi;
};

export function buildDiagnosisPipeline<TAi, TSignals>({
  rawLog: _rawLog,
  detectedGame: _detectedGame,
  detectedSignals: _detectedSignals,
  aiResult,
}: DiagnosisPipelineParams<TAi, TSignals>): TAi {
  return aiResult;
}