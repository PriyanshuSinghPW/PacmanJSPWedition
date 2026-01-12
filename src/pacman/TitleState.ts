import { BaseState } from './BaseState';
import { PacmanGame } from './PacmanGame';
import { Pacman } from './Pacman';
import { Direction } from './Direction';
import { Ghost } from './Ghost';
import Sounds from './Sounds';
import { Game, Image, InputManager, SpriteSheet } from 'gtp';
import { SPRITE_SIZE } from './Constants';

export class TitleState extends BaseState {

    private choice: number;
    private lastKeypressTime: number;
    private boundTouchStart?: (e: TouchEvent) => void;
    private boundTouchMove?: (e: TouchEvent) => void;
    private boundTouchEnd?: (e: TouchEvent) => void;
    private touchStartX = 0;
    private touchStartY = 0;
    private touchStartTime = 0;
    private touchActive = false;
    private touchSwiped = false;

    /**
     * State that renders the title screen.
     */
    constructor(args: PacmanGame) {

        super(args);
        // Initialize our sprites not just in enter() so they are positioned
        // correctly while FadeOutInState is running
        this.initSprites(args);
    }

    override enter(game: PacmanGame) {
        this.game = game;
        super.enter(game);
        // Bind touch handlers for mobile gestures
        this.boundTouchStart = this.onTouchStart.bind(this);
        this.boundTouchMove = this.onTouchMove.bind(this);
        this.boundTouchEnd = this.onTouchEnd.bind(this);
        game.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: true });
        game.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: true });
        game.canvas.addEventListener('touchend', this.boundTouchEnd, { passive: true });
        this.choice = 0;
        this.lastKeypressTime = game.playTime;

        this.initSprites(game);
    }

    private initSprites(game: PacmanGame) {
        const pacman: Pacman = game.pacman;
        pacman.setLocation(game.getWidth() / 2, 240);
        pacman.direction = Direction.EAST;
        const ghost: Ghost = game.getGhost(0);
        ghost.setLocation(game.getWidth() / 2 - 3 * SPRITE_SIZE, 240);
        ghost.direction = Direction.EAST;
    }

    override leaving(game: Game) {
        if (this.boundTouchStart) game.canvas.removeEventListener('touchstart', this.boundTouchStart);
        if (this.boundTouchMove) game.canvas.removeEventListener('touchmove', this.boundTouchMove);
        if (this.boundTouchEnd) game.canvas.removeEventListener('touchend', this.boundTouchEnd);
    }

    private onTouchStart(e: TouchEvent) {
        if (e.touches.length === 0) return;
        const t = e.touches[0];
        this.touchStartX = t.clientX;
        this.touchStartY = t.clientY;
        this.touchStartTime = performance.now();
        this.touchActive = true;
        this.touchSwiped = false;
    }

    private onTouchMove(e: TouchEvent) {
        if (!this.touchActive || this.touchSwiped) return;
        const t = e.touches[0];
        const dx = t.clientX - this.touchStartX;
        const dy = t.clientY - this.touchStartY;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const SWIPE_DIST_PX = 14;

        if (adx < SWIPE_DIST_PX && ady < SWIPE_DIST_PX) return;

        // For menu, use vertical swipes to move selection
        if (ady >= adx) {
            const dirUp = dy < 0;
            const playTime = this.game.playTime;
            // Mirror keyboard nav
            const prevChoice = this.choice;
            if (dirUp) {
                this.choice = Math.abs(this.choice - 1);
            }
            else {
                this.choice = (this.choice + 1) % 2;
            }
            if (this.choice !== prevChoice) {
                this.game.audio.playSound(Sounds.TOKEN);
                this.lastKeypressTime = playTime;
            }
            this.touchSwiped = true;
        }
        else {
            // Optional: could map left/right too in future
            this.touchSwiped = true;
        }
    }

    private onTouchEnd(e: TouchEvent) {
        if (!this.touchActive) return;
        this.touchActive = false;
        const touch = e.changedTouches[0];
        const dt = performance.now() - this.touchStartTime;

        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const TAP_TIME_MS = 220;
        const TAP_DIST_PX = 12;

        // Tap to start (Enter)
        if (!this.touchSwiped && dt <= TAP_TIME_MS && adx < TAP_DIST_PX && ady < TAP_DIST_PX) {
            this.startGame();
        }
    }

    override render(ctx: CanvasRenderingContext2D) {
        const game = this.game;
        const screenWidth: number = game.getWidth(),
            screenHeight: number = game.getHeight(),
            charWidth = 9;

        this.renderStaticStuff(ctx);

        // Draw the menu "choice" arrow
        // " - 5" to account for differently sized choices
        let x: number = (screenWidth - charWidth * 15) / 2 - 5;
        let y: number = (screenHeight - 15 * 2) / 2;
        this.game.drawString(x, y + this.choice * 15, '>');

        // Draw the small and big dots
        x += charWidth * 1.5;
        y = 200;
        game.getRenderingContext().fillStyle = '#ffffff';
        game.drawSmallDot(x + 3, y + 2);
        y += 9;
        game.drawBigDot(x, y);

        // Draw the sprites
        game.pacman.render(ctx);
        game.getGhost(0).paint(ctx);

        if (!game.audio.isInitialized()) {
            this.renderNoSoundMessage();
        }
    }

    private stringWidth(str: string): number {
        const font: SpriteSheet = this.game.assets.get('font');
        return font.cellW * str.length;
    }

    private renderNoSoundMessage() {

        const w: number = this.game.getWidth();

        let text = 'SOUND IS DISABLED AS';
        let x: number = (w - this.stringWidth(text)) / 2;
        let y: number = this.game.getHeight() - 20 - 9 * 3;
        this.game.drawString(x, y, text);
        text = 'YOUR BROWSER DOES NOT';
        x = (w - this.stringWidth(text)) / 2;
        y += 9;
        this.game.drawString(x, y, text);
        text = 'SUPPORT WEB AUDIO';
        x = (w - this.stringWidth(text)) / 2;
        y += 9;
        this.game.drawString(x, y, text);
    }

    // TODO: Move this stuff into an image that gets rendered each frame?
    private renderStaticStuff(ctx: CanvasRenderingContext2D) {
        const game = this.game;
        game.clearScreen('rgb(0,0,0)');
        const screenHeight: number = game.getWidth();
        const charWidth = 9;

        // Render the "scores" stuff at the top.
        game.drawScores(ctx);
        game.drawScoresHeaders(ctx);

        // Title image
        const titleImage: Image = game.assets.get('title');
        let x: number = (screenHeight - titleImage.width) / 2;
        let y: number = titleImage.height * 1.2;
        titleImage.draw(ctx, x, y);

        // Game menu
        let temp = 'STANDARD MAZE';
        let charCount: number = temp.length - 1; // "-1" for selection arrow
        // " - 5" to account for differently sized choices
        x = (screenHeight - charWidth * charCount) / 2 - 5;
        y = (game.getHeight() - 15 * 2) / 2;
        this.game.drawString(x, y, temp, ctx);
        temp = 'ALTERNATE MAZE';
        y += 15;
        this.game.drawString(x, y, temp, ctx);

        // Scores for the dot types
        x += charWidth * 2;
        temp = '10 POINTS';
        charCount = temp.length - 2; // "-2" for animated dots
        y = 200;
        this.game.drawString(x, y, temp, ctx);
        temp = '50 POINTS';
        y += 9;
        this.game.drawString(x, y, temp, ctx);

        // Copyright
        temp = '2015 OLD MAN GAMES';
        x = (screenHeight - charWidth * temp.length) / 2;
        y = game.getHeight() - 20;
        this.game.drawString(x, y, temp, ctx);
    }

    private startGame() {
        this.requestFullscreenPortrait();
        this.game.startGame(this.choice);
    }

    private requestFullscreenPortrait() {
        try {
            const host = this.game.canvas.parentElement ?? this.game.canvas;
            host.requestFullscreen().catch(() => { /* ignore */ });
        }
        catch { /* ignore */ }
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
            const anyScreen = screen as any;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            anyScreen?.orientation?.lock('portrait').catch(() => { /* ignore */ });
        }
        catch { /* ignore */ }
    }

    override update(delta: number) {
        const game = this.game;
        this.handleDefaultKeys();

        const playTime: number = game.playTime;
        if (playTime > this.lastKeypressTime + BaseState.INPUT_REPEAT_MILLIS + 100) {

            const im: InputManager = game.inputManager;

            if (im.up()) {
                this.choice = Math.abs(this.choice - 1);
                game.audio.playSound(Sounds.TOKEN);
                this.lastKeypressTime = playTime;
            }
            else if (im.down()) {
                this.choice = (this.choice + 1) % 2;
                game.audio.playSound(Sounds.TOKEN);
                this.lastKeypressTime = playTime;
            }
            else if (im.enter(true)) {
                this.startGame();
            }
        }

        const pacman: Pacman = game.pacman;
        const ghost: Ghost = game.getGhost(0);

        // Update the animated Pacman
        let moveAmount: number = pacman.moveAmount;
        if (pacman.direction === Direction.WEST) {
            moveAmount = -moveAmount;
        }
        pacman.incX(moveAmount);
        moveAmount = ghost.moveAmount;
        if (ghost.direction === Direction.WEST) {
            moveAmount = -moveAmount;
        }
        ghost.incX(moveAmount);

        // Check whether it's time to turn around
        if (pacman.x + pacman.width >= this.game.getWidth() - 30) {
            pacman.direction = ghost.direction = Direction.WEST;
        }
        else if (ghost.x <= 30) {
            pacman.direction = ghost.direction = Direction.EAST;
        }

        this.updateSpriteFrames();
    }
}
