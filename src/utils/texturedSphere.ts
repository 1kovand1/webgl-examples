import { mat4, vec3 } from 'gl-matrix';
import initShaderProgram from './shaderProgram';

const RESOLUTION = 100;

let VBO: WebGLBuffer;
let EBO: WebGLBuffer;
let VAO: WebGLVertexArrayObject;
let cordsLength: number;
let elementsLength: number;

let programInfo: {
    program: WebGLProgram,
    attribLocations: { vertexPos: number, normal: number, i_uv: number },
    uniformLocations: {
        model: WebGLUniformLocation | null,
        camera: WebGLUniformLocation | null,
        projection: WebGLUniformLocation | null,
        lightSource: WebGLUniformLocation | null,
        ambient: WebGLUniformLocation | null,
        modelNormal: WebGLUniformLocation | null,
        viewPos: WebGLUniformLocation | null,
        sampler: WebGLUniformLocation | null,
        material: {
            ambient: WebGLUniformLocation | null,
            diffuse: WebGLUniformLocation | null,
            specular: WebGLUniformLocation | null,
            shininess: WebGLUniformLocation | null,
        }
    },
};
let blackBodyProgramInfo: {
    program: WebGLProgram,
    attribLocations: { vertexPos: number, normal: number, i_uv: number },
    uniformLocations: {
        model: WebGLUniformLocation | null,
        camera: WebGLUniformLocation | null,
        projection: WebGLUniformLocation | null,
        sampler: WebGLUniformLocation | null,
    },
};


const vsSource = `#version 300 es
    in vec3 vertexPos;
    in vec3 normal;
    in vec2 i_uv;
    out vec3 FragPos;
    out vec3 Normal;
    out vec2 uv;
    uniform mat4 model;
    uniform mat4 camera;
    uniform mat4 projection;
    uniform mat4 modelNormal;

    void main() {
        gl_Position = projection * camera * model * vec4(vertexPos, 1.0);
        FragPos = vec3(model * vec4(vertexPos, 1.0));
        Normal = normalize(mat3(modelNormal) * normal);
        uv = i_uv;
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    in vec3 FragPos;
    in vec3 Normal;
    in vec2 uv;
    out vec4 FragColor;
    uniform float ambient;
    uniform vec3 viewPos;
    uniform vec3 lightSource;
    uniform sampler2D sampler;

    struct Material {
        vec3 ambient;
        vec3 diffuse;
        vec3 specular;
        float shininess;
    };
    uniform Material material;


    void main()
    {
        vec3 lightDir = normalize(lightSource - FragPos.xyz);
        vec3 color = vec3(texture(sampler, uv));
        vec3 lightColor = vec3(1.0);
        vec3 ambient = lightColor * material.ambient;
        vec3 normal = normalize(Normal);
        vec3 viewDir = normalize(viewPos - FragPos);
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
        vec3 specular = lightColor * (spec * material.specular);

        float diff = max(dot(Normal, lightDir), 0.0);
        vec3 diffuse = diff * lightColor * material.diffuse;

        FragColor = vec4((ambient + diffuse + specular) * color, 1.0);
    }
`;

const bbfsSource = `#version 300 es
    precision highp float;
    uniform sampler2D sampler;
    in vec2 uv;
    out vec4 FragColor;
    void main()
    {
        FragColor = texture(sampler, uv);
    }
`;


function initStatic(gl: WebGL2RenderingContext) {
    const cords: Array<number> = [];
    cords.push(0, 0, -1, 0.5, 1);
    for (let i = 1; i < RESOLUTION - 1; ++i)
        for (let j = 0; j < RESOLUTION + 1; ++j) {
            const phi = j * 2 * Math.PI / RESOLUTION;
            const theta = -Math.PI / 2 + i * Math.PI / RESOLUTION;
            cords.push(Math.cos(phi) * Math.cos(theta), Math.sin(phi) * Math.cos(theta), Math.sin(theta), j / RESOLUTION, 1 - i / RESOLUTION);
        }
    cords.push(0, 0, 1, 0.5, 0);

    cordsLength = cords.length / 5;

    const indices: Array<number> = [];
    for (let j = 0; j < RESOLUTION; ++j)
        indices.push(
            j + 1,
            0,
            j + 2
        );

    for (let i = 1; i < RESOLUTION - 2; ++i)
        for (let j = 0; j < RESOLUTION; ++j)
            indices.push(
                (RESOLUTION + 1) * i + j + 1,
                (RESOLUTION + 1) * (i - 1) + j + 1,
                (RESOLUTION + 1) * i + j + 2,

                (RESOLUTION + 1) * (i - 1) + j + 1,
                (RESOLUTION + 1) * (i - 1) + j + 2,
                (RESOLUTION + 1) * i + j + 2
            );

    for (let j = 0; j < RESOLUTION; ++j)
        indices.push(
            cordsLength - j - 2,
            cordsLength - 1,
            cordsLength - j - 3
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
        attribLocations: { vertexPos: gl.getAttribLocation(shaderProgram, 'vertexPos'), normal: gl.getAttribLocation(shaderProgram, 'normal'), i_uv: gl.getAttribLocation(shaderProgram, 'i_uv') },
        uniformLocations: {
            model: gl.getUniformLocation(shaderProgram, "model"),
            camera: gl.getUniformLocation(shaderProgram, "camera"),
            projection: gl.getUniformLocation(shaderProgram, "projection"),
            lightSource: gl.getUniformLocation(shaderProgram, "lightSource"),
            ambient: gl.getUniformLocation(shaderProgram, "ambient"),
            modelNormal: gl.getUniformLocation(shaderProgram, "modelNormal"),
            viewPos: gl.getUniformLocation(shaderProgram, "viewPos"),
            sampler: gl.getUniformLocation(shaderProgram, "sampler"),
            material: {
                ambient: gl.getUniformLocation(shaderProgram, "material.ambient"),
                diffuse: gl.getUniformLocation(shaderProgram, "material.diffuse"),
                specular: gl.getUniformLocation(shaderProgram, "material.specular"),
                shininess: gl.getUniformLocation(shaderProgram, "material.shininess"),
            }
        },
    };
    const bbshaderProgram = initShaderProgram(gl, vsSource, bbfsSource);
    blackBodyProgramInfo = {
        program: bbshaderProgram,
        attribLocations: { vertexPos: gl.getAttribLocation(bbshaderProgram, 'vertexPos'), normal: gl.getAttribLocation(bbshaderProgram, 'normal'), i_uv: gl.getAttribLocation(shaderProgram, 'i_uv') },
        uniformLocations: {
            model: gl.getUniformLocation(bbshaderProgram, "model"),
            camera: gl.getUniformLocation(bbshaderProgram, "camera"),
            projection: gl.getUniformLocation(bbshaderProgram, "projection"),
            sampler: gl.getUniformLocation(bbshaderProgram, "sampler"),
        },
    };

    gl.vertexAttribPointer(blackBodyProgramInfo.attribLocations.vertexPos, 3, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(blackBodyProgramInfo.attribLocations.normal, 3, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(blackBodyProgramInfo.attribLocations.i_uv, 2, gl.FLOAT, false, 20, 12);
    gl.enableVertexAttribArray(blackBodyProgramInfo.attribLocations.vertexPos);
    gl.enableVertexAttribArray(blackBodyProgramInfo.attribLocations.normal);
    gl.enableVertexAttribArray(blackBodyProgramInfo.attribLocations.i_uv);

    gl.bindVertexArray(null);
}

interface Material {
    shininess: number,
    diffuse: vec3,
    specular: vec3,
    ambient: vec3,
}

export default class TexturedSphere {
    private readonly R: number;
    private model: mat4 = mat4.create();
    private modelNormal: mat4 = mat4.create();
    private _pos: vec3 = vec3.create();
    private texture: WebGLTexture;
    private _obliquity: number = 0;
    private _rotation: number = 0;
    constructor(gl: WebGL2RenderingContext, texture: WebGLTexture, radius: number = 1, pos: vec3 = vec3.create(), obliquity: number = 0, rotation: number = 0) {
        if (typeof VAO === "undefined")
            initStatic(gl);

        this.R = radius;
        this.pos = pos;
        this.texture = texture;
        this.obliquity = obliquity;
        this.rotation = rotation;
    }
    get rotation() {
        return this._rotation;
    }
    set rotation(value) {
        this._rotation = value;
        this.calculateModel();
    }
    get obliquity() {
        return this._obliquity;
    }
    set obliquity(value: number) {
        this._obliquity = value;
        this.calculateModel();
    }
    get pos() {
        return this._pos;
    }
    set pos(value) {
        vec3.copy(this._pos, value);
        this.calculateModel();
    }
    calculateModel() {
        mat4.fromTranslation(this.model, this._pos);
        mat4.scale(this.model, this.model, vec3.fromValues(this.R, this.R, this.R));
        mat4.rotateX(this.model, this.model, this.obliquity);
        mat4.rotateZ(this.model, this.model, this.rotation);
        mat4.transpose(this.modelNormal, this.model);
        mat4.invert(this.modelNormal, this.modelNormal);
    }
    draw(gl: WebGL2RenderingContext, camera: mat4, projection: mat4): void;
    draw(gl: WebGL2RenderingContext, camera: mat4, projection: mat4, lightSource: vec3, viewPos: vec3, ambient: number, material?: Material): void;
    draw(gl: WebGL2RenderingContext, camera: mat4, projection: mat4, lightSource?: vec3, viewPos?: vec3, ambient?: number, material?: Material): void {
        gl.bindVertexArray(VAO);
        if (lightSource !== undefined && ambient !== undefined && material !== undefined && viewPos !== undefined) {
            gl.useProgram(programInfo.program);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.uniform1i(programInfo.uniformLocations.sampler, 0);
            gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, this.model);
            gl.uniformMatrix4fv(programInfo.uniformLocations.camera, false, camera);
            gl.uniformMatrix4fv(programInfo.uniformLocations.projection, false, projection);
            gl.uniformMatrix4fv(programInfo.uniformLocations.modelNormal, false, this.modelNormal);
            gl.uniform3fv(programInfo.uniformLocations.lightSource, lightSource);
            gl.uniform3fv(programInfo.uniformLocations.viewPos, viewPos);
            gl.uniform1f(programInfo.uniformLocations.ambient, ambient);

            gl.uniform3fv(programInfo.uniformLocations.material.ambient, material.ambient);
            gl.uniform3fv(programInfo.uniformLocations.material.diffuse, material.diffuse);
            gl.uniform3fv(programInfo.uniformLocations.material.specular, material.specular);
            gl.uniform1f(programInfo.uniformLocations.material.shininess, material.shininess);
        }
        else {
            gl.useProgram(blackBodyProgramInfo.program);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.uniform1i(blackBodyProgramInfo.uniformLocations.sampler, 0);
            gl.uniformMatrix4fv(blackBodyProgramInfo.uniformLocations.model, false, this.model);
            gl.uniformMatrix4fv(blackBodyProgramInfo.uniformLocations.camera, false, camera);
            gl.uniformMatrix4fv(blackBodyProgramInfo.uniformLocations.projection, false, projection);
        }

        gl.drawElements(gl.TRIANGLES, elementsLength, gl.UNSIGNED_SHORT, 0);

        gl.bindVertexArray(null);

    }
}