export {};
document.title = "Два треугольника";
const canvas = document.getElementById('glCanvas') as HTMLCanvasElement | null;
if (canvas === null) 
  throw new Error("Could not find canvas element");

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

const vsSource = `#version 300 es
    in vec3 vertexPos;
    void main() {
        gl_Position = vec4(vertexPos, 1.0);
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
};

let vertices = new Float32Array([
     -0.35,  0.5,  0.0,  
     -0.85, -0.5,  0.0,  
      0.15, -0.5,  0.0
]);

const vao1 = gl.createVertexArray();
gl.bindVertexArray(vao1);

let vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

gl.enableVertexAttribArray(programInfo.attribLocations.vertexPos);
gl.vertexAttribPointer(programInfo.attribLocations.vertexPos, 3, gl.FLOAT, false, 0, 0);

vertices = new Float32Array([
      0.35, -0.5,  0.0,  
     -0.15,  0.5,  0.0,  
      0.85,  0.5,  0.0
]);

const vao2 = gl.createVertexArray();
gl.bindVertexArray(vao2);

vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

gl.enableVertexAttribArray(programInfo.attribLocations.vertexPos);
gl.vertexAttribPointer(programInfo.attribLocations.vertexPos, 3, gl.FLOAT, false, 0, 0);

gl.clearColor(0.1, 0.1, 0.1, 1.0);
gl.useProgram(programInfo.program);

gl.bindVertexArray(vao1);
gl.drawArrays(gl.TRIANGLES, 0, 3);

gl.bindVertexArray(vao2);
gl.drawArrays(gl.TRIANGLES, 0, 3);
