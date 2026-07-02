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

function parseEntityCandidateDetailed(rawBody) {
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

function parseSourceEntityReference(rawBody) {
    const parsed = parseEntityCandidateDetailed(rawBody);
    return {
        ...parsed.candidate,
        reference: 'this',
        raw: normalizeText(rawBody),
    };
}

function parseControlledEntityCandidate(rawBody) {
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

    const parsed = parseEntityCandidateDetailed(raw);
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

function parseYouControlPredicate(rawBody) {
    const control = /^you control (.+)$/i.exec(normalizeText(rawBody));
    if (!control) {
        return null;
    }

    return {
        name: 'youControlAny',
        params: {
            controller: 'you',
            candidates: splitEntityAlternatives(control[1]).map(parseControlledEntityCandidate),
        },
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
            const parsed = parseEntityCandidateDetailed(part);
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
            const parsed = parseEntityCandidateDetailed(part);
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

    const parsed = parseEntityCandidateDetailed(raw);
    if (!parsed.supported) {
        errors.push(unsupportedTargetDiagnostic(raw, clause, context));
    }

    return {
        targets: errors.length > 0
            ? []
            : [targetObject('implicit', raw, [parsed.candidate])],
        errors,
    };
}

export function parseOracleTargets(value, options = {}) {
    const context = parseContext(options);
    const result = parseOracleTargetsDetailed(value, cleanTargetExpression(value), context);
    throwIfStrict({ actions: [], errors: result.errors }, options);
    return result.targets;
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

function parseEntersBattlefieldStateClause(clause, context) {
    const normalizedClause = normalizeText(clause).replace(/[.;]$/, '');
    const match = /^this ([a-z0-9 +/\-]+?) enters(?: the battlefield)? tapped(?: unless (.+))?$/i.exec(normalizedClause);
    if (!match) {
        return {
            actions: [],
            errors: [],
            handled: false,
        };
    }

    const untappedCondition = match[2] ? parseYouControlPredicate(match[2]) : null;
    if (match[2] && !untappedCondition) {
        return {
            actions: [],
            errors: [
                diagnostic(
                    'unsupported_enters_tapped_condition',
                    clause,
                    'Enters-tapped condition is not supported yet.',
                    context,
                    { condition: match[2] },
                ),
            ],
            handled: true,
        };
    }

    const modifyTappedAction = value => {
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
    };
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
            actions: [modifyTappedAction(true)],
        },
    ];
    if (untappedCondition) {
        branches.push({
            id: 'entersUntapped',
            condition: untappedCondition,
            state: {
                tapped: false,
            },
            actions: [modifyTappedAction(false)],
        });
    }

    return {
        actions: [
            {
                type: 'hook',
                raw: clause,
                event: 'enterBattlefield',
                source: parseSourceEntityReference(match[1]),
                destination: 'battlefield',
                timing: 'asEntersBattlefield',
                branches,
            },
        ],
        errors: [],
        handled: true,
    };
}

export function parseOracleDocument(text, options = {}) {
    const context = parseContext(options);
    const actions = [];
    const errors = [];
    for (const { clause } of splitOracleClauses(text)) {
        const entersBattlefieldState = parseEntersBattlefieldStateClause(clause, context);
        actions.push(...entersBattlefieldState.actions);
        errors.push(...entersBattlefieldState.errors);
        if (entersBattlefieldState.handled) {
            continue;
        }

        const damage = parseDamageClause(clause, context);
        actions.push(...damage.actions);
        errors.push(...damage.errors);
        if (!damage.handled) {
            errors.push(diagnostic(
                'unsupported_oracle_clause',
                clause,
                'Oracle clause is not supported yet.',
                context,
            ));
        }
    }

    const result = { actions, errors };
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
