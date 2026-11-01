export {};
import {mat4, vec2, vec3} from 'gl-matrix';
import initShaderProgram from './utils/shaderProgram';
document.title = "Преобразования координат";

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;

const gl = canvas.getContext('webgl2');

if (!gl) {
    throw new Error('WebGL 2 не поддерживается вашим браузером');
}

// Подгоняем размер холста под экран
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
let lastPos: vec2;

canvas.addEventListener("pointerdown", (e) => {
    isDragging = true;
    lastPos = vec2.fromValues(e.x, e.y);
});

canvas.addEventListener("pointerup", () => {
    isDragging = false;
});

canvas.addEventListener("pointermove", (e) => {
    if (!isDragging)
        return;
    const newPos = vec2.fromValues(e.x, e.y);
    const delta = vec2.sub(vec2.create(), newPos, lastPos);
    const dPhi = -vec2.cross(vec3.create(), vec2.sub(lastPos, lastPos, vec2.fromValues(canvas.width / 2, canvas.height / 2)), delta)[2] / Math.max(canvas.width, canvas.height) / 360 * 2 * Math.PI;
    lastPos = newPos;
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

function render(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(programInfo.program);
    const minDimension = Math.min(canvas.width, canvas.height);
    const viewMatrix = mat4.fromZRotation(mat4.create(), phi);
    const projectionMatrix = mat4.create();
    mat4.scale(projectionMatrix, projectionMatrix, [minDimension / canvas.width, minDimension / canvas.height, 0]);

    let modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [-0.5,0,0]);
    mat4.rotateZ(modelMatrix, modelMatrix, Math.PI / 2);
    gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, modelMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.view, false, viewMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.projection, false, projectionMatrix);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [0.5,0,0]);
    mat4.rotateZ(modelMatrix, modelMatrix, -Math.PI / 2);
    gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, modelMatrix);
    gl.drawArrays(gl.TRIANGLES, 0, 3);


    requestAnimationFrame(() => render(gl, canvas));
}

requestAnimationFrame(() => render(gl, canvas));
