import {quat, mat4, vec3} from 'gl-matrix'

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
    alert('WebGL 2 не поддерживается вашим браузером');
}

// Подгоняем размер холста под экран
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 2. Описание шейдеров (GLSL ES 3.00)
const vsSource = `#version 300 es
    in vec3 vertexPos;
    uniform mat4 model;
    uniform mat4 projection;
    void main() {
        gl_Position = projection * model * vec4(vertexPos, 1.0);
    }
`;

const fsSource = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    void main() {
        fragColor = vec4(1.0, 0.5, 0.2, 1.0); // Оранжевый куб
    }
`;

// Функция компиляции шейдеров
function initShaderProgram(gl, vsSource, fsSource) {
    const loadShader = (gl, type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    };
    const vs = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    return program;
}

const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
const programInfo = {
    program: shaderProgram,
    attribLocations: { vertexPos: gl.getAttribLocation(shaderProgram, 'vertexPos') },
    uniformLocations: {
        model: gl.getUniformLocation(shaderProgram, 'model'),
        projection: gl.getUniformLocation(shaderProgram, 'projection'),
    },
};

// 3. Геометрия (Простой 3D Треугольник / Пирамида для наглядности)
const vertices = new Float32Array([
     0.0,  0.5,  0.0,  -0.5, -0.5,  0.5,   0.5, -0.5,  0.5, // Передняя грань
     0.0,  0.5,  0.0,   0.5, -0.5,  0.5,   0.5, -0.5, -0.5, // Правая грань
     0.0,  0.5,  0.0,   0.5, -0.5, -0.5,  -0.5, -0.5, -0.5, // Задняя грань
     0.0,  0.5,  0.0,  -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5  // Левая грань
]);

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

gl.enableVertexAttribArray(programInfo.attribLocations.vertexPos);
gl.vertexAttribPointer(programInfo.attribLocations.vertexPos, 3, gl.FLOAT, false, 0, 0);

// 4. Переменные трансформации (Аналоги Qt)
let currentRotation = quat.create(); // Кватернион вращения (единичный)
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// 5. Обработка событий мыши
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;

    // Вычисляем перпендикулярную ось вращения на экране
    const rotationAxis = vec3.fromValues(dy, dx, 0.0);
    const distance = vec3.length(rotationAxis);

    if (distance > 0) {
        vec3.normalize(rotationAxis, rotationAxis);
        
        // Скорость вращения (чувствительность)
        const angularSpeed = distance * 0.005; 

        // Создаем дельта-кватернион текущего шага
        const deltaRotation = quat.create();
        quat.setAxisAngle(deltaRotation, rotationAxis, angularSpeed);

        // Умножаем дельта-вращение на текущее вращение (Мировые координаты)
        quat.multiply(currentRotation, deltaRotation, currentRotation);
    }

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

// Сенсорное управление для мобильных устройств
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        isDragging = true;
        lastMouseX = e.touches[0].clientX;
        lastMouseY = e.touches[0].clientY;
    }
});
window.addEventListener('touchend', () => isDragging = false);
canvas.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const mockEvent = { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    window.dispatchEvent(new MouseEvent('mousemove', mockEvent));
});

// 6. Главный цикл отрисовки (Render Loop)
gl.enable(gl.DEPTH_TEST);

function render() {
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Матрица проекции
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, canvas.width / canvas.height, 0.1, 100.0);

    // Матрица модели
    const modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [0.0, 0.0, -2.5]); // Отодвигаем объект назад
    
    // Преобразуем кватернион в матрицу вращения и применяем к модели
    const rotationMatrix = mat4.create();
    mat4.fromQuat(rotationMatrix, currentRotation);
    mat4.multiply(modelMatrix, modelMatrix, rotationMatrix);

    // Использование программы и передача униформ-переменных
    gl.useProgram(programInfo.program);
    gl.uniformMatrix4fv(programInfo.uniformLocations.projection, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.model, false, modelMatrix);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 12); // Рисуем 4 грани пирамиды

    requestAnimationFrame(render);
}

// Запуск цикла
requestAnimationFrame(render);