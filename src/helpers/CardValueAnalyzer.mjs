import {
    synergyActionCost,
    synergyInteractionDetail,
    synergyValueCategory,
    summarizeCreatureInteractions
} from './DeckInteractionAnalyzer.mjs';
import {
    damageActionAmountValue,
    parseDamageActions
} from './OracleParser.mjs';

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

function manaCostParts(card) {
    return manaCostOf(card)
        .split(/\s*\/\/\s*/)
        .map(part => part.trim())
        .filter(Boolean);
}

function primaryManaCostOf(card) {
    return manaCostParts(card)[0] ?? manaCostOf(card);
}

function manaSymbols(cost) {
    return [...cost.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
}

function manaSymbolGroupsFromText(value) {
    const addMatch = /\badd ([^.]+)/i.exec(value);
    const manaText = (addMatch?.[1] ?? value)
        .replace(/\bspend this mana\b.*$/i, '')
        .trim();
    const groups = manaText
        .split(/\s+or\s+/i)
        .map(part => manaSymbols(part).filter(symbol => /^[WUBRGC]$/i.test(symbol)))
        .filter(group => group.length > 0);

    return groups.length > 0 ? groups : [];
}

function flatManaSymbols(groups) {
    return groups.flat();
}

function manaRequirements(cost) {
    return manaSymbols(cost).reduce((requirements, symbol) => {
        if (/^[WUBRG]$/i.test(symbol)) {
            requirements.colored.push(symbol.toUpperCase());
        } else if (/^C$/i.test(symbol)) {
            requirements.colorless += 1;
        } else if (/^\d+$/.test(symbol)) {
            requirements.generic += parseInt(symbol, 10);
        }

        return requirements;
    }, {
        colored: [],
        colorless: 0,
        generic: 0,
    });
}

function formatManaSymbolValue(symbolGroups) {
    return symbolGroups
        .map(group => group.map(symbol => `{${symbol}}`).join(''))
        .join('/');
}

function anyColorSymbolGroups(requirements, includeColorless = false) {
    const uniqueRequiredColors = [...new Set(requirements.colored)];
    const symbolGroups = uniqueRequiredColors.map(symbol => [symbol]);

    if (includeColorless && requirements.colorless > 0) {
        symbolGroups.push(['C']);
    }

    if (symbolGroups.length > 0) {
        return symbolGroups;
    }

    return requirements.generic > 0
        ? [['W'], ['U'], ['B'], ['R'], ['G'], ...(includeColorless ? [['C']] : [])]
        : [];
}

function paySymbolsForProducedGroup(group, requirements) {
    const remainingColored = [...requirements.colored];
    let remainingColorless = requirements.colorless;
    let remainingGeneric = requirements.generic;
    const deferredSymbols = [];
    const paidSymbols = [];
    let matchedPrimaryRequirement = false;

    for (const rawSymbol of group) {
        const symbol = rawSymbol.toUpperCase();
        const colorIndex = remainingColored.indexOf(symbol);
        if (colorIndex !== -1) {
            remainingColored.splice(colorIndex, 1);
            paidSymbols.push(symbol);
            matchedPrimaryRequirement = true;
        } else if (symbol === 'C' && remainingColorless > 0) {
            remainingColorless -= 1;
            paidSymbols.push('C');
            matchedPrimaryRequirement = true;
        } else {
            deferredSymbols.push(symbol);
        }
    }

    for (const symbol of deferredSymbols) {
        if (remainingGeneric <= 0) {
            continue;
        }

        if (symbol === 'C' || matchedPrimaryRequirement) {
            paidSymbols.push('1');
            remainingGeneric -= 1;
        }
    }

    return paidSymbols;
}

function manaPaymentForAbility(ability, cost) {
    const requirements = manaRequirements(cost);
    const producedSymbolGroups = ability.anyColor || ability.anyType
        ? anyColorSymbolGroups(requirements, ability.anyType)
        : ability.symbolGroups;
    const paySymbolGroups = producedSymbolGroups
        .map(group => paySymbolsForProducedGroup(group, requirements))
        .filter(group => group.length > 0);

    if (paySymbolGroups.length === 0) {
        return null;
    }

    return {
        paySymbolGroups,
        producedSymbolGroups,
    };
}

function numericCostSymbols(cost) {
    return cost === '' ? [] : [cost];
}

function sentenceCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function addManaCosts(...costs) {
    return costs.filter(Boolean).join('');
}

function removeReminderText(value) {
    return value.replace(/\([^)]*\)/g, '').trim();
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

function drawCountFromText(text) {
    const matches = text.match(/\bdraw (?:a|one|two|three|four|five|six|seven|eight|nine|ten|\d+) cards?\b/gi) ?? [];
    return matches.reduce((total, match) => {
        const number = /(?:draw )(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i.exec(match)?.[1];
        return total + (number ? numberWordValue(number) : 1);
    }, 0);
}

function cardSelectionCountFromText(text, option = {}) {
    if (option.kicked) {
        const kickedSelect = /\bif this spell was kicked, put (\d+|one|two|three|four|five|six|seven|eight|nine|ten) of those cards into your hand instead/i.exec(text);
        if (kickedSelect) {
            return numberWordValue(kickedSelect[1]);
        }
    }

    const select = /\bput (\d+|one|two|three|four|five|six|seven|eight|nine|ten) of (?:those cards|them) into your hand/i.exec(text);
    return select ? numberWordValue(select[1]) : 0;
}

function tutorToHandCountFromText(text) {
    return /\bsearch your library for (?:a|an) [^.]+ card\b[^.]*\bput it into your hand\b/i.test(text) ? 1 : 0;
}

function qualityValuesFromText(text, option = {}) {
    const values = [];
    const scry = /\bscry (\d+)/i.exec(text);
    if (scry) {
        values.push(`Scry ${scry[1]}`);
    }

    const surveil = /\bsurveil (\d+)/i.exec(text);
    if (surveil) {
        values.push(`Surveil ${surveil[1]}`);
    }

    const look = /\blook at the top (X|\d+|one|two|three|four|five|six|seven|eight|nine|ten) cards?/i.exec(text);
    if (look) {
        values.push(`Look ${/^x$/i.test(look[1]) ? 'X' : numberWordValue(look[1])}`);
    }

    const selectedCards = cardSelectionCountFromText(text, option);
    if (selectedCards > 0) {
        values.push(`Select ${selectedCards}`);
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

function isPermanentCard(card) {
    return /\b(?:Artifact|Battle|Creature|Enchantment|Land|Planeswalker)\b/i.test(typeLineOf(card));
}

function isCreatureCard(card) {
    return /\bCreature\b/i.test(typeLineOf(card));
}

function kickerCosts(card) {
    return [...textOf(card).matchAll(/\bKicker(?:\s*[—-])?\s*((?:\{[^}]+\})+)/gi)]
        .map(match => match[1]);
}

function kickerAdditionalCosts(card) {
    return abilityLines(card)
        .map(line => {
            const sacrifice = /\bKicker\s*(?:[-\u2013\u2014]+)?\s*Sacrifice a creature\b/i.exec(line);
            if (sacrifice) {
                return {
                    label: 'Kicked sacrifice creature',
                    extraCost: '',
                    sacrificeCost: true,
                };
            }

            return null;
        })
        .filter(Boolean);
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

function splitFaceTextParts(card) {
    const costParts = manaCostParts(card);
    const typeParts = typeLineOf(card).split(/\s*\/\/\s*/).map(part => part.trim());
    if (costParts.length < 2 || typeParts.length < 2 || !/\b(?:Instant|Sorcery)\b/i.test(typeParts[1])) {
        return null;
    }

    const lines = abilityLines(card);
    if (lines.length < 2) {
        return null;
    }

    return {
        front: lines.slice(0, -1).join('\n'),
        spell: lines.at(-1),
    };
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

function manaSourceAbility(cost, effect, speed = 'Mana') {
    if (!/\badd\b/i.test(effect)) {
        return null;
    }

    const symbolGroups = manaSymbolGroupsFromText(effect);
    const symbols = flatManaSymbols(symbolGroups);
    const anyColor = /\bone mana of any colo[u]?r\b|\bmana of any colo[u]?r\b/i.test(effect);
    const anyType = /\bone mana of any type\b|\bmana of any type\b/i.test(effect);

    if (symbols.length === 0 && !anyColor && !anyType) {
        return null;
    }

    return {
        cost,
        costSymbols: manaSymbols(cost),
        effect,
        symbolGroups,
        symbols,
        anyColor,
        anyType,
        onlyInstantSorcery: /\bspend this mana only to cast instant and sorcery spells\b/i.test(effect),
        speed,
    };
}

function manaSourceAbilities(card) {
    if (isPermanentCard(card)) {
        return abilityLines(card)
            .map(line => {
                const separatorIndex = line.indexOf(':');
                const cost = separatorIndex === -1 ? '' : cleanAbilityText(line.slice(0, separatorIndex));
                const effect = cleanAbilityText(separatorIndex === -1 ? line : line.slice(separatorIndex + 1));

                if (!isActivatedAbilityCost(cost)) {
                    return null;
                }

                return manaSourceAbility(cost, effect);
            })
            .filter(Boolean);
    }

    if (!isCastableSpell(card)) {
        return [];
    }

    return abilityLines(card)
        .map(line => manaSourceAbility(manaCostOf(card), cleanAbilityText(removeReminderText(line)), castSpeed(card)))
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

function activatedCondition(cost, effect = '') {
    const activationGate = /\bactivate only if ([^.]+)/i.exec(effect);
    if (activationGate) {
        return sentenceCase(activationGate[1].trim());
    }

    const counters = /remove (\d+|one|two|three|four|five|six|seven|eight|nine|ten) ([^.:\n]+? counters?) from/i.exec(cost);
    if (counters) {
        return `${numberWordValue(counters[1])} ${counters[2].toLowerCase()}`;
    }

    return 'Activated ability';
}

function activatedEffectText(effect) {
    const mana = /\badd (((?:\{[^}]+\})+)|one mana(?: of any color)?)/i.exec(effect);
    if (mana) {
        return `Add ${mana[1]}`;
    }

    if (/\bexile the top card of your library\b/i.test(effect) && /\byou may play that card\b/i.test(effect)) {
        return 'Impulse draw';
    }

    if (/\bnext spell you cast\b.*\bcan't be countered\b/i.test(effect)) {
        return 'Protect next spell from counters';
    }

    const become = /\bbecomes? (?:a |an )?([^."\u201c\u201d]+? creature)(?: with\b| until\b|\.|$)/i.exec(effect);
    if (become) {
        return `Become ${sentenceCase(become[1].trim())}`;
    }

    if (/\bcreate (?:a |one )?Treasure token/i.test(effect)) {
        return 'Create Treasure';
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

    if (/\bexile the top card of your library\b/i.test(effect) && /\byou may play that card\b/i.test(effect)) {
        values.push('Card access');
    }

    if (/\bnext spell you cast\b.*\bcan't be countered\b/i.test(effect)) {
        values.push('Stack protection');
    }

    if (/\bbecomes?\b.*\bcreature\b/i.test(effect)) {
        values.push('Creature conversion');
    }

    if (/\bcreate (?:a |one )?Treasure token/i.test(effect)) {
        values.push('Treasure generation');
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
                condition: activatedCondition(cost, effect),
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

function cleanChoicePrefix(value) {
    return value
        .replace(/^\s*(?:\*|\u2022|â€¢)\s*/, '')
        .replace(/\s*(?:\u2014|â€”|-)\s*$/u, '')
        .trim();
}

function cleanChoiceEffect(value) {
    return value
        .replace(/^\s*(?:\u2014|â€”|-)\s*/u, '')
        .trim();
}

function choiceEffectLabel(effect) {
    if (/\bcopy target (?:instant spell, sorcery spell, activated ability, or triggered ability|instant|sorcery|spell|ability)/i.test(effect)) {
        return 'Copy spell or ability';
    }

    if (/\bchange the target\b/i.test(effect)) {
        return 'Change target';
    }

    if (/\bdestroy target artifact\b/i.test(effect)) {
        return 'Destroy artifact';
    }

    if (/\bdeals? \d+ damage\b/i.test(effect)) {
        return 'Damage target';
    }

    const firstSentence = effect.split('.')[0]?.trim() ?? effect;
    return sentenceCase(firstSentence);
}

function parseCostedChoiceLines(card, lineTest) {
    return abilityLines(card)
        .map(line => {
            if (!lineTest(line)) {
                return null;
            }

            const cost = /((?:\{[^}]+\})+)/.exec(line);
            if (!cost) {
                return null;
            }

            const label = cleanChoicePrefix(line.slice(0, cost.index));
            const effect = cleanChoiceEffect(line.slice(cost.index + cost[1].length));
            if (label === '' || effect === '') {
                return null;
            }

            return {
                label,
                extraCost: cost[1],
                effectText: effect,
            };
        })
        .filter(Boolean);
}

function spellTextWithoutAdditionalCostLines(card) {
    return abilityLines(card)
        .filter(line => !/\bas an additional cost to cast this spell\b/i.test(line))
        .join('\n');
}

function additionalCostAlternativeOptions(card, baseCost) {
    const line = abilityLines(card).find(abilityLine => {
        return /\bas an additional cost to cast this spell\b/i.test(abilityLine) &&
            /\bsacrifice a creature\b/i.test(abilityLine) &&
            /\bpay ((?:\{[^}]+\})+)/i.test(abilityLine);
    });
    if (!line) {
        return [];
    }

    const payCost = /\bpay ((?:\{[^}]+\})+)/i.exec(line)?.[1];
    if (!payCost) {
        return [];
    }

    const paidCost = addManaCosts(baseCost, payCost);
    const effectText = spellTextWithoutAdditionalCostLines(card);
    return [
        {
            label: 'Sacrifice creature',
            cost: baseCost,
            costValue: manaCostValue(baseCost),
            costSymbols: manaSymbols(baseCost),
            effectText,
            sacrificeCost: true,
        },
        {
            label: `Pay ${payCost}`,
            cost: paidCost,
            costValue: manaCostValue(paidCost),
            costSymbols: manaSymbols(paidCost),
            effectText,
        },
    ];
}

function tieredChoiceOptions(card, baseCost) {
    if (!/\btiered\b/i.test(textOf(card))) {
        return [];
    }

    return parseCostedChoiceLines(card, line => /(?:\{[^}]+\})+/.test(line) && /\bdeals?\b/i.test(line))
        .map(choice => {
            const cost = addManaCosts(baseCost, choice.extraCost);
            return {
                label: choice.label,
                cost,
                costValue: manaCostValue(cost),
                costSymbols: manaSymbols(cost),
                effectText: choice.effectText,
            };
        });
}

function modalChoiceOptions(card, baseCost) {
    if (!/\bchoose one\b/i.test(textOf(card)) || /\btiered\b|\bspree\b/i.test(textOf(card))) {
        return [];
    }

    return abilityLines(card)
        .filter(line => /^\s*(?:\*|\u2022|â€¢)/u.test(line))
        .map(line => {
            const effectText = cleanChoicePrefix(line);
            return {
                label: choiceEffectLabel(effectText),
                cost: baseCost,
                costValue: manaCostValue(baseCost),
                costSymbols: manaSymbols(baseCost),
                effectText,
            };
        })
        .filter(option => option.effectText !== '');
}

function nonEmptyChoiceSubsets(choices) {
    const subsets = [];
    const max = 1 << choices.length;
    for (let mask = 1; mask < max; mask += 1) {
        subsets.push(choices.filter((choice, index) => (mask & (1 << index)) !== 0));
    }

    return subsets;
}

function spreeChoiceOptions(card, baseCost) {
    if (!/\bspree\b/i.test(textOf(card))) {
        return [];
    }

    const choices = parseCostedChoiceLines(card, line => /^\s*\+/.test(line))
        .map(choice => {
            return {
                ...choice,
                label: choiceEffectLabel(choice.effectText),
            };
        });

    return nonEmptyChoiceSubsets(choices).map(subset => {
        const cost = addManaCosts(baseCost, ...subset.map(choice => choice.extraCost));
        return {
            label: subset.map(choice => choice.label).join(' + '),
            cost,
            costValue: manaCostValue(cost),
            costSymbols: manaSymbols(cost),
            effectText: subset.map(choice => choice.effectText).join(' '),
        };
    });
}

function splitFaceSpellOption(card) {
    const costParts = manaCostParts(card);
    const typeParts = typeLineOf(card).split(/\s*\/\/\s*/).map(part => part.trim());
    if (costParts.length < 2 || typeParts.length < 2 || !/\b(?:Instant|Sorcery)\b/i.test(typeParts[1])) {
        return null;
    }

    const spellText = splitFaceTextParts(card)?.spell ?? '';
    if (spellText === '') {
        return null;
    }

    return {
        label: 'Spell face',
        cost: costParts[1],
        costValue: manaCostValue(costParts[1]),
        costSymbols: manaSymbols(costParts[1]),
        effectText: spellText,
        spellFace: true,
        speed: /\bInstant\b/i.test(typeParts[1]) ? 'Instant' : 'Sorcery',
    };
}

function damageValueFromText(text, kicked = false) {
    const kickedDamage = /if this spell was kicked, it deals (\d+) damage instead/i.exec(text);
    if (kicked && kickedDamage) {
        return `Damage ${kickedDamage[1]}`;
    }

    const [damageAction] = parseDamageActions(text);
    if (!damageAction) {
        return '';
    }

    const amount = damageActionAmountValue(damageAction) ?? damageAction.amount.raw;
    const eachCreature = damageAction.targets.some(target => {
        return target.selector === 'each' && target.candidates.some(candidate => {
            return candidate.entity === 'permanent' && candidate.cardTypes.includes('creature');
        });
    });
    return eachCreature ? `Damage ${amount} to each creature` : `Damage ${amount}`;
}

function debuffValueFromText(text, kicked = false) {
    const kickedDebuff = /\bif this spell was kicked, that creature gets -(X|\d+)\/-(X|\d+) until end of turn instead\b/i.exec(text);
    if (kicked && kickedDebuff) {
        return `Debuff -${kickedDebuff[1].toUpperCase()}/-${kickedDebuff[2].toUpperCase()}`;
    }

    const baseDebuff = /\btarget creature gets -(X|\d+)\/-(X|\d+) until end of turn\b/i.exec(text);
    if (baseDebuff) {
        return `Debuff -${baseDebuff[1].toUpperCase()}/-${baseDebuff[2].toUpperCase()}`;
    }

    const counters = /\bput (\d+|one|two|three|four|five|six|seven|eight|nine|ten) -1\/-1 counters? on target creature\b/i.exec(text);
    return counters ? `Debuff -${numberWordValue(counters[1])}/-${numberWordValue(counters[1])}` : '';
}

function cleanTargetDescription(value) {
    return value
        .replace(/\s+with mana value (\d+) or less\b/i, ' MV $1 or less')
        .replace(/\s+of their choice\b/i, '')
        .trim()
        .toLowerCase()
        .replace(/\bmv\b/g, 'MV');
}

function targetRemovalEffectTexts(text) {
    const effects = [];
    const exile = /\bexile target ((?:nonland )?permanent(?: with mana value \d+ or less)?|creature or planeswalker|creature|artifact|enchantment|planeswalker|battle)\b/i.exec(text);
    if (exile) {
        effects.push(`Exile ${cleanTargetDescription(exile[1])}`);
    }

    const destroy = /\bdestroy target ((?:nonland )?permanent(?: with mana value \d+ or less)?|artifact or enchantment|artifact or creature|creature or planeswalker|artifact|enchantment|tapped creature|creature|planeswalker|battle)\b/i.exec(text);
    if (destroy) {
        effects.push(`Destroy ${cleanTargetDescription(destroy[1])}`);
    }

    return effects;
}

function counterEffectText(text) {
    const manaValueOrGreater = /\bcounter target spell with mana value (\d+) or greater\b/i.exec(text);
    if (manaValueOrGreater) {
        return `Counter spell MV ${manaValueOrGreater[1]}+`;
    }

    const manaValue = /\bcounter target spell with mana value (\d+)\b/i.exec(text);
    if (manaValue) {
        return `Counter spell MV ${manaValue[1]}`;
    }

    const color = /\bcounter target ([^.]+?) spell\b/i.exec(text);
    if (color) {
        return `Counter ${color[1]} spell`;
    }

    return /\bcounter target spell\b/i.test(text) ? 'Counter spell' : '';
}

function spellEffectTexts(card, option = {}) {
    const text = removeReminderText(option.effectText ?? textOf(card));
    const effects = [...creatureTokenEffects({ selectedOption: { oracleText: text } }), ...qualityValuesFromText(text, option)];
    const drawn = drawCountFromText(text);

    if (drawn > 0) {
        effects.push(`Draw ${drawn}`);
    }

    const damage = damageValueFromText(text, option.kicked);
    if (damage) {
        effects.push(damage);
    }

    const debuff = debuffValueFromText(text, option.kicked);
    if (debuff) {
        effects.push(debuff);
    }

    const counter = counterEffectText(text);
    if (counter) {
        effects.push(counter);
    }

    effects.push(...targetRemovalEffectTexts(text));

    if (/\bits controller loses (\d+) life and you gain \1 life\b/i.test(text)) {
        const drain = /\bits controller loses (\d+) life and you gain \1 life\b/i.exec(text);
        effects.push(`Drain ${drain[1]}`);
    } else {
        const lifeGain = /\byou gain (\d+) life\b/i.exec(text);
        if (lifeGain) {
            effects.push(`Life gain ${lifeGain[1]}`);
        }
    }

    if (/\bcopy target (?:instant spell, sorcery spell, activated ability, or triggered ability|instant|sorcery|spell|ability)/i.test(text)) {
        effects.push('Copy spell or ability');
    }

    if (/\bchange the target\b/i.test(text)) {
        effects.push('Change target');
    }

    if (/\bsearch your library for an instant or sorcery card\b/i.test(text)) {
        effects.push('Tutor instant/sorcery');
    }

    if (/\btarget opponent exiles a creature they control and their graveyard\b/i.test(text)) {
        effects.push('Opponent exiles creature and graveyard');
    }

    if (/\btarget opponent exiles the top X cards\b/i.test(text)) {
        effects.push('Steal X opponent cards');
    }

    if (/\breturn target spell or permanent to\b/i.test(text)) {
        effects.push('Return spell or permanent to hand');
    } else if (/\breturn target permanent to\b/i.test(text)) {
        effects.push('Return permanent to hand');
    }

    if (/\btarget instant or sorcery card in your graveyard gains flashback\b/i.test(text)) {
        effects.push('Grant flashback to instant/sorcery');
    }

    return [...new Set(effects)];
}

function spellValueTexts(card, handValue, option = {}) {
    const text = removeReminderText(option.effectText ?? textOf(card));
    const values = [];

    if (creatureTokenEffects({ selectedOption: { oracleText: text } }).length > 0) {
        values.push('Creature token generation');
    }

    if (qualityValuesFromText(text, option).length > 0) {
        values.push('Card quality improvement');
    }

    if (drawCountFromText(text) > 0 && qualityValuesFromText(text, option).length === 0) {
        values.push('Card draw');
    }

    if (damageValueFromText(text, option.kicked)) {
        values.push(/each creature/i.test(text) ? 'Battlefield damage' : 'Direct damage');
    }

    if (counterEffectText(text) || /\bcopy target\b|\bchange the target\b/i.test(text)) {
        values.push('Stack interaction');
    }

    if (targetRemovalEffectTexts(text).length > 0 ||
        debuffValueFromText(text, option.kicked) ||
        /\btarget opponent exiles a creature they control\b|\breturn target spell or permanent to\b|\breturn target permanent to\b/i.test(text)) {
        values.push('Battlefield removal');
    }

    if (/\bloses \d+ life and you gain \d+ life\b/i.test(text)) {
        values.push('Life drain');
    } else if (/\byou gain \d+ life\b/i.test(text)) {
        values.push('Life gain');
    }

    if (/\bsearch your library for an instant or sorcery card\b/i.test(text)) {
        values.push('Tutor');
    }

    if (/\btarget opponent exiles the top X cards\b/i.test(text)) {
        values.push('Card theft');
    }

    if (/\btarget instant or sorcery card in your graveyard gains flashback\b/i.test(text)) {
        values.push('Graveyard cast access');
    }

    if (option.sacrificeCost) {
        values.push('Sacrifice outlet');
    }

    if (handValue !== '') {
        values.push(handValue);
    }

    return [...new Set(values)].join('; ');
}

function castEffectText(card, option = {}) {
    if (option.plotted) {
        return 'Exile for later cast';
    }

    return spellEffectTexts(card, option).join(', ');
}

function castValueText(card, handValue, option = {}) {
    if (option.plotted) {
        return ['Delayed cast option', handValue].filter(Boolean).join('; ');
    }

    return spellValueTexts(card, handValue, option);
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

function isBattlefieldToHandSpell(card) {
    return /return target permanent to (?:its|their|his|her|that permanent's) owner's hand/i.test(textOf(card));
}

function opponentBattlefieldToHandOption(card) {
    if (!isBattlefieldToHandSpell(card)) {
        return null;
    }

    return {
        condition: 'Opponent permanent',
        cost: manaCostOf(card),
        costSymbols: manaSymbols(manaCostOf(card)),
        detail: `${castSpeed(card) === 'Instant' ? 'I' : 'S'}:Battlefield to hand cost ${manaCostValue(manaCostOf(card))}`,
        effect: 'Battlefield to hand',
        quantity: 1,
        source: card.name,
        sourceLine: 'x1',
        speed: castSpeed(card),
        value: 'Battlefield reset',
    };
}

function classLevelSetupCost(source, targetLevel) {
    const levelCosts = [...textOf(source).matchAll(/((?:\{[^}]+\})+):\s*Level\s+(\d+)/gi)]
        .map(match => {
            return {
                cost: match[1],
                level: parseInt(match[2], 10),
            };
        })
        .sort((a, b) => a.level - b.level);

    if (!/\bClass\b/i.test(typeLineOf(source)) || levelCosts.length === 0) {
        return manaCostOf(source);
    }

    return addManaCosts(
        manaCostOf(source),
        ...levelCosts
            .filter(levelCost => levelCost.level <= targetLevel)
            .map(levelCost => levelCost.cost),
    );
}

function synergySourceAndFeeder(card, relatedCard, key) {
    return /\.feeders$/.test(key)
        ? { source: relatedCard, feeder: card }
        : { source: card, feeder: relatedCard };
}

function creatureConversionCost(card) {
    const conversion = abilityLines(card)
        .map(activatedAbilityParts)
        .find(parts => parts && /\bbecomes?\b.*\bcreature\b/i.test(parts.effect));

    return conversion?.cost ?? null;
}

function synergySetupCost(card, relatedCard, key) {
    const { source, feeder } = synergySourceAndFeeder(card, relatedCard, key);

    if (/^synergy\.graveyardPlay\./.test(key)) {
        return classLevelSetupCost(source, 2);
    }

    if (/^synergy\.creatureTokens\./.test(key) && /\bClass\b/i.test(typeLineOf(source))) {
        return classLevelSetupCost(source, 3);
    }

    if (/^synergy\.entersBattlefield\./.test(key)) {
        return addManaCosts(primaryManaCostOf(source), primaryManaCostOf(feeder));
    }

    if (/^synergy\.combat\./.test(key) && selected(source).isToken) {
        return '';
    }

    if (/^synergy\.combat\./.test(key) && !isCreatureCard(source)) {
        return creatureConversionCost(source) ?? primaryManaCostOf(source);
    }

    return primaryManaCostOf(source);
}

function withSetupCost(entry, card, relatedCard, key) {
    const setupCost = synergySetupCost(card, relatedCard, key);

    return {
        ...entry,
        actionCost: entry.cost,
        actionCostSymbols: entry.costSymbols,
        cost: setupCost,
        costSymbols: manaSymbols(setupCost),
    };
}

function ownBattlefieldToHandOption(entry, card, relatedCard, key) {
    return {
        ...withSetupCost(entry, card, relatedCard, key),
        condition: relatedCard.name,
        effect: 'Battlefield to hand + draw',
        value: 'Battlefield reset; Card draw',
    };
}

function manaOptionsForCast(card, option, relatedCards) {
    const requirements = manaRequirements(option.cost);
    if (requirements.colored.length === 0 && requirements.colorless === 0 && requirements.generic === 0) {
        return [];
    }

    const seen = new Set();
    const options = [];

    for (const relatedCard of relatedCards) {
        for (const ability of manaSourceAbilities(relatedCard)) {
            if (ability.onlyInstantSorcery && !isInstantOrSorceryOption(card, option)) {
                continue;
            }

            const payment = manaPaymentForAbility(ability, option.cost);
            if (!payment) {
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
                display: isLandCard(relatedCard) ? 'chip' : 'row',
                effect: ability.effect,
                kind: isLandCard(relatedCard) ? 'land-payment' : 'payment',
                paySymbolGroups: payment.paySymbolGroups,
                quantity: relatedCard.quantity ?? 1,
                restriction: ability.onlyInstantSorcery ? 'instant/sorcery only' : '',
                producedSymbolGroups: payment.producedSymbolGroups,
                producedSymbols: flatManaSymbols(payment.producedSymbolGroups),
                source: relatedCard.name,
                sourceLine: `x${relatedCard.quantity ?? 1}`,
                speed: ability.speed,
                value: `Pays ${formatManaSymbolValue(payment.paySymbolGroups)}`,
            });
        }
    }

    return options;
}

function isInstantOrSorceryOption(card, option = {}) {
    if (option.frontFace) {
        return false;
    }

    if (option.speed) {
        return /^(?:Instant|Sorcery)$/i.test(option.speed);
    }

    return /\b(?:Instant|Sorcery)\b/i.test(typeLineOf(card));
}

function instantSorceryCastUnlockOptions(card, option, relatedCards) {
    if (!isInstantOrSorceryOption(card, option)) {
        return [];
    }

    const options = [];
    const seen = new Set();
    for (const relatedCard of relatedCards) {
        for (const parts of abilityLines(relatedCard).map(activatedAbilityParts).filter(Boolean)) {
            if (!/\bactivate only if (?:you've|you have) cast an instant or sorcery spell this turn\b/i.test(parts.effect)) {
                continue;
            }

            const key = `${relatedCard.name}:${parts.cost}:${parts.effect}`;
            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            const effect = activatedEffectText(parts.effect);
            options.push({
                condition: relatedCard.name,
                cost: primaryManaCostOf(relatedCard),
                costSymbols: manaSymbols(primaryManaCostOf(relatedCard)),
                actionCost: manaCostValue(parts.cost).toString(),
                actionCostSymbols: manaSymbols(parts.cost),
                detail: `${option.speed === 'Instant' || castSpeed(card) === 'Instant' ? 'I' : 'S'}:Enable ${effect} cost ${manaCostValue(option.cost)}`,
                effect: `Enable ${effect}`,
                quantity: relatedCard.quantity ?? 1,
                source: relatedCard.name,
                sourceLine: `x${relatedCard.quantity ?? 1}`,
                speed: option.speed ?? castSpeed(card),
                value: activatedValueText(parts.effect),
            });
        }
    }

    return options;
}

function creatureShapeEffects(source) {
    const text = textOf(source);
    if (!/\btarget creature\b/i.test(text) || !castSpeed(source)) {
        return [];
    }

    const effects = [];
    if (/\bbase power and toughness 1\/1\b/i.test(text) && /\bhexproof\b/i.test(text)) {
        effects.push({
            effect: 'Become 1/1 with hexproof',
            value: 'Creature protection',
        });
    }

    if (/\bbase power and toughness 3\/4\b/i.test(text) && /\bflying\b/i.test(text) && /\bvigilance\b/i.test(text)) {
        effects.push({
            effect: 'Become 3/4 with flying and vigilance',
            value: 'Creature improvement',
        });
    }

    return effects;
}

function creatureModifierOptionsForCard(card, relatedCards) {
    if (!isCreatureCard(card)) {
        return [];
    }

    return relatedCards.flatMap(source => {
        return creatureShapeEffects(source).map(({ effect, value }) => {
            return {
                condition: source.name,
                cost: manaCostOf(source),
                costSymbols: manaSymbols(manaCostOf(source)),
                effect,
                quantity: source.quantity ?? 1,
                source: source.name,
                sourceLine: `x${source.quantity ?? 1}`,
                speed: castSpeed(source),
                value,
            };
        });
    });
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
            token: 'Creature token generation',
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

function handDeltaForOption(card, option = {}) {
    const text = removeReminderText(option.effectText ?? textOf(card));
    return -1 + drawCountFromText(text) + cardSelectionCountFromText(text, option) + tutorToHandCountFromText(text);
}

function valuesForOption(card, option, handValue) {
    const text = removeReminderText(option.effectText ?? textOf(card));
    const values = [];
    if (handValue !== '') {
        values.push({ label: 'State', value: handValue });
    }

    for (const quality of qualityValuesFromText(text, option)) {
        values.push({ label: 'Effect', value: quality });
    }

    return values;
}

function castOptionsForCard(card) {
    const baseCost = primaryManaCostOf(card);
    const splitParts = splitFaceTextParts(card);
    const baseOption = {
        label: 'Cast',
        cost: baseCost,
        costValue: manaCostValue(baseCost),
        costSymbols: manaSymbols(baseCost),
        effectText: splitParts?.front,
        frontFace: splitParts !== null,
        kicked: false,
    };

    const explicitOptions = [
        ...additionalCostAlternativeOptions(card, baseCost),
        ...tieredChoiceOptions(card, baseCost),
        ...spreeChoiceOptions(card, baseCost),
        ...modalChoiceOptions(card, baseCost),
    ];

    const kickedOptions = [
        ...kickerCosts(card).map(kickerCost => {
            return {
                label: 'Kicked',
                extraCost: kickerCost,
                sacrificeCost: false,
            };
        }),
        ...kickerAdditionalCosts(card),
    ].map(kickerOption => {
        const cost = addManaCosts(baseCost, kickerOption.extraCost);
        return {
            label: kickerOption.label,
            cost,
            costValue: manaCostValue(cost),
            costSymbols: manaSymbols(cost),
            kicked: true,
            sacrificeCost: kickerOption.sacrificeCost === true,
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
    const spellFace = splitFaceSpellOption(card);

    return [
        ...(explicitOptions.length > 0 ? explicitOptions : [baseOption]),
        ...kickedOptions,
        ...plotOptions,
        ...(spellFace ? [spellFace] : []),
    ].map(option => {
        const handValue = stateValue(handDeltaForOption(card, option));
        return {
            ...option,
            baseRows: [
                {
                    condition: option.label,
                    cost: option.cost,
                    costSymbols: option.costSymbols,
                    effect: castEffectText(card, option),
                    speed: option.speed ?? castSpeed(card),
                    value: castValueText(card, handValue, option),
                },
            ],
            values: valuesForOption(card, option, handValue),
        };
    });
}

function optionCanCarrySynergy(option, key) {
    if (!option.frontFace) {
        return true;
    }

    return !/^synergy\.(?:combat|graveyardPlay|creatureTokens)\.feeders$/.test(key);
}

export function analyzeCardValue(card, relatedCards = []) {
    const activatedOptions = activatedOptionsForCard(card);
    const creatureOptions = creatureModifierOptionsForCard(card, relatedCards);

    if (!isCastableSpell(card)) {
        return {
            castOptions: [],
            zoneOptions: [],
            deathOptions: [],
            creatureOptions,
            activatedOptions,
        };
    }

    const castOptions = castOptionsForCard(card).map(option => {
        return {
            label: option.label,
            cost: option.cost,
            costValue: option.costValue,
            speed: option.speed ?? castSpeed(card),
            symbols: option.costSymbols,
            frontFace: option.frontFace === true,
            spellFace: option.spellFace === true,
            kicked: option.kicked === true,
            sacrificeCost: option.sacrificeCost === true,
            effectText: option.effectText ?? textOf(card),
            baseRows: option.baseRows,
            values: option.values,
            bonuses: [],
            etbOptions: [],
            permanentOptions: instantSorceryCastUnlockOptions(card, option, relatedCards),
            manaOptions: manaOptionsForCast(card, option, relatedCards),
            zoneChanges: [],
        };
    });
    const zoneOptions = [];
    const deathOptions = [];
    const seenZoneOptions = new Set();
    const seenDeathOptions = new Set();
    const opponentBounce = opponentBattlefieldToHandOption(card);
    if (opponentBounce) {
        zoneOptions.push(opponentBounce);
    }

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
                    zoneOptions.push(/^synergy\.battlefieldToHand\.sources$/.test(key)
                        ? ownBattlefieldToHandOption(entry, card, relatedCard, key)
                        : withSetupCost(entry, card, relatedCard, key));
                }
            } else if (kind === 'death') {
                const deathKey = `${entry.source}:${key}:${entry.detail}`;
                if (!seenDeathOptions.has(deathKey)) {
                    seenDeathOptions.add(deathKey);
                    deathOptions.push(withSetupCost(entry, card, relatedCard, key));
                }
            } else {
                for (const option of castOptions) {
                    if (!optionCanCarrySynergy(option, key)) {
                        continue;
                    }

                    if (isThresholdTokenCopyDetail(detail) && option.costValue < (synergyActionCost(card, relatedCard, key) ?? 0)) {
                        continue;
                    }

                    if (kind === 'etb') {
                        option.etbOptions.push(withSetupCost(entry, card, relatedCard, key));
                    } else if (kind === 'permanent') {
                        option.permanentOptions.push(withSetupCost(entry, card, relatedCard, key));
                    } else {
                        option.bonuses.push(withSetupCost(entry, card, relatedCard, key));
                    }
                }
            }
        }
    }

    return {
        castOptions,
        zoneOptions,
        deathOptions,
        creatureOptions,
        activatedOptions,
    };
}
