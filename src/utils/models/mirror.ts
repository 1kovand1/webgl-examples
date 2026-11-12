import { mat4, quat, vec2, vec3, vec4 } from "gl-matrix";
import initShaderProgram from "../shaderProgram";

const vsSource = `#version 300 es
precision highp float;
layout (location = 0) in vec3 aPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

out vec3 TexturePos;
out vec3 color;
out vec3 FragPos;

void main() {
    gl_Position = projection * view * model * vec4(aPos, 1.0);
    
    TexturePos = vec3(-gl_Position.x, gl_Position.yw);
}
`;

const fsSource = `#version 300 es
precision highp float;
out vec4 FragColor;

uniform vec3 viewPos;

in vec3 TexturePos;

uniform sampler2D reflectionTexture;

void main() {
    vec2 texCoords = TexturePos.xy / 2. / TexturePos.z + vec2(0.5, 0.5);
    
    vec4 reflectionColor = texture(reflectionTexture, texCoords);
    
    vec3 tintColor = vec3(0.8, 0.9, 1.0);
    
    FragColor = mix(reflectionColor, vec4(tintColor, 1.0), 0.03);
}
`;

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;

const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
export const mirrorProgramInfo = {
    program: shaderProgram,
    uniformLocations: {
        model: gl.getUniformLocation(shaderProgram, "model"),
        view: gl.getUniformLocation(shaderProgram, "view"),
        projection: gl.getUniformLocation(shaderProgram, "projection"),
        reflectionTexture: gl.getUniformLocation(shaderProgram, "reflectionTexture"),
        viewPos: gl.getUniformLocation(shaderProgram, "viewPos"),
    },
};

const VAO = gl.createVertexArray();
gl.bindVertexArray(VAO);
const VBO = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, VBO);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.5, 0.5, 0, 1, 1, -0.5, 0.5, 0, 0, 1, -0.5, -0.5, 0, 0, 0, 0.5, 0.5, 0, 1, 1, -0.5, -0.5, 0, 0, 0, 0.5, -0.5, 0, 1, 0]), gl.STATIC_DRAW);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
gl.enableVertexAttribArray(0);
gl.bindVertexArray(null);

export const mirrorWidth = 1920;
export const mirrorHeight = 1080;

export const mirrorfb = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, mirrorfb);

const mirrorTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, mirrorTexture);

gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    mirrorWidth,
    mirrorHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
);


gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    mirrorTexture,
    0
);

const rb = gl.createRenderbuffer();
gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
gl.renderbufferStorage(
    gl.RENDERBUFFER,
    gl.DEPTH24_STENCIL8,
    mirrorWidth,
    mirrorHeight
);

gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    gl.DEPTH_STENCIL_ATTACHMENT,
    gl.RENDERBUFFER,
    rb
);

const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
if (status !== gl.FRAMEBUFFER_COMPLETE) {
    console.error("Ошибка создания Framebuffer:", status);
}

gl.bindFramebuffer(gl.FRAMEBUFFER, null);

const model = mat4.create();

function getModel(mirrorPos: vec3, mirrorNorm: vec3, size: vec2) {
    mat4.fromTranslation(model, mirrorPos);
    const q = quat.create();
    quat.rotationTo(q, vec3.fromValues(0, 0, -1), mirrorNorm);
    mat4.multiply(model, model, mat4.fromQuat(mat4.create(), q));
    mat4.scale(model, model, vec3.fromValues(size[0], size[1], 1));
}

const M = mat4.create(); 
const v1 = vec4.create();
const v2 = vec4.create();
const v3 = vec4.create();
const v4 = vec4.create();

export function getSurface(mirrorPos: vec3, mirrorNorm: vec3, view: mat4, size: vec2) {
    getModel(mirrorPos, mirrorNorm, size);
    vec4.set(v1, 1, 1, 0, 1);
    vec4.set(v2, -1, 1, 0, 1);
    vec4.set(v3, -1, -1, 0, 1);
    mat4.mul(M, view, model);

    vec4.transformMat4(v1, v1, M);
    vec4.transformMat4(v2, v2, M);
    vec4.transformMat4(v3, v3, M);

    vec4.sub(v1, v1, v2);
    vec4.sub(v3, v3, v2);
    vec3.cross(v4, v3, v1);
    v4[3] = -vec3.dot(v4, v2);

    return v4;
}

export function drawMirror(mirrorPos: vec3, mirrorNorm: vec3, view: mat4, projection: mat4, size: vec2, dry: boolean = false) {
    gl.bindVertexArray(VAO);
    getModel(mirrorPos, mirrorNorm, size);
    gl.useProgram(shaderProgram);
    gl.uniformMatrix4fv(mirrorProgramInfo.uniformLocations.model, false, model);
    gl.uniformMatrix4fv(mirrorProgramInfo.uniformLocations.view, false, view);
    gl.uniformMatrix4fv(mirrorProgramInfo.uniformLocations.projection, false, projection);
    gl.activeTexture(gl.TEXTURE0);

    if (dry)
        gl.bindTexture(gl.TEXTURE_2D, null);
    else
        gl.bindTexture(gl.TEXTURE_2D, mirrorTexture);
    gl.uniform1i(mirrorProgramInfo.uniformLocations.reflectionTexture, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
}