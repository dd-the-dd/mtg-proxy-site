import { describe, expect, test } from 'vitest';
import {
    damageActionAmountValue,
    OracleParseError,
    oracleTargetMatchesCard,
    parseOracleActions,
    parseOracleDocument
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

    test('Feature: Oracle parser reports unsupported oracle clauses for audit.', () => {
        const result = parseOracleDocument([
            'Abrade deals 3 damage to target creature.',
            'Tap target creature.',
            'Mystery Bolt deals damage equal to the number of cards in your hand to target creature.',
            'Wildfire deals 3 damage divided as you choose among one, two, or three targets.',
        ].join('\n'), { cardName: 'Parser Fixture' });

        expect(result.actions).toHaveLength(1);
        expect(result.errors).toEqual([
            expect.objectContaining({
                cardName: 'Parser Fixture',
                code: 'unsupported_oracle_clause',
                clause: 'Tap target creature.',
            }),
            expect.objectContaining({
                code: 'unsupported_damage_amount',
                clause: 'Mystery Bolt deals damage equal to the number of cards in your hand to target creature.',
            }),
            expect.objectContaining({
                code: 'unsupported_damage_target',
                clause: 'Wildfire deals 3 damage divided as you choose among one, two, or three targets.',
            }),
        ]);
    });

    test('Feature: Oracle parser strict mode raises parse errors for unsupported oracle text.', () => {
        expect(() => parseOracleActions('Tap target creature.', { strict: true })).toThrow(OracleParseError);

        try {
            parseOracleActions('Tap target creature.', { strict: true, cardName: 'Strict Fixture' });
        } catch (error) {
            expect(error).toBeInstanceOf(OracleParseError);
            expect(error.errors).toEqual([
                expect.objectContaining({
                    cardName: 'Strict Fixture',
                    code: 'unsupported_oracle_clause',
                    clause: 'Tap target creature.',
                }),
            ]);
        }
    });

    test('Feature: Oracle parser classifies conditional enters-tapped clauses across entity scopes.', () => {
        const result = parseOracleDocument([
            'This land enters tapped unless you control a Plains or an Island.',
            'This artifact enters tapped unless you control a creature or planeswalker.',
            'This creature enters tapped unless you control a legendary permanent or a permanent named Cori Mountain Monastery.',
        ].join('\n'), { cardName: 'Conditional ETB Fixture' });

        expect(result.errors).toEqual([]);
        expect(result.actions).toHaveLength(3);
        expect(result.actions[0]).toMatchObject({
            type: 'entersBattlefieldState',
            source: {
                reference: 'this',
                cardTypes: ['land'],
            },
            state: {
                tapped: true,
            },
            condition: {
                operator: 'unless',
                predicate: {
                    name: 'youControlAny',
                    candidates: [
                        expect.objectContaining({
                            identifier: expect.objectContaining({
                                raw: 'Plains',
                                possibleKinds: expect.arrayContaining(['subtype', 'cardName']),
                            }),
                        }),
                        expect.objectContaining({
                            identifier: expect.objectContaining({
                                raw: 'Island',
                                possibleKinds: expect.arrayContaining(['subtype', 'cardName']),
                            }),
                        }),
                    ],
                },
            },
        });
        expect(result.actions[1].condition.predicate.candidates).toEqual([
            expect.objectContaining({ cardTypes: ['creature'] }),
            expect.objectContaining({ cardTypes: ['planeswalker'] }),
        ]);
        expect(result.actions[2].condition.predicate.candidates).toEqual([
            expect.objectContaining({
                cardTypes: [],
                supertypes: ['legendary'],
            }),
            expect.objectContaining({
                cardName: 'Cori Mountain Monastery',
            }),
        ]);
    });
});
