import type { vec3 } from "gl-matrix";

export default interface Material {
    shininess: number,
    diffuse: vec3,
    specular: vec3,
    ambient: vec3,
}