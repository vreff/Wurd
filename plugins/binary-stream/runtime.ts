/**
 * Binary stream runtime — dark grid of 0s and 1s that light up
 * in the accent color when you mouse over them.
 * Uses Pretext's prepareWithSegments() for character width measurement.
 */
import { prepareWithSegments } from '@chenglou/pretext'

const FONT_FAMILY = 'Georgia, Palatino, "Times New Roman", serif'

interface StreamConfig {
  cols: number
  rows: number
  fontSize: number
  lineHeight: number
  opacity: number
  glowRadius: number   // radius in grid cells
  dimColor: string      // color of unlit characters
  litColor: string      // color of lit characters (default: accent)
}

const DEFAULTS: StreamConfig = {
  cols: 0,  // 0 = auto-fill container width
  rows: 9,
  fontSize: 13,
  lineHeight: 15,
  opacity: 1.0,
  glowRadius: 5,
  dimColor: 'rgba(255,255,255,0.08)',
  litColor: '#ffffff',
}

interface CellRef {
  span: HTMLSpanElement
  col: number
  row: number
}

interface InstanceState {
  config: StreamConfig
  cols: number
  rows: number
  cells: CellRef[]       // flat array of all cell spans
  cellWidth: number
  container: HTMLElement
  mouseX: number
  mouseY: number
  mouseIn: boolean
  animFrameId: number
  litColor: string
}

function parseConfig(el: HTMLElement): StreamConfig {
  const raw = el.dataset['config']
  if (!raw) return { ...DEFAULTS }
  try {
    const parsed = JSON.parse(atob(raw))
    return {
      cols: num(parsed['cols'], DEFAULTS.cols),
      rows: num(parsed['rows'], DEFAULTS.rows),
      fontSize: num(parsed['fontSize'], DEFAULTS.fontSize),
      lineHeight: num(parsed['lineHeight'], DEFAULTS.lineHeight),
      opacity: num(parsed['opacity'], DEFAULTS.opacity),
      glowRadius: num(parsed['glowRadius'], DEFAULTS.glowRadius),
      dimColor: typeof parsed['dimColor'] === 'string' ? parsed['dimColor'] : DEFAULTS.dimColor,
      litColor: typeof parsed['litColor'] === 'string' ? parsed['litColor'] : DEFAULTS.litColor,
    }
  } catch { return { ...DEFAULTS } }
}

function num(v: unknown, d: number): number {
  return typeof v === 'number' && isFinite(v) ? v : (typeof v === 'string' && isFinite(Number(v)) ? Number(v) : d)
}

function getAccentColor(): string {
  // Try to read accent color from CSS custom property or page meta
  const root = getComputedStyle(document.documentElement)
  const accent = root.getPropertyValue('--accent-color').trim()
  if (accent) return accent
  // Fallback: look for it in any styled element
  return '#7c6ee6'
}

function initInstance(container: HTMLElement): InstanceState {
  const config = parseConfig(container)
  const { rows, fontSize, lineHeight } = config

  // Measure a char width via Pretext
  const font = `400 ${fontSize}px ${FONT_FAMILY}`
  const p = prepareWithSegments('0', font)
  const cellWidth = p.widths.length > 0 ? p.widths[0]! : fontSize * 0.6

  const litColor = config.litColor || getAccentColor()

  // Build the grid as rows of spans
  const cells: CellRef[] = []
  container.innerHTML = ''

  // Auto-calculate cols: render a test span to get actual rendered char width
  let cols = config.cols
  const testRow = document.createElement('div')
  testRow.className = 'bs-row'
  testRow.style.height = `${lineHeight}px`
  testRow.style.lineHeight = `${lineHeight}px`
  testRow.style.fontSize = `${fontSize}px`
  const testSpan = document.createElement('span')
  testSpan.textContent = '0'
  testSpan.style.display = 'inline-block'
  testRow.appendChild(testSpan)
  container.appendChild(testRow)
  const actualCharWidth = testSpan.getBoundingClientRect().width
  const containerWidth = container.getBoundingClientRect().width
  container.removeChild(testRow)
  if (cols <= 0) {
    cols = Math.max(1, Math.floor(containerWidth / actualCharWidth))
  }
  const spanWidth = containerWidth / cols

  for (let r = 0; r < rows; r++) {
    const rowDiv = document.createElement('div')
    rowDiv.className = 'bs-row'
    rowDiv.style.height = `${lineHeight}px`
    rowDiv.style.lineHeight = `${lineHeight}px`
    rowDiv.style.fontSize = `${fontSize}px`

    for (let c = 0; c < cols; c++) {
      const span = document.createElement('span')
      span.textContent = Math.random() < 0.5 ? '0' : '1'
      span.style.color = config.dimColor
      span.style.display = 'inline-block'
      span.style.width = `${spanWidth}px`
      span.style.textAlign = 'center'
      rowDiv.appendChild(span)
      cells.push({ span, col: c, row: r })
    }
    container.appendChild(rowDiv)
  }

  return {
    config, cols, rows, cells, cellWidth,
    container,
    mouseX: -1000, mouseY: -1000,
    mouseIn: false,
    animFrameId: 0,
    litColor,
  }
}

// ─── Glow update ────────────────────────────────────────────

function updateGlow(st: InstanceState): void {
  const { config, cols, rows, cells, cellWidth, container, mouseX, mouseY, mouseIn, litColor } = st
  const { glowRadius, lineHeight, dimColor } = config

  if (!mouseIn) {
    // Mouse left — dim everything
    for (const cell of cells) {
      cell.span.style.color = dimColor
      cell.span.style.opacity = '1'
    }
    return
  }

  // Measure actual text grid origin from the first cell
  const firstCell = cells[0]
  if (!firstCell) return
  const firstRect = firstCell.span.getBoundingClientRect()
  const lastInRow = cells[cols - 1]
  if (!lastInRow) return
  const lastRect = lastInRow.span.getBoundingClientRect()
  const textLeft = firstRect.left
  const textWidth = lastRect.right - firstRect.left
  const renderedCellWidth = textWidth / cols
  const containerRect = container.getBoundingClientRect()
  const gridCol = (mouseX - textLeft) / renderedCellWidth
  const gridRow = (mouseY - containerRect.top) / lineHeight

  // Work in pixel space for a true circular glow
  const glowRadiusPx = glowRadius * lineHeight  // radius in pixels

  for (const cell of cells) {
    const cellPxX = (cell.col + 0.5) * renderedCellWidth
    const cellPxY = (cell.row + 0.5) * lineHeight
    const mousePxX = mouseX - textLeft
    const mousePxY = mouseY - containerRect.top
    const dx = cellPxX - mousePxX
    const dy = cellPxY - mousePxY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < glowRadiusPx) {
      const t = 1.0 - dist / glowRadiusPx
      const alpha = t * t * t  // cubic ease — brighter center
      // Interpolate between dim and lit
      if (alpha > 0.03) {
        cell.span.style.color = litColor
        cell.span.style.opacity = String(Math.max(0.15, alpha * 1.5))
      } else {
        cell.span.style.color = dimColor
        cell.span.style.opacity = '1'
      }
    } else {
      cell.span.style.color = dimColor
      cell.span.style.opacity = '1'
    }
  }
}

function onFrame(st: InstanceState): void {
  updateGlow(st)
  st.animFrameId = requestAnimationFrame(() => onFrame(st))
}

// ─── Stage reparenting ──────────────────────────────────────

function reparentToStage(container: HTMLElement): void {
  const stage = document.getElementById('pretext-stage')
  if (stage && container.parentElement !== stage) stage.appendChild(container)
}

// ─── Public init ────────────────────────────────────────────

const instances: InstanceState[] = []

export function init(): void {
  const containers = document.querySelectorAll<HTMLElement>('.binary-stream-container')
  for (const container of containers) {
    if (container.dataset['bsInit']) continue
    container.dataset['bsInit'] = '1'

    // Reparent to stage first so container has its final layout dimensions
    reparentToStage(container)

    const st = initInstance(container)
    instances.push(st)

    // Mouse tracking
    container.addEventListener('mousemove', (e) => {
      st.mouseX = e.clientX
      st.mouseY = e.clientY
      st.mouseIn = true
    })
    container.addEventListener('mouseleave', () => {
      st.mouseIn = false
    })

    st.animFrameId = requestAnimationFrame(() => onFrame(st))
  }


}
