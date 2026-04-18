var speaking = false;
var cloneStatus = 'ok';
var activeChar = 'neutral';
var muted = false;
var activeSource = 'zoom';
var openMenu = null;

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

/* ── SVG helpers ── */
function svg(path, color) {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" style="flex-shrink:0">' + path + '</svg>';
}
var paths = {
  mic:    '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>',
  mute:   '<line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><line x1="12" y1="19" x2="12" y2="23"/>',
  clone:  '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4"/><circle cx="17" cy="17" r="4"/><path d="M14 17h6"/><path d="M17 14v6"/>',
  warn:   '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  char:   '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M6.17 18a6 6 0 0 1 11.66 0"/>',
  switch: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  check:  '<polyline points="20 6 9 17 4 12"/>',
};
function personSVG(c) {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
}

/* ── Wave bars ── */
function waveBars(color, anim) {
  var heights = anim ? [6, 12, 18, 10, 16, 8, 14] : [3, 3, 3, 3, 3, 3, 3];
  return heights.map(function(h, i) {
    var style = 'width:3px;height:' + h + 'px;background:' + color + ';border-radius:2px;transform-origin:bottom;flex-shrink:0;';
    if (anim) style += 'animation:pulse ' + (0.55 + i * 0.07).toFixed(2) + 's ease ' + (i * 0.05).toFixed(2) + 's infinite;';
    return '<div style="' + style + '"></div>';
  }).join('');
}

function sep() {
  return '<div class="psep"></div>';
}

/* ── Build functions ── */
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
    var d = document.createElement('div');
    d.className = 'src-item' + (sel ? ' sel-src' : '');
    d.onclick = function() { activeSource = s.id; buildSrcList(); buildPill(); };
    d.innerHTML =
      '<div class="src-dot' + (sel ? ' on' : '') + '"></div>' +
      '<div style="flex:1;"><div class="src-name">' + s.label + '</div><div class="src-sub">' + s.sub + '</div></div>' +
      (sel ? svg(paths.check, '#185FA5') : '');
    l.appendChild(d);
  });
}

function buildCloneRow() {
  var r = document.getElementById('clone-row');
  if (cloneStatus === 'ok') {
    r.innerHTML =
      '<div class="wav-icon" style="background:#EAF3DE;">' + svg('<polyline points="20 6 9 17 4 12"/>', '#3B6D11') + '</div>' +
      '<div style="flex:1;"><div class="wav-name">pre_surgery_voice.wav</div><div class="wav-sub">2m 34s · Good clarity</div></div>' +
      '<span class="badge b-green">Ready</span>';
  } else if (cloneStatus === 'processing') {
    r.innerHTML =
      '<div class="wav-icon" style="background:#FAEEDA;">' + svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', '#BA7517') + '</div>' +
      '<div style="flex:1;"><div class="wav-name">new_upload.wav</div><div class="wav-sub">Replicating voice…</div></div>' +
      '<span class="badge b-amber">Processing</span>';
  } else {
    r.innerHTML =
      '<div class="wav-icon" style="background:#FCEBEB;">' + svg('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>', '#A32D2D') + '</div>' +
      '<div style="flex:1;"><div class="wav-name">recording_v2.wav</div><div class="wav-sub" style="color:#A32D2D;">Audio quality too low</div></div>' +
      '<span class="badge b-red">Error</span>';
  }
}

function buildVoicePopup() {
  var bars  = document.getElementById('speak-bars');
  var label = document.getElementById('speak-label');
  bars.innerHTML = waveBars('#185FA5', speaking);
  label.textContent = speaking ? 'Transmitting' : 'Mic idle';
  label.style.color = speaking ? '#185FA5' : '#999';
}

function buildPill() {
  var pill = document.getElementById('pill');
  var err  = cloneStatus === 'error';
  var src  = sources.find(function(s) { return s.id === activeSource; });

  var voiceLabel = speaking ? 'Transmitting' : 'My voice';
  var voiceIcon  = speaking
    ? '<div style="display:flex;align-items:flex-end;gap:2px;height:14px;">' + waveBars('#185FA5', true) + '</div>'
    : svg(paths.mic, '#555');

  pill.innerHTML =
    '<button class="pb" onclick="toggleMenu(\'voice\',event)">'  + voiceIcon + '<span>' + voiceLabel + '</span></button>' +
    sep() +
    '<button class="pb" onclick="toggleMenu(\'clones\',event)">' + (err ? svg(paths.warn, '#E24B4A') : svg(paths.clone, '#555')) + '<span style="color:' + (err ? '#E24B4A' : '#333') + ';">Clones</span></button>' +
    sep() +
    '<button class="pb" onclick="toggleMenu(\'chars\',event)">'  + svg(paths.char, '#555') + '<span>Characters</span></button>' +
    sep() +
    '<button class="pb' + (muted ? ' muted' : '') + '" onclick="toggleMute()">' + svg(paths.mute, muted ? 'white' : '#555') + '<span>' + (muted ? 'Unmute' : 'Mute') + '</span></button>' +
    sep() +
    '<button class="pb" onclick="toggleMenu(\'source\',event)">' + svg(paths.switch, '#555') + '<span>' + src.label + '</span></button>';
}

/* ── Event handlers ── */
function toggleMenu(name, e) {
  e.stopPropagation();
  var was = openMenu === name;
  ['voice', 'clones', 'chars', 'source'].forEach(function(m) {
    document.getElementById('popup-' + m).classList.remove('show');
  });
  openMenu = null;
  if (!was) {
    document.getElementById('popup-' + name).classList.add('show');
    openMenu = name;
  }
  if (name === 'voice') buildVoicePopup();
}

document.addEventListener('click', function() {
  ['voice', 'clones', 'chars', 'source'].forEach(function(m) {
    document.getElementById('popup-' + m).classList.remove('show');
  });
  openMenu = null;
});

function toggleMute() {
  muted = !muted;
  buildPill();
}

function setSpeaking(v) {
  speaking = v;
  ['idle', 'speaking'].forEach(function(id) {
    var t = document.getElementById('sim-' + id);
    var on = (id === 'speaking' && v) || (id === 'idle' && !v);
    if (t) { t.style.background = on ? '#185FA5' : 'white'; t.style.color = on ? 'white' : '#666'; t.style.borderColor = on ? '#185FA5' : '#ddd'; }
  });
  buildPill();
  if (openMenu === 'voice') buildVoicePopup();
}

function setCS(s) {
  cloneStatus = s;
  [{ k: 'ok', v: 'ok' }, { k: 'proc', v: 'processing' }, { k: 'err', v: 'error' }].forEach(function(x) {
    var t = document.getElementById('cs-' + x.k);
    if (t) { t.style.background = x.v === s ? '#185FA5' : 'white'; t.style.color = x.v === s ? 'white' : '#666'; t.style.borderColor = x.v === s ? '#185FA5' : '#ddd'; }
  });
  buildCloneRow();
  buildPill();
}

/* ── Init ── */
buildCharGrid();
buildSrcList();
buildCloneRow();
buildPill();
