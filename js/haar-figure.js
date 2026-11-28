/* Figure 13 of the Haar Graphs post (post-haar.html).

   Draws the cyclic Haar graph H(Z_n, S) the way Figure 2 draws the Heawood graph, and traces the faces of
   the rotation system that uses the cyclic order alpha at every A-vertex and beta at every B-vertex.
   The face tracing is the rule from the post:
       F(g, s)_A = (g + s, beta(s))_B      and      F(g, s)_B = (g - s, alpha(s))_A,
   where (g, s)_A is the dart A_g -> B_(g+s) and (g, s)_B is the dart B_g -> A_(g-s).

   No libraries. The figure stays hidden if this script does not run. */
(function () {
  'use strict';
  var fig = document.getElementById('haar-try');
  if (!fig || !document.createElementNS) return;

  var NS = 'http://www.w3.org/2000/svg';
  var svg = fig.querySelector('.haar-try-graph');
  var nInput = document.getElementById('haar-n');
  var nOut = document.getElementById('haar-n-out');
  var setBox = document.getElementById('haar-S');
  var alphaSel = document.getElementById('haar-alpha');
  var betaSel = document.getElementById('haar-beta');
  var out = document.getElementById('haar-out');
  var key = document.getElementById('haar-key');
  var turn = document.getElementById('haar-turn');
  if (!svg || !nInput || !setBox || !alphaSel || !betaSel || !out || !key) return;

  /* The colors of labels 0, 1 and 3 in Figure 2, and one more for a fourth label. */
  var COLORS = ['#22735a', '#345ea5', '#855298', '#7d7420'];
  var MAX_LABELS = COLORS.length;
  var CX = 180, CY = 180, R = 122;

  var n = 7, S = [0, 1, 3], alpha = [0, 1, 3], beta = [0, 1, 3];

  function mod(x) { return ((x % n) + n) % n; }
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function f1(x) { return x.toFixed(1); }

  /* Figure 2 places A_0 at the top and then, going clockwise, B_0, A_(n-1), B_(n-1), A_(n-2), ... */
  function point(slot, r) {
    var a = -Math.PI / 2 + slot * Math.PI / n;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  }
  function posA(i, r) { return point(-2 * i, r); }
  function posB(j, r) { return point(1 - 2 * j, r); }

  /* Every cyclic order on S, each written starting from the least element. */
  function cyclicOrders(set) {
    if (set.length < 2) return [set.slice()];
    var rest = set.slice(1), result = [];
    (function permute(done, left) {
      if (!left.length) { result.push([set[0]].concat(done)); return; }
      for (var i = 0; i < left.length; i++) permute(done.concat([left[i]]), left.slice(0, i).concat(left.slice(i + 1)));
    })([], rest);
    return result;
  }
  function next(order) {
    var map = {};
    for (var i = 0; i < order.length; i++) map[order[i]] = order[(i + 1) % order.length];
    return map;
  }

  /* Orbits of F on the darts. Returns the length of every face, the vertices of the face through A_0 -> B_(s_0),
     and the number of connected components. */
  function trace() {
    var a = next(alpha), b = next(beta), seen = {}, lengths = [], first = null;
    for (var cls = 0; cls < 2; cls++) for (var g = 0; g < n; g++) for (var i = 0; i < S.length; i++) {
      var d = [cls, g, S[i]];
      if (seen[d.join(',')]) continue;
      var walk = [], len = 0;
      while (!seen[d.join(',')]) {
        seen[d.join(',')] = true;
        walk.push(d[0] === 0 ? ['A', d[1]] : ['B', d[1]]);
        len++;
        d = d[0] === 0 ? [1, mod(d[1] + d[2]), b[d[2]]] : [0, mod(d[1] - d[2]), a[d[2]]];
      }
      lengths.push(len);
      if (first === null) first = walk;
    }
    var parent = [], components = 2 * n, j;
    for (j = 0; j < 2 * n; j++) parent.push(j);
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    for (g = 0; g < n; g++) for (i = 0; i < S.length; i++) {
      var p = find(g), q = find(n + mod(g + S[i]));
      if (p !== q) { parent[p] = q; components--; }
    }
    return { lengths: lengths, first: first, components: components };
  }

  function label(letter, index, at, size) {
    var t = el('text', { x: f1(at[0]), y: f1(at[1] + size * 0.32), 'text-anchor': 'middle', 'font-size': size, 'font-style': 'italic' }, svg);
    t.appendChild(document.createTextNode(letter));
    var sub = el('tspan', { 'font-size': f1(size * 0.68), 'font-style': 'normal', dy: f1(size * 0.26) }, t);
    sub.appendChild(document.createTextNode(String(index)));
  }

  function draw() {
    var info = trace(), i, j, m = S.length;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    /* the facial walk through A_0 -> B_(s_0), under the edges */
    var d = '';
    for (i = 0; i < info.first.length; i++) {
      var v = info.first[i], at = v[0] === 'A' ? posA(v[1], R) : posB(v[1], R);
      d += (i ? 'L' : 'M') + f1(at[0]) + ' ' + f1(at[1]);
    }
    el('path', { d: d + 'Z', 'class': 'haar-try-walk' }, svg);

    /* the graph itself, in a group that can turn */
    var graph = el('g', { 'class': 'haar-try-turning' }, svg);
    for (i = 0; i < n; i++) for (j = 0; j < m; j++) {
      var p = posA(i, R), q = posB(mod(i + S[j]), R);
      var dx = q[0] - p[0], dy = q[1] - p[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
      el('line', { x1: f1(p[0]), y1: f1(p[1]), x2: f1(q[0] - dx / len * 4.6), y2: f1(q[1] - dy / len * 4.6), stroke: COLORS[j], 'stroke-width': 1.7, 'stroke-linecap': 'round' }, graph);
    }
    for (i = 0; i < n; i++) {
      var pa = posA(i, R), pb = posB(i, R);
      el('circle', { cx: f1(pa[0]), cy: f1(pa[1]), r: 4.8, 'class': 'haar-try-a' }, graph);
      el('circle', { cx: f1(pb[0]), cy: f1(pb[1]), r: 4.1, 'class': 'haar-try-b' }, graph);
    }
    var size = n > 9 ? 13.5 : 16;
    for (i = 0; i < n; i++) { label('A', i, posA(i, R + 23), size); label('B', i, posB(i, R + 23), size); }

    /* which color is which label, as under Figure 2 */
    while (key.firstChild) key.removeChild(key.firstChild);
    for (j = 0; j < m; j++) {
      var span = document.createElement('span');
      span.style.setProperty('--edge', COLORS[j]);
      span.appendChild(document.createTextNode(String(S[j])));
      key.appendChild(span);
    }

    /* the count */
    var V = 2 * n, E = n * m, F = info.lengths.length, counts = {}, kinds = [];
    for (i = 0; i < F; i++) { if (!counts[info.lengths[i]]) { counts[info.lengths[i]] = 0; kinds.push(info.lengths[i]); } counts[info.lengths[i]]++; }
    kinds.sort(function (x, y) { return x - y; });
    var faces = kinds.length === 1
      ? F + (F === 1 ? ' face' : ' faces') + ' of length ' + kinds[0]
      : F + ' faces: ' + kinds.map(function (k) { return counts[k] + ' of length ' + k; }).join(', ');
    var lines = [V + ' vertices, ' + E + ' edges', faces];
    if (info.components === 1) {
      var chi = V - E + F;
      lines.push(V + ' − ' + E + ' + ' + F + ' = ' + String(chi).replace('-', '−') + ', genus ' + (2 - chi) / 2);
    } else {
      lines.push('not connected, ' + info.components + ' components');
    }
    while (out.firstChild) out.removeChild(out.firstChild);
    for (i = 0; i < lines.length; i++) { if (i) out.appendChild(document.createElement('br')); out.appendChild(document.createTextNode(lines[i])); }
    svg.setAttribute('aria-label', 'The Haar graph of the cyclic group of order ' + n + ' with connection set {' + S.join(', ') + '}. ' + faces + '. One facial walk is marked.');
  }

  function fillOrders() {
    var orders = cyclicOrders(S);
    [alphaSel, betaSel].forEach(function (sel, which) {
      var current = (which ? beta : alpha).join(' ');
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      orders.forEach(function (o, i) {
        var opt = document.createElement('option');
        opt.value = String(i); opt.appendChild(document.createTextNode('(' + o.join(' ') + ')'));
        if (o.join(' ') === current) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.disabled = orders.length < 2;
    });
  }

  function buildSet() {
    while (setBox.firstChild) setBox.removeChild(setBox.firstChild);
    for (var i = 0; i < n; i++) (function (i) {
      var b = document.createElement('button'), on = S.indexOf(i) >= 0;
      b.type = 'button';
      b.appendChild(document.createTextNode(String(i)));
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      /* S keeps between one and four elements */
      b.disabled = on ? S.length === 1 : S.length === MAX_LABELS;
      b.addEventListener('click', function () {
        var at = S.indexOf(i);
        if (at >= 0) S.splice(at, 1); else { S.push(i); S.sort(function (x, y) { return x - y; }); }
        alpha = S.slice(); beta = S.slice();
        buildSet(); fillOrders(); draw();
        var again = setBox.querySelectorAll('button')[i];
        if (again && !again.disabled) again.focus();
      });
      setBox.appendChild(b);
    })(i);
  }

  nInput.addEventListener('input', function () {
    n = parseInt(nInput.value, 10) || 7;
    S = S.filter(function (s) { return s < n; });
    if (!S.length) S = [0];
    alpha = S.slice(); beta = S.slice();
    nOut.textContent = String(n);
    buildSet(); fillOrders(); draw();
  });
  alphaSel.addEventListener('change', function () { alpha = cyclicOrders(S)[parseInt(alphaSel.value, 10) || 0]; draw(); });
  betaSel.addEventListener('change', function () { beta = cyclicOrders(S)[parseInt(betaSel.value, 10) || 0]; draw(); });

  /* Adding 1 to every subscript is an automorphism: the drawing turns by one step and lands on itself. */
  if (turn) turn.addEventListener('click', function () {
    var graph = svg.querySelector('.haar-try-turning');
    if (!graph) return;
    graph.style.transition = 'transform 0.9s ease';
    graph.style.transform = 'rotate(' + (-360 / n) + 'deg)';
    window.setTimeout(function () { graph.style.transition = 'none'; graph.style.transform = 'none'; }, 950);
  });

  nInput.value = String(n);
  nOut.textContent = String(n);
  buildSet(); fillOrders(); draw();
  fig.hidden = false;
})();
