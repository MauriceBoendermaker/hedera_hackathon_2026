import { useEffect, RefObject } from 'react';

export function useTiltEffect(
    cardRef: RefObject<HTMLElement | null>,
    glareRef?: RefObject<HTMLElement | null>,
    enabled: boolean = true,
) {
    useEffect(() => {
        const card = cardRef.current;
        if (!card || !enabled) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        function handleMouseMove(e: MouseEvent) {
            if (!card || !card.offsetParent) return;
            const { innerWidth, innerHeight } = window;
            const x = e.clientX / innerWidth - 0.5;
            const y = e.clientY / innerHeight - 0.5;
            card.style.transform = `perspective(1000px) rotateX(${y * -10}deg) rotateY(${x * 10}deg) scale(1.03)`;

            const glare = glareRef?.current;
            if (glare) {
                const glareX = e.clientX / innerWidth * 100;
                const glareY = e.clientY / innerHeight * 100;
                glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.02), transparent 60%)`;
            }
        }

        function reset() {
            if (card) {
                card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
            }
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', reset);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', reset);
        };
    }, [cardRef, glareRef, enabled]);
}
