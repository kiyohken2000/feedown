// Chunk a list of paragraphs into batches of at most ~targetCharsPerChunk
// characters for Hy-MT2 chunked translation.
//
// Goals:
//   - Keep chunks small enough to leave headroom on A15 Metal working set
//     (~2500 chars EN ≈ ~600 input tokens, well under Hy-MT2's 32k ctx).
//   - Preserve paragraph boundaries — never split inside a paragraph if it
//     already fits. A chunk maps to >= 1 source paragraph.
//   - If a single paragraph is bigger than the target, split it on sentence
//     boundaries so we still emit reasonable chunks.
//   - Surface paragraph indices so progressive UI can show "paragraph N of M
//     translated" without recomputing offsets.

const SENTENCE_BOUNDARY = /(?<=[.!?。！？])\s+|(?<=[.!?。！？])(?=[^"'\)\s])/

function splitLongParagraph(paragraph, targetCharsPerChunk) {
  const sentences = paragraph.split(SENTENCE_BOUNDARY).filter(Boolean)
  if (sentences.length <= 1) {
    // No sentence boundary found — hard split on width. This is a last
    // resort for paragraphs that are one giant unpunctuated block (rare
    // in real articles).
    const pieces = []
    for (let i = 0; i < paragraph.length; i += targetCharsPerChunk) {
      pieces.push(paragraph.slice(i, i + targetCharsPerChunk))
    }
    return pieces
  }
  const pieces = []
  let buf = ''
  for (const s of sentences) {
    if (buf && buf.length + s.length > targetCharsPerChunk) {
      pieces.push(buf)
      buf = ''
    }
    buf = buf ? `${buf} ${s}` : s
  }
  if (buf) pieces.push(buf)
  return pieces
}

// Returns: Array<{ text: string, paragraphIndices: number[] }>
//   text:             concatenated paragraph(s) for this chunk
//   paragraphIndices: source paragraph indices (may be one index repeated
//                     across pieces when a paragraph was split)
export function splitParagraphsIntoChunks(paragraphs, targetCharsPerChunk = 2500) {
  const chunks = []
  let buf = []
  let bufIndices = []
  let bufLen = 0

  const flush = () => {
    if (buf.length === 0) return
    chunks.push({ text: buf.join('\n\n'), paragraphIndices: bufIndices.slice() })
    buf = []
    bufIndices = []
    bufLen = 0
  }

  paragraphs.forEach((p, i) => {
    if (p.length > targetCharsPerChunk) {
      flush()
      const pieces = splitLongParagraph(p, targetCharsPerChunk)
      for (const piece of pieces) {
        chunks.push({ text: piece, paragraphIndices: [i] })
      }
      return
    }
    if (bufLen + p.length > targetCharsPerChunk && buf.length > 0) {
      flush()
    }
    buf.push(p)
    bufIndices.push(i)
    bufLen += p.length + 2 // approximate for the '\n\n' join
  })
  flush()
  return chunks
}
