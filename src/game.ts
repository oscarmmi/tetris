export const BOARD_WIDTH = 10
export const BOARD_HEIGHT = 20

export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const
export type PieceType = (typeof PIECE_TYPES)[number]
export const PIECE_COLORS: Record<PieceType, string> = {
  I: '#53e5db', O: '#f4ca64', T: '#b68aff', S: '#82dc88', Z: '#ff777c', J: '#76a8ff', L: '#ffab70',
}
export type Cell = PieceType | null
export type Board = Cell[][]
export interface Piece { type: PieceType; rotation: number; x: number; y: number }
export type GameStatus = 'ready' | 'playing' | 'paused' | 'over'
export interface GameState {
  board: Board
  active: Piece | null
  queue: PieceType[]
  hold: PieceType | null
  holdUsed: boolean
  score: number
  lines: number
  level: number
  lockedPieces: number
  status: GameStatus
}
export type GameAction = { type: 'start' | 'pause' | 'restart' | 'left' | 'right' | 'softDrop' | 'hardDrop' | 'rotate' | 'hold' | 'tick' }

const SHAPES: Record<PieceType, number[][]> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
}

export function getPieceCells(piece: Pick<Piece, 'type' | 'rotation'>): number[][] {
  let points = SHAPES[piece.type].map(([x, y]) => [x, y])
  if (piece.type === 'O') return points
  for (let turn = 0; turn < piece.rotation % 4; turn++) {
    const height = Math.max(...points.map(([, y]) => y)) + 1
    points = points.map(([x, y]) => [height - 1 - y, x])
    const minX = Math.min(...points.map(([x]) => x))
    const minY = Math.min(...points.map(([, y]) => y))
    points = points.map(([x, y]) => [x - minX, y - minY])
  }
  return points
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array<Cell>(BOARD_WIDTH).fill(null))
}

export function createPiece(type: PieceType, rotation = 0, y = 0): Piece {
  const piece = { type, rotation: rotation % 4, x: 0, y }
  const width = Math.max(...getPieceCells(piece).map(([x]) => x)) + 1
  piece.x = Math.floor((BOARD_WIDTH - width) / 2)
  return piece
}

export function canPlace(board: Board, piece: Piece): boolean {
  return getPieceCells(piece).every(([x, y]) => {
    const boardX = piece.x + x
    const boardY = piece.y + y
    return boardX >= 0 && boardX < BOARD_WIDTH && boardY < BOARD_HEIGHT && (boardY < 0 || board[boardY][boardX] === null)
  })
}

export function clearFullLines(board: Board): { board: Board; cleared: number } {
  const remaining = board.filter((row) => row.some((cell) => cell === null))
  const cleared = BOARD_HEIGHT - remaining.length
  return { board: [...Array.from({ length: cleared }, () => Array<Cell>(BOARD_WIDTH).fill(null)), ...remaining], cleared }
}

function shuffledBag(random: () => number): PieceType[] {
  const bag = [...PIECE_TYPES]
  for (let index = bag.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[bag[index], bag[swap]] = [bag[swap], bag[index]]
  }
  return bag
}

function fillQueue(queue: PieceType[], random: () => number): PieceType[] {
  const next = [...queue]
  while (next.length < 7) next.push(...shuffledBag(random))
  return next
}

function spawn(type: PieceType): Piece { return createPiece(type) }

export function createGame(random: () => number = Math.random): GameState {
  const queue = fillQueue([], random)
  const [first, ...rest] = queue
  return { board: createEmptyBoard(), active: spawn(first), queue: rest, hold: null, holdUsed: false, score: 0, lines: 0, level: 1, lockedPieces: 0, status: 'ready' }
}

function moveDown(state: GameState, addPoint: boolean, random: () => number): GameState {
  if (!state.active) return state
  const moved = { ...state.active, y: state.active.y + 1 }
  if (canPlace(state.board, moved)) return { ...state, active: moved, score: state.score + (addPoint ? 1 : 0) }
  return lockActive(state, random)
}

function lockActive(state: GameState, random: () => number): GameState {
  if (!state.active) return state
  const board = state.board.map((row) => [...row])
  for (const [x, y] of getPieceCells(state.active)) {
    const boardX = state.active.x + x
    const boardY = state.active.y + y
    if (boardY < 0) return { ...state, status: 'over', active: null, lockedPieces: state.lockedPieces + 1 }
    board[boardY][boardX] = state.active.type
  }
  const result = clearFullLines(board)
  const lines = state.lines + result.cleared
  const level = Math.floor(lines / 10) + 1
  const scores = [0, 100, 300, 500, 800]
  const queue = fillQueue(state.queue, random)
  const [next, ...remaining] = queue
  const active = spawn(next)
  const canSpawn = canPlace(result.board, active)
  return {
    ...state, board: result.board, active: canSpawn ? active : null, queue: remaining, holdUsed: false,
    score: state.score + scores[result.cleared] * state.level, lines, level,
    lockedPieces: state.lockedPieces + 1, status: canSpawn ? state.status : 'over',
  }
}

export function reducer(state: GameState, action: GameAction, random: () => number = Math.random): GameState {
  if (action.type === 'restart') return createGame(random)
  if (action.type === 'start') return { ...state, status: 'playing' }
  if (action.type === 'pause') return state.status === 'playing' ? { ...state, status: 'paused' } : state
  if (state.status !== 'playing' || !state.active) return state

  if (action.type === 'left' || action.type === 'right') {
    const candidate = { ...state.active, x: state.active.x + (action.type === 'left' ? -1 : 1) }
    return canPlace(state.board, candidate) ? { ...state, active: candidate } : state
  }
  if (action.type === 'rotate') {
    const candidate = { ...state.active, rotation: (state.active.rotation + 1) % 4 }
    return canPlace(state.board, candidate) ? { ...state, active: candidate } : state
  }
  if (action.type === 'softDrop' || action.type === 'tick') return moveDown(state, action.type === 'softDrop', random)
  if (action.type === 'hardDrop') {
    let piece = state.active
    let distance = 0
    while (canPlace(state.board, { ...piece, y: piece.y + 1 })) { piece = { ...piece, y: piece.y + 1 }; distance++ }
    return lockActive({ ...state, active: piece, score: state.score + distance * 2 }, random)
  }
  if (action.type === 'hold' && !state.holdUsed) {
    const current = state.active.type
    const queue = state.hold ? state.queue : fillQueue(state.queue, random)
    const incoming = state.hold ?? queue[0]
    const active = spawn(incoming)
    const remaining = state.hold ? queue : queue.slice(1)
    return canPlace(state.board, active)
      ? { ...state, active, hold: current, holdUsed: true, queue: remaining }
      : { ...state, active: null, hold: current, holdUsed: true, queue: remaining, status: 'over' }
  }
  return state
}
