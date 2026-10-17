export { };
document.title = "Текстура";
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
    in vec2 texturePos;
    out vec2 TexturePos;
    void main() {
        gl_Position = vec4(vertexPos, 1.0);
        TexturePos = texturePos;
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    in vec2 TexturePos;
    uniform sampler2D uSampler;
    out vec4 fragColor;
    void main() {
        fragColor = texture(uSampler, TexturePos);
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

const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
const programInfo = {
    program: shaderProgram,
    attribLocations: {
        vertexPos: gl.getAttribLocation(shaderProgram, "vertexPos"),
        texturePos: gl.getAttribLocation(shaderProgram, "texturePos")
    },
    uniformLocations: {
        uSampler: gl.getUniformLocation(shaderProgram, "uSampler")
    }
};

const vertices = new Float32Array([
    0.5, 0.5, 0, 1, 1,
    0.5, -0.5, 0, 1, 0,
    -0.5, 0.5, 0, 0, 1,

    0.5, -0.5, 0, 1, 0,
    -0.5, 0.5, 0, 0, 1,
    -0.5, -0.5, 0, 0, 0
]);

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
const texture = await loadTexture(gl, "./nether_core.png");
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

gl.enableVertexAttribArray(programInfo.attribLocations.vertexPos);
gl.vertexAttribPointer(programInfo.attribLocations.vertexPos, 3, gl.FLOAT, false, 5 * 4, 0);
gl.enableVertexAttribArray(programInfo.attribLocations.texturePos);
gl.vertexAttribPointer(programInfo.attribLocations.texturePos, 2, gl.FLOAT, false, 5 * 4, 3 * 4);

gl.clearColor(0.1, 0.1, 0.1, 1.0);

gl.useProgram(programInfo.program);
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

gl.drawArrays(gl.TRIANGLES, 0, 6);