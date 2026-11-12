import { mat4, vec3, vec4 } from 'gl-matrix';
import initShaderProgram from '../shaderProgram';
import type Material from '../../interfaces/material';

const RESOLUTION = 100;

let VBO: WebGLBuffer;
let EBO: WebGLBuffer;
let VAO: WebGLVertexArrayObject;
let cordsLength: number;
let elementsLength: number;

let programInfo: {
    program: WebGLProgram,
    attribLocations: { vertexPos: number, normal: number },
    uniformLocations: {
        model: WebGLUniformLocation | null,
        view: WebGLUniformLocation | null,
        projection: WebGLUniformLocation | null,
        lightSource1: WebGLUniformLocation | null,
        lightSource2: WebGLUniformLocation | null,
        ambient: WebGLUniformLocation | null,
        viewPos: WebGLUniformLocation | null,
        color: WebGLUniformLocation | null,
        material: {
            ambient: WebGLUniformLocation | null,
            diffuse: WebGLUniformLocation | null,
            specular: WebGLUniformLocation | null,
            shininess: WebGLUniformLocation | null,
        }
        clipSurface: WebGLUniformLocation | null,
        enableClipping: WebGLUniformLocation | null,
    },
};
let blackBodyProgramInfo: {
    program: WebGLProgram,
    attribLocations: { vertexPos: number, normal: number },
    uniformLocations: {
        model: WebGLUniformLocation | null,
        view: WebGLUniformLocation | null,
        projection: WebGLUniformLocation | null,
        color: WebGLUniformLocation | null,
        clipSurface: WebGLUniformLocation | null,
        enableClipping: WebGLUniformLocation | null,
    },
};

const vsSource = `#version 300 es
    in vec3 vertexPos;
    in vec3 normal;
    out vec3 FragPos;
    out vec3 Normal;
    uniform mat4 model;
    uniform mat4 view;
    uniform mat4 projection;


    void main() {
        gl_Position = projection * view * model * vec4(vertexPos, 1.0);
        FragPos = vec3(view * model * vec4(vertexPos, 1.0));
        Normal = normal;
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    in vec3 FragPos;
    in vec3 Normal;
    out vec4 FragColor;
    uniform float ambient;
    uniform vec3 viewPos;
    uniform vec3 color;
    uniform vec3 lightSource1;
    uniform vec3 lightSource2;
    uniform bool enableClipping;
    uniform vec4 clipSurface;

    struct Material {
        vec3 ambient;
        vec3 diffuse;
        vec3 specular;
        float shininess;
    };
    uniform Material material;

    vec3 calculateLight(vec3 lightSource, vec3 FragPos) {
        vec3 lightDir = normalize(lightSource - FragPos);

        vec3 lightColor = vec3(1.0);
        vec3 ambient = lightColor * material.ambient;
        vec3 normal = normalize(Normal);
        vec3 viewDir = normalize(viewPos - FragPos);
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
        vec3 specular = lightColor * (spec * material.specular);

        float diff = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diff * lightColor * material.diffuse;

        return diffuse + specular;
    }

    void main()
    {
        if (enableClipping && dot(FragPos, clipSurface.xyz) <= -clipSurface.w)
            discard;
        vec3 light = calculateLight(lightSource1, FragPos);
        if (!isnan(lightSource2.x)) {
            light += calculateLight(lightSource2, FragPos);
        }
        FragColor = vec4((ambient + light) * color, 1.0);
    }
`;

const bbfsSource = `#version 300 es
    precision highp float;
    in vec3 FragPos;
    uniform vec3 color;
    uniform bool enableClipping;
    uniform vec4 clipSurface;
    out vec4 FragColor;
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
        attribLocations: { vertexPos: gl.getAttribLocation(shaderProgram, 'vertexPos'), normal: gl.getAttribLocation(shaderProgram, "normal") },
        uniformLocations: {
            model: gl.getUniformLocation(shaderProgram, "model"),
            view: gl.getUniformLocation(shaderProgram, "view"),
            projection: gl.getUniformLocation(shaderProgram, "projection"),
            lightSource1: gl.getUniformLocation(shaderProgram, "lightSource1"),
            lightSource2: gl.getUniformLocation(shaderProgram, "lightSource2"),
            ambient: gl.getUniformLocation(shaderProgram, "ambient"),
            viewPos: gl.getUniformLocation(shaderProgram, "viewPos"),
            color: gl.getUniformLocation(shaderProgram, "color"),
            material: {
                ambient: gl.getUniformLocation(shaderProgram, "material.ambient"),
                diffuse: gl.getUniformLocation(shaderProgram, "material.diffuse"),
                specular: gl.getUniformLocation(shaderProgram, "material.specular"),
                shininess: gl.getUniformLocation(shaderProgram, "material.shininess"),
            },
            enableClipping: gl.getUniformLocation(shaderProgram, "enableClipping"),
            clipSurface: gl.getUniformLocation(shaderProgram, "clipSurface"),
        },
    };

    gl.vertexAttribPointer(programInfo.attribLocations.vertexPos, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribPointer(programInfo.attribLocations.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPos);
    gl.enableVertexAttribArray(programInfo.attribLocations.normal);

    const bbshaderProgram = initShaderProgram(gl, vsSource, bbfsSource);
    blackBodyProgramInfo = {
        program: bbshaderProgram,
        attribLocations: { vertexPos: gl.getAttribLocation(bbshaderProgram, 'vertexPos'), normal: gl.getAttribLocation(bbshaderProgram, 'normal') },
        uniformLocations: {
            model: gl.getUniformLocation(bbshaderProgram, "model"),
            view: gl.getUniformLocation(bbshaderProgram, "view"),
            projection: gl.getUniformLocation(bbshaderProgram, "projection"),
            color: gl.getUniformLocation(bbshaderProgram, "color"),
            enableClipping: gl.getUniformLocation(bbshaderProgram, "enableClipping"),
            clipSurface: gl.getUniformLocation(bbshaderProgram, "clipSurface"),
        },
    };

    gl.vertexAttribPointer(blackBodyProgramInfo.attribLocations.vertexPos, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribPointer(blackBodyProgramInfo.attribLocations.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(blackBodyProgramInfo.attribLocations.vertexPos);
    gl.enableVertexAttribArray(blackBodyProgramInfo.attribLocations.normal);

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
    draw(gl: WebGL2RenderingContext, view: mat4, projection: mat4, color: vec3, clipSurface?: vec4): void;
    draw(gl: WebGL2RenderingContext, view: mat4, projection: mat4, color: vec3, clipSurface: vec4 | undefined, lightSource1: vec3, lightSource2: vec3 | undefined, viewPos: vec3, ambient: number, material?: Material): void;
    draw(gl: WebGL2RenderingContext, view: mat4, projection: mat4, color: vec3, clipSurface: vec4 | undefined, lightSource1?: vec3, lightSource2?: vec3, viewPos?: vec3, ambient?: number, material?: Material): void {
        gl.bindVertexArray(VAO);
        if (lightSource1 !== undefined && ambient !== undefined && material !== undefined && viewPos !== undefined) {
            gl.useProgram(programInfo.program);

            gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, this.model);
            gl.uniformMatrix4fv(programInfo.uniformLocations.view, false, view);
            gl.uniformMatrix4fv(programInfo.uniformLocations.projection, false, projection);
            gl.uniform3fv(programInfo.uniformLocations.lightSource1, lightSource1);
            if (lightSource2 === undefined)
                gl.uniform3fv(programInfo.uniformLocations.lightSource2, [NaN, NaN, NaN]);
            else
                gl.uniform3fv(programInfo.uniformLocations.lightSource2, lightSource2);
            gl.uniform3fv(programInfo.uniformLocations.viewPos, viewPos);
            gl.uniform1f(programInfo.uniformLocations.ambient, ambient);
            gl.uniform3fv(programInfo.uniformLocations.color, color);
            if (clipSurface === undefined)
                gl.uniform1i(programInfo.uniformLocations.enableClipping, 0);
            else {
                gl.uniform1i(programInfo.uniformLocations.enableClipping, 1);
                gl.uniform4fv(programInfo.uniformLocations.clipSurface, clipSurface);
            }

            gl.uniform3fv(programInfo.uniformLocations.material.ambient, material.ambient);
            gl.uniform3fv(programInfo.uniformLocations.material.diffuse, material.diffuse);
            gl.uniform3fv(programInfo.uniformLocations.material.specular, material.specular);
            gl.uniform1f(programInfo.uniformLocations.material.shininess, material.shininess);
        }
        else {
            gl.useProgram(blackBodyProgramInfo.program);

            gl.uniformMatrix4fv(blackBodyProgramInfo.uniformLocations.model, false, this.model);
            gl.uniformMatrix4fv(blackBodyProgramInfo.uniformLocations.view, false, view);
            gl.uniformMatrix4fv(blackBodyProgramInfo.uniformLocations.projection, false, projection);
            gl.uniform3fv(blackBodyProgramInfo.uniformLocations.color, color);
            if (clipSurface === undefined)
                gl.uniform1i(blackBodyProgramInfo.uniformLocations.enableClipping, 0);
            else {
                gl.uniform1i(blackBodyProgramInfo.uniformLocations.enableClipping, 1);
                gl.uniform4fv(blackBodyProgramInfo.uniformLocations.clipSurface, clipSurface);
            }
        }

        gl.drawElements(gl.TRIANGLES, elementsLength, gl.UNSIGNED_SHORT, 0);

        gl.bindVertexArray(null);

    }
}