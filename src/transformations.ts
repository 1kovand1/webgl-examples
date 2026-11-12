export {};
import {mat4, vec2} from 'gl-matrix';
import initShaderProgram from './utils/shaderProgram';
document.title = "Преобразования координат";

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;

const gl = canvas.getContext('webgl2');

if (!gl) {
    throw new Error('WebGL 2 не поддерживается вашим браузером');
}

function resizeCanvas(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}
resizeCanvas(gl, canvas);
window.addEventListener('resize', () => resizeCanvas(gl, canvas));

const vsSource = `#version 300 es
    in vec3 vertexPos;
    uniform mat4 model;
    uniform mat4 view;
    uniform mat4 projection;
    void main() {
        gl_Position = projection * view * model * vec4(vertexPos, 1.0);
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    void main() {
        fragColor = vec4(1.0, 0.5, 0.2, 1.0); 
    }
`;

let phi = 0;
let isDragging = false;
const lastPos = vec2.create();

canvas.addEventListener("pointerdown", (e) => {
    isDragging = true;
    vec2.set(lastPos, e.x, e.y);
});

canvas.addEventListener("pointerup", () => {
    isDragging = false;
});

const newPos= vec2.create();
const delta = vec2.create();
const R = vec2.create();
canvas.addEventListener("pointermove", (e) => {
    if (!isDragging)
        return;
    vec2.set(newPos, e.x, e.y);
    vec2.sub(delta, newPos, lastPos);
    vec2.set(R, lastPos[0] - canvas.width / 2, lastPos[1] - canvas.height / 2);
    const dPhi = (-R[0]*delta[1] + R[1]*delta[0]) / vec2.squaredLength(R);
    vec2.copy(lastPos, newPos);
    phi += dPhi;
});

const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
const programInfo = {
    program: shaderProgram,
    attribLocations: { vertexPos: gl.getAttribLocation(shaderProgram, 'vertexPos') },
    uniformLocations: {
        model: gl.getUniformLocation(shaderProgram, "model"),
        view: gl.getUniformLocation(shaderProgram, "view"),  
        projection: gl.getUniformLocation(shaderProgram, "projection"),  
    },
};

const vertices = new Float32Array([
     0.0,  0.5,  0.0,  
    -0.5, -0.5,  0.0,  
     0.5, -0.5,  0.0
]);

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

gl.enableVertexAttribArray(programInfo.attribLocations.vertexPos);
gl.vertexAttribPointer(programInfo.attribLocations.vertexPos, 3, gl.FLOAT, false, 0, 0);

const viewMatrix = mat4.create();
const projectionMatrix = mat4.create();
const modelMatrix = mat4.create();

function render(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(programInfo.program);
    const minDimension = Math.min(canvas.width, canvas.height);
    mat4.fromZRotation(viewMatrix, phi);
    
    mat4.fromScaling(projectionMatrix,  [minDimension / canvas.width, minDimension / canvas.height, 0]);

    mat4.fromTranslation(modelMatrix, [-0.5,0,0]);
    mat4.rotateZ(modelMatrix, modelMatrix, Math.PI / 2);
    gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, modelMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.view, false, viewMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.projection, false, projectionMatrix);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    mat4.fromTranslation(modelMatrix, [0.5,0,0]);
    mat4.rotateZ(modelMatrix, modelMatrix, -Math.PI / 2);
    gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, modelMatrix);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(() => render(gl, canvas));
}

requestAnimationFrame(() => render(gl, canvas));
