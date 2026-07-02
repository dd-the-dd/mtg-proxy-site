export const ruleContractGroups = [
    {
        key: 'hookRules',
        title: 'Hook rule shape',
        definitions: [
            {
                name: 'hookRule',
                signature: 'def hook_rule(hook_type: HookEvent, source_id: str, activation_logic: ConditionExpr, actions: list[ActionStep]) -> HookRule',
                detail: 'A serializable trigger or replacement rule with a game timing, a boolean condition expression, and ordered state-changing actions.',
            },
            {
                name: 'activationLogic',
                signature: 'def activation_logic(expr: ConditionExpr, event: Event, state: GameState) -> bool',
                detail: 'Evaluate a parenthesized condition tree using not, all/and, any/or, and named condition functions.',
            },
            {
                name: 'actionStep',
                signature: 'def action_step(action: Action, cost: Cost | None, activation_logic: ConditionExpr | None, state: GameState) -> None',
                detail: 'One item in a hook action list; it may have its own cost or activation logic before mutating game state.',
            },
        ],
    },
    {
        key: 'events',
        title: 'Hooks / events',
        definitions: [
            {
                name: 'cast',
                signature: 'def on_cast(card_id: str, controller: PlayerId, paid_cost: Cost, mana_value_paid: int) -> Event',
                detail: 'A spell has been cast and is put on the stack. Lands do not use this event.',
            },
            {
                name: 'enterBattlefield',
                signature: 'def on_enter_battlefield(card_id: str, controller: PlayerId, from_zone: Zone) -> Event',
                detail: 'A permanent enters the battlefield, including lands from special actions.',
            },
            {
                name: 'leaveBattlefield',
                signature: 'def on_leave_battlefield(card_id: str, controller: PlayerId, to_zone: Zone) -> Event',
                detail: 'A permanent leaves the battlefield and moves to another zone.',
            },
            {
                name: 'enterGraveyard',
                signature: 'def on_enter_graveyard(card_id: str, owner: PlayerId, from_zone: Zone) -> Event',
                detail: 'A card enters a graveyard from any zone.',
            },
            {
                name: 'leaveGraveyard',
                signature: 'def on_leave_graveyard(card_id: str, owner: PlayerId, to_zone: Zone) -> Event',
                detail: 'A card leaves a graveyard.',
            },
            {
                name: 'draw',
                signature: 'def on_draw(player: PlayerId, card_id: str) -> Event',
                detail: 'A player draws a card from the top of their library.',
            },
            {
                name: 'mill',
                signature: 'def on_mill(player: PlayerId, card_ids: list[str]) -> Event',
                detail: 'One or more cards move from the top of library to graveyard.',
            },
            {
                name: 'scry',
                signature: 'def on_scry(player: PlayerId, seen_card_ids: list[str], bottom_card_ids: list[str]) -> Event',
                detail: 'A player looks at top library cards, then keeps or bottoms them.',
            },
            {
                name: 'surveil',
                signature: 'def on_surveil(player: PlayerId, seen_card_ids: list[str], graveyard_card_ids: list[str]) -> Event',
                detail: 'A player looks at top library cards, then keeps or mills them.',
            },
            {
                name: 'discard',
                signature: 'def on_discard(player: PlayerId, card_ids: list[str], reason: str) -> Event',
                detail: 'Cards move from hand to graveyard by discard.',
            },
            {
                name: 'gainLife',
                signature: 'def on_gain_life(players: list[PlayerId], amount: int, source_id: str | None) -> Event',
                detail: 'One or more players gain life.',
            },
            {
                name: 'loseLife',
                signature: 'def on_lose_life(players: list[PlayerId], amount: int, source_id: str | None) -> Event',
                detail: 'One or more players lose life.',
            },
            {
                name: 'damage',
                signature: 'def on_damage(targets: list[PlayerId | PermanentId], amount: int, source_id: str) -> Event',
                detail: 'Damage is assigned to players, creatures, planeswalkers, or battles.',
            },
        ],
    },
    {
        key: 'conditions',
        title: 'Conditions',
        definitions: [
            {
                name: 'always',
                signature: 'def condition_always(event: Event, state: GameState) -> bool',
                detail: 'Unconditional branch that always applies.',
            },
            {
                name: 'all',
                signature: 'def condition_all(conditions: list[Condition], event: Event, state: GameState) -> bool',
                detail: 'Logical AND over child conditions.',
            },
            {
                name: 'any',
                signature: 'def condition_any(conditions: list[Condition], event: Event, state: GameState) -> bool',
                detail: 'Logical OR over child conditions.',
            },
            {
                name: 'not',
                signature: 'def condition_not(condition: Condition, event: Event, state: GameState) -> bool',
                detail: 'Logical negation.',
            },
            {
                name: 'spellCastMatches',
                signature: 'def condition_spell_cast_matches(card_types: list[str], non_creature: bool, controller: PlayerScope, event: Event) -> bool',
                detail: 'The cast spell matches type and controller constraints.',
            },
            {
                name: 'sourceEnteredBattlefield',
                signature: 'def condition_source_entered_battlefield(source_id: str, event: Event) -> bool',
                detail: 'The hook source itself entered the battlefield.',
            },
            {
                name: 'permanentEnteredMatches',
                signature: 'def condition_permanent_entered_matches(card_types: list[str], controller: PlayerScope, nontoken: bool, exclude_source: bool, event: Event) -> bool',
                detail: 'A permanent entered and matches type/token/source constraints.',
            },
            {
                name: 'permanentMovedZones',
                signature: 'def condition_permanent_moved_zones(card_types: list[str], from_zone: Zone, to_zone: Zone, controller: PlayerScope, event: Event) -> bool',
                detail: 'A matching permanent changed zones.',
            },
            {
                name: 'phaseBeginsForController',
                signature: 'def condition_phase_begins_for_controller(player: PlayerScope, event: Event) -> bool',
                detail: 'A beginning-of-step event belongs to the hook controller.',
            },
            {
                name: 'playerLifeChanged',
                signature: 'def condition_player_life_changed(players: list[PlayerScope], change: "gain" | "lose", amount: int | None, event: Event) -> bool',
                detail: 'A player or group of players gained or lost life.',
            },
            {
                name: 'targetStillValid',
                signature: 'def condition_target_still_valid(target_ids: list[str], target_requirements: TargetSpec, state: GameState) -> bool',
                detail: 'At least one chosen target is still legal as a spell or ability resolves.',
            },
            {
                name: 'youControlAny',
                signature: 'def condition_you_control_any(controller: PlayerId, candidates: list[EntitySpec], state: GameState) -> bool',
                detail: 'The controller has at least one battlefield permanent matching one of the candidate type, subtype, name, or identifier specs.',
            },
        ],
    },
    {
        key: 'actions',
        title: 'Actions / state modifiers',
        definitions: [
            {
                name: 'drawCards',
                signature: 'def action_draw_cards(player: PlayerId, amount: int, state: GameState) -> None',
                detail: 'Move cards from library top to hand.',
            },
            {
                name: 'millCards',
                signature: 'def action_mill_cards(player: PlayerId, amount: int, state: GameState) -> None',
                detail: 'Move cards from library top to graveyard.',
            },
            {
                name: 'scry',
                signature: 'def action_scry(player: PlayerId, amount: int, choice: PlayerChoice, state: GameState) -> None',
                detail: 'Ask the player which seen cards stay on top or go to bottom.',
            },
            {
                name: 'dealDamage',
                signature: 'def action_deal_damage(targets: list[PlayerId | PermanentId], amount: int, source_id: str, state: GameState) -> None',
                detail: 'Apply damage to players, creatures, planeswalkers, or battles.',
            },
            {
                name: 'gainLife',
                signature: 'def action_gain_life(players: list[PlayerId], amount: int, state: GameState) -> None',
                detail: 'Increase player life totals.',
            },
            {
                name: 'moveCards',
                signature: 'def action_move_cards(card_ids: list[str], from_zone: Zone, to_zone: Zone, owner: PlayerId, state: GameState) -> None',
                detail: 'Move cards between library, hand, graveyard, exile, battlefield, stack, or command zone.',
            },
            {
                name: 'createToken',
                signature: 'def action_create_token(controller: PlayerId, token_name: str, state: GameState) -> None',
                detail: 'Create a token permanent on the battlefield.',
            },
            {
                name: 'modifyPermanent',
                signature: 'def action_modify_permanent(target_id: PermanentId, modifiers: list[Modifier], duration: Duration, state: GameState) -> None',
                detail: 'Apply temporary or permanent changes to a permanent.',
            },
            {
                name: 'modifyPlayer',
                signature: 'def action_modify_player(player: PlayerId, modifiers: list[Modifier], duration: Duration, state: GameState) -> None',
                detail: 'Apply player modifiers such as max hand size changes.',
            },
            {
                name: 'modifyRule',
                signature: 'def action_modify_rule(rule_key: str, value: RuleValue, duration: Duration, state: GameState) -> None',
                detail: 'Change rules such as lands per turn, draw-loss replacement, or no maximum hand size.',
            },
            {
                name: 'askPlayerChoice',
                signature: 'def action_ask_player_choice(player: PlayerId, options: list[DecisionOption], prompt: str, state: GameState) -> None',
                detail: 'Pause resolution until a player chooses between legal options.',
            },
        ],
    },
    {
        key: 'options',
        title: 'Player options / decisions',
        definitions: [
            {
                name: 'availableOption',
                signature: 'def option_available(card_id: str, source_zone: Zone, costs: list[Cost], timing: Timing, target_requirements: list[TargetSpec], stack_behavior: StackBehavior) -> PlayerOption',
                detail: 'An action the player may choose from a zone, such as cast, play land, activate ability, attack, or make mana.',
            },
            {
                name: 'targetChoice',
                signature: 'def option_choose_targets(option_id: str, target_requirements: list[TargetSpec], state: GameState) -> list[TargetId]',
                detail: 'Targets must be legal before costs are paid and are checked again when the stack object resolves.',
            },
            {
                name: 'decisionOption',
                signature: 'def option_decision(prompt: str, choices: list[DecisionOption], default_choice: str | None) -> PendingChoice',
                detail: 'A player-facing choice created by effects such as modal spells, you-may clauses, mulligan bottoms, scry, or surveil.',
            },
        ],
    },
];

const definitionsByName = new Map(ruleContractGroups.flatMap(group => {
    return group.definitions.map(definition => [definition.name, definition]);
}));

export function ruleDefinitionForName(name) {
    return definitionsByName.get(name) ?? null;
}
