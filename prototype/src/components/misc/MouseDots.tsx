import { useEffect, useRef, useState } from 'react';

const DOT_COUNT = 40;
const RESOLUTION_SCALE = 0.5; // render at half res, scale up via CSS
const TARGET_FPS = 30;
const FRAME_BUDGET = 1000 / TARGET_FPS;
const TWO_PI = Math.PI * 2;

const DOT_DIST_SQ = 6400 * RESOLUTION_SCALE * RESOLUTION_SCALE;
const MOUSE_DIST_SQ = 22500 * RESOLUTION_SCALE * RESOLUTION_SCALE;
const DOT_DIST = Math.sqrt(DOT_DIST_SQ);

// Flat Float64Array: [x, y, vx, vy] per dot — avoids object allocations and property lookups
const STRIDE = 4;
const dots = new Float64Array(DOT_COUNT * STRIDE);

const MOBILE_BREAKPOINT = 768;

function MouseDots() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const mouse = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (isMobile) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: true })!;

        const setSize = () => {
            canvas.width = window.innerWidth * RESOLUTION_SCALE;
            canvas.height = window.innerHeight * RESOLUTION_SCALE;
        };
        setSize();

        for (let i = 0; i < DOT_COUNT; i++) {
            const o = i * STRIDE;
            dots[o]     = Math.random() * canvas.width;
            dots[o + 1] = Math.random() * canvas.height;
            dots[o + 2] = Math.random() * 0.4 - 0.2;
            dots[o + 3] = Math.random() * 0.4 - 0.2;
        }

        // Spatial grid to reduce O(n²) pair checks
        const cellSize = DOT_DIST;
        let cols = 0, rows = 0;
        let grid: Int16Array;
        let gridCounts: Int16Array;
        const MAX_PER_CELL = 8;

        function rebuildGridSize() {
            cols = Math.ceil(canvas!.width / cellSize) || 1;
            rows = Math.ceil(canvas!.height / cellSize) || 1;
            grid = new Int16Array(cols * rows * MAX_PER_CELL);
            gridCounts = new Int16Array(cols * rows);
        }
        rebuildGridSize();

        const handleMouseMove = (e: MouseEvent) => {
            mouse.current.x = e.clientX * RESOLUTION_SCALE;
            mouse.current.y = e.clientY * RESOLUTION_SCALE;
        };

        const handleResize = () => { setSize(); rebuildGridSize(); };

        let rafId: number;
        let lastRender = 0;
        let paused = false;

        const handleVisibility = () => {
            paused = document.hidden;
            if (!paused) {
                lastRender = performance.now();
                rafId = requestAnimationFrame(animate);
            }
        };

        const animate = (time: number) => {
            if (paused) return;

            if (time - lastRender < FRAME_BUDGET) {
                rafId = requestAnimationFrame(animate);
                return;
            }
            lastRender = time;

            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            // Update positions + draw dots
            const dotRadius = 2 * RESOLUTION_SCALE;
            ctx.fillStyle = 'rgba(255, 160, 240, 0.8)';
            ctx.beginPath();
            gridCounts.fill(0);
            for (let i = 0; i < DOT_COUNT; i++) {
                const o = i * STRIDE;
                let x = dots[o] + dots[o + 2];
                let y = dots[o + 1] + dots[o + 3];
                if (x <= 0 || x >= w) { dots[o + 2] *= -1; x = dots[o] + dots[o + 2]; }
                if (y <= 0 || y >= h) { dots[o + 3] *= -1; y = dots[o + 1] + dots[o + 3]; }
                dots[o] = x;
                dots[o + 1] = y;
                ctx.moveTo(x + dotRadius, y);
                ctx.arc(x, y, dotRadius, 0, TWO_PI);

                // Insert into spatial grid
                const col = (x / cellSize) | 0;
                const row = (y / cellSize) | 0;
                const cell = row * cols + col;
                const count = gridCounts[cell];
                if (count < MAX_PER_CELL) {
                    grid[cell * MAX_PER_CELL + count] = i;
                    gridCounts[cell] = count + 1;
                }
            }
            ctx.fill();

            // Dot-to-dot connections via spatial grid — only check neighboring cells
            ctx.lineWidth = RESOLUTION_SCALE;
            ctx.strokeStyle = 'rgba(255, 160, 240, 0.35)';
            ctx.beginPath();
            for (let i = 0; i < DOT_COUNT; i++) {
                const o = i * STRIDE;
                const ax = dots[o], ay = dots[o + 1];
                const col = (ax / cellSize) | 0;
                const row = (ay / cellSize) | 0;

                for (let dr = 0; dr <= 1; dr++) {
                    const nr = row + dr;
                    if (nr < 0 || nr >= rows) continue;
                    const startDc = dr === 0 ? 0 : -1;
                    for (let dc = startDc; dc <= 1; dc++) {
                        const nc = col + dc;
                        if (nc < 0 || nc >= cols) continue;
                        const cell = nr * cols + nc;
                        const count = gridCounts[cell];
                        const base = cell * MAX_PER_CELL;
                        for (let k = 0; k < count; k++) {
                            const j = grid[base + k];
                            if (j <= i) continue;
                            const jo = j * STRIDE;
                            const dx = ax - dots[jo];
                            const dy = ay - dots[jo + 1];
                            if (dx * dx + dy * dy < DOT_DIST_SQ) {
                                ctx.moveTo(ax, ay);
                                ctx.lineTo(dots[jo], dots[jo + 1]);
                            }
                        }
                    }
                }
            }
            ctx.stroke();

            // Mouse connections — single path, single stroke
            const mx = mouse.current.x;
            const my = mouse.current.y;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.beginPath();
            for (let i = 0; i < DOT_COUNT; i++) {
                const o = i * STRIDE;
                const dx = dots[o] - mx;
                const dy = dots[o + 1] - my;
                if (dx * dx + dy * dy < MOUSE_DIST_SQ) {
                    ctx.moveTo(dots[o], dots[o + 1]);
                    ctx.lineTo(mx, my);
                }
            }
            ctx.stroke();

            rafId = requestAnimationFrame(animate);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('resize', handleResize);
        document.addEventListener('visibilitychange', handleVisibility);
        rafId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [isMobile]);

    if (isMobile) return null;

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 1,
                pointerEvents: 'none',
            }}
        />
    );
}

export default MouseDots;
