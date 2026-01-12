import { BaseState } from './BaseState';
import { Maze } from './Maze';
import { PacmanGame } from './PacmanGame';
import { Pacman } from './Pacman';
import { TitleState } from './TitleState';
import Sounds from './Sounds';
import { Ghost, MotionState } from './Ghost';
import { InputManager, Keys, Utils } from 'gtp';
import { Direction } from './Direction';
import { TILE_SIZE } from './Constants';

type Substate = 'READY' | 'IN_GAME' | 'DYING' | 'GAME_OVER';

export class MazeState extends BaseState {

    private readonly mazeFile: number[][];
    private maze: Maze;
    private firstTimeThrough: boolean;
    private updateScoreIndex: number;
    private substate: Substate;
    private substateStartTime: number;
    private nextUpdateTime: number;
    private nextDyingFrameTime: number;
    private lastMazeScreenKeypressTime: number;

    // Touch controls state
    private touchStartX = 0;
    private touchStartY = 0;
    private touchStartTime = 0;
    private touchActive = false;
    private touchSwiped = false;
    private pendingSwipeDir: Direction | null = null;
    private boundTouchStart?: (e: TouchEvent) => void;
    private boundTouchMove?: (e: TouchEvent) => void;
    private boundTouchEnd?: (e: TouchEvent) => void;

    private static readonly DYING_FRAME_DELAY_MILLIS = 75;

    constructor(mazeFile: number[][]) {
        super();
        this.mazeFile = mazeFile;
    }

    private get readyDelayMillis(): number {
        return this.firstTimeThrough ? 4500 : 2000;
    }

    override enter(game: PacmanGame) {

        this.game = game;
        game.pacman.reset();
        game.resetGhosts();

        this.maze = new Maze(game, this.mazeFile);
        this.firstTimeThrough = true;
        this.updateScoreIndex = -1;

        // Prevents the user's "Enter" press to start the game from being
        // picked up by our handleInput().
        this.lastMazeScreenKeypressTime = Utils.timestamp() + MazeState.INPUT_REPEAT_MILLIS;

        this.substate = 'READY';
        this.firstTimeThrough = true;
        this.substateStartTime = 0;
        this.nextDyingFrameTime = 0;
        this.nextUpdateTime = 0;
        this.lastSpriteFrameTime = 0;

        // Attach touch controls for mobile
        const canvas = game.canvas;
        this.boundTouchStart = this.onTouchStart.bind(this);
        this.boundTouchMove = this.onTouchMove.bind(this);
        this.boundTouchEnd = this.onTouchEnd.bind(this);
        canvas.addEventListener('touchstart', this.boundTouchStart, { passive: true });
        canvas.addEventListener('touchmove', this.boundTouchMove, { passive: true });
        canvas.addEventListener('touchend', this.boundTouchEnd, { passive: true });
    }

    override leaving(game: PacmanGame) {
        const canvas = game.canvas;
        if (this.boundTouchStart) canvas.removeEventListener('touchstart', this.boundTouchStart);
        if (this.boundTouchMove) canvas.removeEventListener('touchmove', this.boundTouchMove);
        if (this.boundTouchEnd) canvas.removeEventListener('touchend', this.boundTouchEnd);
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
        const SWIPE_DIST_PX = 14; // Lower threshold for snappier response

        if (adx < SWIPE_DIST_PX && ady < SWIPE_DIST_PX) return;

        // Decide direction on the dominant axis
        let dir: Direction;
        if (adx >= ady) {
            dir = dx < 0 ? Direction.WEST : Direction.EAST;
        }
        else {
            dir = dy < 0 ? Direction.NORTH : Direction.SOUTH;
        }
        this.pendingSwipeDir = dir;
        this.touchSwiped = true; // lock for this gesture

        // Try to apply immediately for instant feel
        if (this.substate === 'IN_GAME' && !this.game.paused) {
            const pac = this.game.pacman;
            const maze = this.maze;
            let applied = false;
            switch (dir) {
                case Direction.WEST:
                    applied = pac.getCanMoveLeft(maze);
                    if (applied) pac.direction = Direction.WEST;
                    break;
                case Direction.EAST:
                    applied = pac.getCanMoveRight(maze);
                    if (applied) pac.direction = Direction.EAST;
                    break;
                case Direction.NORTH:
                    applied = pac.getCanMoveUp(maze);
                    if (applied) pac.direction = Direction.NORTH;
                    break;
                case Direction.SOUTH:
                    applied = pac.getCanMoveDown(maze);
                    if (applied) pac.direction = Direction.SOUTH;
                    break;
            }
            if (!applied) {
                // Keep pending; handleInput will retry when aligned
            }
        }
    }

    private onTouchEnd(e: TouchEvent) {
        if (!this.touchActive) return;
        this.touchActive = false;
        const endTime = performance.now();
        const touch = e.changedTouches[0];
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const dt = endTime - this.touchStartTime;

        // Thresholds tuned for mobile CSS pixels
        const TAP_TIME_MS = 220;
        const TAP_DIST_PX = 12;
        const SWIPE_DIST_PX = 14;

        if (!this.touchSwiped && dt <= TAP_TIME_MS && adx < TAP_DIST_PX && ady < TAP_DIST_PX) {
            // Tap => Enter key mapping: if GAME_OVER, go back to main menu; else toggle pause
            if (this.substate === 'GAME_OVER') {
                this.game.setState(new TitleState(this.game));
            }
            else {
                this.game.paused = !this.game.paused;
            }
            return;
        }

        if (!this.touchSwiped && adx < SWIPE_DIST_PX && ady < SWIPE_DIST_PX) {
            return; // ignore micro movements
        }

        // Determine swipe direction
        if (!this.touchSwiped) {
            let dir: Direction;
            if (adx >= ady) {
                dir = dx < 0 ? Direction.WEST : Direction.EAST;
            }
            else {
                dir = dy < 0 ? Direction.NORTH : Direction.SOUTH;
            }
            this.pendingSwipeDir = dir;
        }
    }

    private paintExtraLives(ctx: CanvasRenderingContext2D) {

        // The indentation on either side of the status stuff at the bottom
        // (extra life count, possible fruits, etc.).
        const BOTTOM_INDENT = 24;
        const TILE_SIZE = 8;
        const game = this.game;

        const lives: number = game.getLives();
        if (lives > 0) {
            let x: number = BOTTOM_INDENT;
            const y: number = game.getHeight() - 2 * TILE_SIZE;
            const w: number = 2 * TILE_SIZE;
            for (let i = 0; i < lives; i++) {
                game.drawSprite(x, y, 12 * 16, 3 * 16);
                x += w;
            }
        }
    }

    private paintPossibleFruits(ctx: CanvasRenderingContext2D) {

        // The indentation on either side of the status stuff at the bottom
        // (extra life count, possible fruits, etc.).
        const BOTTOM_INDENT = 12;
        const game = this.game;

        const x: number = game.getWidth() - BOTTOM_INDENT - 2 * TILE_SIZE;
        const y: number = game.getHeight() - 2 * TILE_SIZE;

        switch (game.getLevel()) {
            default:
            case 7: // Key
                game.drawSprite(x - 112, y, 13 * 16, 3 * 16);
            // Fall through
            case 6: // Space Invaders ship
                game.drawSprite(x - 96, y, 13 * 16, 6 * 16);
            // Fall through
            case 5: // Green thing (grapes?)
                game.drawSprite(x - 80, y, 12 * 16, 6 * 16);
            // Fall through.
            case 4: // Apple
                game.drawSprite(x - 64, y, 13 * 16, 2 * 16);
            // Fall through.
            case 3: // Yellow bell
                game.drawSprite(x - 48, y, 13 * 16, 5 * 16);
            // Fall through.
            case 2: // Peach
                game.drawSprite(x - 32, y, 12 * 16, 5 * 16);
            // Fall through.
            case 1: // Strawberry
                game.drawSprite(x - 16, y, 13 * 16, 4 * 16);
            // Fall through.
            case 0: // Cherry
                game.drawSprite(x, y, 12 * 16, 4 * 16);
                break;
        }
    }

    override render(ctx: CanvasRenderingContext2D) {

        super.render(ctx);
        this.maze.render(ctx);
        const game = this.game;

        const TILE_SIZE = 8;
        const mazeY: number = game.getHeight() - 2 * TILE_SIZE -
            Maze.TILE_COUNT_VERTICAL * TILE_SIZE;
        ctx.translate(0, mazeY);

        game.drawFruit(ctx);

        const pacman: Pacman = game.pacman;
        if (this.updateScoreIndex === -1) {
            if (this.substate !== 'GAME_OVER') {
                pacman.render(ctx);
            }
        }
        else {
            const x: number = pacman.bounds.x;
            const y: number = pacman.bounds.y;
            game.paintPointsEarned(ctx, this.updateScoreIndex, x, y);
        }

        game.drawGhosts(ctx);

        ctx.translate(0, -mazeY);

        game.drawScores(ctx);
        this.paintExtraLives(ctx);
        this.paintPossibleFruits(ctx);

        if (this.substate === 'READY') {
            // These calculations should be fast enough, especially considering
            // that "READY!" is only displayed for about 4 seconds.
            const ready = 'READY!';
            let x: number = (game.getWidth() - ready.length * 9) / 2;
            // Give "Ready!" a little nudge to the right.  This is because the
            // ending '!' doesn't fill up the standard 8 pixels for a character,
            // so "READY!" looks slightly too far to the left without it.
            x += 3;
            game.drawString(x, 160, ready);
        }
        else if (this.substate === 'GAME_OVER') {
            const gameOver = 'GAME OVER';
            const x: number = (game.getWidth() - gameOver.length * 9) / 2;
            game.drawString(x, 160, gameOver);
        }

        if (game.paused) {
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, game.getWidth(), game.getHeight());
            ctx.globalAlpha = 1;
            ctx.fillRect(50, 100, game.getWidth() - 100, game.getHeight() - 200);
            const paused = 'PAUSED';
            const x: number = (game.getWidth() - paused.length * 9) / 2;
            game.drawString(x, (game.getHeight() - 18) / 2, paused);
        }
    }

    reset() {
        this.maze.reset();
        this.game.resetPlayTime();
        this.game.pacman.reset();
        this.game.resetGhosts(); // Do AFTER resetting playtime!
        this.substate = 'READY';
        this.substateStartTime = 0; // Play time was just reset
        this.lastSpriteFrameTime = 0;

        // Prevents the user's "Enter" press to start the game from being
        // picked up by our handleInput().
        this.lastMazeScreenKeypressTime = this.game.playTime + MazeState.INPUT_REPEAT_MILLIS;
    }

    private handleInput(delta: number, time: number) {

        const game = this.game;
        this.handleDefaultKeys();
        const input: InputManager = game.inputManager;
        const now = Utils.timestamp();

        // Enter -> Pause.  Don't check for pausing on "Game Over" screen as
        // that will carry over into the next game!
        if (this.substate !== 'GAME_OVER' &&
                now >= this.lastMazeScreenKeypressTime + MazeState.INPUT_REPEAT_MILLIS &&
                input.enter(true)) {
            game.paused = !game.paused;
            this.lastMazeScreenKeypressTime = now;
            return;
        }

        if (!game.paused) {

            // Apply any pending swipe direction; keep trying until it takes
            if (this.pendingSwipeDir != null && this.substate === 'IN_GAME') {
                const pac = game.pacman;
                const maze = this.maze;
                let applied = false;
                switch (this.pendingSwipeDir) {
                    case Direction.WEST:
                        applied = pac.getCanMoveLeft(maze);
                        if (applied) pac.direction = Direction.WEST;
                        break;
                    case Direction.EAST:
                        applied = pac.getCanMoveRight(maze);
                        if (applied) pac.direction = Direction.EAST;
                        break;
                    case Direction.NORTH:
                        applied = pac.getCanMoveUp(maze);
                        if (applied) pac.direction = Direction.NORTH;
                        break;
                    case Direction.SOUTH:
                        applied = pac.getCanMoveDown(maze);
                        if (applied) pac.direction = Direction.SOUTH;
                        break;
                }
                if (applied) {
                    this.pendingSwipeDir = null;
                }
            }

            switch (this.substate) {

                case 'IN_GAME':
                    game.pacman.handleInput(this.maze);
                    break;

                case 'GAME_OVER':
                    if (input.enter(true)) {
                        game.setState(new TitleState(game));
                    }
                    break;
            }

        }

        if (now >= this.lastMazeScreenKeypressTime + MazeState.INPUT_REPEAT_MILLIS) {

            // Hidden options (Z + keypress)
            if (!game.paused && this.substate === 'IN_GAME' &&
                input.isKeyDown(Keys.KEY_Z)) {

                // Z+X => auto-load next level
                if (input.isKeyDown(Keys.KEY_X)) {
                    game.loadNextLevel();
                    this.lastMazeScreenKeypressTime = now;
                }

                // Z+C => auto-death
                else if (input.isKeyDown(Keys.KEY_C)) {
                    game.startPacmanDying();
                    this.substate = 'DYING';
                    this.nextDyingFrameTime = time + MazeState.DYING_FRAME_DELAY_MILLIS;
                    this.lastMazeScreenKeypressTime = now;
                }
            }

        }
    }

    override update(delta: number) {
        super.update(delta);
        const game = this.game;

        // playTime may reset in handleInput, so we fetch it again afterward
        this.handleInput(delta, game.playTime);
        const time: number = game.playTime;

        switch (this.substate) {

            case 'READY':
                if (this.firstTimeThrough && this.substateStartTime === 0) {
                    this.substateStartTime = time;
                    game.audio.playSound(Sounds.OPENING);
                }
                if (time >= this.substateStartTime + this.readyDelayMillis) {
                    this.substate = 'IN_GAME';
                    this.substateStartTime = time;
                    game.resetPlayTime();
                    // this.lastMazeScreenKeypressTime = game.playTime;
                    game.setLoopedSound(Sounds.SIREN);
                    this.firstTimeThrough = false;
                }
                break;

            case 'IN_GAME':
                this.updateInGameImpl(time);
                break;

            case 'DYING':
                if (time >= this.nextDyingFrameTime) {
                    if (!game.pacman.incDying()) {
                        if (game.increaseLives(-1) <= 0) {
                            this.substate = 'GAME_OVER';
                        }
                        else {
                            game.resetPlayTime();
                            this.lastMazeScreenKeypressTime = game.playTime;
                            game.pacman.reset();
                            game.resetGhosts(); // Do AFTER resetting play time!
                            this.substate = 'READY';
                            this.substateStartTime = 0; // Play time was just reset
                            this.lastSpriteFrameTime = 0;
                        }
                    }
                    else {
                        this.nextDyingFrameTime = time + MazeState.DYING_FRAME_DELAY_MILLIS;
                    }
                }
                break;

            case 'GAME_OVER':
                // Do nothing
                break;
        }
    }

    private updateInGameImpl(time: number) {

        // If Pacman is eating a ghost, add a slight delay
        if (this.nextUpdateTime > 0 && time < this.nextUpdateTime) {
            return;
        }
        this.nextUpdateTime = 0;
        this.updateScoreIndex = -1;

        this.updateSpriteFrames();

        // Update Pacman's, ghosts', and possibly fruit's positions
        const game = this.game;
        game.updateSpritePositions(this.maze, time);

        // If Pacman hit a ghost, decide what to do
        const ghostHit: Ghost | null = game.checkForCollisions();
        if (ghostHit) {

            switch (ghostHit.getMotionState()) {

                case MotionState.BLUE:
                    this.nextUpdateTime = time + PacmanGame.SCORE_DISPLAY_LENGTH;
                    ghostHit.setMotionState(MotionState.EYES);
                    this.updateScoreIndex = game.ghostEaten(ghostHit);
                    break;

                case MotionState.EYES:
                case MotionState.EYES_ENTERING_BOX:
                    // Do nothing
                    break;

                default:
                    if (!game.isGodMode()) {
                        game.startPacmanDying();
                        this.substate = 'DYING';
                        this.nextDyingFrameTime = game.playTime + MazeState.DYING_FRAME_DELAY_MILLIS;
                    }
                    break;
            }
        }
    }
}
