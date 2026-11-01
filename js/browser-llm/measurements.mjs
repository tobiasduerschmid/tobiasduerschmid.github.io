import {ARTIFACTS,CONTEXT_TOKENS} from './catalog.mjs';

export const WARMUP_MESSAGES = [
  {role:'system',content:'Follow the user instruction exactly.'},
  {role:'user',content:'Reply with exactly this word, without quotes or any other text: ready'}
];
export const BENCHMARK_PROGRAM = 'def count_positive(values):\n    count = 0\n    for value in values:\n        if value > 0:\n            count += 1\n    return count';
export const BENCHMARK_MESSAGES = [
  {role:'system',content:'Repeat the supplied Python function exactly. Return only the code, without markdown or explanation.'},
  {role:'user',content:BENCHMARK_PROGRAM}
];
const VERSIONS = {webllm:'0.2.87',wllama:'3.8.1',onnx:'transformers-3.8.1-ort-1.22.0-dev.20250409-89f8206ba4'};
export function measurementKey(profile) {
  return [ARTIFACTS[profile.artifact].assets[0].url,VERSIONS[profile.engine],profile.id,
    profile.threads,profile.prefillTokens || 128,CONTEXT_TOKENS,'count-positive-v1'].join('|');
}
export function comparableResult(result) {
  return result.finishReason === 'stop' && result.text.trim() === BENCHMARK_PROGRAM;
}
