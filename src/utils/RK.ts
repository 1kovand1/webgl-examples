import { vec3 } from "gl-matrix";
import type celestialBody from "../interfaces/celestialBody";
import * as wasm from "./wasm/rk"

const module = await wasm.default();

let Y_ptr: number;
let masses_ptr: number;
let size: number;
const vec = vec3.create();
const data_ptr = module._malloc(24);
const G = 8.814e-10;

export function initRK(modelData: Record<string, celestialBody>): void {
    size = Object.keys(modelData).length;
    masses_ptr = module._malloc(size * 8);
    const masses = module.HEAPF64.subarray(masses_ptr >> 3, (masses_ptr >> 3) + size);
    Object.values(modelData).forEach((d, i) => masses[i] = d.mass);

    Y_ptr = module._malloc(size * 8 * 6);
    const Y = module.HEAPF64.subarray(Y_ptr >> 3, (Y_ptr >> 3) + size * 6);
    Object.values(modelData).forEach((d, i) => {
        Y[6 * i + 0] = d.position[0];
        Y[6 * i + 1] = d.position[1];
        Y[6 * i + 2] = d.position[2];

        Y[6 * i + 3] = d.velocity[0];
        Y[6 * i + 4] = d.velocity[1];
        Y[6 * i + 5] = d.velocity[2];
    });
}

export function getPosition(i: number): vec3 {
    return vec3.copy(vec, module.HEAPF64.subarray((Y_ptr >> 3) + 6 * i, (Y_ptr >> 3) + 6 * i + 3));
}


export function RK4(dt: number, tol=1e-15) {
    module._RK(data_ptr, Y_ptr, size, masses_ptr, G, dt, tol, 1000);
    return {err: module.HEAPF64[data_ptr >> 3], h: module.HEAPF64[(data_ptr >> 3) + 1], count: module.HEAP32[(data_ptr >> 2) + 4]} as wasm.RKData;
}