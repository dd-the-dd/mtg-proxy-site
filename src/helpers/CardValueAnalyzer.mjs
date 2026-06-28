import {
    synergyActionCost,
    synergyInteractionDetail,
    synergyValueCategory,
    summarizeCreatureInteractions
} from './DeckInteractionAnalyzer.mjs';

function selected(card) {
    return card.selectedOption ?? card;
}

function textOf(card) {
    return selected(card).oracleText ?? '';
}

function typeLineOf(card) {
    return selected(card).typeLine ?? '';
}

function manaCostOf(card) {
    const selectedCard = selected(card);
    if (selectedCard.manaCost !== undefined) {
        return selectedCard.manaCost;
    }

    return Number.isFinite(Number(selectedCard.manaValue))
        ? `{${Math.max(0, Math.floor(Number(selectedCard.manaValue)))}}`
        : '';
}

function manaSymbols(cost) {
    return [...cost.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
}

function numericCostSymbols(cost) {
    return cost === '' ? [] : [cost];
}

function coloredManaSymbols(cost) {
    return manaSymbols(cost).filter(symbol => /^[WUBRG]$/i.test(symbol));
}

function sentenceCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function addManaCosts(...costs) {
    return costs.filter(Boolean).join('');
}

function manaCostValue(cost) {
    return manaSymbols(cost).reduce((total, symbol) => {
        if (/^\d+$/.test(symbol)) {
            return total + parseInt(symbol, 10);
        }

        return /^X$/i.test(symbol) ? total : total + 1;
    }, 0);
}

function numberWordValue(value) {
    const words = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
    };

    return /^\d+$/.test(value) ? parseInt(value, 10) : words[value.toLowerCase()];
}

function drawCount(card) {
    const matches = textOf(card).match(/\bdraw (?:a card|one card|\d+ cards?)\b/gi) ?? [];
    return matches.reduce((total, match) => {
        const number = /\d+/.exec(match)?.[0];
        return total + (number ? parseInt(number, 10) : 1);
    }, 0);
}

function qualityValues(card) {
    const text = textOf(card);
    const values = [];
    const scry = /\bscry (\d+)/i.exec(text);
    if (scry) {
        values.push(`Scry ${scry[1]}`);
    }

    const surveil = /\bsurveil (\d+)/i.exec(text);
    if (surveil) {
        values.push(`Surveil ${surveil[1]}`);
    }

    const look = /\blook at the top (\d+|one|two|three|four|five|six|seven|eight|nine|ten) cards?/i.exec(text);
    if (look) {
        values.push(`Look ${numberWordValue(look[1])}`);
    }

    return values;
}

function castSpeed(card) {
    if (/\bflash\b/i.test(textOf(card))) {
        return 'Flash';
    }

    return /\bInstant\b/i.test(typeLineOf(card)) ? 'Instant' : 'Sorcery';
}

function isCastableSpell(card) {
    const selectedCard = selected(card);
    return !selectedCard.isGamePiece && !selectedCard.isToken && !/\bLand\b/i.test(typeLineOf(card)) && manaCostOf(card) !== '';
}

function isLandCard(card) {
    return /\bLand\b/i.test(typeLineOf(card));
}

function kickerCosts(card) {
    return [...textOf(card).matchAll(/\bKicker(?:\s*[—-])?\s*((?:\{[^}]+\})+)/gi)]
        .map(match => match[1]);
}

function plotCosts(card) {
    return [...textOf(card).matchAll(/\bPlot\s*((?:\{[^}]+\})+)/gi)]
        .map(match => match[1]);
}

function tokenQuantityText(quantity) {
    if (!quantity || /^(?:a|an|one)$/i.test(quantity)) {
        return '';
    }

    return `${quantity.toLowerCase()} `;
}

function creatureTokenEffects(card) {
    const effects = [...textOf(card).matchAll(/\bcreate (?:(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) )?(\d+\/\d+) (?:[a-z]+ )*?([a-z][a-z-]*) creature tokens?(?: with ([^.]+))?/gi)]
        .map(match => {
            const quantity = tokenQuantityText(match[1]);
            const tokenType = sentenceCase(match[3]);
            const abilityText = match[4] ? ` with ${match[4].trim()}` : '';
            return `Create ${quantity}${match[2]} ${tokenType}${abilityText}`;
        });

    return [...new Set(effects)];
}

function abilityLines(card) {
    return textOf(card)
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
}

function cleanAbilityText(value) {
    return value
        .replace(/^[("]+/, '')
        .replace(/[.)"]+$/, '')
        .trim();
}

function normalizedAbilityCost(cost) {
    if (/^(cycling|basic landcycling|landcycling|equip)\b/i.test(cost)) {
        return cost.split(' (')[0].trim();
    }

    return cost;
}

function manaSourceAbilities(card) {
    if (!isLandCard(card)) {
        return [];
    }

    return abilityLines(card)
        .map(line => {
            const separatorIndex = line.indexOf(':');
            const cost = separatorIndex === -1 ? '' : cleanAbilityText(line.slice(0, separatorIndex));
            const effect = cleanAbilityText(separatorIndex === -1 ? line : line.slice(separatorIndex + 1));

            if (!/\badd\b/i.test(effect)) {
                return null;
            }

            const symbols = manaSymbols(effect).filter(symbol => /^[WUBRGC]$/i.test(symbol));
            const anyColor = /\bone mana of any colo[u]?r\b|\bmana of any colo[u]?r\b/i.test(effect);

            if (symbols.length === 0 && !anyColor) {
                return null;
            }

            return {
                cost,
                costSymbols: manaSymbols(cost),
                effect,
                symbols,
                anyColor,
            };
        })
        .filter(Boolean);
}

function isActivatedAbilityCost(cost) {
    if (/^(whenever|when|at the beginning|until end of turn|enchanted|equipped|if\b)/i.test(cost)) {
        return false;
    }

    return /(\{[^}]+\}|^remove\b|^sacrifice\b|^discard\b|^pay\b|^cycling\b|^basic landcycling\b|^landcycling\b|^equip\b|^[+\u2212-]\d+)/i.test(cost);
}

function activatedAbilityParts(line) {
    if (/^level\s+\d+/i.test(line)) {
        return null;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
        return null;
    }

    const cost = normalizedAbilityCost(cleanAbilityText(line.slice(0, separatorIndex)));
    const effect = cleanAbilityText(line.slice(separatorIndex + 1));
    if (cost === '' || effect === '' || /^level\s+\d+/i.test(effect) || !isActivatedAbilityCost(cost)) {
        return null;
    }

    return { cost, effect };
}

function activatedCondition(cost) {
    const counters = /remove (\d+|one|two|three|four|five|six|seven|eight|nine|ten) ([^.:\n]+? counters?) from/i.exec(cost);
    if (counters) {
        return `${numberWordValue(counters[1])} ${counters[2].toLowerCase()}`;
    }

    return 'Activated ability';
}

function activatedEffectText(effect) {
    const mana = /\badd ({[^}]+}|one mana(?: of any color)?)/i.exec(effect);
    if (mana) {
        return `Add ${mana[1]}`;
    }

    const become = /\bbecomes? (?:a |an )?([^."“”]+? creature)(?: with\b| until\b|\.|$)/i.exec(effect);
    if (become) {
        return `Become ${sentenceCase(become[1].trim())}`;
    }

    const createToken = /\bcreate (?:a |an )?(\d+\/\d+) [^.]*?\b([A-Za-z]+) creature token(?: with ([^.]+))?/i.exec(effect);
    if (createToken) {
        return `Create ${createToken[1]} ${createToken[2]}${createToken[3] ? ` with ${createToken[3]}` : ''}`;
    }

    if (/\bcreate a token that's a copy of/i.test(effect)) {
        return 'Create token copy';
    }

    const destroy = /\bdestroy target ([^.]+)/i.exec(effect);
    if (destroy) {
        return `Destroy target ${destroy[1]}`;
    }

    const search = /\bsearch your library for ([^.]+)/i.exec(effect);
    if (search) {
        return `Search library for ${search[1]}`;
    }

    const attach = /\battach to target ([^.]+)/i.exec(effect);
    if (attach) {
        return `Attach to target ${attach[1]}`;
    }

    const returnFromGraveyard = /\breturn target ([^.]+?) from your graveyard to the battlefield/i.exec(effect);
    if (returnFromGraveyard) {
        return `Reanimate ${returnFromGraveyard[1]}`;
    }

    const returnThisFromGraveyard = /\breturn this card from your graveyard to the battlefield/i.exec(effect);
    if (returnThisFromGraveyard) {
        return 'Reanimate this card';
    }

    const returnFromGraveyardToHand = /\breturn (?:a |target )?([^.]+?) from your graveyard to your hand/i.exec(effect);
    if (returnFromGraveyardToHand) {
        return `Return ${returnFromGraveyardToHand[1]} to hand`;
    }

    if (/\bdraw a card\b/i.test(effect)) {
        return 'Draw a card';
    }

    const counter = /\bput (?:a |\d+ )?\+1\/\+1 counters? on ([^.]+)/i.exec(effect);
    if (counter) {
        return `Put +1/+1 counter on ${counter[1]}`;
    }

    const firstSentence = effect.split('.')[0]?.trim() ?? effect;
    return sentenceCase(firstSentence);
}

function activatedValueText(effect) {
    const values = [];

    if (/\badd\b.*\bmana\b|\badd \{[^}]+\}/i.test(effect)) {
        values.push('Mana production');
    }

    if (/\bbecomes?\b.*\bcreature\b/i.test(effect)) {
        values.push('Creature conversion');
    }

    if (/\bcreate\b.*\bcreature token\b/i.test(effect)) {
        values.push('Creature token generation');
    }

    if (/\bcreate a token that's a copy of/i.test(effect)) {
        values.push('Token copy');
    }

    if (/\bdestroy target\b/i.test(effect)) {
        values.push('Removal');
    }

    if (/\bsearch your library\b/i.test(effect)) {
        values.push('Ramp/fixing');
    }

    if (/\battach to target\b/i.test(effect)) {
        values.push('Equipment attachment');
    }

    if (/\breturn target\b.*\bfrom your graveyard to the battlefield\b/i.test(effect)) {
        values.push('Reanimation');
    }

    if (/\breturn this card from your graveyard to the battlefield\b/i.test(effect)) {
        values.push('Reanimation');
    }

    if (/\breturn (?:a |target )?.*from your graveyard to your hand\b/i.test(effect)) {
        values.push('Card recursion');
    }

    if (/\bdiscard a card\b/i.test(effect) && /\bdraw a card\b/i.test(effect)) {
        values.push('Card filtering');
    } else if (/\bdraw a card\b/i.test(effect)) {
        values.push('Card draw');
    }

    if (/\bput\b.*\+1\/\+1 counters?\b|\bgets \+\d+\/\+\d+/i.test(effect)) {
        values.push('Creature improvement');
    }

    if (/\byou gain \d+ life\b/i.test(effect)) {
        values.push('Life gain');
    }

    return [...new Set(values)].join('; ');
}

function activatedOptionsForCard(card) {
    return abilityLines(card)
        .map(activatedAbilityParts)
        .filter(Boolean)
        .map(({ cost, effect }) => {
            return {
                condition: activatedCondition(cost),
                cost,
                costSymbols: manaSymbols(cost),
                effect: activatedEffectText(effect),
                speed: 'Sorcery',
                value: activatedValueText(effect),
            };
        })
        .filter(option => option.value !== '' || option.costSymbols.length > 0);
}

function synergyCategories() {
    return [
        'synergy.combat.feeders',
        'synergy.graveyardPlay.feeders',
        'synergy.creatureTokens.feeders',
        'synergy.etbLifeGain.feeders',
        'synergy.creatureDeathValue.feeders',
        'synergy.battlefieldToHand.sources',
        'synergy.entersBattlefield.sources',
    ];
}

function hasSynergy(summary, key) {
    return key.split('.').reduce((value, part) => value?.[part], summary)?.length > 0;
}

function synergyKind(key) {
    if (/etbLifeGain/.test(key)) {
        return 'etb';
    }

    if (/creatureDeathValue/.test(key)) {
        return 'death';
    }

    if (/graveyardPlay|battlefieldToHand|entersBattlefield/.test(key)) {
        return 'zone';
    }

    if (/\.feeders$/.test(key)) {
        return 'permanent';
    }

    return 'bonus';
}

function synergyCondition(key, card, relatedCard) {
    if (/creatureTokens/.test(key) && /five or more mana was spent/i.test(textOf(relatedCard))) {
        return `${relatedCard.name} threshold`;
    }

    if (/\.feeders$/.test(key) && /\bClass\b/i.test(typeLineOf(relatedCard))) {
        if (/graveyardPlay/.test(key)) {
            return `${relatedCard.name} class 2`;
        }

        if (/creatureTokens/.test(key)) {
            return `${relatedCard.name} class 3`;
        }

        return `${relatedCard.name} class 1`;
    }

    if (/\.feeders$/.test(key)) {
        return relatedCard.name;
    }

    if (/graveyardPlay/.test(key)) {
        return 'Class L2 unlocked';
    }

    if (/creatureTokens/.test(key)) {
        return 'Class L3 unlocked';
    }

    const actionCost = synergyActionCost(card, relatedCard, key);
    return actionCost === null ? '' : `Action ${actionCost}`;
}

function stateValue(handDelta) {
    if (handDelta === 0) {
        return '';
    }

    return `Card ${handDelta > 0 ? `+${handDelta}` : handDelta}`;
}

function damageValue(card, kicked = false) {
    const text = textOf(card);
    const kickedDamage = /if this spell was kicked, it deals (\d+) damage instead/i.exec(text);
    if (kicked && kickedDamage) {
        return `Damage ${kickedDamage[1]}`;
    }

    const baseDamage = /deals? (\d+) damage to (?:any target|target (?:creature|creature or planeswalker|player or planeswalker|opponent|player))/i.exec(text);
    return baseDamage ? `Damage ${baseDamage[1]}` : '';
}

function castEffectText(card, drawn, option = {}) {
    if (option.plotted) {
        return 'Exile for later cast';
    }

    const effects = [...creatureTokenEffects(card), ...qualityValues(card)];
    if (drawn > 0) {
        effects.push(`Draw ${drawn}`);
    }

    const damage = damageValue(card, option.kicked);
    if (damage) {
        effects.push(damage);
    }

    return effects.join(', ');
}

function castValueText(card, handValue, option = {}) {
    if (option.plotted) {
        return ['Delayed cast option', handValue].filter(Boolean).join('; ');
    }

    if (creatureTokenEffects(card).length > 0) {
        return ['Creature token generation', handValue].filter(Boolean).join('; ');
    }

    if (qualityValues(card).length > 0) {
        return 'Card quality improvement';
    }

    if (damageValue(card, option.kicked)) {
        return ['Direct damage', handValue].filter(Boolean).join('; ');
    }

    return handValue;
}

function detailSpeed(detail) {
    return /^I:/.test(detail) ? 'Instant' : 'Sorcery';
}

function synergySpeed(key, relatedCard, detail) {
    if (/\.feeders$/.test(key)) {
        return castSpeed(relatedCard);
    }

    return detailSpeed(detail);
}

function detailEffect(detail) {
    return detail.replace(/^[IS]:/, '').replace(/\scost \d+$/, '');
}

function isThresholdTokenCopyDetail(detail) {
    return /Copy token cost 5/.test(detail);
}

function withCastOptionCost(entry, option) {
    return {
        ...entry,
        actionCost: entry.cost,
        actionCostSymbols: entry.costSymbols,
        cost: option.cost,
        costSymbols: option.costSymbols ?? option.symbols,
    };
}

function manaOptionsForCast(option, relatedCards) {
    const requiredSymbols = coloredManaSymbols(option.cost);
    if (requiredSymbols.length === 0) {
        return [];
    }

    const seen = new Set();
    const options = [];

    for (const relatedCard of relatedCards) {
        for (const ability of manaSourceAbilities(relatedCard)) {
            const matchedSymbols = requiredSymbols.filter(symbol => {
                return ability.anyColor || ability.symbols.some(produced => produced.toUpperCase() === symbol.toUpperCase());
            });

            if (matchedSymbols.length === 0) {
                continue;
            }

            const key = `${relatedCard.name}:${ability.cost}:${ability.effect}`;
            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            options.push({
                condition: relatedCard.name,
                cost: ability.cost,
                costSymbols: ability.costSymbols,
                effect: ability.effect,
                quantity: relatedCard.quantity ?? 1,
                source: relatedCard.name,
                sourceLine: `x${relatedCard.quantity ?? 1}`,
                speed: 'Mana',
                value: `Pays ${matchedSymbols.map(symbol => `{${symbol}}`).join(' ')}`,
            });
        }
    }

    return options;
}

function synergyValueText(key, card, relatedCard) {
    if (/^synergy\.combat\./.test(key)) {
        return 'Creature improvement';
    }

    if (/^synergy\.graveyardPlay\./.test(key)) {
        return 'Card recursion';
    }

    if (/^synergy\.creatureTokens\./.test(key)) {
        return 'Creature token generation';
    }

    if (/^synergy\.etbLifeGain\./.test(key)) {
        return 'Life gain';
    }

    if (/^synergy\.creatureDeathValue\./.test(key)) {
        const valueCategory = synergyValueCategory(card, relatedCard, key);
        return {
            lifeDrain: 'Life drain',
            treasure: 'Treasure generation',
            damage: 'Direct damage',
            cardDraw: 'Card draw',
            payoff: 'Death payoff',
        }[valueCategory] ?? 'Death payoff';
    }

    if (/^synergy\.battlefieldToHand\./.test(key)) {
        return 'Battlefield reset';
    }

    if (/^synergy\.entersBattlefield\./.test(key)) {
        return 'ETB reuse';
    }

    return '';
}

function castOptionsForCard(card, drawn, handValue) {
    const baseCost = manaCostOf(card);
    const baseOption = {
        label: 'Cast',
        cost: baseCost,
        costValue: manaCostValue(baseCost),
        costSymbols: manaSymbols(baseCost),
        kicked: false,
    };

    const kickedOptions = kickerCosts(card).map(kickerCost => {
        const cost = addManaCosts(baseCost, kickerCost);
        return {
            label: 'Kicked',
            cost,
            costValue: manaCostValue(cost),
            costSymbols: manaSymbols(cost),
            kicked: true,
        };
    });
    const plotOptions = plotCosts(card).map(plotCost => {
        return {
            label: 'Plot',
            cost: plotCost,
            costValue: manaCostValue(plotCost),
            costSymbols: manaSymbols(plotCost),
            kicked: false,
            plotted: true,
        };
    });

    return [baseOption, ...kickedOptions, ...plotOptions].map(option => {
        return {
            ...option,
            baseRows: [
                {
                    condition: option.label,
                    cost: option.cost,
                    costSymbols: option.costSymbols,
                    effect: castEffectText(card, drawn, option),
                    speed: castSpeed(card),
                    value: castValueText(card, handValue, option),
                },
            ],
        };
    });
}

export function analyzeCardValue(card, relatedCards = []) {
    const activatedOptions = activatedOptionsForCard(card);

    if (!isCastableSpell(card)) {
        return {
            castOptions: [],
            zoneOptions: [],
            deathOptions: [],
            activatedOptions,
        };
    }

    const drawn = drawCount(card);
    const handDelta = -1 + drawn;
    const values = [];
    const handValue = stateValue(handDelta);
    if (handValue !== '') {
        values.push({ label: 'State', value: handValue });
    }

    for (const quality of qualityValues(card)) {
        values.push({ label: 'Effect', value: quality });
    }

    const castOptions = castOptionsForCard(card, drawn, handValue).map(option => {
        return {
            label: option.label,
            cost: option.cost,
            costValue: option.costValue,
            speed: castSpeed(card),
            symbols: option.costSymbols,
            baseRows: option.baseRows,
            values,
            bonuses: [],
            etbOptions: [],
            permanentOptions: [],
            manaOptions: manaOptionsForCast(option, relatedCards),
            zoneChanges: [],
        };
    });
    const zoneOptions = [];
    const deathOptions = [];
    const seenZoneOptions = new Set();
    const seenDeathOptions = new Set();

    for (const relatedCard of relatedCards) {
        const summary = summarizeCreatureInteractions([card], relatedCard);
        for (const key of synergyCategories()) {
            if (!hasSynergy(summary, key)) {
                continue;
            }

            const detail = synergyInteractionDetail(card, relatedCard, key);
            const cost = String(synergyActionCost(card, relatedCard, key) ?? '');
            const entry = {
                condition: synergyCondition(key, card, relatedCard),
                cost,
                costSymbols: numericCostSymbols(cost),
                detail,
                effect: detailEffect(detail),
                quantity: relatedCard.quantity ?? 1,
                source: relatedCard.name,
                sourceLine: `x${relatedCard.quantity ?? 1}`,
                speed: synergySpeed(key, relatedCard, detail),
                value: synergyValueText(key, card, relatedCard),
            };

            const kind = synergyKind(key);
            if (kind === 'zone') {
                const zoneKey = `${entry.source}:${key}:${entry.detail}`;
                if (!seenZoneOptions.has(zoneKey)) {
                    seenZoneOptions.add(zoneKey);
                    zoneOptions.push(entry);
                }
            } else if (kind === 'death') {
                const deathKey = `${entry.source}:${key}:${entry.detail}`;
                if (!seenDeathOptions.has(deathKey)) {
                    seenDeathOptions.add(deathKey);
                    deathOptions.push(entry);
                }
            } else {
                for (const option of castOptions) {
                    if (isThresholdTokenCopyDetail(detail) && option.costValue < (synergyActionCost(card, relatedCard, key) ?? 0)) {
                        continue;
                    }

                    if (kind === 'etb') {
                        option.etbOptions.push(withCastOptionCost(entry, option));
                    } else if (kind === 'permanent') {
                        option.permanentOptions.push(withCastOptionCost(entry, option));
                    } else {
                        option.bonuses.push(withCastOptionCost(entry, option));
                    }
                }
            }
        }
    }

    return {
        castOptions,
        zoneOptions,
        deathOptions,
        activatedOptions,
    };
}
