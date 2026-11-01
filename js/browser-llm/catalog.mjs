import {MLC_7B} from './catalog-7b.mjs';
// Immutable Qwen2.5-Coder artifacts. Weights stay outside the repository.
export const CONTEXT_TOKENS = 4096;
export const OUTPUT_TOKENS = 384;
export const DEFAULT_MODEL = '3b';
export const MODELS = {
  '3b':{label:'Qwen2.5-Coder 3B Instruct',requiresMemoryConfirmation:false,
    memoryNote:'Lower-memory default for 8 GB-class devices. Other apps and tabs share the available memory.'},
  '7b':{label:'Qwen2.5-Coder 7B Instruct',requiresMemoryConfirmation:true,
    memoryNote:'Use a device with at least 16 GB of memory and allow about 6 GB of available graphics or shared memory. This is an estimate, not a measurement; loading can use more. Close memory-heavy apps and tabs.'}
};
export const ARTIFACTS = {
  "mlc7b": MLC_7B,
  "mlc": {
    "label": "Qwen2.5-Coder 3B Instruct (4-bit MLC)",
    "bytes": 1743386562,
    "revision": "5213029e7ae2ad46baf9657aa491186e56cd34d6",
    "baseUrl": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/",
    "assets": [
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/mlc-chat-config.json",
        "bytes": 2046,
        "cache": "webllm/config"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/ndarray-cache.json",
        "bytes": 164967,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_0.bin",
        "bytes": 155582464,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_1.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_10.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_11.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_12.bin",
        "bytes": 33502208,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_13.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_14.bin",
        "bytes": 28960768,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_15.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_16.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_17.bin",
        "bytes": 33502208,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_18.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_19.bin",
        "bytes": 28960768,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_2.bin",
        "bytes": 32133120,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_20.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_21.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_22.bin",
        "bytes": 33502208,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_23.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_24.bin",
        "bytes": 28960768,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_25.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_26.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_27.bin",
        "bytes": 33502208,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_28.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_29.bin",
        "bytes": 28960768,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_3.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_30.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_31.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_32.bin",
        "bytes": 33502208,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_33.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_34.bin",
        "bytes": 28960768,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_35.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_36.bin",
        "bytes": 26134528,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_37.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_38.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_39.bin",
        "bytes": 33502208,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_4.bin",
        "bytes": 28960768,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_40.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_41.bin",
        "bytes": 28960768,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_42.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_43.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_44.bin",
        "bytes": 33502208,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_45.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_46.bin",
        "bytes": 28960768,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_47.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_48.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_49.bin",
        "bytes": 33502208,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_5.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_50.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_51.bin",
        "bytes": 23647232,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_52.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_53.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_54.bin",
        "bytes": 33502208,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_55.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_56.bin",
        "bytes": 28960768,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_57.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_58.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_59.bin",
        "bytes": 33502208,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_6.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_60.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_61.bin",
        "bytes": 28960768,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_7.bin",
        "bytes": 33502208,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_8.bin",
        "bytes": 22544384,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/params_shard_9.bin",
        "bytes": 28960768,
        "cache": "webllm/model"
      },
      {
        "url": "https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/5213029e7ae2ad46baf9657aa491186e56cd34d6/tokenizer.json",
        "bytes": 7031645,
        "cache": "webllm/model"
      }
    ],
    "modelId": "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",
    "integrity": {
      "model_lib": "sha256-EOqE35gjopJ7UsvfdSvWTapuHbPRYX6+eRvp3CgApx4=",
      "config": "sha256-sgrKtcaLVOSnpm0/J8n6Q+kh4oBl+FtBXPHtDjv5VNc="
    },
    "library": "qwen2.5-3b-webllm-0.2.87.wasm"
  },
  "gguf": {
    "label": "Qwen2.5-Coder 3B Instruct (4-bit GGUF)",
    "bytes": 2104932800,
    "revision": "f74adce6aa16316c625447af059dbebe4983757c",
    "baseUrl": "https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/f74adce6aa16316c625447af059dbebe4983757c/",
    "assets": [
      {
        "url": "https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/f74adce6aa16316c625447af059dbebe4983757c/qwen2.5-coder-3b-instruct-q4_k_m.gguf",
        "bytes": 2104932800,
        "cache": "sebook-llm-gguf-v1"
      }
    ]
  },
  "onnx": {
    "label": "Qwen2.5-Coder 3B Instruct (4-bit ONNX)",
    "bytes": 2379064640,
    "revision": "0e076a9c5291f8c74b3ce1558f21336b18f94739",
    "baseUrl": "https://huggingface.co/onnx-community/Qwen2.5-Coder-3B-Instruct/resolve/0e076a9c5291f8c74b3ce1558f21336b18f94739/",
    "assets": [
      {
        "url": "https://huggingface.co/onnx-community/Qwen2.5-Coder-3B-Instruct/resolve/0e076a9c5291f8c74b3ce1558f21336b18f94739/config.json",
        "bytes": 910,
        "cache": "sebook-llm-onnx-v1"
      },
      {
        "url": "https://huggingface.co/onnx-community/Qwen2.5-Coder-3B-Instruct/resolve/0e076a9c5291f8c74b3ce1558f21336b18f94739/generation_config.json",
        "bytes": 243,
        "cache": "sebook-llm-onnx-v1"
      },
      {
        "url": "https://huggingface.co/onnx-community/Qwen2.5-Coder-3B-Instruct/resolve/0e076a9c5291f8c74b3ce1558f21336b18f94739/onnx/model_q4f16.onnx",
        "bytes": 271268174,
        "cache": "sebook-llm-onnx-v1"
      },
      {
        "url": "https://huggingface.co/onnx-community/Qwen2.5-Coder-3B-Instruct/resolve/0e076a9c5291f8c74b3ce1558f21336b18f94739/onnx/model_q4f16.onnx_data",
        "bytes": 2096365568,
        "cache": "sebook-llm-onnx-v1"
      },
      {
        "url": "https://huggingface.co/onnx-community/Qwen2.5-Coder-3B-Instruct/resolve/0e076a9c5291f8c74b3ce1558f21336b18f94739/tokenizer.json",
        "bytes": 11421896,
        "cache": "sebook-llm-onnx-v1"
      },
      {
        "url": "https://huggingface.co/onnx-community/Qwen2.5-Coder-3B-Instruct/resolve/0e076a9c5291f8c74b3ce1558f21336b18f94739/tokenizer_config.json",
        "bytes": 7849,
        "cache": "sebook-llm-onnx-v1"
      }
    ],
    "modelId": "onnx-community/Qwen2.5-Coder-3B-Instruct",
    "maxInputTokens": 768
  }
};

// Bound persistent entries for resumable transfers. Ranges reconstruct the
// exact upstream file; they are not independently quantized model shards.
const PART_BYTES = 32 * 1024 * 1024;
for (const artifact of [ARTIFACTS.gguf,ARTIFACTS.onnx]) {
  artifact.assets = artifact.assets.flatMap(file=>file.bytes <= PART_BYTES ? [file] :
    Array.from({length:Math.ceil(file.bytes/PART_BYTES)},(_,index)=>{
      const start=index*PART_BYTES, end=Math.min(file.bytes,start+PART_BYTES)-1;
      return {url:file.url+'?sebook-part='+index,fileUrl:file.url,cache:file.cache,bytes:end-start+1,
        range:{start,end,total:file.bytes}};
    }));
}
