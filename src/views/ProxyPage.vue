<template>
  <div class="section">
    <HelpModal ref="helpModal" />

    <div class="columns">
      <div
        v-if="localAppEnabled"
        id="local-session-menu"
        class="column col-2 col-sm-12 mb-2"
        :class="{ 'local-session-menu-collapsed': !sessionsMenuOpen }"
      >
        <button
          id="toggle-session-menu"
          class="btn btn-block"
          @click="sessionsMenuOpen = !sessionsMenuOpen"
        >
          {{ sessionsMenuOpen ? 'Sessions' : 'Sessions >' }}
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
      <div class="column col-3 col-sm-12 mb-2" style="z-index: 300">
        <div id="config" class="form-group p-sticky">
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
                  <input type="number" min="1" max="36" class="form-input" v-model.number="config.cardsPerPage" style="width:100%" />
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

      <div
        class="column col-sm-12"
        :class="localAppEnabled ? 'col-7' : 'col-9'"
      >
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

        <div
          v-if="localAppEnabled && metaCreatureAnalyses.length"
          id="meta-analysis"
          class="meta-analysis"
        >
          <div class="h5">
            Meta Analysis
          </div>
          <div class="text-small text-gray mb-2">
            Counts are from the current deck against creatures in tagged meta sessions.
          </div>
          <div class="table-scroll">
            <table class="table table-striped">
              <thead>
                <tr>
                  <th>Meta creature</th>
                  <th>Deck</th>
                  <th>Instant kill</th>
                  <th>Sorcery kill</th>
                  <th>Both survive</th>
                  <th>Both die</th>
                  <th>Their creature survives</th>
                  <th>Our creature survives</th>
                  <th>Damage player</th>
                  <th>Synergy</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="analysis in metaCreatureAnalyses"
                  :key="`${analysis.sessionId}-${analysis.creature.name}-${analysis.index}`"
                >
                  <td>{{ analysis.creature.name }}</td>
                  <td>{{ analysis.sessionName }}</td>
                  <td>{{ analysis.counts.instantRemoval }}</td>
                  <td>{{ analysis.counts.sorceryRemoval }}</td>
                  <td>{{ analysis.counts.combat.bothSurvive }}</td>
                  <td>{{ analysis.counts.combat.bothDie }}</td>
                  <td>{{ analysis.counts.combat.defenderSurvives }}</td>
                  <td>{{ analysis.counts.combat.attackerSurvives }}</td>
                  <td>{{ analysis.counts.combat.damageOnPlayer }}</td>
                  <td>{{ analysis.counts.synergies }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="cards columns">
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
      </div>
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
    isCreatureCard,
    summarizeCreatureInteractions
} from "../helpers/DeckInteractionAnalyzer.mjs";
import { createSessionStorage } from "../helpers/SessionStorage.mjs";
import { bindStorage } from "../helpers/VueLocalStorage.mjs";
import ImageLoader from "../components/ImageLoader.vue";
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
            sessionsMenuOpen: true,
            localSessionStorage: createSessionStorage(),
            localSessions: [],
            activeSessionId: null,
            activeSessionName: '',
            activeSessionIsMetaDeck: false,
            metaDeckStates: [],
            sessionSaveTimer: null,
            restoringSession: false,
        };
    },
    watch: {
        config: {
            deep: true,
            handler() {
                this.scheduleSessionSave();
            },
        },
        cards: {
            deep: true,
            handler() {
                this.scheduleSessionSave();
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
    },
    async mounted() {
        // Trigger an immediate load of the card list + set names.
        this.loadSetList();
        this.initConfig();
        await this.initLocalSessions();
    },
    beforeUnmount() {
        clearTimeout(this.sessionSaveTimer);
    },
    methods: {
        cloneForStorage(value) {
            return JSON.parse(JSON.stringify(value));
        },
        countCards(cards) {
            return cards.reduce((total, card) => total + (card.quantity ?? 1), 0);
        },
        countInteractionSummary(summary) {
            return {
                instantRemoval: this.countCards(summary.instantRemoval),
                sorceryRemoval: this.countCards(summary.sorceryRemoval),
                combat: {
                    bothSurvive: this.countCards(summary.combat.bothSurvive),
                    bothDie: this.countCards(summary.combat.bothDie),
                    defenderSurvives: this.countCards(summary.combat.defenderSurvives),
                    attackerSurvives: this.countCards(summary.combat.attackerSurvives),
                    damageOnPlayer: this.countCards(summary.combat.damageOnPlayer),
                    unknown: this.countCards(summary.combat.unknown),
                },
                synergies: this.countCards(summary.synergies),
            };
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
            this.nextTokenBackIndex = state?.nextTokenBackIndex ?? 0;
            this.printOrderDraftCards = [];
            this.selectedPrintOrderSlotIndex = null;
            this.printOrderModalOpen = false;
            this.restorePrintOrderIndexes(state?.printOrderIndexes ?? []);

            await this.$nextTick();
            this.restoringSession = false;
        },
        async initLocalSessions() {
            if (!this.localAppEnabled || !(await this.localSessionStorage.isEnabled())) {
                return;
            }

            this.localSessions = await this.localSessionStorage.listSessions();
            if (this.localSessions.length > 0) {
                await this.loadLocalSession(this.localSessions[0].id);
                await this.refreshMetaDeckStates();
                return;
            }

            await this.createLocalSession();
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
            const session = await this.localSessionStorage.loadSession(id);
            this.restoringSession = true;
            this.activeSessionId = session.id;
            this.activeSessionName = session.name;
            this.activeSessionIsMetaDeck = Boolean(session.isMetaDeck);
            await this.restoreSessionState(session.state);
            await this.refreshMetaDeckStates();
        },
        async refreshMetaDeckStates() {
            if (!this.localAppEnabled) {
                return;
            }

            const metaSessions = this.localSessions.filter(session => session.isMetaDeck);
            this.metaDeckStates = await Promise.all(
                metaSessions.map(session => this.localSessionStorage.loadSession(session.id)),
            );
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
          const dataset = (await ScryfallDatasetAsync());
          this.sets = dataset.sets;
          console.log(`Loaded ${Object.keys(dataset.cards).length} distinct cards from ${Object.keys(dataset.sets).length} sets.`)
          // Build token pool for token-pairs mode
          this.tokenPool = Object.values(dataset.cards)
            .flat()
            .filter((c) => c.cardFaces && c.cardFaces.length === 1 && c.cardFaces[0].type_line && /token/i.test(c.cardFaces[0].type_line))
            .map((c) => ({
              name: c.name,
              urlBack: c.image_uris && c.image_uris.normal ? c.image_uris.normal : undefined,
            }))
            .filter((t) => t.urlBack);
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
                    card.selectedOption.urlBack === undefined
                ) {
                    return false;
                }
            }

            return true;
        },
        resolveCardImage(card, face = "front") {
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
        async loadCardList() {
            this.cards = [];
            this.errors = [];
            this.resetPrintOrder();

            const { lines, errors } = parseDecklist(this.config.decklist);
            this.errors = errors;
            const dataset = await ScryfallDatasetAsync();
            

            const _cards = [];

            for (let line of lines) {
                let cardLookup = dataset.cards[line.name];

                if (!cardLookup) {
                    this.errors.push(line.name);
                    console.warn(
                        `Failed to identify card on line: ${JSON.stringify(line)}`,
                    );
                    continue;
                }

                const cardIndex = _cards.filter((v) => { return v.name === line.name }).length;

                const options = {
                    quantity: line.quantity,
                    name: line.name,
                    setOptions: cardLookup.map((option) => {
                        // This could use spread syntax, but it's nice to have all the property names in this file explicitly.
                        return {
                            name: `${this.sets[option.setCode]} (${option.collectorNumber})`,
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
                            power: option.power,
                            toughness: option.toughness,
                            relatedTokens: option.relatedTokens,
                            relatedGamePieces: option.relatedGamePieces,
                        };
                    }),
                    isBasic: basicLands.includes(line.name.toLowerCase()),
                    requestedSet: line.set,
                    requestedCollectorNumber: line.collectorsNumber,
                    selectedOption: this.sessionSetSelections[line.name]?.[cardIndex],
                    selectedFromSession: Boolean(this.sessionSetSelections[line.name]?.[cardIndex]),
                };

                if (!options.selectedOption) {
                    // Set a default selection.
                    // First, if enabled, attempt to find an exact match from the decklist.
                    if (this.config.matchEditions) {
                        options.selectedOption = options.setOptions.filter(option => {
                            return option.setCode === line.set && option.collectorNumber == line.collectorsNumber
                        })?.[0] ?? undefined;
                    }

                    if (!options.selectedOption && line.set) {
                        options.selectedOption = options.setOptions.find(option => {
                            return option.isGamePiece &&
                                option.setCode === line.set &&
                                (!line.collectorsNumber || option.collectorNumber == line.collectorsNumber);
                        });
                    }

                    // If we failed there, then we can set a default based on characteristics.
                    if (!options.selectedOption) {
                        options.selectedOption = options.setOptions.filter(option => {
                            return !option.isDigital && !option.isPromo && !option.isGamePiece;
                        })?.[0] ?? options.setOptions[0];
                    }
                }

                _cards.push(options);
            }

            this.applySessionRelatedTokenSelections(_cards);

            this.cards = _cards;

            // attach tokenBackUrl when token-pairs mode is enabled
            if (this.config.cardBacks === 'token-pairs') {
              for (const c of this.cards) {
                if (c.selectedOption && c.selectedOption.isGamePiece) {
                  c.tokenBackUrl = this.getTokenPairBackUrl(c.selectedOption.urlFront, c.name);
                }
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

@media (max-width: 600px) {
    #deck-input {
        height: 10rem;
    }
}

#config {
    top: 0.6rem;
}

#local-session-menu {
    position: sticky;
    top: 0.6rem;
    z-index: 320;
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

.meta-analysis {
    border: 1px solid #dadee4;
    border-radius: 4px;
    margin-bottom: 0.8rem;
    padding: 0.6rem;
}

.table-scroll {
    overflow-x: auto;
}

html.dark-theme {
    .local-session-menu-body {
        border-color: #667085;
    }

    .meta-analysis {
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
