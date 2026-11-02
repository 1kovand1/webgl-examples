export { };
import { mat4 } from 'gl-matrix';
import { getWorldToCameraMatrix, processInput } from "./utils/camera"
import "./assets/controls.css"
import initShaderProgram from './utils/shaderProgram';
document.title = "Поверхность";

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;

const gl = canvas.getContext('webgl2');

if (!gl) {
    throw new Error('WebGL 2 не поддерживается вашим браузером');
}

canvas.insertAdjacentHTML("beforebegin", `
    <div class="controls">
        <label> <input id="rangePatches" type="range" min="1" max="255" value="4">Количество патчей <p id="pathesP">4</p></label>
    </div>
`);
const rangePatches = document.getElementById("rangePatches") as HTMLInputElement;
const pathesP = document.getElementById("pathesP") as HTMLParagraphElement;

rangePatches.max = Math.floor((Math.sqrt(gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) - 12) - 1) / 3).toString();
function resizeCanvas(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}
resizeCanvas(gl, canvas);
window.addEventListener('resize', () => resizeCanvas(gl, canvas));

gl.enable(gl.DEPTH_TEST);

const vsSource = `#version 300 es
    precision highp float;

    layout(location = 0) in vec2 uv;

    uniform vec3 controlPoints[(3 * PATCH_COUNT + 1) * (3 * PATCH_COUNT + 1)];

    uniform mat4 projection;
    uniform mat4 view;
    uniform mat4 model;

    out vec3 fragNormal;
    out vec3 fragPosition;
    out float z;

    vec3 getControlPoint(int i, int j) {
        int patchX = gl_InstanceID % PATCH_COUNT;
        int patchY = gl_InstanceID / PATCH_COUNT;

        int x = patchX * 3 + i;
        int y = patchY * 3 + j;

        return controlPoints[y * (3 * PATCH_COUNT + 1) + x];
    }

    vec4 bernstein(float t) {
        float s = 1.0 - t;

        return vec4(
            s*s*s,
            3.0*t*s*s,
            3.0*t*t*s,
            t*t*t
        );
    }

    vec4 bernsteinDerivative(float t) {
        float s = 1.0 - t;

        return vec4(
            -3.0*s*s,
            3.0*s*(1.0 - 3.0*t),
            3.0*t*(2.0 - 3.0*t),
            3.0*t*t
        );
    }

    void evaluateSurface(
        vec2 uv,
        out vec3 position,
        out vec3 normal
    ) {
        vec4 bu = bernstein(uv.x);
        vec4 bv = bernstein(uv.y);

        vec4 du = bernsteinDerivative(uv.x);
        vec4 dv = bernsteinDerivative(uv.y);

        vec3 pu = vec3(0.0);
        vec3 pv = vec3(0.0);

        position = vec3(0.0);

        for (int i = 0; i < 4; ++i) {
            for (int j = 0; j < 4; ++j) {
                vec3 p = getControlPoint(i, j);

                position += p * bu[i] * bv[j];

                pu += p * du[i] * bv[j];
                pv += p * bu[i] * dv[j];
            }
        }

        normal = normalize(cross(pu, pv));
    }

    void main() {
        vec3 position;
        vec3 normal;

        evaluateSurface(uv, position, normal);

        vec4 worldPosition = model * vec4(position, 1.0);

        fragPosition = worldPosition.xyz;
        fragNormal = normalize(
            mat3(transpose(inverse(model))) * normal
        );
        z = worldPosition.z;
        gl_Position = projection * view * worldPosition;
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    in float z;
    out vec4 fragColor;
    void main() {
        fragColor = vec4(z, 1.0, 1.-z, 1.0); 
    }
`;

const linesvsSource = `#version 300 es
    precision highp float;
    layout(location = 0) in vec3 pos;
    uniform mat4 projection;
    uniform mat4 view;
    uniform mat4 model;
    void main() {
        gl_Position = view * model * vec4(pos, 1);
        gl_Position.z += 0.15;
        gl_Position = projection * gl_Position;
    }
`;

const linesfsSource = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    void main() {
        fragColor = vec4(1.0, 0.0, 0.0, 1.0); 
    }
`;

let PATCH_COUNT = 4;
let shaderProgram = initShaderProgram(gl, vsSource.replace(/PATCH_COUNT/g, PATCH_COUNT.toString()), fsSource);
let programInfo = {
    program: shaderProgram,
    attribLocations: { uv: 0 },
    uniformLocations: {
        model: gl.getUniformLocation(shaderProgram, "model"),
        view: gl.getUniformLocation(shaderProgram, "view"),
        projection: gl.getUniformLocation(shaderProgram, "projection"),
        controlPoints: gl.getUniformLocation(shaderProgram, "controlPoints[0]"),
    },
};

const linesshaderProgram = initShaderProgram(gl, linesvsSource, linesfsSource);
const linesprogramInfo = {
    program: linesshaderProgram,
    attribLocations: { uv: 0 },
    uniformLocations: {
        model: gl.getUniformLocation(linesshaderProgram, "model"),
        view: gl.getUniformLocation(linesshaderProgram, "view"),
        projection: gl.getUniformLocation(linesshaderProgram, "projection"),
    },
};

function createPatchMesh(
    resolution: number
): {
    uv: Float32Array;
    indices: Uint16Array;
} {
    const vertexCount = (resolution + 1) ** 2;

    const uv = new Float32Array(vertexCount * 2);
    const indices = new Uint16Array(resolution * resolution * 6);

    let vi = 0;
    let ii = 0;

    for (let y = 0; y <= resolution; y++) {
        for (let x = 0; x <= resolution; x++) {
            uv[vi++] = x / resolution;
            uv[vi++] = y / resolution;

            if (x < resolution && y < resolution) {
                const a = y * (resolution + 1) + x;
                const b = a + 1;
                const d = a + resolution + 1;
                const c = d + 1;

                indices[ii++] = a;
                indices[ii++] = b;
                indices[ii++] = c;

                indices[ii++] = a;
                indices[ii++] = c;
                indices[ii++] = d;
            }
        }
    }

    return { uv, indices };
}


const vao = gl.createVertexArray();
gl.bindVertexArray(vao);
const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
const { uv, indices } = createPatchMesh(100);
gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
const ebo = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(0);

let RESOLUTION = 3 * PATCH_COUNT + 1;
const cords: Array<number> = [];

const lines_vao = gl.createVertexArray();
gl.bindVertexArray(lines_vao);
const linesu_vbo = gl.createBuffer();


const cordsvu: Array<number> = [];

const linesv_vbo = gl.createBuffer();

rangePatches.addEventListener("input", () => {
    PATCH_COUNT = +rangePatches.value;
    pathesP.innerText = PATCH_COUNT.toString();
    shaderProgram = initShaderProgram(gl, vsSource.replace(/PATCH_COUNT/g, PATCH_COUNT.toString()), fsSource);
    programInfo = {
        program: shaderProgram,
        attribLocations: { uv: 0 },
        uniformLocations: {
            model: gl.getUniformLocation(shaderProgram, "model"),
            view: gl.getUniformLocation(shaderProgram, "view"),
            projection: gl.getUniformLocation(shaderProgram, "projection"),
            controlPoints: gl.getUniformLocation(shaderProgram, "controlPoints[0]"),
        }
    }
    gl.useProgram(programInfo.program);

    RESOLUTION = 3 * PATCH_COUNT + 1;
    cords.length = 0;
    for (let i = 0; i < RESOLUTION; ++i)
        for (let j = 0; j < RESOLUTION; ++j) {
            const u = -Math.PI + i % RESOLUTION * 2 * Math.PI / (RESOLUTION - 1);
            const v = -Math.PI + j % RESOLUTION * 2 * Math.PI / (RESOLUTION - 1)
            cords.push(
                (1 + v / 2 * Math.cos(u / 2)) * Math.cos(u),
                (1 + v / 2 * Math.cos(u / 2)) * Math.sin(u),
                v / 2 * Math.sin(u / 2)
            );
        }
    const cordsArray = new Float32Array(cords);
    gl.uniform3fv(programInfo.uniformLocations.controlPoints, cordsArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, linesu_vbo);
    gl.bufferData(gl.ARRAY_BUFFER, cordsArray, gl.STATIC_DRAW);
    
    cordsvu.length = 0;
    for (let i = 0; i < RESOLUTION; ++i)
    for (let j = 0; j < RESOLUTION; ++j) {
        const start = 3 * (RESOLUTION * j + i);
        cordsvu.push(cords[start], cords[start + 1], cords[start + 2]);
    }
    gl.bindVertexArray(lines_vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, linesv_vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cordsvu), gl.STATIC_DRAW);
});

rangePatches.dispatchEvent(new InputEvent("input"));

gl.enableVertexAttribArray(0);
gl.bindVertexArray(null);

const modelMatrix = mat4.create();
const projectionMatrix = mat4.create();


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

    const cameraMatrix = getWorldToCameraMatrix();

    mat4.perspective(projectionMatrix, Math.PI / 3, canvas.width / canvas.height, 0.25, 100.0);

    mat4.identity(modelMatrix);
    mat4.multiplyScalar(modelMatrix, modelMatrix, 2);
    gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, modelMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.view, false, cameraMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.projection, false, projectionMatrix);
    gl.bindVertexArray(vao);

    gl.drawElementsInstanced(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0, PATCH_COUNT ** 2);

    gl.useProgram(linesshaderProgram);
    gl.uniformMatrix4fv(linesprogramInfo.uniformLocations.model, false, modelMatrix);
    gl.uniformMatrix4fv(linesprogramInfo.uniformLocations.view, false, cameraMatrix);
    gl.uniformMatrix4fv(linesprogramInfo.uniformLocations.projection, false, projectionMatrix);
    gl.bindVertexArray(lines_vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, linesu_vbo);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    for (let i = 0; i < RESOLUTION; ++i)
        gl.drawArrays(gl.LINE_STRIP, i * RESOLUTION, RESOLUTION);
    gl.bindBuffer(gl.ARRAY_BUFFER, linesv_vbo);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    for (let i = 0; i < RESOLUTION; ++i)
        gl.drawArrays(gl.LINE_STRIP, i * RESOLUTION, RESOLUTION);

    requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
}

requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
