import { mat4, vec3, vec4 } from 'gl-matrix';
import initShaderProgram from './shaderProgram';

const RESOLUTION = 100;

let VBO: WebGLBuffer;
let EBO: WebGLBuffer;
let VAO: WebGLVertexArrayObject;
let cordsLength: number;
let elementsLength: number;

let programInfo: {
    program: WebGLProgram,
    attribLocations: { vertexPos: number },
    uniformLocations: {
        model: WebGLUniformLocation | null,
        camera: WebGLUniformLocation | null,
        projection: WebGLUniformLocation | null,
        color: WebGLUniformLocation | null,
        clipSurface: WebGLUniformLocation | null,
        enableClipping: WebGLUniformLocation | null,
    }
};


const vsSource = `#version 300 es
    in vec3 vertexPos;
    out vec3 FragPos;
    uniform mat4 model;
    uniform mat4 camera;
    uniform mat4 projection;

    void main() {
        gl_Position = projection * camera * model * vec4(vertexPos, 1.0);
        FragPos = vec3(camera * model * vec4(vertexPos, 1.0));
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    in vec3 FragPos;
    out vec4 FragColor;
    uniform vec3 viewPos;
    uniform vec3 color;
    uniform vec4 clipSurface;
    uniform bool enableClipping;

    void main()
    {
        if (enableClipping && dot(FragPos, clipSurface.xyz) <= -clipSurface.w)
            discard;
        FragColor = vec4(color, 1.0);
    }
`;


function initStatic(gl: WebGL2RenderingContext) {
    const cords: Array<number> = [];
    cords.push(0, 0, -1);
    for (let i = 1; i < RESOLUTION - 1; ++i)
        for (let j = 0; j < RESOLUTION; ++j) {
            const phi = j * 2 * Math.PI / RESOLUTION;
            const theta = -Math.PI / 2 + i * Math.PI / (RESOLUTION - 1);
            cords.push(Math.cos(phi) * Math.cos(theta), Math.sin(phi) * Math.cos(theta), Math.sin(theta));
        }
    cords.push(0, 0, 1);

    cordsLength = cords.length;

    const indices: Array<number> = [];
    for (let j = 0; j < RESOLUTION; ++j)
        indices.push(
            j + 1,
            0,
            j < RESOLUTION - 1 ? j + 2 : 1
        );

    for (let i = 1; i < RESOLUTION - 2; ++i)
        for (let j = 0; j < RESOLUTION; ++j)
            indices.push(
                RESOLUTION * i + j + 1,
                RESOLUTION * (i - 1) + j + 1,
                j < RESOLUTION - 1 ? RESOLUTION * i + j + 2 : RESOLUTION * i + 1,

                RESOLUTION * (i - 1) + j + 1,
                j < RESOLUTION - 1 ? RESOLUTION * (i - 1) + j + 2 : RESOLUTION * (i - 1) + 1,
                j < RESOLUTION - 1 ? RESOLUTION * i + j + 2 : RESOLUTION * i + 1
            );

    for (let j = 0; j < RESOLUTION; ++j)
        indices.push(
            cordsLength / 3 - j - 2,
            cordsLength / 3 - 1,
            j < RESOLUTION - 1 ? cordsLength / 3 - j - 3 : cordsLength / 3 - 2
        );

    elementsLength = indices.length;
    VAO = gl.createVertexArray();
    gl.bindVertexArray(VAO);
    VBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, VBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cords), gl.STATIC_DRAW);

    EBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, EBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    programInfo = {
        program: shaderProgram,
        attribLocations: { vertexPos: gl.getAttribLocation(shaderProgram, 'vertexPos') },
        uniformLocations: {
            model: gl.getUniformLocation(shaderProgram, "model"),
            camera: gl.getUniformLocation(shaderProgram, "camera"),
            projection: gl.getUniformLocation(shaderProgram, "projection"),
            clipSurface: gl.getUniformLocation(shaderProgram, "clipSurface"),
            color: gl.getUniformLocation(shaderProgram, "color"),
            enableClipping: gl.getUniformLocation(shaderProgram, "enableClipping"),
        },
    };

    gl.vertexAttribPointer(programInfo.attribLocations.vertexPos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPos);

    gl.bindVertexArray(null);
}

export default class ClippableSphere {
    R: number;
    model: mat4 = mat4.create();
    _pos: vec3 = vec3.create();
    constructor(gl: WebGL2RenderingContext, radius: number = 1, pos: vec3 = vec3.create()) {
        if (typeof VAO === "undefined")
            initStatic(gl);

        this.R = radius;
        this.pos = pos;
    }
    get pos() {
        return this._pos;
    }
    set pos(value) {
        vec3.copy(this._pos, value);
        mat4.fromTranslation(this.model, value);
        mat4.scale(this.model, this.model, vec3.fromValues(this.R, this.R, this.R))
    }
    draw(gl: WebGL2RenderingContext, camera: mat4, projection: mat4, color: vec3, clipSurface: vec4 | null = null): void {
        gl.bindVertexArray(VAO);
        gl.useProgram(programInfo.program);

        gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, this.model);
        gl.uniformMatrix4fv(programInfo.uniformLocations.camera, false, camera);
        gl.uniformMatrix4fv(programInfo.uniformLocations.projection, false, projection);
        gl.uniform3fv(programInfo.uniformLocations.color, color);
        if (clipSurface === null)
            gl.uniform1i(programInfo.uniformLocations.enableClipping, 0);
        else {
            gl.uniform1i(programInfo.uniformLocations.enableClipping, 1);
            gl.uniform4fv(programInfo.uniformLocations.clipSurface, clipSurface);
        }

        gl.drawElements(gl.TRIANGLES, elementsLength, gl.UNSIGNED_SHORT, 0);

        gl.bindVertexArray(null);

    }
}