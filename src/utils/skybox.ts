import type { mat4 } from "gl-matrix";
import { loadCubeTexture } from "./loadTexture";
import initShaderProgram from "./shaderProgram";

const vsSource = `#version 300 es
    precision highp float;
    layout (location = 0) in vec3 aPos;
    out vec3 TexCoords;
    uniform mat4 projection;
    uniform mat4 view;
    void main()
    {
        TexCoords = aPos;
        vec4 pos = projection * mat4(mat3(view)) * vec4(aPos, 1.0);
        gl_Position = pos.xyww;
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    out vec4 FragColor;
    in vec3 TexCoords;
    uniform samplerCube skybox;
    void main()
    {
        FragColor = texture(skybox, TexCoords);
    }
`;

let vao: WebGLVertexArrayObject;
let texture: WebGLTexture;
let programInfo: {
    program: WebGLProgram,
    uniformLocations: {
        projection: WebGLUniformLocation | null,
        view: WebGLUniformLocation | null,
        skybox: WebGLUniformLocation | null,
    }
}

export async function initSkybox(gl: WebGL2RenderingContext) {
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

    const skyboxVertices = [   
        -1.0, 1.0, -1.0,
        -1.0, -1.0, -1.0,
        1.0, -1.0, -1.0,
        1.0, -1.0, -1.0,
        1.0, 1.0, -1.0,
        -1.0, 1.0, -1.0,

        -1.0, -1.0, 1.0,
        -1.0, -1.0, -1.0,
        -1.0, 1.0, -1.0,
        -1.0, 1.0, -1.0,
        -1.0, 1.0, 1.0,
        -1.0, -1.0, 1.0,

        1.0, -1.0, -1.0,
        1.0, -1.0, 1.0,
        1.0, 1.0, 1.0,
        1.0, 1.0, 1.0,
        1.0, 1.0, -1.0,
        1.0, -1.0, -1.0,

        -1.0, -1.0, 1.0,
        -1.0, 1.0, 1.0,
        1.0, 1.0, 1.0,
        1.0, 1.0, 1.0,
        1.0, -1.0, 1.0,
        -1.0, -1.0, 1.0,

        -1.0, 1.0, -1.0,
        1.0, 1.0, -1.0,
        1.0, 1.0, 1.0,
        1.0, 1.0, 1.0,
        -1.0, 1.0, 1.0,
        -1.0, 1.0, -1.0,

        -1.0, -1.0, -1.0,
        -1.0, -1.0, 1.0,
        1.0, -1.0, -1.0,
        1.0, -1.0, -1.0,
        -1.0, -1.0, 1.0,
        1.0, -1.0, 1.0
    ];

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(skyboxVertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    texture = await loadCubeTexture(gl, "./textures/skybox");
    
    programInfo = {
        program: shaderProgram,
        uniformLocations: {
            projection: gl.getUniformLocation(shaderProgram, "projection"),
            view: gl.getUniformLocation(shaderProgram, "view"),
            skybox: gl.getUniformLocation(shaderProgram, "skybox")
        }
    };
}

export function drawSkybox(gl: WebGL2RenderingContext, view: mat4, projection: mat4) {
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projection, false, projection);
    gl.uniformMatrix4fv(programInfo.uniformLocations.view, false, view);
    gl.uniform1i(programInfo.uniformLocations.skybox, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
}