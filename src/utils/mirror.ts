import { mat3, mat4, quat, vec2, vec3 } from "gl-matrix";
import initShaderProgram from "./shaderProgram";

const vsSource = `#version 300 es
precision highp float;
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 tPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

out vec2 TexturePos;
out vec3 color;
out vec3 FragPos;

void main() {
    vec4 worldPos = model * vec4(aPos, 1.0);
    FragPos = vec3(model * vec4(aPos, 1.0));
    gl_Position = projection * view * worldPos;
    
    TexturePos = tPos;
}
`;

const fsSource = `#version 300 es
precision highp float;
out vec4 FragColor;

uniform vec3 viewPos;
uniform vec3 lightSource;

in vec3 FragPos;
in vec2 TexturePos;

uniform sampler2D reflectionTexture;

void main() {
    vec2 texCoords = TexturePos;
    
    vec4 reflectionColor = texture(reflectionTexture, texCoords);
    
    vec3 tintColor = vec3(0.8, 0.9, 1.0);
    
    vec3 dx = dFdx(FragPos);
    vec3 dy = dFdy(FragPos);
    
    vec3 normal = normalize(cross(dx, dy));

    vec3 lightDir = normalize(lightSource - FragPos.xyz);

    vec3 lightColor = vec3(1.0);
    vec3 ambient = lightColor * 0.5;

    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.);
    vec3 specular = lightColor * (spec * 0.4);

    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = diff * lightColor * 0.3;

    FragColor = mix(reflectionColor, vec4((ambient + diffuse + specular) * tintColor, 1.0), 0.03);
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
        lightSource: gl.getUniformLocation(shaderProgram, "lightSource"),
    },
};

const VAO = gl.createVertexArray();
gl.bindVertexArray(VAO);
const VBO = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, VBO);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.5, 0.5, 0, 1, 1, -0.5, 0.5, 0, 0, 1, -0.5, -0.5, 0, 0, 0, 0.5, 0.5, 0, 1, 1, -0.5, -0.5, 0, 0, 0, 0.5, -0.5, 0, 1, 0]), gl.STATIC_DRAW);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
gl.enableVertexAttribArray(0);
gl.enableVertexAttribArray(1);
gl.bindVertexArray(null);

export const mirrorWidth = 1024;
export const mirrorHeight = 1024;

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
    gl.DEPTH_COMPONENT16,
    mirrorWidth,
    mirrorHeight
);

gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    gl.RENDERBUFFER,
    rb
);

const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
if (status !== gl.FRAMEBUFFER_COMPLETE) {
    console.error("Ошибка создания Framebuffer:", status);
}

gl.bindFramebuffer(gl.FRAMEBUFFER, null);

function getModel(mirrorPos: vec3, mirrorNorm: vec3, size: vec2) {
    gl.bindVertexArray(VAO);
    const model = mat4.create();
    mat4.translate(model, model, mirrorPos);
    const q = quat.create();
    quat.rotationTo(q, vec3.fromValues(0, 0, -1), mirrorNorm);
    mat4.multiply(model, model, mat4.fromQuat(mat4.create(), q));
    mat4.scale(model, model, vec3.fromValues(size[0], size[1], 1));

    return model;
}

export function createMirrorCamera(mirrorPos: vec3, mirrorNorm: vec3, view: mat4, projection: mat4, size: vec2) {
    const model = getModel(mirrorPos, mirrorNorm, size);
    
    const pos = mat4.fromValues(0.5, 0.5, 0, 1, -0.5, 0.5, 0, 1, -0.5, -0.5, 0, 1, 0.5, -0.5, 0, 1);
    mat4.multiply(pos, model, pos);
    mat4.multiply(pos, view, pos);
    mat4.multiply(pos, projection, pos);

    const bl = vec3.fromValues(pos[8] / pos[11], pos[9] / pos[11], pos[10] / pos[11]);
    const tl = vec3.fromValues(pos[4] / pos[7], pos[5] / pos[7], pos[6] / pos[7]);
    const tr = vec3.fromValues(pos[0] / pos[3], pos[1] / pos[3], pos[2] / pos[3]);

    const B = mat3.fromValues(-1, -1, 1, -1, 1, 1, 1, 1, 1);
    const P = mat3.fromValues(bl[0], bl[1], 1, tl[0], tl[1], 1, tr[0], tr[1], 1);
    mat3.invert(P, P);
    mat3.multiply(B, B, P);
    const proj = mat4.fromValues(B[0], B[1], 0, B[2], B[3], B[4], 0, B[5], 0, 0, 1, 0, B[6], B[7], 0, B[8]);
    return proj;
}

export function drawMirror(mirrorPos: vec3, mirrorNorm: vec3, view: mat4, projection: mat4, size: vec2, lightSource: vec3, viewPos: vec3) {
    const model = getModel(mirrorPos, mirrorNorm, size);
    gl.useProgram(shaderProgram);
    gl.uniformMatrix4fv(mirrorProgramInfo.uniformLocations.model, false, model);
    gl.uniformMatrix4fv(mirrorProgramInfo.uniformLocations.view, false, view);
    gl.uniformMatrix4fv(mirrorProgramInfo.uniformLocations.projection, false, projection);
    gl.uniform3fv(mirrorProgramInfo.uniformLocations.lightSource, lightSource);
    gl.uniform3fv(mirrorProgramInfo.uniformLocations.viewPos, viewPos);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, mirrorTexture);
    gl.uniform1i(mirrorProgramInfo.uniformLocations.reflectionTexture, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
}