export {};
import {mat4} from 'gl-matrix';
import {getWorldToCameraMatrix, processInput} from "./utils/camera"
import "./assets/controls.css"
import initShaderProgram from './utils/shaderProgram';
document.title = "Камера";

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;

const gl = canvas.getContext('webgl2');

if (!gl) {
    throw new Error('WebGL 2 не поддерживается вашим браузером');
}

canvas.insertAdjacentHTML("beforebegin", `
    <div class="controls">
        <button id="depthButton" style="background: mediumseagreen;">Выключить тест глубины</button>
        <button id="cullButton" style="background: mediumseagreen;">Отбрасывать передние грани</button>
    </div>
`);
const depthButton = document.getElementById("depthButton") as HTMLButtonElement;
const cullButton = document.getElementById("cullButton") as HTMLButtonElement;
depthButton?.addEventListener("click", () => {
    if (gl.isEnabled(gl.DEPTH_TEST)) {
        gl.disable(gl.DEPTH_TEST);
        depthButton.innerText = "Включить тест глубины";
        depthButton.style.background = "lightcoral";
    }
    else {
        gl.enable(gl.DEPTH_TEST);
        depthButton.innerText = "Выключить тест глубины";
        depthButton.style.background = "mediumseagreen";
    }
})
cullButton?.addEventListener("click", () => {
    if (gl.getParameter(gl.CULL_FACE_MODE) === gl.BACK) {
        gl.cullFace(gl.FRONT);
        cullButton.innerText = "Отбрасывать задние грани";
        cullButton.style.background = "lightcoral";
    }
    else {
        gl.cullFace(gl.BACK);
        cullButton.innerText = "Отбрасывать передние грани";
        cullButton.style.background = "mediumseagreen";
    }
})

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
    uniform mat4 view;
    uniform mat4 projection;
    void main() {
        gl_Position = projection * view * model * vec4(vertexPos, 1.0);
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


const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
const programInfo = {
    program: shaderProgram,
    attribLocations: { vertexPos: gl.getAttribLocation(shaderProgram, 'vertexPos'), atexturePos: gl.getAttribLocation(shaderProgram, 'atexturePos')},
    uniformLocations: {
        model: gl.getUniformLocation(shaderProgram, "model"),
        view: gl.getUniformLocation(shaderProgram, "view"),  
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

gl.enable(gl.CULL_FACE);
gl.cullFace(gl.BACK);

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

gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, texture);

const projectionMatrix = mat4.create();
const modelMatrix = mat4.create();

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
    
    const viewMatrix = getWorldToCameraMatrix();

    mat4.perspective(projectionMatrix, Math.PI / 3, canvas.width / canvas.height, 0.1, 100.0);

    mat4.fromTranslation(modelMatrix, [-1, 0, 0]);
    mat4.scale(modelMatrix, modelMatrix, [0.5,0.5,0.5]);
    gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, modelMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.view, false, viewMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.projection, false, projectionMatrix);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);

    mat4.fromTranslation(modelMatrix, [1, 0, 0]);
    mat4.scale(modelMatrix, modelMatrix, [0.5,0.5,0.5]);
    gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, modelMatrix);
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);


    requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
}

requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
