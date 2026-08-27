let POSTS = [];

// live network background — nodes drifting, connecting lines, pulse "scan" traversal
(function netbg(){
  const canvas = document.getElementById('netbg');
  const ctx = canvas.getContext('2d');
  let w, h, nodes = [], reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COUNT = Math.min(70, Math.floor((window.innerWidth * window.innerHeight) / 22000));
  for(let i=0; i<COUNT; i++){
    nodes.push({
      x: Math.random()*w, y: Math.random()*h,
      vx: (Math.random()-0.5)*0.7, vy: (Math.random()-0.5)*0.7,
      r: Math.random()*1.6 + 0.6
    });
  }

  const LINK_DIST = 130;
  let scanPulse = { t: 0, active: false };

  function step(){
    ctx.clearRect(0,0,w,h);

    // update + draw nodes
    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if(n.x < 0 || n.x > w) n.vx *= -1;
      if(n.y < 0 || n.y > h) n.vy *= -1;
    });

    // links
    for(let i=0; i<nodes.length; i++){
      for(let j=i+1; j<nodes.length; j++){
        const a = nodes[i], b = nodes[j];
        const dx = a.x-b.x, dy = a.y-b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist < LINK_DIST){
          const alpha = (1 - dist/LINK_DIST) * 0.18;
          ctx.strokeStyle = `rgba(63,169,255,${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // nodes
    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(127,212,255,.55)';
      ctx.fill();
    });

    if(!reduceMotion) requestAnimationFrame(step);
  }
  step();
  if(reduceMotion){ ctx.clearRect(0,0,w,h); } // draw once, static, respect preference
})();

// cursor glow follower
(function cursorGlow(){
  const glow = document.getElementById('cursor-glow');
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let raf = null, tx = 0, ty = 0, cx = 0, cy = 0;
  window.addEventListener('mousemove', (e) => {
    tx = e.clientX; ty = e.clientY;
    glow.style.opacity = '1';
    if(!raf) raf = requestAnimationFrame(update);
  });
  window.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
  function update(){
    cx += (tx - cx) * 0.45;
    cy += (ty - cy) * 0.45;
    glow.style.left = cx + 'px';
    glow.style.top = cy + 'px';
    if(Math.abs(tx-cx) > 0.5 || Math.abs(ty-cy) > 0.5){ raf = requestAnimationFrame(update); }
    else { raf = null; }
  }
})();

(function boot(){
  const lines = document.querySelectorAll('#boot-log .line');
  lines.forEach((el, i) => { setTimeout(() => { el.style.transition = 'opacity .35s'; el.style.opacity = '1'; }, i * 260); });
  const total = lines.length * 260 + 500;
  setTimeout(() => { document.getElementById('boot').classList.add('hidden'); }, total);
})();

const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); observer.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => observer.observe(el));

// scroll progress bar + depth reveal (circuit graphic surfaces as you near the bottom)
window.addEventListener('scroll', () => {
  const h = document.documentElement;
  const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
  document.getElementById('progress').style.width = scrolled + '%';

  // depth-reveal fades in over the last 40% of the page
  const depthStart = 55, depthEnd = 100;
  let depthProgress = (scrolled - depthStart) / (depthEnd - depthStart);
  depthProgress = Math.max(0, Math.min(1, depthProgress));
  document.getElementById('depth-reveal').style.opacity = depthProgress;
});

async function loadPosts(){
  try{
    const res = await fetch('posts.json');
    POSTS = await res.json();
    POSTS.sort((a,b) => new Date(b.date) - new Date(a.date));
    renderFeed();
    routeFromHash();
  }catch(e){
    document.getElementById('feed-list').innerHTML = '<p class="empty mono">Could not load posts.json</p>';
  }
}

function fmtDate(d){
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function renderFeed(){
  const list = document.getElementById('feed-list');
  if(!POSTS.length){ list.innerHTML = '<p class="empty mono">No entries yet.</p>'; return; }
  list.innerHTML = POSTS.map(p => `
    <a class="feed-item" href="#post/${p.id}" onclick="showPost('${p.id}');event.preventDefault();">
      <div class="feed-meta">
        <span class="type">${p.type || 'note'}</span>
        <span>${fmtDate(p.date)}</span>
      </div>
      <div class="feed-title">${p.title}</div>
      <div class="feed-summary">${p.summary || ''}</div>
      ${p.tags && p.tags.length ? `<div class="feed-tags">${p.tags.map(t => `<span>#${t}</span>`).join('')}</div>` : ''}
    </a>
  `).join('');
}

function showHome(){
  document.getElementById('home-view').hidden = false;
  document.getElementById('post-view').hidden = true;
  history.replaceState(null, '', '#home');
  window.scrollTo({top:0, behavior:'smooth'});
}

function scrollToSection(id){
  showHome();
  setTimeout(() => document.getElementById(id).scrollIntoView({behavior:'smooth'}), 50);
}

function showPost(id){
  const post = POSTS.find(p => p.id === id);
  if(!post) return showHome();
  document.getElementById('home-view').hidden = true;
  document.getElementById('post-view').hidden = false;
  document.getElementById('post-content').innerHTML = `
    <div class="feed-meta">
      <span class="type">${post.type || 'note'}</span>
      <span>${fmtDate(post.date)}</span>
    </div>
    <h1 class="post-title">${post.title}</h1>
    ${post.tags && post.tags.length ? `<div class="feed-tags">${post.tags.map(t => `<span>#${t}</span>`).join('')}</div>` : ''}
    <div class="post-body">${(post.body || '').split('\\n\\n').map(p => `<p>${p}</p>`).join('')}</div>
  `;
  history.replaceState(null, '', '#post/' + id);
  window.scrollTo({top:0, behavior:'smooth'});
}

function routeFromHash(){
  const hash = location.hash;
  if(hash.startsWith('#post/')){ showPost(hash.replace('#post/', '')); }
}

window.addEventListener('hashchange', routeFromHash);
loadPosts();
loadStats();
loadResources();

async function loadStats(){
  const el = document.getElementById('stat-strip');
  try{
    const res = await fetch('stats.json');
    const stats = await res.json();
    el.innerHTML = stats.map(s => `
      <div class="stat"><div class="n display">${s.n}</div><div class="l">${s.l}</div></div>
    `).join('');
  }catch(e){
    el.innerHTML = '<p class="empty mono">Could not load stats.json</p>';
  }
}

async function loadResources(){
  const el = document.getElementById('focus-grid');
  try{
    const res = await fetch('resources.json');
    const items = await res.json();
    el.innerHTML = items.map(item => `
      <div class="focus-card">
        <div class="code mono">${item.code}</div>
        <h3>${item.emoji} ${item.title}</h3>
        <p>${item.summary}</p>
        <div class="links">
          ${item.links.map(l => `<a href="${l.url}" target="_blank" rel="noopener">${l.label} →</a>`).join('')}
        </div>
      </div>
    `).join('');
  }catch(e){
    el.innerHTML = '<p class="empty mono">Could not load resources.json</p>';
  }
}
