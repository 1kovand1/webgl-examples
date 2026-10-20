import "./assets/buttons.css"

document.body.insertAdjacentHTML("beforeend", `
  <div id="touch-overlay" class="touch-overlay hidden">
    <div class="drag-handle">☰</div>
    <div class="buttons-grid">
      <button class="ctrl-btn" id="btn-up">▲</button>
      <button class="ctrl-btn" id="btn-left">◀</button>
      <button class="ctrl-btn" id="btn-right">▶</button>
      <button class="ctrl-btn" id="btn-down">▼</button>
    </div>
  </div>
</div>
`);

export const isPressed = {
    "btn-up": false,
    "btn-down": false,
    "btn-left": false,
    "btn-right": false,
};

const overlay = document.getElementById("touch-overlay") as HTMLDivElement;
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
if (isTouchDevice) {
    overlay.classList.remove("hidden");
    overlay.addEventListener("contextmenu", (e) => {
        e.preventDefault();
    });

    function resetOverlayPosition() {
        overlay.style.left = "";
        overlay.style.top = "";
        overlay.style.bottom = "20px";
        overlay.style.right = "auto";
    }

    window.addEventListener("orientationchange", resetOverlayPosition);

    const buttons = document.querySelectorAll(".ctrl-btn");
    buttons.forEach(btn => {
        btn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false });
        btn.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            (isPressed as any)[btn.id] = true;
        });

        btn.addEventListener("pointerup", (e) => {
            e.stopPropagation();
            (isPressed as any)[btn.id] = false;
        });
    });

    const handle = overlay.querySelector(".drag-handle") as HTMLDivElement;
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener("pointerdown", (e: PointerEvent) => {
        isDragging = true;

        const rect = overlay.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        handle.setPointerCapture(e.pointerId);
        e.stopPropagation();
    });

    handle.addEventListener("pointermove", (e: PointerEvent) => {
        if (!isDragging) return;

        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;

        x = Math.max(0, Math.min(x, window.innerWidth - overlay.offsetWidth));
        y = Math.max(0, Math.min(y, window.innerHeight - overlay.offsetHeight));

        overlay.style.left = `${x}px`;
        overlay.style.top = `${y}px`;
        overlay.style.bottom = "auto";
    });

    handle.addEventListener("pointerup", (e) => {
        if (!isDragging) return;
        isDragging = false;
        handle.releasePointerCapture(e.pointerId);
    });
}