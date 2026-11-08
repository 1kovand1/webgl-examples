export { };
import { mat4, vec2, vec3 } from "gl-matrix";
import { getWorldToCameraMatrix, processInput, reflect } from "./utils/camera"
import "./assets/controls.css"
import { drawMirror, mirrorfb, mirrorWidth, mirrorHeight, getSurface } from "./utils/mirror";
import ClippableSphere from "./utils/clippableSphere";
document.title = "Зеркало";

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;

const gl = canvas.getContext('webgl2');

if (!gl) {
    throw new Error('WebGL 2 не поддерживается вашим браузером');
}

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


const sphere = new ClippableSphere(gl);
const sphere2 = new ClippableSphere(gl, 1, vec3.fromValues(0, -1, 5));
const sphere3 = new ClippableSphere(gl, 1, vec3.fromValues(0, -1, -7));

const mirrorPos = vec3.fromValues(0, 0, -5);
const mirrorNorm = vec3.fromValues(0, 0, -1);

const mirrorSize = vec2.fromValues(10, 10);

const red = vec3.fromValues(1, 0, 0);
const green = vec3.fromValues(0, 1, 0);
const blue = vec3.fromValues(0, 0, 1);

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

    gl.cullFace(gl.FRONT);
    gl.enable(gl.STENCIL_TEST);
    gl.depthMask(false);
    gl.stencilMask(0xFF);
    gl.colorMask(false, false, false, false);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)

    drawMirror(mirrorPos, mirrorNorm, getWorldToCameraMatrix(), projectionMatrix, mirrorSize, true);

    gl.stencilFunc(gl.EQUAL, 1, 0xFF);
    gl.depthMask(true);
    gl.colorMask(true, true, true, true);
    gl.stencilMask(0xFF);
    gl.stencilOp(gl.REPLACE,gl.REPLACE,gl.REPLACE);

    const clipSurface = getSurface(mirrorPos, mirrorNorm, getWorldToCameraMatrix(), mirrorSize);

    sphere.draw(gl, getWorldToCameraMatrix(), projectionMatrix, red, clipSurface);
    sphere2.draw(gl, getWorldToCameraMatrix(), projectionMatrix, green, clipSurface);
    sphere3.draw(gl, getWorldToCameraMatrix(), projectionMatrix, blue, clipSurface);

    gl.disable(gl.STENCIL_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.stencilMask(0);

    reflect(mirrorPos, mirrorNorm);
    gl.cullFace(gl.BACK);
    gl.disable(gl.STENCIL_TEST);

    drawMirror(mirrorPos, mirrorNorm, getWorldToCameraMatrix(), projectionMatrix, mirrorSize, false);
    sphere.draw(gl, getWorldToCameraMatrix(), projectionMatrix, red);
    sphere2.draw(gl, getWorldToCameraMatrix(), projectionMatrix, green);
    sphere3.draw(gl, getWorldToCameraMatrix(), projectionMatrix, blue);


    requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
}

requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
