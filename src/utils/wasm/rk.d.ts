// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
declare var RuntimeExports: {
    /** @type {!Float64Array} */
    HEAPF64: Float64Array;
    /** @type {!Int32Array} */
    HEAP32: Int32Array;
};
interface WasmModule {
  _RK(_0: number, _1: number, _2: number, _3: number, _4: number, _5: number, _6: number): void;
  _free(_0: number): void;
  _malloc(_0: number): number;
}

export type RKData = {
  err: number,
  count: number,
  h: number
};

interface EmbindModule {
}

export type MainModule = WasmModule & typeof RuntimeExports & EmbindModule;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
