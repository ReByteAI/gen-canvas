import { EditorStore } from './core/EditorStore'
import { EditorCore } from './core/EditorCore'
import { PluginRegistry } from './core/PluginRegistry'
import { HistoryManager } from './core/HistoryManager'
import { IntentBus } from './core/IntentBus'
import { InMemoryContentProvider } from './core/ContentProvider'
import { ScreenCardPlugin } from './core/plugins/ScreenCardPlugin'
import { PrototypeCardPlugin } from './core/plugins/PrototypeCardPlugin'
import { DocumentCardPlugin } from './core/plugins/DocumentCardPlugin'
import { KonvaAdapter } from './konva/KonvaAdapter'
import type { CardRecord, EditorRecords, RuntimeState } from './core/types'

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

// ---------------------------------------------------------------------------
// HTML templates for demo cards
// ---------------------------------------------------------------------------

const PRICING_PAGE_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;padding:32px;color:#1e293b}
h1{text-align:center;font-size:28px;font-weight:800;margin-bottom:8px}
.sub{text-align:center;color:#64748b;font-size:14px;margin-bottom:32px}
.grid{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
.plan{background:#fff;border:2px solid #e2e8f0;border-radius:16px;padding:28px;width:200px;text-align:center;transition:transform .15s,box-shadow .15s}
.plan:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.08)}
.plan.featured{border-color:#6366f1;background:linear-gradient(180deg,#eef2ff,#fff)}
.plan h3{font-size:18px;font-weight:700;margin-bottom:4px}
.price{font-size:36px;font-weight:800;margin:12px 0 4px}
.price span{font-size:14px;font-weight:400;color:#94a3b8}
.features{list-style:none;text-align:left;font-size:12px;color:#475569;margin:16px 0;line-height:2}
.features li::before{content:"\\2713 ";color:#22c55e;font-weight:700}
.btn{display:block;width:100%;padding:10px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.btn-outline{background:none;border:2px solid #e2e8f0;color:#334155}
.btn-primary{background:#6366f1;color:#fff}
.btn-dark{background:#0f172a;color:#fff}
</style></head><body>
<h1>Simple pricing</h1>
<p class="sub">Start free. Upgrade when you need to.</p>
<div class="grid">
  <div class="plan">
    <h3>Free</h3>
    <div class="price">$0<span>/mo</span></div>
    <ul class="features"><li>3 projects</li><li>1 GB storage</li><li>Community support</li></ul>
    <button class="btn btn-outline">Get started</button>
  </div>
  <div class="plan featured">
    <h3>Pro</h3>
    <div class="price">$19<span>/mo</span></div>
    <ul class="features"><li>Unlimited projects</li><li>50 GB storage</li><li>Priority support</li><li>Custom domains</li></ul>
    <button class="btn btn-primary">Start trial</button>
  </div>
  <div class="plan">
    <h3>Enterprise</h3>
    <div class="price">$99<span>/mo</span></div>
    <ul class="features"><li>Everything in Pro</li><li>SSO &amp; SAML</li><li>Audit logs</li><li>Dedicated support</li></ul>
    <button class="btn btn-dark">Contact sales</button>
  </div>
</div>
</body></html>`

const DASHBOARD_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:24px}
h2{font-size:20px;font-weight:700;margin-bottom:20px;color:#fff}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
.stat{background:#1e293b;border-radius:12px;padding:16px}
.stat .label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px}
.stat .value{font-size:28px;font-weight:800;color:#fff}
.stat .change{font-size:12px;margin-top:4px}
.up{color:#22c55e}
.down{color:#ef4444}
.chart{background:#1e293b;border-radius:12px;padding:20px;margin-bottom:16px}
.chart h3{font-size:13px;color:#94a3b8;margin-bottom:12px}
.bars{display:flex;align-items:flex-end;gap:6px;height:100px}
.bar{flex:1;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#6366f1,#818cf8);min-width:12px;transition:height .3s}
.table{background:#1e293b;border-radius:12px;padding:16px}
.table h3{font-size:13px;color:#94a3b8;margin-bottom:12px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #334155;font-size:13px}
.row:last-child{border:none}
.row .name{color:#e2e8f0}
.row .val{color:#94a3b8}
.badge{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:600}
.badge-green{background:#166534;color:#4ade80}
.badge-yellow{background:#713f12;color:#facc15}
</style></head><body>
<h2>Analytics Overview</h2>
<div class="stats">
  <div class="stat"><div class="label">Revenue</div><div class="value">$48.2k</div><div class="change up">+12.5%</div></div>
  <div class="stat"><div class="label">Users</div><div class="value">2,847</div><div class="change up">+8.1%</div></div>
  <div class="stat"><div class="label">Churn</div><div class="value">3.2%</div><div class="change down">+0.4%</div></div>
</div>
<div class="chart">
  <h3>Weekly Revenue</h3>
  <div class="bars">
    <div class="bar" style="height:45%"></div><div class="bar" style="height:62%"></div>
    <div class="bar" style="height:38%"></div><div class="bar" style="height:75%"></div>
    <div class="bar" style="height:58%"></div><div class="bar" style="height:90%"></div>
    <div class="bar" style="height:82%"></div><div class="bar" style="height:68%"></div>
    <div class="bar" style="height:95%"></div><div class="bar" style="height:72%"></div>
    <div class="bar" style="height:100%"></div><div class="bar" style="height:88%"></div>
  </div>
</div>
<div class="table">
  <h3>Recent Activity</h3>
  <div class="row"><span class="name">Acme Corp</span><span class="badge badge-green">Paid</span><span class="val">$2,400</span></div>
  <div class="row"><span class="name">Globex Inc</span><span class="badge badge-green">Paid</span><span class="val">$1,800</span></div>
  <div class="row"><span class="name">Initech</span><span class="badge badge-yellow">Pending</span><span class="val">$950</span></div>
  <div class="row"><span class="name">Umbrella Co</span><span class="badge badge-green">Paid</span><span class="val">$3,200</span></div>
</div>
</body></html>`

const MOBILE_APP_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#000;color:#fff;max-width:375px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column}
.status-bar{display:flex;justify-content:space-between;padding:8px 20px;font-size:12px;font-weight:600}
.header{padding:20px;padding-top:8px}
.header h1{font-size:28px;font-weight:800}
.header p{color:#888;font-size:13px;margin-top:4px}
.search{margin:0 20px 16px;padding:12px 16px;background:#1c1c1e;border-radius:12px;border:none;color:#fff;font-size:14px;font-family:inherit;width:calc(100% - 40px)}
.search::placeholder{color:#555}
.section{padding:0 20px;margin-bottom:20px}
.section h2{font-size:16px;font-weight:700;margin-bottom:12px}
.scroll{display:flex;gap:12px;overflow-x:auto;padding-bottom:4px}
.scroll::-webkit-scrollbar{display:none}
.card-sm{width:140px;flex-shrink:0;background:#1c1c1e;border-radius:14px;overflow:hidden}
.card-sm .img{height:100px;background:linear-gradient(135deg,#667eea,#764ba2)}
.card-sm .info{padding:10px}
.card-sm .info h3{font-size:13px;font-weight:600}
.card-sm .info p{font-size:11px;color:#888;margin-top:2px}
.card-lg{background:#1c1c1e;border-radius:14px;padding:16px;display:flex;gap:14px;margin-bottom:10px}
.card-lg .thumb{width:56px;height:56px;border-radius:12px;flex-shrink:0}
.card-lg .meta h3{font-size:14px;font-weight:600}
.card-lg .meta p{font-size:12px;color:#888;margin-top:2px}
.card-lg .meta .tag{display:inline-block;font-size:10px;background:#2c2c2e;padding:2px 8px;border-radius:6px;margin-top:6px;color:#aaa}
.tab-bar{margin-top:auto;display:flex;justify-content:space-around;padding:12px 0;border-top:1px solid #1c1c1e;font-size:10px;color:#555}
.tab-bar .tab{text-align:center}
.tab-bar .tab.active{color:#fff}
.tab-bar .icon{font-size:20px;margin-bottom:2px}
</style></head><body>
<div class="status-bar"><span>9:41</span><span>5G</span></div>
<div class="header"><h1>Discover</h1><p>Find something new today</p></div>
<input class="search" placeholder="Search anything...">
<div class="section">
  <h2>Trending</h2>
  <div class="scroll">
    <div class="card-sm"><div class="img" style="background:linear-gradient(135deg,#f093fb,#f5576c)"></div><div class="info"><h3>Gradient Art</h3><p>12.4k views</p></div></div>
    <div class="card-sm"><div class="img" style="background:linear-gradient(135deg,#4facfe,#00f2fe)"></div><div class="info"><h3>Ocean Waves</h3><p>8.9k views</p></div></div>
    <div class="card-sm"><div class="img" style="background:linear-gradient(135deg,#43e97b,#38f9d7)"></div><div class="info"><h3>Nature</h3><p>15.2k views</p></div></div>
    <div class="card-sm"><div class="img" style="background:linear-gradient(135deg,#fa709a,#fee140)"></div><div class="info"><h3>Sunset Vibes</h3><p>6.7k views</p></div></div>
  </div>
</div>
<div class="section">
  <h2>For You</h2>
  <div class="card-lg"><div class="thumb" style="background:linear-gradient(135deg,#a18cd1,#fbc2eb);border-radius:12px"></div><div class="meta"><h3>Creative Workshop</h3><p>Learn design fundamentals</p><span class="tag">Free</span></div></div>
  <div class="card-lg"><div class="thumb" style="background:linear-gradient(135deg,#ffecd2,#fcb69f);border-radius:12px"></div><div class="meta"><h3>Photo Editing</h3><p>Master lighting and color</p><span class="tag">Premium</span></div></div>
</div>
<div class="tab-bar">
  <div class="tab active"><div class="icon">&#9750;</div>Home</div>
  <div class="tab"><div class="icon">&#9906;</div>Search</div>
  <div class="tab"><div class="icon">&#10010;</div>Create</div>
  <div class="tab"><div class="icon">&#9825;</div>Likes</div>
  <div class="tab"><div class="icon">&#9787;</div>Profile</div>
</div>
</body></html>`

const CHAT_UI_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;display:flex;flex-direction:column;height:100vh}
.top{padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:12px}
.avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0}
.top .name{font-weight:600;font-size:15px;color:#111}
.top .status{font-size:11px;color:#22c55e}
.messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px}
.msg{max-width:75%;padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.5}
.msg.them{background:#f3f4f6;color:#111;align-self:flex-start;border-bottom-left-radius:4px}
.msg.me{background:#6366f1;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.msg .time{font-size:10px;opacity:.5;margin-top:4px}
.typing{font-size:12px;color:#999;padding:0 20px 8px;display:flex;align-items:center;gap:6px}
.typing .dots{display:flex;gap:3px}
.typing .dots span{width:6px;height:6px;background:#ccc;border-radius:50%;animation:bounce .6s infinite alternate}
.typing .dots span:nth-child(2){animation-delay:.2s}
.typing .dots span:nth-child(3){animation-delay:.4s}
@keyframes bounce{to{opacity:.3;transform:translateY(-4px)}}
.input-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid #f0f0f0}
.input-bar input{flex:1;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:24px;font-size:14px;outline:none;font-family:inherit}
.input-bar input:focus{border-color:#6366f1}
.send{width:36px;height:36px;border-radius:50%;background:#6366f1;border:none;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center}
</style></head><body>
<div class="top"><div class="avatar">AI</div><div><div class="name">Design Agent</div><div class="status">Online</div></div></div>
<div class="messages">
  <div class="msg them">Hey! I've generated 3 screen variations for your landing page. Want me to walk through them?<div class="time">2:14 PM</div></div>
  <div class="msg me">Yes please! Show me the hero section options<div class="time">2:15 PM</div></div>
  <div class="msg them">Here's what I came up with:<br><br><strong>Option A:</strong> Bold gradient with centered CTA<br><strong>Option B:</strong> Split layout with product screenshot<br><strong>Option C:</strong> Minimal with animated text<br><br>Which direction feels right?<div class="time">2:15 PM</div></div>
  <div class="msg me">I like Option B — can you make the screenshot larger and add social proof?<div class="time">2:16 PM</div></div>
  <div class="msg them">On it! I'll also add a testimonial carousel below the fold. Give me a sec...<div class="time">2:16 PM</div></div>
</div>
<div class="typing"><div class="dots"><span></span><span></span><span></span></div>Design Agent is creating...</div>
<div class="input-bar"><input placeholder="Ask the agent anything..."><button class="send">&#8593;</button></div>
</body></html>`

const LANDING_PAGE_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#0f172a}
nav{display:flex;justify-content:space-between;align-items:center;padding:16px 32px}
nav .logo{font-size:18px;font-weight:800;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
nav .links{display:flex;gap:24px;font-size:13px;color:#64748b}
nav .links a{text-decoration:none;color:inherit}
.hero{text-align:center;padding:60px 32px 40px;max-width:640px;margin:0 auto}
.hero .badge{display:inline-block;font-size:11px;font-weight:600;background:#eef2ff;color:#6366f1;padding:4px 12px;border-radius:20px;margin-bottom:16px}
.hero h1{font-size:40px;font-weight:800;line-height:1.15;margin-bottom:16px}
.hero h1 span{background:linear-gradient(135deg,#6366f1,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero p{font-size:16px;color:#64748b;line-height:1.6;margin-bottom:28px}
.cta{display:inline-flex;gap:12px}
.cta a{padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;transition:transform .1s}
.cta a:hover{transform:translateY(-2px)}
.cta .primary{background:#6366f1;color:#fff;box-shadow:0 4px 16px rgba(99,102,241,.3)}
.cta .secondary{border:1.5px solid #e2e8f0;color:#334155}
.logos{display:flex;justify-content:center;gap:32px;padding:40px 32px;opacity:.4;font-size:14px;font-weight:600;color:#94a3b8}
</style></head><body>
<nav><div class="logo">kanva</div><div class="links"><a href="#">Product</a><a href="#">Pricing</a><a href="#">Docs</a><a href="#">Blog</a></div></nav>
<div class="hero">
  <div class="badge">Now in public beta</div>
  <h1>The canvas for<br><span>generative content</span></h1>
  <p>Give your AI agent a Figma-like workspace. Every screen, prototype, and document it generates becomes a card you can arrange, inspect, and refine.</p>
  <div class="cta"><a class="primary" href="#">Get started free</a><a class="secondary" href="#">View demo</a></div>
</div>
<div class="logos">Acme Corp &bull; Globex &bull; Initech &bull; Umbrella &bull; Soylent</div>
</body></html>`

// ---------------------------------------------------------------------------
// Capabilities shorthand
// ---------------------------------------------------------------------------

const CAP_FULL = {
  selectable: true,
  focusable: true,
  movable: true,
  resizable: true,
  exportable: true,
  downloadable: true,
  viewCode: true,
  liveOverlay: true,
}

const CAP_IMAGE = { ...CAP_FULL, liveOverlay: false }

// ---------------------------------------------------------------------------
// Demo cards — 10 cards with real images, URLs, and HTML
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Content store — all content lives here, cards only hold refs
// ---------------------------------------------------------------------------

const demoContent = new InMemoryContentProvider()

// HTML content — stored by ref key
demoContent.set('landing-page', { type: 'html', html: LANDING_PAGE_HTML })
demoContent.set('pricing-page', { type: 'html', html: PRICING_PAGE_HTML })
demoContent.set('signup-form', { type: 'html', html: SIGNUP_FORM_HTML })
demoContent.set('dashboard', { type: 'html', html: DASHBOARD_HTML })
demoContent.set('mobile-app', { type: 'html', html: MOBILE_APP_HTML })
demoContent.set('chat-ui', { type: 'html', html: CHAT_UI_HTML })

// Image content — ref is the URL, resolved as-is
demoContent.set('hero-photo', {
  type: 'image',
  src: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1040&h=680&fit=crop',
})
demoContent.set('product-shot', {
  type: 'image',
  src: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=880&h=600&fit=crop',
})

// URL content — ref is the URL itself
demoContent.set('wikipedia', {
  type: 'url',
  url: 'https://en.m.wikipedia.org/wiki/Infinite_canvas',
})
demoContent.set('mdn-docs', {
  type: 'url',
  url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe',
})

// Thumbnails
demoContent.set('thumb-wikipedia', {
  type: 'image',
  src: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=960&h=800&fit=crop',
})
demoContent.set('thumb-mdn', {
  type: 'image',
  src: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=960&h=1200&fit=crop',
})

// ---------------------------------------------------------------------------
// Demo cards — layout only, no content bytes
// ---------------------------------------------------------------------------

const DEMO_CARDS: CardRecord[] = [
  // Row 1: HTML cards
  {
    id: 'card_1',
    type: 'screen',
    title: 'Landing Page',
    x: 80,
    y: 80,
    width: 520,
    height: 580,
    zIndex: 1,
    visible: true,
    locked: false,
    favorite: true,
    createdAt: now,
    updatedAt: now,
    contentRef: 'landing-page',
    contentType: 'html',
    capabilities: CAP_FULL,
  },
  {
    id: 'card_2',
    type: 'screen',
    title: 'Pricing Page',
    x: 660,
    y: 80,
    width: 640,
    height: 480,
    zIndex: 2,
    visible: true,
    locked: false,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    contentRef: 'pricing-page',
    contentType: 'html',
    capabilities: CAP_FULL,
  },
  {
    id: 'card_3',
    type: 'screen',
    title: 'Sign Up Form',
    x: 1360,
    y: 80,
    width: 400,
    height: 640,
    zIndex: 3,
    visible: true,
    locked: false,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    contentRef: 'signup-form',
    contentType: 'html',
    capabilities: CAP_FULL,
  },

  // Row 2: More HTML cards
  {
    id: 'card_4',
    type: 'screen',
    title: 'Analytics Dashboard',
    x: 80,
    y: 720,
    width: 560,
    height: 520,
    zIndex: 4,
    visible: true,
    locked: false,
    favorite: true,
    createdAt: now,
    updatedAt: now,
    contentRef: 'dashboard',
    contentType: 'html',
    capabilities: CAP_FULL,
  },
  {
    id: 'card_5',
    type: 'prototype',
    title: 'Mobile App',
    x: 700,
    y: 620,
    width: 375,
    height: 700,
    zIndex: 5,
    visible: true,
    locked: false,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    contentRef: 'mobile-app',
    contentType: 'html',
    capabilities: CAP_FULL,
  },
  {
    id: 'card_6',
    type: 'screen',
    title: 'Chat Interface',
    x: 1140,
    y: 780,
    width: 380,
    height: 540,
    zIndex: 6,
    visible: true,
    locked: false,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    contentRef: 'chat-ui',
    contentType: 'html',
    capabilities: CAP_FULL,
  },

  // Row 3: Image cards
  {
    id: 'card_7',
    type: 'screen',
    title: 'Hero Photography',
    x: 80,
    y: 1300,
    width: 520,
    height: 340,
    zIndex: 7,
    visible: true,
    locked: false,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    contentRef: 'hero-photo',
    contentType: 'image',
    capabilities: CAP_IMAGE,
  },
  {
    id: 'card_8',
    type: 'screen',
    title: 'Product Shot',
    x: 660,
    y: 1380,
    width: 440,
    height: 300,
    zIndex: 8,
    visible: true,
    locked: false,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    contentRef: 'product-shot',
    contentType: 'image',
    capabilities: CAP_IMAGE,
  },

  // URL cards
  {
    id: 'card_9',
    type: 'prototype',
    title: 'Wikipedia',
    x: 1160,
    y: 1380,
    width: 480,
    height: 400,
    zIndex: 9,
    visible: true,
    locked: false,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    contentRef: 'wikipedia',
    contentType: 'url',
    thumbnailRef: 'thumb-wikipedia',
    capabilities: CAP_FULL,
  },
  {
    id: 'card_10',
    type: 'document',
    title: 'MDN Web Docs',
    x: 1700,
    y: 80,
    width: 480,
    height: 600,
    zIndex: 10,
    visible: true,
    locked: false,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    contentRef: 'mdn-docs',
    contentType: 'url',
    thumbnailRef: 'thumb-mdn',
    capabilities: CAP_FULL,
  },
]

const records: EditorRecords = {
  document: {
    id: 'doc_1',
    title: 'Artifact Board',
    createdAt: now,
    updatedAt: now,
    version: 1,
  },
  cards: Object.fromEntries(DEMO_CARDS.map((c) => [c.id, c])),
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
    content: demoContent,
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
