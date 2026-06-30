import { describe, expect, test } from 'vitest';
import {
    damageActionAmountValue,
    oracleTargetMatchesCard,
    parseOracleActions
} from './OracleParser.mjs';

const card = (typeLine, oracleText = '') => {
    return {
        selectedOption: {
            typeLine,
            oracleText,
        },
    };
};

describe('OracleParser', () => {
    test('Feature: Oracle parser classifies damage actions and target entities.', () => {
        const [action] = parseOracleActions('Abrade deals 3 damage to target creature.');

        expect(action).toMatchObject({
            type: 'damage',
            amount: {
                kind: 'number',
                value: 3,
                raw: '3',
            },
            targets: [
                {
                    selector: 'target',
                    candidates: [
                        {
                            entity: 'permanent',
                            cardTypes: ['creature'],
                        },
                    ],
                },
            ],
        });
        expect(damageActionAmountValue(action)).toBe(3);
        expect(oracleTargetMatchesCard(action.targets[0], card('Creature - Mouse'))).toBe(true);
        expect(oracleTargetMatchesCard(action.targets[0], card('Artifact'))).toBe(false);
    });

    test('Feature: Oracle parser expands broad damage target phrases.', () => {
        const actions = parseOracleActions([
            'Burst Lightning deals 2 damage to any target.',
            'Thunder Magic deals X damage to target creature or planeswalker.',
            'Pyroclasm deals 2 damage to each creature and each player.',
            'Sky spell deals 4 damage to target artifact creature with flying.',
        ].join('\n'));

        expect(actions[0]).toMatchObject({
            amount: {
                kind: 'number',
                value: 2,
            },
            targets: [
                {
                    selector: 'anyTarget',
                    candidates: expect.arrayContaining([
                        expect.objectContaining({ entity: 'player' }),
                        expect.objectContaining({ entity: 'permanent', cardTypes: ['creature'] }),
                        expect.objectContaining({ entity: 'permanent', cardTypes: ['planeswalker'] }),
                        expect.objectContaining({ entity: 'permanent', cardTypes: ['battle'] }),
                    ]),
                },
            ],
        });
        expect(actions[1]).toMatchObject({
            amount: {
                kind: 'variable',
                raw: 'X',
            },
            targets: [
                {
                    selector: 'target',
                    candidates: [
                        expect.objectContaining({ cardTypes: ['creature'] }),
                        expect.objectContaining({ cardTypes: ['planeswalker'] }),
                    ],
                },
            ],
        });
        expect(actions[2].targets).toEqual([
            expect.objectContaining({
                selector: 'each',
                candidates: [expect.objectContaining({ cardTypes: ['creature'] })],
            }),
            expect.objectContaining({
                selector: 'each',
                candidates: [expect.objectContaining({ entity: 'player' })],
            }),
        ]);
        expect(actions[3].targets[0].candidates[0]).toMatchObject({
            entity: 'permanent',
            cardTypes: ['artifact', 'creature'],
            qualifiers: ['with flying'],
        });
        expect(oracleTargetMatchesCard(actions[3].targets[0], card('Artifact Creature - Thopter', 'Flying'))).toBe(true);
        expect(oracleTargetMatchesCard(actions[3].targets[0], card('Artifact Creature - Construct'))).toBe(false);
    });
});
