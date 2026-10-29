<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  PIECE_COLORS,
  canPlace,
  getPieceCells,
  createGame,
  reducer,
  type GameAction,
  type GameState,
  type PieceType,
} from './game'

const game = ref<GameState>(createGame())
const best = ref(0)
const boardCells = computed(() => {
  const cells: (PieceType | 'ghost' | null)[][] = game.value.board.map((row) => [...row])
  if (game.value.active) {
    const ghost = { ...game.value.active }
    while (canMoveDown(ghost)) ghost.y += 1
    for (const [localX, localY] of getPieceCells(ghost)) {
      const x = ghost.x + localX
      const y = ghost.y + localY
      if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH && !cells[y][x]) cells[y][x] = 'ghost'
    }
    for (const [localX, localY] of getPieceCells(game.value.active)) {
      const x = game.value.active.x + localX
      const y = game.value.active.y + localY
      if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) cells[y][x] = game.value.active.type
    }
  }
  return cells.flat()
})
const nextPiece = computed(() => game.value.queue[0])
const nextCells = computed(() => nextPiece.value ? getPieceCells({ type: nextPiece.value, rotation: 0 }) : [])
const holdCells = computed(() => game.value.hold ? getPieceCells({ type: game.value.hold, rotation: 0 }) : [])
const bestLabel = computed(() => String(best.value).padStart(6, '0'))
let gravityTimer: number | undefined

function canMoveDown(piece: NonNullable<GameState['active']>) {
  return canPlace(game.value.board, { ...piece, y: piece.y + 1 })
}

function dispatch(action: GameAction) {
  game.value = reducer(game.value, action)
  if (game.value.score > best.value) {
    best.value = game.value.score
    try { localStorage.setItem('tetris-best', String(best.value)) } catch { /* Storage can be unavailable in private browsing. */ }
  }
}

function startOrResume() {
  if (game.value.status === 'over') game.value = createGame()
  dispatch({ type: 'start' })
}

function onKeydown(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  const actions: Record<string, GameAction['type']> = {
    arrowleft: 'left', arrowright: 'right', arrowdown: 'softDrop', ' ': 'hardDrop',
    z: 'rotate', arrowup: 'rotate', c: 'hold', escape: 'pause', r: 'restart',
  }
  const type = actions[key]
  if (!type) return
  event.preventDefault()
  if (type === 'restart') {
    game.value = createGame()
    dispatch({ type: 'start' })
  } else if (type === 'pause' && game.value.status === 'paused') {
    dispatch({ type: 'start' })
  } else if (game.value.status === 'ready' && type !== 'pause') {
    dispatch({ type: 'start' })
    dispatch({ type })
  } else dispatch({ type })
}

function control(type: GameAction['type']) {
  if (game.value.status === 'ready') dispatch({ type: 'start' })
  dispatch({ type })
}

function previewStyle(type: PieceType) {
  return { '--piece': PIECE_COLORS[type] }
}

onMounted(() => {
  try { best.value = Number(localStorage.getItem('tetris-best') || 0) } catch { best.value = 0 }
  window.addEventListener('keydown', onKeydown)
  const gravityTick = () => {
    dispatch({ type: 'tick' })
    gravityTimer = window.setTimeout(gravityTick, Math.max(100, 900 - (game.value.level - 1) * 75))
  }
  gravityTimer = window.setTimeout(gravityTick, 900)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (gravityTimer) window.clearTimeout(gravityTimer)
})
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <a class="wordmark" href="#" aria-label="Stack Shift home"><span class="mark">▦</span> STACK<span class="wordmark-light">SHIFT</span></a>
      <div class="top-meta"><span class="live-dot"></span> ARCADE MODE <span class="top-divider">/</span> 01 — CLASSIC</div>
      <a class="github-link" href="https://github.com/oscarmmi/tetris" target="_blank" rel="noreferrer">SOURCE ↗</a>
    </header>

    <section class="game-layout" aria-label="Tetris game">
      <aside class="side-column left-column">
        <div class="eyebrow">YOUR SESSION</div>
        <div class="score-card">
          <span class="card-label">SCORE</span>
          <strong class="score-number">{{ String(game.score).padStart(6, '0') }}</strong>
          <div class="score-rule"></div>
          <span class="card-label best-label">PERSONAL BEST</span>
          <span class="best-number">{{ bestLabel }}</span>
        </div>
        <div class="stat-row">
          <div class="stat-card"><span class="card-label">LINES</span><strong>{{ String(game.lines).padStart(2, '0') }}</strong></div>
          <div class="stat-card"><span class="card-label">LEVEL</span><strong>{{ String(game.level).padStart(2, '0') }}</strong></div>
        </div>
        <div class="queue-card">
          <div class="queue-heading"><span class="card-label">UP NEXT</span><span class="queue-index">01</span></div>
          <div class="mini-grid" aria-label="Next piece">
            <span v-for="cell in 16" :key="cell" class="mini-cell" :class="{ filled: nextCells.some(([x, y]) => y * 4 + x === cell - 1) }" :style="nextPiece ? previewStyle(nextPiece) : {}"></span>
          </div>
          <div class="queue-divider"></div>
          <div class="queue-heading hold-heading"><span class="card-label">HOLD</span><span class="queue-index">C</span></div>
          <div class="mini-grid hold-grid" aria-label="Held piece">
            <span v-for="cell in 16" :key="cell" class="mini-cell" :class="{ filled: holdCells.some(([x, y]) => y * 4 + x === cell - 1) }" :style="game.hold ? previewStyle(game.hold) : {}"></span>
          </div>
        </div>
      </aside>

      <div class="board-column">
        <div class="board-topline"><span><i class="tiny-square"></i> PLAYFIELD</span><span>10 × 20</span></div>
        <div class="board-frame">
          <div class="board" role="img" :aria-label="`Tetris board, ${game.status}`">
            <div v-for="(cell, index) in boardCells" :key="index" class="board-cell" :class="{ occupied: cell && cell !== 'ghost', ghost: cell === 'ghost' }" :style="cell && cell !== 'ghost' ? { '--piece': PIECE_COLORS[cell as PieceType] } : {}"></div>
          </div>
          <div v-if="game.status !== 'playing'" class="board-overlay" :class="{ 'overlay-dim': game.status === 'paused' }">
            <div class="overlay-content">
              <template v-if="game.status === 'ready'">
                <div class="overlay-kicker">READY WHEN YOU ARE</div><h1>STACK<br><em>YOUR</em> STORY.</h1>
                <p>One more line. One better run.</p>
                <button class="primary-button" @click="startOrResume">START GAME <span>→</span></button>
                <span class="overlay-hint">PRESS ANY KEY TO BEGIN</span>
              </template>
              <template v-else-if="game.status === 'paused'">
                <div class="pause-icon">Ⅱ</div><div class="overlay-kicker">TAKE YOUR TIME</div><h2>PAUSED</h2>
                <button class="primary-button" @click="dispatch({ type: 'start' })">RESUME <span>→</span></button>
              </template>
              <template v-else>
                <div class="overlay-kicker">RUN COMPLETE</div><h2>GAME<br><em>OVER.</em></h2>
                <p>That was a good run. Go again?</p>
                <button class="primary-button" @click="startOrResume">PLAY AGAIN <span>↻</span></button>
              </template>
            </div>
          </div>
        </div>
        <div class="board-footer"><span><i class="status-dot"></i> {{ game.status === 'playing' ? 'IN PLAY' : game.status.toUpperCase() }}</span><span>BUILT FOR THE NEXT MOVE</span></div>
      </div>

      <aside class="side-column right-column">
        <div class="eyebrow">HOW TO PLAY</div>
        <div class="controls-card">
          <div class="control-group"><span class="control-icon">↔</span><div><strong>MOVE</strong><small>ARROW KEYS</small></div><kbd>← →</kbd></div>
          <div class="control-group"><span class="control-icon">↻</span><div><strong>ROTATE</strong><small>TURN THE PIECE</small></div><kbd>Z / ↑</kbd></div>
          <div class="control-group"><span class="control-icon">↓</span><div><strong>SOFT DROP</strong><small>FASTER DOWN</small></div><kbd>↓</kbd></div>
          <div class="control-group"><span class="control-icon">⇊</span><div><strong>HARD DROP</strong><small>INSTANT LOCK</small></div><kbd>SPACE</kbd></div>
          <div class="control-group"><span class="control-icon">C</span><div><strong>HOLD</strong><small>ONCE PER PIECE</small><kbd>C</kbd></div></div>
          <div class="control-group"><span class="control-icon">Ⅱ</span><div><strong>PAUSE</strong><small>TAKE A BREATHER</small><kbd>ESC</kbd></div></div>
        </div>
        <div class="tip-card"><span class="tip-star">✳</span><div><strong>THE LONG GAME</strong><p>Every 10 lines, level up. The pieces fall faster. Keep your cool.</p></div></div>
      </aside>
    </section>

    <section class="touch-controls" aria-label="Touch game controls">
      <div class="touch-direction">
        <button aria-label="Move left" @click="control('left')">←</button>
        <button aria-label="Soft drop" @click="control('softDrop')">↓</button>
        <button aria-label="Move right" @click="control('right')">→</button>
      </div>
      <div class="touch-actions"><button aria-label="Rotate" @click="control('rotate')">↻</button><button class="drop-touch" aria-label="Hard drop" @click="control('hardDrop')">DROP</button><button aria-label="Hold piece" @click="control('hold')">HOLD</button></div>
    </section>

    <footer class="site-footer"><span>STACKSHIFT <span class="footer-muted">— A CLASSIC, RECOMPOSED.</span></span><button @click="game.status === 'paused' ? dispatch({ type: 'start' }) : game.status === 'playing' ? dispatch({ type: 'pause' }) : startOrResume()">{{ game.status === 'playing' ? 'PAUSE' : game.status === 'paused' ? 'RESUME' : 'NEW GAME' }} <b>↗</b></button><span class="footer-right">A LITTLE SPACE TO THINK.</span></footer>
  </main>
</template>
