export {};
import {mat4} from 'gl-matrix';
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
    uniform mat4 camera;
    uniform mat4 projection;
    void main() {
        gl_Position = projection * camera * model * vec4(vertexPos, 1.0);
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    void main() {
        fragColor = vec4(1.0, 0.5, 0.2, 1.0); 
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
    attribLocations: { vertexPos: gl.getAttribLocation(shaderProgram, 'vertexPos') },
    uniformLocations: {
        model: gl.getUniformLocation(shaderProgram, "model"),
        camera: gl.getUniformLocation(shaderProgram, "camera"),  
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
    const cameraMatrix = mat4.create();
    const projectionMatrix = mat4.create();
    mat4.scale(projectionMatrix, projectionMatrix, [minDimension / canvas.width, minDimension / canvas.height, 0]);

    let modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [-0.5,0,0]);
    mat4.rotateZ(modelMatrix, modelMatrix, Math.PI / 2);
    gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, modelMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.camera, false, cameraMatrix);
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
