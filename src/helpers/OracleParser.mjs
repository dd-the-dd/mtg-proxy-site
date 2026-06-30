const CARD_TYPES = ['artifact', 'battle', 'creature', 'enchantment', 'land', 'planeswalker'];
const SUPERTYPES = ['basic', 'legendary', 'snow', 'world'];
const COLORS = ['white', 'blue', 'black', 'red', 'green', 'colorless', 'multicolored', 'monocolored'];
const STATE_QUALIFIERS = ['attacking', 'blocking', 'tapped', 'untapped'];

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

function parseEntityCandidate(rawBody) {
    const { body, qualifiers } = extractQualifiers(rawBody.toLowerCase());
    if (/\bopponents?\b/.test(body)) {
        return {
            entity: 'player',
            role: 'opponent',
            qualifiers,
        };
    }

    if (/\bplayers?\b/.test(body)) {
        return {
            entity: 'player',
            role: 'any',
            qualifiers,
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
    return permanentCandidate(cardTypes, {
        colors,
        excludedCardTypes,
        qualifiers,
        subtypes,
        supertypes,
    });
}

function targetObject(selector, raw, candidates, quantity = {}) {
    return {
        selector,
        raw,
        candidates,
        quantity,
    };
}

export function parseOracleTargets(value) {
    const raw = cleanTargetExpression(value);
    if (/^any target$/i.test(raw)) {
        return [targetObject('anyTarget', raw, anyTargetCandidates(), { min: 1, max: 1 })];
    }

    const each = /^each (.+)$/i.exec(raw);
    if (each) {
        return splitEachTargets(each[1]).map(part => {
            return targetObject('each', `each ${part}`, [parseEntityCandidate(part)]);
        });
    }

    const target = /^(up to one )?target (.+)$/i.exec(raw);
    if (target) {
        const quantity = target[1]
            ? { min: 0, max: 1 }
            : { min: 1, max: 1 };
        return [
            targetObject(
                'target',
                raw,
                splitEntityAlternatives(target[2]).map(parseEntityCandidate),
                quantity,
            ),
        ];
    }

    return [targetObject('implicit', raw, [parseEntityCandidate(raw)])];
}

export function parseDamageActions(text) {
    const normalized = normalizeText(text);
    return [...normalized.matchAll(/\bdeals? (X|\d+) damage to ([^.]+)/gi)].map(match => {
        return {
            type: 'damage',
            raw: match[0],
            amount: parseAmount(match[1]),
            targets: parseOracleTargets(match[2]),
        };
    });
}

export function parseOracleActions(text) {
    return [
        ...parseDamageActions(text),
    ];
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
