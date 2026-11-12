export { };
import { glMatrix, mat4, vec3 } from "gl-matrix";
import { cameraCords, getWorldToCameraMatrix, moveBackward, processInput, setCameraPos } from "./utils/camera"
import "./assets/controls.css"
import { getPosition, initRK, RK4 } from "./utils/RK";
import TexturedSphere from "./utils/models/texturedSphere";
import { loadTexture } from "./utils/loadTexture";
import { drawSkybox, initSkybox } from "./utils/models/skybox";
import type celestialBody from "./interfaces/celestialBody";
import "./assets/overlay.css";
import Ring from "./utils/models/rings";

document.title = "Модель Солнечной системы";

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
canvas.insertAdjacentHTML("beforebegin", `
<div id="overlay">
    <div class="row hidden">
        <span>Скорость моделирования: x<p id="modellingSpeed">1</p> <p class="touchControls" onclick="modellingSpeed.innerText = (window.speed *= 2).toString();">+</p> <p class="touchControls" onclick=" modellingSpeed.innerText = (window.speed /= 2).toString();">-</p></span>
        <span>Позиция: <p id="position"></p></span>
    </div>
    <div class="row hidden">
        <span>Шагов РК на кадр: <p id="RKSteps"></p></span>
        <span>FPS: <p id="FPS"></p></span>
    </div>
    <div id="textureWaitText"><p>Подождите, текстуры загружаются....</p></div>
</div>
    `);

const gl = canvas.getContext('webgl2');
const modellingSpeed = document.getElementById("modellingSpeed") as HTMLParagraphElement;
const RKSteps = document.getElementById("RKSteps") as HTMLParagraphElement;
const FPS = document.getElementById("FPS") as HTMLParagraphElement;
const textureWaitText = document.getElementById("textureWaitText") as HTMLDivElement;
const position = document.getElementById("position") as HTMLDivElement;

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
const ringTexture = await loadTexture(gl, "./textures/saturn_ring.png");

initRK(modelData);

const spheres: Array<TexturedSphere> = Object.values(modelData).map((d, i) => new TexturedSphere(gl, textures[i], d.radius * 100, d.position, glMatrix.toRadian(d.obliquity ?? 0), 0));
const ring = new Ring(gl, 0.55, 9.12e-4 * 100, Object.values(modelData)[6].position, ringTexture, glMatrix.toRadian(Object.values(modelData)[6].obliquity ?? 0));

await initSkybox(gl);

declare global {
    interface Window {
        speed: number;
        tp(name: string): void;
        cameraSpeed: number;
        locked: number | null;
    }
}

window.locked = null;

window.tp = function (name: string) {
    const i = Object.keys(modelData).findIndex((d) => d.toLowerCase() === name.toLowerCase());
    if (i !== -1)
        setCameraPos(getPosition(i));
}

window.addEventListener("wheel", (e) => {
    if (e.deltaY < 0)
        modellingSpeed.innerText = (window.speed *= 2).toString();
    else
        modellingSpeed.innerText = (window.speed /= 2).toString();
});

window.addEventListener("keydown", (e) => {
    if (!isNaN(+e.key) && e.key !== " ") {
        if (e.ctrlKey) {
            vec3.copy(lastPos, getPosition(+e.key));
            window.locked = +e.key;
            e.preventDefault();
        }
        else {
            setCameraPos(getPosition(+e.key));
            moveBackward(Object.values(modelData)[+e.key].radius * 20);
        }
    }
})

window.speed = 1;
window.cameraSpeed = 0.00001;

textureWaitText.remove();
document.querySelectorAll("#overlay *").forEach(x => x.classList.remove("hidden"));

const projectionMatrix = mat4.create();
const viewMatrices: Array<mat4> = [
    mat4.lookAt(mat4.create(), [0, 0, 0], [1, 0, 0], [0, -1, 0]),
    mat4.lookAt(mat4.create(), [0, 0, 0], [-1, 0, 0], [0, -1, 0]),
    mat4.lookAt(mat4.create(), [0, 0, 0], [0, 1, 0], [0, 0, 1]),
    mat4.lookAt(mat4.create(), [0, 0, 0], [0, -1, 0], [0, 0, -1]),
    mat4.lookAt(mat4.create(), [0, 0, 0], [0, 0, 1], [0, -1, 0]),
    mat4.lookAt(mat4.create(), [0, 0, 0], [0, 0, -1], [0, -1, 0]),
];

const SHADOW_SIZE = 2048;

const lastPos = vec3.create();

const shadowBuffer = gl.createFramebuffer();
const shadowTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_CUBE_MAP, shadowTexture);

for (let i = 0; i < 6; ++i) {
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.DEPTH_COMPONENT32F,
        SHADOW_SIZE, SHADOW_SIZE, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);
}

gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

gl.bindFramebuffer(gl.FRAMEBUFFER, shadowBuffer);

gl.drawBuffers([gl.NONE]);
gl.readBuffer(gl.NONE);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
function draw(gl: WebGL2RenderingContext, view: mat4, projection: mat4, near: number, dryRun: boolean = false) {
    if (!dryRun)
        spheres[0].draw(gl, view, projection);
    spheres.slice(1).forEach(sphere => {
        if (dryRun)
            sphere.draw(gl, view, projection);
        else
            sphere.draw(gl, view, projection, near, shadowTexture, getPosition(0), cameraCords, 0, {
                shininess: 1,
                ambient: vec3.fromValues(0, 0, 0),
                diffuse: vec3.fromValues(0.75, 0.75, 0.75),
                specular: vec3.fromValues(0, 0, 0),
            })
    }
    );
    ring.pos = getPosition(6);
    gl.disable(gl.CULL_FACE);
    if (dryRun)
        ring.draw(gl, view, projection);
    else
        ring.draw(gl, view, projection, near, shadowTexture, getPosition(0), cameraCords, 0, {
            shininess: 1,
            ambient: vec3.fromValues(0, 0, 0),
            diffuse: vec3.fromValues(0.9, 0.9, 0.9),
            specular: vec3.fromValues(0, 0, 0),
        });
    gl.enable(gl.CULL_FACE);

    if (!dryRun) {
        gl.depthFunc(gl.LEQUAL);
        drawSkybox(gl, view, projection);
        gl.depthFunc(gl.LESS);
    }
}

let time: DOMHighResTimeStamp;
function render(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, timestamp: DOMHighResTimeStamp) {
    if (time === undefined)
        time = timestamp;
    const dt = timestamp - time;
    time = timestamp;
    processInput(dt, window.cameraSpeed);
    position.innerText = `x: ${cameraCords[0].toFixed(2)}, y: ${cameraCords[1].toFixed(2)}, z: ${cameraCords[2].toFixed(2)}`

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const RKinfo = RK4(dt * window.speed / 1000 / 3600 / 24);
    RKSteps.innerText = RKinfo.count.toString();
    if (window.locked !== null) {
        vec3.sub(lastPos, getPosition(window.locked), lastPos);
        vec3.add(cameraCords, cameraCords, lastPos);
        vec3.copy(lastPos, getPosition(window.locked))
    }
    spheres.forEach((d, i) => {
        d.pos = getPosition(i);
        d.rotation += (Object.values(modelData)[i].rotation ?? 0) * dt * window.speed / 1000;
    });

    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowBuffer);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    mat4.perspective(projectionMatrix, Math.PI / 2, 1, 0.001, 50);
    gl.cullFace(gl.FRONT);
    for (let i = 0; i < 6; ++i) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, shadowTexture, 0);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        draw(gl, viewMatrices[i], projectionMatrix, 0.001, true);
    }
    gl.cullFace(gl.BACK);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    mat4.perspective(projectionMatrix, Math.PI / 2, canvas.width / canvas.height, 0.001, 50);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    draw(gl, getWorldToCameraMatrix(), projectionMatrix, 0.001);
    FPS.innerText = (1 / dt * 1000).toFixed(0).toString();

    requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
}

requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
