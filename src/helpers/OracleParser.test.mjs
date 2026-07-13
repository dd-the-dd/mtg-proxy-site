import { describe, expect, test } from 'vitest';
import {
    buildOracleAbilityEntities,
    buildOracleRuleGraph,
    extractOracleEntities,
    ruleLanguagePalette
} from './OracleRuleGraph.mjs';
import {
    damageActionAmountValue,
    OracleParseError,
    oracleTargetMatchesCard,
    parseDamageActions,
    parseOracleActions,
    parseOracleConcepts,
    parseOracleDocument,
    parseOracleTargets,
    parseOracleSegments
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
            type: 'hook',
            event: 'enterBattlefield',
            source: {
                reference: 'this',
                cardTypes: ['land'],
            },
            branches: [
                {
                    id: 'entersTapped',
                    condition: {
                        name: 'not',
                        params: {
                            condition: {
                                name: 'youControlAny',
                                params: {
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
                        },
                    },
                    state: {
                        tapped: true,
                    },
                },
                {
                    id: 'entersUntapped',
                    condition: {
                        name: 'youControlAny',
                    },
                    state: {
                        tapped: false,
                    },
                },
            ],
        });
        expect(result.actions[1].branches[1].condition.params.candidates).toEqual([
            expect.objectContaining({ cardTypes: ['creature'] }),
            expect.objectContaining({ cardTypes: ['planeswalker'] }),
        ]);
        expect(result.actions[2].branches[1].condition.params.candidates).toEqual([
            expect.objectContaining({
                cardTypes: [],
                supertypes: ['legendary'],
            }),
            expect.objectContaining({
                cardName: 'Cori Mountain Monastery',
            }),
        ]);
    });

    test('Feature: Oracle analysis parser emits word-state segments with annotations and unparsable states.', () => {
        const result = parseOracleDocument([
            'This land enters tapped unless you control a Plains or an Island.',
            '{T}: Add {U}.',
            'Tap target creature.',
        ].join('\n'), { cardName: 'Segment Fixture' });

        expect(result.segments).toEqual([
            expect.objectContaining({
                annotationKind: 'hook',
                annotations: [
                    expect.objectContaining({
                        kind: 'hook',
                        label: 'ETB hook',
                    }),
                ],
                parser: expect.objectContaining({
                    mode: 'word-state-machine',
                    state: 'complete',
                }),
                text: 'This land enters tapped unless you control a Plains or an Island.',
            }),
            expect.objectContaining({
                annotationKind: 'option',
                annotations: [
                    expect.objectContaining({
                        kind: 'option',
                        label: 'Mana ability',
                    }),
                ],
                text: '{T}: Add {U}.',
            }),
            expect.objectContaining({
                annotationKind: 'unsupported',
                annotations: [
                    expect.objectContaining({
                        kind: 'unsupported',
                        label: 'Unsupported clause',
                    }),
                ],
                parser: expect.objectContaining({
                    mode: 'word-state-machine',
                    state: 'unparsable',
                    unexpectedToken: 'Tap',
                }),
                text: 'Tap target creature.',
            }),
        ]);
        expect(result.errors[0]).toMatchObject({
            code: 'unsupported_oracle_clause',
            details: expect.objectContaining({
                parserMode: 'word-state-machine',
                unexpectedToken: 'Tap',
            }),
        });
    });

    test('Feature: Oracle parser treats tap mana abilities as battlefield options.', () => {
        const result = parseOracleDocument('{T}: Add {R}.', { cardName: 'Cori Mountain Monastery' });

        expect(result.errors).toEqual([]);
        expect(result.actions).toEqual([
            expect.objectContaining({
                type: 'manaAbility',
                sourceZone: 'battlefield',
                costs: [
                    expect.objectContaining({
                        target: 'source',
                        type: 'tap',
                    }),
                ],
                conditions: [
                    expect.objectContaining({ name: 'sourceOnBattlefield' }),
                    expect.objectContaining({ name: 'sourceUntapped' }),
                ],
                actions: [
                    expect.objectContaining({
                        name: 'addMana',
                        params: expect.objectContaining({
                            mana: ['R'],
                            player: 'controller',
                        }),
                    }),
                ],
            }),
        ]);
    });

    test('Feature: Oracle analysis parser can merge multi-sentence ability text into one annotated segment.', () => {
        const segments = parseOracleSegments('Whenever you cast a spell, draw a card. This ability triggers only once each turn.');

        expect(segments).toHaveLength(1);
        expect(segments[0]).toMatchObject({
            annotationKind: 'hook',
            text: 'Whenever you cast a spell, draw a card. This ability triggers only once each turn.',
            annotations: [
                expect.objectContaining({
                    kind: 'hook',
                    label: 'Cast trigger',
                }),
            ],
        });
    });

    test('Feature: Oracle parser merges exile-top play-permission abilities from parser feedback.', () => {
        const result = parseOracleDocument([
            'This land enters tapped unless you control a Plains or an Island.',
            '{T}: Add {R}.',
            '{3}{R}, {T}: Exile the top card of your library.',
            'Until the end of your next turn, you may play that card.',
        ].join('\n'), { cardName: 'Cori Mountain Monastery' });
        const impulseSegment = result.segments.find(segment => segment.text.includes('Exile the top card'));
        const impulseAction = result.actions.find(action => action.type === 'temporaryExilePlayPermission');

        expect(result.errors).toEqual([]);
        expect(result.segments).toHaveLength(3);
        expect(impulseSegment).toMatchObject({
            annotationKind: 'option',
            annotations: [
                expect.objectContaining({
                    kind: 'option',
                    label: 'Play exiled top card',
                }),
            ],
            parser: expect.objectContaining({
                mode: 'word-state-machine',
                state: 'complete',
            }),
            text: '{3}{R}, {T}: Exile the top card of your library. Until the end of your next turn, you may play that card.',
        });
        expect(impulseSegment.concepts).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'choice', name: 'youMay' }),
            expect.objectContaining({ kind: 'hook', name: 'endOfNextTurn' }),
            expect.objectContaining({ kind: 'action', name: 'moveCards' }),
            expect.objectContaining({ kind: 'action', name: 'grantZonePlayPermission' }),
        ]));
        expect(impulseAction).toMatchObject({
            costs: [
                expect.objectContaining({ type: 'mana', value: '{3}{R}' }),
                expect.objectContaining({ type: 'tap', target: 'source' }),
            ],
            actions: [
                expect.objectContaining({
                    name: 'moveCards',
                    params: expect.objectContaining({
                        amount: 1,
                        fromZone: 'library',
                        owner: 'controller',
                        position: 'top',
                        toZone: 'exile',
                    }),
                }),
                expect.objectContaining({
                    name: 'grantZonePlayPermission',
                    params: expect.objectContaining({
                        cardRef: 'thatCard',
                        duration: 'untilEndOfNextTurn',
                        player: 'controller',
                        zone: 'exile',
                    }),
                }),
                expect.objectContaining({
                    name: 'schedulePermissionCleanup',
                    params: expect.objectContaining({
                        at: 'endOfNextTurn',
                        permission: 'playFromExile',
                    }),
                }),
            ],
        });
    });

    test('Feature: Oracle parser exposes stack protection from uncounterable spells and delayed land abilities.', () => {
        const staticResult = parseOracleDocument("This spell can't be countered.", {
            cardName: 'Inevitable Defeat',
        });
        const delayedResult = parseOracleDocument("{U}, {T}: The next spell you cast this turn can't be countered.", {
            cardName: 'Mistrise Village',
        });

        expect(staticResult.errors).toEqual([]);
        expect(staticResult.actions).toEqual([
            expect.objectContaining({
                type: 'spellStaticAbility',
                property: 'cantBeCountered',
                sourceZone: 'stack',
                actions: [
                    expect.objectContaining({
                        name: 'modifyStackObject',
                        params: expect.objectContaining({
                            duration: 'whileOnStack',
                            target: 'sourceSpell',
                            modifiers: [
                                expect.objectContaining({
                                    property: 'cantBeCountered',
                                    value: true,
                                }),
                            ],
                        }),
                    }),
                ],
            }),
        ]);
        expect(staticResult.segments[0]).toMatchObject({
            annotationKind: 'option',
            annotations: [
                expect.objectContaining({
                    label: "Can't be countered",
                }),
            ],
        });
        expect(staticResult.segments[0].concepts).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'action', name: 'modifyStackObject' }),
        ]));

        expect(delayedResult.errors).toEqual([]);
        expect(delayedResult.actions).toEqual([
            expect.objectContaining({
                type: 'nextSpellCantBeCountered',
                sourceZone: 'battlefield',
                costs: [
                    expect.objectContaining({ type: 'mana', value: '{U}' }),
                    expect.objectContaining({ type: 'tap', target: 'source' }),
                ],
                actions: [
                    expect.objectContaining({
                        name: 'addDelayedHook',
                        params: expect.objectContaining({
                            duration: 'thisTurn',
                            event: 'cast',
                            limit: 'nextSpellYouCast',
                            actions: [
                                expect.objectContaining({
                                    name: 'modifyStackObject',
                                    params: expect.objectContaining({
                                        target: 'event.spell',
                                    }),
                                }),
                            ],
                        }),
                    }),
                ],
            }),
        ]);
        expect(delayedResult.segments[0].concepts).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'hook', name: 'cast' }),
            expect.objectContaining({ kind: 'action', name: 'addDelayedHook' }),
            expect.objectContaining({ kind: 'action', name: 'modifyStackObject' }),
        ]));
    });

    test('Feature: Oracle parser merges choose-one modal choices with target requirements.', () => {
        const result = parseOracleDocument([
            'Choose one \u2014',
            '\u2022 Abrade deals 3 damage to target creature.',
            '\u2022 Destroy target artifact.',
        ].join('\n'), { cardName: 'Abrade' });
        const modal = result.actions[0];
        const modalDamage = parseDamageActions([
            'Choose one \u2014',
            '\u2022 Abrade deals 3 damage to target creature.',
            '\u2022 Destroy target artifact.',
        ].join('\n'), { cardName: 'Abrade' });

        expect(result.errors).toEqual([]);
        expect(result.segments).toHaveLength(1);
        expect(result.segments[0]).toMatchObject({
            annotationKind: 'option',
            annotations: [
                expect.objectContaining({
                    label: 'Choose one',
                }),
            ],
            text: 'Choose one \u2014 Abrade deals 3 damage to target creature. Destroy target artifact.',
        });
        expect(modal).toMatchObject({
            type: 'modalSpell',
            mode: 'chooseOne',
            sourceZone: 'stack',
            choices: [
                expect.objectContaining({
                    actions: [
                        expect.objectContaining({
                            type: 'damage',
                            amount: expect.objectContaining({ value: 3 }),
                        }),
                    ],
                    targets: [
                        expect.objectContaining({
                            candidates: [
                                expect.objectContaining({ cardTypes: ['creature'] }),
                            ],
                        }),
                    ],
                }),
                expect.objectContaining({
                    actions: [
                        expect.objectContaining({
                            type: 'destroyPermanent',
                        }),
                    ],
                    targets: [
                        expect.objectContaining({
                            candidates: [
                                expect.objectContaining({ cardTypes: ['artifact'] }),
                            ],
                        }),
                    ],
                }),
            ],
            targets: expect.arrayContaining([
                expect.objectContaining({
                    candidates: [
                        expect.objectContaining({ cardTypes: ['creature'] }),
                    ],
                }),
                expect.objectContaining({
                    candidates: [
                        expect.objectContaining({ cardTypes: ['artifact'] }),
                    ],
                }),
            ]),
        });
        expect(result.segments[0].concepts).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'choice', name: 'chooseOne' }),
            expect.objectContaining({ kind: 'action', name: 'dealDamage' }),
            expect.objectContaining({ kind: 'action', name: 'destroyPermanent' }),
            expect.objectContaining({ kind: 'target', name: 'targetSpec' }),
        ]));
        expect(modalDamage).toEqual([
            expect.objectContaining({
                amount: expect.objectContaining({ value: 3 }),
            }),
        ]);
    });

    test('Feature: Oracle parser exposes high-level concepts before detailed mechanics.', () => {
        const result = parseOracleDocument([
            'This land enters tapped unless you control a Plains or an Island.',
            'Choose one -- Abrade deals 3 damage to target creature.',
        ].join('\n'), { cardName: 'Abrade' });

        expect(result.segments[0].concepts).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'hook', name: 'enterBattlefield' }),
            expect.objectContaining({ kind: 'booleanLogic', name: 'unless' }),
            expect.objectContaining({ kind: 'condition', name: 'youControlAny' }),
            expect.objectContaining({ kind: 'action', name: 'modifyPermanent' }),
        ]));
        expect(result.segments[1].concepts).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'choice', name: 'chooseOne' }),
            expect.objectContaining({ kind: 'action', name: 'dealDamage' }),
            expect.objectContaining({
                kind: 'target',
                selector: 'target',
                candidates: [expect.objectContaining({ cardTypes: ['creature'] })],
            }),
        ]));
    });

    test('Feature: Oracle target concept detection resolves source-card self references by full name or prefix.', () => {
        const fullNameTargets = parseOracleTargets('Slickshot Show-Off', { cardName: 'Slickshot Show-Off' });
        const prefixTargets = parseOracleTargets('Slickshot', { cardName: 'Slickshot Show-Off' });
        const concepts = parseOracleConcepts('Slickshot gets +2/+0 until end of turn.', {
            cardName: 'Slickshot Show-Off',
        });

        expect(fullNameTargets[0]).toMatchObject({
            selector: 'self',
            candidates: [
                expect.objectContaining({
                    cardName: 'Slickshot Show-Off',
                    reference: 'source',
                }),
            ],
        });
        expect(prefixTargets[0]).toMatchObject({
            selector: 'self',
            candidates: [
                expect.objectContaining({
                    matchedName: 'Slickshot',
                    reference: 'source',
                }),
            ],
        });
        expect(concepts).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: 'target',
                name: 'selfReference',
            }),
            expect.objectContaining({
                kind: 'action',
                name: 'modifyPermanent',
            }),
        ]));
    });

    test('Feature: Oracle finite-state parser handles meta creature cast-pump triggers.', () => {
        const result = parseOracleDocument(
            'Whenever you cast a noncreature spell, this creature gets +2/+0 until end of turn.',
            { cardName: 'Slickshot Show-Off' },
        );

        expect(result.errors).toEqual([]);
        expect(result.actions).toEqual([
            expect.objectContaining({
                type: 'hook',
                event: 'cast',
                condition: {
                    name: 'spellCastMatches',
                    params: {
                        cardTypes: [],
                        controller: 'hookController',
                        nonCreature: true,
                    },
                },
                action: {
                    name: 'modifyPermanent',
                    params: {
                        duration: 'untilEndOfTurn',
                        powerDelta: 2,
                        target: 'hookSource',
                        toughnessDelta: 0,
                    },
                },
            }),
        ]);
    });

    test('Feature: Oracle finite-state rule graph exposes layered parser categories and primitive scripts.', () => {
        const graph = buildOracleRuleGraph('Scry 1.\nDraw a card.', { cardName: 'Opt' });

        expect(ruleLanguagePalette.map(entry => entry.key)).toEqual([
            'actionPrimitive',
            'readPrimitive',
            'predicate',
            'entityReference',
            'cost',
            'trigger',
            'timing',
            'logic',
            'magicVocabulary',
            'effectBlock',
        ]);
        expect(graph.errors).toEqual([]);
        expect(graph.stateMachines.map(machine => machine.level)).toEqual([
            'entityExtraction',
            'abilityEntity',
            'document',
            'ability',
            'boolean',
            'reference',
            'vocabulary',
            'primitive',
        ]);
        expect(graph.stages.map(stage => stage.key)).toEqual([
            'entityRetrieval',
            'abilityEntityFsm',
            'documentFsm',
            'abilityClassifier',
            'referenceExtraction',
            'vocabularyExpansion',
            'primitiveExpansion',
        ]);
        expect(graph.stages[0]).toMatchObject({
            title: 'Entity retrieval',
            status: 'ready',
        });
        expect(graph.stages[0].items).toEqual(expect.arrayContaining([
            expect.objectContaining({
                category: 'magicVocabulary',
                label: 'Scry',
                type: 'actionWord',
            }),
            expect.objectContaining({
                category: 'logic',
                label: '1',
                type: 'quantity',
            }),
            expect.objectContaining({
                category: 'magicVocabulary',
                label: 'Draw',
                type: 'actionWord',
            }),
        ]));
        expect(graph.segments).toEqual([
            expect.objectContaining({
                text: 'Scry 1.',
                effectBlocks: [
                    expect.objectContaining({
                        kind: 'SpellEffect',
                        script: expect.arrayContaining([
                            expect.objectContaining({
                                category: 'magicVocabulary',
                                name: 'scry',
                                primitives: expect.arrayContaining([
                                    expect.objectContaining({
                                        category: 'actionPrimitive',
                                        name: 'moveCard',
                                        params: expect.objectContaining({
                                            from: expect.objectContaining({
                                                position: 'top',
                                                zone: 'library',
                                            }),
                                            to: expect.objectContaining({
                                                position: 'bottomOrTopChoice',
                                                zone: 'library',
                                            }),
                                        }),
                                    }),
                                ]),
                            }),
                        ]),
                    }),
                ],
            }),
            expect.objectContaining({
                text: 'Draw a card.',
                effectBlocks: [
                    expect.objectContaining({
                        script: expect.arrayContaining([
                            expect.objectContaining({
                                category: 'magicVocabulary',
                                name: 'drawCards',
                                primitives: expect.arrayContaining([
                                    expect.objectContaining({
                                        category: 'actionPrimitive',
                                        name: 'moveCard',
                                        params: expect.objectContaining({
                                            from: expect.objectContaining({
                                                position: 'top',
                                                zone: 'library',
                                            }),
                                            to: expect.objectContaining({
                                                zone: 'hand',
                                            }),
                                        }),
                                    }),
                                ]),
                            }),
                        ]),
                    }),
                ],
            }),
        ]);
    });

    test('Feature: Oracle entity extraction emits semantic tokens and phrase entities before document parsing.', () => {
        const extraction = extractOracleEntities(
            '{2}, {T}: Copy target enchantment you control. If it is an Aura, untap Yenna, then scry 2.',
            { cardName: 'Yenna, Redtooth Regent' },
        );

        expect(extraction.errors).toEqual([]);
        expect(extraction.tokens).toEqual(expect.arrayContaining([
            expect.objectContaining({ category: 'cost', raw: '{2}', type: 'manaSymbol' }),
            expect.objectContaining({ category: 'cost', raw: '{T}', type: 'tapSymbol' }),
            expect.objectContaining({ category: 'cost', raw: ':', type: 'abilitySeparator' }),
            expect.objectContaining({ category: 'magicVocabulary', raw: 'Copy', type: 'actionWord' }),
            expect.objectContaining({ category: 'entityReference', raw: 'target', type: 'targetMarker' }),
            expect.objectContaining({ category: 'entityReference', raw: 'you', type: 'playerReference' }),
            expect.objectContaining({ category: 'logic', raw: 'If', type: 'conditionalBranchWord' }),
            expect.objectContaining({ category: 'entityReference', raw: 'it', type: 'relativeReference' }),
            expect.objectContaining({ category: 'magicVocabulary', raw: 'scry', type: 'actionWord' }),
        ]));
        expect(extraction.phrases).toEqual(expect.arrayContaining([
            expect.objectContaining({
                category: 'entityReference',
                label: 'target enchantment you control',
                type: 'targetReference',
            }),
            expect.objectContaining({
                category: 'predicate',
                label: 'it is an Aura',
                type: 'typePredicate',
            }),
            expect.objectContaining({
                category: 'magicVocabulary',
                label: 'scry 2',
                type: 'vocabularyAction',
            }),
        ]));
    });

    test('Feature: Oracle ability entity FSM simplifies extracted entities into engine-readable ability language.', () => {
        const extraction = extractOracleEntities([
            'This land enters tapped unless you control a Plains or an Island.',
            '{T}: Add {R}.',
        ].join('\n'), { cardName: 'Cori Mountain Monastery' });
        const abilityEntities = buildOracleAbilityEntities(extraction);

        expect(abilityEntities.errors).toEqual([]);
        expect(abilityEntities.operations.map(operation => operation.type)).toEqual([
            'selfRef',
            'hook',
            'setTapped',
            'logicOperator',
            'selfRef',
            'measureState',
            'quantity',
            'subtype',
            'booleanOperator',
            'quantity',
            'subtype',
            'cost',
            'abilitySeparator',
            'addMana',
            'manaSymbol',
        ]);
        expect(abilityEntities.operations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                label: 'This land',
                params: expect.objectContaining({ cardTypes: ['land'] }),
                role: 'source',
                type: 'selfRef',
            }),
            expect.objectContaining({
                event: 'enterBattlefield',
                label: 'enters',
                type: 'hook',
            }),
            expect.objectContaining({
                label: 'setTapped',
                params: expect.objectContaining({ state: 'tapped', value: true }),
                type: 'setTapped',
            }),
            expect.objectContaining({
                label: 'unless',
                operator: 'unless',
                type: 'logicOperator',
            }),
            expect.objectContaining({
                label: 'you',
                role: 'player',
                type: 'selfRef',
            }),
            expect.objectContaining({
                label: 'control',
                measure: 'control',
                type: 'measureState',
            }),
            expect.objectContaining({
                label: 'a',
                params: expect.objectContaining({ amount: 1 }),
                type: 'quantity',
            }),
            expect.objectContaining({
                label: 'Plains',
                params: expect.objectContaining({ subtype: 'Plains' }),
                type: 'subtype',
            }),
            expect.objectContaining({
                label: 'or',
                operator: 'or',
                type: 'booleanOperator',
            }),
            expect.objectContaining({
                label: 'Island',
                params: expect.objectContaining({ subtype: 'Island' }),
                type: 'subtype',
            }),
        ]));
    });

    test('Feature: Oracle entity extraction classifies conditional ETB idioms for Cori Mountain Monastery.', () => {
        const extraction = extractOracleEntities([
            'This land enters tapped unless you control a Plains or an Island.',
            '{T}: Add {R}.',
        ].join('\n'), { cardName: 'Cori Mountain Monastery' });

        expect(extraction.tokens).toEqual(expect.arrayContaining([
            expect.objectContaining({ category: 'trigger', raw: 'enters', type: 'zoneTransitionWord' }),
            expect.objectContaining({ category: 'predicate', raw: 'tapped', type: 'permanentStateWord' }),
            expect.objectContaining({ category: 'logic', raw: 'unless', type: 'conditionalBranchWord' }),
            expect.objectContaining({ category: 'logic', raw: 'a', type: 'articleWord' }),
            expect.objectContaining({ category: 'logic', raw: 'an', type: 'articleWord' }),
        ]));
        expect(extraction.tokens.filter(token => token.type === 'unknownWord')).toEqual([]);
        expect(extraction.phrases).toEqual(expect.arrayContaining([
            expect.objectContaining({
                category: 'entityReference',
                label: 'This land',
                type: 'selfTypeReference',
            }),
            expect.objectContaining({
                category: 'trigger',
                label: 'enters tapped',
                type: 'battlefieldEnterState',
            }),
            expect.objectContaining({
                category: 'logic',
                label: 'unless you control a Plains or an Island',
                type: 'conditionalBranch',
            }),
        ]));
    });

    test('Feature: Oracle finite-state parser handles meta-card exile and linked life-change effects.', () => {
        const result = parseOracleDocument([
            "This spell can't be countered.",
            'Exile target nonland permanent.',
            'Its controller loses 3 life and you gain 3 life.',
        ].join('\n'), { cardName: 'Inevitable Defeat' });
        const graph = buildOracleRuleGraph([
            "This spell can't be countered.",
            'Exile target nonland permanent.',
            'Its controller loses 3 life and you gain 3 life.',
        ].join('\n'), { cardName: 'Inevitable Defeat' });

        expect(result.errors).toEqual([]);
        expect(result.actions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'exilePermanent',
                targets: [
                    expect.objectContaining({
                        candidates: [
                            expect.objectContaining({
                                entity: 'permanent',
                                excludedCardTypes: ['land'],
                            }),
                        ],
                    }),
                ],
            }),
            expect.objectContaining({
                type: 'lifeChange',
                changes: [
                    expect.objectContaining({
                        amount: 3,
                        direction: 'lose',
                        player: expect.objectContaining({
                            reference: 'controllerOf',
                            targetRef: 'it',
                        }),
                    }),
                    expect.objectContaining({
                        amount: 3,
                        direction: 'gain',
                        player: expect.objectContaining({
                            reference: 'you',
                        }),
                    }),
                ],
            }),
        ]));
        expect(graph.errors).toEqual([]);
        expect(graph.segments.flatMap(segment => segment.effectBlocks)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: 'SpellEffect',
                script: expect.arrayContaining([
                    expect.objectContaining({
                        name: 'exilePermanent',
                        primitives: expect.arrayContaining([
                            expect.objectContaining({
                                name: 'movePermanentToZone',
                            }),
                        ]),
                    }),
                ]),
            }),
            expect.objectContaining({
                kind: 'SpellEffect',
                script: expect.arrayContaining([
                    expect.objectContaining({
                        name: 'loseLife',
                    }),
                    expect.objectContaining({
                        name: 'gainLife',
                    }),
                ]),
            }),
        ]));
    });
});
