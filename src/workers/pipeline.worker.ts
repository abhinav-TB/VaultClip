import { ChatPayload, ModelLoadEvent, ModelLoadSource, WorkerRequest, WorkerResponse } from './types'
import { env, TextStreamer, RawImage, AutoProcessor, Gemma4ForConditionalGeneration } from '@huggingface/transformers'

// Skip local model checks since we don't have them pre-downloaded
env.allowLocalModels = false;

const GEMMA_MODEL_ID = 'onnx-community/gemma-4-E2B-it-ONNX';
const GEMMA_REVISION = 'main';
const MODEL_FILE_SOURCE = new Map<string, ModelLoadSource>();

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, payload } = event.data

  try {
    switch (type) {
      case 'INIT_MODELS':
        await handleInitModels()
        break
      case 'CHALLENGE_RESPONSE':
        await handleChat(payload as ChatPayload)
        break
      default:
        sendResponse({
          type: 'ERROR',
          taskType: type,
          error: `Unknown task type: ${type}`,
        })
    }
  } catch (err) {
    sendResponse({
      type: 'ERROR',
      taskType: type,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

function sendResponse(response: WorkerResponse) {
  self.postMessage(response)
}

function sendModelLoadEvent(taskType: WorkerRequest['type'], event: ModelLoadEvent) {
  sendResponse({
    type: 'LOG',
    taskType,
    data: event,
  })
}

function formatBytes(bytes?: number) {
  if (!bytes) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function getModelCacheUrl(file: string) {
  return `${env.remoteHost}${env.remotePathTemplate
    .replace('{model}', GEMMA_MODEL_ID)
    .replace('{revision}', encodeURIComponent(GEMMA_REVISION))}${file}`;
}

async function getBrowserCacheSource(file: string): Promise<ModelLoadSource> {
  if (!('caches' in self)) return 'unknown';

  try {
    const cache = await caches.open(env.cacheKey);
    const cached = await cache.match(getModelCacheUrl(file));
    return cached ? 'cache' : 'network';
  } catch {
    return 'unknown';
  }
}

function describeModelProgress(taskType: WorkerRequest['type'], progress: unknown) {
  if (!progress || typeof progress !== 'object') return;

  const progressInfo = progress as {
    status?: string
    file?: string
    progress?: number
    loaded?: number
    total?: number
  };
  const file = progressInfo.file;

  if (progressInfo.status === 'download' && file) {
    sendModelLoadEvent(taskType, {
      stage: 'checking-cache',
      source: 'unknown',
      file,
      message: `Checking browser cache for ${file}.`,
    });

    void getBrowserCacheSource(file).then((source) => {
      MODEL_FILE_SOURCE.set(file, source);
      sendModelLoadEvent(taskType, {
        stage: source === 'cache' ? 'loading-cache' : 'downloading',
        source,
        file,
        message:
          source === 'cache'
            ? `Found ${file} in browser cache. Reading it locally.`
            : source === 'network'
              ? `${file} is not cached. Downloading it from Hugging Face.`
              : `Preparing ${file}; cache availability could not be confirmed.`,
      });
    });
    return;
  }

  if (progressInfo.status === 'progress' && file) {
    const source = MODEL_FILE_SOURCE.get(file) ?? 'unknown';
    const loaded = progressInfo.loaded;
    const total = progressInfo.total;
    const sizeText = loaded && total ? `${formatBytes(loaded)} of ${formatBytes(total)}` : null;

    sendModelLoadEvent(taskType, {
      stage: source === 'cache' ? 'loading-cache' : source === 'network' ? 'downloading' : 'checking-cache',
      source,
      file,
      loaded,
      total,
      message:
        source === 'cache'
          ? `Loading ${file} from browser cache${sizeText ? ` (${sizeText})` : ''}.`
          : source === 'network'
            ? `Downloading ${file} from Hugging Face${sizeText ? ` (${sizeText})` : ''}.`
            : `Loading ${file}${sizeText ? ` (${sizeText})` : ''}.`,
    });
    return;
  }

  if (progressInfo.status === 'done' && file) {
    const source = MODEL_FILE_SOURCE.get(file) ?? 'unknown';

    sendModelLoadEvent(taskType, {
      stage: source === 'cache' ? 'loading-cache' : source === 'network' ? 'downloading' : 'checking-cache',
      source,
      file,
      message:
        source === 'cache'
          ? `Finished reading ${file} from browser cache.`
          : source === 'network'
            ? `Finished downloading and caching ${file}.`
            : `Finished loading ${file}.`,
    });
  }
}


interface MemoryPerformance extends Performance {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

function getMemoryUsage() {
  const memory = (performance as MemoryPerformance).memory
  if (memory) {
    return {
      used: (memory.usedJSHeapSize / (1024 * 1024)).toFixed(2) + ' MB',
      total: (memory.totalJSHeapSize / (1024 * 1024)).toFixed(2) + ' MB',
      limit: (memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2) + ' MB',
    }
  }
  return 'Not supported'
}

// Singleton generator instance to avoid re-loading for every chat message

type MessageContent =
  | string
  | Array<{ type: 'image'; url: string } | { type: 'text'; text: string }>

interface ChatMessage {
  role: 'user'
  content: MessageContent
}

interface TokenizerLike {
  decode: (tokens: unknown, options: { skip_special_tokens: boolean }) => string
}

interface ProcessorLike {
  tokenizer?: TokenizerLike
  apply_chat_template: (
    messages: ChatMessage[],
    options: { tokenize: false; add_generation_prompt: true },
  ) => string | { toString: () => string }
  (
    text: string,
    images: RawImage[] | null,
    audios: null,
  ): Promise<Record<string, unknown>>
}

interface GeneratorModelLike {
  generate: (inputs: Record<string, unknown>) => Promise<unknown[]>
}

// Cache native models to bypass pipeline() architecture mapping wrappers
let gProcessor: ProcessorLike | null = null;
let gModel: GeneratorModelLike | null = null;

async function getGenerator(taskType: WorkerRequest['type'] = 'CHALLENGE_RESPONSE') {
  // 1. Verify WebGPU Support before attempting to load
  if (!('gpu' in navigator)) {
    throw new Error('WebGPU is not supported in this browser. Please use Chrome/Edge and ensure hardware acceleration is enabled.');
  }

  if (!gModel) {
    sendResponse({
      type: 'PROGRESS',
      taskType,
      progress: 10,
    });
    sendResponse({
      type: 'LOG',
      taskType,
      data: {
        stage: 'checking-cache',
        source: 'unknown',
        message: 'WebGPU is available. Checking browser cache for Gemma processor files.',
      } satisfies ModelLoadEvent,
    });

    gProcessor = await AutoProcessor.from_pretrained(GEMMA_MODEL_ID, {
      revision: GEMMA_REVISION,
      progress_callback: (progress: unknown) => {
        describeModelProgress(taskType, progress);
      },
    }) as unknown as ProcessorLike;

    sendResponse({
      type: 'PROGRESS',
      taskType,
      progress: 35,
    });
    sendResponse({
      type: 'LOG',
      taskType,
      data: {
        stage: 'initializing',
        source: 'memory',
        message: 'Processor is ready. Loading Gemma model weights into WebGPU memory.',
      } satisfies ModelLoadEvent,
    });

    // Gemma4ForConditionalGeneration is the correct VLM class that includes both text AND vision encoders
    gModel = await Gemma4ForConditionalGeneration.from_pretrained(GEMMA_MODEL_ID, {
      revision: GEMMA_REVISION,
      device: 'webgpu',
      dtype: 'q4f16', // Optimized for WebGPU: 4-bit weights, 16-bit activations
      progress_callback: (progress: unknown) => {
        describeModelProgress(taskType, progress);

        if (!progress || typeof progress !== 'object') return;

        const progressInfo = progress as { progress?: number; loaded?: number; total?: number };
        if (typeof progressInfo.progress === 'number') {
          const normalizedProgress = progressInfo.progress > 1 ? progressInfo.progress / 100 : progressInfo.progress;
          sendResponse({
            type: 'PROGRESS',
            taskType,
            progress: 35 + Math.round(normalizedProgress * 60),
          });
        } else if (progressInfo.loaded && progressInfo.total) {
          sendResponse({
            type: 'PROGRESS',
            taskType,
            progress: 35 + Math.round((progressInfo.loaded / progressInfo.total) * 60),
          });
        }
      },
    }) as unknown as GeneratorModelLike;
  }

  if (!gProcessor || !gModel) {
    throw new Error('Failed to load Gemma model.')
  }

  sendModelLoadEvent(taskType, {
    stage: 'ready',
    source: 'memory',
    message: 'Gemma is loaded in the worker and ready for local inference.',
  });

  return { processor: gProcessor, model: gModel };
}

async function handleInitModels() {
  try {
    await getGenerator('INIT_MODELS');

    sendResponse({
      type: 'PROGRESS',
      taskType: 'INIT_MODELS',
      progress: 100,
    });
    sendResponse({
      type: 'SUCCESS',
      taskType: 'INIT_MODELS',
      data: {
        ready: true,
      },
    });
  } catch (err) {
    sendResponse({
      type: 'ERROR',
      taskType: 'INIT_MODELS',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleChat(payload: ChatPayload) {
  try {
    const { processor, model } = await getGenerator();

    sendResponse({
      type: 'LOG',
      taskType: 'CHALLENGE_RESPONSE',
      data: 'Thinking...',
    });

    let finalPrompt = payload.prompt;
    const multimodalContent: Exclude<MessageContent, string> = [];

    if (payload.attachments && payload.attachments.length > 0) {
       for (const att of payload.attachments) {
         if (att.type === 'text') {
           finalPrompt = `--- DOCUMENT: ${att.name} ---\n${att.data}\n--- END DOCUMENT ---\n\n` + finalPrompt;
         } else if (att.type === 'image') {
           // Provide raw base64 strictly to the AutoProcessor
           multimodalContent.push({ type: 'image', url: att.data });
         }
       }
    }

    multimodalContent.push({ type: 'text', text: finalPrompt });

    const messages: ChatMessage[] = [
      { 
        role: 'user', 
        content: multimodalContent.length === 1 ? finalPrompt : multimodalContent 
      }
    ];

    const tokenizer = (processor.tokenizer || processor) as unknown as TokenizerLike;
    const streamer = new TextStreamer(tokenizer as ConstructorParameters<typeof TextStreamer>[0], {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        sendResponse({
          type: 'LOG',
          taskType: 'CHALLENGE_RESPONSE',
          data: `[STREAM]${text}`,
        });
      }
    });

    // 1. Properly apply the chat template so the model gets standard <image> tokens in the prompt
    const templatedPrompt = processor.apply_chat_template(messages, { tokenize: false, add_generation_prompt: true });
    const textPrompt = typeof templatedPrompt === 'string' ? templatedPrompt : templatedPrompt.toString();

    // 2. Load images as RawImage objects — the ONLY format AutoProcessor understands
    const rawImageData = payload.attachments?.filter(a => a.type === 'image').map(a => a.data) || [];
    const rawImages: RawImage[] = [];
    for (const b64 of rawImageData) {
      const img = await RawImage.fromURL(b64);
      rawImages.push(img);
    }

    // 3. Official positional call signature: processor(text, images, audios)
    // Matches the exact webml-community/Gemma-4-WebGPU implementation
    const inputs = await processor(
      textPrompt,
      rawImages.length > 0 ? rawImages : null,
      null // no audio for now
    );

    const t0 = performance.now();

    const outputTokens = await model.generate({
      ...inputs,
      max_new_tokens: 128,
      temperature: 0.7,
      repetition_penalty: 1.1,
      do_sample: true,
      streamer
    });

    const t1 = performance.now();
    const duration = (t1 - t0) / 1000;

    // Decode the raw token IDs to a string using the tokenizer natively
    let generatedText = tokenizer.decode(outputTokens[0], { skip_special_tokens: true });
    
    // Multi-modal generation often prefixes the input prompt string before generation. Let's slice the output.
    if(generatedText.includes('model\n')) {
       generatedText = generatedText.split('model\n').pop() || generatedText;
    }

    const finalString = typeof generatedText === 'string' ? generatedText.trim() : "Failed to parse text";
    const estimatedTokens = finalString.split(/\s+/).length * 1.3;
    const tps = (estimatedTokens / duration).toFixed(2);

    sendResponse({
      type: 'SUCCESS',
      taskType: 'CHALLENGE_RESPONSE',
      data: {
        text: finalString,
        metrics: {
          time: duration.toFixed(2),
          tps,
          memory: getMemoryUsage()
        }
      },
    });
  } catch (err) {
    sendResponse({
      type: 'ERROR',
      taskType: 'CHALLENGE_RESPONSE',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
