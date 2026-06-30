<template>
  <div class="section">
    <HelpModal ref="helpModal" />

    <div
      class="app-layout"
      :class="{ 'app-layout-sidebar-collapsed': leftMenuCollapsed }"
    >
      <aside id="app-sidebar" class="app-sidebar">
        <button
          id="toggle-left-menu"
          class="btn btn-block"
          @click="leftMenuCollapsed = !leftMenuCollapsed"
        >
          {{ leftMenuCollapsed ? '>' : '<' }}
        </button>
        <div v-if="!leftMenuCollapsed" class="app-sidebar-content">
          <div
            v-if="localAppEnabled"
            id="local-session-menu"
            class="mb-2"
          >
            <button
              id="toggle-session-menu"
              class="btn btn-block"
              @click="sessionsMenuOpen = !sessionsMenuOpen"
            >
              {{ sessionsMenuOpen ? 'Sessions' : 'Sessions >' }}
              <LoadingSpinner
                v-if="isLoadingSessionList"
                size="sm"
                label="Loading sessions"
              />
            </button>
            <div v-if="sessionsMenuOpen" class="local-session-menu-body">
              <button
                id="new-local-session"
                class="btn btn-primary btn-block"
                @click="createLocalSession"
              >
                + New Session
              </button>
              <div v-if="activeSessionId" class="form-group mt-2">
                <label class="form-label" for="local-session-name">Name</label>
                <input
                  id="local-session-name"
                  class="form-input"
                  type="text"
                  v-model="activeSessionName"
                  @change="scheduleSessionSave"
                >
              </div>
              <label v-if="activeSessionId" class="form-switch">
                <input
                  id="local-session-is-meta"
                  type="checkbox"
                  v-model="activeSessionIsMetaDeck"
                >
                <i class="form-icon" /> Meta deck
              </label>
              <div class="menu local-session-list">
                <button
                  v-for="session in localSessions"
                  :key="session.id"
                  type="button"
                  class="menu-item btn btn-link local-session-item"
                  :class="{ active: session.id === activeSessionId }"
                  @click="loadLocalSession(session.id)"
                >
                  {{ session.name }}
                  <span v-if="session.isMetaDeck" class="label label-primary float-right">Meta</span>
                </button>
              </div>
            </div>
          </div>
          <div class="mb-2" style="z-index: 300">
            <div
              id="config"
              class="form-group p-sticky"
            >
              <div class="form-group">
                <textarea
                  id="deck-input"
                  class="form-input"
                  title="Deck Input"
                  v-model="config.decklist"
                  autofocus
                  placeholder="4 Wild Nacatl&#10;0x Griselbrand&#10;4 Strip Mine (ATQ) 82d&#10;&#10;// Sideboard&#10;3x Rough // Tumble&#10;SB: dead/gone&#10;&#10;// Tokens&#10;5 Goblin&#10;Lost Mine of Phandelver"
                />
              </div>

              <div class="form-group btn-group btn-group-block">
                <button
                  id="submit-decklist"
                  class="btn btn-primary"
                  @click="loadCardList()"
                  :class="{ loading: isLoadingDeckList || isHydratingCards }"
                  :disabled="isLoadingDeckList || isHydratingCards"
                >
                  {{ cards.length ? $t('buttons.update') : $t('buttons.submit') }}
                </button>
                <button
                  id="print"
                  class="btn btn-block tooltip"
                  @click="printList"
                  :disabled="cards.length == 0"
                  :data-tooltip="$t('consumedSlots', { count: cardCountWhenPrinting.count, bound: cardCountWhenPrinting.bound})"
                >
                  <span class="icon-print" /> {{ $t('buttons.print') }}
                </button>
              </div>
              <div class="form-group">
                <button
                  id="open-print-order"
                  class="btn btn-block"
                  @click="openPrintOrderModal"
                  :disabled="printSlotsFrontBase.length == 0"
                >
                  Print Order
                </button>
              </div>
              <div class="form-group">
                <label class="form-switch">
                  <input
                    id="analysis-mode"
                    type="checkbox"
                    v-model="config.analysisMode"
                  >
                  <i class="form-icon" /> Analysis mode
                </label>
              </div>
              <div v-if="config.analysisMode" id="analysis-config" class="form-group">
                <label class="form-label">
                  Metric
                  <select
                    class="form-select select"
                    v-model="config.analysisMetric"
                  >
                    <option value="count">Cards</option>
                    <option value="percent">Percent</option>
                  </select>
                </label>
                <label class="form-label">
                  View
                  <select
                    class="form-select select"
                    v-model="config.analysisView"
                  >
                    <option value="interaction">Interaction</option>
                    <option value="value">Value</option>
                  </select>
                </label>
                <label class="form-label">
                  Columns
                  <select
                    class="form-select select"
                    v-model="config.analysisColumnMode"
                  >
                    <option value="metaDeck">Meta decks</option>
                    <option value="manaValue">Mana value</option>
                  </select>
                </label>
                <label class="form-label">
                  Matchup
                  <select
                    class="form-select select"
                    v-model="config.analysisMatchupSessionId"
                  >
                    <option value="all">All meta decks</option>
                    <option
                      v-for="session in localSessions.filter(session => session.isMetaDeck)"
                      :key="session.id"
                      :value="session.id"
                    >
                      {{ session.name }}
                    </option>
                  </select>
                </label>
              </div>

              <div class="form-group btn-group btn-group-block">
                <div id="slot-usage" class="bar">
                  <template v-for="index in printCapacity.pageSize" :key="index">
                    <div
                      :class="`bar-item ${index <= cardCountWhenPrinting.overflow ? 'consumed' : 'unconsumed'}`"
                      role="progressbar"
                    />
                  </template>
                </div>
              </div>
              <div
                v-if="cards.length"
                id="print-capacity"
                class="text-small text-gray"
              >
                Open: {{ printCapacity.missingCards }} card slot{{ printCapacity.missingCards === 1 ? '' : 's' }}
                / {{ printCapacity.missingGamePieces }} game piece face{{ printCapacity.missingGamePieces === 1 ? '' : 's' }}
              </div>

              <div class="spacer" style="height: 0.4rem" />
              <div
                class="divider text-center"
                :data-content="$t('configuration.label').toUpperCase()"
              />

              <div class="columns">
                <div class="column col-12">
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="include-digital"
                      v-model="config.includeDigital"
                    >
                    <i class="form-icon" /> {{ $t('configuration.showDigitalPrintings') }}
                  </label>
                </div>

                <div class="column col-12">
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="include-promo"
                      v-model="config.includePromo"
                    >
                    <i class="form-icon" /> {{ $t('configuration.showPromoPrintings') }}
                  </label>
                </div>

                <div class="column col-12">
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="match-editions"
                      v-model="config.matchEditions"
                    >
                    <i class="form-icon" /> {{ $t('configuration.matchInputEditions') }}
                  </label>
                </div>

                <div class="column col-12">
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="include-basics"
                      v-model="config.includeBasics"
                    >
                    <i class="form-icon" /> {{ $t('configuration.includeBasicLands') }}
                  </label>
                </div>

                <div class="column col-12">
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="include-cards"
                      v-model="config.includeCards"
                    >
                    <i class="form-icon" /> {{ $t('configuration.includeCards') }}
                  </label>
                </div>

                <div class="column col-12">
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="include-game-pieces"
                      v-model="config.includeGamePieces"
                    >
                    <i class="form-icon" /> {{ $t('configuration.includeGamePieces') }}
                  </label>
                </div>

                <div class="column col-12">
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="show-cut-lines"
                      v-model="config.showCutLines"
                    >
                    <i class="form-icon" /> {{ $t('configuration.showCutLines') }}
                  </label>
                </div>
                <div class="column col-12">
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="fixed-page-size"
                      v-model="config.fixedPageSize"
                    >
                    <i class="form-icon" /> Fixed page size (3×3)
                  </label>
                </div>
              </div>
              <div class="column col-12 divider" />
              <div class="columns">
                <div class="column col-12 btn-group btn-group-block">
                  <button
                    id="toggle-combo-piece-config"
                    class="btn"
                    @click="config.comboPieceConfigOpen = !config.comboPieceConfigOpen"
                  >
                    {{ config.comboPieceConfigOpen ? 'Hide' : 'Show' }} Combo Pieces
                  </button>
                  <button
                    id="generate-combo-pieces"
                    class="btn btn-primary"
                    @click="generateRelatedComboPieces"
                  >
                    Generate
                  </button>
                </div>
                <div
                  v-if="config.comboPieceConfigOpen"
                  id="combo-piece-config"
                  class="column col-12"
                >
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="combo-piece-token"
                      v-model="config.comboPieceTypes.token"
                    >
                    <i class="form-icon" /> Tokens
                  </label>
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="combo-piece-emblem"
                      v-model="config.comboPieceTypes.emblem"
                    >
                    <i class="form-icon" /> Emblems
                  </label>
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="combo-piece-tracker"
                      v-model="config.comboPieceTypes.tracker"
                    >
                    <i class="form-icon" /> Trackers
                  </label>
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="combo-piece-mechanic-helper"
                      v-model="config.comboPieceTypes.mechanicHelper"
                    >
                    <i class="form-icon" /> Mechanic helpers
                  </label>
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="combo-piece-dungeon"
                      v-model="config.comboPieceTypes.dungeon"
                    >
                    <i class="form-icon" /> Dungeons
                  </label>
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="combo-piece-initiative"
                      v-model="config.comboPieceTypes.initiative"
                    >
                    <i class="form-icon" /> Initiative
                  </label>
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="combo-piece-ring"
                      v-model="config.comboPieceTypes.ring"
                    >
                    <i class="form-icon" /> Ring
                  </label>
                  <label class="form-switch">
                    <input
                      type="checkbox"
                      name="combo-piece-real-card"
                      v-model="config.comboPieceTypes.realCard"
                    >
                    <i class="form-icon" /> Real cards
                  </label>
                </div>
              </div>
              <div class="column col-12 divider" />
              <div class="columns">
                <div class="column col-12">
                  <label class="form-label">
                    <span
                      class="tooltip tooltip-right"
                      :data-tooltip="$t('configuration.imageType.tooltip')"
                    ><i class="form-icon" /> {{ $t('configuration.imageType.label') }}
                      <span class="icon-info" /></span>
                    <select
                      class="form-select select"
                      name="image-type"
                      v-model="config.imageType"
                      style="width: 100%"
                    >
                      <option value="normal">{{ $t('configuration.imageType.normal') }}</option>
                      <option value="border_crop">{{ $t('configuration.imageType.borderCrop') }}</option>
                    </select>
                  </label>
                </div>

                <div class="column col-12">
                  <label class="form-label">
                    <span
                      class="tooltip tooltip-right"
                      :data-tooltip="$t('configuration.printScale.tooltip')"
                    ><i class="form-icon" /> {{ $t('configuration.printScale.label') }}
                      <span class="icon-info" /></span>
                    <select
                      class="form-select select"
                      name="scale"
                      v-model="config.scale"
                      style="width: 100%"
                    >
                      <option value="small">{{ $t('configuration.printScale.small') }} (-2%)</option>
                      <option value="normal">{{ $t('configuration.printScale.regular') }} (60mm x 85mm)</option>
                      <option value="large">{{ $t('configuration.printScale.large') }} (+2%)</option>
                      <option value="actual">{{ $t('configuration.printScale.actual') }} (63mm x 88mm)</option>
                    </select>
                  </label>
                </div>

                <div class="column col-12">
                  <label class="form-label">
                    <i class="form-icon" /> {{ $t('configuration.cardBacks.label') }}
                    <select
                      class="form-select select"
                      name="card-backs"
                      v-model="config.cardBacks"
                      style="width: 100%"
                    >
                      <option value="none">{{ $t('configuration.cardBacks.none') }}</option>
                      <option value="dfc">{{ $t('configuration.cardBacks.dfcs') }}</option>
                      <option value="all">{{ $t('configuration.cardBacks.all') }}</option>
                      <option value="all-pages">{{ $t('configuration.cardBacks.allPages') }}</option>
                      <option value="token-pairs">{{ $t('configuration.cardBacks.tokenPairs') }}</option>
                    </select>
                  </label>
                  <div v-if="config.cardBacks === 'all-pages'" style="margin-top: 0.5rem">
                    <label class="form-label">
                      <i class="form-icon" /> Token backs: 
                      <select class="form-select select" v-model="config.tokenBackMode" style="width: 100%">
                        <option value="card">Use regular card back</option>
                        <option value="opposite">Use token face on opposite side</option>
                      </select>
                    </label>
                  </div>
                  <div v-if="config.cardBacks === 'all-pages' && config.tokenBackMode === 'opposite'" style="margin-top: 0.5rem">
                    <label class="form-switch">
                      <input
                        type="checkbox"
                        name="automatic-token-placement"
                        :checked="config.tokenPlacementMode === 'auto'"
                        @change="config.tokenPlacementMode = $event.target.checked ? 'auto' : 'chosen'"
                      >
                      <i class="form-icon" /> Automatic token placement
                    </label>
                  </div>
                  <div v-if="config.cardBacks === 'all-pages' && !config.fixedPageSize" style="margin-top:0.5rem">
                    <label class="form-label">
                      <i class="form-icon" /> Cards per page (leave empty to group all fronts/backs):
                      <input type="number" min="1" max="36" class="form-input" v-model.number="config.cardsPerPage" style="width:100%">
                    </label>
                  </div>
                </div>
              </div>
              <div class="column col-12 divider" />
              <div class="columns">
                <div class="column col-12">
                  <button
                    class="btn p-centered"
                    @click="$refs.helpModal.show()"
                  >
                    {{ $t('configuration.help.label') }}
                  </button>
                </div>
              </div>
              <div class="column col-12 divider" />
            </div>
          </div>
        </div>
      </aside>

      <main class="app-main">
        <div
          class="empty"
          v-show="cards.length === 0 && errors.length === 0"
        >
          <div class="empty-icon">
            <i class="icon icon-3x icon-search" />
          </div>
          <p class="empty-title h5" style="max-width: 25rem">
            "I welcome and seek your ideas, but do not bring me
            small ideas; bring me big ideas to match our future."
          </p>
          <p class="empty-subtitle">
            - Arnold Schwarzenegger
          </p>
        </div>

        <div
          id="input-errors"
          class="toast toast-error"
          v-show="errors.length > 0"
        >
          <button
            class="btn btn-clear float-right"
            alt="Dismiss Errors"
            @click="errors = []"
          />
          <div>{{ $t('errors.unableToIdentifyCards') }}</div>
          <ul>
            <li v-for="(error, index) in errors" :key="index">
              {{ error }}
            </li>
          </ul>
        </div>

        <div v-if="cards.length" id="workspace-tabs" class="workspace-tabs">
          <button
            id="workspace-tab-cards"
            type="button"
            class="btn"
            :class="{ active: config.activeWorkspaceTab === 'cards' }"
            @click="config.activeWorkspaceTab = 'cards'"
          >
            Cards
          </button>
          <button
            id="workspace-tab-simulation"
            type="button"
            class="btn"
            :class="{ active: config.activeWorkspaceTab === 'simulation' }"
            @click="config.activeWorkspaceTab = 'simulation'"
          >
            Simulation
          </button>
        </div>

        <div
          v-if="config.activeWorkspaceTab === 'simulation'"
          id="game-simulation-tab"
          class="game-simulation"
        >
          <div class="simulation-toolbar">
            <label class="form-label simulation-control">
              Matchup
              <select
                id="simulation-matchup"
                class="form-select select"
                v-model="effectiveSimulationMatchupSessionId"
                :disabled="simulationMetaDeckStates.length === 0"
              >
                <option
                  v-if="simulationMetaDeckStates.length === 0"
                  value=""
                >
                  No meta deck
                </option>
                <option
                  v-for="session in simulationMetaDeckStates"
                  :key="session.id"
                  :value="session.id"
                >
                  {{ session.name }}
                </option>
              </select>
            </label>
            <label class="form-label simulation-control simulation-control-compact">
              Seed
              <input
                id="simulation-seed"
                class="form-input"
                type="number"
                min="1"
                v-model.number="config.simulationSeed"
              >
            </label>
            <label class="form-label simulation-control simulation-control-compact">
              Turns
              <select
                id="simulation-turn-count"
                class="form-select select"
                v-model.number="config.simulationTurnCount"
              >
                <option :value="1">1</option>
                <option :value="2">2</option>
                <option :value="3">3</option>
                <option :value="4">4</option>
                <option :value="5">5</option>
              </select>
            </label>
            <label class="form-label simulation-control simulation-control-compact">
              Players
              <select
                id="simulation-player-count"
                class="form-select select"
                v-model.number="config.simulationPlayerCount"
              >
                <option :value="2">2</option>
                <option :value="3">3</option>
                <option :value="4">4</option>
                <option :value="5">5</option>
                <option :value="6">6</option>
              </select>
            </label>
            <label class="form-label simulation-control simulation-control-compact">
              Speed
              <select
                id="simulation-speed"
                class="form-select select"
                v-model="config.simulationSpeed"
              >
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </label>
            <label class="form-label simulation-control simulation-control-compact">
              Zoom
              <input
                id="simulation-board-zoom"
                class="form-input"
                type="range"
                min="0.6"
                max="1.4"
                step="0.1"
                v-model.number="config.simulationBoardZoom"
              >
            </label>
            <label class="form-switch simulation-switch">
              <input
                id="simulation-show-opponent-hands"
                type="checkbox"
                v-model="config.simulationShowOpponentHands"
              >
              <i class="form-icon" /> Opponent hands
            </label>
            <button
              id="simulation-reroll"
              type="button"
              class="btn btn-primary simulation-reroll"
              :disabled="cards.length === 0 || simulationMetaDeckStates.length === 0"
              @click="rerollSimulation"
            >
              Simulate
            </button>
            <div class="simulation-player-settings">
              <label
                v-for="index in simulationPlayerSlots"
                :key="`simulation-player-role-${index}`"
                class="form-label simulation-player-role-label"
              >
                P{{ index + 1 }}
                <select
                  class="form-select select simulation-player-role"
                  v-model="config.simulationPlayerRoles[index]"
                >
                  <option value="human">Human</option>
                  <option value="ai">AI</option>
                </select>
              </label>
            </div>
          </div>

          <div
            v-if="activeSimulationStep"
            class="simulation-phase-bar"
          >
            <div
              id="simulation-current-step"
              class="simulation-current-step"
            >
              T{{ activeSimulationStep.turn }}
              {{ activeSimulationStep.playerName }} /
              {{ phaseLabel(activeSimulationStep.phase) }}
            </div>
            <div class="simulation-current-actions">
              Mana {{ activeSimulationStep.actionContext.availableMana }}
              <span v-if="simulationManaPoolText(activeSimulationPlayer?.zones?.manaPool)">
                / pool {{ simulationManaPoolText(activeSimulationPlayer.zones.manaPool) }}
              </span>
              <span v-if="activeSimulationStep.actionContext.canPlayLand">
                / land available
              </span>
            </div>
            <button
              id="simulation-next-step"
              type="button"
              class="btn simulation-next-step"
              :disabled="isLastSimulationStep"
              @click="advanceSimulationStep"
            >
              Next step
            </button>
          </div>

          <div
            v-if="simulationPendingAction"
            class="simulation-targeting-banner"
          >
            Choose target for {{ simulationDisplayCardName(simulationPendingAction.card) }}
          </div>

          <div
            v-if="!selectedSimulationMetaDeck"
            class="empty simulation-empty"
          >
            <p class="empty-title h5">
              Tag a local session as a meta deck to run a matchup simulation.
            </p>
          </div>

          <div v-else-if="gameSimulation" class="simulation-board">
            <div class="simulation-board-viewport">
              <div
                class="simulation-board-area"
                :class="{ 'simulation-board-area-two-player': simulationPlayerLanes.length === 1 }"
                :style="simulationBoardStyle()"
              >
                <div
                  v-for="lane in simulationPlayerLanes"
                  :key="`simulation-lane-${lane.index}`"
                  class="simulation-player-lane"
                >
                  <section
                    v-for="seat in simulationLaneSeats(lane)"
                    :key="`simulation-player-${seat.player.key}`"
                    class="simulation-player-board"
                    :class="[
                      `simulation-player-seat-${seat.position}`,
                      `simulation-player-board-${seat.position}`,
                    ]"
                  >
                    <div class="simulation-player-header">
                      <span>{{ seat.player.name }}</span>
                      <button
                        type="button"
                        class="simulation-life-total"
                        :class="{ 'simulation-life-total-targetable': isSimulationPlayerTargetable(seat.player) }"
                        @click.stop="selectSimulationPlayerTarget(seat.player)"
                      >
                        {{ simulationPlayerLife(seat.player) }}
                      </button>
                      <span class="label">{{ seat.player.role }}</span>
                    </div>
                    <div class="simulation-hand-and-stacks">
                      <div
                        class="simulation-hand-zone"
                        :aria-label="`${seat.player.name} hand`"
                      >
                        <div class="simulation-hand-card-row">
                          <div
                            v-for="card in visibleSimulationHandCards(seat.player)"
                            :key="`simulation-hand-${seat.player.key}-${card.id ?? card.name}-${card.sourceZone ?? 'hand'}`"
                            class="simulation-hand-card"
                            :class="simulationCardClasses(card)"
                            :title="simulationCardActionTitle(card)"
                            @dblclick.stop="handleSimulationCardDoubleClick(card, seat.player)"
                          >
                            <ImageLoader
                              class="simulation-hand-card-image"
                              :src="simulationCardImage(card)"
                              placeholder="./card_back_border_crop.jpg"
                              :alt="card.name"
                              @mouseenter="scheduleCardPreview(card)"
                              @mouseleave="hideCardPreview"
                            />
                            <span class="simulation-card-count">{{ card.quantity }}x</span>
                            <span v-if="card.sourceZone" class="simulation-source-zone">{{ simulationSourceZoneLabel(card.sourceZone) }}</span>
                          </div>
                        </div>
                      </div>
                      <div
                        class="simulation-zone-stacks"
                        :class="`simulation-zone-stacks-${seat.position}`"
                      >
                        <button
                          type="button"
                          class="simulation-zone-stack simulation-zone-stack-library"
                          :aria-label="`${seat.player.name} library`"
                        >
                          <ImageLoader
                            class="simulation-zone-image"
                            src="./card_back_border_crop.jpg"
                            placeholder="./card_back_border_crop.jpg"
                            alt="Library"
                          />
                          <span class="simulation-zone-count">{{ seat.player.zones.libraryCount }}</span>
                        </button>
                        <button
                          type="button"
                          class="simulation-zone-stack simulation-zone-stack-graveyard"
                          :class="{ 'simulation-zone-stack-empty': seat.player.zones.graveyard.count === 0 }"
                          :aria-label="`${seat.player.name} graveyard`"
                          @click="toggleSimulationZone(seat.player, 'graveyard')"
                        >
                          <ImageLoader
                            v-if="seat.player.zones.graveyard.top"
                            class="simulation-zone-image"
                            :src="simulationCardImage(seat.player.zones.graveyard.top)"
                            placeholder="./card_back_border_crop.jpg"
                            alt="Graveyard"
                            @mouseenter="scheduleCardPreview(seat.player.zones.graveyard.top)"
                            @mouseleave="hideCardPreview"
                          />
                          <div
                            v-else
                            class="simulation-zone-empty-card"
                            aria-label="Empty graveyard"
                          />
                          <span class="simulation-zone-count">{{ seat.player.zones.graveyard.count }}</span>
                        </button>
                        <button
                          type="button"
                          class="simulation-zone-stack simulation-zone-stack-exile"
                          :class="{ 'simulation-zone-stack-empty': seat.player.zones.exile.count === 0 }"
                          :aria-label="`${seat.player.name} exile`"
                          @click="toggleSimulationZone(seat.player, 'exile')"
                        >
                          <ImageLoader
                            v-if="seat.player.zones.exile.top"
                            class="simulation-zone-image simulation-zone-image-exile"
                            :src="simulationCardImage(seat.player.zones.exile.top)"
                            placeholder="./card_back_border_crop.jpg"
                            alt="Exile"
                            @mouseenter="scheduleCardPreview(seat.player.zones.exile.top)"
                            @mouseleave="hideCardPreview"
                          />
                          <div
                            v-else
                            class="simulation-zone-empty-card"
                            aria-label="Empty exile"
                          />
                          <span class="simulation-zone-count">{{ seat.player.zones.exile.count }}</span>
                        </button>
                      </div>
                    </div>
                    <div
                      v-if="isSimulationZoneExpanded(seat.player, 'graveyard') || isSimulationZoneExpanded(seat.player, 'exile')"
                      class="simulation-zone-drawer"
                    >
                      <div
                        v-for="zone in ['graveyard', 'exile']"
                        :key="`simulation-zone-drawer-${seat.player.key}-${zone}`"
                        v-show="isSimulationZoneExpanded(seat.player, zone)"
                        :aria-label="`${seat.player.name} ${zone}`"
                      >
                        <div v-if="seat.player.zones[zone].cards.length" class="simulation-mini-card-grid">
                          <div
                            v-for="card in seat.player.zones[zone].cards"
                            :key="`simulation-zone-card-${seat.player.key}-${zone}-${card.name}`"
                            class="simulation-mini-card"
                            :class="simulationCardClasses(card)"
                            :title="simulationCardActionTitle(card)"
                            @dblclick.stop="handleSimulationCardDoubleClick(card, seat.player)"
                          >
                            <ImageLoader
                              class="simulation-mini-card-image"
                              :src="simulationCardImage(card)"
                              placeholder="./card_back_border_crop.jpg"
                              :alt="card.name"
                              @mouseenter="scheduleCardPreview(card)"
                              @mouseleave="hideCardPreview"
                            />
                            <span>{{ card.quantity }}x {{ card.name }}</span>
                          </div>
                        </div>
                        <div v-else class="simulation-zone-empty">
                          Empty
                        </div>
                      </div>
                    </div>
                    <div
                      class="simulation-battlefield-zone"
                      :aria-label="`${seat.player.name} battlefield`"
                    >
                      <div
                        class="simulation-battlefield-row simulation-battlefield-lands simulation-battlefield-column-left"
                        :aria-label="`${seat.player.name} lands`"
                      >
                        <div class="simulation-permanent-row">
                          <div
                            v-for="card in seat.player.zones.battlefield.lands"
                            :key="`simulation-land-${seat.player.key}-${card.name}`"
                            class="simulation-permanent-card simulation-permanent-card-land"
                            :class="simulationCardClasses(card, isSimulationCardTargetable(card))"
                            :title="simulationCardActionTitle(card)"
                            @click.stop="selectSimulationCardTarget(card, seat.player)"
                            @dblclick.stop="handleSimulationCardDoubleClick(card, seat.player)"
                          >
                            <ImageLoader
                              class="simulation-permanent-image"
                              :src="simulationCardImage(card)"
                              placeholder="./card_back_border_crop.jpg"
                              :alt="card.name"
                              @mouseenter="scheduleCardPreview(card)"
                              @mouseleave="hideCardPreview"
                            />
                            <span class="simulation-card-count">{{ card.quantity }}x</span>
                          </div>
                        </div>
                      </div>
                      <div
                        class="simulation-battlefield-row simulation-battlefield-creatures simulation-battlefield-column-center"
                        :aria-label="`${seat.player.name} creatures`"
                      >
                        <div class="simulation-permanent-row">
                          <div
                            v-for="card in seat.player.zones.battlefield.creatures"
                            :key="`simulation-creature-${seat.player.key}-${card.name}`"
                            class="simulation-permanent-card"
                            :class="simulationCardClasses(card, isSimulationCardTargetable(card))"
                            :title="simulationCardActionTitle(card)"
                            @click.stop="selectSimulationCardTarget(card, seat.player)"
                            @dblclick.stop="handleSimulationCardDoubleClick(card, seat.player)"
                          >
                            <ImageLoader
                              class="simulation-permanent-image"
                              :src="simulationCardImage(card)"
                              placeholder="./card_back_border_crop.jpg"
                              :alt="card.name"
                              @mouseenter="scheduleCardPreview(card)"
                              @mouseleave="hideCardPreview"
                            />
                            <span class="simulation-card-count">{{ card.quantity }}x</span>
                            <span v-if="card.state?.summoningSick" class="simulation-state-badge">SS</span>
                            <span v-else-if="card.state?.attacking" class="simulation-state-badge simulation-state-badge-attack">ATK</span>
                          </div>
                        </div>
                      </div>
                      <div
                        class="simulation-battlefield-row simulation-battlefield-noncreatures simulation-battlefield-column-right"
                        :aria-label="`${seat.player.name} noncreature permanents`"
                      >
                        <div class="simulation-permanent-row">
                          <div
                            v-for="card in seat.player.zones.battlefield.nonCreaturePermanents"
                            :key="`simulation-noncreature-${seat.player.key}-${card.name}`"
                            class="simulation-permanent-card simulation-permanent-card-noncreature"
                            :class="simulationCardClasses(card, isSimulationCardTargetable(card))"
                            :title="simulationCardActionTitle(card)"
                            @click.stop="selectSimulationCardTarget(card, seat.player)"
                            @dblclick.stop="handleSimulationCardDoubleClick(card, seat.player)"
                          >
                            <ImageLoader
                              class="simulation-permanent-image"
                              :src="simulationCardImage(card)"
                              placeholder="./card_back_border_crop.jpg"
                              :alt="card.name"
                              @mouseenter="scheduleCardPreview(card)"
                              @mouseleave="hideCardPreview"
                            />
                            <span class="simulation-card-count">{{ card.quantity }}x</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            <div class="simulation-log-panel">
              <div class="simulation-section-title">
                Logs
              </div>
              <div class="simulation-timeline">
                <div
                  v-for="(step, stepIndex) in gameSimulation.timeline"
                  :key="`simulation-step-${stepIndex}`"
                  class="simulation-step"
                  :class="`simulation-step-${step.playerKey}`"
                >
                  <div class="simulation-step-header">
                    T{{ step.turn }} {{ step.playerName }} / {{ phaseLabel(step.phase) }}
                  </div>
                  <div v-if="step.drawnCard" class="simulation-step-line">
                    Draw: {{ step.drawnCard.name }}
                  </div>
                  <div v-if="step.landOptions?.length" class="simulation-step-line">
                    Land: {{ formatSimulationOptions(step.landOptions) }}
                  </div>
                  <div v-if="step.phase === 'main'" class="simulation-step-line">
                    Land plays {{ step.landPlaysAvailable }} /
                    mana {{ step.availableMana }} now, {{ step.manaAfterLandPlay }} after land
                  </div>
                  <div v-if="step.castOptions?.length" class="simulation-step-line">
                    Cast: {{ formatSimulationOptions(step.castOptions) }}
                  </div>
                  <div v-if="step.holdUpOptions?.length" class="simulation-step-line">
                    Hold: {{ formatSimulationOptions(step.holdUpOptions) }}
                  </div>
                  <div v-if="step.playedLand" class="simulation-step-line">
                    Played: {{ step.playedLand.name }}
                  </div>
                  <div v-if="step.castCards?.length" class="simulation-step-line">
                    Resolved: {{ formatSimulationCastActions(step.castCards) }}
                  </div>
                  <div v-if="step.note" class="simulation-step-note">
                    {{ step.note }}
                  </div>
                </div>
              </div>
            </div>

            <div class="simulation-history">
              <div class="simulation-section-title">
                History
              </div>
              <div
                v-if="simulationHistory.length === 0"
                class="simulation-zone-empty"
              >
                No saved games yet.
              </div>
              <div
                v-for="entry in simulationHistory"
                :key="entry.id"
                class="simulation-history-entry"
              >
                Seed {{ entry.seed }} / {{ entry.matchupName }} / {{ entry.playerCount }} players
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="config.analysisMode" id="analysis-card-list" class="analysis-card-list">
          <div
            v-if="analysisColumns.length === 0"
            class="empty"
          >
            <p class="empty-title h5">
              Tag a local session as a meta deck to show matchup analysis.
            </p>
          </div>
          <div
            v-for="(card, cardIndex) in cards"
            :key="`analysis-${cardIndex}`"
            class="analysis-card-row"
            v-show="shouldShowCard(card)"
          >
            <div class="analysis-card-preview">
              <ImageLoader
                class="analysis-card-image"
                :src="resolveCardImage(card)"
                placeholder="./card_back_border_crop.jpg"
                :alt="card.name"
                @mouseenter="scheduleCardPreview(card)"
                @mouseleave="hideCardPreview"
              />
              <div class="analysis-card-details">
                <div class="analysis-card-name">
                  {{ card.quantity }}x {{ card.name }}
                  <span v-if="card.isSideboard" class="label label-secondary">Sideboard</span>
                  <span
                    v-if="isCardLoading(card)"
                    class="analysis-card-stat-loader"
                    title="Loading analysis stats"
                    aria-label="Loading analysis stats"
                  >
                    <LoadingSpinner
                      size="sm"
                      label="Loading card analysis"
                    />
                  </span>
                </div>
                <div class="text-small text-gray">
                  {{ card.selectedOption?.manaCost || 'No mana cost' }}
                  <span v-if="card.selectedOption?.typeLine">/ {{ card.selectedOption.typeLine }}</span>
                </div>
                <select
                  class="form-select select-sm mt-2"
                  name="selected-option"
                  v-model="card.selectedOption"
                  @change="
                    updateSessionSet(
                      card.name,
                      card.selectedOption,
                      cardIndex,
                    )
                  "
                >
                  <option
                    v-for="(set, setIndex) in card.setOptions"
                    :value="set"
                    :key="setIndex"
                    v-show="shouldShowSetOption(card, set)"
                  >
                    {{ set.name }}
                  </option>
                </select>
              </div>
            </div>
            <div v-if="config.analysisView === 'value'" class="value-view">
              <div
                v-if="isCardAnalysisLoading(card) && valueAnalysisForCard(card).castOptions.length === 0"
                class="value-analysis-loading"
              >
                <LoadingSpinner
                  size="sm"
                  label="Loading card value"
                />
              </div>
              <div
                v-for="(option, optionIndex) in valueAnalysisForCard(card).castOptions"
                :key="`value-${cardIndex}-${optionIndex}`"
                class="value-cast"
              >
                <div class="value-line">
                  <div class="value-line-header">
                    {{ option.label }} / {{ option.speed }}
                  </div>
                  <div class="value-rows value-rows-base">
                    <div
                      v-for="(row, rowIndex) in option.baseRows"
                      :key="`base-row-${rowIndex}`"
                      class="value-row value-row-base"
                    >
                      <div class="value-row-cell value-row-condition">
                        {{ row.condition }}
                      </div>
                      <div class="value-row-cell value-row-cost">
                        <i
                          v-if="row.speed === 'Instant' || row.speed === 'Flash'"
                          class="ms value-speed"
                          :class="speedSymbolClass(row.speed)"
                          :title="row.speed"
                        />
                        <i
                          v-for="(symbol, symbolIndex) in row.costSymbols"
                          :key="`base-cost-${rowIndex}-${symbolIndex}`"
                          class="ms ms-cost mana-symbol"
                          :class="manaSymbolClass(symbol)"
                          :title="symbol"
                        />
                      </div>
                      <div class="value-row-cell value-row-effect">
                        {{ row.effect || '-' }}
                      </div>
                      <div class="value-row-cell value-row-state">
                        {{ row.value || '-' }}
                      </div>
                    </div>
                  </div>
                  <div v-if="option.bonuses.length" class="value-rows value-rows-bonus">
                    <div
                      v-for="(bonus, bonusIndex) in option.bonuses"
                      :key="`bonus-${bonusIndex}`"
                      class="value-row value-row-bonus"
                    >
                      <div class="value-row-cell value-row-condition">
                        {{ bonus.condition }}
                      </div>
                      <div class="value-row-cell value-row-cost">
                        <i
                          v-if="bonus.speed === 'Instant' || bonus.speed === 'Flash'"
                          class="ms value-speed"
                          :class="speedSymbolClass(bonus.speed)"
                          :title="bonus.speed"
                        />
                        <i
                          v-for="(symbol, symbolIndex) in bonus.costSymbols"
                          :key="`bonus-cost-${bonusIndex}-${symbolIndex}`"
                          class="ms ms-cost mana-symbol"
                          :class="manaSymbolClass(symbol)"
                          :title="symbol"
                        />
                      </div>
                      <div class="value-row-cell value-row-effect">
                        {{ bonus.effect || bonus.detail }}
                      </div>
                      <div class="value-row-cell value-row-state">
                        {{ bonus.value || '-' }}
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="option.metaRemovalOptions?.length"
                    class="value-meta-removal-options"
                  >
                    <div
                      v-for="(metaRemoval, metaRemovalIndex) in option.metaRemovalOptions"
                      :key="`meta-removal-${cardIndex}-${optionIndex}-${metaRemoval.deckId}`"
                      class="value-meta-removal"
                    >
                      <button
                        type="button"
                        class="btn btn-link value-meta-removal-toggle"
                        @click="toggleValueRemovalDeck(card, optionIndex, metaRemoval.deckId)"
                      >
                        <span class="value-meta-removal-deck">{{ metaRemoval.deckName }}</span>
                        <span>Removed {{ metaRemoval.removedPercent }}</span>
                        <span>Damage {{ metaRemoval.damagePercent }}</span>
                      </button>
                      <div
                        v-if="isValueRemovalDeckExpanded(card, optionIndex, metaRemoval.deckId)"
                        class="value-meta-removal-targets"
                      >
                        <div
                          v-for="(target, targetIndex) in metaRemoval.targets"
                          :key="`meta-removal-target-${cardIndex}-${optionIndex}-${metaRemovalIndex}-${targetIndex}`"
                          class="value-meta-removal-target"
                        >
                          <div class="value-meta-removal-target-name">
                            {{ target.quantity }}x {{ target.name }}
                          </div>
                          <div class="value-meta-removal-target-detail">
                            {{ target.outcome }} / {{ target.detail }}
                          </div>
                          <div
                            v-if="target.protection"
                            class="value-meta-removal-protection"
                          >
                            Protect: {{ target.protection }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-if="option.etbOptions.length" class="value-rows value-rows-etb">
                    <div
                      v-for="(etb, etbIndex) in option.etbOptions"
                      :key="`etb-${etbIndex}`"
                      class="value-row value-row-etb"
                    >
                      <div class="value-row-cell value-row-condition">
                        <div>{{ etb.condition }}</div>
                        <div class="value-row-source">
                          {{ etb.sourceLine }}
                        </div>
                      </div>
                      <div class="value-row-cell value-row-cost">
                        <i
                          v-if="etb.speed === 'Instant' || etb.speed === 'Flash'"
                          class="ms value-speed"
                          :class="speedSymbolClass(etb.speed)"
                          :title="etb.speed"
                        />
                        <i
                          v-for="(symbol, symbolIndex) in etb.costSymbols"
                          :key="`etb-cost-${etbIndex}-${symbolIndex}`"
                          class="ms ms-cost mana-symbol"
                          :class="manaSymbolClass(symbol)"
                          :title="symbol"
                        />
                      </div>
                      <div class="value-row-cell value-row-effect">
                        {{ etb.effect }}
                      </div>
                      <div class="value-row-cell value-row-state">
                        {{ etb.value || '-' }}
                      </div>
                    </div>
                  </div>
                  <div v-if="option.permanentOptions.length" class="value-rows value-rows-permanent">
                    <div
                      v-for="(permanent, permanentIndex) in option.permanentOptions"
                      :key="`permanent-${permanentIndex}`"
                      class="value-row value-row-permanent"
                    >
                      <div class="value-row-cell value-row-condition">
                        <div>{{ permanent.condition }}</div>
                        <div class="value-row-source">
                          {{ permanent.sourceLine }}
                        </div>
                      </div>
                      <div class="value-row-cell value-row-cost">
                        <i
                          v-if="permanent.speed === 'Instant' || permanent.speed === 'Flash'"
                          class="ms value-speed"
                          :class="speedSymbolClass(permanent.speed)"
                          :title="permanent.speed"
                        />
                        <i
                          v-for="(symbol, symbolIndex) in permanent.costSymbols"
                          :key="`permanent-cost-${permanentIndex}-${symbolIndex}`"
                          class="ms ms-cost mana-symbol"
                          :class="manaSymbolClass(symbol)"
                          :title="symbol"
                        />
                      </div>
                      <div class="value-row-cell value-row-effect">
                        {{ permanent.effect }}
                      </div>
                      <div class="value-row-cell value-row-state">
                        {{ permanent.value || '-' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="valueAnalysisForCard(card).deathOptions.length"
                class="value-death-options"
              >
                <div class="value-line-header">
                  Death triggers
                </div>
                <div class="value-rows value-rows-death">
                  <div
                    v-for="(death, deathIndex) in valueAnalysisForCard(card).deathOptions"
                    :key="`death-${cardIndex}-${deathIndex}`"
                    class="value-row value-row-death"
                  >
                    <div class="value-row-cell value-row-condition">
                      <div>{{ death.condition }}</div>
                      <div class="value-row-source">
                        {{ death.sourceLine }}
                      </div>
                    </div>
                    <div class="value-row-cell value-row-cost">
                      <i
                        v-if="death.speed === 'Instant' || death.speed === 'Flash'"
                        class="ms value-speed"
                        :class="speedSymbolClass(death.speed)"
                        :title="death.speed"
                      />
                      <i
                        v-for="(symbol, symbolIndex) in death.costSymbols"
                        :key="`death-cost-${cardIndex}-${deathIndex}-${symbolIndex}`"
                        class="ms ms-cost mana-symbol"
                        :class="manaSymbolClass(symbol)"
                        :title="symbol"
                      />
                    </div>
                    <div class="value-row-cell value-row-effect">
                      {{ death.effect }}
                    </div>
                    <div class="value-row-cell value-row-state">
                      {{ death.value || '-' }}
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="valueAnalysisForCard(card).creatureOptions.length"
                class="value-creature-options"
              >
                <div class="value-line-header">
                  Creature modifiers
                </div>
                <div class="value-rows value-rows-creature">
                  <div
                    v-for="(creatureOption, creatureOptionIndex) in valueAnalysisForCard(card).creatureOptions"
                    :key="`creature-option-${cardIndex}-${creatureOptionIndex}`"
                    class="value-row value-row-creature"
                  >
                    <div class="value-row-cell value-row-condition">
                      <div>{{ creatureOption.condition }}</div>
                      <div class="value-row-source">
                        {{ creatureOption.sourceLine }}
                      </div>
                    </div>
                    <div class="value-row-cell value-row-cost">
                      <i
                        v-if="creatureOption.speed === 'Instant' || creatureOption.speed === 'Flash'"
                        class="ms value-speed"
                        :class="speedSymbolClass(creatureOption.speed)"
                        :title="creatureOption.speed"
                      />
                      <i
                        v-for="(symbol, symbolIndex) in creatureOption.costSymbols"
                        :key="`creature-option-cost-${cardIndex}-${creatureOptionIndex}-${symbolIndex}`"
                        class="ms ms-cost mana-symbol"
                        :class="manaSymbolClass(symbol)"
                        :title="symbol"
                      />
                    </div>
                    <div class="value-row-cell value-row-effect">
                      {{ creatureOption.effect }}
                    </div>
                    <div class="value-row-cell value-row-state">
                      {{ creatureOption.value || '-' }}
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="valueAnalysisForCard(card).activatedOptions.length"
                class="value-activated-options"
              >
                <div class="value-line-header">
                  Activated abilities
                </div>
                <div class="value-rows value-rows-activated">
                  <div
                    v-for="(activated, activatedIndex) in valueAnalysisForCard(card).activatedOptions"
                    :key="`activated-${cardIndex}-${activatedIndex}`"
                    class="value-row value-row-activated"
                  >
                    <div class="value-row-cell value-row-condition">
                      {{ activated.condition }}
                    </div>
                    <div class="value-row-cell value-row-cost">
                      <i
                        v-for="(symbol, symbolIndex) in activated.costSymbols"
                        :key="`activated-cost-${cardIndex}-${activatedIndex}-${symbolIndex}`"
                        class="ms ms-cost mana-symbol"
                        :class="manaSymbolClass(symbol)"
                        :title="symbol"
                      />
                    </div>
                    <div class="value-row-cell value-row-effect">
                      {{ activated.effect || '-' }}
                    </div>
                    <div class="value-row-cell value-row-state">
                      {{ activated.value || '-' }}
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="valueAnalysisForCard(card).zoneOptions.length"
                class="value-zone-options"
              >
                <div class="value-line-header">
                  Zone movement
                </div>
                <div class="value-rows value-rows-zone">
                  <div
                    v-for="(zone, zoneIndex) in valueAnalysisForCard(card).zoneOptions"
                    :key="`zone-${cardIndex}-${zoneIndex}`"
                    class="value-row value-row-zone"
                  >
                    <div class="value-row-cell value-row-condition">
                      {{ zone.condition }}
                    </div>
                    <div class="value-row-cell value-row-cost">
                      <i
                        v-if="zone.speed === 'Instant' || zone.speed === 'Flash'"
                        class="ms value-speed"
                        :class="speedSymbolClass(zone.speed)"
                        :title="zone.speed"
                      />
                      <i
                        v-for="(symbol, symbolIndex) in zone.costSymbols"
                        :key="`zone-cost-${cardIndex}-${zoneIndex}-${symbolIndex}`"
                        class="ms ms-cost mana-symbol"
                        :class="manaSymbolClass(symbol)"
                        :title="symbol"
                      />
                    </div>
                    <div class="value-row-cell value-row-effect">
                      {{ zone.effect || zone.detail }}
                    </div>
                    <div class="value-row-cell value-row-state">
                      {{ zone.value || '-' }}
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="manaSummaryForCard(card).length || rowManaOptionsForCard(card).length"
                class="value-mana-options"
              >
                <div class="value-line-header">
                  Mana sources
                </div>
                <div class="value-mana-chip-list">
                  <div
                    v-for="(mana, manaIndex) in manaSummaryForCard(card)"
                    :key="`mana-summary-${cardIndex}-${manaIndex}`"
                    class="value-mana-chip"
                    :class="`value-mana-chip-${mana.kind}`"
                  >
                    <span class="value-mana-source">{{ mana.condition }}</span>
                    <span class="value-mana-quantity">x{{ mana.quantity }}</span>
                    <span class="value-mana-arrow">-></span>
                    <span class="value-mana-symbol-groups">
                      <template
                        v-for="(group, groupIndex) in manaSymbolGroups(mana)"
                        :key="`mana-summary-group-${cardIndex}-${manaIndex}-${groupIndex}`"
                      >
                        <span
                          v-if="groupIndex > 0"
                          class="value-mana-choice-separator"
                        >/</span>
                        <i
                          v-for="(symbol, symbolIndex) in group"
                          :key="`mana-summary-symbol-${cardIndex}-${manaIndex}-${groupIndex}-${symbolIndex}`"
                          class="ms ms-cost mana-symbol"
                          :class="manaSymbolClass(symbol)"
                          :title="symbol"
                        />
                      </template>
                    </span>
                  </div>
                </div>
                <div v-if="rowManaOptionsForCard(card).length" class="value-rows value-rows-mana">
                  <div
                    v-for="(mana, manaIndex) in rowManaOptionsForCard(card)"
                    :key="`mana-row-${cardIndex}-${manaIndex}`"
                    class="value-row value-row-mana"
                  >
                    <div class="value-row-cell value-row-condition">
                      <div>{{ mana.condition }}</div>
                      <div class="value-row-source">
                        {{ mana.sourceLine }}
                      </div>
                    </div>
                    <div class="value-row-cell value-row-cost">
                      <i
                        v-if="mana.speed === 'Instant' || mana.speed === 'Flash'"
                        class="ms value-speed"
                        :class="speedSymbolClass(mana.speed)"
                        :title="mana.speed"
                      />
                      <i
                        v-for="(symbol, symbolIndex) in mana.costSymbols"
                        :key="`mana-row-cost-${cardIndex}-${manaIndex}-${symbolIndex}`"
                        class="ms ms-cost mana-symbol"
                        :class="manaSymbolClass(symbol)"
                        :title="symbol"
                      />
                    </div>
                    <div class="value-row-cell value-row-effect">
                      <span class="value-mana-effect-label">Add</span>
                      <span class="value-mana-symbol-groups">
                        <template
                          v-for="(group, groupIndex) in manaSymbolGroups(mana)"
                          :key="`mana-row-group-${cardIndex}-${manaIndex}-${groupIndex}`"
                        >
                          <span
                            v-if="groupIndex > 0"
                            class="value-mana-choice-separator"
                          >/</span>
                          <i
                            v-for="(symbol, symbolIndex) in group"
                            :key="`mana-row-symbol-${cardIndex}-${manaIndex}-${groupIndex}-${symbolIndex}`"
                            class="ms ms-cost mana-symbol"
                            :class="manaSymbolClass(symbol)"
                            :title="symbol"
                          />
                        </template>
                      </span>
                      <span
                        v-if="mana.restriction"
                        class="value-mana-restriction"
                      >
                        {{ mana.restriction }}
                      </span>
                    </div>
                    <div class="value-row-cell value-row-state">
                      {{ mana.value || '-' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="analysis-grid-wrap">
              <table class="table table-striped analysis-grid">
                <thead>
                  <tr>
                    <th>Interaction</th>
                    <th
                      v-for="column in analysisColumns"
                      :key="column.key"
                      :class="{ 'analysis-column-collapsed': column.collapsed }"
                    >
                      <button
                        v-if="column.type === 'metaDeck'"
                        type="button"
                        class="btn btn-link analysis-column-toggle"
                        @click="toggleAnalysisDeckCollapse(column.key)"
                      >
                        <span class="analysis-column-title">{{ column.label }}</span>
                        <span
                          v-if="!column.collapsed"
                          class="analysis-column-summary"
                        >
                          K {{ analysisColumnHeader(card, column).killPercent }} /
                          I {{ analysisColumnHeader(card, column).interactionPercent }}
                        </span>
                        <span
                          v-else
                          class="analysis-column-summary"
                        >
                          Collapsed
                        </span>
                      </button>
                      <span v-else>{{ column.label }}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in analysisRowsForCard(card)"
                    :key="row.category.key"
                  >
                    <td>{{ row.category.label }}</td>
                    <td
                      v-for="{ column, cell } in row.cells"
                      :key="`${row.category.key}-${column.key}`"
                      :class="{ 'analysis-cell-active': cell.active && !column.collapsed, 'analysis-column-collapsed': column.collapsed }"
                      :title="cell.title"
                    >
                      {{ column.collapsed ? '' : cell.display }}
                    </td>
                  </tr>
                  <tr v-if="isCardAnalysisLoading(card) && analysisRowsForCard(card).length === 0">
                    <td colspan="99" class="analysis-grid-loading-cell">
                      <LoadingSpinner
                        size="sm"
                        label="Loading card analysis"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-else class="cards columns">
          <div
            v-for="(card, cardIndex) in cards"
            :key="cardIndex"
            class="card-select column col-3 col-sm-6 mt-2"
            v-show="shouldShowCard(card)"
          >
            <div class="p-relative">
              <ImageLoader
                class="card-image img-responsive"
                :src="resolveCardImage(card)"
                placeholder="./card_back_border_crop.jpg"
                :alt="card.name"
                @mouseenter="scheduleCardPreview(card)"
                @mouseleave="hideCardPreview"
              />
              <span
                class="card-quantity bg-primary text-light docs-shape s-rounded centered"
              >{{ card.quantity }}x</span>
              <select
                class="form-select select-sm mt-2"
                name="selected-option"
                v-model="card.selectedOption"
                @change="
                  updateSessionSet(
                    card.name,
                    card.selectedOption,
                    cardIndex,
                  )
                "
              >
                <option
                  v-for="(set, setIndex) in card.setOptions"
                  :value="set"
                  :key="setIndex"
                  v-show="shouldShowSetOption(card, set)"
                >
                  {{ set.name }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <ArnoldsApproval id="arnold" :cards="cards" />
      </main>
    </div>

    <div
      v-if="printOrderModalOpen"
      id="print-order-modal"
      class="modal active"
    >
      <a
        class="modal-overlay"
        href="#close"
        aria-label="Close"
        @click.prevent="closePrintOrderModal"
      />
      <div class="modal-container print-order-modal-container">
        <div class="modal-header">
          <button
            class="btn btn-clear float-right"
            aria-label="Close"
            @click="closePrintOrderModal"
          />
          <div class="modal-title h5">
            Print Order
          </div>
        </div>
        <div class="modal-body">
          <div class="content">
            <div
              v-for="(page, pageIndex) in printOrderPreviewPages"
              :key="`print-order-page-${pageIndex}`"
              class="print-order-page"
            >
              <div class="text-small text-gray mb-2">
                Page
                {{ pageIndex + 1 }}
                <span v-if="page.isBack">(back)</span>
              </div>
              <div
                class="print-order-grid"
                :class="{ 'print-order-grid-backs': page.isBack }"
                :style="{ gridTemplateColumns: `repeat(${printOrderGridColumns}, minmax(0, 1fr))` }"
              >
                <button
                  v-for="slot in page.slots"
                  :key="slot.key"
                  type="button"
                  class="print-order-slot"
                  :class="{ 'print-order-slot-selected': selectedPrintOrderSlotIndex === slot.index }"
                  :disabled="!slot.card"
                  @click="selectPrintOrderSlot(slot.index)"
                >
                  <template v-if="slot.card">
                    <ImageLoader
                      class="print-order-image"
                      :src="resolveCardImage(slot.card, slot.face)"
                      placeholder="./card_back_border_crop.jpg"
                      :alt="slot.card.name"
                      @mouseenter="scheduleCardPreview(slot.card, slot.face)"
                      @mouseleave="hideCardPreview"
                    />
                    <span class="print-order-index">{{ slot.index + 1 }}</span>
                  </template>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            class="btn"
            @click="resetPrintOrder"
          >
            Reset
          </button>
          <button
            id="apply-print-order"
            class="btn btn-primary"
            @click="applyPrintOrder"
          >
            Done
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="cardPreview.visible"
      id="card-hover-preview"
      class="card-hover-preview"
      aria-live="polite"
    >
      <img
        class="card-hover-preview-image"
        :src="cardPreview.src"
        :alt="cardPreview.alt"
      >
    </div>

    <div
      v-if="simulationActionMenu"
      id="simulation-action-menu"
      class="simulation-action-menu"
    >
      <div class="simulation-action-menu-title">
        {{ simulationDisplayCardName(simulationActionMenu.card) }}
      </div>
      <button
        v-for="option in simulationActionMenu.options"
        :key="option.id"
        type="button"
        class="btn simulation-action-choice"
        @click="chooseSimulationAction(option)"
      >
        {{ option.label }}
      </button>
      <button
        type="button"
        class="btn btn-link simulation-action-close"
        @click="closeSimulationActionMenu"
      >
        Cancel
      </button>
    </div>
  </div>

  <div
    id="print-content"
    :class="[
      `scale-${config.scale}`,
      { 'with-cut-lines': config.showCutLines },
    ]"
  >
    <template v-for="(page, pageIndex) in printPages" :key="`page-${pageIndex}`">
      <div class="print-page">
        <div class="print-grid" :class="{ 'print-grid-backs': page.isBack }">
          <template v-for="(slot, slotIndex) in page.slots" :key="`page-${pageIndex}-${slotIndex}`">
            <img
              v-if="slot"
              :src="resolveCardImage(slot.card, slot.face)"
            >
            <div v-else class="print-slot" />
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { parseDecklist } from "../helpers/DecklistParser.mjs";
import {
    cardAnalysisCharacteristics,
    isCreatureCard,
    summarizeCreatureInteractions
} from "../helpers/DeckInteractionAnalyzer.mjs";
import {
    buildAnalysisCell,
    buildAnalysisRowsForCard,
    buildMetaDeckRemovalSummary,
    buildValueAnalysisForCard,
    cardsForAnalysisCategory,
    countCards,
    isSynergyCategory
} from "../helpers/AnalysisModel.mjs";
import { createAnalysisWorkerClient } from "../helpers/AnalysisWorkerClient.mjs";
import {
    annotateSimulationPlayerActions,
    buildGameSimulation,
    findNextInteractiveStepIndex
} from "../helpers/GameSimulator.mjs";
import { createSessionStorage } from "../helpers/SessionStorage.mjs";
import { bindStorage } from "../helpers/VueLocalStorage.mjs";
import ImageLoader from "../components/ImageLoader.vue";
import LoadingSpinner from "../components/LoadingSpinner.vue";
import HelpModal from "../components/HelpModal.vue";
import ArnoldsApproval from "../components/ArnoldsApproval.vue";

// Chunk out the card list for quasi-lazy loading. Or at least loading that doesn't block the page rendering.
const ScryfallDatasetAsync = () => import("../../data/cards-minimized.json");

const basicLands = [
    "wastes",
    "forest",
    "island",
    "plains",
    "swamp",
    "mountain",
    "snow-covered wastes",
    "snow-covered forest",
    "snow-covered island",
    "snow-covered plains",
    "snow-covered swamp",
    "snow-covered mountain",
];

const analysisCategories = [
    { key: "instantRemoval", label: "Kill inst." },
    { key: "sorceryRemoval", label: "Kill sorc." },
    { key: "removalActions.instant.targetable", label: "Target inst." },
    { key: "removalActions.sorcery.targetable", label: "Target sorc." },
    { key: "removalActions.instant.damage", label: "Dmg inst." },
    { key: "removalActions.sorcery.damage", label: "Dmg sorc." },
    { key: "removalActions.instant.blockedTarget", label: "No target inst." },
    { key: "removalActions.sorcery.blockedTarget", label: "No target sorc." },
    { key: "combat.attacking.bothSurvive", label: "Atk hold" },
    { key: "combat.attacking.bothDie", label: "Atk trade" },
    { key: "combat.attacking.defenderSurvives", label: "Atk lose" },
    { key: "combat.attacking.attackerSurvives", label: "Atk win" },
    { key: "combat.attacking.damageOnPlayer", label: "Atk face" },
    { key: "combat.defending.bothSurvive", label: "Blk hold" },
    { key: "combat.defending.bothDie", label: "Blk trade" },
    { key: "combat.defending.defenderSurvives", label: "Blk win" },
    { key: "combat.defending.attackerSurvives", label: "Blk lose" },
    { key: "combat.defending.damageOnPlayer", label: "No block" },
    { key: "synergy.combat.sources", label: "Synergy combat", targetGroup: "cards" },
    { key: "synergy.combat.feeders", label: "I/S:Combat pump", targetGroup: "cards" },
    { key: "synergy.graveyardPlay.sources", label: "S:Grave to hand", targetGroup: "cards" },
    { key: "synergy.graveyardPlay.feeders", label: "S:Grave to hand", targetGroup: "cards" },
    { key: "synergy.creatureTokens.sources", label: "S:Token engine", targetGroup: "cards" },
    { key: "synergy.creatureTokens.feeders", label: "S:Token engine", targetGroup: "cards" },
    { key: "synergy.battlefieldToHand.sources", label: "Synergy hand", targetGroup: "cards" },
    { key: "synergy.battlefieldToHand.feeders", label: "Feeds hand", targetGroup: "cards" },
    { key: "synergy.entersBattlefield.sources", label: "Synergy ETB", targetGroup: "cards" },
    { key: "synergy.entersBattlefield.feeders", label: "Feeds ETB", targetGroup: "cards" },
    { key: "synergy.etbLifeGain.sources", label: "Synergy life ETB", targetGroup: "cards" },
    { key: "synergy.etbLifeGain.feeders", label: "Feeds life ETB", targetGroup: "cards" },
    { key: "synergy.creatureDeathValue.sources", label: "Synergy death", targetGroup: "cards" },
    { key: "synergy.creatureDeathValue.feeders", label: "Feeds death", targetGroup: "cards" },
];

const cardPreviewDelayMs = 2500;

function createDefaultConfig() {
    return {
        includeDigital: false,
        includePromo: false,
        matchEditions: false,
        includeBasics: false,
        includeCards: true,
        includeGamePieces: true,
        showCutLines: false,
        fixedPageSize: false,
        imageType: "border_crop",
        scale: "normal",
        cardBacks: "dfc",
        tokenBackMode: "opposite",
        tokenPlacementMode: "auto",
        cardsPerPage: null,
        analysisMode: false,
        analysisView: "interaction",
        analysisMetric: "count",
        analysisColumnMode: "metaDeck",
        analysisMatchupSessionId: "all",
        activeWorkspaceTab: "cards",
        simulationMatchupSessionId: "",
        simulationPlayerCount: 2,
        simulationPlayerRoles: ["human", "ai", "ai", "ai", "ai", "ai"],
        simulationShowOpponentHands: false,
        simulationSeed: 1,
        simulationSpeed: "normal",
        simulationStepIndex: 0,
        simulationTurnCount: 2,
        simulationBoardZoom: 1,
        comboPieceConfigOpen: false,
        comboPieceTypes: {
            token: true,
            emblem: true,
            tracker: true,
            mechanicHelper: true,
            dungeon: true,
            initiative: true,
            ring: true,
            realCard: false,
        },
        decklist: "",
    };
}

function setImageVersion(url, version) {
    if (/cards\.scryfall\.io/.test(url)) {
        return url.replace(/\/(border_crop|normal|large|small|art_crop|png)\//, `/${version}/`);
    } else if (/api\.scryfall\.com/.test(url)) {
        var parsedUrl = new URL(url);
        parsedUrl.searchParams.set("version", version);
        return parsedUrl.href;
    } else {
        return url;
    }
}

export default {
    name: "ProxyPage",
    components: {
        ImageLoader,
        LoadingSpinner,
        HelpModal,
        ArnoldsApproval,
    },
    data() {
        return {
            config: createDefaultConfig(),
            sets: {},
            tokenPool: [],
            nextTokenBackIndex: 0,
            cards: [],
            errors: [],
            sessionSetSelections: {},
            printOrderModalOpen: false,
            selectedPrintOrderSlotIndex: null,
            customPrintOrderCards: [],
            printOrderDraftCards: [],
            localAppEnabled: import.meta.env.VITE_LOCAL_APP === 'true',
            leftMenuCollapsed: false,
            sessionsMenuOpen: true,
            localSessionStorage: createSessionStorage(),
            localSessions: [],
            activeSessionId: null,
            activeSessionName: '',
            activeSessionIsMetaDeck: false,
            metaDeckStates: [],
            isLoadingSets: false,
            isLoadingCards: false,
            isLoadingSessions: false,
            isLoadingDataset: false,
            isLoadingDeckList: false,
            isHydratingCards: false,
            isLoadingSessionList: false,
            isLoadingSessionState: false,
            isLoadingMetaDecks: false,
            hydratingCardIds: {},
            analysisLoadingCardIds: {},
            analysisRowsByCardId: {},
            valueAnalysisByCardId: {},
            collapsedAnalysisDeckIds: {},
            expandedValueRemovalDeckIds: {},
            expandedSimulationZones: {},
            simulationActionMenu: null,
            simulationLifeTotals: {},
            simulationPendingAction: null,
            simulationResolvedActions: [],
            cardPreview: {
                visible: false,
                src: '',
                alt: '',
            },
            cardPreviewTimer: null,
            simulationHistory: [],
            analysisQueueTimer: null,
            analysisGeneration: 0,
            analysisClient: null,
            cardRuntimeId: 0,
            cardLoadGeneration: 0,
            datasetPromise: null,
            sessionSaveTimer: null,
            restoringSession: false,
        };
    },
    watch: {
        config: {
            deep: true,
            handler() {
                this.scheduleSessionSave();
                this.scheduleAnalysisRefresh();
            },
        },
        cards: {
            deep: true,
            handler() {
                this.scheduleSessionSave();
                this.scheduleAnalysisRefresh();
            },
        },
        errors: {
            deep: true,
            handler() {
                this.scheduleSessionSave();
            },
        },
        sessionSetSelections: {
            deep: true,
            handler() {
                this.scheduleSessionSave();
            },
        },
        customPrintOrderCards: {
            deep: true,
            handler() {
                this.scheduleSessionSave();
            },
        },
        simulationHistory: {
            deep: true,
            handler() {
                this.scheduleSessionSave();
            },
        },
        metaDeckStates: {
            deep: true,
            handler() {
                this.scheduleAnalysisRefresh();
            },
        },
        activeSessionName() {
            this.scheduleSessionSave();
        },
        activeSessionIsMetaDeck() {
            this.scheduleSessionSave();
        },
    },
    computed: {
        cardCountWhenPrinting() {
            const count = this.printCapacity.physicalCards;

            const overflow = count % this.printCapacity.pageSize;
            const bound = overflow == 0 ? count : count + (this.printCapacity.pageSize - overflow);

            return {
                count,
                overflow,
                bound,
                percentage: Math.round((overflow / this.printCapacity.pageSize) * 100),
            };
        },
        printCapacity() {
            const pageSize = this.getPrintPageSize();
            const frontPages = this.printPages.filter(page => !page.isBack);
            const usesGamePieceBacks = this.config.cardBacks === "all-pages" &&
                this.config.tokenBackMode === "opposite";
            const physicalCards = usesGamePieceBacks
                ? frontPages.reduce((total, page) => {
                    return total + page.slots.filter(Boolean).length;
                }, 0)
                : this.printSlotsFront.length;
            const pageCount = Math.max(Math.ceil(physicalCards / pageSize), physicalCards > 0 ? 1 : 0);
            const physicalCapacity = pageCount * pageSize;
            const missingCards = Math.max(0, physicalCapacity - physicalCards);
            const printedFaces = this.printPages.reduce((total, page) => {
                return total + page.slots.filter(Boolean).length;
            }, 0);
            const missingGamePieces = usesGamePieceBacks
                ? Math.max(0, physicalCapacity * 2 - printedFaces)
                : missingCards;

            return {
                pageSize,
                physicalCards,
                missingCards,
                missingGamePieces,
            };
        },
        printSlotsFrontBase() {
            const slots = [];

            for (const card of this.cards) {
                if (!this.shouldShowCard(card, "front")) {
                    continue;
                }

                for (let i = 0; i < card.quantity; i += 1) {
                    slots.push(card);
                }
            }

            return slots;
        },
        printSlotsFront() {
            const baseSlots = this.printSlotsFrontBase;

            if (this.isCustomPrintOrderCurrent(baseSlots)) {
                return this.customPrintOrderCards;
            }

            return baseSlots;
        },
        printOrderGridColumns() {
            const pageSize = this.getPrintPageSize();
            const columnsByPageSize = {
                6: 3,
                8: 2,
                9: 3,
            };

            return columnsByPageSize[pageSize] ?? Math.ceil(Math.sqrt(pageSize));
        },
        printOrderPreviewPages() {
            const slots = this.printOrderModalOpen ? this.printOrderDraftCards : this.printSlotsFront;
            const indexedSlots = slots.map((card, index) => {
                return { card, index };
            });

            return this.buildPrintOrderPreviewPages(indexedSlots);
        },
        printPages() {
            const toPages = (slots, isBack, pageSize = null) => {
              // If a pageSize is provided (number), paginate into that size.
              if (pageSize && Number.isInteger(pageSize) && pageSize > 0) {
                const pages = [];
                for (let i = 0; i < slots.length; i += pageSize) {
                  const page = slots.slice(i, i + pageSize);
                  while (page.length < pageSize) {
                    page.push(null);
                  }
                  pages.push({ slots: page, isBack });
                }
                return pages.length ? pages : [];
              }

              // Fallback to old behavior: if fixedPageSize true, use 9 slots; otherwise return a single page.
              if (this.config.fixedPageSize) {
                const pages = [];
                for (let i = 0; i < slots.length; i += 9) {
                  const page = slots.slice(i, i + 9);
                  while (page.length < 9) {
                    page.push(null);
                  }
                  pages.push({ slots: page, isBack });
                }
                return pages.length ? pages : [];
              }

              return [{ slots, isBack }];
            };

            if (this.config.cardBacks === "none") {
                const slots = this.printSlotsFront.map((card) => {
                    return { card, face: "front" };
                });

                return toPages(slots, false);
            }

            if (this.config.cardBacks === "all-pages") {
              const pairedSlots = this.config.tokenBackMode === "opposite"
                ? this.buildOppositeGamePieceSlots(this.printSlotsFront)
                : {
                    frontSlots: this.printSlotsFront.map((card) => {
                      return { card, face: "front" };
                    }),
                    backSlots: this.printSlotsFront.map((card) => {
                      return { card, face: "back" };
                    }),
                  };
              const { frontSlots, backSlots } = pairedSlots;

              const pageSize = this.config.fixedPageSize ? 9 : (this.config.cardsPerPage ?? null);
              const frontPages = toPages(frontSlots, false, pageSize);
              const backPages = toPages(backSlots, true, pageSize);
              const pages = [];

              for (let i = 0; i < Math.max(frontPages.length, backPages.length); i += 1) {
                if (frontPages[i]) {
                  pages.push(frontPages[i]);
                }
                if (backPages[i]) {
                  pages.push(backPages[i]);
                }
              }

              return pages;
            }

            const slots = [];
            for (const card of this.printSlotsFront) {
                slots.push({ card, face: "front" });

                if (this.shouldShowCard(card, "back")) {
                    slots.push({ card, face: "back" });
                }
            }

            return toPages(slots, false);
        },
        metaCreatureAnalyses() {
            return this.metaDeckStates.flatMap(session => {
                return (session.state?.cards ?? [])
                    .filter(card => isCreatureCard(card))
                    .map((creature, index) => {
                        const summary = summarizeCreatureInteractions(this.cards, creature);

                        return {
                            sessionId: session.id,
                            sessionName: session.name,
                            creature,
                            index,
                            counts: this.countInteractionSummary(summary),
                        };
                    });
            });
        },
        selectedMetaDeckStates() {
            if (this.config.analysisMatchupSessionId === "all") {
                return this.metaDeckStates;
            }

            return this.metaDeckStates.filter(session => session.id === this.config.analysisMatchupSessionId);
        },
        simulationMetaDeckStates() {
            return this.metaDeckStates.filter(session => (session.state?.cards ?? []).length > 0);
        },
        selectedSimulationMetaDeck() {
            return this.simulationMetaDeckStates.find(session => {
                return session.id === this.config.simulationMatchupSessionId;
            }) ?? this.simulationMetaDeckStates[0] ?? null;
        },
        effectiveSimulationMatchupSessionId: {
            get() {
                return this.selectedSimulationMetaDeck?.id ?? "";
            },
            set(value) {
                this.config.simulationMatchupSessionId = value;
            },
        },
        simulationPlayerSlots() {
            const count = Math.max(2, Math.min(Number(this.config.simulationPlayerCount ?? 2), 6));
            return Array.from({ length: count }, (_, index) => index);
        },
        gameSimulation() {
            if (this.cards.length === 0 || !this.selectedSimulationMetaDeck) {
                return null;
            }

            return buildGameSimulation(
                this.cards,
                this.selectedSimulationMetaDeck.state?.cards ?? [],
                {
                    opponentName: this.selectedSimulationMetaDeck.name,
                    playerCount: this.config.simulationPlayerCount,
                    playerRoles: this.config.simulationPlayerRoles,
                    seed: this.config.simulationSeed,
                    turnCount: this.config.simulationTurnCount,
                },
            );
        },
        activeSimulationStepIndex() {
            const steps = this.gameSimulation?.phaseSteps ?? [];
            if (steps.length === 0) {
                return 0;
            }

            const index = Number(this.config.simulationStepIndex);
            return Math.max(0, Math.min(Number.isFinite(index) ? index : 0, steps.length - 1));
        },
        activeSimulationStep() {
            return this.gameSimulation?.phaseSteps?.[this.activeSimulationStepIndex] ?? null;
        },
        activeSimulationPlayer() {
            return this.simulationPlayerList.find(player => {
                return player.key === this.activeSimulationStep?.playerKey;
            }) ?? null;
        },
        isLastSimulationStep() {
            const steps = this.gameSimulation?.phaseSteps ?? [];
            return steps.length === 0 || this.activeSimulationStepIndex >= steps.length - 1;
        },
        simulationPlayerList() {
            return this.applySimulationResolvedActions(
                this.activeSimulationStep?.players ?? this.gameSimulation?.playerList ?? [],
            );
        },
        simulationPlayerLanes() {
            const players = this.simulationPlayerList;
            const lanes = [];
            for (let index = 0; index < players.length; index += 2) {
                const laneIndex = Math.floor(index / 2);
                lanes.push({
                    bottomPlayer: players[index] ?? null,
                    index: laneIndex,
                    topPlayer: players[index + 1] ?? null,
                });
            }

            return lanes;
        },
        analysisCategories() {
            return analysisCategories;
        },
        analysisColumns() {
            const sessions = this.selectedMetaDeckStates;
            const selectedCardTotal = this.countCards(sessions.flatMap(session => session.state?.cards ?? []));

            if (this.config.analysisColumnMode === "manaValue") {
                const columns = Array.from({ length: 10 }, (_, manaValue) => {
                    const isNinePlus = manaValue === 9;

                    return {
                        key: isNinePlus ? '9-plus' : String(manaValue),
                        sortValue: manaValue,
                        label: isNinePlus ? '9+ mana' : `${manaValue} mana`,
                        type: 'manaValue',
                        actionCost: manaValue,
                        cards: [],
                        allCards: sessions.flatMap(session => session.state?.cards ?? []),
                        creatures: [],
                        totalCards: selectedCardTotal,
                    };
                });

                for (const session of sessions) {
                    for (const card of (session.state?.cards ?? [])) {
                        const manaValue = Number(card.selectedOption?.manaValue);
                        if (!Number.isFinite(manaValue) || manaValue < 0) {
                            continue;
                        }

                        const column = columns[Math.min(Math.floor(manaValue), 9)];
                        column.cards.push(card);
                        if (isCreatureCard(card)) {
                            column.creatures.push(card);
                        }
                    }
                }

                return columns;
            }

            return sessions.map(session => {
                return {
                    key: session.id,
                    label: session.name,
                    type: 'metaDeck',
                    collapsed: Boolean(this.collapsedAnalysisDeckIds[session.id]),
                    cards: session.state?.cards ?? [],
                    creatures: (session.state?.cards ?? []).filter(card => isCreatureCard(card)),
                    totalCards: this.countCards(session.state?.cards ?? []),
                };
            });
        },
        analysisCardTotal() {
            return this.cards.reduce((total, card) => total + (card.quantity ?? 1), 0);
        },
        analysisStatsLoading() {
            return this.isLoadingSessions ||
                this.isLoadingMetaDecks ||
                this.isHydratingCards ||
                Object.values(this.analysisLoadingCardIds).some(Boolean);
        },
    },
    async mounted() {
        this.analysisClient = createAnalysisWorkerClient();
        this.initConfig();
        await this.initLocalSessions();
        window.addEventListener('blur', this.hideCardPreview);
        window.addEventListener('scroll', this.hideCardPreview, true);
        window.setTimeout(() => {
            this.loadSetList();
        }, 0);
    },
    beforeUnmount() {
        clearTimeout(this.sessionSaveTimer);
        clearTimeout(this.analysisQueueTimer);
        this.hideCardPreview();
        window.removeEventListener('blur', this.hideCardPreview);
        window.removeEventListener('scroll', this.hideCardPreview, true);
        this.analysisClient?.terminate();
    },
    methods: {
        cloneForStorage(value) {
            return JSON.parse(JSON.stringify(value));
        },
        yieldToUi() {
            return new Promise(resolve => {
                window.setTimeout(resolve, 0);
            });
        },
        async getScryfallDataset() {
            if (!this.datasetPromise) {
                this.isLoadingDataset = true;
                this.isLoadingSets = true;
                this.datasetPromise = ScryfallDatasetAsync()
                    .then(module => module.default ?? module)
                    .then(dataset => {
                        this.sets = dataset.sets;
                        this.buildTokenPool(dataset);
                        return dataset;
                    })
                    .finally(() => {
                        this.isLoadingDataset = false;
                        this.isLoadingSets = false;
                    });
            }

            return this.datasetPromise;
        },
        buildTokenPool(dataset) {
            this.tokenPool = Object.values(dataset.cards)
                .flat()
                .filter(card => card.isGamePiece && card.urlFront)
                .map(card => {
                    return {
                        name: card.name,
                        urlBack: card.urlFront,
                    };
                })
                .filter(token => token.urlBack);
        },
        cardRuntimeKey(card) {
            if (!card.__runtimeId) {
                Object.defineProperty(card, '__runtimeId', {
                    configurable: true,
                    enumerable: false,
                    value: `card-${++this.cardRuntimeId}`,
                });
            }

            return card.__runtimeId;
        },
        setCardFlag(flagName, card, value) {
            const key = this.cardRuntimeKey(card);
            this[flagName] = {
                ...this[flagName],
                [key]: value,
            };
        },
        isCardHydrating(card) {
            return Boolean(this.hydratingCardIds[this.cardRuntimeKey(card)]);
        },
        isCardAnalysisLoading(card) {
            return Boolean(this.analysisLoadingCardIds[this.cardRuntimeKey(card)]);
        },
        isCardLoading(card) {
            return this.isLoadingSessions ||
                this.isLoadingMetaDecks ||
                this.isCardHydrating(card) ||
                this.isCardAnalysisLoading(card);
        },
        countCards(cards) {
            return countCards(cards);
        },
        simulationBoardStyle() {
            const zoom = Number(this.config.simulationBoardZoom);
            const scale = Number.isFinite(zoom) ? zoom : 1;

            return {
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
            };
        },
        simulationCardImage(card) {
            return card?.faceDown ? './card_back_border_crop.jpg' : (card?.imageUrl || './card_back_border_crop.jpg');
        },
        resolveCardPreviewImage(card, face = "front") {
            if (!card) {
                return '';
            }

            if (card.faceDown) {
                return './card_back_border_crop.jpg';
            }

            const imageUrl = card.imageUrl ?? this.resolveCardImage(card, face);
            return imageUrl ? setImageVersion(imageUrl, "large") : '';
        },
        scheduleCardPreview(card, face = "front") {
            this.hideCardPreview();

            const src = this.resolveCardPreviewImage(card, face);
            if (!src) {
                return;
            }

            const alt = card?.name ?? 'Card preview';
            this.cardPreviewTimer = window.setTimeout(() => {
                this.cardPreview = {
                    visible: true,
                    src,
                    alt,
                };
                this.cardPreviewTimer = null;
            }, cardPreviewDelayMs);
        },
        hideCardPreview() {
            if (this.cardPreviewTimer) {
                window.clearTimeout(this.cardPreviewTimer);
                this.cardPreviewTimer = null;
            }

            if (this.cardPreview.visible) {
                this.cardPreview = {
                    ...this.cardPreview,
                    visible: false,
                };
            }
        },
        simulationLaneSeats(lane) {
            return [
                { player: lane.topPlayer, position: 'top' },
                { player: lane.bottomPlayer, position: 'bottom' },
            ].filter(seat => seat.player);
        },
        simulationZoneKey(player, zone) {
            return `${player.key}:${zone}`;
        },
        isSimulationZoneExpanded(player, zone) {
            return Boolean(this.expandedSimulationZones[this.simulationZoneKey(player, zone)]);
        },
        toggleSimulationZone(player, zone) {
            const key = this.simulationZoneKey(player, zone);
            this.expandedSimulationZones = {
                ...this.expandedSimulationZones,
                [key]: !this.expandedSimulationZones[key],
            };
        },
        visibleSimulationHandCards(player) {
            const canSeeHand = player.key === 'you' || this.config.simulationShowOpponentHands;
            if (!canSeeHand) {
                return player.zones.handCount > 0
                    ? [
                        {
                            faceDown: true,
                            name: 'Hidden hand',
                            quantity: player.zones.handCount,
                        },
                    ]
                    : [];
            }

            return player.zones.playableHand;
        },
        formatSimulationCastActions(actions = []) {
            return actions.map(action => {
                return `${action.card.name} -> ${action.destination}`;
            }).join(', ');
        },
        recordSimulationHistory() {
            if (!this.gameSimulation) {
                return;
            }

            this.simulationHistory = [
                {
                    ...this.gameSimulation.historyEntry,
                    createdAt: new Date().toISOString(),
                },
                ...this.simulationHistory,
            ].slice(0, 20);
        },
        rerollSimulation() {
            const currentSeed = Number(this.config.simulationSeed);
            this.config.simulationSeed = Number.isFinite(currentSeed) ? currentSeed + 1 : 1;
            this.config.simulationStepIndex = 0;
            this.resetSimulationRuntime();
            this.recordSimulationHistory();
        },
        advanceSimulationStep() {
            if (!this.isLastSimulationStep) {
                this.simulationActionMenu = null;
                this.simulationPendingAction = null;
                this.config.simulationStepIndex = findNextInteractiveStepIndex(
                    this.gameSimulation?.phaseSteps ?? [],
                    this.activeSimulationStepIndex,
                    this.simulationResolvedActions,
                );
            }
        },
        phaseLabel(phase) {
            const labels = {
                attack: 'Attack',
                blockers: 'Declare blockers',
                combat: 'Combat',
                damageOrder: 'Damage order',
                discard: 'Discard',
                draw: 'Draw',
                end: 'End phase',
                main: 'Main',
                secondMain: 'Second main',
                upkeep: 'Upkeep',
            };

            return labels[phase] ?? phase;
        },
        simulationDisplayCardName(card) {
            return String(card?.name ?? '')
                .split(' ')
                .filter(Boolean)
                .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
                .join(' ');
        },
        simulationPlayerLife(player) {
            return this.simulationLifeTotals[player.key] ?? 20;
        },
        simulationManaPoolText(pool = {}) {
            return ['W', 'U', 'B', 'R', 'G', 'C'].flatMap(symbol => {
                const amount = Number(pool?.[symbol] ?? 0);
                if (!Number.isFinite(amount) || amount <= 0) {
                    return [];
                }

                return Array.from({ length: Math.floor(amount) }, () => `{${symbol}}`);
            }).join('');
        },
        simulationCardClasses(card, targetable = false) {
            return {
                'simulation-card-actionable': Boolean(card?.actionState?.actionable),
                'simulation-card-targetable': targetable,
                'simulation-card-source-exile': card?.sourceZone === 'exile',
                'simulation-card-source-graveyard': card?.sourceZone === 'graveyard',
                'simulation-hand-card-virtual': Boolean(card?.sourceZone),
            };
        },
        simulationCardActionTitle(card) {
            return card?.actionState?.actions?.join(', ') ?? '';
        },
        simulationSourceZoneLabel(sourceZone) {
            return sourceZone === 'graveyard'
                ? 'GY'
                : sourceZone === 'exile'
                    ? 'EX'
                    : sourceZone;
        },
        normalizedSimulationActionOptions(card) {
            const options = card?.actionState?.options ?? [];
            if (options.length > 0) {
                return options;
            }

            return (card?.actionState?.actions ?? []).map((label, index) => {
                return {
                    id: `${card.name}:${label}:${index}`,
                    kind: 'generic',
                    label,
                    sourceZone: card.sourceZone ?? 'hand',
                };
            });
        },
        handleSimulationCardDoubleClick(card, player) {
            const options = this.normalizedSimulationActionOptions(card);
            if (options.length === 0) {
                return;
            }

            if (options.length > 1) {
                this.simulationActionMenu = {
                    card,
                    options,
                    player,
                };
                return;
            }

            this.startSimulationAction(card, player, options[0]);
        },
        chooseSimulationAction(option) {
            if (!this.simulationActionMenu) {
                return;
            }

            const { card, player } = this.simulationActionMenu;
            this.simulationActionMenu = null;
            this.startSimulationAction(card, player, option);
        },
        closeSimulationActionMenu() {
            this.simulationActionMenu = null;
        },
        startSimulationAction(card, player, option) {
            let resolvedOption = option;
            if (option.kind === 'cast' && !option.payment) {
                const paymentOptions = option.paymentOptions ?? [];
                if (Array.isArray(option.paymentOptions) && paymentOptions.length === 0) {
                    return;
                }
                if (paymentOptions.length > 1) {
                    this.simulationActionMenu = {
                        card,
                        options: paymentOptions.map((payment, index) => {
                            return {
                                ...option,
                                id: `${option.id}:payment:${payment.id}:${index}`,
                                label: payment.label,
                                payment,
                            };
                        }),
                        player,
                    };
                    return;
                }

                if (paymentOptions.length === 1) {
                    resolvedOption = {
                        ...option,
                        payment: paymentOptions[0],
                    };
                }
            }

            const action = {
                card,
                option: resolvedOption,
                playerKey: player.key,
                playerName: player.name,
                stepIndex: this.activeSimulationStepIndex,
            };

            if (resolvedOption.requiresTarget) {
                this.simulationPendingAction = action;
                return;
            }

            this.resolveSimulationAction(action, null);
        },
        isSimulationTargetType(option, type) {
            return (option?.targetTypes ?? []).includes(type);
        },
        isSimulationPlayerTargetable(player) {
            return Boolean(this.simulationPendingAction) &&
                this.isSimulationTargetType(this.simulationPendingAction.option, 'player') &&
                !this.simulationActionTargetsOwnPlayerOnly(this.simulationPendingAction, player);
        },
        simulationActionTargetsOwnPlayerOnly() {
            return false;
        },
        isSimulationCardTargetable(card) {
            if (!this.simulationPendingAction) {
                return false;
            }

            const targetTypes = this.simulationPendingAction.option.targetTypes ?? [];
            const typeLine = String(card?.typeLine ?? '');
            return (targetTypes.includes('creature') && /\bcreature\b/i.test(typeLine)) ||
                (targetTypes.includes('artifact') && /\bartifact\b/i.test(typeLine)) ||
                (targetTypes.includes('planeswalker') && /\bplaneswalker\b/i.test(typeLine)) ||
                (targetTypes.includes('battle') && /\bbattle\b/i.test(typeLine)) ||
                targetTypes.includes('permanent');
        },
        selectSimulationPlayerTarget(player) {
            if (!this.isSimulationPlayerTargetable(player)) {
                return;
            }

            this.resolveSimulationAction(this.simulationPendingAction, {
                playerKey: player.key,
                type: 'player',
            });
        },
        selectSimulationCardTarget(card, player) {
            if (!this.isSimulationCardTargetable(card)) {
                return;
            }

            this.resolveSimulationAction(this.simulationPendingAction, {
                card,
                playerKey: player.key,
                type: 'card',
            });
        },
        resolveSimulationAction(action, target) {
            if (!action) {
                return;
            }

            if (target?.type === 'player' && action.option.damageAmount) {
                const life = this.simulationLifeTotals[target.playerKey] ?? 20;
                this.simulationLifeTotals = {
                    ...this.simulationLifeTotals,
                    [target.playerKey]: life - action.option.damageAmount,
                };
            }

            this.simulationResolvedActions = [
                ...this.simulationResolvedActions,
                {
                    card: this.cloneForStorage(action.card),
                    option: this.cloneForStorage(action.option),
                    playerKey: action.playerKey,
                    stepIndex: action.stepIndex,
                    target: target ? this.cloneForStorage(target) : null,
                },
            ];
            this.simulationPendingAction = null;
            this.simulationActionMenu = null;
        },
        decrementSimulationCardGroup(cards = [], card) {
            const index = cards.findIndex(entry => {
                return entry.name === card.name &&
                    (entry.sourceZone ?? '') === (card.sourceZone ?? '');
            });
            if (index === -1) {
                return;
            }

            if ((cards[index].quantity ?? 1) > 1) {
                cards[index].quantity -= 1;
                return;
            }

            cards.splice(index, 1);
        },
        addSimulationCardGroup(cards = [], card) {
            const normalizedCard = {
                ...card,
                actionState: undefined,
                quantity: 1,
                sourceZone: undefined,
            };
            const existing = cards.find(entry => {
                return entry.name === normalizedCard.name &&
                    (entry.typeLine ?? '') === (normalizedCard.typeLine ?? '');
            });
            if (existing) {
                existing.quantity = (existing.quantity ?? 1) + 1;
                return;
            }

            cards.push(normalizedCard);
        },
        addSimulationManaToPool(player, symbols = []) {
            const currentPool = player.zones.manaPool ?? {};
            const nextPool = { ...currentPool };
            for (const symbol of ['W', 'U', 'B', 'R', 'G', 'C']) {
                nextPool[symbol] = Number(nextPool[symbol] ?? 0);
            }
            for (const symbol of symbols) {
                if (Object.hasOwn(nextPool, symbol)) {
                    nextPool[symbol] += 1;
                }
            }
            player.zones.manaPool = nextPool;
        },
        markSimulationCardGroupTapped(cards = [], sourceCard = {}) {
            const index = cards.findIndex(entry => {
                return entry.name === sourceCard.name &&
                    (entry.typeLine ?? '') === (sourceCard.typeLine ?? '');
            });
            if (index === -1) {
                return;
            }

            const tappedCard = {
                ...cards[index],
                actionState: undefined,
                quantity: 1,
                state: {
                    ...(cards[index].state ?? {}),
                    tapped: true,
                },
            };
            if ((cards[index].quantity ?? 1) > 1) {
                cards[index].quantity -= 1;
                cards.push(tappedCard);
                return;
            }

            cards.splice(index, 1, tappedCard);
        },
        simulationBattlefieldZone(player, zoneName) {
            if (zoneName === 'creatures') {
                return player.zones.battlefield.creatures;
            }
            if (zoneName === 'nonCreaturePermanents') {
                return player.zones.battlefield.nonCreaturePermanents;
            }

            return player.zones.battlefield.lands;
        },
        applySimulationPayment(player, payment) {
            if (!payment) {
                return;
            }

            for (const source of payment.sources ?? []) {
                this.markSimulationCardGroupTapped(
                    this.simulationBattlefieldZone(player, source.zoneName),
                    source.sourceCard ?? source,
                );
            }
            player.zones.manaPool = {
                B: 0,
                C: 0,
                G: 0,
                R: 0,
                U: 0,
                W: 0,
                ...(payment.poolAfterPayment ?? {}),
            };
        },
        markSimulationCardGroupAttacking(cards = [], card) {
            const index = cards.findIndex(entry => {
                return entry.name === card.name &&
                    (entry.typeLine ?? '') === (card.typeLine ?? '');
            });
            if (index === -1) {
                return;
            }

            const attackingCard = {
                ...cards[index],
                actionState: undefined,
                quantity: 1,
                state: {
                    ...(cards[index].state ?? {}),
                    attacking: true,
                    tapped: true,
                },
            };
            if ((cards[index].quantity ?? 1) > 1) {
                cards[index].quantity -= 1;
                cards.push(attackingCard);
                return;
            }

            cards.splice(index, 1, attackingCard);
        },
        simulationCastDestination(card) {
            if (/\bcreature\b/i.test(card.typeLine ?? '')) {
                return 'creatures';
            }

            if (!/\binstant\b|\bsorcery\b/i.test(card.typeLine ?? '')) {
                return 'nonCreaturePermanents';
            }

            return /\bexile (?:this card|it)\b/i.test(card.oracleText ?? '') ? 'exile' : 'graveyard';
        },
        removeResolvedSimulationSource(player, action) {
            const sourceZone = action.option.sourceZone ?? action.card.sourceZone ?? 'hand';
            const sourceCard = {
                ...action.card,
                sourceZone: sourceZone === 'hand' ? undefined : sourceZone,
            };

            this.decrementSimulationCardGroup(player.zones.playableHand, sourceCard);

            if (sourceZone === 'hand') {
                this.decrementSimulationCardGroup(player.zones.hand, sourceCard);
                player.zones.handCount = Math.max(0, (player.zones.handCount ?? 0) - 1);
                return;
            }

            const zone = player.zones[sourceZone];
            if (zone) {
                this.decrementSimulationCardGroup(zone.cards, {
                    ...sourceCard,
                    sourceZone: undefined,
                });
                zone.count = Math.max(0, (zone.count ?? 0) - 1);
                zone.top = zone.cards.at(-1) ?? null;
            }
        },
        applyResolvedSimulationAction(players, action, options = {}) {
            const player = players.find(candidate => candidate.key === action.playerKey);
            if (!player) {
                return;
            }

            if (action.option.kind === 'mana') {
                this.markSimulationCardGroupTapped(
                    this.simulationBattlefieldZone(player, action.option.sourceZoneName),
                    action.card,
                );
                if (options.preserveManaPool !== false) {
                    this.addSimulationManaToPool(player, action.option.manaProduced);
                }
                return;
            }

            if (action.option.kind === 'attack') {
                this.markSimulationCardGroupAttacking(player.zones.battlefield.creatures, action.card);
                return;
            }

            if (action.option.kind === 'activate') {
                return;
            }

            this.removeResolvedSimulationSource(player, action);

            if (action.option.kind === 'playLand') {
                player.zones.landPlaysAvailable = Math.max(0, Number(player.zones.landPlaysAvailable ?? 1) - 1);
                this.addSimulationCardGroup(player.zones.battlefield.lands, {
                    ...action.card,
                    state: {
                        ...(action.card.state ?? {}),
                        tapped: false,
                    },
                });
                return;
            }

            if (action.option.kind === 'cast') {
                this.applySimulationPayment(player, action.option.payment);
                const destination = this.simulationCastDestination(action.card);
                if (destination === 'creatures') {
                    this.addSimulationCardGroup(player.zones.battlefield.creatures, action.card);
                } else if (destination === 'nonCreaturePermanents') {
                    this.addSimulationCardGroup(player.zones.battlefield.nonCreaturePermanents, action.card);
                } else {
                    const zone = player.zones[destination];
                    this.addSimulationCardGroup(zone.cards, action.card);
                    zone.count = (zone.count ?? 0) + 1;
                    zone.top = zone.cards.at(-1) ?? null;
                }
            }
        },
        applySimulationResolvedActions(players) {
            if (players.length === 0) {
                return [];
            }

            const clonedPlayers = this.cloneForStorage(players);
            for (const action of this.simulationResolvedActions) {
                if (action.stepIndex <= this.activeSimulationStepIndex) {
                    this.applyResolvedSimulationAction(clonedPlayers, action, {
                        preserveManaPool: action.stepIndex === this.activeSimulationStepIndex,
                    });
                }
            }

            return clonedPlayers.map(player => {
                return annotateSimulationPlayerActions(player, this.activeSimulationStep?.phase ?? '', {
                    isActivePlayer: player.key === this.activeSimulationStep?.playerKey,
                });
            });
        },
        resetSimulationRuntime() {
            this.simulationActionMenu = null;
            this.simulationLifeTotals = {};
            this.simulationPendingAction = null;
            this.simulationResolvedActions = [];
        },
        formatSimulationOptions(options = []) {
            return options.map(option => {
                return `${option.quantity}x ${option.name}`;
            }).join(', ');
        },
        countInteractionSummary(summary) {
            const countCombat = combat => {
                return {
                    bothSurvive: this.countCards(combat.bothSurvive),
                    bothDie: this.countCards(combat.bothDie),
                    defenderSurvives: this.countCards(combat.defenderSurvives),
                    attackerSurvives: this.countCards(combat.attackerSurvives),
                    damageOnPlayer: this.countCards(combat.damageOnPlayer),
                    unknown: this.countCards(combat.unknown),
                };
            };

            return {
                instantRemoval: this.countCards(summary.instantRemoval),
                sorceryRemoval: this.countCards(summary.sorceryRemoval),
                removalActions: {
                    instant: {
                        kill: this.countCards(summary.removalActions.instant.kill),
                        damage: this.countCards(summary.removalActions.instant.damage),
                        targetable: this.countCards(summary.removalActions.instant.targetable),
                        blockedTarget: this.countCards(summary.removalActions.instant.blockedTarget),
                    },
                    sorcery: {
                        kill: this.countCards(summary.removalActions.sorcery.kill),
                        damage: this.countCards(summary.removalActions.sorcery.damage),
                        targetable: this.countCards(summary.removalActions.sorcery.targetable),
                        blockedTarget: this.countCards(summary.removalActions.sorcery.blockedTarget),
                    },
                },
                combat: {
                    attacking: countCombat(summary.combat.attacking),
                    defending: countCombat(summary.combat.defending),
                },
                synergies: this.countCards(summary.synergies),
            };
        },
        cardsForAnalysisCategory(summary, categoryKey) {
            return cardsForAnalysisCategory(summary, categoryKey);
        },
        analysisColumnHeader(card, column) {
            if (column.type !== 'metaDeck') {
                return {
                    killPercent: '',
                    interactionPercent: '',
                };
            }

            return buildMetaDeckRemovalSummary(card, column);
        },
        toggleAnalysisDeckCollapse(columnKey) {
            this.collapsedAnalysisDeckIds = {
                ...this.collapsedAnalysisDeckIds,
                [columnKey]: !this.collapsedAnalysisDeckIds[columnKey],
            };
        },
        valueRemovalDeckKey(card, optionIndex, deckId) {
            return `${this.cardRuntimeKey(card)}:${optionIndex}:${deckId}`;
        },
        isValueRemovalDeckExpanded(card, optionIndex, deckId) {
            return Boolean(this.expandedValueRemovalDeckIds[this.valueRemovalDeckKey(card, optionIndex, deckId)]);
        },
        toggleValueRemovalDeck(card, optionIndex, deckId) {
            const key = this.valueRemovalDeckKey(card, optionIndex, deckId);
            this.expandedValueRemovalDeckIds = {
                ...this.expandedValueRemovalDeckIds,
                [key]: !this.expandedValueRemovalDeckIds[key],
            };
        },
        isSynergyCategory(category) {
            return isSynergyCategory(category);
        },
        visibleAnalysisCategories(card) {
            return this.analysisCategories.filter(category => {
                return this.analysisColumns.some(column => this.cardAnalysisCell(card, category, column).active);
            });
        },
        analysisRowsForCard(card) {
            return this.analysisRowsByCardId[this.cardRuntimeKey(card)] ?? [];
        },
        valueAnalysisForCard(card) {
            return this.valueAnalysisByCardId[this.cardRuntimeKey(card)] ?? {
                castOptions: [],
                activatedOptions: [],
                zoneOptions: [],
                deathOptions: [],
                creatureOptions: [],
            };
        },
        buildAnalysisRowsForCard(card) {
            return buildAnalysisRowsForCard(
                card,
                this.analysisCategories,
                this.analysisColumns,
                this.config.analysisMetric,
            );
        },
        scheduleAnalysisRefresh() {
            clearTimeout(this.analysisQueueTimer);
            if (this.config.analysisMode && this.cards.length > 0) {
                const visibleCards = this.cards.filter(card => this.shouldShowCard(card));
                this.analysisLoadingCardIds = visibleCards.reduce((flags, card) => {
                    flags[this.cardRuntimeKey(card)] = true;
                    return flags;
                }, {});
            }
            this.analysisQueueTimer = window.setTimeout(() => {
                this.runAnalysisQueue();
            }, 0);
        },
        async waitForAnalysisQueue() {
            await this.$nextTick();
            await this.runAnalysisQueue();
            await this.$nextTick();
        },
        async runAnalysisQueue() {
            const generation = ++this.analysisGeneration;
            clearTimeout(this.analysisQueueTimer);
            this.analysisQueueTimer = null;

            if (!this.config.analysisMode || this.cards.length === 0) {
                this.analysisRowsByCardId = {};
                this.valueAnalysisByCardId = {};
                this.analysisLoadingCardIds = {};
                return;
            }

            const relatedCards = this.cards;
            const visibleCards = this.cards.filter(card => this.shouldShowCard(card));
            const analysisPayloadBase = {
                categories: this.cloneForStorage(this.analysisCategories),
                columns: this.cloneForStorage(this.analysisColumns),
                metric: this.config.analysisMetric,
                relatedCards: this.cloneForStorage(relatedCards),
            };
            this.analysisRowsByCardId = {};
            this.valueAnalysisByCardId = {};
            this.analysisLoadingCardIds = visibleCards.reduce((flags, card) => {
                flags[this.cardRuntimeKey(card)] = true;
                return flags;
            }, {});

            await this.yieldToUi();

            for (const card of visibleCards) {
                if (generation !== this.analysisGeneration) {
                    return;
                }

                const key = this.cardRuntimeKey(card);
                if (!this.analysisClient) {
                    this.analysisClient = createAnalysisWorkerClient();
                }

                let analysisResult;
                try {
                    analysisResult = await this.analysisClient.analyze({
                        ...analysisPayloadBase,
                        card: this.cloneForStorage(card),
                    });
                } catch (error) {
                    console.warn(`Failed to analyze ${card.name} in the worker. Falling back to direct analysis.`, error);
                    analysisResult = {
                        rows: buildAnalysisRowsForCard(
                            card,
                            this.analysisCategories,
                            this.analysisColumns,
                            this.config.analysisMetric,
                        ),
                        value: buildValueAnalysisForCard(card, this.cards, this.analysisColumns),
                    };
                }

                const { rows, value } = analysisResult;

                if (generation !== this.analysisGeneration) {
                    return;
                }

                this.analysisRowsByCardId = {
                    ...this.analysisRowsByCardId,
                    [key]: rows,
                };
                this.valueAnalysisByCardId = {
                    ...this.valueAnalysisByCardId,
                    [key]: value,
                };
                this.analysisLoadingCardIds = {
                    ...this.analysisLoadingCardIds,
                    [key]: false,
                };

                await this.yieldToUi();
            }
        },
        formatAnalysisValue(card, quantity, total) {
            const prefix = card.isSideboard ? '+' : '';

            if (this.config.analysisMetric === "percent") {
                const percent = total > 0
                    ? quantity / total * 100
                    : 0;
                return `${prefix}${percent.toFixed(1)}%`;
            }

            return `${prefix}${quantity}`;
        },
        cardAnalysisCell(card, category, column) {
            return buildAnalysisCell(card, category, column, this.config.analysisMetric);
        },
        valueAnalysis(card) {
            return buildValueAnalysisForCard(card, this.cards, this.analysisColumns);
        },
        rowManaOptionsForCard(card) {
            const seen = new Map();
            for (const option of this.valueAnalysisForCard(card).castOptions) {
                for (const mana of option.manaOptions ?? []) {
                    if (mana.display === 'chip') {
                        continue;
                    }

                    const producedKey = JSON.stringify(mana.producedSymbolGroups ?? mana.producedSymbols ?? []);
                    const payKey = JSON.stringify(mana.paySymbolGroups ?? []);
                    const key = [
                        mana.condition,
                        mana.cost,
                        mana.effect,
                        mana.restriction,
                        mana.value,
                        producedKey,
                        payKey,
                    ].join(':');
                    if (!seen.has(key)) {
                        seen.set(key, mana);
                    }
                }
            }

            return [...seen.values()];
        },
        manaSymbolGroups(mana) {
            if (Array.isArray(mana.producedSymbolGroups) && mana.producedSymbolGroups.length > 0) {
                return mana.producedSymbolGroups;
            }

            return [mana.producedSymbols ?? []].filter(group => group.length > 0);
        },
        manaSummaryForCard(card) {
            const seen = new Map();
            for (const option of this.valueAnalysisForCard(card).castOptions) {
                for (const mana of option.manaOptions ?? []) {
                    if (mana.display !== 'chip') {
                        continue;
                    }

                    const producedSymbols = mana.producedSymbols ?? [];
                    const kind = mana.kind ?? 'payment';
                    const key = `${kind}:${mana.condition}:${producedSymbols.join('/')}`;
                    if (!seen.has(key)) {
                        seen.set(key, {
                            condition: mana.condition,
                            kind,
                            producedSymbolGroups: mana.producedSymbolGroups,
                            producedSymbols,
                            quantity: mana.quantity ?? 1,
                        });
                    }
                }
            }

            return [...seen.values()];
        },
        manaSymbolClass(symbol) {
            if (String(symbol).toUpperCase() === 'T') {
                return 'ms-tap';
            }

            return `ms-${String(symbol).toLowerCase().replaceAll('/', '')}`;
        },
        speedSymbolClass(speed) {
            return speed === 'Flash' ? 'ms-ability-flash' : 'ms-instant';
        },
        capturePrintOrderIndexes() {
            const baseSlots = [...this.printSlotsFrontBase];

            return this.customPrintOrderCards.map(card => {
                const index = baseSlots.indexOf(card);
                if (index === -1) {
                    return null;
                }

                baseSlots[index] = null;
                return index;
            });
        },
        restorePrintOrderIndexes(indexes = []) {
            const baseSlots = this.printSlotsFrontBase;
            const restored = indexes.map(index => baseSlots[index]).filter(Boolean);
            this.customPrintOrderCards = restored.length === baseSlots.length ? restored : [];
        },
        applyDeckTextQuantities(cards) {
            const { lines } = parseDecklist(this.config.decklist);
            const usedLineIndexes = new Set();

            for (const card of cards) {
                const lineIndex = lines.findIndex((line, index) => {
                    if (usedLineIndexes.has(index) || line.name !== card.name) {
                        return false;
                    }

                    if (line.set && card.requestedSet && line.set !== card.requestedSet) {
                        return false;
                    }

                    if (
                        line.collectorsNumber &&
                        card.requestedCollectorNumber &&
                        String(line.collectorsNumber).toLowerCase() !== String(card.requestedCollectorNumber).toLowerCase()
                    ) {
                        return false;
                    }

                    return true;
                });

                if (lineIndex === -1) {
                    continue;
                }

                usedLineIndexes.add(lineIndex);
                card.quantity = lines[lineIndex].quantity;
            }
        },
        captureSessionState() {
            const cards = this.cloneForStorage(this.cards);
            this.applyDeckTextQuantities(cards);

            return {
                config: this.cloneForStorage(this.config),
                cards,
                errors: this.cloneForStorage(this.errors),
                sessionSetSelections: this.cloneForStorage(this.sessionSetSelections),
                simulationHistory: this.cloneForStorage(this.simulationHistory),
                printOrderIndexes: this.capturePrintOrderIndexes(),
                nextTokenBackIndex: this.nextTokenBackIndex,
            };
        },
        async restoreSessionState(state) {
            this.restoringSession = true;

            const config = {
                ...createDefaultConfig(),
                ...(state?.config ?? {}),
                comboPieceTypes: {
                    ...createDefaultConfig().comboPieceTypes,
                    ...(state?.config?.comboPieceTypes ?? {}),
                },
            };

            for (const [key, value] of Object.entries(config)) {
                this.config[key] = value;
            }

            this.cards = this.cloneForStorage(state?.cards ?? []);
            this.errors = this.cloneForStorage(state?.errors ?? []);
            this.sessionSetSelections = this.cloneForStorage(state?.sessionSetSelections ?? {});
            this.simulationHistory = this.cloneForStorage(state?.simulationHistory ?? []);
            this.expandedSimulationZones = {};
            this.nextTokenBackIndex = state?.nextTokenBackIndex ?? 0;
            this.printOrderDraftCards = [];
            this.selectedPrintOrderSlotIndex = null;
            this.printOrderModalOpen = false;
            this.restorePrintOrderIndexes(state?.printOrderIndexes ?? []);
            this.hydrateStoredCards(this.cards).catch(error => {
                console.warn('Failed to hydrate restored cards.', error);
            });

            await this.$nextTick();
            this.restoringSession = false;
        },
        async initLocalSessions() {
            if (!this.localAppEnabled || !(await this.localSessionStorage.isEnabled())) {
                return;
            }

            this.isLoadingSessions = true;
            this.isLoadingSessionList = true;
            try {
                this.localSessions = await this.localSessionStorage.listSessions();
                this.isLoadingSessionList = false;
                if (this.localSessions.length > 0) {
                    await this.loadLocalSession(this.localSessions[0].id);
                    await this.refreshMetaDeckStates();
                    return;
                }

                await this.createLocalSession();
            } finally {
                this.isLoadingSessions = false;
                this.isLoadingSessionList = false;
            }
        },
        async createLocalSession() {
            if (!this.localAppEnabled) {
                return;
            }

            await this.flushPendingSessionSave();
            const name = `Session ${this.localSessions.length + 1}`;
            await this.restoreSessionState(null);
            const session = await this.localSessionStorage.createSession(name, this.captureSessionState());
            this.activeSessionId = session.id;
            this.activeSessionName = session.name;
            this.activeSessionIsMetaDeck = Boolean(session.isMetaDeck);
            this.localSessions = await this.localSessionStorage.listSessions();
            await this.refreshMetaDeckStates();
        },
        async loadLocalSession(id) {
            if (!this.localAppEnabled) {
                return;
            }

            await this.flushPendingSessionSave();
            this.isLoadingSessionState = true;
            try {
                const session = await this.localSessionStorage.loadSession(id);
                this.restoringSession = true;
                this.activeSessionId = session.id;
                this.activeSessionName = session.name;
                this.activeSessionIsMetaDeck = Boolean(session.isMetaDeck);
                await this.restoreSessionState(session.state);
                await this.refreshMetaDeckStates();
            } finally {
                this.isLoadingSessionState = false;
            }
        },
        async refreshMetaDeckStates() {
            if (!this.localAppEnabled) {
                return;
            }

            this.isLoadingSessions = true;
            this.isLoadingMetaDecks = true;
            try {
                const metaSessions = this.localSessions.filter(session => session.isMetaDeck);
                this.metaDeckStates = await Promise.all(
                    metaSessions.map(session => this.localSessionStorage.loadSession(session.id)),
                );
                for (const session of this.metaDeckStates) {
                    this.hydrateStoredCards(session.state?.cards ?? []).catch(error => {
                        console.warn(`Failed to hydrate meta deck ${session.name}.`, error);
                    });
                }
            } finally {
                this.isLoadingSessions = false;
                this.isLoadingMetaDecks = false;
            }
        },
        async flushPendingSessionSave() {
            if (!this.sessionSaveTimer) {
                return;
            }

            clearTimeout(this.sessionSaveTimer);
            this.sessionSaveTimer = null;
            await this.saveActiveSession();
        },
        scheduleSessionSave() {
            if (
                import.meta.env.MODE === 'test' ||
                !this.localAppEnabled ||
                !this.activeSessionId ||
                this.restoringSession
            ) {
                return;
            }

            clearTimeout(this.sessionSaveTimer);
            this.sessionSaveTimer = setTimeout(() => {
                this.sessionSaveTimer = null;
                this.saveActiveSession();
            }, 350);
        },
        async saveActiveSession() {
            if (!this.localAppEnabled || !this.activeSessionId || this.restoringSession) {
                return;
            }

            const session = await this.localSessionStorage.saveSession({
                id: this.activeSessionId,
                name: this.activeSessionName || 'Untitled Session',
                isMetaDeck: this.activeSessionIsMetaDeck,
                state: this.captureSessionState(),
            });

            this.localSessions = this.localSessions.map(localSession => {
                return localSession.id === session.id
                    ? {
                        id: session.id,
                        name: session.name,
                        isMetaDeck: Boolean(session.isMetaDeck),
                        updatedAt: session.updatedAt,
                    }
                    : localSession;
            });
            await this.refreshMetaDeckStates();
        },
        buildPrintOrderPreviewPages(indexedSlots) {
            const toPreviewPages = (slots, isBack, pageSize = null) => {
                const buildSlot = (slot, pageStart, offset) => {
                    if (!slot) {
                        return {
                            key: `empty-${isBack ? 'back' : 'front'}-${pageStart}-${offset}`,
                            index: null,
                            card: null,
                            face: "front",
                        };
                    }

                    return {
                        key: `slot-${isBack ? 'back' : 'front'}-${slot.index}-${pageStart}-${offset}`,
                        index: slot.index,
                        card: slot.card,
                        face: slot.face,
                    };
                };

                if (pageSize && Number.isInteger(pageSize) && pageSize > 0) {
                    const pages = [];
                    for (let i = 0; i < slots.length; i += pageSize) {
                        const pageSlots = slots.slice(i, i + pageSize).map((slot, offset) => buildSlot(slot, i, offset));
                        while (pageSlots.length < pageSize) {
                            pageSlots.push(buildSlot(null, i, pageSlots.length));
                        }
                        pages.push({ slots: pageSlots, isBack });
                    }
                    return pages.length ? pages : [];
                }

                if (this.config.fixedPageSize) {
                    const pages = [];
                    for (let i = 0; i < slots.length; i += 9) {
                        const pageSlots = slots.slice(i, i + 9).map((slot, offset) => buildSlot(slot, i, offset));
                        while (pageSlots.length < 9) {
                            pageSlots.push(buildSlot(null, i, pageSlots.length));
                        }
                        pages.push({ slots: pageSlots, isBack });
                    }
                    return pages.length ? pages : [];
                }

                return [{
                    slots: slots.map((slot, offset) => buildSlot(slot, 0, offset)),
                    isBack,
                }];
            };

            if (this.config.cardBacks === "none") {
                const slots = indexedSlots.map(slot => {
                    return { ...slot, face: "front" };
                });

                return toPreviewPages(slots, false);
            }

            if (this.config.cardBacks === "all-pages") {
                const pairedSlots = this.config.tokenBackMode === "opposite"
                    ? this.buildChosenPreviewGamePieceSlots(indexedSlots)
                    : {
                        frontSlots: indexedSlots.map(slot => ({ ...slot, face: "front" })),
                        backSlots: indexedSlots.map(slot => ({ ...slot, face: "back" })),
                    };
                const pageSize = this.config.fixedPageSize ? 9 : (this.config.cardsPerPage ?? null);
                const frontPages = toPreviewPages(pairedSlots.frontSlots, false, pageSize);
                const backPages = toPreviewPages(pairedSlots.backSlots, true, pageSize);
                const pages = [];

                for (let i = 0; i < Math.max(frontPages.length, backPages.length); i += 1) {
                    if (frontPages[i]) {
                        pages.push(frontPages[i]);
                    }
                    if (backPages[i]) {
                        pages.push(backPages[i]);
                    }
                }

                return pages;
            }

            const slots = [];
            for (const slot of indexedSlots) {
                slots.push({ ...slot, face: "front" });

                if (this.shouldShowCard(slot.card, "back")) {
                    slots.push({ ...slot, face: "back" });
                }
            }

            return toPreviewPages(slots, false);
        },
        getPrintPageSize() {
            if (this.config.fixedPageSize) {
                return 9;
            }

            return Number.isInteger(this.config.cardsPerPage) && this.config.cardsPerPage > 0
                ? this.config.cardsPerPage
                : 9;
        },
        isGamePieceCard(card) {
            return Boolean(card.selectedOption?.isGamePiece);
        },
        gamePieceKey(card) {
            return [
                card.name,
                card.selectedOption?.setCode,
                card.selectedOption?.collectorNumber,
            ].join("|");
        },
        buildOppositeGamePieceSlots(cards) {
            if (this.config.tokenPlacementMode === 'chosen') {
                return this.buildChosenGamePieceSlots(cards);
            }

            return this.buildPairedGamePieceSlots(cards);
        },
        buildChosenGamePieceSlots(cards) {
            const pairs = [];

            for (let i = 0; i < cards.length; i += 2) {
                pairs.push({
                    front: { card: cards[i], face: "front" },
                    back: cards[i + 1] ? { card: cards[i + 1], face: "back" } : null,
                });
            }

            return this.pairsToSlots(pairs);
        },
        buildChosenPreviewGamePieceSlots(indexedSlots) {
            const frontSlots = [];
            const backSlots = [];

            for (let i = 0; i < indexedSlots.length; i += 2) {
                frontSlots.push({ ...indexedSlots[i], face: "front" });
                backSlots.push(indexedSlots[i + 1] ? { ...indexedSlots[i + 1], face: "back" } : null);
            }

            return {
                frontSlots,
                backSlots,
            };
        },
        pairsToSlots(pairs) {
            return {
                frontSlots: pairs.map(pair => pair.front),
                backSlots: pairs.map(pair => pair.back),
            };
        },
        isCustomPrintOrderCurrent(baseSlots) {
            return this.isPrintOrderCurrent(this.customPrintOrderCards, baseSlots);
        },
        isPrintOrderCurrent(orderCards, baseSlots) {
            if (orderCards.length !== baseSlots.length || baseSlots.length === 0) {
                return false;
            }

            const remainingSlots = [...baseSlots];
            return orderCards.every(card => {
                const index = remainingSlots.indexOf(card);
                if (index === -1) {
                    return false;
                }

                remainingSlots.splice(index, 1);
                return true;
            });
        },
        ensureCustomPrintOrder() {
            if (!this.isCustomPrintOrderCurrent(this.printSlotsFrontBase)) {
                this.customPrintOrderCards = [...this.printSlotsFrontBase];
            }
        },
        openPrintOrderModal() {
            this.ensureCustomPrintOrder();
            this.printOrderDraftCards = [...this.printSlotsFront];
            this.selectedPrintOrderSlotIndex = null;
            this.printOrderModalOpen = true;
        },
        closePrintOrderModal() {
            this.selectedPrintOrderSlotIndex = null;
            this.printOrderDraftCards = [];
            this.printOrderModalOpen = false;
        },
        resetPrintOrder() {
            this.customPrintOrderCards = [];
            this.printOrderDraftCards = this.printOrderModalOpen ? [...this.printSlotsFrontBase] : [];
            this.selectedPrintOrderSlotIndex = null;
        },
        applyPrintOrder() {
            if (this.isPrintOrderCurrent(this.printOrderDraftCards, this.printSlotsFrontBase)) {
                this.customPrintOrderCards = [...this.printOrderDraftCards];
                this.config.tokenPlacementMode = 'chosen';
            }

            this.closePrintOrderModal();
        },
        selectPrintOrderSlot(slotIndex) {
            if (slotIndex === null) {
                return;
            }

            if (!this.isPrintOrderCurrent(this.printOrderDraftCards, this.printSlotsFrontBase)) {
                this.printOrderDraftCards = [...this.printSlotsFront];
            }

            if (this.selectedPrintOrderSlotIndex === null) {
                this.selectedPrintOrderSlotIndex = slotIndex;
                return;
            }

            if (this.selectedPrintOrderSlotIndex === slotIndex) {
                this.selectedPrintOrderSlotIndex = null;
                return;
            }

            const selectedCard = this.printOrderDraftCards[this.selectedPrintOrderSlotIndex];
            this.printOrderDraftCards[this.selectedPrintOrderSlotIndex] = this.printOrderDraftCards[slotIndex];
            this.printOrderDraftCards[slotIndex] = selectedCard;
            this.selectedPrintOrderSlotIndex = null;
        },
        buildPairedGamePieceSlots(cards) {
            const normalCards = [];
            const gamePieces = [];

            for (const card of cards) {
                if (this.isGamePieceCard(card)) {
                    gamePieces.push(card);
                } else {
                    normalCards.push(card);
                }
            }

            const pairs = normalCards.map(card => {
                return {
                    front: { card, face: "front" },
                    back: { card, face: "back" },
                };
            });

            const groups = new Map();
            for (const card of gamePieces) {
                const key = this.gamePieceKey(card);
                groups.set(key, groups.get(key) ?? []);
                groups.get(key).push(card);
            }

            while (groups.size > 0) {
                const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
                    return b[1].length - a[1].length;
                });
                const [frontKey, frontGroup] = sortedGroups[0];
                const front = frontGroup.shift();
                if (frontGroup.length === 0) {
                    groups.delete(frontKey);
                }

                const backEntry = Array.from(groups.entries())
                    .sort((a, b) => b[1].length - a[1].length)
                    .find(([backKey]) => backKey !== frontKey);
                let back = null;

                if (backEntry) {
                    const [backKey, backGroup] = backEntry;
                    back = backGroup.shift();
                    if (backGroup.length === 0) {
                        groups.delete(backKey);
                    }
                }

                pairs.push({
                    front: { card: front, face: "front" },
                    back: back ? { card: back, face: "front" } : null,
                });
            }

            return this.pairsToSlots(pairs);
        },
        async loadSetList() {
            const dataset = await this.getScryfallDataset();
            console.log(`Loaded ${Object.keys(dataset.cards).length} distinct cards from ${Object.keys(dataset.sets).length} sets.`);
        },
        datasetSetOption(option) {
            return {
                name: `${this.sets[option.setCode] ?? option.setCode?.toUpperCase() ?? 'Unknown'} (${option.collectorNumber})`,
                setCode: option.setCode,
                collectorNumber: option.collectorNumber,
                urlFront: option.urlFront,
                urlBack: option.urlBack,
                isDigital: option.isDigital,
                isPromo: option.isPromo,
                isToken: option.isToken,
                isGamePiece: option.isGamePiece,
                typeLine: option.typeLine,
                oracleText: option.oracleText,
                manaCost: option.manaCost,
                manaValue: option.manaValue,
                power: option.power,
                toughness: option.toughness,
                analysisCharacteristics: cardAnalysisCharacteristics(option),
                relatedTokens: option.relatedTokens,
                relatedGamePieces: option.relatedGamePieces,
            };
        },
        mergeDefinedOptionFields(baseOption, savedOption = {}) {
            const merged = { ...baseOption };
            for (const [key, value] of Object.entries(savedOption)) {
                if (value !== undefined && value !== null) {
                    merged[key] = value;
                }
            }

            return merged;
        },
        hydrateCardFromLookup(card, cardLookup, fallbackOption = null) {
            const setOptions = cardLookup.map(option => this.datasetSetOption(option));
            card.setOptions = setOptions;

            if (!card.selectedOption && fallbackOption) {
                card.selectedOption = fallbackOption(setOptions);
            }

            if (!card.selectedOption) {
                card.selectedOption = setOptions[0];
                return;
            }

            const matchedOption = setOptions.find(option => {
                return option.setCode === card.selectedOption.setCode &&
                    String(option.collectorNumber) === String(card.selectedOption.collectorNumber);
            }) ?? setOptions[0];

            card.selectedOption = this.mergeDefinedOptionFields(matchedOption, card.selectedOption);
        },
        async hydrateStoredCards(cards = []) {
            if (cards.length === 0) {
                return;
            }

            const dataset = await this.getScryfallDataset();
            this.sets = Object.keys(this.sets).length > 0 ? this.sets : dataset.sets;

            for (const card of cards) {
                this.setCardFlag('hydratingCardIds', card, true);
                const cardLookup = dataset.cards?.[card.name];
                if (!cardLookup) {
                    this.setCardFlag('hydratingCardIds', card, false);
                    continue;
                }

                this.hydrateCardFromLookup(card, cardLookup);
                this.setCardFlag('hydratingCardIds', card, false);
                await this.yieldToUi();
            }

            this.scheduleAnalysisRefresh();
        },
        initConfig() {
            this.config.includeDigital = bindStorage('includeDigital', (v) => v === "true");
            this.config.includePromo = bindStorage('includePromo', (v) => v === "true");
            this.config.matchEditions = bindStorage('matchEditions', (v) => v === "true");
            this.config.includeBasics = bindStorage('includeBasics', (v) => v === "true");
            this.config.includeCards = bindStorage('includeCards', (v) => v !== "false");
            this.config.includeGamePieces = bindStorage('includeGamePieces', (v) => v !== "false");
            this.config.showCutLines = bindStorage('showCutLines', (v) => v === "true");
            this.config.fixedPageSize = bindStorage('fixedPageSize', (v) => v === "true");
            this.config.imageType = bindStorage('imageType', (v) => v ?? "border_crop");
            this.config.scale = bindStorage('scale', (v) => v ?? "normal");
            this.config.cardBacks = bindStorage('cardBacks', (v) => v ?? "dfc");
            this.config.tokenBackMode = bindStorage('tokenBackMode', (v) => v ?? "opposite");
            this.config.tokenPlacementMode = bindStorage('tokenPlacementMode', (v) => v ?? "auto");
            this.config.analysisMode = bindStorage('analysisMode', (v) => v === "true");
            this.config.analysisView = bindStorage('analysisView', (v) => v ?? "interaction");
            this.config.analysisMetric = bindStorage('analysisMetric', (v) => v ?? "count");
            this.config.analysisColumnMode = bindStorage('analysisColumnMode', (v) => v ?? "metaDeck");
            this.config.analysisMatchupSessionId = bindStorage('analysisMatchupSessionId', (v) => v ?? "all");
            this.config.activeWorkspaceTab = bindStorage('activeWorkspaceTab', (v) => v ?? "cards");
            this.config.simulationMatchupSessionId = bindStorage('simulationMatchupSessionId', (v) => v ?? "");
            this.config.simulationPlayerCount = bindStorage('simulationPlayerCount', (v) => {
                const count = Number(v);
                return Number.isFinite(count) && count >= 2 ? count : 2;
            });
            this.config.simulationPlayerRoles = createDefaultConfig().simulationPlayerRoles;
            this.config.simulationShowOpponentHands = bindStorage('simulationShowOpponentHands', (v) => v === "true");
            this.config.simulationSeed = bindStorage('simulationSeed', (v) => {
                const seed = Number(v);
                return Number.isFinite(seed) && seed > 0 ? seed : 1;
            });
            this.config.simulationSpeed = bindStorage('simulationSpeed', (v) => v ?? "normal");
            this.config.simulationStepIndex = 0;
            this.config.simulationTurnCount = bindStorage('simulationTurnCount', (v) => {
                const count = Number(v);
                return Number.isFinite(count) && count > 0 ? count : 2;
            });
            this.config.simulationBoardZoom = bindStorage('simulationBoardZoom', (v) => {
                const zoom = Number(v);
                return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
            });
            this.config.comboPieceConfigOpen = bindStorage('comboPieceConfigOpen', (v) => v === "true");
            this.config.comboPieceTypes.token = bindStorage('comboPieceToken', (v) => v !== "false");
            this.config.comboPieceTypes.emblem = bindStorage('comboPieceEmblem', (v) => v !== "false");
            this.config.comboPieceTypes.tracker = bindStorage('comboPieceTracker', (v) => v !== "false");
            this.config.comboPieceTypes.mechanicHelper = bindStorage('comboPieceMechanicHelper', (v) => v !== "false");
            this.config.comboPieceTypes.dungeon = bindStorage('comboPieceDungeon', (v) => v !== "false");
            this.config.comboPieceTypes.initiative = bindStorage('comboPieceInitiative', (v) => v !== "false");
            this.config.comboPieceTypes.ring = bindStorage('comboPieceRing', (v) => v !== "false");
            this.config.comboPieceTypes.realCard = bindStorage('comboPieceRealCard', (v) => v === "true");
        },
        formatRelatedGamePieceLine(gamePiece) {
            return `${gamePiece.displayName ?? gamePiece.name} [${gamePiece.setCode}] ${gamePiece.collectorNumber}`;
        },
        getExistingDecklistNames() {
            return new Set(parseDecklist(this.config.decklist).lines.map(line => line.name));
        },
        getMissingRelatedGamePieces() {
            const existingNames = this.getExistingDecklistNames();
            const addedNames = new Set();
            const missingGamePieces = [];

            for (const card of this.cards) {
                for (const gamePiece of card.selectedOption?.relatedGamePieces ?? []) {
                    if (!this.config.comboPieceTypes[gamePiece.category]) {
                        continue;
                    }

                    if (existingNames.has(gamePiece.name) || addedNames.has(gamePiece.name)) {
                        continue;
                    }

                    missingGamePieces.push(gamePiece);
                    addedNames.add(gamePiece.name);
                }
            }

            return missingGamePieces;
        },
        async generateRelatedComboPieces() {
            if (this.cards.length === 0 && this.config.decklist.trim()) {
                await this.loadCardList();
            }

            const missingGamePieces = this.getMissingRelatedGamePieces();
            if (missingGamePieces.length > 0) {
                const additions = missingGamePieces.map(piece => this.formatRelatedGamePieceLine(piece));
                this.config.decklist = [
                    this.config.decklist.trimEnd(),
                    additions.join("\n"),
                ].filter(Boolean).join("\n");
            }

            await this.loadCardList();
        },
        shouldShowSetOption(card, option) {
            // FIXME: Need a better filter method to detect promo-only garbage.
            // This initial clause here is to tackle promo-only or if the user has a promo selected.
            if (card.setOptions.length <= 1 || card.selectedOption == option) {
                return true;
            }

            return (
                (this.config.includeDigital || !option.isDigital) &&
                (this.config.includePromo || !option.isPromo)
            );
        },
        shouldShowCard(card, face = "front") {
            if (!this.config.includeBasics && card.isBasic) {
                return false;
            }

            if (card.selectedOption?.isGamePiece) {
                if (!this.config.includeGamePieces) {
                    return false;
                }
            } else if (!this.config.includeCards) {
                return false;
            }

            if (face === "back") {
              if (this.config.cardBacks === "all" || this.config.cardBacks === "all-pages" || this.config.cardBacks === "token-pairs") {
                return true;
              }

                if (
                    this.config.cardBacks === "none" ||
                    card.selectedOption?.urlBack === undefined
                ) {
                    return false;
                }
            }

            return true;
        },
        resolveCardImage(card, face = "front") {
            if (!card.selectedOption?.urlFront) {
                return `/card_back_${this.config.imageType}.jpg`;
            }

            if (face == "front") {
                return setImageVersion(
                    card.selectedOption.urlFront,
                    this.config.imageType,
                );
            } else {
              // If all-pages + token opposite mode, use the token's front as the back image
              if (
                this.config.cardBacks === "all-pages" &&
                this.config.tokenBackMode === "opposite" &&
                card.selectedOption.isGamePiece
              ) {
                return setImageVersion(
                  card.selectedOption.urlFront,
                  this.config.imageType,
                );
              }

              if (
                this.config.cardBacks === "token-pairs" &&
                card.selectedOption.isGamePiece &&
                card.tokenBackUrl
              ) {
                return setImageVersion(
                  card.tokenBackUrl,
                  this.config.imageType,
                );
              }

              if (card.selectedOption.urlBack !== undefined) {
                return setImageVersion(
                  card.selectedOption.urlBack,
                  this.config.imageType,
                );
              } else {
                console.warn(`No urlBack for ${card.name}, using default back image`);
                return `/card_back_${this.config.imageType}.jpg`;
              }
            }
        },

          getTokenPairBackUrl(frontUrl, cardName) {
            if (!this.tokenPool || !this.tokenPool.length) return undefined;

            const pool = this.tokenPool.filter((t) => t.urlBack !== frontUrl && t.name !== cardName);
            if (!pool.length) return undefined;

            const idx = this.nextTokenBackIndex % pool.length;
            this.nextTokenBackIndex += 1;
            return pool[idx].urlBack;
          },
        updateSessionSet(cardName, setOption, cardIndex) {
            const deckIndex = this.cards.filter((v, i) => { return v.name === cardName && i <= cardIndex; }).length - 1;
            this.sessionSetSelections[cardName] = this.sessionSetSelections[cardName] ?? {};
            this.sessionSetSelections[cardName][deckIndex] = setOption;
        },
        printList() {
            window.print();
        },
        buildCardShell(line, deckIndex) {
            const selectedOption = this.sessionSetSelections[line.name]?.[deckIndex] ?? null;
            return {
                quantity: line.quantity,
                name: line.name,
                setOptions: [],
                isBasic: basicLands.includes(line.name.toLowerCase()),
                isSideboard: Boolean(line.isSideboard),
                requestedSet: line.set,
                requestedCollectorNumber: line.collectorsNumber,
                selectedOption,
                selectedFromSession: Boolean(selectedOption),
                isHydrating: true,
                hydrationError: false,
                deckIndex,
            };
        },
        defaultSelectionForLine(line, setOptions) {
            if (this.config.matchEditions) {
                const exactMatch = setOptions.find(option => {
                    return option.setCode === line.set && option.collectorNumber == line.collectorsNumber;
                });
                if (exactMatch) {
                    return exactMatch;
                }
            }

            if (line.set) {
                const gamePieceMatch = setOptions.find(option => {
                    return option.isGamePiece &&
                        option.setCode === line.set &&
                        (!line.collectorsNumber || option.collectorNumber == line.collectorsNumber);
                });
                if (gamePieceMatch) {
                    return gamePieceMatch;
                }
            }

            return setOptions.find(option => {
                return !option.isDigital && !option.isPromo && !option.isGamePiece;
            }) ?? setOptions[0];
        },
        async hydrateDeckCardsFromDataset(cards, lines, dataset, loadGeneration) {
            const resolvedCards = [];
            const unresolvedCards = [];

            for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
                if (loadGeneration !== this.cardLoadGeneration) {
                    return;
                }

                const card = cards[cardIndex];
                const line = lines[cardIndex];
                this.setCardFlag('hydratingCardIds', card, true);

                const cardLookup = dataset.cards[line.name];
                if (!cardLookup) {
                    card.hydrationError = true;
                    unresolvedCards.push(card);
                    this.errors.push(line.name);
                    console.warn(
                        `Failed to identify card on line: ${JSON.stringify(line)}`,
                    );
                    this.setCardFlag('hydratingCardIds', card, false);
                    await this.yieldToUi();
                    continue;
                }

                this.hydrateCardFromLookup(card, cardLookup, setOptions => {
                    return this.defaultSelectionForLine(line, setOptions);
                });
                card.isHydrating = false;
                this.setCardFlag('hydratingCardIds', card, false);
                resolvedCards.push(card);
                await this.yieldToUi();
            }

            if (loadGeneration !== this.cardLoadGeneration) {
                return;
            }

            this.applySessionRelatedTokenSelections(resolvedCards);

            if (this.config.cardBacks === 'token-pairs') {
                for (const card of resolvedCards) {
                    if (card.selectedOption && card.selectedOption.isGamePiece) {
                        card.tokenBackUrl = this.getTokenPairBackUrl(card.selectedOption.urlFront, card.name);
                    }
                }
            }

            this.cards = resolvedCards;
            for (const card of unresolvedCards) {
                this.setCardFlag('hydratingCardIds', card, false);
            }
            this.scheduleAnalysisRefresh();
        },
        async loadCardList() {
            const loadGeneration = ++this.cardLoadGeneration;
            this.isLoadingCards = true;
            this.isLoadingDeckList = true;
            this.isHydratingCards = false;
            this.hydratingCardIds = {};
            this.analysisRowsByCardId = {};
            this.valueAnalysisByCardId = {};
            this.analysisLoadingCardIds = {};
            try {
                this.cards = [];
                this.errors = [];
                this.resetPrintOrder();

                const { lines, errors } = parseDecklist(this.config.decklist);
                this.errors = errors;
                const lineOccurrences = {};
                const cardShells = lines.map(line => {
                    const deckIndex = lineOccurrences[line.name] ?? 0;
                    lineOccurrences[line.name] = deckIndex + 1;
                    const shell = this.buildCardShell(line, deckIndex);
                    this.cardRuntimeKey(shell);
                    this.setCardFlag('hydratingCardIds', shell, true);
                    return shell;
                });

                this.cards = cardShells;
                this.isLoadingDeckList = false;
                await this.$nextTick();
                await this.yieldToUi();

                if (loadGeneration !== this.cardLoadGeneration) {
                    return;
                }

                this.isHydratingCards = cardShells.length > 0;
                const dataset = await this.getScryfallDataset();
                await this.hydrateDeckCardsFromDataset(cardShells, lines, dataset, loadGeneration);
            } finally {
                if (loadGeneration === this.cardLoadGeneration) {
                    this.isLoadingDeckList = false;
                    this.isHydratingCards = false;
                    this.isLoadingCards = false;
                }
            }
        },
        applySessionRelatedTokenSelections(cards) {
            const relatedTokens = cards
                .filter(card => !card.selectedOption?.isGamePiece)
                .flatMap(card => card.selectedOption?.relatedTokens ?? []);

            for (const card of cards) {
                if (!card.selectedOption?.isGamePiece || card.selectedFromSession) {
                    continue;
                }

                if (card.requestedSet && card.requestedCollectorNumber) {
                    continue;
                }

                const relatedToken = relatedTokens.find(token => {
                    return token.name === card.name &&
                        (!card.requestedSet || token.setCode === card.requestedSet) &&
                        (!card.requestedCollectorNumber || token.collectorNumber == card.requestedCollectorNumber);
                });

                if (!relatedToken) {
                    continue;
                }

                const selectedOption = card.setOptions.find(option => {
                    return option.isGamePiece &&
                        option.setCode === (card.requestedSet ?? relatedToken.setCode) &&
                        option.collectorNumber == (card.requestedCollectorNumber ?? relatedToken.collectorNumber);
                });

                card.selectedOption = selectedOption ?? card.selectedOption;
            }
        },
    },
};
</script>

<style lang="scss">
#deck-input {
    height: 14rem;
}

.app-layout {
    display: grid;
    gap: 0.9rem;
    grid-template-columns: minmax(13rem, 15%) minmax(0, 85%);
}

.app-layout-sidebar-collapsed {
    grid-template-columns: 2.4rem minmax(0, 1fr);
}

.app-sidebar {
    position: sticky;
    top: 0.6rem;
    z-index: 320;
}

.app-main {
    min-width: 0;
}

.loading-surface {
    position: relative;

    &.loading::after {
        background: rgb(255 255 255 / 70%);
        border: 1px solid #dadee4;
        border-radius: 4px;
        content: "";
        inset: 0;
        min-height: 2.2rem;
        position: absolute;
        z-index: 500;
    }

    &.loading::before {
        animation: loading-spinner-rotate 0.75s linear infinite;
        border: 2px solid rgb(87 85 217 / 20%);
        border-radius: 999px;
        border-top-color: #5755d9;
        content: "";
        height: 1rem;
        left: calc(50% - 0.5rem);
        position: absolute;
        top: calc(50% - 0.5rem);
        width: 1rem;
        z-index: 501;
    }
}

@keyframes loading-spinner-rotate {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 600px) {
    #deck-input {
        height: 10rem;
    }
}

#config {
    top: 0.6rem;
}

#local-session-menu {
    min-width: 0;
}

.local-session-menu-body {
    border: 1px solid #dadee4;
    border-radius: 4px;
    margin-top: 0.4rem;
    padding: 0.4rem;
}

.local-session-list {
    margin-top: 0.4rem;
    max-height: 18rem;
    overflow-y: auto;
}

.local-session-item {
    display: block;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;

    &.active {
        background: #f1f1fc;
        color: #5755d9;
        font-weight: 600;
    }
}

.workspace-tabs {
    display: inline-flex;
    gap: 0.25rem;
    margin-bottom: 0.6rem;

    .btn.active {
        background: #5755d9;
        border-color: #5755d9;
        color: #fff;
    }
}

.game-simulation {
    display: grid;
    gap: 0.75rem;
}

.simulation-toolbar {
    align-items: end;
    background: #f8f9fa;
    border: 1px solid #dadee4;
    border-radius: 4px;
    display: grid;
    gap: 0.5rem;
    grid-template-columns: minmax(11rem, 1fr) repeat(5, minmax(4.4rem, 6rem)) minmax(7.5rem, auto) auto;
    padding: 0.55rem;
}

.simulation-control {
    margin: 0;
}

.simulation-control-compact {
    min-width: 0;
}

.simulation-reroll {
    white-space: nowrap;
}

.simulation-switch {
    margin-bottom: 0.25rem;
}

.simulation-player-settings {
    display: grid;
    gap: 0.35rem;
    grid-column: 1 / -1;
    grid-template-columns: repeat(auto-fit, minmax(5.6rem, 1fr));
}

.simulation-player-role-label {
    margin: 0;
}

.simulation-empty {
    margin-top: 0;
}

.simulation-phase-bar {
    align-items: center;
    background: #fff;
    border: 1px solid #d0d5dd;
    border-radius: 4px;
    display: grid;
    gap: 0.45rem;
    grid-template-columns: minmax(8rem, auto) minmax(0, 1fr) auto;
    padding: 0.4rem 0.5rem;
}

.simulation-current-step {
    color: #101828;
    font-size: 0.78rem;
    font-weight: 800;
}

.simulation-current-actions {
    color: #475467;
    font-size: 0.68rem;
    font-weight: 700;
}

.simulation-next-step {
    white-space: nowrap;
}

.simulation-targeting-banner {
    background: #fff7ed;
    border: 1px solid #fd853a;
    border-radius: 4px;
    color: #9c2a10;
    font-size: 0.72rem;
    font-weight: 800;
    padding: 0.35rem 0.5rem;
}

.simulation-action-menu {
    background: #fff;
    border: 1px solid #d0d5dd;
    border-radius: 6px;
    box-shadow: 0 1rem 2.5rem rgb(16 24 40 / 24%);
    display: grid;
    gap: 0.35rem;
    left: 50%;
    min-width: 13rem;
    padding: 0.55rem;
    position: fixed;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 2300;
}

.simulation-action-menu-title {
    color: #101828;
    font-size: 0.78rem;
    font-weight: 800;
}

.simulation-action-choice {
    text-align: left;
}

.simulation-action-close {
    height: auto;
    justify-self: start;
    padding: 0;
}

.simulation-board {
    display: grid;
    gap: 0.75rem;
}

.simulation-board-viewport {
    background: #f2f4f7;
    border: 1px solid #dadee4;
    border-radius: 4px;
    max-width: 100%;
    min-height: min(64vh, 34rem);
    overflow: auto;
    padding: 0.45rem;
}

.simulation-board-area {
    --simulation-card-width: 4.6rem;
    --simulation-zone-card-width: 2.5rem;

    align-items: stretch;
    display: flex;
    gap: 0.5rem;
    min-width: min(100%, 44rem);
    transition: transform 0.15s ease;
    width: max-content;
}

.simulation-board-area-two-player {
    --simulation-card-width: clamp(3.85rem, 5.35vw, 5.2rem);
    --simulation-zone-card-width: clamp(2rem, 2.7vw, 2.45rem);

    min-width: 0;
    width: 100%;
}

.simulation-player-lane {
    display: grid;
    gap: 0.28rem;
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
    min-width: min(44rem, 76vw);
}

.simulation-board-area-two-player .simulation-player-lane {
    min-width: 0;
    width: 100%;
}

.simulation-player-board {
    background: #fff;
    border: 1px solid #d0d5dd;
    border-radius: 4px;
    display: grid;
    gap: 0.32rem;
    grid-template-areas:
        "header"
        "hand"
        "battlefield";
    grid-template-rows: auto minmax(0, auto) minmax(0, 1fr);
    min-height: 12.4rem;
    min-width: 0;
    padding: 0.36rem;
}

.simulation-player-board-bottom {
    grid-template-areas:
        "battlefield"
        "hand"
        "header";
    grid-template-rows: minmax(0, 1fr) minmax(0, auto) auto;
}

.simulation-player-header {
    align-items: center;
    display: grid;
    font-size: 0.68rem;
    font-weight: 800;
    gap: 0.35rem;
    grid-area: header;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    line-height: 1;

    .label {
        justify-self: end;
    }
}

.simulation-life-total {
    align-items: center;
    background: #101828;
    border: 2px solid #101828;
    border-radius: 999px;
    color: #fff;
    cursor: default;
    display: inline-flex;
    font-size: 0.78rem;
    font-weight: 900;
    height: 1.7rem;
    justify-content: center;
    line-height: 1;
    min-width: 1.7rem;
    padding: 0 0.34rem;
}

.simulation-life-total-targetable {
    background: #fff7ed;
    border-color: #f97316;
    box-shadow: 0 0 0 4px rgb(249 115 22 / 22%);
    color: #9a3412;
    cursor: pointer;
}

.simulation-hand {
    border: 1px solid #dadee4;
    border-radius: 4px;
    min-width: 0;
    padding: 0.55rem;
}

.simulation-zone-stacks {
    align-items: end;
    display: flex;
    gap: 0.2rem;
}

.simulation-zone-stacks-top {
    .simulation-zone-stack-library {
        order: 3;
    }

    .simulation-zone-stack-graveyard {
        order: 1;
    }

    .simulation-zone-stack-exile {
        order: 2;
    }
}

.simulation-zone-stack {
    align-items: center;
    background: #fff;
    border: 1px solid #dadee4;
    border-radius: 4px;
    color: #344054;
    display: grid;
    font-size: 0.62rem;
    font-weight: 700;
    gap: 0.08rem;
    justify-items: center;
    min-height: calc(var(--simulation-zone-card-width) * 1.4 + 1rem);
    padding: 0.14rem;
    width: calc(var(--simulation-zone-card-width) + 0.58rem);
}

.simulation-zone-stack-empty {
    background: repeating-linear-gradient(
        135deg,
        #fff,
        #fff 0.38rem,
        #f2f4f7 0.38rem,
        #f2f4f7 0.76rem
    );
    border-style: dashed;
}

.simulation-zone-image {
    aspect-ratio: 63 / 88;
    border-radius: 3px;
    object-fit: cover;
    width: var(--simulation-zone-card-width);
}

.simulation-zone-empty-card {
    align-items: center;
    aspect-ratio: 63 / 88;
    background:
        linear-gradient(135deg, rgb(255 255 255 / 0%) 45%, #e4e7ec 45%, #e4e7ec 55%, rgb(255 255 255 / 0%) 55%),
        #f8f9fa;
    border: 1px dashed #98a2b3;
    border-radius: 3px;
    display: flex;
    justify-content: center;
    width: var(--simulation-zone-card-width);
}

.simulation-zone-count {
    background: #344054;
    border-radius: 999px;
    color: #fff;
    font-size: 0.56rem;
    line-height: 1;
    min-width: 1.1rem;
    padding: 0.13rem 0.24rem;
    text-align: center;
}

.simulation-zone-image-exile {
    transform: rotate(90deg);
}

.simulation-zone-drawer {
    background: #fff;
    border: 1px solid #dadee4;
    border-radius: 4px;
    padding: 0.4rem;
}

.simulation-mini-card-grid,
.simulation-hand-card-row,
.simulation-permanent-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.22rem;
}

.simulation-hand-card-row,
.simulation-permanent-row {
    align-content: flex-start;
    min-height: calc(var(--simulation-card-width) * 1.397);
}

.simulation-mini-card {
    align-items: center;
    display: grid;
    font-size: 0.62rem;
    gap: 0.18rem;
    grid-template-columns: 2.2rem minmax(0, 1fr);
}

.simulation-mini-card-image {
    aspect-ratio: 63 / 88;
    border-radius: 3px;
    object-fit: cover;
    width: 2.2rem;
}

.simulation-zone-empty {
    color: #667085;
    font-size: 0.68rem;
}

.simulation-section-title {
    color: #475467;
    font-size: 0.75rem;
    font-weight: 700;
    margin-bottom: 0.35rem;
}

.simulation-hand-zone {
    background: #fcfcfd;
    border: 1px solid #e4e7ec;
    border-radius: 4px;
    padding: 0.24rem;
}

.simulation-hand-and-stacks {
    align-items: stretch;
    display: grid;
    gap: 0.28rem;
    grid-area: hand;
    grid-template-columns: minmax(0, 1fr) auto;
}

.simulation-player-board-top {
    .simulation-hand-and-stacks {
        grid-template-columns: minmax(0, 1fr) auto;
    }
}

.simulation-player-board-bottom {
    .simulation-hand-and-stacks {
        grid-template-columns: minmax(0, 1fr) auto;
    }
}

.simulation-hand-card,
.simulation-permanent-card {
    aspect-ratio: 63 / 88;
    border-radius: 4px;
    position: relative;
    width: var(--simulation-card-width);
}

.simulation-board-area-two-player {
    .simulation-hand-card + .simulation-hand-card,
    .simulation-permanent-card + .simulation-permanent-card {
        margin-left: calc(var(--simulation-card-width) * -0.25);
    }

    .simulation-hand-card:hover,
    .simulation-permanent-card:hover {
        z-index: 3;
    }
}

.simulation-hand-card-virtual {
    outline: 2px solid #7a5af8;
    outline-offset: 1px;
}

.simulation-card-source-graveyard {
    outline-color: #7a5af8;
}

.simulation-card-source-exile {
    outline-color: #f04438;
}

.simulation-card-actionable {
    box-shadow:
        0 0 0 2px #1570ef,
        0 0 0 5px rgb(21 112 239 / 22%);
    cursor: pointer;
    z-index: 2;
}

.simulation-card-targetable {
    box-shadow:
        0 0 0 2px #f97316,
        0 0 0 5px rgb(249 115 22 / 28%);
    cursor: pointer;
    z-index: 4;
}

.simulation-hand-card-image,
.simulation-permanent-image {
    aspect-ratio: 63 / 88;
    border-radius: 4px;
    object-fit: cover;
    width: 100%;
}

.simulation-card-count,
.simulation-source-zone,
.simulation-state-badge {
    border-radius: 999px;
    color: #fff;
    font-size: 0.56rem;
    font-weight: 800;
    line-height: 1;
    padding: 0.14rem 0.22rem;
    position: absolute;
}

.simulation-card-count {
    background: #5755d9;
    left: 0.18rem;
    top: 0.18rem;
}

.simulation-source-zone {
    background: #b54708;
    bottom: 0.18rem;
    left: 0.18rem;
    text-transform: uppercase;
}

.simulation-card-source-graveyard .simulation-source-zone {
    background: #5925dc;
}

.simulation-card-source-exile .simulation-source-zone {
    background: #b42318;
}

.simulation-state-badge {
    background: #027a48;
    bottom: 0.18rem;
    right: 0.18rem;
}

.simulation-state-badge-attack {
    background: #b54708;
}

.simulation-battlefield-zone {
    background: #fcfcfd;
    border: 1px dashed #d0d5dd;
    border-radius: 4px;
    display: grid;
    gap: 0.28rem;
    grid-area: battlefield;
    grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.44fr) minmax(0, 0.78fr);
    min-height: calc(var(--simulation-card-width) * 1.397 + 0.6rem);
    padding: 0.24rem;
}

.simulation-battlefield-row {
    min-height: calc(var(--simulation-card-width) * 1.397 + 0.52rem);
    min-width: 0;
}

.simulation-battlefield-column-center .simulation-permanent-row {
    justify-content: center;
}

.simulation-battlefield-column-right .simulation-permanent-row {
    justify-content: flex-end;
}

.simulation-card-list {
    display: grid;
    gap: 0.2rem;
}

.simulation-card-line {
    align-items: center;
    background: #fff;
    border: 1px solid #eef0f3;
    border-radius: 4px;
    display: grid;
    font-size: 0.72rem;
    gap: 0.35rem;
    grid-template-columns: 2.2rem minmax(0, 1fr) minmax(4rem, auto);
    line-height: 1.2;
    min-height: 1.55rem;
    padding: 0.22rem 0.35rem;
}

.simulation-quantity {
    color: #5755d9;
    font-weight: 700;
}

.simulation-card-meta {
    color: #667085;
    font-size: 0.65rem;
    overflow: hidden;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.simulation-timeline {
    display: grid;
    gap: 0.4rem;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
}

.simulation-step {
    border: 1px solid #dadee4;
    border-radius: 4px;
    display: grid;
    font-size: 0.68rem;
    gap: 0.18rem;
    line-height: 1.2;
    min-height: 4.1rem;
    padding: 0.45rem;
}

.simulation-step-you {
    background: #eef4ff;
    border-color: #84adff;
}

.simulation-step-opponent {
    background: #fff7ed;
    border-color: #fed7aa;
}

.simulation-step-header {
    color: #344054;
    font-weight: 800;
}

.simulation-step-line {
    color: #101828;
    overflow-wrap: anywhere;
}

.simulation-step-note {
    color: #667085;
}

.simulation-log-panel,
.simulation-history {
    border: 1px solid #dadee4;
    border-radius: 4px;
    padding: 0.5rem;
}

.simulation-history {
    display: grid;
    gap: 0.3rem;
}

.simulation-history-entry {
    background: #f8f9fa;
    border: 1px solid #eef0f3;
    border-radius: 4px;
    font-size: 0.68rem;
    padding: 0.3rem 0.4rem;
}

@media (max-width: 720px) {
    .simulation-toolbar {
        grid-template-columns: minmax(0, 1fr);
    }

    .simulation-phase-bar {
        grid-template-columns: minmax(0, 1fr);
    }

    .simulation-reroll {
        width: 100%;
    }
}

.analysis-card-list {
    display: grid;
    gap: 0.7rem;
}

.analysis-card-row {
    align-items: flex-start;
    border: 1px solid #dadee4;
    border-radius: 4px;
    display: grid;
    gap: 0.7rem;
    grid-template-columns: minmax(13rem, 16rem) minmax(0, 1fr);
    padding: 0.6rem;
}

.analysis-card-preview {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: minmax(0, 1fr);
}

.analysis-card-image {
    border-radius: 4px;
    max-height: 21rem;
    object-fit: contain;
    width: 100%;
}

.analysis-card-name {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    font-weight: 600;
}

.analysis-card-stat-loader {
    display: inline-flex;
    flex: 0 0 auto;
    height: 0.8rem;
    width: 0.8rem;
}

.analysis-grid-loading-cell {
    color: #667085;
    height: 1.5rem;
    text-align: center !important;
}

.analysis-grid-wrap {
    min-width: 0;
}

.analysis-grid {
    table-layout: fixed;
    width: 100%;
}

.analysis-grid th,
.analysis-grid td {
    font-size: 0.65rem;
    line-height: 1.05;
    padding: 0.18rem 0.22rem;
    text-align: center;
    white-space: normal;
    word-break: break-word;
}

.analysis-grid th:first-child,
.analysis-grid td:first-child {
    text-align: left;
    width: 5.5rem;
}

.analysis-column-toggle {
    align-items: center;
    color: inherit;
    display: inline-flex;
    flex-direction: column;
    gap: 0.08rem;
    height: auto;
    line-height: 1.05;
    padding: 0;
    text-decoration: none;
    white-space: normal;
}

.analysis-column-title {
    font-weight: 600;
}

.analysis-column-summary {
    color: #667085;
    font-size: 0.58rem;
    font-weight: 500;
}

.analysis-grid th.analysis-column-collapsed,
.analysis-grid td.analysis-column-collapsed {
    width: 2.6rem;
}

.analysis-grid td.analysis-column-collapsed {
    background: #f8f9fa;
}

.analysis-cell-active {
    background: #f1f1fc;
    color: #5755d9;
    font-weight: 600;
}

.value-view {
    display: grid;
    gap: 0.45rem;
}

.value-analysis-loading {
    align-items: center;
    background: #f8f9fa;
    border: 1px solid #eef0f3;
    border-radius: 4px;
    display: flex;
    min-height: 2.2rem;
    padding: 0.4rem;
}

.value-cast {
    display: block;
}

.value-meta-removal-options {
    display: grid;
    gap: 0.22rem;
}

.value-meta-removal {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-radius: 5px;
    overflow: hidden;
}

.value-meta-removal-toggle {
    align-items: center;
    color: #7c2d12;
    display: grid;
    font-size: 0.62rem;
    font-weight: 700;
    grid-template-columns: minmax(5.6rem, 1fr) repeat(2, minmax(4.6rem, auto));
    height: auto;
    line-height: 1.15;
    padding: 0.28rem 0.36rem;
    text-align: left;
    text-decoration: none;
    width: 100%;
}

.value-meta-removal-deck {
    color: #431407;
}

.value-meta-removal-targets {
    border-top: 1px solid #fed7aa;
    display: grid;
    gap: 0.18rem;
    padding: 0.28rem 0.36rem;
}

.value-meta-removal-target {
    display: grid;
    font-size: 0.6rem;
    gap: 0.08rem;
    grid-template-columns: minmax(5.5rem, 1fr) minmax(7rem, 1.4fr) minmax(5rem, 1fr);
    line-height: 1.15;
}

.value-meta-removal-target-name {
    font-weight: 700;
}

.value-meta-removal-target-detail {
    color: #7c2d12;
}

.value-meta-removal-protection {
    color: #475467;
}

.value-death-options,
.value-creature-options,
.value-mana-options,
.value-zone-options,
.value-activated-options {
    display: grid;
    gap: 0.28rem;
    margin-top: 0.1rem;
}

.value-line {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
}

.value-line-header {
    color: #475467;
    font-size: 0.68rem;
    font-weight: 700;
}

.value-rows {
    display: grid;
    gap: 0.22rem;
}

.value-row {
    align-items: stretch;
    border-radius: 5px;
    display: grid;
    font-size: 0.62rem;
    grid-template-columns: minmax(4.6rem, 1.15fr) minmax(3.3rem, 0.7fr) minmax(5.4rem, 1.4fr) minmax(3.2rem, 0.65fr);
    line-height: 1.2;
    overflow: hidden;
}

.value-row-base {
    background: #eef4ff;
    border: 1px solid #84adff;
    color: #194185;
    font-size: 0.66rem;
    max-width: 100%;
    min-height: 2.2rem;
}

.value-row-bonus {
    background: #ecfdf3;
    border: 1px solid #75e0a7;
    color: #067647;
    max-width: 94%;
}

.value-row-etb {
    background: #fefce8;
    border: 1px solid #fde68a;
    color: #854d0e;
    max-width: 92%;
}

.value-row-permanent {
    background: #f4f3ff;
    border: 1px solid #bdb4fe;
    color: #5925dc;
    max-width: 92%;
}

.value-row-zone {
    background: #fff6ed;
    border: 1px solid #f7b27a;
    color: #9c2a10;
    max-width: 94%;
}

.value-row-death {
    background: #fff1f2;
    border: 1px solid #fda4af;
    color: #9f1239;
    max-width: 94%;
}

.value-row-creature {
    background: #f0fdf4;
    border: 1px solid #86efac;
    color: #166534;
    max-width: 94%;
}

.value-row-activated {
    background: #ecfeff;
    border: 1px solid #67e8f9;
    color: #155e75;
    max-width: 94%;
}

.value-row-mana {
    background: #ecfdf3;
    border: 1px solid #75e0a7;
    color: #047857;
    max-width: 92%;
}

.value-row-cell {
    align-items: center;
    border-left: 1px solid rgb(255 255 255 / 70%);
    display: flex;
    min-width: 0;
    overflow-wrap: anywhere;
    padding: 0.25rem 0.32rem;
}

.value-row-cell:first-child {
    border-left: 0;
}

.value-row-condition {
    align-items: flex-start;
    flex-direction: column;
    font-weight: 700;
}

.value-row-cost {
    font-weight: 700;
    gap: 0.18rem;
}

.mana-symbol {
    font-size: 0.92rem;
}

.value-row-effect {
    font-weight: 600;
    gap: 0.2rem;
}

.value-row-state {
    font-weight: 700;
    justify-content: center;
}

.value-row-source {
    color: currentColor;
    font-size: 0.56rem;
    font-weight: 600;
    opacity: 0.76;
}

.value-speed {
    color: currentColor;
    font-size: 0.78rem;
    opacity: 0.74;
}

.value-mana-chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.24rem;
    max-width: 100%;
}

.value-mana-chip {
    align-items: center;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    color: #334155;
    display: inline-flex;
    font-size: 0.58rem;
    font-weight: 700;
    gap: 0.16rem;
    line-height: 1;
    max-width: 100%;
    min-height: 1.25rem;
    padding: 0.16rem 0.34rem;
}

.value-mana-chip-payment {
    background: #ecfdf3;
    border-color: #75e0a7;
    color: #047857;
}

.value-mana-chip-land-payment {
    background: #f7fee7;
    border-color: #a3e635;
    color: #3f6212;
}

.value-mana-symbol-groups {
    align-items: center;
    display: inline-flex;
    gap: 0.08rem;
}

.value-mana-choice-separator {
    font-size: 0.62rem;
    font-weight: 900;
    opacity: 0.68;
    padding: 0 0.02rem;
}

.value-mana-effect-label,
.value-mana-restriction {
    opacity: 0.82;
}

.value-mana-restriction {
    font-size: 0.56rem;
}

.value-mana-source {
    max-width: 5.8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.value-mana-quantity,
.value-mana-arrow {
    opacity: 0.74;
}

@media (max-width: 960px) {
    .app-layout,
    .app-layout-sidebar-collapsed {
        grid-template-columns: minmax(0, 1fr);
    }

    .app-sidebar {
        position: static;
    }

    .analysis-card-row {
        grid-template-columns: minmax(0, 1fr);
    }
}

html.dark-theme {
    .local-session-menu-body {
        border-color: #667085;
    }

    .analysis-card-row {
        border-color: #667085;
    }

    .analysis-cell-active {
        background: #303742;
    }

    .loading-surface.loading::after {
        background: rgb(48 55 66 / 75%);
        border-color: #667085;
    }

    .local-session-item.active {
        background: #303742;
    }
}

#slot-usage {
    border-collapse: collapse;
    height: 0.3rem;

    .bar-item {
        border: 1px solid #bcc3ce;
        border-collapse: collapse;
        width: 11.1%;

        &.consumed {
            background: #5755d9;
        }

        &.unconsumed {
            background: #eef0f3;
        }
    }
}

html.dark-theme {
    #slot-usage .bar-item {
        border: 1px solid #707274;

        &.unconsumed {
            background: #303742;
        }
    }
}

.card-quantity {
    font-size: 1.2rem;
    font-weight: 100;
    display: inline-block;
    position: absolute;
    bottom: 2.4rem;
    left: 0.6rem;
    padding: 0.2rem;
    line-height: 1rem;
}

.card-hover-preview {
    align-items: center;
    background: rgb(16 24 40 / 46%);
    display: flex;
    inset: 0;
    justify-content: center;
    padding: clamp(0.75rem, 3vw, 2rem);
    pointer-events: none;
    position: fixed;
    z-index: 2200;
}

.card-hover-preview-image {
    aspect-ratio: 63 / 88;
    background: #111827;
    border-radius: 8px;
    box-shadow: 0 1.1rem 3rem rgb(16 24 40 / 38%);
    max-height: min(88vh, 42rem);
    object-fit: contain;
    width: min(92vw, 30rem);
}

.print-order-modal-container {
    max-width: 58rem;
}

.print-order-page + .print-order-page {
    margin-top: 1rem;
}

.print-order-grid {
    display: grid;
    gap: 0.35rem;
}

.print-order-grid-backs {
    direction: rtl;
}

.print-order-slot {
    aspect-ratio: 63 / 88;
    background: #eef0f3;
    border: 2px solid #bcc3ce;
    border-radius: 4px;
    cursor: pointer;
    line-height: 0;
    overflow: hidden;
    padding: 0;
    position: relative;

    &:disabled {
        cursor: default;
        opacity: 0.45;
    }
}

.print-order-slot-selected {
    border-color: #5755d9;
    box-shadow: 0 0 0 3px rgba(87, 85, 217, 0.24);
}

.print-order-image {
    display: block;
    height: 100%;
    object-fit: cover;
    width: 100%;
}

.print-order-index {
    background: rgba(48, 55, 66, 0.84);
    border-radius: 2px;
    color: #fff;
    font-size: 0.65rem;
    left: 0.25rem;
    line-height: 1;
    padding: 0.18rem 0.24rem;
    position: absolute;
    top: 0.25rem;
}

html.dark-theme {
    .print-order-slot {
        background: #303742;
        border-color: #667085;
    }
}

#arnold {
    margin-top: 2.4em;
}

#input-errors ul li {
    margin-top: unset;
}

#print-content {
    display: none;
    line-height: 0;
    --card-width: 60mm;
    --card-height: 85mm;
}

#print-content img,
#print-content .print-slot {
    width: var(--card-width);
    height: var(--card-height);
    margin: 0;
    padding: 0;
    break-inside: avoid;
}

#print-content .print-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
}

#print-content .print-grid-backs {
    direction: rtl;
}

@media print {
    body {
        all: initial;
    }

    html,
    html * {
        all: unset;
        font-size: 0 !important;
        line-height: 0 !important;
    }

    .section,
    header {
        display: none !important;
    }

    body {
        margin: 0 !important;
    }

    @page {
        size: auto;
        margin-left: 1cm;
        margin-right: 1cm;
        margin-bottom: 5mm;
        margin-top: 10mm;
    }

    html {
        visibility: hidden;
    }

    #print-content {
        visibility: visible;
        display: block !important;
        line-height: 0;
    }

    #print-content.scale-large {
        --card-width: calc(60mm * 1.02);
        --card-height: calc(85mm * 1.02);
    }

    #print-content.scale-small {
        --card-width: calc(60mm * 0.98);
        --card-height: calc(85mm * 0.98);
    }

    #print-content.scale-actual {
        --card-width: 63mm;
        --card-height: 88mm;
    }

    #print-content.with-cut-lines .print-grid {
        gap: 1px;
    }

    .print-page {
        width: 100%;
        display: flex;
        justify-content: center;
    }

    .print-page + .print-page {
        break-before: page;
    }
}
</style>
