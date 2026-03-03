import { useEffect, useRef } from 'react';

const DOT_COUNT = 40;
const RESOLUTION_SCALE = 0.5; // render at half res, scale up via CSS
const TARGET_FPS = 30;
const FRAME_BUDGET = 1000 / TARGET_FPS;

const DOT_DIST_SQ = 6400 * RESOLUTION_SCALE * RESOLUTION_SCALE;
const MOUSE_DIST_SQ = 22500 * RESOLUTION_SCALE * RESOLUTION_SCALE;

function MouseDots() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const mouse = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: true })!;

        const setSize = () => {
            canvas.width = window.innerWidth * RESOLUTION_SCALE;
            canvas.height = window.innerHeight * RESOLUTION_SCALE;
        };
        setSize();

        const dots = Array.from({ length: DOT_COUNT }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: Math.random() * 0.4 - 0.2,
            vy: Math.random() * 0.4 - 0.2,
        }));

        const handleMouseMove = (e: MouseEvent) => {
            mouse.current.x = e.clientX * RESOLUTION_SCALE;
            mouse.current.y = e.clientY * RESOLUTION_SCALE;
        };

        const handleResize = () => setSize();

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

            // Update + draw dots
            const dotRadius = 2 * RESOLUTION_SCALE;
            ctx.fillStyle = 'rgba(255, 160, 240, 0.8)';
            ctx.beginPath();
            for (let i = 0; i < dots.length; i++) {
                const d = dots[i];
                d.x += d.vx;
                d.y += d.vy;
                if (d.x <= 0 || d.x >= w) d.vx *= -1;
                if (d.y <= 0 || d.y >= h) d.vy *= -1;
                ctx.moveTo(d.x + dotRadius, d.y);
                ctx.arc(d.x, d.y, dotRadius, 0, Math.PI * 2);
            }
            ctx.fill();

            // Dot-to-dot connections — single path, single stroke
            ctx.lineWidth = RESOLUTION_SCALE;
            ctx.strokeStyle = 'rgba(255, 160, 240, 0.35)';
            ctx.beginPath();
            for (let i = 0; i < dots.length; i++) {
                const a = dots[i];
                for (let j = i + 1; j < dots.length; j++) {
                    const b = dots[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    if (dx * dx + dy * dy < DOT_DIST_SQ) {
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                    }
                }
            }
            ctx.stroke();

            // Mouse connections — single path, single stroke
            const mx = mouse.current.x;
            const my = mouse.current.y;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.beginPath();
            for (let i = 0; i < dots.length; i++) {
                const a = dots[i];
                const dx = a.x - mx;
                const dy = a.y - my;
                if (dx * dx + dy * dy < MOUSE_DIST_SQ) {
                    ctx.moveTo(a.x, a.y);
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
    }, []);

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
