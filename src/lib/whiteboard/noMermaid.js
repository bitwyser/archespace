/**
 * noMermaid.js - Stands in for @excalidraw/mermaid-to-excalidraw (aliased in
 * vite.config.js and the mobile build), whose Mermaid parser would add several
 * MB. Its menu entry is hidden (whiteboard.css); pasted Mermaid text that
 * reaches this falls back to plain text.
 */
export async function parseMermaidToExcalidraw() {
  throw new Error('Mermaid diagrams are not supported.')
}
