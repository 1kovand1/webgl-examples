export {};
document.title = "Треугольник";
const canvas = document.getElementById('glCanvas') as HTMLCanvasElement | null;
if (canvas === null) 
  throw new Error("Could not find canvas element");

const gl = canvas.getContext('webgl2');

if (!gl) {
    throw new Error('WebGL 2 не поддерживается вашим браузером');
}

canvas.insertAdjacentHTML("beforebegin", `
    <div id="sliders" class="controls">
        <label> <input id="rangeR" type="range" min="0" max="255">R</label>
        <label> <input id="rangeG" type="range" min="0" max="255">G</label>
        <label> <input id="rangeB" type="range" min="0" max="255">B</label>
    </div>
`);

const rangeR = document.getElementById("rangeR") as HTMLInputElement;
const rangeG = document.getElementById("rangeG") as HTMLInputElement;
const rangeB = document.getElementById("rangeB") as HTMLInputElement;

function resizeCanvas(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}
resizeCanvas(gl, canvas);

const vsSource = `#version 300 es
    in vec3 vertexPos;
    void main() {
        gl_Position = vec4(vertexPos, 1.0);
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    uniform vec3 color;
    out vec4 fragColor;
    void main() {
        fragColor = vec4(color, 1.0); 
    }
`;

function initShaderProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string) {
    function loadShader (gl: WebGL2RenderingContext, type: number, source: string) {
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
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return program;
}

const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
const programInfo = {
    program: shaderProgram,
    attribLocations: { vertexPos: gl.getAttribLocation(shaderProgram, 'vertexPos') },
    uniformLocations: {color: gl.getUniformLocation(shaderProgram, "color")}
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

function draw(gl: WebGL2RenderingContext) {
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(programInfo.program);
    gl.uniform3f(programInfo.uniformLocations.color, +rangeR.value / 255.,+rangeG.value / 255., +rangeB.value / 255.);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

rangeR.addEventListener("input", () =>draw(gl));
rangeG.addEventListener("input", () =>draw(gl));
rangeB.addEventListener("input", () =>draw(gl));

draw(gl);