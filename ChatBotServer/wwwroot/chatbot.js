/* ChatBot Widget — served by ChatBotServer
 * Usage: <script src="https://HOST/chatbot.js" data-org-id="GUID" defer></script>
 */
(function () {
    'use strict';

    // ── Bootstrap ─────────────────────────────────────────────────────────
    const script = document.currentScript;
    if (!script) { console.warn('[ChatBot] Cannot locate script element.'); return; }

    const orgId = script.dataset.orgId;
    if (!orgId) { console.warn('[ChatBot] Missing data-org-id attribute.'); return; }

    const serverOrigin = new URL(script.src).origin;
    const apiUrl       = `${serverOrigin}/api/chat/${orgId}`;
    const infoUrl      = `${serverOrigin}/api/info/${orgId}`;

    // ── Session state (localStorage = survives refreshes and tab closes) ─────
    const KEY_TOKEN = `chatbot_token_${orgId}`;
    const KEY_NAME  = `chatbot_name_${orgId}`;
    const KEY_EMAIL = `chatbot_email_${orgId}`;
    const KEY_INTRO = `chatbot_intro_${orgId}`;

    function ls(key, val) {
        try {
            if (val === undefined) return localStorage.getItem(key) || '';
            localStorage.setItem(key, val);
        } catch (_) {}
        return val || '';
    }

    // Reuse existing token so history is restored after refresh/tab-close
    let sessionToken = ls(KEY_TOKEN);
    if (!sessionToken) {
        sessionToken = crypto.randomUUID ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        ls(KEY_TOKEN, sessionToken);
    }

    let userName       = ls(KEY_NAME);
    let userEmail      = ls(KEY_EMAIL);
    let introCompleted = !!ls(KEY_INTRO);

    // ── Styles (scoped inside shadow DOM) ─────────────────────────────────
    const css = `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        #widget {
            position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 15px; line-height: 1.5; color: #1a1a1a;
        }

        /* ── Toggle button ── */
        #toggle-btn {
            width: 56px; height: 56px; border-radius: 50%;
            background: #e5e7eb; color: #9ca3af; border: none; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 16px rgba(0,0,0,.15);
            transition: transform .15s, box-shadow .15s;
        }
        #toggle-btn:hover  { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,.2); }
        #toggle-btn:active { transform: scale(.96); }
        #toggle-btn svg { width: 26px; height: 26px; pointer-events: none; }

        /* ── Panel ── */
        #panel {
            position: absolute; bottom: 68px; right: 0;
            width: 360px; max-width: calc(100vw - 32px);
            height: 520px; max-height: calc(100vh - 100px);
            background: #fff; border-radius: 14px;
            box-shadow: 0 12px 40px rgba(0,0,0,.18);
            display: flex; flex-direction: column; overflow: hidden;
            opacity: 0; transform: translateY(16px) scale(.96);
            pointer-events: none; transition: opacity .2s ease, transform .2s ease;
        }
        #panel.open { opacity: 1; transform: none; pointer-events: all; }

        /* ── Expanded (large) view ── */
        #panel.expanded {
            position: fixed; top: 10vh; left: 10vw; right: auto; bottom: auto;
            width: 80vw; height: 80vh; max-width: 80vw; max-height: 80vh;
            border-radius: 16px;
        }
        @media (max-width: 640px) {
            #panel.expanded {
                top: 2vh; left: 2vw; width: 96vw; height: 96vh;
                max-width: 96vw; max-height: 96vh;
            }
        }

        /* ── Header ── */
        #panel-header {
            background: #499CB4; color: #fff;
            padding: 13px 16px; font-weight: 600; font-size: 15px;
            display: flex; align-items: center; gap: 8px; flex-shrink: 0;
        }
        .status-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: #4cff91; flex-shrink: 0;
        }
        #bot-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        #expand-btn, #close-btn {
            background: none; border: none; color: #fff; cursor: pointer;
            opacity: .75; padding: 2px; display: flex; align-items: center;
            border-radius: 4px; transition: opacity .1s;
        }
        #expand-btn:hover, #close-btn:hover { opacity: 1; }
        #expand-btn svg, #close-btn svg { width: 18px; height: 18px; pointer-events: none; }

        /* ── Messages ── */
        #messages {
            flex: 1; overflow-y: auto; padding: 16px;
            display: flex; flex-direction: column; gap: 12px;
            scroll-behavior: smooth;
        }
        #messages::-webkit-scrollbar { width: 5px; }
        #messages::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 10px; }

        #placeholder {
            text-align: center; color: #888; font-size: 13.5px;
            padding: 32px 16px; margin: auto;
        }
        #placeholder p { margin-top: 8px; }

        .msg { display: flex; flex-direction: column; gap: 5px; max-width: min(86%, 760px); }
        .msg.user { align-self: flex-end; }
        .msg.bot  { align-self: flex-start; }

        .bubble {
            padding: 10px 13px; border-radius: 16px;
            font-size: 14px; line-height: 1.55; word-break: break-word;
        }
        .user .bubble {
            background: #499CB4; color: #fff; border-bottom-right-radius: 4px;
        }
        .bot .bubble {
            background: #f1f3f5; color: #1a1a1a; border-bottom-left-radius: 4px;
        }
        .bubble p + p { margin-top: .5em; }

        /* ── Images ── */
        .msg-images { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
        .msg-images a { display: block; }
        .msg-images img {
            max-width: 220px; max-height: 150px; object-fit: contain;
            border-radius: 8px; border: 1px solid #e0e0e0;
            cursor: zoom-in; transition: opacity .15s;
        }
        .msg-images img:hover { opacity: .88; }

        /* ── Lightbox ── */
        #lightbox {
            position: fixed; inset: 0; z-index: 2147483647;
            background: rgba(0,0,0,.82);
            display: none; align-items: center; justify-content: center;
            padding: 24px; cursor: zoom-out;
        }
        #lightbox.open { display: flex; }
        #lightbox img {
            max-width: 100%; max-height: 100%; object-fit: contain;
            border-radius: 8px; box-shadow: 0 8px 40px rgba(0,0,0,.55);
        }
        #lightbox-close {
            position: absolute; top: 14px; right: 18px;
            background: none; border: none; color: #fff; cursor: pointer;
            opacity: .8; padding: 4px; display: flex; align-items: center;
            transition: opacity .1s;
        }
        #lightbox-close:hover { opacity: 1; }
        #lightbox-close svg { width: 26px; height: 26px; pointer-events: none; }

        /* ── Typing indicator ── */
        .typing { display: inline-flex; align-items: center; gap: 4px; padding: 12px 14px; }
        .typing span {
            width: 7px; height: 7px; border-radius: 50%; background: #aaa;
            animation: bounce 1.3s infinite ease-in-out;
        }
        .typing span:nth-child(2) { animation-delay: .18s; }
        .typing span:nth-child(3) { animation-delay: .36s; }
        @keyframes bounce { 0%,60%,100% { transform: translateY(0); opacity:.4; } 30% { transform: translateY(-5px); opacity:1; } }

        /* ── Intro form (greeting + name/email) ── */
        #intro-form {
            padding: 12px 16px 16px; border-top: 1px solid #eee; flex-shrink: 0;
            display: flex; flex-direction: column; gap: 8px;
        }
        #intro-form.hidden { display: none; }
        .intro-field {
            width: 100%; padding: 8px 12px; font-size: 14px;
            border: 1.5px solid #ddd; border-radius: 20px;
            font-family: inherit; outline: none;
            transition: border-color .15s;
        }
        .intro-field:focus { border-color: #499CB4; }
        .intro-field::placeholder { color: #bbb; }
        #intro-start-btn {
            width: 100%; padding: 9px; font-size: 14px; font-weight: 600;
            background: #499CB4; color: #fff; border: none; border-radius: 20px;
            cursor: pointer; transition: background .15s;
        }
        #intro-start-btn:hover { background: #3D8BA0; }
        .intro-skip {
            text-align: center; font-size: 12px; color: #aaa; cursor: pointer;
            background: none; border: none; font-family: inherit; padding: 0;
        }
        .intro-skip:hover { color: #888; text-decoration: underline; }

        /* ── Input row ── */
        #input-row {
            padding: 10px 12px; border-top: 1px solid #eee;
            display: flex; align-items: flex-end; gap: 8px; flex-shrink: 0;
        }
        #input-row.hidden { display: none; }
        #chat-input {
            flex: 1; padding: 9px 12px; font-size: 14px;
            border: 1.5px solid #ddd; border-radius: 20px;
            font-family: inherit; outline: none; resize: none;
            max-height: 80px; overflow-y: auto; line-height: 1.45;
            transition: border-color .15s;
        }
        #chat-input:focus { border-color: #499CB4; }
        #chat-input::placeholder { color: #bbb; }
        #send-btn {
            width: 38px; height: 38px; border-radius: 50%; border: none;
            background: #499CB4; color: #fff; cursor: pointer; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            transition: background .15s, transform .1s;
        }
        #send-btn:disabled { background: #ccc; cursor: default; }
        #send-btn:not(:disabled):hover  { background: #3D8BA0; }
        #send-btn:not(:disabled):active { transform: scale(.92); }
        #send-btn svg { width: 17px; height: 17px; pointer-events: none; }
    `;

    // ── HTML template ──────────────────────────────────────────────────────
    const html = `
        <div id="widget">
            <div id="panel" role="dialog" aria-label="Chat">
                <div id="panel-header">
                    <span class="status-dot"></span>
                    <span id="bot-title">Chat</span>
                    <button id="expand-btn" aria-label="Expand chat" aria-pressed="false">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                        </svg>
                    </button>
                    <button id="close-btn" aria-label="Close chat">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div id="messages" role="log" aria-live="polite">
                    <div id="placeholder">
                        <div style="font-size:32px">💬</div>
                        <p>Hi there! Ask me anything.</p>
                    </div>
                </div>
                <div id="intro-form" class="hidden">
                    <input id="intro-name"  class="intro-field" type="text"  placeholder="Your name (optional)"  autocomplete="given-name" />
                    <input id="intro-email" class="intro-field" type="email" placeholder="Email address (optional)" autocomplete="email" />
                    <button id="intro-start-btn">Start Chat →</button>
                    <button class="intro-skip" id="intro-skip-btn">Skip</button>
                </div>
                <div id="input-row">
                    <textarea id="chat-input" rows="1" placeholder="Type a question…" aria-label="Your question"></textarea>
                    <button id="send-btn" aria-label="Send">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <button id="toggle-btn" aria-label="Open chat" aria-expanded="false">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/>
                </svg>
            </button>
            <div id="lightbox" role="dialog" aria-modal="true" aria-label="Enlarged image">
                <button id="lightbox-close" aria-label="Close image">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
                <img alt="Enlarged image">
            </div>
        </div>
    `;

    // ── Mount into shadow DOM ──────────────────────────────────────────────
    const host   = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${css}</style>${html}`;
    document.body.appendChild(host);

    // ── References ────────────────────────────────────────────────────────
    const $           = id => shadow.getElementById(id);
    const panel       = $('panel');
    const togBtn      = $('toggle-btn');
    const closeBtn    = $('close-btn');
    const expandBtn   = $('expand-btn');
    const msgs        = $('messages');
    const input       = $('chat-input');
    const sendBtn     = $('send-btn');
    const introForm   = $('intro-form');
    const inputRow    = $('input-row');
    const introName   = $('intro-name');
    const introEmail  = $('intro-email');
    const introStart  = $('intro-start-btn');
    const introSkip   = $('intro-skip-btn');
    const lightbox      = $('lightbox');
    const lightboxImg   = lightbox.querySelector('img');
    const lightboxClose = $('lightbox-close');

    let busy = false;

    // ── Lightbox ──────────────────────────────────────────────────────────
    function openLightbox(src, alt) {
        lightboxImg.src = src;
        lightboxImg.alt = alt || 'Enlarged image';
        lightbox.classList.add('open');
    }
    function closeLightbox() {
        lightbox.classList.remove('open');
        lightboxImg.removeAttribute('src');
    }
    lightbox.addEventListener('click', e => { if (e.target !== lightboxImg) closeLightbox(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
    });
    msgs.addEventListener('click', e => {
        const img = e.target.closest('.msg-images img');
        if (!img) return;
        e.preventDefault();
        openLightbox(img.src, img.alt);
    });

    // ── Color helpers ─────────────────────────────────────────────────────
    // Parse "#rrggbb" → [r, g, b] and back, then darken by a fixed amount.
    const DEFAULT_COLOR      = '#499CB4';
    const DEFAULT_COLOR_DARK = '#3D8BA0';

    function hexToRgb(hex) {
        const h = hex.replace('#', '');
        return [
            parseInt(h.slice(0, 2), 16),
            parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16),
        ];
    }
    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
    }
    function darken(hex, amount = 18) {
        const [r, g, b] = hexToRgb(hex);
        return rgbToHex(r - amount, g - amount, b - amount);
    }
    function isValidHex(s) { return /^#[0-9a-f]{6}$/i.test(s); }

    function applyBrandColor(hex) {
        if (!hex || !isValidHex(hex)) return; // keep the CSS defaults
        const dark = darken(hex);
        // Rewrite CSS custom properties injected into the shadow DOM stylesheet
        const sheet = shadow.querySelector('style');
        if (!sheet) return;
        sheet.textContent = sheet.textContent
            .replace(/#499CB4/gi, hex)
            .replace(/#3D8BA0/gi, dark);
        // Also fix the toggle button if it's using the default brand color
        if (togBtn.style.background === DEFAULT_COLOR || togBtn.style.background === 'rgb(73, 156, 180)') {
            togBtn.style.background = hex;
            togBtn.style.boxShadow  = `0 4px 16px ${hex}70`;
        }
    }

    // ── Load bot info + session history in parallel ───────────────────────
    const historyUrl = `${serverOrigin}/api/history/${orgId}/${sessionToken}`;

    Promise.all([
        fetch(infoUrl).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(historyUrl).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([info, history]) => {

        // ── Apply bot branding ──────────────────────────────────────────
        if (info) {
            $('bot-title').textContent = `${info.name}`;
            if (info.brandColor) applyBrandColor(info.brandColor);

            if (info.iconPath) {
                const iconSrc = info.iconPath.startsWith('http')
                    ? info.iconPath
                    : serverOrigin + info.iconPath;
                togBtn.innerHTML = `<img src="${iconSrc}" alt="${info.name}" style="width:100%;height:100%;object-fit:contain;border-radius:50%;">`;
                togBtn.style.background = 'transparent';
                togBtn.style.boxShadow  = 'none';
                togBtn.style.border     = 'none';
                const img = document.createElement('img');
                img.src = iconSrc; img.alt = info.name;
                img.style.cssText = 'width:28px;height:28px;object-fit:contain;border-radius:50%;flex-shrink:0;';
                $('bot-title').before(img);
            } else {
                togBtn.style.background = '#499CB4';
                togBtn.style.color      = '#fff';
                togBtn.style.boxShadow  = '0 4px 16px rgba(0,188,212,.45)';
            }
        }

        // ── Restore history if we have messages ─────────────────────────
        const messages = history?.messages ?? [];
        if (messages.length > 0) {
            // Fill in stored name/email from server in case localStorage was cleared
            if (!userName && history.userName)  { userName  = history.userName;  ls(KEY_NAME,  userName); }
            if (!userEmail && history.userEmail) { userEmail = history.userEmail; ls(KEY_EMAIL, userEmail); }

            removePlaceholder();
            messages.forEach(m => {
                appendUserBubble(m.question);
                const images = m.images ? tryParseJson(m.images) : [];
                appendRestoredBotBubble(m.answer, images);
            });

            // Add a subtle "session restored" divider
            const divider = document.createElement('div');
            divider.style.cssText = 'text-align:center;color:#bbb;font-size:12px;padding:4px 0;';
            divider.textContent   = '— conversation restored —';
            msgs.appendChild(divider);
            scrollBottom();

            // History means intro was already done; ensure input is shown
            introCompleted = true;
            ls(KEY_INTRO, '1');
            introForm.classList.add('hidden');
            inputRow.classList.remove('hidden');

        } else if (info?.greeting && !introCompleted) {
            // No history and has a greeting → show the greeting + intro form
            removePlaceholder();
            appendBotBubble(info.greeting);
            introForm.classList.remove('hidden');
            inputRow.classList.add('hidden');
        }
    });

    // ── Intro form ────────────────────────────────────────────────────────
    function completeIntro() {
        userName  = introName.value.trim();
        userEmail = introEmail.value.trim();
        ls(KEY_NAME,  userName);
        ls(KEY_EMAIL, userEmail);
        ls(KEY_INTRO, '1');
        introCompleted = true;
        introForm.classList.add('hidden');
        inputRow.classList.remove('hidden');
        // Optionally show a friendly "got it" message if a name was given
        if (userName) {
            appendBotBubble(`Nice to meet you, ${esc(userName)}! What would you like to know?`);
        }
        input.focus();
    }

    introStart.addEventListener('click', completeIntro);
    introSkip.addEventListener('click', () => {
        introName.value  = '';
        introEmail.value = '';
        completeIntro();
    });
    introEmail.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); completeIntro(); }
    });

    // ── Panel toggle ──────────────────────────────────────────────────────
    function openPanel() {
        panel.classList.add('open');
        togBtn.setAttribute('aria-expanded', 'true');
        if (!introForm.classList.contains('hidden')) {
            introName.focus();
        } else {
            input.focus();
        }
    }
    function closePanel() {
        panel.classList.remove('open');
        togBtn.setAttribute('aria-expanded', 'false');
    }

    togBtn.addEventListener('click', () => panel.classList.contains('open') ? closePanel() : openPanel());
    closeBtn.addEventListener('click', closePanel);

    // ── Expand / collapse ─────────────────────────────────────────────────
    const ICON_EXPAND   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    const ICON_COLLAPSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="10" y1="14" x2="3" y2="21"/></svg>`;

    function setExpanded(on) {
        panel.classList.toggle('expanded', on);
        expandBtn.innerHTML = on ? ICON_COLLAPSE : ICON_EXPAND;
        expandBtn.setAttribute('aria-pressed', String(on));
        expandBtn.setAttribute('aria-label', on ? 'Collapse chat' : 'Expand chat');
        scrollBottom();
    }
    expandBtn.addEventListener('click', () => setExpanded(!panel.classList.contains('expanded')));

    // ── Auto-resize textarea ──────────────────────────────────────────────
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    });

    // ── Keyboard ─────────────────────────────────────────────────────────
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    sendBtn.addEventListener('click', send);

    // ── Message helpers ───────────────────────────────────────────────────
    function removePlaceholder() {
        const p = $('placeholder');
        if (p) p.remove();
    }

    function appendBotBubble(text) {
        removePlaceholder();
        const el = document.createElement('div');
        el.className = 'msg bot';
        el.innerHTML = `<div class="bubble">${formatAnswer(text)}</div>`;
        msgs.appendChild(el);
        scrollBottom();
        return el;
    }

    function appendUserBubble(text) {
        removePlaceholder();
        const el = document.createElement('div');
        el.className = 'msg user';
        el.innerHTML = `<div class="bubble">${esc(text)}</div>`;
        msgs.appendChild(el);
        scrollBottom();
    }

    function appendTyping() {
        const el = document.createElement('div');
        el.className = 'msg bot';
        el.innerHTML = `<div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
        msgs.appendChild(el);
        scrollBottom();
        return el;
    }

    function resolveTyping(el, answer, images) {
        const imgHtml = images && images.length
            ? `<div class="msg-images">${images.map(u => {
                const src = u.startsWith('http') ? u : serverOrigin + u;
                return `<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="Related image" title="Click to enlarge" loading="lazy"></a>`;
              }).join('')}</div>`
            : '';
        el.innerHTML = `<div class="bubble">${formatAnswer(answer)}</div>${imgHtml}`;
        scrollBottom();
    }

    // Restored messages look identical to live ones but are built without animation
    function appendRestoredBotBubble(answer, images) {
        const imgHtml = images && images.length
            ? `<div class="msg-images">${images.map(u => {
                const src = u.startsWith('http') ? u : serverOrigin + u;
                return `<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="Related image" title="Click to enlarge" loading="lazy"></a>`;
              }).join('')}</div>`
            : '';
        const el = document.createElement('div');
        el.className = 'msg bot';
        el.innerHTML = `<div class="bubble">${formatAnswer(answer)}</div>${imgHtml}`;
        msgs.appendChild(el);
    }

    function tryParseJson(s) {
        try { return JSON.parse(s); } catch (_) { return []; }
    }

    function formatAnswer(text) {
        return esc(text)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    function esc(s) {
        return String(s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function scrollBottom() { msgs.scrollTop = msgs.scrollHeight; }

    // ── Send ──────────────────────────────────────────────────────────────
    async function send() {
        if (busy) return;
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        input.style.height = 'auto';
        setBusy(true);

        appendUserBubble(text);
        const typingEl = appendTyping();

        try {
            const res = await fetch(apiUrl, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    question:  text,
                    sessionId: sessionToken,
                    userName:  userName  || null,
                    userEmail: userEmail || null,
                }),
            });
            if (!res.ok) throw new Error(`Server responded ${res.status}`);
            const data = await res.json();
            resolveTyping(typingEl, data.answer, data.images);
        } catch (err) {
            resolveTyping(typingEl, 'Sorry, something went wrong. Please try again.', []);
            console.error('[ChatBot]', err);
        } finally {
            setBusy(false);
            input.focus();
        }
    }

    function setBusy(val) {
        busy           = val;
        sendBtn.disabled = val;
        input.disabled   = val;
    }
})();
