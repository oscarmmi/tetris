import { describe, expect, it } from 'vitest'
import { BOARD_HEIGHT, BOARD_WIDTH, canPlace, clearFullLines, createEmptyBoard, createGame, createPiece, getPieceCells, reducer, type GameState } from './game'

describe('Tetris rules', () => {
  it('clears a full line and drops the stack above it', () => {
    const board = createEmptyBoard()
    board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill('T')
    board[BOARD_HEIGHT - 2][0] = 'I'
    const { board: cleared, cleared: count } = clearFullLines(board)
    expect(count).toBe(1)
    expect(cleared[BOARD_HEIGHT - 1][0]).toBe('I')
    expect(cleared[0].every((cell) => cell === null)).toBe(true)
  })

  it('does not rotate into occupied cells', () => {
    const board = createEmptyBoard()
    const piece = { ...createPiece('T'), x: 4, y: 5 }
    const rotated = { ...piece, rotation: 1 }
    const rotatedCells = getPieceCells(rotated)
    const blockingCell = rotatedCells.find(([x, y]) => !getPieceCells(piece).some(([px, py]) => px === x && py === y))
    expect(blockingCell).toBeDefined()
    board[piece.y + blockingCell![1]][piece.x + blockingCell![0]] = 'O'
    expect(canPlace(board, piece)).toBe(true)
    expect(canPlace(board, rotated)).toBe(false)
    const state = { ...createGame(() => 0), status: 'playing' as const, board, active: piece }
    expect(reducer(state, { type: 'rotate' }).active).toEqual(piece)
  })

  it('locks at the floor and increments the locked-piece count', () => {
    let state: GameState = { ...createGame(() => 0), status: 'playing', active: createPiece('O', 0, BOARD_HEIGHT - 2) }
    state = reducer(state, { type: 'tick' }, () => 0)
    expect(state.lockedPieces).toBe(1)
    expect(state.board.flat().filter(Boolean)).toHaveLength(4)
    expect(state.active).not.toBeNull()
  })
})
