/**
 * Runtime entry point — bundled into the output HTML.
 * Initializes the Pretext layout engine.
 * Graphs and tables are now generated at compile time by LLM plugins.
 */
import { initPretextLayout } from './layout.js'

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

function init(): void {
  // Initialize Pretext-powered editorial layout
  initPretextLayout()
}
