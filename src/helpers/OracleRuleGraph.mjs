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
    return {
        ...segment,
        colorCells: (segment.concepts ?? []).map(concept => {
            return {
                ...concept,
                category: conceptCategory(concept),
            };
        }),
        effectBlocks: (segment.actions ?? []).map(actionToEffectBlock),
    };
}

export function buildOracleRuleGraph(text, options = {}) {
    const document = parseOracleDocument(text, options);
    return {
        actions: document.actions,
        errors: document.errors,
        palette: ruleLanguagePalette,
        segments: document.segments.map(graphSegment),
        stateMachines: oracleRuleStateMachines,
    };
}
