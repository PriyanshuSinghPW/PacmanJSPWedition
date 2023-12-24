import { Direction } from './Direction';
import { MotionState } from './Ghost';
import { Inky } from './Inky';
import { describe, expect, test } from 'vitest';

describe('Inky', () => {

    test('reset() works as expected', () => {

        const mockGame: any /* PacmanGame */ = {
            checkLoopedSound: () => {}
        };

        const ghost: Inky = new Inky(mockGame);
        ghost.reset();

        expect(ghost.direction).toEqual(Direction.SOUTH);
        expect(ghost.motionState).toEqual(MotionState.IN_BOX);
    });
});
