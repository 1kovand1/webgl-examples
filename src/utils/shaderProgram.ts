
export default function initShaderProgram(
    gl: WebGL2RenderingContext,
    vsSource: string,
    fsSource: string
): WebGLProgram {
    function loadShader(type: number, source: string): WebGLShader {
        const shader = gl.createShader(type);
        if (!shader) {
            throw new Error("Could not create shader");
        }

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compilation failed:\n${log}`);
        }

        return shader;
    }

    const vs = loadShader(gl.VERTEX_SHADER, vsSource);
    const fs = loadShader(gl.FRAGMENT_SHADER, fsSource);

    const program = gl.createProgram();

    if (!program) {
        throw new Error("Could not create program");
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        throw new Error(`Program linking failed:\n${log}`);
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    return program;
}
