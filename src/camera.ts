export {};
import {mat4, vec3, quat} from 'gl-matrix';
import {isPressed} from "./mobileButtons"
document.title = "Камера";

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
    in vec2 atexturePos;
    out vec3 fragColor;
    out vec2 texturePos;
    uniform mat4 model;
    uniform mat4 camera;
    uniform mat4 projection;
    void main() {
        gl_Position = projection * camera * model * vec4(vertexPos, 1.0);
        texturePos = atexturePos;
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    in vec2 texturePos;
    out vec4 fragColor;
    uniform sampler2D uSampler;
    void main() {
        fragColor = texture(uSampler, texturePos); 
    }
`;

function initShaderProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string) {
    const loadShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
        const shader = gl.createShader(type);
        if (shader === null)
          throw new Error("Could not create shader");
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    };
    const vs = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    return program;
}

const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
const programInfo = {
    program: shaderProgram,
    attribLocations: { vertexPos: gl.getAttribLocation(shaderProgram, 'vertexPos'), atexturePos: gl.getAttribLocation(shaderProgram, 'atexturePos')},
    uniformLocations: {
        model: gl.getUniformLocation(shaderProgram, "model"),
        camera: gl.getUniformLocation(shaderProgram, "camera"),  
        projection: gl.getUniformLocation(shaderProgram, "projection"),  
        uSampler: gl.getUniformLocation(shaderProgram, "uSampler"),  
    },
};

function loadTexture(gl: WebGL2RenderingContext, url: string): Promise<WebGLTexture> {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const image = new Image();
    return new Promise((resolve) => {
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                image,
            );
            gl.generateMipmap(gl.TEXTURE_2D);
            resolve(texture);
        };
        image.src = url;

    });
}
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
const texture = await loadTexture(gl, "./windowsxp.png");
const positions = new Float32Array([
    -1.0, -1.0,  1.0,   1.0, -1.0,  1.0,   1.0,  1.0,  1.0,  -1.0,  1.0,  1.0,
    -1.0, -1.0, -1.0,  -1.0,  1.0, -1.0,   1.0,  1.0, -1.0,   1.0, -1.0, -1.0,
    -1.0,  1.0, -1.0,  -1.0,  1.0,  1.0,   1.0,  1.0,  1.0,   1.0,  1.0, -1.0,
    -1.0, -1.0, -1.0,   1.0, -1.0, -1.0,   1.0, -1.0,  1.0,  -1.0, -1.0,  1.0,
     1.0, -1.0, -1.0,   1.0,  1.0, -1.0,   1.0,  1.0,  1.0,   1.0, -1.0,  1.0,
    -1.0, -1.0, -1.0,  -1.0, -1.0,  1.0,  -1.0,  1.0,  1.0,  -1.0,  1.0, -1.0,
]);
const textureCoords = new Float32Array([
    0.0,  0.0,   0.5,  0.0,   0.5,  0.5,   0.0,  0.5,
    0.5,  0.0,   0.5,  0.5,   1.0,  0.5,   1.0,  0.0,
    0.0,  1.0,   0.0,  0.5,   0.5,  0.5,   0.5,  1.0,
    0.5,  1.0,   0.0,  1.0,   0.0,  0.5,   0.5,  0.5,
    1.0,  0.0,   1.0,  0.5,   0.5,  0.5,   0.5,  0.0,
    0.5,  0.0,   0.0,  0.0,   0.0,  0.5,   0.5,  0.5,
]);

const indices = new Uint16Array([
    0,  1,  2,      0,  2,  3,    // Передняя
    4,  5,  6,      4,  6,  7,    // Задняя
    8,  9,  10,     8,  10, 11,   // Верхняя
    12, 13, 14,     12, 14, 15,   // Нижняя
    16, 17, 18,     16, 18, 19,   // Правая
    20, 21, 22,     20, 22, 23,   // Левая
]);


const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo_pos = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo_pos);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

gl.enableVertexAttribArray(programInfo.attribLocations.vertexPos);
gl.vertexAttribPointer(programInfo.attribLocations.vertexPos, 3, gl.FLOAT, false, 0, 0);

const vbo_tex = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo_tex);
gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW)
gl.enableVertexAttribArray(programInfo.attribLocations.atexturePos);
gl.vertexAttribPointer(programInfo.attribLocations.atexturePos, 2, gl.FLOAT, false, 0, 0);

const ebo = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

gl.enable(gl.DEPTH_TEST);

const cameraCords = vec3.fromValues(0,0, 1);
const cameraQuat = quat.create();

const pressedKeys = new Set();
window.addEventListener("keydown", (event: KeyboardEvent) => {pressedKeys.add(event.code)});
window.addEventListener("keyup", (event: KeyboardEvent) => {pressedKeys.delete(event.code)});
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let lastTouchX = 0;
let lastTouchY = 0;

let cameraPointerId: number = 0;

if (!window.matchMedia("(pointer: coarse)").matches)
    canvas.addEventListener('mousedown', async() => {
        await canvas.requestPointerLock();
        isDragging = true;
        lastMouseX = 0;
        lastMouseY = 0;
    });

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === null)
        isDragging = false;
});

window.addEventListener('mousemove', (e) => {
    const SENSITIVITY = 0.01;
    if (!isDragging) return;
    const right = vec3.fromValues(1,0,0);
    vec3.transformQuat(right, right, cameraQuat);
    const up = vec3.fromValues(0,1,0);
    vec3.transformQuat(up, up, cameraQuat);

    const dx = e.movementX;
    const dy = e.movementY;

    const deltaRotation = quat.create();
    quat.setAxisAngle(deltaRotation, up, -dx * SENSITIVITY);
    quat.multiply(cameraQuat, deltaRotation, cameraQuat);
    quat.setAxisAngle(deltaRotation, right, -dy * SENSITIVITY);
    quat.multiply(cameraQuat, deltaRotation, cameraQuat);

    lastMouseX += e.movementX;
    lastMouseY -= e.movementY;
});

// Сенсорное управление для мобильных устройств
canvas.addEventListener('touchstart', (e) => {
    if (!isDragging) {
        cameraPointerId = e.targetTouches[0].identifier; 
        isDragging = true;
        lastTouchX = e.targetTouches[0].clientX;
        lastTouchY = e.targetTouches[0].clientY;
    }
});
canvas.addEventListener('touchend', () => isDragging = false);
canvas.addEventListener('touchmove', (e) => {
    if (!isDragging || cameraPointerId !== e.targetTouches[0].identifier) return;
    const mockEvent = { movementX: e.targetTouches[0].clientX - lastTouchX, movementY: e.targetTouches[0].clientY - lastTouchY };
    lastTouchX = e.targetTouches[0].clientX;
    lastTouchY = e.targetTouches[0].clientY;
    window.dispatchEvent(new MouseEvent('mousemove', mockEvent));
});


function processInput(dt: number) {
    const SPEED = 0.008;
    const ROLLSPEED = 0.002;
    const forward = vec3.fromValues(0,0,-1);
    vec3.transformQuat(forward, forward, cameraQuat);
    const right = vec3.fromValues(1,0,0);
    vec3.transformQuat(right, right, cameraQuat);
    const up = vec3.fromValues(0,1,0);
    vec3.transformQuat(up, up, cameraQuat);

    const backward = vec3.create();
    vec3.negate(backward, forward);
    const left = vec3.create();
    vec3.negate(left, right);
    const down = vec3.create();
    vec3.negate(down, up);


    if (pressedKeys.has("KeyW") || isPressed["btn-up"])
        vec3.scaleAndAdd(cameraCords, cameraCords, forward, SPEED*dt);
    if (pressedKeys.has("KeyS") || isPressed["btn-down"])
        vec3.scaleAndAdd(cameraCords, cameraCords, backward, SPEED*dt);
    if (pressedKeys.has("KeyA") || isPressed["btn-left"])
        vec3.scaleAndAdd(cameraCords, cameraCords, left, SPEED*dt);
    if (pressedKeys.has("KeyD") || isPressed["btn-right"])
        vec3.scaleAndAdd(cameraCords, cameraCords, right, SPEED*dt);
    if (pressedKeys.has("Space"))
        vec3.scaleAndAdd(cameraCords, cameraCords, up, SPEED*dt);
    if (pressedKeys.has("ShiftLeft"))
        vec3.scaleAndAdd(cameraCords, cameraCords, down, SPEED*dt);
    if (pressedKeys.has("KeyQ")) {
        const deltaRotation = quat.create();
        quat.setAxisAngle(deltaRotation, forward,  -ROLLSPEED*dt);
        quat.multiply(cameraQuat, deltaRotation, cameraQuat);
    }
    if (pressedKeys.has("KeyE")) {
        const deltaRotation = quat.create();
        quat.setAxisAngle(deltaRotation, forward,  ROLLSPEED*dt);
        quat.multiply(cameraQuat, deltaRotation, cameraQuat);
    }
        

}

gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, texture);

let time: DOMHighResTimeStamp;
function render(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, timestamp: DOMHighResTimeStamp) {
    if (time === undefined)
        time = timestamp;
    const dt = timestamp - time;
    time = timestamp;
    processInput(dt);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(programInfo.program);
    const cameraMatrix = mat4.create();
    const nCameraCoords = vec3.create();
    const cameraRotationMatrix = mat4.create();
    const cameraRotationConj = quat.create();
    vec3.negate(nCameraCoords, cameraCords);
    quat.conjugate(cameraRotationConj, cameraQuat);
    mat4.fromQuat(cameraRotationMatrix, cameraRotationConj);
    mat4.translate(cameraMatrix, cameraMatrix, nCameraCoords);
    mat4.multiply(cameraMatrix, cameraRotationMatrix, cameraMatrix);

    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, Math.PI / 3, canvas.width / canvas.height, 0.1, 100.0);

    let modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [-1, 0, 0]);
    mat4.scale(modelMatrix, modelMatrix, [0.5,0.5,0.5]);
    gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, modelMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.camera, false, cameraMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.projection, false, projectionMatrix);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

    modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [1, 0, 0]);
    mat4.scale(modelMatrix, modelMatrix, [0.5,0.5,0.5]);
    gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, modelMatrix);
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);


    requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
}

requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
