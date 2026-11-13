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

const radiusMult = 10;

const spheres: Array<TexturedSphere> = Object.values(modelData).map((d, i) => new TexturedSphere(gl, textures[i], d.radius * radiusMult, d.position, glMatrix.toRadian(d.obliquity ?? 0), 0));
const ring = new Ring(gl, 0.55, 9.12e-4 * radiusMult, Object.values(modelData)[6].position, ringTexture, glMatrix.toRadian(Object.values(modelData)[6].obliquity ?? 0));

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
            moveBackward(Object.values(modelData)[+e.key].radius * 2 * radiusMult);
        }
    }
    else if (e.code === "Backspace")
        window.locked = null;

})

window.speed = 1;
window.cameraSpeed = 0.00001;

textureWaitText.remove();
document.querySelectorAll("#overlay *").forEach(x => x.classList.remove("hidden"));

const projectionMatrix = mat4.create();

const lastPos = vec3.create();
const sunPos = vec3.create();
const saturnNormal = vec3.fromValues(0,0,1);
vec3.rotateX(saturnNormal, saturnNormal, [0,0,0], glMatrix.toRadian(modelData.Saturn.obliquity ?? 0));

function draw(gl: WebGL2RenderingContext, view: mat4, projection: mat4, near: number) {
    vec3.copy(sunPos, getPosition(0));
    spheres[0].draw(gl, view, projection);
    spheres.slice(1, 3).forEach(sphere => {
        sphere.draw(gl, view, projection, near, sunPos, 0, sunPos, modelData.Sun.radius * radiusMult, cameraCords, 0.5, {
            shininess: 1,
            ambient: vec3.fromValues(0.2, 0.2, 0.2),
            diffuse: vec3.fromValues(0.75, 0.75, 0.75),
            specular: vec3.fromValues(0, 0, 0),
        })
    });
    spheres[3].draw(gl, view, projection, near, getPosition(9), modelData.Moon.radius * radiusMult, sunPos, modelData.Sun.radius * radiusMult, cameraCords, 0.5, {
            shininess: 1,
            ambient: vec3.fromValues(0.2, 0.2, 0.2),
            diffuse: vec3.fromValues(0.75, 0.75, 0.75),
            specular: vec3.fromValues(0, 0, 0),
        })
    spheres[9].draw(gl, view, projection, near, getPosition(3), modelData.Earth.radius * radiusMult, sunPos, modelData.Sun.radius * radiusMult, cameraCords, 0.5, {
            shininess: 1,
            ambient: vec3.fromValues(0.2, 0.2, 0.2),
            diffuse: vec3.fromValues(0.75, 0.75, 0.75),
            specular: vec3.fromValues(0, 0, 0),
        })
    spheres.slice(4, 6).forEach(sphere => {
        sphere.draw(gl, view, projection, near, sunPos, 0, sunPos, modelData.Sun.radius * radiusMult, cameraCords, 0.5, {
            shininess: 1,
            ambient: vec3.fromValues(0.2, 0.2, 0.2),
            diffuse: vec3.fromValues(0.75, 0.75, 0.75),
            specular: vec3.fromValues(0, 0, 0),
        })
    });
    spheres[6].draw(gl, view, projection, near, getPosition(6), 0, sunPos, modelData.Sun.radius * radiusMult, cameraCords, 0.5, {
            shininess: 1,
            ambient: vec3.fromValues(0.2, 0.2, 0.2),
            diffuse: vec3.fromValues(0.75, 0.75, 0.75),
            specular: vec3.fromValues(0, 0, 0),
        }, getPosition(6), saturnNormal, 0.55*9.12e-4 * radiusMult, 9.12e-4 * radiusMult)
    spheres.slice(7, 9).forEach(sphere => {
        sphere.draw(gl, view, projection, near, sunPos, 0, sunPos, modelData.Sun.radius * radiusMult, cameraCords, 0.5, {
            shininess: 1,
            ambient: vec3.fromValues(0.2, 0.2, 0.2),
            diffuse: vec3.fromValues(0.75, 0.75, 0.75),
            specular: vec3.fromValues(0, 0, 0),
        })
    });
    ring.pos = getPosition(6);
    gl.disable(gl.CULL_FACE);
    ring.draw(gl, view, projection, sunPos, modelData.Sun.radius * radiusMult, getPosition(6), modelData.Saturn.radius * radiusMult, cameraCords, 0.5, {
        shininess: 1,
        ambient: vec3.fromValues(0.2, 0.2, 0.2),
        diffuse: vec3.fromValues(0.9, 0.9, 0.9),
        specular: vec3.fromValues(0, 0, 0),
    });
    gl.enable(gl.CULL_FACE);

    gl.depthFunc(gl.LEQUAL);
    drawSkybox(gl, view, projection);
    gl.depthFunc(gl.LESS);
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

    gl.cullFace(gl.BACK);

    mat4.perspective(projectionMatrix, Math.PI / 3, canvas.width / canvas.height, 0.00001, Infinity);
    draw(gl, getWorldToCameraMatrix(), projectionMatrix, 0.001);
    FPS.innerText = (1 / dt * 1000).toFixed(0).toString();

    requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
}

requestAnimationFrame((timestamp) => render(gl, canvas, timestamp));
