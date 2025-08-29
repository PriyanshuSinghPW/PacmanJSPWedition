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

    // Add info/help UI overlay
    setupInfoOverlay(parentEl);
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
        const isPortrait = viewportH > viewportW;

        // In portrait, allow fractional scaling to better fill width.
        // In landscape/desktop, keep integer scaling for crisp pixel art.
        const rawScale = Math.min(viewportW / gameW, viewportH / gameH);
        const scale = isPortrait ? rawScale : Math.max(1, Math.floor(rawScale));
        const targetW = Math.round(gameW * scale);
        const targetH = Math.round(gameH * scale);

        canvas.style.width = `${targetW}px`;
        canvas.style.height = `${targetH}px`;
    };

    // Initial scale and on resize
    applyScale();
    window.addEventListener('resize', applyScale);

    // Block pull-to-refresh / overscroll gestures within the game
    const prevent = (e: Event) => e.preventDefault();
    container.addEventListener('touchmove', prevent, { passive: false });
    // Prevent iOS pinch-zoom gestures
    container.addEventListener('gesturestart', prevent as EventListener, { passive: false } as any);
}

function setupInfoOverlay(container: HTMLElement) {
        // Ensure container is positionable
        if (getComputedStyle(container).position === 'static') {
                container.style.position = 'fixed'; // already set in setupFullscreenViewport
        }

        // Create button
        const btn = document.createElement('button');
        btn.className = 'info-btn';
        btn.textContent = 'i';
        btn.title = 'How to play';

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'info-overlay';
        overlay.innerHTML = `
            <div class="info-card">
                <button class="info-close" aria-label="Close">×</button>
                <h3>How to Play</h3>
                <h4>PC</h4>
                <ul>
                    <li>Enter: Start / Pause</li>
                    <li>Arrow Keys: Move</li>
                    <li>M: Toggle sound</li>
                </ul>
                <h4>Mobile</h4>
                <ul>
                    <li>Tap: Start / Pause / Confirm</li>
                    <li>Swipe Up/Down/Left/Right: Move</li>
                    <li>Tap on Game Over: Return to Menu</li>
                </ul>
            </div>
        `;

        // Wire up interactions
        const show = () => { overlay.style.display = 'flex'; };
        const hide = () => { overlay.style.display = 'none'; };
        btn.addEventListener('click', (e) => { e.stopPropagation(); show(); });
        overlay.addEventListener('click', hide);
        overlay.querySelector('.info-card')?.addEventListener('click', (e) => e.stopPropagation());
        overlay.querySelector('.info-close')?.addEventListener('click', (e) => { e.stopPropagation(); hide(); });

        // Add to DOM
        container.appendChild(btn);
        container.appendChild(overlay);
}

