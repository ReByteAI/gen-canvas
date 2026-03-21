import { EditorStore } from './core/EditorStore'
import { EditorCore } from './core/EditorCore'
import { PluginRegistry } from './core/PluginRegistry'
import { HistoryManager } from './core/HistoryManager'
import { IntentBus } from './core/IntentBus'
import { ScreenCardPlugin } from './core/plugins/ScreenCardPlugin'
import { PrototypeCardPlugin } from './core/plugins/PrototypeCardPlugin'
import { DocumentCardPlugin } from './core/plugins/DocumentCardPlugin'
import { KonvaAdapter } from './konva/KonvaAdapter'
import type { EditorRecords, RuntimeState } from './core/types'

const now = Date.now()

const SIGNUP_FORM_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: linear-gradient(160deg, #0f0c29, #302b63, #24243e);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: #e0e0e0;
  }
  .card {
    background: rgba(255,255,255,0.05);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 36px 32px;
    width: 100%;
    max-width: 380px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.5);
  }
  .logo {
    width: 40px; height: 40px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 12px;
    margin-bottom: 20px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; color: #fff; font-weight: 700;
  }
  h1 { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 4px; }
  .sub { font-size: 13px; color: #888; margin-bottom: 28px; }
  .row { display: flex; gap: 12px; }
  .row .field { flex: 1; }
  .field { margin-bottom: 18px; }
  label {
    display: block; font-size: 11px; font-weight: 600;
    color: #999; margin-bottom: 6px;
    text-transform: uppercase; letter-spacing: 0.8px;
  }
  input, select, textarea {
    width: 100%; padding: 11px 14px;
    background: rgba(255,255,255,0.06);
    border: 1.5px solid rgba(255,255,255,0.1);
    border-radius: 10px; font-size: 14px; color: #fff;
    outline: none; transition: border 0.2s, background 0.2s;
    font-family: inherit;
  }
  input::placeholder, textarea::placeholder { color: #666; }
  input:focus, select:focus, textarea:focus {
    border-color: #667eea;
    background: rgba(255,255,255,0.08);
  }
  select { appearance: none; cursor: pointer; }
  select option { background: #1a1a2e; color: #fff; }
  textarea { resize: vertical; min-height: 60px; }
  .toggle-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 18px; font-size: 13px; color: #ccc;
  }
  .toggle {
    width: 42px; height: 24px; border-radius: 12px;
    background: rgba(255,255,255,0.12); position: relative;
    cursor: pointer; transition: background 0.2s;
  }
  .toggle.on { background: #667eea; }
  .toggle::after {
    content: ''; position: absolute; top: 3px; left: 3px;
    width: 18px; height: 18px; border-radius: 50%;
    background: #fff; transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .toggle.on::after { transform: translateX(18px); }
  .divider {
    height: 1px; background: rgba(255,255,255,0.06);
    margin: 20px 0;
  }
  .avatar-row {
    display: flex; align-items: center; gap: 14px;
    margin-bottom: 20px;
  }
  .avatar {
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(135deg, #667eea, #f093fb);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; color: #fff; font-weight: 600;
    flex-shrink: 0;
  }
  .avatar-info { font-size: 12px; color: #888; line-height: 1.5; }
  .avatar-info strong { color: #ccc; font-size: 13px; display: block; }
  .btn {
    width: 100%; padding: 13px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff; border: none; border-radius: 12px;
    font-size: 15px; font-weight: 600; cursor: pointer;
    font-family: inherit; transition: opacity 0.2s, transform 0.1s;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
  }
  .btn:hover { opacity: 0.92; }
  .btn:active { transform: scale(0.98); }
  .btn-outline {
    background: none; border: 1.5px solid rgba(255,255,255,0.15);
    box-shadow: none; color: #ccc; margin-top: 10px;
  }
  .btn-outline:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
  .footer {
    text-align: center; margin-top: 20px;
    font-size: 11px; color: #666; line-height: 1.6;
  }
  .footer a { color: #667eea; text-decoration: none; }
  .footer a:hover { text-decoration: underline; }
  .step-dots {
    display: flex; justify-content: center; gap: 6px; margin-bottom: 24px;
  }
  .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: rgba(255,255,255,0.12);
  }
  .dot.active { background: #667eea; width: 20px; border-radius: 4px; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">K</div>
    <div class="step-dots">
      <div class="dot active"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
    <h1>Create your account</h1>
    <p class="sub">Join 12,000+ teams already building with Kanva</p>

    <div class="avatar-row">
      <div class="avatar">JS</div>
      <div class="avatar-info">
        <strong>Upload a photo</strong>
        JPG, PNG or GIF. Max 2MB.
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>First Name</label>
        <input type="text" placeholder="Jane">
      </div>
      <div class="field">
        <label>Last Name</label>
        <input type="text" placeholder="Smith">
      </div>
    </div>

    <div class="field">
      <label>Work Email</label>
      <input type="email" placeholder="jane@company.com">
    </div>

    <div class="field">
      <label>Password</label>
      <input type="password" placeholder="8+ characters, 1 uppercase">
    </div>

    <div class="row">
      <div class="field">
        <label>Role</label>
        <select>
          <option>Designer</option>
          <option>Engineer</option>
          <option>Product Manager</option>
          <option>Founder</option>
          <option>Other</option>
        </select>
      </div>
      <div class="field">
        <label>Team Size</label>
        <select>
          <option>1-5</option>
          <option>6-20</option>
          <option>21-100</option>
          <option>100+</option>
        </select>
      </div>
    </div>

    <div class="field">
      <label>What are you building?</label>
      <textarea placeholder="Tell us about your project..."></textarea>
    </div>

    <div class="divider"></div>

    <div class="toggle-row">
      <span>Enable two-factor authentication</span>
      <div class="toggle on" onclick="this.classList.toggle('on')"></div>
    </div>
    <div class="toggle-row">
      <span>Send me product updates</span>
      <div class="toggle" onclick="this.classList.toggle('on')"></div>
    </div>

    <button class="btn">Create Account</button>
    <button class="btn btn-outline">Continue with Google</button>

    <p class="footer">
      By signing up you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.<br>
      Already have an account? <a href="#">Log in</a>
    </p>
  </div>
</body>
</html>`

const records: EditorRecords = {
  document: {
    id: 'doc_1',
    title: 'Artifact Board',
    createdAt: now,
    updatedAt: now,
    version: 1,
  },
  cards: {
    // Card 1: Static image content
    card_1: {
      id: 'card_1',
      type: 'screen',
      title: 'Dashboard Screenshot',
      x: 100,
      y: 100,
      width: 480,
      height: 320,
      zIndex: 1,
      visible: true,
      locked: false,
      favorite: false,
      createdAt: now,
      updatedAt: now,
      provenanceId: 'prov_1',
      content: {
        kind: 'image',
        src: 'https://picsum.photos/seed/kanva-dash/960/640',
      },
      capabilities: {
        selectable: true,
        focusable: true,
        movable: true,
        resizable: true,
        exportable: true,
        downloadable: true,
        viewCode: true,
        liveOverlay: false,
      },
    },

    // Card 2: URL content — live iframe
    card_2: {
      id: 'card_2',
      type: 'prototype',
      title: 'Live Website',
      x: 680,
      y: 80,
      width: 420,
      height: 600,
      zIndex: 2,
      visible: true,
      locked: false,
      favorite: true,
      createdAt: now,
      updatedAt: now,
      content: {
        kind: 'url',
        url: 'https://example.com',
      },
      previewThumbnailUrl: 'https://picsum.photos/seed/kanva-url/840/1200',
      capabilities: {
        selectable: true,
        focusable: true,
        movable: true,
        resizable: true,
        exportable: true,
        downloadable: true,
        viewCode: true,
        liveOverlay: true,
      },
    },

    // Card 3: Raw HTML content — rendered via srcdoc
    card_3: {
      id: 'card_3',
      type: 'screen',
      title: 'Sign Up Form',
      x: 1200,
      y: 80,
      width: 400,
      height: 560,
      zIndex: 3,
      visible: true,
      locked: false,
      favorite: false,
      createdAt: now,
      updatedAt: now,
      content: {
        kind: 'html',
        html: SIGNUP_FORM_HTML,
      },
      previewThumbnailUrl: 'https://picsum.photos/seed/kanva-form/800/1120',
      capabilities: {
        selectable: true,
        focusable: true,
        movable: true,
        resizable: true,
        exportable: true,
        downloadable: true,
        viewCode: true,
        liveOverlay: true,
      },
    },
  },
  provenance: {
    prov_1: {
      id: 'prov_1',
      conversationId: 'conv_1',
      createdByMessageId: 'msg_1',
      lastUpdatedByMessageId: 'msg_2',
      operationIds: ['op_1'],
    },
  },
  revisions: {
    rev_1: {
      id: 'rev_1',
      cardId: 'card_1',
      operationId: 'op_1',
      messageId: 'msg_2',
      timestamp: now,
      summary: 'Created initial dashboard frame',
    },
  },
  bindings: {},
}

const runtime: RuntimeState = {
  camera: {
    x: 0,
    y: 0,
    scale: 1,
    viewportWidth: 1200,
    viewportHeight: 800,
    minScale: 0.05,
    maxScale: 4,
  },
  selection: {
    selectedIds: [],
    focusedId: undefined,
    hoveredId: undefined,
  },
  interaction: {
    tool: 'select',
    mode: 'idle',
    spacePanActive: false,
  },
  ui: {
    contextMenu: {
      open: false,
      screenX: 0,
      screenY: 0,
    },
    dimensionBadgeVisible: false,
  },
  preview: {
    active: false,
    kind: undefined,
    cardFrames: {},
  },
  snap: {
    enabled: true,
    mode: 'objects',
    thresholdPx: 6,
    gridSize: 8,
    guides: [],
    bypass: false,
  },
}

export function createDemoEditor(container: HTMLDivElement) {
  const store = new EditorStore({ records, runtime })

  const plugins = new PluginRegistry()
  plugins.register(new ScreenCardPlugin())
  plugins.register(new PrototypeCardPlugin())
  plugins.register(new DocumentCardPlugin())

  const editor = new EditorCore({
    store,
    plugins,
    history: new HistoryManager(),
    intents: new IntentBus(),
  })

  const adapter = new KonvaAdapter()
  adapter.mount({ container, editor })

  window.addEventListener('resize', () => {
    adapter.resize(container.clientWidth, container.clientHeight)
  })

  // Expose for debugging
  ;(window as any).editor = editor
  ;(window as any).adapter = adapter

  return { editor, adapter }
}
