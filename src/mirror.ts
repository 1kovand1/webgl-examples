export { };
import { mat4, vec2, vec3 } from "gl-matrix";
import { cameraCords, getWorldToCameraMatrix, processInput, reflect } from "./utils/camera"
import Sphere from "./utils/sphere";
import "./assets/controls.css"
import { drawMirror, mirrorfb, createMirrorCamera, mirrorWidth, mirrorHeight } from "./utils/mirror";
document.title = "Зеркало";

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;

const gl = canvas.getContext('webgl2');

if (!gl) {
    throw new Error('WebGL 2 не поддерживается вашим браузером');
}

canvas.insertAdjacentHTML("beforebegin", `
    <div id="sliders" class="controls">
        <label> <input id="rangeD" type="range" min="0" max="255">Diffuse</label>
        <label> <input id="rangeSh" type="range" min="0" max="255">Shininess</label>
        <label> <input id="rangeSp" type="range" min="0" max="255">Specular</label>
        <label> <input id="rangeA" type="range" min="0" max="255">Ambient</label>
    </div>
`);

const rangeD = document.getElementById("rangeD") as HTMLInputElement;
const rangeSh = document.getElementById("rangeSh") as HTMLInputElement;
const rangeSp = document.getElementById("rangeSp") as HTMLInputElement;
const rangeA = document.getElementById("rangeA") as HTMLInputElement;

function resizeCanvas(canvas: HTMLCanvasElement) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas( canvas);
window.addEventListener('resize', () => resizeCanvas(canvas));

gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LESS);

gl.enable(gl.CULL_FACE);
gl.cullFace(gl.BACK);

const lightPos = vec3.fromValues(3, 3, 3);

const light = new Sphere(gl, 1, lightPos);
const sphere = new Sphere(gl);
const sphere2 = new Sphere(gl, 1, vec3.fromValues(0, -1, 2));

const mirrorPos = vec3.fromValues(0, 0, -5);
const mirrorNorm = vec3.fromValues(0, 0, -1);

const mirrorSize = vec2.fromValues(10,10);

let time: DOMHighResTimeStamp;
function render(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, timestamp: DOMHighResTimeStamp) {
    if (time === undefined)
        time = timestamp;
    const dt = timestamp - time;
    time = timestamp;
    processInput(dt);

    gl.bindFramebuffer(gl.FRAMEBUFFER, mirrorfb);
    gl.viewport(0, 0, mirrorWidth, mirrorHeight);


    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    reflect(mirrorPos, mirrorNorm); 

    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, Math.PI / 3, canvas.width / canvas.height, 0.1, 100.0);
    mat4.multiply(projectionMatrix, createMirrorCamera(mirrorPos, mirrorNorm, getWorldToCameraMatrix(), projectionMatrix, mirrorSize), projectionMatrix);

    gl.cullFace(gl.FRONT);

    light.draw(gl, getWorldToCameraMatrix(), projectionMatrix);
    sphere.draw(gl, getWorldToCameraMatrix(), projectionMatrix, lightPos, cameraCords, 0.5, {
        shininess: +rangeSh.value,
        ambient: vec3.fromValues(+rangeA.value / 255, +rangeA.value / 255, +rangeA.value / 255),
        diffuse: vec3.fromValues(+rangeD.value / 255, +rangeD.value / 255, +rangeD.value / 255),
        specular: vec3.fromValues(+rangeSp.value / 255, +rangeSp.value / 255, +rangeSp.value / 255),
    });
    sphere2.draw(gl, getWorldToCameraMatrix(), projectionMatrix, lightPos, cameraCords, 0.5, {
        shininess: +rangeSh.value,
        ambient: vec3.fromValues(+rangeA.value / 255, +rangeA.value / 255, +rangeA.value / 255),
        diffuse: vec3.fromValues(+rangeD.value / 255, +rangeD.value / 255, +rangeD.value / 255),
        specular: vec3.fromValues(+rangeSp.value / 255, +rangeSp.value / 255, +rangeSp.value / 255),
    });


    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    reflect(mirrorPos, mirrorNorm);
    gl.cullFace(gl.BACK);

    

    mat4.perspective(projectionMatrix, Math.PI / 3, canvas.width / canvas.height, 0.1, 100.0);
    drawMirror(mirrorPos, mirrorNorm, getWorldToCameraMatrix(), projectionMatrix, mirrorSize, lightPos, cameraCords);
    light.draw(gl, getWorldToCameraMatrix(), projectionMatrix);
    sphere.draw(gl, getWorldToCameraMatrix(), projectionMatrix, lightPos, cameraCords, 0.5, {
        shininess: +rangeSh.value,
        ambient: vec3.fromValues(+rangeA.value / 255, +rangeA.value / 255, +rangeA.value / 255),
        diffuse: vec3.fromValues(+rangeD.value / 255, +rangeD.value / 255, +rangeD.value / 255),
        specular: vec3.fromValues(+rangeSp.value / 255, +rangeSp.value / 255, +rangeSp.value / 255),
    });
    sphere2.draw(gl, getWorldToCameraMatrix(), projectionMatrix, lightPos, cameraCords, 0.5, {
        shininess: +rangeSh.value,
        ambient: vec3.fromValues(+rangeA.value / 255, +rangeA.value / 255, +rangeA.value / 255),
        diffuse: vec3.fromValues(+rangeD.value / 255, +rangeD.value / 255, +rangeD.value / 255),
        specular: vec3.fromValues(+rangeSp.value / 255, +rangeSp.value / 255, +rangeSp.value / 255),
    });


    requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
}

requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
