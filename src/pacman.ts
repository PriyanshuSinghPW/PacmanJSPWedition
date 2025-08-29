import { PacmanGame } from './pacman/PacmanGame';
import { LoadingState } from './pacman/LoadingState';

/*
 * Game bootstrap code.  This can be in an inline <script> tag as well.
 */
//var TILE_SIZE = 8;//16;
const CANVAS_WIDTH = 224; //448;
const CANVAS_HEIGHT = 288; //576;

declare global {
    interface Window {
        game?: PacmanGame;
        init: (parent: HTMLElement | string, assetRoot?: string) => void;
    }
}

window.init = function(parent: HTMLElement | string, assetRoot?: string) {
    // Resolve parent element
    const parentEl: HTMLElement | null = typeof parent === 'string'
        ? document.getElementById(parent)
        : parent;
    if (!parentEl) {
        throw new Error('Parent element not found');
    }

    // Create game at native resolution (keep internal logic unchanged)
    window.game = new PacmanGame({
        parent: parentEl, width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
        assetRoot: assetRoot, keyRefreshMillis: 300, targetFps: 60
    });
    window.game.setState(new LoadingState());
    window.game.start();

    // Scale only the rendered view to fit the viewport (letterboxed),
    // keeping game elements and logic at native resolution.
    setupFullscreenViewport(parentEl, CANVAS_WIDTH, CANVAS_HEIGHT);
};
window.init('parent');

// Scales the canvas to fit the window (e.g., 1920x1080) without altering game logic.
function setupFullscreenViewport(container: HTMLElement, gameW: number, gameH: number) {
    // Make container a fullscreen, centered, black letterbox host
    Object.assign(container.style, {
        position: 'fixed',
        inset: '0',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'black',
        margin: '0',
        padding: '0',
        zIndex: '9999'
    } as CSSStyleDeclaration);

    const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) {
        // Canvas will be added by the engine shortly; defer sizing a tick
        requestAnimationFrame(() => setupFullscreenViewport(container, gameW, gameH));
        return;
    }

    const applyScale = () => {
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        // Prefer crisp integer scaling for pixel art
        const scale = Math.min(viewportW / gameW, viewportH / gameH);
        const intScale = Math.max(1, Math.floor(scale));
        const targetW = Math.floor(gameW * intScale);
        const targetH = Math.floor(gameH * intScale);

        canvas.style.width = `${targetW}px`;
        canvas.style.height = `${targetH}px`;
    };

    // Initial scale and on resize
    applyScale();
    window.addEventListener('resize', applyScale);
}

