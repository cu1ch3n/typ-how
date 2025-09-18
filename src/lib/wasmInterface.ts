// WASM Interface for Type Inference Engines using WASI
// This is a flexible interface that can work with different WASM modules
// Default: type-inference-zoo-wasm, but supports any compatible WASM engine
import { ConsoleStdout, WASI } from "@bjorn3/browser_wasi_shim";

interface WasmSource {
  id: string;
  name: string;
  url: string;
  authType?: 'none' | 'bearer' | 'basic' | 'header' | 'presigned';
  authToken?: string;
  authHeader?: string;
  authUsername?: string;
  authPassword?: string;
  isLocal?: boolean;
  createdAt: number;
  lastUpdated?: string;
}

export interface InferenceRequest {
  algorithm: string;
  variant?: string;
  expression: string;
  options?: {
    showSteps?: boolean;
    maxDepth?: number;
  };
}

export interface SubtypingRequest {
  algorithm: string;
  variant: string;
  leftType: string;
  rightType: string;
  options?: {
    showSteps?: boolean;
    maxDepth?: number;
  };
}

export interface MetadataRequest {
  command: "--meta";
}

export interface InferenceResponse {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  steps?: Array<Record<string, unknown>>;
}

export interface SubtypingResponse {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  steps?: Array<Record<string, unknown>>;
}

export class WasmTypeInference {
  private wasmModule: WebAssembly.Module | null = null;
  private wasmSource: WasmSource;
  private isInitialized = false;
  private outputBuffer = '';
  private activeInstances = new Set<WebAssembly.Instance>();
  private maxConcurrentInstances = 2;
  
  constructor(wasmUrl = 'https://files.typ.how/zoo.wasm') {
    this.wasmSource = {
      id: 'default',
      name: 'Type Inference Zoo (Default)',
      url: wasmUrl,
      authType: 'none',
      isLocal: false,
      createdAt: Date.now()
    };
    // eslint-disable-next-line no-console
    console.log(`Type Inference Playground initialized with WASM: ${this.wasmSource.url}`);
  }

  updateWasmUrl(newUrl: string) {
    if (this.wasmSource.url !== newUrl) {
      this.wasmSource = {
        ...this.wasmSource,
        url: newUrl,
        id: Date.now().toString(),
        createdAt: Date.now()
      };
      // Reset initialization when URL changes
      this.wasmModule = null;
      this.clearActiveInstances();
      this.isInitialized = false;
      // eslint-disable-next-line no-console
      console.log(`WASM engine switched to: ${this.wasmSource.url}`);
    }
  }

  updateWasmSource(newSource: WasmSource) {
    if (this.wasmSource.url !== newSource.url || 
        this.wasmSource.authType !== newSource.authType ||
        this.wasmSource.authToken !== newSource.authToken ||
        this.wasmSource.authHeader !== newSource.authHeader ||
        this.wasmSource.authUsername !== newSource.authUsername ||
        this.wasmSource.authPassword !== newSource.authPassword) {
      this.wasmSource = { ...newSource };
      // Reset initialization when source changes
      this.wasmModule = null;
      this.clearActiveInstances();
      this.isInitialized = false;
      // eslint-disable-next-line no-console
      console.log(`WASM engine switched to: ${this.wasmSource.name} (${this.wasmSource.url})`);
    }
  }

  getWasmUrl(): string {
    return this.wasmSource.url;
  }

  getWasmSource(): WasmSource {
    return { ...this.wasmSource };
  }

  private clearActiveInstances() {
    this.activeInstances.clear();
  }

  private async createInstance(args: string[], env: string[], fds: any[]): Promise<{instance: WebAssembly.Instance, wasi: WASI}> {
    if (!this.wasmModule) {
      throw new Error('WASM module not loaded');
    }

    // Limit concurrent instances to prevent memory issues
    if (this.activeInstances.size >= this.maxConcurrentInstances) {
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const wasi = new WASI(args, env, fds);
    const instance = await WebAssembly.instantiate(this.wasmModule, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });

    this.activeInstances.add(instance);
    return { instance, wasi };
  }

  private cleanupInstance(instance: WebAssembly.Instance) {
    this.activeInstances.delete(instance);
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      // Load WASM file with authentication support
      const headers: Record<string, string> = {
        'Accept': 'application/wasm',
      };
      
      // Add authentication headers based on auth type
      switch (this.wasmSource.authType) {
        case 'bearer':
          if (this.wasmSource.authToken) {
            headers['Authorization'] = `Bearer ${this.wasmSource.authToken}`;
          }
          break;
        case 'basic':
          if (this.wasmSource.authUsername && this.wasmSource.authPassword) {
            const credentials = btoa(`${this.wasmSource.authUsername}:${this.wasmSource.authPassword}`);
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
        case 'header':
          if (this.wasmSource.authHeader) {
            const [key, value] = this.wasmSource.authHeader.split(': ', 2);
            if (key && value) {
              headers[key.trim()] = value.trim();
            }
          }
          break;
        case 'presigned':
          // For pre-signed URLs, no additional headers needed
          break;
        default:
          // No authentication
          break;
      }

      console.log(`Loading WASM from: ${this.wasmSource.name} (${this.wasmSource.url})`);
      
      const response = await fetch(this.wasmSource.url, {
        method: 'GET',
        mode: 'cors',
        cache: 'default',
        credentials: 'omit', // Don't send cookies for CORS
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
      }
      
      const wasmBytes = await response.arrayBuffer();
      const lastModified = response.headers.get('Last-Modified');
      
      // Update the source's lastUpdated field if we got a Last-Modified header
      if (lastModified) {
        this.wasmSource.lastUpdated = lastModified;
        this.updateSourceInStorage();
        console.log(`Last-Modified: ${lastModified}`);
      }
      
      this.wasmModule = await WebAssembly.compile(wasmBytes);
      
      // Don't pre-instantiate - each call needs its own WASI configuration
      
      this.isInitialized = true;
      
      console.log(`✅ Type inference engine loaded: ${this.wasmSource.url} (${wasmBytes.byteLength} bytes)`);
      return true;
    } catch (error) {
      console.error('Failed to load WASM module:', error);
      return false;
    }
  }

  async runInference(request: InferenceRequest): Promise<InferenceResponse> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('WASM module not available');
      }
    }

    try {
      if (!this.wasmModule) {
        throw new Error('WASM module not loaded');
      }

      // Reset output buffer
      this.outputBuffer = '';

      // Prepare command line arguments exactly like your original implementation
      const args = request.variant 
        ? ['infer', '--typing', request.algorithm, '--variant', request.variant, request.expression]
        : ['infer', '--typing', request.algorithm, request.expression];
      const env: string[] = [];
      
      const fds = [
        null, // stdin
        ConsoleStdout.lineBuffered((msg) => {
          this.outputBuffer += `${msg}\n`;
        }),
      ];

      const { instance, wasi } = await this.createInstance(args, env, fds);
      
      try {
        wasi.start(instance as any);
      } finally {
        // Always cleanup the instance after use
        this.cleanupInstance(instance);
      }

      // Parse output as JSON or return as text
      const output = this.outputBuffer.trim();

      console.log(output);
      try {
        const result = JSON.parse(output);
        return {
          success: true,
          result,
          steps: result.steps || []
        };
      } catch {
        // If not JSON, return as text result
        return {
          success: true,
          result: { type: output },
          steps: []
        };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('WASM inference error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown WASM error',
      };
    }
  }

  async runSubtyping(request: SubtypingRequest): Promise<SubtypingResponse> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('WASM module not available');
      }
    }

    try {
      if (!this.wasmModule) {
        throw new Error('WASM module not loaded');
      }

      // Reset output buffer
      this.outputBuffer = '';

      // Prepare command line arguments for subtyping
      const args = request.variant  
        ? ['infer', '--subtyping', request.algorithm, '--variant', request.variant, request.leftType, request.rightType]
        : ['infer', '--subtyping', request.algorithm, request.leftType, request.rightType];
      const env: string[] = [];
      
      const fds = [
        null, // stdin
        ConsoleStdout.lineBuffered((msg) => {
          this.outputBuffer += `${msg}\n`;
        }),
      ];

      const { instance, wasi } = await this.createInstance(args, env, fds);
      
      try {
        wasi.start(instance as any);
      } finally {
        // Always cleanup the instance after use
        this.cleanupInstance(instance);
      }

      // Parse output as JSON or return as text
      const output = this.outputBuffer.trim();

      console.log(output);
      try {
        const result = JSON.parse(output);
        return {
          success: true,
          result,
          steps: result.steps || []
        };
      } catch {
        // If not JSON, return as text result
        return {
          success: true,
          result: { type: output },
          steps: []
        };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('WASM subtyping error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown WASM error',
      };
    }
  }


  async getMetadata(): Promise<import('@/types/inference').TypeInferenceAlgorithm[]> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('WASM module not available');
      }
    }

    try {
      if (!this.wasmModule) {
        throw new Error('WASM module not loaded');
      }

      // Reset output buffer
      this.outputBuffer = '';

      // Prepare command line arguments for metadata
      const args = ['infer', '--meta'];
      const env: string[] = [];
      
      const fds = [
        null, // stdin
        ConsoleStdout.lineBuffered((msg) => {
          this.outputBuffer += `${msg}\n`;
        }),
      ];

      const { instance, wasi } = await this.createInstance(args, env, fds);
      
      try {
        wasi.start(instance as any);
      } finally {
        // Always cleanup the instance after use
        this.cleanupInstance(instance);
      }

      // Parse output as JSON
      const output = this.outputBuffer.trim();
      
      try {
        return JSON.parse(output);
      } catch {
        throw new Error('Failed to parse metadata JSON from WASM');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('WASM metadata error:', error);
      throw error;
    }
  }

  private updateSourceInStorage() {
    try {
      const STORAGE_KEY = 'wasm-sources';
      const savedSources = localStorage.getItem(STORAGE_KEY);
      if (savedSources) {
        const sources = JSON.parse(savedSources);
        const sourceIndex = sources.findIndex((s: WasmSource) => s.id === this.wasmSource.id);
        if (sourceIndex !== -1) {
          sources[sourceIndex] = this.wasmSource;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
          // Dispatch event to notify components of the update
          window.dispatchEvent(new CustomEvent('wasmSourceUpdated', { 
            detail: { source: this.wasmSource } 
          }));
        }
      }
    } catch (error) {
      console.error('Failed to update source in storage:', error);
    }
  }

  destroy() {
    this.wasmModule = null;
    this.clearActiveInstances();
    this.isInitialized = false;
    this.outputBuffer = '';
    // eslint-disable-next-line no-console
    console.log('Type inference engine unloaded');
  }

  // Clean up periodically to prevent memory leaks
  cleanup() {
    // Clear any lingering instances
    this.clearActiveInstances();
    
    // Force garbage collection if available
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
  }
}

// Initialize WASM source from localStorage if available
const initializeWasmSource = (): WasmTypeInference => {
  const instance = new WasmTypeInference();
  
  // Try to load saved settings from localStorage
  try {
    const savedSources = localStorage.getItem('wasm-sources');
    if (savedSources) {
      const parsed = JSON.parse(savedSources);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Find the current source or use the first one
        const currentSource = parsed.find(s => s.url === localStorage.getItem('current-wasm-url')) || parsed[0];
        if (currentSource) {
          instance.updateWasmSource(currentSource);
          console.log(`WASM source loaded from localStorage: ${currentSource.name} (${currentSource.url})`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to load WASM source from localStorage:', error);
  }
  
  return instance;
};

// Global instance - initialized with saved settings if available
export const wasmInference = initializeWasmSource();