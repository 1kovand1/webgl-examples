import { mat3, mat4, vec3 } from "gl-matrix";
import initShaderProgram from "../shaderProgram";
import type Material from "../../interfaces/material";

const vsSource = `#version 300 es
    layout(location = 0) in vec3 vertexPos;
    layout(location = 1) in vec3 normal;
    layout(location = 2) in vec2 i_uv;
    out vec3 FragPos;
    out vec3 Normal;
    out vec2 uv;
    uniform mat4 model;
    uniform mat4 view;
    uniform mat4 projection;
    uniform mat3 modelNormal;

    void main() {
        gl_Position = projection * view * model * vec4(vertexPos, 1.0);
        FragPos = vec3(model * vec4(vertexPos, 1.0));
        Normal = normalize(modelNormal * normal);
        uv = i_uv;
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    precision highp samplerCubeShadow;
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
        vec3 lightDir = normalize(lightSource - FragPos);
        vec4 color4 = texture(sampler, uv);
        if (color4.a == 0.)
            discard;
        vec3 color = color4.rgb;
        vec3 lightColor = vec3(1.0);
        vec3 ambient = lightColor * material.ambient;
        vec3 normal = Normal;
        if (!gl_FrontFacing)
            normal = -normal;
        vec3 viewDir = normalize(viewPos - FragPos);
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
        vec3 specular = lightColor * (spec * material.specular);

        float diff = max(dot(normal, lightDir), 0.0);
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

const RESOLUTION = 100;

export default class Ring {
    private _R: number;
    private VAO;
    private model: mat4 = mat4.create();
    private modelNormal: mat3 = mat3.create();
    private _pos: vec3 = vec3.create();
    private texture: WebGLTexture;
    private _obliquity;
    private programInfo;
    private blackBodyProgramInfo;
    constructor(gl: WebGL2RenderingContext, r: number, R: number, pos: vec3, texture: WebGLTexture, obliquity: number) {
        this.texture = texture;
        this._R = R;
        this._pos = pos;
        this._obliquity = obliquity;
        this.VAO = gl.createVertexArray();

        const cords: Array<number> = [];
        for (let i = 0; i < RESOLUTION; ++i) {
            const phi = i * 2 * Math.PI / (RESOLUTION - 1);
            cords.push(r * Math.sin(phi), r * Math.cos(phi), 0, 0, i / (RESOLUTION - 1));
        }

        for (let i = 0; i < RESOLUTION; ++i) {
            const phi = i / (RESOLUTION - 1) * 2 * Math.PI;
            cords.push(Math.sin(phi), Math.cos(phi), 0, 1, i / (RESOLUTION - 1));
        }

        const indices: Array<number> = [];
        for (let i = 0; i < RESOLUTION; ++i)
            indices.push(
                i, i + RESOLUTION, i + 1,
                i + 1, i + RESOLUTION, i + RESOLUTION + 1
            );

        gl.bindVertexArray(this.VAO);
        const VBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, VBO);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cords), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 5 * 4, 0);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(2);
        gl.vertexAttrib3f(1, 0, 0, -1);

        const EBO = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, EBO);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
        this.programInfo = {
            program: shaderProgram,
            uniformLocations: {
                model: gl.getUniformLocation(shaderProgram, "model"),
                view: gl.getUniformLocation(shaderProgram, "view"),
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
        this.blackBodyProgramInfo = {
            program: bbshaderProgram,
            attribLocations: { vertexPos: gl.getAttribLocation(bbshaderProgram, 'vertexPos'), normal: gl.getAttribLocation(bbshaderProgram, 'normal'), i_uv: gl.getAttribLocation(shaderProgram, 'i_uv') },
            uniformLocations: {
                model: gl.getUniformLocation(bbshaderProgram, "model"),
                view: gl.getUniformLocation(bbshaderProgram, "view"),
                projection: gl.getUniformLocation(bbshaderProgram, "projection"),
                sampler: gl.getUniformLocation(bbshaderProgram, "sampler"),
            },
        };
        this.calculateModel();
    }
    calculateModel() {
        mat4.fromTranslation(this.model, this._pos);
        mat4.scale(this.model, this.model, vec3.fromValues(this._R, this._R, this._R));
        mat4.rotateX(this.model, this.model, this._obliquity);
        mat3.fromMat4(this.modelNormal, this.model);
        mat3.transpose(this.modelNormal, this.modelNormal);
        mat3.invert(this.modelNormal, this.modelNormal);
    }
    get R() {
        return this._R;
    }
    set R(value) {
        this._R = value;
        this.calculateModel();
    }
    get obliquity() {
        return this._obliquity;
    }
    set obliquity(value) {
        this._obliquity = value;
        this.calculateModel();
    }
    get pos() {
        return this._pos;
    }
    set pos(value) {
        this._pos = value;
        this.calculateModel();
    }
    draw(gl: WebGL2RenderingContext, view: mat4, projection: mat4): void;
        draw(gl: WebGL2RenderingContext, view: mat4, projection: mat4, lightSource: vec3, viewPos: vec3, ambient: number, material?: Material): void;
        draw(gl: WebGL2RenderingContext, view: mat4, projection: mat4, lightSource?: vec3, viewPos?: vec3, ambient?: number, material?: Material): void {
            gl.bindVertexArray(this.VAO);
            if (lightSource !== undefined && ambient !== undefined && material !== undefined && viewPos !== undefined) {
                gl.useProgram(this.programInfo.program);
    
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                gl.uniform1i(this.programInfo.uniformLocations.sampler, 0);
    
                gl.uniformMatrix4fv(this.programInfo.uniformLocations.model, false, this.model);
                gl.uniformMatrix4fv(this.programInfo.uniformLocations.view, false, view);
                gl.uniformMatrix4fv(this.programInfo.uniformLocations.projection, false, projection);
                gl.uniformMatrix3fv(this.programInfo.uniformLocations.modelNormal, false, this.modelNormal);
                gl.uniform3fv(this.programInfo.uniformLocations.lightSource, lightSource);
                gl.uniform3fv(this.programInfo.uniformLocations.viewPos, viewPos);
                gl.uniform1f(this.programInfo.uniformLocations.ambient, ambient);
    
                gl.uniform3fv(this.programInfo.uniformLocations.material.ambient, material.ambient);
                gl.uniform3fv(this.programInfo.uniformLocations.material.diffuse, material.diffuse);
                gl.uniform3fv(this.programInfo.uniformLocations.material.specular, material.specular);
                gl.uniform1f(this.programInfo.uniformLocations.material.shininess, material.shininess);
            }
            else {
                gl.useProgram(this.blackBodyProgramInfo.program);
    
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
                gl.uniform1i(this.blackBodyProgramInfo.uniformLocations.sampler, 0);
                gl.uniformMatrix4fv(this.blackBodyProgramInfo.uniformLocations.model, false, this.model);
                gl.uniformMatrix4fv(this.blackBodyProgramInfo.uniformLocations.view, false, view);
                gl.uniformMatrix4fv(this.blackBodyProgramInfo.uniformLocations.projection, false, projection);
            }
    
            gl.drawElements(gl.TRIANGLES, 6 * RESOLUTION, gl.UNSIGNED_SHORT, 0);
    
            gl.bindVertexArray(null);
    
        }
}