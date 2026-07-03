const CARD_TYPES = ['artifact', 'battle', 'creature', 'enchantment', 'land', 'planeswalker'];
const SUPERTYPES = ['basic', 'legendary', 'snow', 'world'];
const COLORS = ['white', 'blue', 'black', 'red', 'green', 'colorless', 'multicolored', 'monocolored'];
const STATE_QUALIFIERS = ['attacking', 'blocking', 'tapped', 'untapped'];

export class OracleParseError extends Error {
    constructor(errors, actions = []) {
        const count = errors.length;
        super(`${count} unsupported Oracle ${count === 1 ? 'clause' : 'clauses'}`);
        this.name = 'OracleParseError';
        this.actions = actions;
        this.errors = errors;
    }
}

function selected(card) {
    return card.selectedOption ?? card;
}

function typeLineOf(card) {
    return selected(card).typeLine ?? '';
}

function oracleTextOf(card) {
    return selected(card).oracleText ?? '';
}

function normalizeText(value) {
    return String(value ?? '')
        .replace(/\r/g, '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitOracleClauses(value) {
    return [...String(value ?? '')
        .replace(/\r/g, '\n')
        .replace(/\u2022/g, '\n')
        .matchAll(/[^.;\n]+[.;]?/g)]
        .map(match => {
            return {
                clause: normalizeText(match[0]),
                index: match.index ?? 0,
            };
        })
        .filter(entry => entry.clause.length > 0);
}

function oracleWordTokens(value) {
    return [...normalizeText(value)
        .replace(/[.;]$/g, '')
        .matchAll(/\{[^}]+\}:?|[A-Za-z0-9][A-Za-z0-9'+\-/]*/g)]
        .map(match => {
            const raw = match[0];
            return {
                raw,
                value: raw.replace(/:$/, '').toLowerCase(),
            };
        });
}

function parserState(state, extra = {}) {
    return {
        mode: 'word-state-machine',
        state,
        ...extra,
    };
}

function attachParserDetails(details = {}, parser = {}) {
    return {
        ...details,
        parserMode: parser.mode,
        parserState: parser.state,
        ...parser.unexpectedToken ? { unexpectedToken: parser.unexpectedToken } : {},
    };
}

function parseContext(options = {}) {
    return {
        cardName: options.cardName,
    };
}

function diagnostic(code, clause, message, context = {}, details = {}) {
    return {
        code,
        severity: 'unsupported',
        message,
        clause,
        ...context.cardName ? { cardName: context.cardName } : {},
        ...Object.keys(details).length > 0 ? { details } : {},
    };
}

function throwIfStrict(result, options = {}) {
    if (options.strict && result.errors.length > 0) {
        throw new OracleParseError(result.errors, result.actions);
    }
}

function parseAmount(raw) {
    return /^X$/i.test(raw)
        ? {
            kind: 'variable',
            raw: raw.toUpperCase(),
        }
        : {
            kind: 'number',
            raw,
            value: parseInt(raw, 10),
        };
}

function permanentCandidate(cardTypes, extra = {}) {
    return {
        entity: 'permanent',
        cardTypes,
        excludedCardTypes: [],
        qualifiers: [],
        subtypes: [],
        supertypes: [],
        ...extra,
    };
}

function anyTargetCandidates() {
    return [
        { entity: 'player', role: 'any' },
        permanentCandidate(['creature']),
        permanentCandidate(['planeswalker']),
        permanentCandidate(['battle']),
    ];
}

function cleanTargetExpression(value) {
    return normalizeText(value)
        .replace(/\s+instead$/i, '')
        .replace(/\s+at random$/i, '')
        .replace(/,$/, '')
        .trim();
}

function splitEachTargets(body) {
    return body.split(/\s+and\s+each\s+/i).map(part => part.trim()).filter(Boolean);
}

function splitEntityAlternatives(body) {
    return body.split(/\s+or\s+/i).map(part => part.trim()).filter(Boolean);
}

function trimLeadingArticle(value) {
    return normalizeText(value).replace(/^(?:a|an|the)\s+/i, '').trim();
}

function normalizeCardName(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function sourceReferenceCandidate(rawBody, context = {}) {
    const raw = trimLeadingArticle(rawBody);
    const cardName = context.cardName ?? '';
    const normalizedRaw = normalizeCardName(raw);
    const normalizedCardName = normalizeCardName(cardName);
    if (!normalizedRaw || !normalizedCardName) {
        return null;
    }

    const isExplicitThis = /^this(?:\s+(?:card|permanent|spell|creature|artifact|enchantment|land|planeswalker|battle))?$/i.test(raw);
    const isFullCardName = normalizedRaw === normalizedCardName;
    const isCardNamePrefix = normalizedRaw.length >= 4 && normalizedCardName.startsWith(normalizedRaw);
    if (!isExplicitThis && !isFullCardName && !isCardNamePrefix) {
        return null;
    }

    return permanentCandidate([], {
        cardName,
        matchedName: raw,
        raw,
        reference: 'source',
    });
}

function extractQualifiers(body) {
    const qualifiers = [];
    let cleaned = body;
    for (const match of cleaned.matchAll(/\b(with|without) ([a-z0-9 +/\-]+?)(?=$|\s+or\s+|\s+and\s+)/gi)) {
        qualifiers.push(`${match[1].toLowerCase()} ${match[2].trim().toLowerCase()}`);
    }

    cleaned = cleaned.replace(/\b(?:with|without) [a-z0-9 +/\-]+?(?=$|\s+or\s+|\s+and\s+)/gi, '').trim();
    for (const qualifier of STATE_QUALIFIERS) {
        if (new RegExp(`\\b${qualifier}\\b`, 'i').test(cleaned)) {
            qualifiers.push(qualifier);
            cleaned = cleaned.replace(new RegExp(`\\b${qualifier}\\b`, 'ig'), '').trim();
        }
    }

    return {
        body: cleaned.replace(/\s+/g, ' ').trim(),
        qualifiers,
    };
}

function parseEntityCandidateDetailed(rawBody, context = {}) {
    const sourceReference = sourceReferenceCandidate(rawBody, context);
    if (sourceReference) {
        return {
            candidate: sourceReference,
            supported: true,
        };
    }

    const { body, qualifiers } = extractQualifiers(rawBody.toLowerCase());
    if (/\bopponents?\b/.test(body)) {
        return {
            candidate: {
                entity: 'player',
                role: 'opponent',
                qualifiers,
            },
            supported: true,
        };
    }

    if (/\bplayers?\b/.test(body)) {
        return {
            candidate: {
                entity: 'player',
                role: 'any',
                qualifiers,
            },
            supported: true,
        };
    }

    const words = body.split(/\s+/).filter(Boolean);
    const cardTypes = CARD_TYPES.filter(type => words.includes(type));
    const supertypes = SUPERTYPES.filter(supertype => words.includes(supertype));
    const colors = COLORS.filter(color => words.includes(color));
    const excludedCardTypes = [];
    if (words.includes('nonland')) {
        excludedCardTypes.push('land');
    }

    const knownWords = new Set([
        ...cardTypes,
        ...supertypes,
        ...colors,
        ...excludedCardTypes,
        'card',
        'cards',
        'nonland',
        'permanent',
        'spell',
        'target',
    ]);
    const subtypes = words.filter(word => !knownWords.has(word));
    const hasSupportedPermanentScope = cardTypes.length > 0
        || supertypes.length > 0
        || colors.length > 0
        || excludedCardTypes.length > 0
        || words.includes('permanent');
    return {
        candidate: permanentCandidate(cardTypes, {
            colors,
            excludedCardTypes,
            qualifiers,
            subtypes,
            supertypes,
        }),
        supported: hasSupportedPermanentScope,
    };
}

function parseSourceEntityReference(rawBody, context = {}) {
    const parsed = parseEntityCandidateDetailed(rawBody, context);
    return {
        ...parsed.candidate,
        reference: 'this',
        raw: normalizeText(rawBody),
    };
}

function parseControlledEntityCandidate(rawBody, context = {}) {
    const raw = trimLeadingArticle(rawBody);
    const named = /^(?:(basic|legendary|snow)\s+)?(?:(artifact|battle|creature|enchantment|land|planeswalker|permanent|card)\s+)?named\s+(.+)$/i.exec(raw);
    if (named) {
        const type = (named[2] ?? '').toLowerCase();
        return permanentCandidate(CARD_TYPES.includes(type) ? [type] : [], {
            cardName: named[3].trim(),
            raw,
            supertypes: named[1] ? [named[1].toLowerCase()] : [],
        });
    }

    const parsed = parseEntityCandidateDetailed(raw, context);
    if (parsed.supported) {
        return {
            ...parsed.candidate,
            raw,
        };
    }

    return permanentCandidate([], {
        identifier: {
            possibleKinds: ['type', 'subtype', 'cardName'],
            raw,
        },
        raw,
        subtypes: [raw.toLowerCase()],
    });
}

function parseYouControlPredicate(rawBody, context = {}) {
    const control = /^you control (.+)$/i.exec(normalizeText(rawBody));
    if (!control) {
        return null;
    }

    return {
        name: 'youControlAny',
        params: {
            controller: 'you',
            candidates: splitEntityAlternatives(control[1]).map(part => parseControlledEntityCandidate(part, context)),
        },
    };
}

function buildModifyTappedAction(value) {
    return {
        name: 'modifyPermanent',
        params: {
            duration: 'asEntersBattlefield',
            modifiers: [
                {
                    property: 'tapped',
                    value,
                },
            ],
            target: 'source',
        },
    };
}

function buildEntersBattlefieldStateAction(clause, sourceText, conditionText, context = {}) {
    const untappedCondition = conditionText ? parseYouControlPredicate(conditionText, context) : null;
    const tappedCondition = untappedCondition
        ? {
            name: 'not',
            params: {
                condition: untappedCondition,
            },
        }
        : {
            name: 'always',
            params: {},
        };
    const branches = [
        {
            id: 'entersTapped',
            condition: tappedCondition,
            state: {
                tapped: true,
            },
            actions: [buildModifyTappedAction(true)],
        },
    ];
    if (untappedCondition) {
        branches.push({
            id: 'entersUntapped',
            condition: untappedCondition,
            state: {
                tapped: false,
            },
            actions: [buildModifyTappedAction(false)],
        });
    }

    return {
        type: 'hook',
        raw: clause,
        event: 'enterBattlefield',
        source: parseSourceEntityReference(sourceText, context),
        destination: 'battlefield',
        timing: 'asEntersBattlefield',
        branches,
    };
}

function targetObject(selector, raw, candidates, quantity = {}) {
    return {
        selector,
        raw,
        candidates,
        quantity,
    };
}

function unsupportedTargetDiagnostic(raw, clause, context) {
    return diagnostic(
        'unsupported_damage_target',
        clause,
        'Damage target expression is not supported yet.',
        context,
        { target: raw },
    );
}

function parseOracleTargetsDetailed(value, clause, context) {
    const raw = cleanTargetExpression(value);
    const errors = [];
    if (!raw || /\bdamage\b|\bdivided\b|\bamong\b|\bchoose\b/i.test(raw)) {
        return {
            targets: [],
            errors: [unsupportedTargetDiagnostic(raw, clause, context)],
        };
    }

    if (/^any target$/i.test(raw)) {
        return {
            targets: [targetObject('anyTarget', raw, anyTargetCandidates(), { min: 1, max: 1 })],
            errors,
        };
    }

    const each = /^each (.+)$/i.exec(raw);
    if (each) {
        const targets = splitEachTargets(each[1]).map(part => {
            const parsed = parseEntityCandidateDetailed(part, context);
            if (!parsed.supported) {
                errors.push(unsupportedTargetDiagnostic(part, clause, context));
            }

            return targetObject('each', `each ${part}`, [parsed.candidate]);
        });
        return { targets: errors.length > 0 ? [] : targets, errors };
    }

    const target = /^(up to one )?target (.+)$/i.exec(raw);
    if (target) {
        const quantity = target[1]
            ? { min: 0, max: 1 }
            : { min: 1, max: 1 };
        const candidates = splitEntityAlternatives(target[2]).map(part => {
            const parsed = parseEntityCandidateDetailed(part, context);
            if (!parsed.supported) {
                errors.push(unsupportedTargetDiagnostic(part, clause, context));
            }

            return parsed.candidate;
        });
        return {
            targets: errors.length > 0
                ? []
                : [targetObject(
                    'target',
                    raw,
                    candidates,
                    quantity,
                )],
            errors,
        };
    }

    const parsed = parseEntityCandidateDetailed(raw, context);
    if (!parsed.supported) {
        errors.push(unsupportedTargetDiagnostic(raw, clause, context));
    }

    return {
        targets: errors.length > 0
            ? []
            : [targetObject(
                parsed.candidate.reference === 'source' ? 'self' : 'implicit',
                raw,
                [parsed.candidate],
            )],
        errors,
    };
}

export function parseOracleTargets(value, options = {}) {
    const context = parseContext(options);
    const result = parseOracleTargetsDetailed(value, cleanTargetExpression(value), context);
    throwIfStrict({ actions: [], errors: result.errors }, options);
    return result.targets;
}

function targetConceptsFromTargets(targets = []) {
    return targets.map(target => {
        return {
            candidates: target.candidates,
            kind: 'target',
            name: target.selector === 'self' ? 'selfReference' : 'targetSpec',
            quantity: target.quantity,
            raw: target.raw,
            selector: target.selector,
        };
    });
}

function detectChoiceConcepts(text) {
    const normalized = normalizeText(text);
    const concepts = [];
    if (/\bchoose one\b/i.test(normalized)) {
        concepts.push({
            kind: 'choice',
            name: 'chooseOne',
            raw: 'choose one',
        });
    }
    if (/\byou may\b/i.test(normalized)) {
        concepts.push({
            kind: 'choice',
            name: 'youMay',
            raw: 'you may',
        });
    }

    return concepts;
}

function detectHookConcepts(text) {
    const normalized = normalizeText(text);
    const concepts = [];
    if (/^this\b[^.]*\benters\b/i.test(normalized) || /^when this\b[^.]*\benters\b/i.test(normalized)) {
        concepts.push({
            kind: 'hook',
            name: 'enterBattlefield',
            raw: normalized,
        });
    }
    if (/^whenever you cast\b/i.test(normalized)) {
        concepts.push({
            kind: 'hook',
            name: 'cast',
            raw: normalized,
        });
    }
    if (/^whenever you gain life\b/i.test(normalized)) {
        concepts.push({
            kind: 'hook',
            name: 'gainLife',
            raw: normalized,
        });
    }
    if (/^at the beginning of your upkeep\b/i.test(normalized)) {
        concepts.push({
            kind: 'hook',
            name: 'beginningOfUpkeep',
            raw: normalized,
        });
    }
    if (/\buntil the end of your next turn\b/i.test(normalized)) {
        concepts.push({
            kind: 'hook',
            name: 'endOfNextTurn',
            raw: 'until the end of your next turn',
        });
    }

    return concepts;
}

function detectBooleanLogicConcepts(text, context = {}) {
    const normalized = normalizeText(text);
    const concepts = [];
    if (/\bunless\b/i.test(normalized)) {
        concepts.push({
            kind: 'booleanLogic',
            name: 'unless',
            raw: 'unless',
        });
        const unlessBody = normalized.split(/\bunless\b/i)[1] ?? '';
        const predicate = parseYouControlPredicate(unlessBody, context);
        if (predicate) {
            concepts.push({
                kind: 'condition',
                name: predicate.name,
                params: predicate.params,
                raw: normalizeText(unlessBody),
            });
        }
    }
    if (/\band\b/i.test(normalized)) {
        concepts.push({
            kind: 'booleanLogic',
            name: 'and',
            raw: 'and',
        });
    }
    if (/\bor\b/i.test(normalized)) {
        concepts.push({
            kind: 'booleanLogic',
            name: 'or',
            raw: 'or',
        });
    }

    return concepts;
}

function detectTargetConcepts(text, context = {}) {
    const concepts = [];
    const targetMatches = [...normalizeText(text).matchAll(/\b(?:up to one )?target [^.,;]+/gi)];
    for (const match of targetMatches) {
        const result = parseOracleTargetsDetailed(match[0], text, context);
        if (result.errors.length === 0) {
            concepts.push(...targetConceptsFromTargets(result.targets));
        }
    }

    const selfModifier = /^(.+?)\s+gets?\s+[+-]?\d+\/[+-]?\d+/i.exec(normalizeText(text));
    if (selfModifier) {
        const result = parseOracleTargetsDetailed(selfModifier[1], text, context);
        if (result.errors.length === 0) {
            concepts.push(...targetConceptsFromTargets(result.targets.filter(target => target.selector === 'self')));
        }
    }

    return concepts;
}

function detectConcreteActionConcepts(text) {
    const normalized = normalizeText(text);
    const concepts = [];
    if (/\bdeals? (?:X|\d+) damage\b/i.test(normalized)) {
        concepts.push({
            kind: 'action',
            name: 'dealDamage',
            raw: normalized,
        });
    }
    if (/\benters(?: the battlefield)? tapped\b/i.test(normalized) || /\bgets?\s+[+-]?\d+\/[+-]?\d+/i.test(normalized)) {
        concepts.push({
            kind: 'action',
            name: 'modifyPermanent',
            raw: normalized,
        });
    }
    if (/\badd \{[^}]+\}/i.test(normalized)) {
        concepts.push({
            kind: 'action',
            name: 'addMana',
            raw: normalized,
        });
    }
    if (/\bdraw a card\b/i.test(normalized)) {
        concepts.push({
            kind: 'action',
            name: 'drawCards',
            raw: normalized,
        });
    }
    if (/\bmill a card\b/i.test(normalized)) {
        concepts.push({
            kind: 'action',
            name: 'millCards',
            raw: normalized,
        });
    }
    if (/\bscry \d+\b/i.test(normalized)) {
        concepts.push({
            kind: 'action',
            name: 'scry',
            raw: normalized,
        });
    }
    if (/\bcreate\b[^.]*\btoken\b/i.test(normalized)) {
        concepts.push({
            kind: 'action',
            name: 'createToken',
            raw: normalized,
        });
    }
    if (/\bexile the top card of your library\b/i.test(normalized)) {
        concepts.push({
            kind: 'action',
            name: 'moveCards',
            raw: 'exile the top card of your library',
        });
    }
    if (/\byou may play that card\b/i.test(normalized)) {
        concepts.push({
            kind: 'action',
            name: 'grantZonePlayPermission',
            raw: 'you may play that card',
        });
    }

    return concepts;
}

function conceptKey(concept) {
    return [
        concept.kind,
        concept.name,
        concept.selector,
        concept.raw,
    ].filter(Boolean).join(':');
}

export function parseOracleConcepts(text, options = {}) {
    const context = parseContext(options);
    const concepts = [
        ...detectChoiceConcepts(text, context),
        ...detectHookConcepts(text, context),
        ...detectBooleanLogicConcepts(text, context),
        ...detectConcreteActionConcepts(text, context),
        ...detectTargetConcepts(text, context),
    ];
    const seen = new Set();
    return concepts.filter(concept => {
        const key = conceptKey(concept);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function parseDamageClause(clause, context) {
    const actions = [];
    const errors = [];
    const matches = [...clause.matchAll(/\bdeals? (X|\d+) damage to ([^.]+)/gi)];
    for (const match of matches) {
        const targetResult = parseOracleTargetsDetailed(match[2], clause, context);
        errors.push(...targetResult.errors);
        if (targetResult.errors.length > 0) {
            continue;
        }

        actions.push({
            type: 'damage',
            raw: match[0],
            amount: parseAmount(match[1]),
            targets: targetResult.targets,
        });
    }

    if (matches.length > 0) {
        return {
            actions,
            errors,
            handled: true,
        };
    }

    if (/\bdeals?\b[^.;]*\bdamage\b/i.test(clause)) {
        const code = /\b(X|\d+) damage\b/i.test(clause)
            ? 'unsupported_damage_target'
            : 'unsupported_damage_amount';
        const message = code === 'unsupported_damage_amount'
            ? 'Damage amount expression is not supported yet.'
            : 'Damage target expression is not supported yet.';
        return {
            actions,
            errors: [
                diagnostic(code, clause, message, context),
            ],
            handled: true,
        };
    }

    return {
        actions,
        errors,
        handled: false,
    };
}

function parseEntersBattlefieldStateSegment(clause, context) {
    const tokens = oracleWordTokens(clause);
    if (tokens[0]?.value !== 'this') {
        return {
            handled: false,
        };
    }

    const entersIndex = tokens.findIndex((token, index) => index > 1 && token.value === 'enters');
    if (entersIndex < 0) {
        return {
            errors: [
                diagnostic(
                    'unsupported_oracle_clause',
                    clause,
                    'Oracle clause is not supported yet.',
                    context,
                    attachParserDetails({}, parserState('unparsable', {
                        expected: 'enters',
                        unexpectedToken: tokens[1]?.raw ?? tokens[0]?.raw ?? '',
                    })),
                ),
            ],
            handled: true,
            parser: parserState('unparsable', {
                expected: 'enters',
                unexpectedToken: tokens[1]?.raw ?? tokens[0]?.raw ?? '',
            }),
        };
    }

    const sourceText = tokens.slice(1, entersIndex).map(token => token.raw).join(' ');
    let cursor = entersIndex + 1;
    if (tokens[cursor]?.value === 'the' && tokens[cursor + 1]?.value === 'battlefield') {
        cursor += 2;
    } else if (tokens[cursor]?.value === 'battlefield') {
        cursor += 1;
    }

    if (tokens[cursor]?.value !== 'tapped') {
        const parser = parserState('unparsable', {
            expected: 'tapped',
            unexpectedToken: tokens[cursor]?.raw ?? '',
        });
        return {
            errors: [
                diagnostic(
                    'unsupported_oracle_clause',
                    clause,
                    'Oracle clause is not supported yet.',
                    context,
                    attachParserDetails({}, parser),
                ),
            ],
            handled: true,
            parser,
        };
    }
    cursor += 1;

    let conditionText = '';
    if (cursor < tokens.length) {
        if (tokens[cursor]?.value !== 'unless') {
            const parser = parserState('unparsable', {
                expected: 'unless or end of clause',
                unexpectedToken: tokens[cursor]?.raw ?? '',
            });
            return {
                errors: [
                    diagnostic(
                        'unsupported_oracle_clause',
                        clause,
                        'Oracle clause is not supported yet.',
                        context,
                        attachParserDetails({}, parser),
                    ),
                ],
                handled: true,
                parser,
            };
        }

        conditionText = tokens.slice(cursor + 1).map(token => token.raw).join(' ');
        if (!parseYouControlPredicate(conditionText, context)) {
            const parser = parserState('unparsable', {
                expected: 'you control predicate',
                unexpectedToken: tokens[cursor + 1]?.raw ?? '',
            });
            return {
                errors: [
                    diagnostic(
                        'unsupported_enters_tapped_condition',
                        clause,
                        'Enters-tapped condition is not supported yet.',
                        context,
                        attachParserDetails({ condition: conditionText }, parser),
                    ),
                ],
                handled: true,
                parser,
            };
        }
    }

    return {
        actions: [buildEntersBattlefieldStateAction(clause, sourceText, conditionText, context)],
        errors: [],
        handled: true,
        parser: parserState('complete', {
            finalState: conditionText ? 'conditionParsed' : 'tappedParsed',
        }),
    };
}

function parseManaAbilitySegment(clause, context) {
    const tokens = oracleWordTokens(clause);
    if (!tokens[0]?.raw.endsWith(':') && !/:/.test(clause)) {
        return {
            handled: false,
        };
    }
    if (tokens[1]?.value !== 'add') {
        return {
            handled: false,
        };
    }

    const manaProduced = tokens
        .slice(2)
        .map(token => /^\{([^}]+)\}$/.exec(token.raw)?.[1])
        .filter(Boolean);
    if (manaProduced.length === 0) {
        const parser = parserState('unparsable', {
            expected: 'mana symbol after Add',
            unexpectedToken: tokens[2]?.raw ?? '',
        });
        return {
            errors: [
                diagnostic(
                    'unsupported_mana_ability',
                    clause,
                    'Mana ability is not supported yet.',
                    context,
                    attachParserDetails({}, parser),
                ),
            ],
            handled: true,
            parser,
        };
    }

    return {
        actions: [
            {
                type: 'manaAbility',
                raw: clause,
                cost: tokens[0].raw.replace(/:$/, ''),
                costs: parseActivatedCostText(tokens[0].raw.replace(/:$/, '')),
                sourceZone: 'battlefield',
                manaProduced,
                conditions: [
                    {
                        name: 'sourceOnBattlefield',
                        params: {
                            source: 'source',
                        },
                    },
                    {
                        name: 'sourceUntapped',
                        params: {
                            source: 'source',
                        },
                    },
                ],
                actions: [
                    {
                        name: 'addMana',
                        params: {
                            mana: manaProduced,
                            player: 'controller',
                        },
                    },
                ],
            },
        ],
        errors: [],
        handled: true,
        parser: parserState('complete', {
            finalState: 'manaProduced',
        }),
    };
}

function parseDamageSegment(clause, context) {
    const tokens = oracleWordTokens(clause);
    const dealsIndex = tokens.findIndex(token => token.value === 'deal' || token.value === 'deals');
    if (dealsIndex < 0) {
        return {
            handled: false,
        };
    }

    if (!/^(x|\d+)$/i.test(tokens[dealsIndex + 1]?.raw ?? '')) {
        const parser = parserState('unparsable', {
            expected: 'damage amount',
            unexpectedToken: tokens[dealsIndex + 1]?.raw ?? '',
        });
        return {
            actions: [],
            errors: [
                diagnostic(
                    'unsupported_damage_amount',
                    clause,
                    'Damage amount expression is not supported yet.',
                    context,
                    attachParserDetails({}, parser),
                ),
            ],
            handled: true,
            parser,
        };
    }
    if (tokens[dealsIndex + 2]?.value !== 'damage') {
        const parser = parserState('unparsable', {
            expected: 'damage',
            unexpectedToken: tokens[dealsIndex + 2]?.raw ?? '',
        });
        return {
            actions: [],
            errors: [
                diagnostic(
                    'unsupported_damage_target',
                    clause,
                    'Damage target expression is not supported yet.',
                    context,
                    attachParserDetails({}, parser),
                ),
            ],
            handled: true,
            parser,
        };
    }
    if (tokens[dealsIndex + 3]?.value !== 'to') {
        const parser = parserState('unparsable', {
            expected: 'to',
            unexpectedToken: tokens[dealsIndex + 3]?.raw ?? '',
        });
        return {
            actions: [],
            errors: [
                diagnostic(
                    'unsupported_damage_target',
                    clause,
                    'Damage target expression is not supported yet.',
                    context,
                    attachParserDetails({}, parser),
                ),
            ],
            handled: true,
            parser,
        };
    }

    const damage = parseDamageClause(clause, context);
    const parser = damage.errors.length > 0
        ? parserState('unparsable', {
            expected: 'supported damage target',
            unexpectedToken: tokens[dealsIndex + 4]?.raw ?? '',
        })
        : parserState('complete', {
            finalState: 'damageTargetParsed',
        });
    return {
        ...damage,
        errors: damage.errors.map(error => {
            return {
                ...error,
                details: attachParserDetails(error.details ?? {}, parser),
            };
        }),
        handled: true,
        parser,
    };
}

function parseActivatedCostText(rawCost) {
    return String(rawCost ?? '')
        .split(',')
        .map(part => normalizeText(part))
        .filter(Boolean)
        .map(part => {
            if (/^\{T}$/.test(part)) {
                return {
                    type: 'tap',
                    target: 'source',
                    value: part,
                };
            }
            if (/^\{Q}$/.test(part)) {
                return {
                    type: 'untap',
                    target: 'source',
                    value: part,
                };
            }
            if (/^(?:\{[^}]+\})+$/.test(part)) {
                return {
                    type: 'mana',
                    value: part,
                };
            }

            return {
                type: 'cost',
                value: part,
            };
        });
}

function parseTemporaryExilePlayPermissionSegment(clause, context) {
    const tokens = oracleWordTokens(clause);
    const colonIndex = tokens.findIndex(token => token.raw.endsWith(':'));
    if (colonIndex < 0) {
        return {
            handled: false,
        };
    }

    const activatedAbility = /^(.+?):\s*Exile the top card of your library\.\s*Until the end of your next turn, you may play that card\.$/i.exec(normalizeText(clause));
    if (!activatedAbility) {
        return {
            handled: false,
        };
    }

    const costs = parseActivatedCostText(activatedAbility[1]);
    const costTypes = new Set(costs.map(cost => cost.type));
    if (!costTypes.has('mana') || !costTypes.has('tap')) {
        const parser = parserState('unparsable', {
            expected: 'mana and tap activation cost',
            unexpectedToken: tokens[0]?.raw ?? '',
        });
        return {
            actions: [],
            errors: [
                diagnostic(
                    'unsupported_activation_cost',
                    clause,
                    'Activated exile-play cost is not supported yet.',
                    context,
                    attachParserDetails({ costs }, parser),
                ),
            ],
            handled: true,
            parser,
        };
    }

    return {
        actions: [
            {
                type: 'temporaryExilePlayPermission',
                raw: clause,
                sourceZone: 'battlefield',
                costs,
                conditions: [
                    {
                        name: 'sourceOnBattlefield',
                        params: {
                            source: 'source',
                        },
                    },
                    {
                        name: 'sourceUntapped',
                        params: {
                            source: 'source',
                        },
                    },
                    {
                        name: 'libraryHasCards',
                        params: {
                            amount: 1,
                            player: 'controller',
                        },
                    },
                ],
                actions: [
                    {
                        name: 'moveCards',
                        params: {
                            amount: 1,
                            cardRef: 'thatCard',
                            fromZone: 'library',
                            owner: 'controller',
                            position: 'top',
                            toZone: 'exile',
                        },
                    },
                    {
                        name: 'grantZonePlayPermission',
                        params: {
                            cardRef: 'thatCard',
                            duration: 'untilEndOfNextTurn',
                            player: 'controller',
                            permission: 'playFromExile',
                            zone: 'exile',
                        },
                    },
                    {
                        name: 'schedulePermissionCleanup',
                        params: {
                            at: 'endOfNextTurn',
                            cardRef: 'thatCard',
                            permission: 'playFromExile',
                            player: 'controller',
                        },
                    },
                ],
            },
        ],
        errors: [],
        handled: true,
        parser: parserState('complete', {
            finalState: 'temporaryExilePlayPermissionParsed',
        }),
    };
}

function parseTriggeredActionTokens(tokens, cursor) {
    const current = tokens[cursor]?.value;
    if (current === 'draw' && tokens[cursor + 1]?.value === 'a' && tokens[cursor + 2]?.value === 'card') {
        return {
            action: {
                name: 'drawCards',
                params: {
                    amount: 1,
                    player: 'hookController',
                },
            },
            nextCursor: cursor + 3,
        };
    }
    if (current === 'mill' && tokens[cursor + 1]?.value === 'a' && tokens[cursor + 2]?.value === 'card') {
        return {
            action: {
                name: 'millCards',
                params: {
                    amount: 1,
                    player: 'hookController',
                },
            },
            nextCursor: cursor + 3,
        };
    }
    if (current === 'scry' && /^\d+$/.test(tokens[cursor + 1]?.raw ?? '')) {
        return {
            action: {
                name: 'scry',
                params: {
                    amount: parseInt(tokens[cursor + 1].raw, 10),
                    player: 'hookController',
                },
            },
            nextCursor: cursor + 2,
        };
    }
    if (current === 'create') {
        const tokenIndex = tokens.findIndex((token, index) => index > cursor && token.value === 'token');
        if (tokenIndex > cursor) {
            const tokenName = tokens
                .slice(cursor + 1, tokenIndex)
                .filter(token => !['a', 'an'].includes(token.value))
                .map(token => token.raw)
                .join(' ');
            return {
                action: {
                    name: 'createToken',
                    params: {
                        controller: 'hookController',
                        tokenName,
                    },
                },
                nextCursor: tokenIndex + 1,
            };
        }
    }

    return null;
}

function findTriggeredActionStart(tokens, startIndex) {
    return tokens.findIndex((token, index) => {
        return index >= startIndex && ['create', 'draw', 'mill', 'scry'].includes(token.value);
    });
}

function supportedTriggerRider(tokens) {
    return tokens.length === 0 ||
        tokens.map(token => token.value).join(' ') === 'this ability triggers only once each turn';
}

function parseSimpleTriggeredAbilitySegment(text, context) {
    const tokens = oracleWordTokens(text);
    if (!['whenever', 'when', 'at'].includes(tokens[0]?.value)) {
        return {
            handled: false,
        };
    }

    let parsedTrigger = null;
    let actionSearchStart = 1;
    if (tokens[0].value === 'when' && tokens[1]?.value === 'this') {
        const entersIndex = tokens.findIndex((token, index) => index > 1 && token.value === 'enters');
        if (entersIndex < 0) {
            return {
                handled: false,
            };
        }
        parsedTrigger = {
            condition: {
                name: 'sourceEnteredBattlefield',
                params: {},
            },
            event: 'enterBattlefield',
        };
        actionSearchStart = entersIndex + 1;
        if (tokens[actionSearchStart]?.value === 'the' && tokens[actionSearchStart + 1]?.value === 'battlefield') {
            actionSearchStart += 2;
        }
    } else if (tokens[0].value === 'at' &&
        tokens[1]?.value === 'the' &&
        tokens[2]?.value === 'beginning' &&
        tokens[3]?.value === 'of' &&
        tokens[4]?.value === 'your' &&
        tokens[5]?.value === 'upkeep') {
        parsedTrigger = {
            condition: {
                name: 'phaseBeginsForController',
                params: {
                    player: 'hookController',
                },
            },
            event: 'beginningOfUpkeep',
        };
        actionSearchStart = 6;
    } else if (tokens[0].value === 'whenever' && tokens[1]?.value === 'you' && tokens[2]?.value === 'gain' && tokens[3]?.value === 'life') {
        parsedTrigger = {
            condition: {
                name: 'playerLifeChanged',
                params: {
                    change: 'gain',
                    player: 'hookController',
                },
            },
            event: 'gainLife',
        };
        actionSearchStart = 4;
    } else if (tokens[0].value === 'whenever' && tokens[1]?.value === 'you' && tokens[2]?.value === 'cast') {
        parsedTrigger = {
            condition: {
                name: 'spellCastMatches',
                params: {
                    cardTypes: [],
                    controller: 'hookController',
                    nonCreature: false,
                },
            },
            event: 'cast',
        };
        actionSearchStart = 3;
    }

    if (!parsedTrigger) {
        return {
            handled: false,
        };
    }

    const actionStart = findTriggeredActionStart(tokens, actionSearchStart);
    const parsedAction = actionStart >= 0 ? parseTriggeredActionTokens(tokens, actionStart) : null;
    if (!parsedAction) {
        const parser = parserState('unparsable', {
            expected: 'supported triggered action',
            unexpectedToken: tokens[actionSearchStart]?.raw ?? '',
        });
        return {
            errors: [
                diagnostic(
                    'unsupported_oracle_clause',
                    text,
                    'Oracle clause is not supported yet.',
                    context,
                    attachParserDetails({}, parser),
                ),
            ],
            handled: true,
            parser,
        };
    }

    const trailing = tokens.slice(parsedAction.nextCursor);
    if (!supportedTriggerRider(trailing)) {
        const parser = parserState('unparsable', {
            expected: 'end of trigger or once each turn rider',
            unexpectedToken: trailing[0]?.raw ?? '',
        });
        return {
            errors: [
                diagnostic(
                    'unsupported_oracle_clause',
                    text,
                    'Oracle clause is not supported yet.',
                    context,
                    attachParserDetails({}, parser),
                ),
            ],
            handled: true,
            parser,
        };
    }

    return {
        actions: [
            {
                type: 'hook',
                raw: text,
                event: parsedTrigger.event,
                condition: parsedTrigger.condition,
                action: parsedAction.action,
                limit: trailing.length > 0 ? 'onceEachTurn' : null,
            },
        ],
        errors: [],
        handled: true,
        parser: parserState('complete', {
            finalState: trailing.length > 0 ? 'limitedTriggerParsed' : 'triggerParsed',
        }),
    };
}

function parseCastTriggerSegment(text, context) {
    const tokens = oracleWordTokens(text);
    if (!['whenever', 'when', 'at'].includes(tokens[0]?.value)) {
        return {
            handled: false,
        };
    }
    if (tokens[1]?.value !== 'you' || tokens[2]?.value !== 'cast') {
        return {
            handled: false,
        };
    }

    const drawIndex = tokens.findIndex((token, index) => index > 2 && token.value === 'draw');
    if (drawIndex < 0 || tokens[drawIndex + 2]?.value !== 'card') {
        const parser = parserState('unparsable', {
            expected: 'draw a card action',
            unexpectedToken: tokens[drawIndex < 0 ? 3 : drawIndex + 1]?.raw ?? '',
        });
        return {
            errors: [
                diagnostic(
                    'unsupported_oracle_clause',
                    text,
                    'Oracle clause is not supported yet.',
                    context,
                    attachParserDetails({}, parser),
                ),
            ],
            handled: true,
            parser,
        };
    }

    const trailing = tokens.slice(drawIndex + 3).map(token => token.value);
    const hasSupportedLimit = trailing.length === 0 ||
        trailing.join(' ') === 'this ability triggers only once each turn';
    if (!hasSupportedLimit) {
        const parser = parserState('unparsable', {
            expected: 'end of trigger or once each turn rider',
            unexpectedToken: tokens[drawIndex + 3]?.raw ?? '',
        });
        return {
            errors: [
                diagnostic(
                    'unsupported_oracle_clause',
                    text,
                    'Oracle clause is not supported yet.',
                    context,
                    attachParserDetails({}, parser),
                ),
            ],
            handled: true,
            parser,
        };
    }

    return {
        actions: [
            {
                type: 'hook',
                raw: text,
                event: 'cast',
                condition: {
                    name: 'spellCastMatches',
                    params: {
                        cardTypes: [],
                        controller: 'hookController',
                        nonCreature: false,
                    },
                },
                action: {
                    name: 'drawCards',
                    params: {
                        amount: 1,
                        player: 'hookController',
                    },
                },
                limit: trailing.length > 0 ? 'onceEachTurn' : null,
            },
        ],
        errors: [],
        handled: true,
        parser: parserState('complete', {
            finalState: trailing.length > 0 ? 'limitedTriggerParsed' : 'triggerParsed',
        }),
    };
}

function mergeOracleClauseGroups(clauses) {
    const groups = [];
    for (let index = 0; index < clauses.length; index += 1) {
        const current = clauses[index];
        const next = clauses[index + 1];
        if (/^(whenever|when|at)\b/i.test(current.clause) && /^this ability\b/i.test(next?.clause ?? '')) {
            groups.push([current, next]);
            index += 1;
        } else if (
            /^.+?:\s*Exile the top card of your library\.$/i.test(current.clause) &&
            /^Until the end of your next turn, you may play that card\.$/i.test(next?.clause ?? '')
        ) {
            groups.push([current, next]);
            index += 1;
        } else {
            groups.push([current]);
        }
    }

    return groups;
}

function oracleActionAnnotation(action) {
    if (action.type === 'hook') {
        return {
            detail: action.event ?? 'hook',
            kind: 'hook',
            label: action.event === 'enterBattlefield'
                ? 'ETB hook'
                : action.event === 'cast'
                    ? 'Cast trigger'
                    : `${action.event ?? 'Rule'} hook`,
        };
    }
    if (action.type === 'manaAbility') {
        return {
            detail: `Adds ${action.manaProduced.map(symbol => `{${symbol}}`).join('')}`,
            kind: 'option',
            label: 'Mana ability',
        };
    }
    if (action.type === 'damage') {
        const amount = action.amount?.kind === 'number'
            ? action.amount.value
            : action.amount?.raw ?? '?';
        return {
            detail: 'Spell or ability resolution',
            kind: 'option',
            label: `Damage ${amount}`,
        };
    }
    if (action.type === 'temporaryExilePlayPermission') {
        return {
            detail: 'Exiles the top library card and grants a temporary play permission',
            kind: 'option',
            label: 'Play exiled top card',
        };
    }

    return {
        detail: action.type ?? 'Oracle action',
        kind: 'option',
        label: action.type ?? 'Oracle action',
    };
}

function annotationKindFor(actions, errors) {
    if (errors.length > 0) {
        return 'unsupported';
    }
    if (actions.some(action => action.type === 'hook')) {
        return 'hook';
    }
    if (actions.length > 0) {
        return 'option';
    }
    return 'plain';
}

function parseOracleSegmentGroup(group, groupIndex, context) {
    const text = group.map(entry => entry.clause).join(' ');
    const parsers = [
        parseSimpleTriggeredAbilitySegment,
        parseCastTriggerSegment,
        parseEntersBattlefieldStateSegment,
        parseTemporaryExilePlayPermissionSegment,
        parseManaAbilitySegment,
        parseDamageSegment,
    ];
    let parsed = null;
    for (const parser of parsers) {
        const result = parser(text, context);
        if (result.handled) {
            parsed = result;
            break;
        }
    }

    if (!parsed) {
        const tokens = oracleWordTokens(text);
        const parser = parserState('unparsable', {
            expected: 'supported oracle opener',
            unexpectedToken: tokens[0]?.raw ?? '',
        });
        parsed = {
            actions: [],
            errors: [
                diagnostic(
                    'unsupported_oracle_clause',
                    text,
                    'Oracle clause is not supported yet.',
                    context,
                    attachParserDetails({}, parser),
                ),
            ],
            parser,
        };
    }

    const actions = parsed.actions ?? [];
    const errors = parsed.errors ?? [];
    const concepts = parseOracleConcepts(text, context);
    return {
        actions,
        annotationKind: annotationKindFor(actions, errors),
        annotations: errors.length > 0
            ? errors.map(error => {
                return {
                    detail: error.message,
                    kind: 'unsupported',
                    label: 'Unsupported clause',
                };
            })
            : actions.map(oracleActionAnnotation),
        clauseIndexes: group.map(entry => entry.index),
        concepts,
        errors,
        id: `oracle-segment:${groupIndex}`,
        parser: parsed.parser ?? parserState('complete'),
        text,
    };
}

export function parseOracleSegments(text, options = {}) {
    const context = parseContext(options);
    return mergeOracleClauseGroups(splitOracleClauses(text)).map((group, index) => {
        return parseOracleSegmentGroup(group, index, context);
    });
}

export function parseOracleDocument(text, options = {}) {
    const context = parseContext(options);
    const segments = parseOracleSegments(text, options);
    const actions = segments.flatMap(segment => segment.actions ?? []);
    const errors = segments.flatMap(segment => segment.errors ?? []);
    const result = { actions, errors, segments };
    throwIfStrict(result, options);
    return result;
}

export function parseDamageActions(text, options = {}) {
    const result = parseOracleDocument(text, options);
    return result.actions.filter(action => action.type === 'damage');
}

export function parseOracleActions(text, options = {}) {
    return parseOracleDocument(text, options).actions;
}

export function damageActionAmountValue(action) {
    return action?.amount?.kind === 'number' ? action.amount.value : null;
}

function hasCardType(card, type) {
    return new RegExp(`\\b${type}\\b`, 'i').test(typeLineOf(card));
}

function hasKeyword(card, keyword) {
    return new RegExp(`\\b${keyword}\\b`, 'i').test(oracleTextOf(card));
}

function candidateMatchesCard(candidate, card) {
    if (candidate.entity !== 'permanent') {
        return false;
    }

    for (const excludedType of candidate.excludedCardTypes ?? []) {
        if (hasCardType(card, excludedType)) {
            return false;
        }
    }

    if ((candidate.cardTypes ?? []).length > 0 && !candidate.cardTypes.every(type => hasCardType(card, type))) {
        return false;
    }

    for (const qualifier of candidate.qualifiers ?? []) {
        if (qualifier === 'with flying' && !hasKeyword(card, 'flying')) {
            return false;
        }

        if (qualifier === 'without flying' && hasKeyword(card, 'flying')) {
            return false;
        }
    }

    return true;
}

export function oracleTargetMatchesCard(target, card) {
    return (target?.candidates ?? []).some(candidate => candidateMatchesCard(candidate, card));
}

export function oracleActionTargetsCard(action, card) {
    return (action?.targets ?? []).some(target => oracleTargetMatchesCard(target, card));
}

export function oracleActionCanAffectCardType(action, cardType) {
    return (action?.targets ?? []).some(target => {
        return (target.candidates ?? []).some(candidate => {
            return candidate.entity === 'permanent' && (candidate.cardTypes ?? []).includes(cardType);
        });
    });
}
