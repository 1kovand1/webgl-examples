import { isPressed } from "./mobileButtons"
import { vec3, quat, mat4, mat3 } from 'gl-matrix';

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;

export const cameraCords = vec3.fromValues(0, 0, 1);
export const cameraQuat = quat.create();

const pressedKeys = new Set();
window.addEventListener("keydown", (event: KeyboardEvent) => { pressedKeys.add(event.code) });
window.addEventListener("keyup", (event: KeyboardEvent) => { pressedKeys.delete(event.code) });
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let lastTouchX = 0;
let lastTouchY = 0;

let cameraPointerId: number = 0;

if (!window.matchMedia("(pointer: coarse)").matches)
    canvas.addEventListener('mousedown', async () => {
        await canvas.requestPointerLock();
        isDragging = true;
        lastMouseX = 0;
        lastMouseY = 0;
    });

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === null) 
        isDragging = false;
});

const right = vec3.create();
const left = vec3.create();
const up = vec3.create();
const down = vec3.create();
const forward = vec3.create();
const backward = vec3.create();
const deltaRotation = quat.create();

canvas.addEventListener('mousemove', (e) => {
    const SENSITIVITY = 0.004;
    if (document.pointerLockElement === null) return;

    vec3.set(right, 1, 0, 0);
    vec3.transformQuat(right, right, cameraQuat);
    vec3.set(up, 0, 1, 0);
    vec3.transformQuat(up, up, cameraQuat);

    const dx = e.movementX;
    const dy = e.movementY;

    quat.setAxisAngle(deltaRotation, up, -dx * SENSITIVITY);
    quat.multiply(cameraQuat, deltaRotation, cameraQuat);
    quat.setAxisAngle(deltaRotation, right, -dy * SENSITIVITY);
    quat.multiply(cameraQuat, deltaRotation, cameraQuat);

    lastMouseX += e.movementX;
    lastMouseY -= e.movementY;
});

// Сенсорное управление для мобильных устройств
canvas.addEventListener('touchstart', (e) => {
    if (!isDragging) {
        cameraPointerId = e.targetTouches[0].identifier;
        isDragging = true;
        lastTouchX = e.targetTouches[0].clientX;
        lastTouchY = e.targetTouches[0].clientY;
    }
});
canvas.addEventListener('touchend', () => isDragging = false);
canvas.addEventListener('touchmove', (e) => {
    if (!isDragging || cameraPointerId !== e.targetTouches[0].identifier) return;
    const mockEvent = { movementX: e.targetTouches[0].clientX - lastTouchX, movementY: e.targetTouches[0].clientY - lastTouchY };
    lastTouchX = e.targetTouches[0].clientX;
    lastTouchY = e.targetTouches[0].clientY;
    window.dispatchEvent(new MouseEvent('mousemove', mockEvent));
});


export function processInput(dt: number, speed: number = 0.008, rollspeed: number = 0.002) {
    vec3.set(forward, 0, 0, -1);
    vec3.transformQuat(forward, forward, cameraQuat);
    vec3.set(right, 1, 0, 0);
    vec3.transformQuat(right, right, cameraQuat);
    vec3.set(up, 0, 1, 0);
    vec3.transformQuat(up, up, cameraQuat);
    vec3.negate(backward, forward);
    vec3.negate(left, right);
    vec3.negate(down, up);


    if (pressedKeys.has("KeyW") || isPressed["btn-forward"])
        vec3.scaleAndAdd(cameraCords, cameraCords, forward, speed * dt);
    if (pressedKeys.has("KeyS") || isPressed["btn-backward"])
        vec3.scaleAndAdd(cameraCords, cameraCords, backward, speed * dt);
    if (pressedKeys.has("KeyA") || isPressed["btn-left"])
        vec3.scaleAndAdd(cameraCords, cameraCords, left, speed * dt);
    if (pressedKeys.has("KeyD") || isPressed["btn-right"])
        vec3.scaleAndAdd(cameraCords, cameraCords, right, speed * dt);
    if (pressedKeys.has("Space") || isPressed["btn-up"])
        vec3.scaleAndAdd(cameraCords, cameraCords, up, speed * dt);
    if (pressedKeys.has("ShiftLeft") || isPressed["btn-down"])
        vec3.scaleAndAdd(cameraCords, cameraCords, down, speed * dt);
    if (pressedKeys.has("KeyQ") || isPressed["btn-ccw"]) {
        quat.setAxisAngle(deltaRotation, forward, -rollspeed * dt);
        quat.multiply(cameraQuat, deltaRotation, cameraQuat);
    }
    if (pressedKeys.has("KeyE") || isPressed["btn-cw"]) {
        quat.setAxisAngle(deltaRotation, forward, rollspeed * dt);
        quat.multiply(cameraQuat, deltaRotation, cameraQuat);
    }
}

const cameraMatrix = mat4.create();
const nCameraCoords = vec3.create();
const cameraRotationMatrix = mat4.create();
const cameraRotationConj = quat.create();

export function getWorldToCameraMatrix() {
    vec3.negate(nCameraCoords, cameraCords);
    quat.conjugate(cameraRotationConj, cameraQuat);
    mat4.fromQuat(cameraRotationMatrix, cameraRotationConj);
    mat4.fromTranslation(cameraMatrix, nCameraCoords);
    mat4.multiply(cameraMatrix, cameraRotationMatrix, cameraMatrix);

    return cameraMatrix;
}

const temp = vec3.create();
const m = mat3.create();
export function reflect(pos: vec3, norm: vec3) {
    vec3.transformQuat(
        forward,
        vec3.fromValues(0, 0, -1),
        cameraQuat,
    );

    vec3.transformQuat(
        up,
        vec3.fromValues(0, 1, 0),
        cameraQuat,
    );

    vec3.scaleAndAdd(forward, forward, norm, -2 * vec3.dot(norm, forward));
    vec3.scaleAndAdd(up, up, norm, -2 * vec3.dot(norm, up));

    vec3.normalize(
        right,
        vec3.cross(vec3.create(), forward, up),
    );

    vec3.cross(up, right, forward);
    vec3.normalize(up, up);

    mat3.set(m,
        right[0], right[1], right[2],
        up[0], up[1], up[2],
        -forward[0], -forward[1], -forward[2],
    );

    quat.fromMat3(cameraQuat, m);
    quat.normalize(cameraQuat, cameraQuat);

    vec3.sub(temp, cameraCords, pos);
    const proj = vec3.dot(temp, norm);
    vec3.scaleAndAdd(cameraCords, cameraCords, norm, -2*proj);
}

export function setCameraPos(pos: vec3) {
    vec3.copy(cameraCords, pos);
}