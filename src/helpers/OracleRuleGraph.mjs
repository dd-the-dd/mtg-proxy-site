import { parseOracleDocument } from './OracleParser.mjs';

export const ruleLanguagePalette = [
    {
        color: 'green',
        key: 'actionPrimitive',
        label: 'Action primitive',
    },
    {
        color: 'blue',
        key: 'readPrimitive',
        label: 'Read primitive',
    },
    {
        color: 'purple',
        key: 'predicate',
        label: 'Predicate',
    },
    {
        color: 'yellow',
        key: 'entityReference',
        label: 'Entity reference',
    },
    {
        color: 'orange',
        key: 'cost',
        label: 'Cost',
    },
    {
        color: 'red',
        key: 'trigger',
        label: 'Trigger',
    },
    {
        color: 'cyan',
        key: 'timing',
        label: 'Timing',
    },
    {
        color: 'gray',
        key: 'logic',
        label: 'Logic',
    },
    {
        color: 'brown',
        key: 'magicVocabulary',
        label: 'Magic vocabulary',
    },
    {
        color: 'white',
        key: 'effectBlock',
        label: 'Effect block',
    },
];

export const oracleRuleStateMachines = [
    {
        level: 'entityExtraction',
        states: ['start', 'manaSymbol', 'tapSymbol', 'separator', 'triggerWord', 'logicWord', 'referenceWord', 'actionWord', 'phraseMerge', 'accepted'],
        summary: 'Turns words and short phrases into semantic entities before document and ability parsing.',
    },
    {
        level: 'document',
        states: ['start', 'scanClause', 'mergeLinkedClauses', 'segmentAccepted', 'unsupported'],
        summary: 'Splits official Oracle text into clause groups and merges clauses that form one ability.',
    },
    {
        level: 'ability',
        states: ['start', 'option', 'triggeredAbility', 'staticModifier', 'replacement', 'spellEffect', 'unsupported'],
        summary: 'Classifies each segment into a player option, trigger, static modifier, replacement, or spell effect.',
    },
    {
        level: 'boolean',
        states: ['start', 'predicate', 'not', 'and', 'or', 'comparison', 'accepted'],
        summary: 'Builds condition trees from reads, predicates, boolean operators, and grouped expressions.',
    },
    {
        level: 'reference',
        states: ['start', 'self', 'you', 'target', 'chosen', 'zonePosition', 'setReference', 'accepted'],
        summary: 'Resolves entity references, including true Magic targets and non-target references.',
    },
    {
        level: 'vocabulary',
        states: ['start', 'draw', 'mill', 'scry', 'damage', 'destroy', 'exile', 'copy', 'lifeChange', 'accepted'],
        summary: 'Recognizes Magic vocabulary that can expand to lower-level primitive scripts.',
    },
    {
        level: 'primitive',
        states: ['start', 'readState', 'mutateState', 'emitEvent', 'enqueueChoice', 'accepted'],
        summary: 'Runs minimal state mutations and event emissions after Magic vocabulary is expanded.',
    },
];

const actionWords = new Set([
    'add',
    'copy',
    'counter',
    'create',
    'deal',
    'deals',
    'destroy',
    'discard',
    'draw',
    'exile',
    'gain',
    'gains',
    'gets',
    'look',
    'lose',
    'loses',
    'mill',
    'play',
    'put',
    'return',
    'sacrifice',
    'scry',
    'search',
    'tap',
    'untap',
]);
const cardTypeWords = new Set(['artifact', 'battle', 'card', 'creature', 'enchantment', 'land', 'permanent', 'planeswalker', 'spell']);
const choiceWords = new Set(['choose', 'may', 'modal']);
const costWords = new Set(['discard', 'pay', 'sacrifice']);
const logicWords = new Set(['and', 'if', 'instead', 'not', 'or', 'then', 'unless', 'where']);
const numberWords = new Set(['a', 'an', 'any', 'eight', 'five', 'four', 'nine', 'one', 'seven', 'six', 'ten', 'three', 'two', 'x']);
const playerReferenceWords = new Set(['controller', 'controllers', 'opponent', 'opponents', 'owner', 'owners', 'their', 'you', 'your']);
const predicateWords = new Set(['control', 'controls', 'is', 'was']);
const relativeReferenceWords = new Set(['it', 'its', 'source', 'that', 'them', 'this']);
const triggerWords = new Set(['at', 'when', 'whenever']);
const zoneWords = new Set(['battlefield', 'exile', 'graveyard', 'hand', 'library', 'stack']);

function normalizeExtractionText(value) {
    return String(value ?? '')
        .replace(/\r/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();
}

function rawOracleTokens(value) {
    return [...String(value ?? '').replace(/\r/g, '\n').matchAll(/\{[^}]+\}|[.,;:]|[+-]?\d+\/[+-]?\d+|[A-Za-z0-9][A-Za-z0-9'+/-]*/g)].map(match => {
        return {
            index: match.index ?? 0,
            raw: match[0],
            value: match[0].toLowerCase(),
        };
    });
}

function tokenEntity(rawToken, index) {
    const raw = rawToken.raw;
    const value = rawToken.value;
    const base = {
        index,
        label: raw,
        raw,
        start: rawToken.index,
        value,
    };

    if (/^\{[tq]}$/i.test(raw)) {
        return {
            ...base,
            category: 'cost',
            type: raw.toUpperCase() === '{T}' ? 'tapSymbol' : 'untapSymbol',
        };
    }
    if (/^\{[^}]+}$/.test(raw)) {
        return {
            ...base,
            category: 'cost',
            type: 'manaSymbol',
        };
    }
    if (raw === ':') {
        return {
            ...base,
            category: 'cost',
            type: 'abilitySeparator',
        };
    }
    if (raw === ',' || raw === ';' || raw === '.') {
        return {
            ...base,
            category: 'logic',
            type: raw === ',' ? 'actionSeparator' : 'sentenceBoundary',
        };
    }
    if (triggerWords.has(value)) {
        return {
            ...base,
            category: 'trigger',
            type: 'triggerWord',
        };
    }
    if (logicWords.has(value)) {
        return {
            ...base,
            category: 'logic',
            type: 'logicWord',
        };
    }
    if (choiceWords.has(value)) {
        return {
            ...base,
            category: 'effectBlock',
            type: 'choiceWord',
        };
    }
    if (value === 'target') {
        return {
            ...base,
            category: 'entityReference',
            type: 'targetMarker',
        };
    }
    if (/^\d+$/.test(value) || numberWords.has(value)) {
        return {
            ...base,
            category: 'logic',
            type: 'quantity',
        };
    }
    if (playerReferenceWords.has(value)) {
        return {
            ...base,
            category: 'entityReference',
            type: 'playerReference',
        };
    }
    if (relativeReferenceWords.has(value)) {
        return {
            ...base,
            category: 'entityReference',
            type: 'relativeReference',
        };
    }
    if (zoneWords.has(value)) {
        return {
            ...base,
            category: 'entityReference',
            type: 'zoneWord',
        };
    }
    if (cardTypeWords.has(value)) {
        return {
            ...base,
            category: 'entityReference',
            type: 'typeWord',
        };
    }
    if (predicateWords.has(value)) {
        return {
            ...base,
            category: 'predicate',
            type: 'predicateVerb',
        };
    }
    if (actionWords.has(value)) {
        return {
            ...base,
            category: costWords.has(value) ? 'cost' : 'magicVocabulary',
            type: costWords.has(value) ? 'costWord' : 'actionWord',
        };
    }
    if (/^[A-Z]/.test(raw)) {
        return {
            ...base,
            category: 'entityReference',
            type: 'nameOrSubtype',
        };
    }

    return {
        ...base,
        category: 'logic',
        type: 'unknownWord',
    };
}

function phraseEntity(type, category, tokens, extra = {}) {
    return {
        category,
        end: tokens.at(-1)?.start ?? 0,
        label: tokens.map(token => token.raw).join(' '),
        start: tokens[0]?.start ?? 0,
        tokenIndexes: tokens.map(token => token.index),
        type,
        ...extra,
    };
}

function extractPhrases(tokens = []) {
    const phrases = [];
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        const next = tokens[index + 1];
        const third = tokens[index + 2];
        const fourth = tokens[index + 3];

        if (token.type === 'targetMarker') {
            const phraseTokens = [token];
            let cursor = index + 1;
            while (
                cursor < tokens.length &&
                !['actionSeparator', 'sentenceBoundary'].includes(tokens[cursor].type) &&
                tokens[cursor].type !== 'actionWord'
            ) {
                phraseTokens.push(tokens[cursor]);
                cursor += 1;
                if (phraseTokens.length >= 5) {
                    break;
                }
            }
            phrases.push(phraseEntity('targetReference', 'entityReference', phraseTokens, {
                isTarget: true,
            }));
        }

        if (
            token.type === 'relativeReference' &&
            next?.type === 'predicateVerb' &&
            third?.value === 'an' &&
            fourth
        ) {
            phrases.push(phraseEntity('typePredicate', 'predicate', [token, next, third, fourth]));
        }

        if (
            token.type === 'actionWord' &&
            ['draw', 'mill', 'scry'].includes(token.value) &&
            next?.type === 'quantity'
        ) {
            phrases.push(phraseEntity('vocabularyAction', 'magicVocabulary', [token, next]));
        }
    }

    return phrases;
}

export function extractOracleEntities(text, options = {}) {
    const tokens = rawOracleTokens(text).map((rawToken, index) => tokenEntity(rawToken, index));
    return {
        cardName: options.cardName,
        errors: [],
        phrases: extractPhrases(tokens),
        sourceText: normalizeExtractionText(text),
        tokens,
    };
}

function numberAmount(amount, fallback = 1) {
    const value = Number(amount?.value ?? fallback);
    return Number.isFinite(value) ? value : fallback;
}

function primitive(name, params = {}) {
    return {
        category: 'actionPrimitive',
        name,
        params,
    };
}

function vocabulary(name, params = {}, primitives = []) {
    return {
        category: 'magicVocabulary',
        name,
        params,
        primitives,
    };
}

function reference(name, params = {}) {
    return {
        category: 'entityReference',
        name,
        params,
    };
}

function costNode(cost) {
    return {
        category: 'cost',
        name: cost.type ?? cost.kind ?? 'cost',
        params: cost,
    };
}

function predicateNode(condition) {
    return {
        category: 'predicate',
        name: condition.name,
        params: condition.params ?? {},
    };
}

function scryStep(action) {
    const amount = numberAmount(action.amount);
    return vocabulary('scry', {
        amount,
        player: action.player ?? 'controller',
    }, [
        primitive('enqueueChoice', {
            amount,
            choice: 'topOrBottomKnownCards',
            player: action.player ?? 'controller',
        }),
        primitive('moveCard', {
            amount,
            from: {
                player: action.player ?? 'controller',
                position: 'top',
                zone: 'library',
            },
            to: {
                player: action.player ?? 'controller',
                position: 'bottomOrTopChoice',
                zone: 'library',
            },
        }),
        primitive('emitEvent', {
            amount,
            event: 'scry',
            player: action.player ?? 'controller',
        }),
    ]);
}

function drawStep(action) {
    const amount = numberAmount(action.amount);
    return vocabulary('drawCards', {
        amount,
        player: action.player ?? 'controller',
    }, [
        primitive('moveCard', {
            amount,
            from: {
                player: action.player ?? 'controller',
                position: 'top',
                zone: 'library',
            },
            to: {
                player: action.player ?? 'controller',
                zone: 'hand',
            },
        }),
        primitive('emitEvent', {
            amount,
            event: 'draw',
            player: action.player ?? 'controller',
        }),
    ]);
}

function damageStep(action) {
    return vocabulary('dealDamage', {
        amount: numberAmount(action.amount),
        targets: action.targets ?? [],
    }, [
        primitive('applyDamage', {
            amount: numberAmount(action.amount),
            targets: action.targets ?? [],
        }),
        primitive('emitEvent', {
            amount: numberAmount(action.amount),
            event: 'damage',
            targets: action.targets ?? [],
        }),
    ]);
}

function destroyStep(action) {
    return vocabulary('destroyPermanent', {
        targets: action.targets ?? [],
    }, [
        primitive('movePermanentToZone', {
            from: 'battlefield',
            reason: 'destroy',
            targets: action.targets ?? [],
            to: 'graveyard',
        }),
        primitive('emitEvent', {
            event: 'destroy',
            targets: action.targets ?? [],
        }),
    ]);
}

function exileStep(action) {
    return vocabulary('exilePermanent', {
        targets: action.targets ?? [],
    }, [
        primitive('movePermanentToZone', {
            from: 'battlefield',
            reason: 'exile',
            targets: action.targets ?? [],
            to: 'exile',
        }),
        primitive('emitEvent', {
            event: 'exile',
            targets: action.targets ?? [],
        }),
    ]);
}

function lifeChangeSteps(action) {
    return (action.changes ?? []).map(change => {
        const name = change.direction === 'lose' ? 'loseLife' : 'gainLife';
        return vocabulary(name, {
            amount: change.amount,
            player: change.player,
        }, [
            primitive('setPlayerState', {
                delta: change.direction === 'lose' ? -change.amount : change.amount,
                field: 'life',
                player: change.player,
            }),
            primitive('emitEvent', {
                amount: change.amount,
                direction: change.direction,
                event: name,
                player: change.player,
            }),
        ]);
    });
}

function manaAbilityStep(action) {
    return vocabulary('addMana', {
        mana: action.manaProduced ?? [],
        player: 'controller',
    }, [
        primitive('changeManaPool', {
            mana: action.manaProduced ?? [],
            operation: 'add',
            player: 'controller',
        }),
        primitive('emitEvent', {
            event: 'addMana',
            mana: action.manaProduced ?? [],
            player: 'controller',
        }),
    ]);
}

function actionToScript(action) {
    switch (action.type) {
        case 'damage':
            return [damageStep(action)];
        case 'destroyPermanent':
            return [destroyStep(action)];
        case 'drawCards':
            return [drawStep(action)];
        case 'exilePermanent':
            return [exileStep(action)];
        case 'lifeChange':
            return lifeChangeSteps(action);
        case 'manaAbility':
            return [manaAbilityStep(action)];
        case 'scry':
            return [scryStep(action)];
        case 'temporaryExilePlayPermission':
            return (action.actions ?? []).map(step => {
                return vocabulary(step.name, step.params ?? {}, [
                    primitive(step.name === 'moveCards' ? 'moveCard' : step.name, step.params ?? {}),
                ]);
            });
        default:
            {
                const steps = action.actions ?? (action.action ? [action.action] : []);
                return steps.map(step => {
                    return vocabulary(step.name ?? action.type, step.params ?? {}, [
                        primitive(step.name ?? action.type, step.params ?? {}),
                    ]);
                });
            }
    }
}

function blockKind(action) {
    if (action.type === 'hook') {
        return 'TriggeredAbility';
    }
    if (action.type === 'manaAbility') {
        return 'ManaAbility';
    }
    if (action.type === 'spellStaticAbility') {
        return 'StaticModifier';
    }
    if (action.costs?.length || action.sourceZone === 'battlefield') {
        return 'ActivatedAbility';
    }
    return 'SpellEffect';
}

function actionToEffectBlock(action, index) {
    if (action.type === 'modalSpell') {
        return {
            category: 'effectBlock',
            choices: (action.choices ?? []).map(choice => {
                return {
                    id: choice.id,
                    script: (choice.actions ?? []).flatMap(actionToScript),
                    targets: choice.targets ?? [],
                    text: choice.text,
                };
            }),
            costs: (action.costs ?? []).map(costNode),
            id: `effect-block:${index}`,
            kind: 'SpellEffect',
            mode: action.mode,
            references: (action.targets ?? []).map(target => reference(target.selector, target)),
            script: [],
            targets: action.targets ?? [],
        };
    }

    return {
        category: 'effectBlock',
        conditions: (action.conditions ?? action.condition ? [action.condition].filter(Boolean) : []).map(predicateNode),
        costs: (action.costs ?? []).map(costNode),
        event: action.event,
        id: `effect-block:${index}`,
        kind: blockKind(action),
        references: (action.targets ?? []).map(target => reference(target.selector, target)),
        script: actionToScript(action),
        sourceZone: action.sourceZone,
        targets: action.targets ?? [],
    };
}

function conceptCategory(concept) {
    switch (concept.kind) {
        case 'action':
            return 'magicVocabulary';
        case 'booleanLogic':
            return 'logic';
        case 'choice':
            return 'effectBlock';
        case 'condition':
            return 'predicate';
        case 'hook':
            return 'trigger';
        case 'target':
            return 'entityReference';
        default:
            return 'logic';
    }
}

function graphSegment(segment) {
    const effectBlocks = (segment.actions ?? []).map(actionToEffectBlock);
    return {
        ...segment,
        colorCells: (segment.concepts ?? []).map(concept => {
            return {
                ...concept,
                category: conceptCategory(concept),
            };
        }),
        effectBlocks,
    };
}

function stageItemFromToken(token) {
    return {
        category: token.category,
        label: token.label,
        raw: token.raw,
        type: token.type,
    };
}

function stageItemFromSegment(segment) {
    return {
        category: segment.annotationKind === 'unsupported' ? 'unsupported' : 'effectBlock',
        label: segment.text,
        status: segment.parser?.state ?? 'unknown',
        type: segment.annotationKind,
    };
}

function stageItemFromConcept(concept) {
    return {
        category: concept.category ?? conceptCategory(concept),
        label: concept.raw ?? concept.name ?? concept.selector ?? concept.kind,
        type: concept.name ?? concept.kind,
    };
}

function stageItemFromBlock(block) {
    return {
        category: 'effectBlock',
        label: block.kind,
        status: block.mode ?? block.sourceZone ?? block.event ?? 'resolved',
        type: block.kind,
    };
}

function stageItemFromVocabulary(step) {
    return {
        category: step.category,
        label: step.name,
        type: step.name,
    };
}

function stageItemFromPrimitive(step) {
    return {
        category: step.category,
        label: step.name,
        type: step.name,
    };
}

function buildRuleGraphStages(entityExtraction, segments) {
    const blocks = segments.flatMap(segment => segment.effectBlocks ?? []);
    const vocabularySteps = blocks.flatMap(block => {
        if (block.choices?.length) {
            return block.choices.flatMap(choice => choice.script ?? []);
        }
        return block.script ?? [];
    });
    const primitiveSteps = vocabularySteps.flatMap(step => step.primitives ?? []);

    return [
        {
            items: [
                ...entityExtraction.tokens.map(stageItemFromToken),
                ...entityExtraction.phrases.map(stageItemFromToken),
            ],
            key: 'entityRetrieval',
            status: entityExtraction.errors.length ? 'unsupported' : 'ready',
            title: 'Entity retrieval',
        },
        {
            items: segments.map(stageItemFromSegment),
            key: 'documentFsm',
            status: segments.some(segment => segment.annotationKind === 'unsupported') ? 'partial' : 'ready',
            title: 'Document FSM',
        },
        {
            items: blocks.map(stageItemFromBlock),
            key: 'abilityClassifier',
            status: blocks.length > 0 ? 'ready' : 'empty',
            title: 'Ability classifier',
        },
        {
            items: segments.flatMap(segment => {
                return (segment.colorCells ?? []).filter(cell => cell.category === 'entityReference').map(stageItemFromConcept);
            }),
            key: 'referenceExtraction',
            status: 'ready',
            title: 'Reference extraction',
        },
        {
            items: vocabularySteps.map(stageItemFromVocabulary),
            key: 'vocabularyExpansion',
            status: vocabularySteps.length > 0 ? 'ready' : 'empty',
            title: 'Vocabulary expansion',
        },
        {
            items: primitiveSteps.map(stageItemFromPrimitive),
            key: 'primitiveExpansion',
            status: primitiveSteps.length > 0 ? 'ready' : 'empty',
            title: 'Primitive expansion',
        },
    ];
}

export function buildOracleRuleGraph(text, options = {}) {
    const document = parseOracleDocument(text, options);
    const entityExtraction = extractOracleEntities(text, options);
    const segments = document.segments.map(graphSegment);
    return {
        actions: document.actions,
        entityExtraction,
        errors: document.errors,
        palette: ruleLanguagePalette,
        segments,
        stages: buildRuleGraphStages(entityExtraction, segments),
        stateMachines: oracleRuleStateMachines,
    };
}
