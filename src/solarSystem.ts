export { };
import { mat4, vec3 } from "gl-matrix";
import { cameraCords, getWorldToCameraMatrix, processInput, setCameraPos } from "./utils/camera"
import "./assets/controls.css"
import { getPosition, initRK, RK4 } from "./utils/RK";
import TexturedSphere from "./utils/texturedSphere";
import { loadTexture } from "./utils/loadTexture";
import { drawSkybox, initSkybox } from "./utils/skybox";
import type celestialBody from "./interfaces/celestialBody";
document.title = "Модель Солнечной системы";

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;

const gl = canvas.getContext('webgl2');

if (!gl) {
    throw new Error('WebGL 2 не поддерживается вашим браузером');
}

function resizeCanvas(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}
resizeCanvas(gl, canvas);
window.addEventListener('resize', () => resizeCanvas(gl, canvas));

gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LESS);

gl.enable(gl.CULL_FACE);
gl.cullFace(gl.BACK);

const modelData = await (await fetch("./solar_system.json")).json() as Record<string, celestialBody>;
const textures = await Promise.all(Object.keys(modelData).map(d => loadTexture(gl, "./textures/" + d.toLowerCase() + ".jpg")));

initRK(modelData);

const spheres: Array<TexturedSphere> = Object.values(modelData).map((d, i) => new TexturedSphere(gl, textures[i], d.radius * 10, d.position));

await initSkybox(gl);

const projectionMatrix = mat4.create();

declare global {
    interface Window {
        speed: number;
        tp(name:string): void;
        cameraSpeed: number;
    }
}

window.tp = function (name: string) {
    const i = Object.keys(modelData).findIndex((d) => d.toLowerCase() === name.toLowerCase());
    if (i !== -1)
        setCameraPos(getPosition(i));
}

window.addEventListener("wheel", (e) => {
    if (e.deltaY < 0)
        window.speed *= 2;
    else
        window.speed /= 2;
});

window.speed = 1;
window.cameraSpeed = 0.00001;



let time: DOMHighResTimeStamp;
function render(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, timestamp: DOMHighResTimeStamp) {
    if (time === undefined)
        time = timestamp;
    const dt = timestamp - time;
    time = timestamp;
    processInput(dt, window.cameraSpeed);

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.00001, Infinity);

    RK4(dt * window.speed / 1000 / 3600 / 24);

    spheres.forEach((d, i) => d.pos = getPosition(i));
    spheres[0].draw(gl, getWorldToCameraMatrix(), projectionMatrix);
    spheres.slice(1).forEach(sphere =>
        sphere.draw(gl, getWorldToCameraMatrix(), projectionMatrix, getPosition(0), cameraCords, 0.5, {
            shininess: 1,
            ambient: vec3.fromValues(0,0,0),
            diffuse: vec3.fromValues(0.75, 0.75, 0.75),
            specular: vec3.fromValues(0,0,0),
        })
    )

    gl.depthFunc(gl.LEQUAL);
    drawSkybox(gl, getWorldToCameraMatrix(), projectionMatrix);
    gl.depthFunc(gl.LESS);

    requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
}

requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
