/* ================================================================
   TANixity — AI Command Interface
   script.js  |  All logic: config, API calls, UI, typewriter effect
   ================================================================ */

/* ----------------------------------------------------------------
   ██████╗  CONFIG — PASTE YOUR GEMINI API KEY HERE
   ----------------------------------------------------------------
   HOW TO GET AN API KEY:
   1. Go to  https://aistudio.google.com/app/apikey
   2. Sign in with your Google account
   3. Click "Create API Key"
   4. Copy the key and paste it below (replace the empty string)
   5. Save this file and open index.html in your browser
   ---------------------------------------------------------------- */
const CONFIG = {
  GEMINI_API_KEY: "AIzaSyBhpYjYUTJwJc0u8CqBykFnroTxFfCp8Fg",                   // ← PASTE YOUR KEY HERE

  MODEL:       "gemini-1.5-flash",      // Gemini model to use
  MAX_TOKENS:  2048,                    // Maximum reply length (tokens)
  TEMPERATURE: 0.8,                     // Creativity: 0 = precise, 1 = creative

  /* TANixity's personality prompt — edit freely */
  SYSTEM_PROMPT: `You are TANixity, a highly advanced AI assistant with a sleek,
professional, and slightly futuristic personality. You are precise, helpful, and
efficient. Respond in a clear, structured way. You may use markdown formatting
(bold, code blocks, lists) when it improves readability. Keep responses concise
unless depth is required.`,
};

/* ----------------------------------------------------------------
   APPLICATION STATE
   ---------------------------------------------------------------- */
const state = {
  isTyping:     false,  // Prevents sending while bot is replying
  history:      [],     // Full conversation history (multi-turn context)
  messageCount: 0,      // Total messages sent this session
};

/* ----------------------------------------------------------------
   DOM REFERENCES — cached once on load
   ---------------------------------------------------------------- */
const chatWindow = document.getElementById("chat-window");
const userInput  = document.getElementById("user-input");
const sendBtn    = document.getElementById("send-btn");
const welcome    = document.getElementById("welcome");
const sysBanner  = document.getElementById("sys-banner");
const charCount  = document.getElementById("char-count");

/* ================================================================
   INIT — runs on page load
   ================================================================ */
function init() {
  // Show or hide the "no API key" warning banner
  if (CONFIG.GEMINI_API_KEY && CONFIG.GEMINI_API_KEY.trim() !== "") {
    sysBanner.classList.add("hidden");
  }

  // Auto-resize the textarea as the user types
  userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
    charCount.textContent  = `${userInput.value.length} / 4000`;
  });

  // Keyboard shortcut: Enter = send, Shift+Enter = new line
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Send button click
  sendBtn.addEventListener("click", handleSend);
}

/* ================================================================
   QUICK PROMPT BUTTONS (welcome screen)
   ================================================================ */
function quickPrompt(btn) {
  userInput.value       = btn.textContent;
  charCount.textContent = `${userInput.value.length} / 4000`;
  handleSend();
}

/* ================================================================
   SHOW CHAT / HIDE WELCOME
   ================================================================ */
function showChat() {
  if (welcome.style.display !== "none") {
    welcome.style.display       = "none";
    chatWindow.style.display    = "flex";
    chatWindow.style.flexDirection = "column";
  }
}

/* ================================================================
   APPEND USER MESSAGE BUBBLE
   ================================================================ */
function appendUserMessage(text) {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const div  = document.createElement("div");
  div.className = "msg user";
  div.innerHTML = `
    <div>
      <div class="bubble">${escapeHtml(text)}</div>
      <div class="msg-meta">${time} · YOU</div>
    </div>
    <div class="avatar user-av">👤</div>
  `;
  chatWindow.appendChild(div);
  scrollBottom();
}

/* ================================================================
   APPEND BOT MESSAGE BUBBLE
   Returns the bubble <div> so the typewriter can write into it.
   ================================================================ */
function appendBotMessage() {
  const time    = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const wrapper = document.createElement("div");
  wrapper.className = "msg bot";

  const bubble = document.createElement("div");
  bubble.className = "bubble typing-cursor";

  const meta = document.createElement("div");
  meta.className   = "msg-meta";
  meta.textContent = `${time} · TANIXITY`;

  const inner = document.createElement("div");
  inner.appendChild(bubble);
  inner.appendChild(meta);

  wrapper.innerHTML = `<div class="avatar bot">🤖</div>`;
  wrapper.appendChild(inner);
  chatWindow.appendChild(wrapper);
  scrollBottom();
  return bubble;
}

/* ================================================================
   THINKING / LOADING INDICATOR
   ================================================================ */
function showThinking() {
  const wrapper = document.createElement("div");
  wrapper.className = "msg bot";
  wrapper.id        = "thinking-indicator";
  wrapper.innerHTML = `
    <div class="avatar bot">🤖</div>
    <div class="bubble">
      <div class="thinking">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatWindow.appendChild(wrapper);
  scrollBottom();
}

function hideThinking() {
  const el = document.getElementById("thinking-indicator");
  if (el) el.remove();
}

/* ================================================================
   HANDLE SEND — main entry point for submitting a message
   ================================================================ */
async function handleSend() {
  const text = userInput.value.trim();
  if (!text || state.isTyping) return;

  // Guard: check API key before doing anything
  if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY.trim() === "") {
    showError("⚠ No API key configured. Open script.js and fill in GEMINI_API_KEY inside CONFIG.");
    return;
  }

  // Reset input field
  userInput.value       = "";
  userInput.style.height = "auto";
  charCount.textContent  = "0 / 4000";

  // Lock UI while waiting
  state.isTyping = true;
  sendBtn.disabled = true;
  state.messageCount++;

  // Render user bubble and transition to chat view
  showChat();
  appendUserMessage(text);

  // Add user turn to conversation history (for multi-turn context)
  state.history.push({ role: "user", parts: [{ text }] });

  // Show animated dots while waiting for the API
  showThinking();

  try {
    const reply = await callGemini(state.history);
    hideThinking();
    await typewriterEffect(reply);

    // Save bot turn to history
    state.history.push({ role: "model", parts: [{ text: reply }] });

    // Keep history trimmed to last 20 turns (avoid exceeding token limits)
    if (state.history.length > 20) {
      state.history = state.history.slice(state.history.length - 20);
    }
  } catch (err) {
    hideThinking();
    showError(`ERROR: ${err.message}`);
  } finally {
    // Unlock UI
    state.isTyping   = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

/* ================================================================
   CALL GEMINI API
   Uses the native Fetch API — no external libraries required.
   ================================================================ */
async function callGemini(history) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

  const body = {
    system_instruction: {
      parts: [{ text: CONFIG.SYSTEM_PROMPT }]
    },
    contents: history,
    generationConfig: {
      maxOutputTokens: CONFIG.MAX_TOKENS,
      temperature:     CONFIG.TEMPERATURE,
    },
  };

  const response = await fetch(endpoint, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  // Handle HTTP errors (bad key, quota exceeded, etc.)
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const msg     = errData?.error?.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("Empty response from Gemini API.");
  return text;
}

/* ================================================================
   TYPEWRITER EFFECT
   Streams the reply character-by-character for a futuristic feel,
   then swaps in the fully-rendered markdown at the end.
   ================================================================ */
async function typewriterEffect(fullText) {
  const bubble   = appendBotMessage();
  const rendered = markdownToHtml(fullText);

  let displayed = "";
  const chars   = [...fullText];                           // handles multi-byte chars (emoji etc.)
  const delay   = Math.max(6, Math.min(22, 1200 / chars.length)); // adaptive speed

  for (let i = 0; i < chars.length; i++) {
    displayed += chars[i];
    bubble.textContent = displayed;         // raw text while typing
    if (i % 10 === 0) scrollBottom();       // keep scroll pinned
    await sleep(delay);
  }

  // Swap raw text for formatted HTML once typing is complete
  bubble.classList.remove("typing-cursor");
  bubble.innerHTML = rendered;
  scrollBottom();
}

/* ================================================================
   ERROR BUBBLE
   ================================================================ */
function showError(msg) {
  const div = document.createElement("div");
  div.className = "msg bot";
  div.innerHTML = `
    <div class="avatar bot">⚠</div>
    <div>
      <div class="bubble"
           style="border-left-color: var(--accent-red);
                  color: #ff8a9a;
                  font-family: var(--font-mono);
                  font-size: 0.78rem;">
        ${escapeHtml(msg)}
      </div>
    </div>
  `;
  chatWindow.appendChild(div);
  scrollBottom();
}

/* ================================================================
   MARKDOWN → HTML RENDERER
   Lightweight parser — no external lib needed.
   Supports: code blocks, inline code, bold, italic, lists, line breaks
   ================================================================ */
function markdownToHtml(md) {
  // Escape HTML entities first to prevent XSS
  let html = escapeHtml(md);

  // Fenced code blocks  (``` lang \n code ```)
  html = html.replace(/```([a-z]*)\n?([\s\S]*?)```/g, (_match, _lang, code) =>
    `<pre style="background:#020a0f;border:1px solid #0e2535;border-radius:4px;
      padding:10px 12px;overflow-x:auto;margin:8px 0;font-size:0.78rem;
      color:#a0d8ef;font-family:var(--font-mono)"><code>${code.trim()}</code></pre>`
  );

  // Inline code  (`code`)
  html = html.replace(/`([^`]+)`/g,
    `<code style="background:#011018;color:#00ff9d;padding:1px 5px;
      border-radius:3px;font-family:var(--font-mono);font-size:0.85em">$1</code>`
  );

  // Bold  (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic  (*text*)
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Unordered list items  (- item)
  html = html.replace(/^- (.+)$/gm,
    `<li style="margin-left:16px;margin-bottom:3px">$1</li>`
  );

  // Paragraph breaks and single line breaks
  html = html
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g,   "<br>");

  return html;
}

/* ================================================================
   UTILITIES
   ================================================================ */

/** Scroll the chat window to the very bottom */
function scrollBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/** Promise-based sleep */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Escape HTML special characters to prevent XSS */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ================================================================
   BOOT — initialise the app when the DOM is ready
   ================================================================ */
init();
