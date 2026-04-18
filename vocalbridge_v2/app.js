/* ── State ── */
var currentStep = 0;
var userName    = '';
var listening   = false;
var listenInt   = null;
var muted       = false;
var speaking    = false;
var activeChar  = 'neutral';
var activeSource = 'zoom';
var openMenu    = null;
var TOTAL_STEPS = 4;

var sources = [
  { id: 'zoom',   label: 'Zoom',        sub: 'Connected'    },
  { id: 'meet',   label: 'Google Meet', sub: 'Connected'    },
  { id: 'teams',  label: 'MS Teams',    sub: 'Connected'    },
  { id: 'phone',  label: 'Phone call',  sub: 'System audio' },
];

var chars = [
  { id: 'neutral', label: 'Neutral', g: '#B5D4F4,#185FA5' },
  { id: 'warm',    label: 'Warm',    g: '#FAC775,#BA7517' },
  { id: 'calm',    label: 'Calm',    g: '#9FE1CB,#0F6E56' },
  { id: 'formal',  label: 'Formal',  g: '#AFA9EC,#534AB7' },
  { id: 'bright',  label: 'Bright',  g: '#F4C0D1,#993556' },
  { id: 'deep',    label: 'Deep',    g: '#97C459,#3B6D11' },
  { id: 'clear',   label: 'Clear',   g: '#85B7EB,#0C447C' },
  { id: 'soft',    label: 'Soft',    g: '#F0997B,#993C1D' },
  { id: 'bold',    label: 'Bold',    g: '#5DCAA5,#085041' },
];

/* ── Helpers ── */
function personSVG(color) {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
}

function waveBars(color, anim) {
  var heights = anim ? [5, 11, 17, 9, 15, 7, 13] : [3, 3, 3, 3, 3, 3, 3];
  return heights.map(function(h, i) {
    var s = 'width:3px;height:' + h + 'px;background:' + color + ';border-radius:2px;transform-origin:bottom;flex-shrink:0;';
    if (anim) s += 'animation:wpulse ' + (0.5 + i * 0.07).toFixed(2) + 's ease ' + (i * 0.04).toFixed(2) + 's infinite;';
    return '<div style="' + s + '"></div>';
  }).join('');
}

/* ── Onboarding ── */
function initDots() {
  for (var i = 0; i < TOTAL_STEPS; i++) {
    var el = document.getElementById('dots-' + i);
    if (!el) continue;
    el.innerHTML = '';
    for (var j = 0; j < TOTAL_STEPS; j++) {
      var d = document.createElement('div');
      d.className = 'dot' + (j === i ? ' on' : '');
      el.appendChild(d);
    }
  }
}

function goToStep(n) {
  for (var i = 0; i <= 4; i++) {
    var el = document.getElementById('step-' + i);
    if (el) el.classList.remove('active');
  }
  var target = document.getElementById('step-' + n);
  if (target) target.classList.add('active');
  currentStep = n;
  stopListening();
  if (n === 4) updateMainPill();
  if (n === 0) setTimeout(function() { document.getElementById('name-input').focus(); }, 50);
}

function advance(from) {
  if (from === 0) {
    var v = document.getElementById('name-input').value.trim();
    if (v) userName = v;
  }
  goToStep(from + 1);
  if (from + 1 === 3) setGreeting();
}

function skip(step) {
  goToStep(step + 1);
  if (step + 1 === 3) setGreeting();
}

function setGreeting() {
  document.getElementById('greeting').textContent =
    userName ? 'Welcome, ' + userName + '! You\'re all set.' : 'You\'re all set!';
}

function enterProduct() { goToStep(4); }

function restartOnboarding() { userName = ''; goToStep(0); }

/* ── Voice listen (simulated) ── */
function toggleListening() {
  if (listening) { stopListening(); return; }
  listening = true;
  var btn = document.getElementById('listen-btn');
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop';
  btn.style.background = '#A32D2D';
  var bars = document.querySelectorAll('#wave-wrap .wbar');
  var base  = [8, 14, 20, 10, 18, 12, 16];
  listenInt = setInterval(function() {
    bars.forEach(function(b, i) {
      var h = Math.max(3, Math.round(base[i] * (0.3 + Math.random() * 0.9)));
      b.style.height = h + 'px';
      b.style.animation = 'wpulse ' + (0.45 + Math.random() * 0.4).toFixed(2) + 's ease infinite';
    });
  }, 130);
}

function stopListening() {
  listening = false;
  if (listenInt) { clearInterval(listenInt); listenInt = null; }
  var btn = document.getElementById('listen-btn');
  if (btn) {
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg> Listen';
    btn.style.background = '#185FA5';
  }
  document.querySelectorAll('#wave-wrap .wbar').forEach(function(b) {
    b.style.height = '4px'; b.style.animation = 'none';
  });
}

function onFileChange(input) {
  var st = document.getElementById('upload-status');
  var nb = document.getElementById('upload-next');
  if (input.files && input.files[0]) {
    st.textContent = input.files[0].name;
    st.style.color = '#3B6D11';
    nb.style.opacity = '1';
    nb.style.pointerEvents = 'auto';
  }
}

/* ── Main pill ── */
function updateMainPill() {
  var icon  = document.getElementById('pill-voice-icon');
  var label = document.getElementById('pill-voice-label');
  if (speaking) {
    icon.innerHTML = waveBars('#185FA5', true);
    label.textContent = 'Transmitting';
    label.style.color = '#185FA5';
  } else {
    icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
    label.textContent = 'My voice';
    label.style.color = '#333';
  }
  if (openMenu === 'voice') buildVoicePopup();
}

function setSpeaking(v) {
  speaking = v;
  ['idle', 'speaking'].forEach(function(id) {
    var t  = document.getElementById('sim-' + id);
    var on = (id === 'speaking' && v) || (id === 'idle' && !v);
    if (t) { t.style.background = on ? '#185FA5' : 'white'; t.style.color = on ? 'white' : '#555'; t.style.borderColor = on ? '#185FA5' : '#ccc'; }
  });
  if (currentStep === 4) updateMainPill();
}

function toggleMute() {
  muted = !muted;
  var sl = document.getElementById('mute-status-label');
  var tb = document.getElementById('mute-toggle-btn');
  var pl = document.getElementById('mute-pill-label');
  if (sl) sl.textContent = muted ? 'Mic is muted' : 'Mic is live';
  if (tb) { tb.textContent = muted ? 'Unmute' : 'Mute'; tb.style.background = muted ? '#A32D2D' : '#185FA5'; }
  if (pl) { pl.textContent = muted ? 'Unmute' : 'Mute'; pl.style.color = muted ? '#A32D2D' : '#333'; }
}

/* ── Popups ── */
function buildVoicePopup() {
  var bars  = document.getElementById('pop-bars');
  var label = document.getElementById('pop-speak-label');
  bars.innerHTML = waveBars('#185FA5', speaking);
  label.textContent = speaking ? 'Transmitting' : 'Mic idle';
  label.style.color  = speaking ? '#185FA5' : '#999';
}

function buildCharGrid() {
  var g = document.getElementById('char-grid');
  g.innerHTML = '';
  chars.forEach(function(c) {
    var d = document.createElement('div');
    d.className = 'char-item' + (activeChar === c.id ? ' sel' : '');
    d.onclick = function() { activeChar = c.id; buildCharGrid(); };
    d.innerHTML = '<div class="char-circle" style="background:linear-gradient(135deg,' + c.g + ');">' + personSVG('white') + '</div><div class="char-label">' + c.label + '</div>';
    g.appendChild(d);
  });
}

function buildSrcList() {
  var l = document.getElementById('src-list');
  l.innerHTML = '';
  sources.forEach(function(s) {
    var sel = activeSource === s.id;
    var d   = document.createElement('div');
    d.className = 'src-item' + (sel ? ' sel-src' : '');
    d.onclick = function() {
      activeSource = s.id;
      document.getElementById('src-pill-label').textContent = s.label;
      buildSrcList();
    };
    d.innerHTML =
      '<div class="src-dot' + (sel ? ' on' : '') + '"></div>' +
      '<div style="flex:1;"><div class="src-name">' + s.label + '</div><div class="src-sub">' + s.sub + '</div></div>' +
      (sel ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#185FA5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' : '');
    l.appendChild(d);
  });
}

function toggleMenu(name, e) {
  e.stopPropagation();
  var was = openMenu === name;
  ['voice', 'clones', 'chars', 'mute', 'source'].forEach(function(m) {
    document.getElementById('popup-' + m).classList.remove('show');
  });
  openMenu = null;
  if (!was) {
    document.getElementById('popup-' + name).classList.add('show');
    openMenu = name;
    if (name === 'voice')  buildVoicePopup();
    if (name === 'chars')  buildCharGrid();
    if (name === 'source') buildSrcList();
  }
}

document.addEventListener('click', function() {
  ['voice', 'clones', 'chars', 'mute', 'source'].forEach(function(m) {
    document.getElementById('popup-' + m).classList.remove('show');
  });
  openMenu = null;
});

/* ── Init ── */
initDots();
buildCharGrid();
buildSrcList();
document.getElementById('name-input').focus();
