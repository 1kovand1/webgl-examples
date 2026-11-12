export { };
import { mat4, vec2, vec3 } from "gl-matrix";
import { cameraCords, getWorldToCameraMatrix, processInput, reflect } from "./utils/camera"
import "./assets/controls.css"
import { drawMirror, mirrorfb, mirrorWidth, mirrorHeight, getSurface } from "./utils/models/mirror";
import ClippableSphere from "./utils/models/clippableSphere";
document.title = "Зеркало";

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;

const gl = canvas.getContext('webgl2');

if (!gl) {
    throw new Error('WebGL 2 не поддерживается вашим браузером');
}

canvas.insertAdjacentHTML("beforebegin", `
    <div class="controls">
        <button id="clipButton" style="background: mediumseagreen;">Выключить отсечение плоскостью зеркала</button>
    </div>
`);
let clipEnabled = true;
const clipButton = document.getElementById("clipButton") as HTMLButtonElement;
clipButton.addEventListener("click", () => {
    if (clipEnabled) {
        clipButton.style.background = "lightcoral";
        clipButton.innerText = "Включить отсечение плоскостью зеркала";
        clipEnabled = false;
    }
    else {
        clipButton.style.background = "mediumseagreen";
        clipButton.innerText = "Выключить отсечение плоскостью зеркала";
        clipEnabled = true;
    }
});

function resizeCanvas(canvas: HTMLCanvasElement) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas(canvas);
window.addEventListener('resize', () => resizeCanvas(canvas));

gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LESS);

gl.enable(gl.CULL_FACE);
gl.cullFace(gl.BACK);

const lightPos = vec3.fromValues(5, 1, 7);

const lightSource = new ClippableSphere(gl, 1, lightPos);
const sphere = new ClippableSphere(gl);
const sphere2 = new ClippableSphere(gl, 1, vec3.fromValues(0, 3, 5));
const sphere3 = new ClippableSphere(gl, 1, vec3.fromValues(0, -1, -7));

const mirrorPos = vec3.fromValues(0, 0, -5);
const mirrorNorm = vec3.fromValues(0, 0, -1);

const mirrorSize = vec2.fromValues(10, 10);

const mirroredLightPos = vec3.create();
vec3.sub(mirroredLightPos, lightPos, mirrorPos);
const proj = vec3.dot(mirroredLightPos, mirrorNorm);
vec3.scaleAndAdd(mirroredLightPos, lightPos, mirrorNorm, -2 * proj);

const red = vec3.fromValues(1, 0, 0);
const green = vec3.fromValues(0, 1, 0);
const blue = vec3.fromValues(0, 0, 1);
const white = vec3.fromValues(1,1,1);

gl.stencilFunc(gl.EQUAL, 1, 0xFF);

let time: DOMHighResTimeStamp;
const projectionMatrix = mat4.create();
function render(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, timestamp: DOMHighResTimeStamp) {
    if (time === undefined)
        time = timestamp;
    mat4.perspective(projectionMatrix, Math.PI / 3, canvas.width / canvas.height, 0.1, 100.0);

    const dt = timestamp - time;
    time = timestamp;
    processInput(dt);

    gl.bindFramebuffer(gl.FRAMEBUFFER, mirrorfb);
    gl.viewport(0, 0, mirrorWidth, mirrorHeight);

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    reflect(mirrorPos, mirrorNorm);

    gl.frontFace(gl.CW);
    gl.enable(gl.STENCIL_TEST);
    gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE)

    drawMirror(mirrorPos, mirrorNorm, getWorldToCameraMatrix(), projectionMatrix, mirrorSize, true);

    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

    const clipSurface = clipEnabled ? getSurface(mirrorPos, mirrorNorm, getWorldToCameraMatrix(), mirrorSize) : undefined;

    lightSource.draw(gl, getWorldToCameraMatrix(), projectionMatrix, white, clipSurface);
    sphere.draw(gl, getWorldToCameraMatrix(), projectionMatrix, red, clipSurface, lightPos, mirroredLightPos, cameraCords, 0.2, {
        shininess: 32,
        ambient: vec3.fromValues(0.5, 0.5, 0.5),
        diffuse: vec3.fromValues(0.4, 0.4, 0.4),
        specular: vec3.fromValues(0.1, 0.1, 0.1),
    });
    sphere2.draw(gl, getWorldToCameraMatrix(), projectionMatrix, green, clipSurface, lightPos, mirroredLightPos, cameraCords, 0.2, {
        shininess: 32,
        ambient: vec3.fromValues(0.5, 0.5, 0.5),
        diffuse: vec3.fromValues(0.4, 0.4, 0.4),
        specular: vec3.fromValues(0.1, 0.1, 0.1),
    });
    sphere3.draw(gl, getWorldToCameraMatrix(), projectionMatrix, blue, clipSurface);

    gl.disable(gl.STENCIL_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    reflect(mirrorPos, mirrorNorm);
    gl.frontFace(gl.CCW);
    gl.disable(gl.STENCIL_TEST);

    drawMirror(mirrorPos, mirrorNorm, getWorldToCameraMatrix(), projectionMatrix, mirrorSize, false);
    lightSource.draw(gl, getWorldToCameraMatrix(), projectionMatrix, white);
    sphere.draw(gl, getWorldToCameraMatrix(), projectionMatrix, red,  undefined, lightPos, mirroredLightPos, cameraCords, 0.2, {
        shininess: 32,
        ambient: vec3.fromValues(0.5, 0.5, 0.5),
        diffuse: vec3.fromValues(0.4, 0.4, 0.4),
        specular: vec3.fromValues(0.1, 0.1, 0.1),
    });
    sphere2.draw(gl, getWorldToCameraMatrix(), projectionMatrix, green, undefined, lightPos, mirroredLightPos, cameraCords, 0.2, {
        shininess: 32,
        ambient: vec3.fromValues(0.5, 0.5, 0.5),
        diffuse: vec3.fromValues(0.4, 0.4, 0.4),
        specular: vec3.fromValues(0.1, 0.1, 0.1),
    });
    sphere3.draw(gl, getWorldToCameraMatrix(), projectionMatrix, blue);


    requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
}

requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
