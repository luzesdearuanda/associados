/* Associados — Associação Centro de Umbanda Luzes de Aruanda.
   Cadastro de associados, funções, mensalidades e carteirinhas. Os dados ficam na planilha da conta da associação;
   este arquivo só conversa com a API (Apps Script). */
'use strict';
/* ============ Utilitários ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const z = n => String(n).padStart(2, '0');
const isoLocal = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const TODAY = () => isoLocal(new Date());
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return isoLocal(new Date(y, m - 1, d + n)); };
const diffDays = (a, b) => { const p = s => s.split('-').map(Number); const [y1, m1, d1] = p(a), [y2, m2, d2] = p(b); return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5); };
const fmtD = iso => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const fmtStamp = s => s ? `${fmtD(s.slice(0, 10))} ${s.slice(11)}` : '—';
const hhmm = () => { const d = new Date(); return `${z(d.getHours())}:${z(d.getMinutes())}`; };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const digits = s => String(s || '').replace(/\D/g, '');
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const fmtMat = n => String(n || 0).padStart(4, '0');
const fmtBRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_C = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const compOf = iso => String(iso || '').slice(0, 7);
const COMP_ATUAL = () => compOf(TODAY());
function addMonthsComp(c, n) { const [y, m] = c.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${z(d.getMonth() + 1)}`; }
const fmtComp = c => { const [y, m] = c.split('-'); return `${MESES_C[+m - 1]}/${y}`; };
const fmtCompLongo = c => { const [y, m] = c.split('-'); return `${MESES[+m - 1]} de ${y}`; };

/* CPF e CNPJ */
function cpfValido(c) {
  c = digits(c); if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (b, f) => { let s = 0; for (let i = 0; i < b.length; i++) s += +b[i] * (f - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  const d1 = dv(c.slice(0, 9), 10), d2 = dv(c.slice(0, 9) + d1, 11);
  return c.slice(9) === '' + d1 + d2;
}
const fmtCPF = c => { c = digits(c); return c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c; };
const maskCPF = c => { c = digits(c); return c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : ''; };
function typeCPF(v) {
  const d = digits(v).slice(0, 11); let o = d.slice(0, 3);
  if (d.length > 3) o += '.' + d.slice(3, 6);
  if (d.length > 6) o += '.' + d.slice(6, 9);
  if (d.length > 9) o += '-' + d.slice(9);
  return o;
}
function cnpjValido(c) {
  c = digits(c); if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (b, w) => { let s = 0; for (let i = 0; i < b.length; i++) s += +b[i] * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], w2 = [6, ...w1];
  const d1 = dv(c.slice(0, 12), w1), d2 = dv(c.slice(0, 12) + d1, w2);
  return c.slice(12) === '' + d1 + d2;
}
const fmtCNPJ = c => { c = digits(c); return c.length === 14 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}` : c; };
const showCPF = c => !c ? '—' : isAdmin() ? fmtCPF(c) : maskCPF(c);
const idade = nasc => { if (!nasc) return null; const [y, m, d] = nasc.split('-').map(Number); const t = new Date(); let a = t.getFullYear() - y; if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) a--; return a; };

/* Ícones */
const I = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8" cy="11" r="2"/><path d="M5 16a3 3 0 0 1 6 0M14 10h5M14 13.5h4"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.9-2.8 2.1 0 2.9 5.8 1.5 5.8 4.3 0 1.2-1.3 2.1-3 2.1-1.3 0-2.4-.6-2.9-1.5M12 6v1.8M12 16.3V18"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-5L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14 5l2-2"/><path d="M20 21v-5h-5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  whats: '<path d="M4 20l1.3-4A8 8 0 1 1 8.3 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.9-1-1 .8c-1-.4-1.8-1.2-2.2-2.2l.8-1-1-1.9z"/>',
  cake: '<path d="M4 21h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 16c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5M12 12V8M12 5.5v.01"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

/* ============ Estado e comunicação com a API ============ */
const CFG = window.ASSOCIADOS_CONFIG || {};
const LOGO = 'logo.png';
let S = null; // dados carregados da planilha (via Apps Script)
const UI = { login: 'start', loginMsg: '', deniedMsg: '', errMsg: '', menu: false, lastUpdate: hhmm(), lastSync: 0, busy: 0, fotos: {}, sel: new Set(), foto: null };
const TOKEN_KEY = 'associados-luzes-token';
const DEFAULT_ASSOC = { nome: 'Associação Centro de Umbanda Luzes de Aruanda', cnpj: '', endereco: '', telefone: '', email: '', site: '' };
const configurado = () => CFG.API_URL && CFG.CLIENT_ID && !/COLE_AQUI/.test(CFG.API_URL + CFG.CLIENT_ID);
function getToken() { try { return sessionStorage.getItem(TOKEN_KEY) || UI.token || ''; } catch (e) { return UI.token || ''; } }
function setToken(t) { UI.token = t || ''; try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch (e) { } }

class ApiError extends Error { constructor(code, message, extra) { super(message); this.code = code; this.extra = extra; } }
function busy(on, msg) {
  UI.busy = Math.max(0, UI.busy + (on ? 1 : -1));
  const el = $('#busy'); if (!el) return;
  el.hidden = UI.busy === 0;
  if (on && msg) $('#busy-msg').textContent = msg; else if (!UI.busy) $('#busy-msg').textContent = 'Salvando…';
}
async function api(action, payload = {}, opt = {}) {
  if (!opt.silent) busy(true, opt.msg);
  try {
    let res;
    try { res = await fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify({ action, token: getToken(), payload }), redirect: 'follow' }); }
    catch (e) { throw new ApiError('NET', 'Sem conexão com o servidor. Confira a internet e tente de novo.'); }
    if (!res.ok) throw new ApiError('NET', `O servidor respondeu com erro (${res.status}). Tente de novo.`);
    let j; try { j = await res.json(); } catch (e) { throw new ApiError('NET', 'Resposta inválida do servidor. Confira se a implantação do Apps Script está como "Qualquer pessoa".'); }
    if (!j.ok) {
      if (j.error && j.error.detail) console.error('Erro no servidor:', j.error.detail);
      throw new ApiError(j.error.code, j.error.message, j.error.extra);
    }
    if (j.data.changes) applyChanges(j.data.changes);
    return j.data.result;
  } catch (e) {
    if (e.code === 'AUTH' && action !== 'bootstrap') sessionExpired(e.message);
    throw e;
  } finally { if (!opt.silent) busy(false); }
}
const TBL = { Operadores: ['operadores', 'email'], Categorias: ['categorias', 'id'], Funcoes: ['funcoes', 'id'], Associados: ['associados', 'id'], AssocFuncoes: ['assocFuncoes', 'id'], Pagamentos: ['pagamentos', 'id'], Carteirinhas: ['carteirinhas', 'id'] };
function applyChanges(ch) {
  if (!S) return;
  Object.keys(TBL).forEach(name => {
    const [key, id] = TBL[name];
    (ch[name] || []).forEach(o => { const arr = S[key], i = arr.findIndex(x => x[id] === o[id]); if (i >= 0) arr[i] = o; else arr.push(o); });
  });
  (ch.deleted || []).forEach(d => { const [key] = TBL[d.tabela] || []; if (key) S[key] = S[key].filter(x => x.id !== d.id); });
  if (ch.config) S.config = ch.config;
  if (ch.assinatura != null) S.assinatura = ch.assinatura;
  if (ch.seqMatricula != null) S.seqMatricula = ch.seqMatricula;
  if (ch.RegistroAtividades) S.atividades.unshift(...ch.RegistroAtividades.slice().reverse());
  UI.lastUpdate = hhmm();
}
// Executa uma ação e mostra o erro de forma amigável
async function run(fn) {
  try { return await fn(); }
  catch (e) { if (e && e.code === 'AUTH') return; if (!e || !['VALIDATION', 'DUP', 'ATRASO', 'FORBIDDEN', 'NOTFOUND', 'MAIL', 'BUSY', 'NET'].includes(e.code)) console.error(e); toast((e && e.message) || 'Erro inesperado. Tente de novo.', 'bad'); }
}

/* ---- Login com Google ---- */
function renderGoogleButton() {
  const el = $('#g-btn'); if (!el) return;
  if (!(window.google && google.accounts && google.accounts.id)) { setTimeout(renderGoogleButton, 300); return; }
  if (!UI.gInit) { google.accounts.id.initialize({ client_id: CFG.CLIENT_ID, callback: r => { setToken(r.credential); boot(); }, auto_select: false, cancel_on_tap_outside: true, ux_mode: 'popup' }); UI.gInit = true; }
  el.innerHTML = '';
  google.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', locale: 'pt-BR', width: 280 });
}
async function boot(keepView) {
  if (!keepView) { UI.login = 'loading'; render(); }
  try {
    const d = await api('bootstrap', {}, { silent: !keepView, msg: 'Atualizando…' });
    d.session = d.me;
    S = d; UI.lastSync = Date.now(); UI.lastUpdate = hhmm(); UI.login = 'start'; UI.loginMsg = '';
    if (keepView) render(); else go(VIEW || 'inicio', P);
    return true;
  } catch (e) {
    if (e.code === 'FORBIDDEN') { setToken(''); S = null; UI.login = 'denied'; UI.deniedMsg = e.message; render(); }
    else if (e.code === 'AUTH') sessionExpired(e.message);
    else if (keepView) toast(e.message, 'bad');
    else { UI.login = 'error'; UI.errMsg = e.message; render(); }
  }
}
function sessionExpired(msg) { setToken(''); S = null; UI.login = 'start'; UI.loginMsg = msg || 'Sua sessão expirou. Entre com Google de novo.'; closeModal(); render(); }

/* ============ Consultas ============ */
const isAdmin = () => S && S.session && S.session.perfil === 'Admin';
const firstName = () => (S.session.nome || S.session.email).split(' ')[0];
const assoc = id => S.associados.find(a => a.id === id);
const categoria = id => S.categorias.find(c => c.id === id);
const catNome = id => (categoria(id) || { nome: '—' }).nome;
const funcao = id => S.funcoes.find(f => f.id === id);
const funcoesAtuais = aid => S.assocFuncoes.filter(x => x.assocId === aid && (!x.fim || x.fim >= TODAY()));
const funcoesTodas = aid => S.assocFuncoes.filter(x => x.assocId === aid).sort((a, b) => (a.fim ? 1 : 0) - (b.fim ? 1 : 0) || b.inicio.localeCompare(a.inicio));
function funcaoPrincipal(aid) { const af = funcoesAtuais(aid); const p = af.find(x => x.principal) || af[0]; return p ? (funcao(p.funcaoId) || {}).nome || '' : ''; }
const carteirinhaAtiva = aid => S.carteirinhas.find(c => c.assocId === aid && c.status === 'Ativa');
const carteirinhasDe = aid => S.carteirinhas.filter(c => c.assocId === aid).sort((a, b) => b.emitidaEm.localeCompare(a.emitidaEm));
const assocCfg = () => ({ ...DEFAULT_ASSOC, ...((S && S.config && S.config.assoc) || {}) });
const SIT_CLS = { Ativo: 'ok', Afastado: 'warn', Desligado: 'mute', Falecido: 'mute' };
const pill = (txt, cls) => `<span class="pill ${cls}">${esc(txt)}</span>`;
const avatar = (a, cls = '') => a.fotoMini ? `<img class="avatar ${cls}" src="data:image/jpeg;base64,${a.fotoMini}" alt="">` : `<span class="avatar ${cls} vazio" aria-hidden="true">${esc((a.nome || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase())}</span>`;

// Mensalidades: mesma regra do servidor
function financeiro(a) {
  const cat = categoria(a.categoriaId), valor = cat ? Number(cat.valor) || 0 : 0, atual = COMP_ATUAL();
  const pagas = {}; S.pagamentos.forEach(p => { if (p.assocId === a.id && !p.cancelado) pagas[p.competencia] = p; });
  const aberto = [];
  let inicio = '';
  if (a.situacao === 'Ativo' && valor > 0) {
    inicio = [S.config.cobrancaDesde, compOf(a.dataIngresso) || S.config.cobrancaDesde].sort().pop();
    let c = inicio, g = 0;
    while (c <= atual && g++ < 600) { if (!pagas[c]) aberto.push(c); c = addMonthsComp(c, 1); }
  }
  const atrasadas = aberto.filter(c => c < atual);
  return { valor, pagas, aberto, atrasadas, atraso: atrasadas.length, inicio, cobrado: a.situacao === 'Ativo' && valor > 0, bloqueia: atrasadas.length > S.config.toleranciaMeses };
}
function finPill(a, fin = financeiro(a)) {
  if (!fin.cobrado) return pill(a.situacao === 'Ativo' ? 'Isento' : 'Sem cobrança', 'mute');
  if (!fin.atraso) return pill(fin.aberto.length ? 'Em dia' : 'Em dia', 'ok');
  return pill(`${plural(fin.atraso, 'mês', 'meses')} em atraso`, fin.bloqueia ? 'bad' : 'warn');
}
// Situação da carteirinha
function cartSt(a) {
  const c = carteirinhaAtiva(a.id);
  if (!c) return { code: 'nenhuma', label: 'Sem carteirinha', cls: 'mute', c: null };
  const d = diffDays(TODAY(), c.validade);
  if (d < 0) return { code: 'vencida', label: `Vencida em ${fmtD(c.validade)}`, cls: 'bad', c };
  if (d <= 30) return { code: 'vence', label: `Vence em ${fmtD(c.validade)}`, cls: 'warn', c };
  return { code: 'valida', label: `Válida até ${fmtD(c.validade)}`, cls: 'ok', c };
}
function aniversariantes(mes) {
  const m = z(mes);
  return S.associados.filter(a => a.situacao === 'Ativo' && a.nascimento && a.nascimento.slice(5, 7) === m).sort((x, y) => x.nascimento.slice(8).localeCompare(y.nascimento.slice(8)));
}
function kpis() {
  const at = S.associados.filter(a => a.situacao === 'Ativo');
  const fins = at.map(a => ({ a, f: financeiro(a), c: cartSt(a) }));
  return {
    ativos: at.length, total: S.associados.length,
    inadimplentes: fins.filter(x => x.f.bloqueia),
    atrasados: fins.filter(x => x.f.atraso > 0),
    vencendo: fins.filter(x => x.c.code === 'vence'),
    vencidas: fins.filter(x => x.c.code === 'vencida'),
    semCart: fins.filter(x => x.c.code === 'nenhuma'),
    aniv: aniversariantes(new Date().getMonth() + 1),
  };
}

/* ============ Navegação ============ */
const NAV = [
  { sec: 'Secretaria' },
  { id: 'inicio', label: 'Início', ic: 'home' },
  { id: 'associados', label: 'Associados', ic: 'users' },
  { id: 'mensalidades', label: 'Mensalidades', ic: 'coin', badge: () => kpis().inadimplentes.length },
  { id: 'carteirinhas', label: 'Carteirinhas', ic: 'card', badge: () => kpis().vencidas.length },
  { id: 'funcoes', label: 'Funções', ic: 'star' },
  { sec: 'Administração', admin: true },
  { id: 'configuracoes', label: 'Configurações', ic: 'gear', admin: true },
  { id: 'operadores', label: 'Operadores', ic: 'shield', admin: true },
  { id: 'atividades', label: 'Registro de atividades', ic: 'clock', admin: true },
];
const PARENT = { associado: 'associados', associadoForm: 'associados' };
let VIEW = 'inicio', P = {};
function go(v, params = {}) {
  VIEW = v; P = params; UI.menu = false;
  if (v === 'carteirinhas' && !params.keep) UI.sel = new Set();
  if (v === 'associadoForm') UI.foto = null;
  render();
  window.scrollTo(0, 0);
}

/* ============ Render ============ */
function render() {
  const app = $('#app');
  if (!configurado()) { app.innerHTML = vSetup(); return; }
  if (!S) { app.innerHTML = UI.login === 'denied' ? vDenied() : vLogin(); if (UI.login === 'start') renderGoogleButton(); return; }
  let v = VIEWS[VIEW];
  if (!v || (v.admin && !isAdmin())) { VIEW = 'inicio'; v = VIEWS.inicio; }
  app.innerHTML = shell(v.render());
  if (v.after) v.after();
}
function shell(content) {
  const cur = PARENT[VIEW] || VIEW;
  const nav = NAV.filter(n => !n.admin || isAdmin()).map(n => n.sec ? `<div class="nav-sec">${n.sec}</div>` :
    `<button data-act="go" data-v="${n.id}" ${cur === n.id ? 'aria-current="page"' : ''}>${ic(n.ic)}<span>${n.label}</span>${n.badge && n.badge() ? `<span class="count">${n.badge()}</span>` : ''}</button>`).join('');
  const k = kpis();
  const bn = (id, label, icn, extra = '') => `<button data-act="go" data-v="${id}" ${cur === id ? 'aria-current="page"' : ''}>${ic(icn)}<span>${label}</span>${extra}</button>`;
  return `
  <div class="shell">
    <aside class="side">
      <div class="side-brand"><div class="logo-sm"><img src="${LOGO}" alt=""></div><div><b>Luzes de Aruanda</b><span>Cadastro de associados</span></div></div>
      <nav class="nav" aria-label="Menu principal">${nav}</nav>
      <div class="side-user"><div><b>${esc(S.session.nome)}</b> <span class="role">${S.session.perfil}</span></div><div class="email">${esc(S.session.email)}</div><button data-act="logout">Sair</button></div>
    </aside>
    <div class="main">
      <header class="topbar"><div class="logo-sm"><img src="${LOGO}" alt=""></div><b>Associados Luzes de Aruanda</b><span class="role">${S.session.perfil}</span></header>
      <main class="page">${content}</main>
    </div>
  </div>
  <nav class="bottom-nav" aria-label="Navegação">
    ${bn('inicio', 'Início', 'home')}
    ${bn('associados', 'Associados', 'users')}
    <button class="main-act" data-act="go" data-v="associadoForm" ${VIEW === 'associadoForm' && !P.id ? 'aria-current="page"' : ''}><span class="ic">${ic('plus')}</span><span>Novo</span></button>
    ${bn('mensalidades', 'Mensalidades', 'coin', k.inadimplentes.length ? `<span class="dot">${k.inadimplentes.length}</span>` : '')}
    <button data-act="menu" ${['carteirinhas', 'funcoes', 'configuracoes', 'operadores', 'atividades'].includes(cur) ? 'aria-current="page"' : ''}>${ic('more')}<span>Mais</span>${k.vencidas.length ? `<span class="dot">${k.vencidas.length}</span>` : ''}</button>
  </nav>
  ${UI.menu ? `<div class="overlay" data-act="menuClose" style="place-items:end stretch;padding:0"></div><div class="sheet-menu" role="menu">
    <button data-act="go" data-v="carteirinhas">${ic('card')} Carteirinhas${k.vencidas.length ? ` (${k.vencidas.length} vencidas)` : ''}</button>
    <button data-act="go" data-v="funcoes">${ic('star')} Funções</button>
    ${isAdmin() ? `<button data-act="go" data-v="configuracoes">${ic('gear')} Configurações</button>
    <button data-act="go" data-v="operadores">${ic('shield')} Operadores</button>
    <button data-act="go" data-v="atividades">${ic('clock')} Registro de atividades</button>` : ''}
    <button data-act="logout">${ic('logout')} Sair (${esc(S.session.email)})</button>
  </div>` : ''}`;
}

/* ============ Telas de acesso ============ */
const loginCard = body => `<div class="login"><div class="login-card">
    <div class="logo-disc"><img src="${LOGO}" alt="Logo da Associação Centro de Umbanda Luzes de Aruanda"></div>
    <div style="display:grid;gap:6px"><div class="eyebrow">Secretaria</div><h1>Associação Centro de Umbanda Luzes de Aruanda</h1><p class="muted">Associados, funções, mensalidades e carteirinhas</p></div>
    ${body}
    <p class="small muted"><a href="privacidade.html" target="_blank" rel="noopener">Política de privacidade</a> · <a href="validar.html">Validar uma carteirinha</a></p>
  </div></div>`;
function vLogin() {
  if (UI.login === 'loading') return loginCard(`<div class="spinner" role="status" aria-label="Carregando"></div><p class="muted">Validando acesso e carregando o cadastro…</p>`);
  if (UI.login === 'error') return loginCard(`<div class="note bad" style="text-align:left"><b>Não foi possível carregar o sistema</b><span>${esc(UI.errMsg)}</span></div><button class="btn primary" data-act="retryBoot">Tentar de novo</button><button class="btn ghost" data-act="loginReset">Entrar com outra conta</button>`);
  return loginCard(`${UI.loginMsg ? `<div class="note warn" style="text-align:left"><span>${esc(UI.loginMsg)}</span></div>` : ''}<div id="g-btn" class="g-btn" aria-label="Entrar com Google"></div>
      <p class="small muted">O acesso é liberado apenas para operadores cadastrados pela secretaria da associação. O app nunca pede sua senha do Google.</p>`);
}
function vDenied() {
  return `<div class="login"><div class="login-card">
    <div class="logo-disc" style="width:88px;height:88px"><img src="${LOGO}" alt=""></div>
    <div class="note bad" style="text-align:left"><b>Esta conta não tem acesso</b><span>${esc(UI.deniedMsg)}</span></div>
    <p class="muted small">Peça ao administrador para liberar este e-mail na lista de operadores. Nenhum dado foi carregado.</p>
    <button class="btn primary" data-act="loginReset">Entrar com outra conta</button>
  </div></div>`;
}
function vSetup() {
  return loginCard(`<div class="note warn" style="text-align:left"><b>Sistema ainda não configurado</b><span>Preencha <span class="mono">API_URL</span> e <span class="mono">CLIENT_ID</span> no arquivo <span class="mono">config.js</span>, conforme o guia de implantação.</span></div>`);
}

const VIEWS = {};
const kpiBox = (label, val, note, cls = '', act = '') => act
  ? `<button class="kpi ${cls}" ${act}><span class="k-label">${label}</span><span class="k-val">${val}</span><span class="k-note">${note}</span></button>`
  : `<div class="kpi ${cls}"><span class="k-label">${label}</span><span class="k-val">${val}</span><span class="k-note">${note}</span></div>`;

/* ---- Início ---- */
VIEWS.inicio = {
  render() {
    const k = kpis(), mes = MESES[new Date().getMonth()];
    const atencao = [
      ...k.inadimplentes.map(x => ({ a: x.a, t: `${plural(x.f.atraso, 'mensalidade atrasada', 'mensalidades atrasadas')}`, cls: 'bad' })),
      ...k.vencidas.map(x => ({ a: x.a, t: x.c.label, cls: 'bad' })),
      ...k.vencendo.map(x => ({ a: x.a, t: x.c.label, cls: 'warn' })),
    ].slice(0, 10);
    const catsSemValor = S.categorias.filter(c => c.ativa && !c.valor && !/isent/i.test(c.nome));
    return `
    <div class="page-head"><div><h1>Olá, ${esc(firstName())}</h1><p class="sub">Dados atualizados às ${UI.lastUpdate}. ${plural(k.ativos, 'associado ativo', 'associados ativos')}.</p></div>
      <button class="btn sm" data-act="refresh">${ic('refresh')} Atualizar</button></div>
    ${isAdmin() && catsSemValor.length === S.categorias.filter(c => c.ativa && !/isent/i.test(c.nome)).length && catsSemValor.length ? `<div class="note warn"><b>Defina o valor das mensalidades</b><span>As categorias ainda estão com valor R$ 0,00, então ninguém aparece em atraso. <button class="btn sm" data-act="go" data-v="configuracoes">Abrir configurações</button></span></div>` : ''}
    <div class="quick">
      <button class="btn primary" data-act="go" data-v="associadoForm">${ic('plus')} Novo associado</button>
      <button class="btn" data-act="pagNovo">${ic('coin')} Registrar mensalidade</button>
      <button class="btn" data-act="go" data-v="carteirinhas">${ic('card')} Carteirinhas</button>
    </div>
    <div class="kpis">
      ${kpiBox('Associados ativos', k.ativos, `${k.total} no cadastro`, '', 'data-act="go" data-v="associados"')}
      ${kpiBox('Mensalidades em atraso', k.inadimplentes.length, `acima da tolerância de ${plural(S.config.toleranciaMeses, 'mês', 'meses')}`, k.inadimplentes.length ? 'bad' : '', 'data-act="go" data-v="mensalidades" data-f="inadimplentes"')}
      ${kpiBox('Carteirinhas vencidas', k.vencidas.length, k.vencendo.length ? `${k.vencendo.length} vencem em até 30 dias` : 'nenhuma vencendo em 30 dias', k.vencidas.length ? 'bad' : k.vencendo.length ? 'warn' : '', 'data-act="go" data-v="carteirinhas" data-f="vencidas"')}
      ${kpiBox('Sem carteirinha', k.semCart.length, 'associados ativos', '', 'data-act="go" data-v="carteirinhas" data-f="sem"')}
    </div>
    <div class="grid-2">
      <section class="panel"><div class="panel-head"><h2>Precisa de atenção</h2></div>
        ${atencao.length ? `<div class="list">${atencao.map(x => `<button class="row-link" data-act="go" data-v="associado" data-id="${x.a.id}">${avatar(x.a)}<span class="who"><b>${esc(x.a.nome)}</b><span class="mono small">${fmtMat(x.a.matricula)}</span></span>${pill(x.t, x.cls)}</button>`).join('')}</div>`
        : '<div class="empty">Nenhuma pendência. Mensalidades e carteirinhas em dia.</div>'}</section>
      <section class="panel"><div class="panel-head"><h2>${ic('cake')} Aniversariantes de ${mes}</h2></div>
        ${k.aniv.length ? `<div class="list">${k.aniv.map(a => { const hoje = a.nascimento.slice(5) === TODAY().slice(5); return `<button class="row-link" data-act="go" data-v="associado" data-id="${a.id}">${avatar(a)}<span class="who"><b>${esc(a.nome)}</b><span class="small muted">dia ${a.nascimento.slice(8)} · ${idade(a.nascimento) + (hoje ? 0 : (a.nascimento.slice(5) > TODAY().slice(5) ? 1 : 0))} anos</span></span>${hoje ? pill('Hoje', 'ok') : ''}</button>`; }).join('')}</div>`
        : `<div class="empty">Nenhum aniversariante ativo em ${mes} (ou a data de nascimento não foi cadastrada).</div>`}</section>
    </div>`;
  }
};

/* ---- Associados ---- */
function assocFiltrados() {
  const q = norm(P.q || ''), qd = digits(P.q || '');
  return S.associados.filter(a => {
    if ((P.sit || 'Ativo') !== 'todos' && a.situacao !== (P.sit || 'Ativo')) return false;
    if (P.cat && a.categoriaId !== P.cat) return false;
    if (P.fun && !funcoesAtuais(a.id).some(x => x.funcaoId === P.fun)) return false;
    if (!q) return true;
    return norm(a.nome).includes(q) || (qd && (String(a.matricula) === String(+qd) || (qd.length >= 4 && a.cpf.includes(qd))));
  }).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
}
function assocResults() {
  const list = assocFiltrados();
  if (!list.length) return `<div class="table-wrap"><div class="empty">Nenhum associado encontrado.${P.q ? '' : ' <button class="btn sm" data-act="go" data-v="associadoForm">Cadastrar associado</button>'}</div></div>`;
  return `<p class="small muted">${plural(list.length, 'associado', 'associados')}</p><div class="table-wrap cards"><table><thead><tr><th>Associado</th><th>Categoria</th><th>Função principal</th><th>Mensalidade</th><th>Carteirinha</th></tr></thead><tbody>
    ${list.map(a => { const c = cartSt(a); return `<tr class="clickable" data-act="go" data-v="associado" data-id="${a.id}">
      <td class="lead"><div class="who-row">${avatar(a)}<div><div class="t">${esc(a.nome)}</div><div class="s mono">${fmtMat(a.matricula)}${a.situacao !== 'Ativo' ? ` · ${a.situacao}` : ''}</div></div></div></td>
      <td data-label="Categoria">${esc(catNome(a.categoriaId))}</td>
      <td data-label="Função">${esc(funcaoPrincipal(a.id) || '—')}</td>
      <td data-label="Mensalidade">${finPill(a)}</td>
      <td data-label="Carteirinha">${pill(c.label, c.cls)}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}
VIEWS.associados = {
  render() {
    return `<div class="page-head"><div><h1>Associados</h1><p class="sub">${plural(S.associados.filter(a => a.situacao === 'Ativo').length, 'ativo', 'ativos')} · ${S.associados.length} no cadastro.</p></div>
      <div class="toolbar"><button class="btn sm" data-act="exportCsv">${ic('download')} Planilha (CSV)</button><button class="btn sm" data-act="printLista">${ic('print')} Imprimir lista</button><button class="btn primary" data-act="go" data-v="associadoForm">${ic('plus')} Novo associado</button></div></div>
      <div class="toolbar"><label class="search"><span class="sr">Buscar</span>${ic('search')}<input id="as-q" data-in="asQ" value="${esc(P.q || '')}" placeholder="Nome, matrícula ou CPF" autocomplete="off"></label>
        <div class="field" style="flex:0 1 170px"><label class="sr" for="as-sit">Situação</label><select id="as-sit" data-ch="asSit">${['Ativo', 'Afastado', 'Desligado', 'Falecido', 'todos'].map(s => `<option value="${s}" ${(P.sit || 'Ativo') === s ? 'selected' : ''}>${s === 'todos' ? 'Todas as situações' : s + 's'}</option>`).join('')}</select></div>
        <div class="field" style="flex:0 1 170px"><label class="sr" for="as-cat">Categoria</label><select id="as-cat" data-ch="asCat"><option value="">Todas as categorias</option>${S.categorias.map(c => `<option value="${c.id}" ${P.cat === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
        <div class="field" style="flex:0 1 190px"><label class="sr" for="as-fun">Função</label><select id="as-fun" data-ch="asFun"><option value="">Todas as funções</option>${S.funcoes.filter(f => f.ativa).map(f => `<option value="${f.id}" ${P.fun === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></div></div>
      <div id="as-res">${assocResults()}</div>`;
  }
};

/* ---- Associado (detalhes) ---- */
function anoMensal(a, fin, ano) {
  const atual = COMP_ATUAL();
  return `<div class="months">${MESES_C.map((m, i) => {
    const c = `${ano}-${z(i + 1)}`, p = fin.pagas[c];
    let st, cls;
    if (p) { st = p.forma === 'Isenção' ? 'Isento' : 'Pago'; cls = p.forma === 'Isenção' ? 'mute' : 'ok'; }
    else if (!fin.cobrado || c < fin.inicio) { st = '—'; cls = 'none'; }
    else if (c > atual) { st = 'A vencer'; cls = 'future'; }
    else if (c === atual) { st = 'Aberto'; cls = 'warn'; }
    else { st = 'Atrasado'; cls = 'bad'; }
    return `<div class="month ${cls}" title="${fmtCompLongo(c)}: ${st}${p ? ` · ${fmtBRL(p.valor)} em ${fmtD(p.dataPagamento)} (${p.forma})` : ''}"><b>${m}</b><span>${st}</span></div>`;
  }).join('')}</div>`;
}
VIEWS.associado = {
  render() {
    const a = assoc(P.id); if (!a) return '<div class="empty">Associado não encontrado.</div>';
    const fin = financeiro(a), cs = cartSt(a), afs = funcoesTodas(a.id), cards = carteirinhasDe(a.id);
    const ano = +(P.ano || new Date().getFullYear());
    const pags = S.pagamentos.filter(p => p.assocId === a.id).sort((x, y) => y.competencia.localeCompare(x.competencia) || y.registradoEm.localeCompare(x.registradoEm));
    const anos = [...new Set([new Date().getFullYear(), ...pags.map(p => +p.competencia.slice(0, 4))])].sort((x, y) => y - x);
    return `<div><button class="back" data-act="go" data-v="associados">${ic('back')} Associados</button>
      <div class="profile">
        <button class="profile-photo" data-act="fotoTrocar" data-id="${a.id}" aria-label="Trocar foto">${a.fotoMini ? `<img src="data:image/jpeg;base64,${a.fotoMini}" alt="Foto de ${esc(a.nome)}">` : `<span>${ic('camera')}<small>Adicionar foto</small></span>`}</button>
        <div class="profile-info"><h1>${esc(a.nome)}</h1>
          <p class="sub"><span class="mono">Matrícula ${fmtMat(a.matricula)}</span> · ${esc(catNome(a.categoriaId))} · desde ${fmtD(a.dataIngresso)}</p>
          <div class="pills">${pill(a.situacao, SIT_CLS[a.situacao] || 'mute')} ${finPill(a, fin)} ${pill(cs.label, cs.cls)}</div></div>
        <div class="toolbar profile-act"><button class="btn" data-act="go" data-v="associadoForm" data-id="${a.id}">${ic('edit')} Editar</button>${a.situacao === 'Ativo' ? `<button class="btn primary" data-act="cartEmitir" data-id="${a.id}">${ic('card')} ${cs.c ? 'Renovar carteirinha' : 'Emitir carteirinha'}</button>` : ''}</div>
      </div></div>
      <div class="grid-2">
        <section class="panel"><div class="panel-head"><h2>Dados pessoais</h2></div>
          <dl class="facts">
            <div><dt>CPF</dt><dd class="mono">${showCPF(a.cpf)}</dd></div><div><dt>RG</dt><dd>${esc(a.rg || '—')}</dd></div>
            <div><dt>Nascimento</dt><dd>${a.nascimento ? `${fmtD(a.nascimento)} · ${idade(a.nascimento)} anos` : '—'}</dd></div>
            <div><dt>Telefone</dt><dd>${a.telefone ? `<a href="tel:${digits(a.telefone)}">${esc(a.telefone)}</a>` : '—'}</dd></div>
            <div><dt>E-mail</dt><dd>${a.email ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : '—'}</dd></div>
            <div class="full"><dt>Endereço</dt><dd>${esc(a.endereco || '—')}</dd></div>
            ${a.obs ? `<div class="full"><dt>Observações</dt><dd>${esc(a.obs)}</dd></div>` : ''}
          </dl></section>
        <section class="panel"><div class="panel-head"><h2>Funções</h2><button class="btn sm primary" data-act="funAdd" data-id="${a.id}">${ic('plus')} Atribuir função</button></div>
          ${afs.length ? `<div class="list">${afs.map(x => { const f = funcao(x.funcaoId) || { nome: '?', tipo: '' }, enc = x.fim && x.fim < TODAY(); return `<div class="row-item ${enc ? 'dim' : ''}">
            <span class="who"><b>${esc(f.nome)}${x.principal && !enc ? ' <span class="chip">principal</span>' : ''}</b><span class="small muted">${esc(f.tipo)} · ${enc ? `de ${fmtD(x.inicio)} a ${fmtD(x.fim)}` : x.fim ? `até ${fmtD(x.fim)}` : `desde ${fmtD(x.inicio)}`}</span></span>
            <span class="row-actions">${enc ? '' : `${x.principal ? '' : `<button class="btn sm ghost" data-act="funPrincipal" data-id="${x.id}">Tornar principal</button>`}<button class="btn sm" data-act="funEncerrar" data-id="${x.id}">Encerrar</button>`}<button class="btn sm ghost icon" data-act="funExcluir" data-id="${x.id}" aria-label="Excluir lançamento" title="Excluir (lançamento errado)">${ic('x')}</button></span></div>`; }).join('')}</div>`
          : '<div class="empty">Nenhuma função atribuída.</div>'}
          <p class="small muted">A função principal aparece na carteirinha.</p></section>
      </div>
      <section class="panel"><div class="panel-head"><h2>Mensalidades</h2>
        <div class="toolbar">${anos.length > 1 ? `<select data-ch="assocAno" aria-label="Ano">${anos.map(y => `<option ${y === ano ? 'selected' : ''}>${y}</option>`).join('')}</select>` : ''}<button class="btn sm primary" data-act="pagNovo" data-id="${a.id}">${ic('coin')} Registrar pagamento</button></div></div>
        ${fin.cobrado ? `<p class="small muted">${esc(catNome(a.categoriaId))}: ${fmtBRL(fin.valor)} por mês, cobrado desde ${fmtComp(fin.inicio)}. ${fin.atraso ? `<b style="color:var(--bad)">${plural(fin.atraso, 'mês', 'meses')} em atraso: ${fin.atrasadas.map(fmtComp).join(', ')}</b>.` : 'Nenhum mês em atraso.'}</p>`
        : `<p class="small muted">${a.situacao === 'Ativo' ? `Categoria ${esc(catNome(a.categoriaId))} sem valor de mensalidade.` : `Associado ${a.situacao.toLowerCase()}: mensalidades não são cobradas.`}</p>`}
        ${anoMensal(a, fin, ano)}
        ${pags.length ? `<details ${P.hist ? 'open' : ''}><summary class="small" style="cursor:pointer;font-weight:600;color:var(--brand)">Histórico de pagamentos (${pags.length})</summary>
          <div class="table-wrap cards" style="margin-top:8px"><table><thead><tr><th>Mês</th><th>Valor</th><th>Pago em</th><th>Forma</th><th>Registro</th><th><span class="sr">Ações</span></th></tr></thead><tbody>
          ${pags.map(p => `<tr class="${p.cancelado ? 'dim' : ''}"><td data-label="Mês"><b>${fmtComp(p.competencia)}</b></td><td data-label="Valor" class="num">${fmtBRL(p.valor)}</td><td data-label="Pago em" class="num">${fmtD(p.dataPagamento)}</td><td data-label="Forma">${esc(p.forma)}${p.obs ? `<div class="s">${esc(p.obs)}</div>` : ''}</td>
            <td data-label="Registro" class="small">${fmtStamp(p.registradoEm)}${p.cancelado ? `<div class="s" style="color:var(--bad)">Cancelado: ${esc(p.motivoCancelamento)}</div>` : ''}</td>
            <td class="actions">${!p.cancelado && isAdmin() ? `<button class="btn sm danger" data-act="pagCancelar" data-id="${p.id}">Cancelar</button>` : ''}</td></tr>`).join('')}
          </tbody></table></div></details>` : ''}
      </section>
      <section class="panel"><div class="panel-head"><h2>Carteirinha</h2></div>
        ${cs.c ? cartPainel(a, cs) : `<div class="empty">${a.situacao === 'Ativo' ? `Nenhuma carteirinha ativa. <button class="btn sm primary" data-act="cartEmitir" data-id="${a.id}">Emitir carteirinha</button>` : 'Associado não está ativo.'}</div>`}
        ${cards.length > (cs.c ? 1 : 0) ? `<details><summary class="small" style="cursor:pointer;font-weight:600;color:var(--brand)">Emissões anteriores (${cards.length - (cs.c ? 1 : 0)})</summary><div class="list" style="margin-top:8px">${cards.filter(c => c !== cs.c).map(c => `<div class="row-item dim"><span class="who"><b>Emitida em ${fmtStamp(c.emitidaEm)}</b><span class="small muted">válida até ${fmtD(c.validade)} · ${c.status}${c.motivo ? `: ${esc(c.motivo)}` : ''}</span></span><span class="mono small">${CARTAO.fmtCod(c.codigo)}</span></div>`).join('')}</div></details>` : ''}
      </section>`;
  },
  after() { const a = assoc(P.id); if (a && carteirinhaAtiva(a.id)) previewCartao(a); }
};
function cartPainel(a, cs) {
  const c = cs.c;
  return `<div class="cart-wrap"><div class="cart-preview" id="cart-prev"><div class="cart-face"></div><div class="cart-face"></div></div>
    <div class="cart-side">
      <dl class="facts"><div><dt>Emitida em</dt><dd>${fmtStamp(c.emitidaEm)}</dd></div><div><dt>Validade</dt><dd>${pill(cs.label, cs.cls)}</dd></div>
        <div><dt>Código de validação</dt><dd class="mono">${CARTAO.fmtCod(c.codigo)}</dd></div>${c.enviadaEm ? `<div><dt>Enviada por e-mail</dt><dd>${fmtStamp(c.enviadaEm)}</dd></div>` : ''}
        ${c.liberadaPor ? `<div class="full"><dt>Liberada com mensalidades em atraso</dt><dd class="small">${esc(c.liberadaPor)}: ${esc(c.justificativa)}</dd></div>` : ''}</dl>
      <div class="btn-grid">
        <button class="btn" data-act="cartImprimir" data-id="${c.id}" data-modo="a4">${ic('print')} Imprimir (folha A4)</button>
        <button class="btn" data-act="cartImprimir" data-id="${c.id}" data-modo="pvc">${ic('card')} Imprimir (cartão PVC)</button>
        <button class="btn" data-act="cartImagem" data-id="${c.id}">${ic('image')} Imagem para enviar</button>
        <button class="btn" data-act="cartLink" data-id="${c.id}">${ic('link')} Link pessoal</button>
        ${a.telefone ? `<button class="btn" data-act="cartWhats" data-id="${c.id}">${ic('whats')} Enviar no WhatsApp</button>` : ''}
        <button class="btn" data-act="cartEmail" data-id="${c.id}" ${a.email ? '' : 'disabled title="Sem e-mail cadastrado"'}>${ic('mail')} Enviar por e-mail</button>
        <button class="btn ghost danger-text" data-act="cartCancelar" data-id="${c.id}">${ic('x')} Cancelar carteirinha</button>
      </div></div></div>`;
}

/* ---- Formulário do associado ---- */
VIEWS.associadoForm = {
  render() {
    const a = P.id ? assoc(P.id) : null, ed = !!a;
    const v = (k, d = '') => esc(a ? (a[k] ?? d) : d);
    const cats = S.categorias.filter(c => c.ativa || (a && c.id === a.categoriaId));
    return `<div><button class="back" data-act="go" data-v="${ed ? 'associado' : 'associados'}" ${ed ? `data-id="${a.id}"` : ''}>${ic('back')} ${ed ? 'Voltar' : 'Associados'}</button>
      <div class="page-head"><div><h1>${ed ? 'Editar associado' : 'Novo associado'}</h1><p class="sub">${ed ? `Matrícula ${fmtMat(a.matricula)}.` : 'A matrícula é gerada automaticamente. Para quem já tem número antigo, informe em "Matrícula".'}</p></div></div></div>
      <form class="panel form" data-form="assoc" novalidate>
        <fieldset><legend>Identificação</legend><div class="fields">
          ${ed ? '' : `<div class="field photo-field"><label>Foto</label><div class="photo-pick" id="photo-pick">${UI.foto ? `<img src="${UI.foto.preview}" alt="Foto escolhida">` : `<span>${ic('camera')}</span>`}</div>
            <div class="inline"><label class="btn sm" for="f-foto">${ic('camera')} ${UI.foto ? 'Trocar foto' : 'Tirar ou escolher foto'}</label><input id="f-foto" type="file" accept="image/*" data-ch="fotoArquivo" class="sr"></div><span class="hint">Rosto de frente, fundo claro. Você pode ajustar o enquadramento.</span></div>`}
          <div class="field full"><label for="f-nome">Nome completo <span class="req">*</span></label><input id="f-nome" value="${v('nome')}" autocomplete="off"><span class="msg" id="m-nome"></span></div>
          <div class="field"><label for="f-cpf">CPF</label><input id="f-cpf" class="mono" inputmode="numeric" data-in="cpfForm" value="${esc(a ? fmtCPF(a.cpf) : '')}" placeholder="000.000.000-00"><span class="msg" id="m-cpf"></span></div>
          <div class="field"><label for="f-rg">RG</label><input id="f-rg" value="${v('rg')}"></div>
          <div class="field"><label for="f-nasc">Data de nascimento</label><input id="f-nasc" type="date" value="${v('nascimento')}" max="${TODAY()}"><span class="msg" id="m-nasc"></span></div>
          ${ed && !isAdmin() ? '' : `<div class="field"><label for="f-mat">Matrícula</label><input id="f-mat" class="mono" inputmode="numeric" value="${ed ? a.matricula : ''}" placeholder="${ed ? '' : `Automática: ${fmtMat(Math.max(S.seqMatricula || 0, ...S.associados.map(x => x.matricula), 0) + 1)}`}"><span class="hint">${ed ? 'Só o administrador altera.' : 'Deixe em branco para usar a próxima.'}</span><span class="msg" id="m-mat"></span></div>`}
        </div></fieldset>
        <fieldset><legend>Contato</legend><div class="fields">
          <div class="field"><label for="f-tel">Telefone / WhatsApp</label><input id="f-tel" inputmode="tel" value="${v('telefone')}" placeholder="(54) 90000-0000"></div>
          <div class="field"><label for="f-email">E-mail</label><input id="f-email" type="email" value="${v('email')}"><span class="hint">Usado para enviar a carteirinha.</span><span class="msg" id="m-email"></span></div>
          <div class="field full"><label for="f-end">Endereço</label><input id="f-end" value="${v('endereco')}" placeholder="Rua, número, bairro, cidade/UF, CEP"></div>
        </div></fieldset>
        <fieldset><legend>Associação</legend><div class="fields">
          <div class="field"><label for="f-cat">Categoria <span class="req">*</span></label><select id="f-cat"><option value="">Escolha…</option>${cats.map(c => `<option value="${c.id}" ${a && a.categoriaId === c.id ? 'selected' : ''}>${esc(c.nome)} · ${c.valor ? fmtBRL(c.valor) + '/mês' : 'sem mensalidade'}</option>`).join('')}</select><span class="msg" id="m-cat"></span></div>
          <div class="field"><label for="f-ing">Data de ingresso <span class="req">*</span></label><input id="f-ing" type="date" value="${v('dataIngresso', TODAY())}" max="${TODAY()}"><span class="msg" id="m-ing"></span></div>
          <div class="field"><label for="f-sit">Situação</label><select id="f-sit">${['Ativo', 'Afastado', 'Desligado', 'Falecido'].map(s => `<option ${(a ? a.situacao : 'Ativo') === s ? 'selected' : ''}>${s}</option>`).join('')}</select><span class="hint">Só associados ativos têm carteirinha válida e mensalidade cobrada.</span></div>
          ${ed ? '' : `<div class="field"><label for="f-fun">Função principal</label><select id="f-fun"><option value="">Nenhuma por enquanto</option>${['Da casa', 'Administrativa'].map(t => `<optgroup label="${t}">${S.funcoes.filter(f => f.ativa && f.tipo === t).map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')}</optgroup>`).join('')}</select><span class="hint">Outras funções podem ser atribuídas depois.</span></div>`}
          <div class="field full"><label for="f-obs">Observações</label><textarea id="f-obs">${v('obs')}</textarea></div>
        </div></fieldset>
        <div class="form-actions"><button type="button" class="btn" data-act="go" data-v="${ed ? 'associado' : 'associados'}" ${ed ? `data-id="${a.id}"` : ''}>Cancelar</button><button class="btn primary">${ed ? 'Salvar alterações' : 'Cadastrar associado'}</button></div>
      </form>`;
  },
};

/* ---- Mensalidades ---- */
function mensLista() {
  const mes = P.mes || COMP_ATUAL(), f = P.f || 'todos', q = norm(P.q || '');
  return S.associados.filter(a => a.situacao === 'Ativo').map(a => {
    const fin = financeiro(a); const p = fin.pagas[mes];
    const devido = fin.cobrado && mes >= fin.inicio;
    return { a, fin, p, devido, st: p ? (p.forma === 'Isenção' ? 'isento' : 'pago') : devido ? (mes > COMP_ATUAL() ? 'futuro' : 'aberto') : 'nao' };
  }).filter(x => x.fin.cobrado || x.p)
    .filter(x => f === 'todos' || (f === 'aberto' && x.st === 'aberto') || (f === 'pagos' && (x.st === 'pago' || x.st === 'isento')) || (f === 'inadimplentes' && x.fin.bloqueia))
    .filter(x => !q || norm(x.a.nome).includes(q) || String(x.a.matricula) === String(+digits(P.q)))
    .sort((x, y) => x.a.nome.localeCompare(y.a.nome, 'pt-BR'));
}
function mensResults() {
  const mes = P.mes || COMP_ATUAL(), list = mensLista();
  const ST = { pago: ['Pago', 'ok'], isento: ['Isento no mês', 'mute'], aberto: ['Em aberto', 'warn'], futuro: ['A vencer', 'info'], nao: ['Não cobrado', 'mute'] };
  if (!list.length) return '<div class="table-wrap"><div class="empty">Ninguém nesta lista.</div></div>';
  return `<div class="table-wrap cards"><table><thead><tr><th>Associado</th><th>Mensalidade</th><th>${fmtComp(mes)}</th><th>Atraso total</th><th><span class="sr">Ações</span></th></tr></thead><tbody>
    ${list.map(x => `<tr><td class="lead"><button class="who-row linklike" data-act="go" data-v="associado" data-id="${x.a.id}">${avatar(x.a)}<div><div class="t">${esc(x.a.nome)}</div><div class="s mono">${fmtMat(x.a.matricula)}</div></div></button></td>
      <td data-label="Mensalidade">${esc(catNome(x.a.categoriaId))}<div class="s">${fmtBRL(x.fin.valor)}</div></td>
      <td data-label="${fmtComp(mes)}">${pill(...ST[x.st])}${x.p ? `<div class="s">${fmtD(x.p.dataPagamento)} · ${esc(x.p.forma)}</div>` : ''}</td>
      <td data-label="Atraso total">${x.fin.atraso ? pill(plural(x.fin.atraso, 'mês', 'meses'), x.fin.bloqueia ? 'bad' : 'warn') : '<span class="muted small">em dia</span>'}</td>
      <td class="actions">${x.fin.aberto.length || x.st === 'futuro' ? `<button class="btn sm primary" data-act="pagNovo" data-id="${x.a.id}">${ic('coin')} Registrar</button>` : ''}</td></tr>`).join('')}
  </tbody></table></div>`;
}
VIEWS.mensalidades = {
  render() {
    const mes = P.mes || COMP_ATUAL(), f = P.f || 'todos';
    const todos = S.associados.filter(a => a.situacao === 'Ativo').map(a => ({ a, fin: financeiro(a) })).filter(x => x.fin.cobrado);
    const devidos = todos.filter(x => mes >= x.fin.inicio);
    const pagosMes = devidos.filter(x => x.fin.pagas[mes]);
    const recebidos = S.pagamentos.filter(p => !p.cancelado && compOf(p.dataPagamento) === mes);
    const esperado = devidos.reduce((s, x) => s + x.fin.valor, 0);
    const tab = (id, label, n) => `<button class="tab ${f === id ? 'on' : ''}" data-act="mensF" data-f="${id}">${label}${n != null ? ` <span class="count">${n}</span>` : ''}</button>`;
    return `<div class="page-head"><div><h1>Mensalidades</h1><p class="sub">Tolerância para emitir carteirinha: ${plural(S.config.toleranciaMeses, 'mês', 'meses')} em atraso. Cobrança desde ${fmtComp(S.config.cobrancaDesde)}.</p></div>
      <div class="toolbar"><button class="btn sm" data-act="printMens">${ic('print')} Imprimir</button><button class="btn primary" data-act="pagNovo">${ic('coin')} Registrar pagamento</button></div></div>
      <div class="toolbar"><div class="field" style="flex:0 1 190px"><label for="m-mes">Mês</label><input id="m-mes" type="month" value="${mes}" data-ch="mensMes"></div>
        <label class="search" style="align-self:end"><span class="sr">Buscar</span>${ic('search')}<input id="m-q" data-in="mensQ" value="${esc(P.q || '')}" placeholder="Nome ou matrícula" autocomplete="off"></label></div>
      <div class="kpis">
        ${kpiBox(`Pagos em ${fmtComp(mes)}`, `${pagosMes.length} de ${devidos.length}`, devidos.length ? `${Math.round(pagosMes.length / devidos.length * 100)}% dos associados cobrados` : 'ninguém cobrado neste mês')}
        ${kpiBox('Esperado no mês', fmtBRL(esperado), 'soma das mensalidades devidas')}
        ${kpiBox(`Recebido em ${fmtComp(mes)}`, fmtBRL(recebidos.reduce((s, p) => s + p.valor, 0)), `${plural(recebidos.length, 'lançamento', 'lançamentos')} com data de pagamento no mês`)}
        ${kpiBox('Acima da tolerância', todos.filter(x => x.fin.bloqueia).length, 'não podem renovar a carteirinha', todos.some(x => x.fin.bloqueia) ? 'bad' : '', 'data-act="mensF" data-f="inadimplentes"')}
      </div>
      <div class="tabs" role="tablist">${tab('todos', 'Todos')}${tab('aberto', 'Em aberto no mês', devidos.filter(x => !x.fin.pagas[mes] && mes <= COMP_ATUAL()).length)}${tab('pagos', 'Pagos no mês', pagosMes.length)}${tab('inadimplentes', 'Acima da tolerância', todos.filter(x => x.fin.bloqueia).length)}</div>
      <div id="mens-res">${mensResults()}</div>`;
  }
};

/* ---- Carteirinhas ---- */
function cartLista() {
  const f = P.f || 'todas', q = norm(P.q || '');
  return S.associados.filter(a => a.situacao === 'Ativo').map(a => ({ a, c: cartSt(a), fin: financeiro(a) }))
    .filter(x => f === 'todas' ? x.c.code !== 'nenhuma' : f === 'vencidas' ? x.c.code === 'vencida' : f === 'vence' ? x.c.code === 'vence' : f === 'sem' ? x.c.code === 'nenhuma' : true)
    .filter(x => !q || norm(x.a.nome).includes(q) || String(x.a.matricula) === String(+digits(P.q)))
    .sort((x, y) => x.a.nome.localeCompare(y.a.nome, 'pt-BR'));
}
function cartResults() {
  const list = cartLista();
  if (!list.length) return '<div class="table-wrap"><div class="empty">Ninguém nesta lista.</div></div>';
  const todosSel = list.every(x => UI.sel.has(x.a.id));
  return `<div class="table-wrap cards"><table><thead><tr><th><label class="check"><input type="checkbox" data-ch="cartTodos" ${todosSel ? 'checked' : ''}><span class="sr">Selecionar todos</span></label></th><th>Associado</th><th>Carteirinha</th><th>Mensalidade</th><th>Função</th></tr></thead><tbody>
    ${list.map(x => `<tr><td class="pick"><label class="check"><input type="checkbox" data-ch="cartSel" data-id="${x.a.id}" ${UI.sel.has(x.a.id) ? 'checked' : ''}><span class="sr">Selecionar ${esc(x.a.nome)}</span></label></td>
      <td class="lead"><button class="who-row linklike" data-act="go" data-v="associado" data-id="${x.a.id}">${avatar(x.a)}<div><div class="t">${esc(x.a.nome)}</div><div class="s mono">${fmtMat(x.a.matricula)}</div></div></button></td>
      <td data-label="Carteirinha">${pill(x.c.label, x.c.cls)}</td><td data-label="Mensalidade">${finPill(x.a, x.fin)}</td><td data-label="Função">${esc(funcaoPrincipal(x.a.id) || '—')}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function cartBarra() {
  const sel = [...UI.sel].map(assoc).filter(Boolean), comCart = sel.filter(a => carteirinhaAtiva(a.id));
  return `<span class="small"><b>${plural(sel.length, 'selecionado', 'selecionados')}</b>${sel.length ? ` · ${comCart.length} com carteirinha ativa` : ''}</span>
    <button class="btn sm" data-act="cartLote" data-modo="a4" ${comCart.length ? '' : 'disabled'}>${ic('print')} Imprimir A4</button>
    <button class="btn sm" data-act="cartLote" data-modo="pvc" ${comCart.length ? '' : 'disabled'}>${ic('card')} Imprimir PVC</button>
    <button class="btn sm primary" data-act="cartEmitirLote" ${sel.length ? '' : 'disabled'}>Emitir / renovar</button>`;
}
VIEWS.carteirinhas = {
  render() {
    const k = kpis(), f = P.f || 'todas';
    const tab = (id, label, n) => `<button class="tab ${f === id ? 'on' : ''}" data-act="cartF" data-f="${id}">${label}${n != null ? ` <span class="count">${n}</span>` : ''}</button>`;
    const ativas = S.associados.filter(a => a.situacao === 'Ativo' && carteirinhaAtiva(a.id)).length;
    return `<div class="page-head"><div><h1>Carteirinhas</h1><p class="sub">Validade: ${S.config.validadeModo === '12meses' ? '12 meses a partir da emissão' : 'até 31 de dezembro do ano da emissão'}. Selecione para imprimir ou emitir várias de uma vez.</p></div>
      <a class="btn sm" href="validar.html" target="_blank" rel="noopener">${ic('check')} Página de validação</a></div>
      <div class="tabs" role="tablist">${tab('todas', 'Com carteirinha', ativas)}${tab('vence', 'Vencem em 30 dias', k.vencendo.length)}${tab('vencidas', 'Vencidas', k.vencidas.length)}${tab('sem', 'Sem carteirinha', k.semCart.length)}</div>
      <div class="toolbar"><label class="search"><span class="sr">Buscar</span>${ic('search')}<input id="c-q" data-in="cartQ" value="${esc(P.q || '')}" placeholder="Nome ou matrícula" autocomplete="off"></label></div>
      <div class="sel-bar" id="cart-bar">${cartBarra()}</div>
      <div id="cart-res">${cartResults()}</div>`;
  }
};

/* ---- Funções ---- */
VIEWS.funcoes = {
  render() {
    const grupo = tipo => {
      const fs = S.funcoes.filter(f => f.tipo === tipo && (f.ativa || isAdmin())).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      return `<section class="panel"><div class="panel-head"><h2>${tipo === 'Da casa' ? 'Funções da casa' : 'Cargos administrativos'}</h2>${isAdmin() ? `<button class="btn sm" data-act="funcaoNova" data-t="${tipo}">${ic('plus')} Nova</button>` : ''}</div>
        ${fs.length ? fs.map(f => {
          const quem = S.assocFuncoes.filter(x => x.funcaoId === f.id && (!x.fim || x.fim >= TODAY())).map(x => assoc(x.assocId)).filter(a => a && a.situacao === 'Ativo').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
          return `<div class="fun-block ${f.ativa ? '' : 'dim'}"><div class="fun-head"><b>${esc(f.nome)}</b> <span class="small muted">${plural(quem.length, 'pessoa', 'pessoas')}${f.ativa ? '' : ' · inativa'}</span>${isAdmin() ? `<button class="btn sm ghost" data-act="funcaoEditar" data-id="${f.id}">${ic('edit')} Editar</button>` : ''}</div>
            ${quem.length ? `<div class="chips">${quem.map(a => `<button class="chip-btn" data-act="go" data-v="associado" data-id="${a.id}">${avatar(a, 'xs')}${esc(a.nome)}</button>`).join('')}</div>` : '<p class="small muted">Ninguém nesta função.</p>'}</div>`;
        }).join('') : '<div class="empty">Nenhuma função cadastrada.</div>'}</section>`;
    };
    return `<div class="page-head"><div><h1>Funções</h1><p class="sub">Quem exerce cada função hoje. Para atribuir ou encerrar, abra o cadastro do associado.</p></div>
      <button class="btn sm" data-act="printFuncoes">${ic('print')} Imprimir quadro</button></div>
      <div class="grid-2">${grupo('Administrativa')}${grupo('Da casa')}</div>`;
  }
};

/* ---- Configurações ---- */
VIEWS.configuracoes = {
  admin: true,
  render() {
    const c = S.config, a = c.assoc || {};
    return `<div class="page-head"><div><h1>Configurações</h1><p class="sub">Regras de mensalidade e carteirinha, dados da associação e categorias. Só administradores alteram.</p></div></div>
      <section class="panel"><div class="panel-head"><h2>Categorias e valores da mensalidade</h2><button class="btn sm primary" data-act="catNova">${ic('plus')} Nova categoria</button></div>
        <p class="small muted">Categoria com valor R$ 0,00 não tem cobrança (ex.: isentos). Mudar o valor vale para os meses que ainda serão registrados.</p>
        <div class="table-wrap cards"><table><thead><tr><th>Categoria</th><th>Mensalidade</th><th>Associados ativos</th><th>Situação</th><th><span class="sr">Ações</span></th></tr></thead><tbody>
        ${S.categorias.map(k => `<tr class="${k.ativa ? '' : 'dim'}"><td class="lead"><b>${esc(k.nome)}</b></td><td data-label="Mensalidade" class="num">${k.valor ? fmtBRL(k.valor) : 'sem cobrança'}</td>
          <td data-label="Ativos" class="num">${S.associados.filter(x => x.categoriaId === k.id && x.situacao === 'Ativo').length}</td><td data-label="Situação">${pill(k.ativa ? 'Ativa' : 'Inativa', k.ativa ? 'ok' : 'mute')}</td>
          <td class="actions"><button class="btn sm" data-act="catEditar" data-id="${k.id}">${ic('edit')} Editar</button></td></tr>`).join('')}
        </tbody></table></div></section>
      <form class="panel form" data-form="config" novalidate>
        <fieldset><legend>Mensalidades</legend><div class="fields">
          <div class="field"><label for="c-desde">Cobrar mensalidades a partir de</label><input id="c-desde" type="month" value="${c.cobrancaDesde}"><span class="hint">Meses anteriores não contam como atraso. Use o mês em que o controle começou a ser feito no sistema.</span></div>
          <div class="field"><label for="c-tol">Tolerância de atraso (meses)</label><input id="c-tol" type="number" min="0" max="24" value="${c.toleranciaMeses}"><span class="hint">Acima disso a carteirinha não pode ser emitida nem renovada (o admin pode liberar, com motivo).</span></div>
        </div></fieldset>
        <fieldset><legend>Carteirinha</legend><div class="fields">
          <div class="field"><label for="c-val">Validade</label><select id="c-val"><option value="fimAno" ${c.validadeModo !== '12meses' ? 'selected' : ''}>Até 31 de dezembro do ano da emissão</option><option value="12meses" ${c.validadeModo === '12meses' ? 'selected' : ''}>12 meses a partir da emissão</option></select></div>
          <div class="field"><label for="c-pres">Nome do(a) presidente</label><input id="c-pres" value="${esc(c.presidenteNome || '')}"><span class="hint">Aparece sob a assinatura, no verso.</span></div>
          <div class="field full"><label for="c-verso">Texto do verso</label><input id="c-verso" maxlength="200" value="${esc(c.textoVerso || '')}"></div>
          <div class="field full"><label for="c-url">Endereço do sistema (usado no QR Code e nos links)</label><input id="c-url" value="${esc(c.siteUrl || '')}"><span class="hint">Só mude se o endereço do site mudar. Carteirinhas já impressas continuam apontando para o endereço antigo.</span></div>
        </div></fieldset>
        <fieldset><legend>Dados da associação</legend><div class="fields">
          <div class="field full"><label for="a-nome">Nome da associação</label><input id="a-nome" value="${esc(a.nome || '')}"></div>
          <div class="field"><label for="a-cnpj">CNPJ</label><input id="a-cnpj" class="mono" inputmode="numeric" value="${esc(fmtCNPJ(a.cnpj || ''))}" placeholder="00.000.000/0000-00"><span class="msg" id="m-acnpj"></span></div>
          <div class="field"><label for="a-tel">Telefone / WhatsApp</label><input id="a-tel" inputmode="tel" value="${esc(a.telefone || '')}"></div>
          <div class="field full"><label for="a-end">Endereço</label><input id="a-end" value="${esc(a.endereco || '')}"></div>
          <div class="field"><label for="a-email">E-mail</label><input id="a-email" type="email" value="${esc(a.email || '')}"><span class="msg" id="m-aemail"></span></div>
          <div class="field"><label for="a-site">Site ou rede social</label><input id="a-site" value="${esc(a.site || '')}"></div>
        </div></fieldset>
        <div class="form-actions"><button class="btn primary">Salvar configurações</button></div>
      </form>
      <section class="panel"><div class="panel-head"><h2>Assinatura do(a) presidente</h2></div>
        <div class="sign-row"><div class="sign-box">${S.assinatura ? `<img src="${CARTAO.dataUrl(S.assinatura)}" alt="Assinatura cadastrada">` : '<span class="muted small">Nenhuma assinatura cadastrada</span>'}</div>
          <div class="toolbar"><label class="btn sm" for="c-ass">${ic('image')} ${S.assinatura ? 'Trocar imagem' : 'Enviar imagem'}</label><input id="c-ass" type="file" accept="image/*" data-ch="assinaturaArquivo" class="sr">${S.assinatura ? `<button class="btn sm danger" data-act="assRemover">Remover</button>` : ''}</div></div>
        <p class="small muted">Assine com caneta escura em papel branco e fotografe bem de perto. O sistema recorta, deixa o fundo transparente e reduz o tamanho automaticamente.</p></section>`;
  }
};
VIEWS.operadores = {
  admin: true,
  render() {
    return `<div class="page-head"><div><h1>Operadores</h1><p class="sub">Contas Google que podem entrar neste sistema. É uma lista separada da biblioteca.</p></div></div>
      <div class="table-wrap cards"><table><thead><tr><th>Conta Google</th><th>Perfil</th><th>Situação</th><th>Último acesso</th><th><span class="sr">Ações</span></th></tr></thead><tbody>
      ${S.operadores.map((o, i) => { const self = o.email === S.session.email; return `<tr><td class="lead"><div class="t">${esc(o.nome)}${self ? ' <span class="chip">você</span>' : ''}</div><div class="s">${esc(o.email)}</div></td>
        <td data-label="Perfil">${o.perfil === 'Admin' ? '<span class="role">Admin</span>' : 'Operador'}</td><td data-label="Situação">${pill(o.status, o.status === 'Ativo' ? 'ok' : 'mute')}</td>
        <td data-label="Último acesso" class="num">${fmtStamp(o.ultimoAcesso)}</td>
        <td class="actions">${self ? '' : `<button class="btn sm" data-act="opPerfil" data-i="${i}">${o.perfil === 'Admin' ? 'Tornar operador' : 'Tornar admin'}</button><button class="btn sm ${o.status === 'Ativo' ? 'danger' : ''}" data-act="opStatus" data-i="${i}">${o.status === 'Ativo' ? 'Inativar' : 'Reativar'}</button>`}</td></tr>`; }).join('')}
      </tbody></table></div>
      <form class="panel form" data-form="operador" novalidate><h2>Adicionar operador</h2><div class="fields">
        <div class="field"><label for="o-email">E-mail da conta Google <span class="req">*</span></label><input id="o-email" type="email" placeholder="nome@gmail.com"><span class="msg" id="m-oemail"></span></div>
        <div class="field"><label for="o-nome">Nome <span class="req">*</span></label><input id="o-nome"><span class="msg" id="m-onome"></span></div>
        <div class="field"><label for="o-perfil">Perfil</label><select id="o-perfil"><option>Operador</option><option>Admin</option></select><span class="hint">Admin gerencia operadores, configurações, categorias e funções, vê o CPF completo, cancela pagamentos e libera carteirinha com atraso.</span></div>
      </div><div class="form-actions"><button class="btn primary">${ic('plus')} Adicionar</button></div></form>`;
  }
};
VIEWS.atividades = {
  admin: true,
  render() {
    const q = norm(P.q || '');
    const list = S.atividades.filter(a => !q || norm(`${a.op} ${a.acao} ${a.det}`).includes(q)).slice(0, 80);
    return `<div class="page-head"><div><h1>Registro de atividades</h1><p class="sub">Quem fez o quê e quando: cadastros, pagamentos, carteirinhas e alterações.</p></div></div>
      <div class="toolbar"><label class="search"><span class="sr">Buscar</span>${ic('search')}<input id="at-q" data-in="atQ" value="${esc(P.q || '')}" placeholder="Operador, ação ou detalhe"></label></div>
      <div id="at-res">${atResults(list)}</div>`;
  }
};
const atResults = list => `<div class="table-wrap cards"><table><thead><tr><th>Data/hora</th><th>Operador</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>
  ${list.map(a => `<tr><td data-label="Data/hora" class="num">${fmtStamp(a.ts)}</td><td data-label="Operador" class="small">${esc(a.op)}</td><td data-label="Ação"><b>${esc(a.acao)}</b></td><td data-label="Detalhe">${esc(a.det)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nada encontrado.</td></tr>'}
  </tbody></table></div>`;

/* ============ Modal, toast, impressão e arquivos ============ */
function openModal(html, cls = '') { $('#modal-root').innerHTML = `<div class="overlay" data-act="overlay"><div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div></div>`; setTimeout(() => $('#modal-root .modal [autofocus], #modal-root .modal input:not([type=hidden]):not([type=checkbox]):not([type=range]), #modal-root .modal select')?.focus(), 30); }
function closeModal() { const m = $('#modal-root'); if (m) m.innerHTML = ''; if (UI.crop) { URL.revokeObjectURL(UI.crop.url); UI.crop = null; } }
function toast(msg, kind = 'ok') { const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = msg; $('#toasts').appendChild(d); setTimeout(() => d.remove(), kind === 'bad' ? 7000 : 4000); }
function copyText(t, ok = 'Copiado') {
  try { navigator.clipboard.writeText(t).then(() => toast(ok), () => toast('Não deu para copiar automaticamente. Selecione e copie o texto.', 'bad')); }
  catch (e) { toast('Não deu para copiar automaticamente. Selecione e copie o texto.', 'bad'); }
}
// Imprime só o conteúdo informado (o navegador também oferece "Salvar como PDF")
function printHTML(html, cls, css) {
  const r = $('#print-root'), job = String((UI.printJob = (UI.printJob || 0) + 1));
  r.className = cls || ''; r.dataset.job = job; r.innerHTML = (css ? `<style>${css}</style>` : '') + html;
  document.body.classList.add('printing');
  let done = false, pediu = false;
  // cada impressão só limpa o próprio conteúdo (uma impressão anterior não apaga a seguinte)
  const fim = () => { if (done || !pediu) return; done = true; window.removeEventListener('afterprint', fim); if (r.dataset.job !== job) return; document.body.classList.remove('printing'); r.innerHTML = ''; };
  window.addEventListener('afterprint', fim);
  // "pediu" evita que o fim de uma impressão anterior limpe esta antes da janela de impressão abrir
  setTimeout(() => { pediu = true; window.print(); setTimeout(fim, 1000); }, 120);
}
function baixar(blob, nome) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
const blobB64 = b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = () => rej(new Error('Não foi possível ler o arquivo.')); fr.readAsDataURL(b); });
const slug = s => norm(s).replace(/\s+/g, '-').slice(0, 40) || 'associado';
function docCab(titulo) {
  const a = assocCfg();
  return `<div class="doc-h"><img src="${LOGO}" alt=""><div><b>${esc(a.nome)}</b><div>${esc(titulo)}</div></div><div class="doc-n">Emitido em ${fmtD(TODAY())} ${hhmm()}</div></div>`;
}

/* ---- Foto: recorte 3 × 4 ---- */
const CROP_W = 360, CROP_H = 480;
function abrirRecorte(file, onOk) {
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)) { toast('Escolha uma imagem (foto).', 'bad'); return; }
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    UI.crop = { img, url, rot: 0, zoom: 1, x: 0, y: 0, onOk };
    openModal(`<h2>Ajustar foto</h2><p class="small muted">Arraste para centralizar o rosto e use o controle para aproximar.</p>
      <div class="crop-area"><canvas id="crop-c" width="${CROP_W}" height="${CROP_H}" aria-label="Pré-visualização da foto"></canvas></div>
      <div class="crop-tools"><span class="small muted">Aproximar</span><input type="range" id="crop-z" min="1" max="4" step="0.01" value="1" data-in="cropZoom" aria-label="Aproximar"><button type="button" class="btn sm" data-act="cropGirar">${ic('rotate')} Girar</button></div>
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="cropOk">Usar foto</button></div>`, 'modal-crop');
    cropDraw(); cropBind();
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Não foi possível abrir esta imagem. Tente outra foto (JPG ou PNG).', 'bad'); };
  img.src = url;
}
function cropGeom(W, H) {
  const c = UI.crop, rot = c.rot % 2 === 1, iw = rot ? c.img.height : c.img.width, ih = rot ? c.img.width : c.img.height;
  const k = W / CROP_W, s = Math.max(W / iw, H / ih) * c.zoom;
  const mx = Math.max(0, (iw * s - W) / 2), my = Math.max(0, (ih * s - H) / 2);
  c.x = Math.max(-mx / k, Math.min(mx / k, c.x)); c.y = Math.max(-my / k, Math.min(my / k, c.y));
  return { s, cx: W / 2 + c.x * k, cy: H / 2 + c.y * k };
}
function cropRender(canvas) {
  const c = UI.crop, W = canvas.width, H = canvas.height, g = canvas.getContext('2d'), { s, cx, cy } = cropGeom(W, H);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(cx, cy); g.rotate(c.rot * Math.PI / 2); g.drawImage(c.img, -c.img.width * s / 2, -c.img.height * s / 2, c.img.width * s, c.img.height * s); g.restore();
}
function cropDraw() { const cv = $('#crop-c'); if (cv && UI.crop) cropRender(cv); }
function cropBind() {
  const cv = $('#crop-c'); if (!cv) return; let drag = null;
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ox: UI.crop.x, oy: UI.crop.y }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!drag || !UI.crop) return; const r = cv.getBoundingClientRect(), k = CROP_W / r.width; UI.crop.x = drag.ox + (e.clientX - drag.x) * k; UI.crop.y = drag.oy + (e.clientY - drag.y) * k; cropDraw(); });
  const up = () => { drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); UI.crop.zoom = Math.max(1, Math.min(4, UI.crop.zoom * (e.deltaY < 0 ? 1.08 : 0.92))); $('#crop-z').value = UI.crop.zoom; cropDraw(); }, { passive: false });
}
function cropExport() {
  const out = (w, h, q) => { const c = document.createElement('canvas'); c.width = w; c.height = h; cropRender(c); return c.toDataURL('image/jpeg', q); };
  const foto = out(600, 800, 0.86), mini = out(120, 160, 0.72);
  return { foto: foto.split(',')[1], mini: mini.split(',')[1], preview: mini };
}

/* ---- Assinatura: fundo transparente, recorte e redução ---- */
function processarAssinatura(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, 1400 / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h), p = d.data; let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let i = 0; i < p.length; i += 4) {
        const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
        // fundo transparente ou claro vira transparente; o traço escuro vira tinta
        if (p[i + 3] < 128 || lum > 185) p[i + 3] = 0; else { p[i + 3] = Math.min(255, Math.round((185 - lum) / 120 * 255)); p[i] = Math.min(p[i], 40); p[i + 1] = Math.min(p[i + 1], 40); p[i + 2] = Math.min(p[i + 2], 90); const q = i / 4, x = q % w, y = (q / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 <= x0 || y1 <= y0) { rej(new Error('Não encontrei a assinatura na imagem. Use caneta escura em papel branco.')); return; }
      g.putImageData(d, 0, 0);
      const m = 8; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
      let largura = 640, b64 = '';
      do {
        const s = Math.min(largura / (x1 - x0 + 1), (largura * 0.3) / (y1 - y0 + 1), 1);
        const o = document.createElement('canvas'); o.width = Math.max(1, Math.round((x1 - x0 + 1) * s)); o.height = Math.max(1, Math.round((y1 - y0 + 1) * s));
        o.getContext('2d').drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, o.width, o.height);
        b64 = o.toDataURL('image/png').split(',')[1]; largura -= 80;
      } while (b64.length > 40000 && largura > 160);
      if (b64.length > 40000) { rej(new Error('Imagem da assinatura muito detalhada. Tente uma foto mais limpa.')); return; }
      res(b64);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não foi possível abrir a imagem.')); };
    img.src = url;
  });
}

/* ---- Carteirinha: dados, prévia, impressão, imagem e envio ---- */
const linkPessoal = c => S.config.siteUrl.replace(/\/?$/, '/') + 'carteirinha.html?t=' + c.token;
async function fotoCompleta(aid) {
  if (UI.fotos[aid] !== undefined) return UI.fotos[aid];
  const a = assoc(aid); if (!a.fotoId) return (UI.fotos[aid] = a.fotoMini || '');
  const r = await api('associado.fotoObter', { assocId: aid }, { silent: true });
  return (UI.fotos[aid] = r.foto || '');
}
async function dadosCartao(c, opt = {}) {
  const a = assoc(c.assocId), cs = cartSt(a);
  return {
    nome: a.nome, matricula: a.matricula, funcao: funcaoPrincipal(a.id) || c.funcao, categoria: catNome(a.categoriaId) || c.categoria, validade: c.validade,
    cpf: a.cpf ? fmtCPF(a.cpf) : '', rg: a.rg, dataIngresso: a.dataIngresso, foto: opt.full ? await fotoCompleta(a.id) : a.fotoMini, codigo: c.codigo,
    assoc: assocCfg(), presidenteNome: S.config.presidenteNome, assinatura: S.assinatura, textoVerso: S.config.textoVerso, siteUrl: S.config.siteUrl,
    logo: await CARTAO.logo(LOGO), selo: opt.selo === false ? null : cs.code === 'vencida' ? { txt: 'VENCIDA', cor: '#B4332A' } : null,
  };
}
async function previewCartao(a) {
  const c = carteirinhaAtiva(a.id), el = $('#cart-prev'); if (!c || !el) return;
  const d = await dadosCartao(c); if (!$('#cart-prev')) return;
  el.innerHTML = `<div class="cart-face">${CARTAO.frente(d)}</div><div class="cart-face">${CARTAO.verso(d)}</div>`;
}
async function imprimirCartoes(cards, modo) {
  const lista = [];
  for (let i = 0; i < cards.length; i++) { busy(true, `Preparando ${i + 1} de ${cards.length}…`); try { lista.push(await dadosCartao(cards[i], { full: true, selo: false })); } finally { busy(false); } }
  printHTML(modo === 'pvc' ? CARTAO.paginasPVC(lista) : CARTAO.folhaA4(lista), 'print-cards', CARTAO.CSS_IMPRESSAO[modo]);
}
function svgImg(svg) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Não foi possível gerar a imagem.')); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }); }
// Uma imagem com frente e verso, boa para mandar pelo WhatsApp
async function pngCompleto(d) {
  const [f, v] = await Promise.all([svgImg(CARTAO.frente(d)), svgImg(CARTAO.verso(d))]);
  const w = 1011, h = Math.round(w * CARTAO.H / CARTAO.W), gap = 40, c = document.createElement('canvas'); c.width = w + gap * 2; c.height = h * 2 + gap * 3;
  const g = c.getContext('2d'); g.fillStyle = '#EEF2EE'; g.fillRect(0, 0, c.width, c.height); g.drawImage(f, gap, gap, w, h); g.drawImage(v, gap, h + gap * 2, w, h);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Não foi possível gerar a imagem.')), 'image/png'));
}
function telWhats(t) { let d = digits(t); if (d.length === 10 || d.length === 11) d = '55' + d; return d; }
function opcoesPosEmissao(c) {
  const a = assoc(c.assocId);
  openModal(`<h2>Carteirinha emitida</h2><p class="muted">${esc(a.nome)} · válida até <b>${fmtD(c.validade)}</b>. Escolha como entregar:</p>
    <div class="btn-grid">
      <button class="btn" data-act="cartImprimir" data-id="${c.id}" data-modo="a4">${ic('print')} Imprimir (folha A4)</button>
      <button class="btn" data-act="cartImprimir" data-id="${c.id}" data-modo="pvc">${ic('card')} Imprimir (cartão PVC)</button>
      <button class="btn" data-act="cartImagem" data-id="${c.id}">${ic('image')} Imagem para enviar</button>
      <button class="btn" data-act="cartLink" data-id="${c.id}">${ic('link')} Link pessoal</button>
      ${a.telefone ? `<button class="btn" data-act="cartWhats" data-id="${c.id}">${ic('whats')} Enviar no WhatsApp</button>` : ''}
      ${a.email ? `<button class="btn" data-act="cartEmail" data-id="${c.id}">${ic('mail')} Enviar por e-mail</button>` : ''}
    </div><div class="modal-actions"><button class="btn primary" data-act="close">Concluir</button></div>`);
}
const validadePrevista = () => { const d = new Date(); return S.config.validadeModo === '12meses' ? isoLocal(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate() - 1)) : `${d.getFullYear()}-12-31`; };

/* ---- Relatórios e planilha ---- */
function csvCampo(v) { v = String(v ?? ''); return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
function exportarCsv(list) {
  const cab = ['Matrícula', 'Nome', 'CPF', 'RG', 'Nascimento', 'Telefone', 'E-mail', 'Endereço', 'Categoria', 'Situação', 'Ingresso', 'Função principal', 'Outras funções', 'Carteirinha válida até', 'Meses em atraso'];
  const linhas = list.map(a => { const c = carteirinhaAtiva(a.id), f = financeiro(a), pr = funcaoPrincipal(a.id); return [fmtMat(a.matricula), a.nome, isAdmin() ? fmtCPF(a.cpf) : maskCPF(a.cpf), a.rg, fmtD(a.nascimento).replace('—', ''), a.telefone, a.email, a.endereco, catNome(a.categoriaId), a.situacao, fmtD(a.dataIngresso), pr, funcoesAtuais(a.id).map(x => (funcao(x.funcaoId) || {}).nome).filter(n => n && n !== pr).join(', '), c ? fmtD(c.validade) : '', f.atraso || '']; });
  const txt = '﻿' + [cab, ...linhas].map(r => r.map(csvCampo).join(';')).join('\r\n');
  baixar(new Blob([txt], { type: 'text/csv;charset=utf-8' }), `associados-${TODAY()}.csv`);
}

/* ============ Ações ============ */
const ACT = {
  go(t) { const { v, act, ...rest } = t.dataset; go(v, rest); },
  menu() { UI.menu = true; render(); },
  menuClose() { UI.menu = false; render(); },
  overlay(t, e) { if (e.target === t) closeModal(); },
  close() { closeModal(); },
  refresh() { boot(true).then(ok => { if (ok) toast('Dados atualizados'); }); },
  retryBoot() { boot(); },
  loginReset() { setToken(''); S = null; UI.login = 'start'; UI.loginMsg = ''; render(); },
  logout() { setToken(''); S = null; UI.login = 'start'; UI.loginMsg = ''; UI.menu = false; closeModal(); try { google.accounts.id.disableAutoSelect(); } catch (e) { } render(); },
  copiar(t) { copyText(t.dataset.txt, t.dataset.ok || 'Copiado'); },

  /* Listas e relatórios */
  exportCsv() { exportarCsv(assocFiltrados()); },
  printLista() {
    const list = assocFiltrados();
    printHTML(`<div class="doc">${docCab(`Lista de associados (${(P.sit || 'Ativo') === 'todos' ? 'todas as situações' : (P.sit || 'Ativo') + 's'}) · ${plural(list.length, 'pessoa', 'pessoas')}`)}
      <table class="doc-t"><thead><tr><th>Matr.</th><th>Nome</th><th>Categoria</th><th>Função principal</th><th>Telefone</th><th>Situação</th></tr></thead><tbody>
      ${list.map(a => `<tr><td class="mono">${fmtMat(a.matricula)}</td><td>${esc(a.nome)}</td><td>${esc(catNome(a.categoriaId))}</td><td>${esc(funcaoPrincipal(a.id) || '—')}</td><td>${esc(a.telefone || '')}</td><td>${a.situacao}</td></tr>`).join('')}</tbody></table></div>`, 'doc-print');
  },
  printMens() {
    const mes = P.mes || COMP_ATUAL(), list = mensLista();
    printHTML(`<div class="doc">${docCab(`Mensalidades · ${fmtCompLongo(mes)}`)}
      <table class="doc-t"><thead><tr><th>Matr.</th><th>Nome</th><th>Valor</th><th>${fmtComp(mes)}</th><th>Meses em atraso</th></tr></thead><tbody>
      ${list.map(x => `<tr><td class="mono">${fmtMat(x.a.matricula)}</td><td>${esc(x.a.nome)}</td><td>${fmtBRL(x.fin.valor)}</td><td>${x.p ? `${x.p.forma === 'Isenção' ? 'Isento' : 'Pago'} em ${fmtD(x.p.dataPagamento)}` : x.st === 'aberto' ? 'Em aberto' : x.st === 'futuro' ? 'A vencer' : '—'}</td><td>${x.fin.atraso ? `${x.fin.atraso} (${x.fin.atrasadas.map(fmtComp).join(', ')})` : '—'}</td></tr>`).join('')}</tbody></table></div>`, 'doc-print');
  },
  printFuncoes() {
    const bloco = tipo => S.funcoes.filter(f => f.ativa && f.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(f => {
      const q = S.assocFuncoes.filter(x => x.funcaoId === f.id && (!x.fim || x.fim >= TODAY())).map(x => ({ a: assoc(x.assocId), x })).filter(o => o.a && o.a.situacao === 'Ativo').sort((m, n) => m.a.nome.localeCompare(n.a.nome, 'pt-BR'));
      return `<tr><td><b>${esc(f.nome)}</b></td><td>${q.map(o => `${esc(o.a.nome)} <span class="muted">(desde ${fmtD(o.x.inicio)})</span>`).join('<br>') || '—'}</td></tr>`;
    }).join('');
    printHTML(`<div class="doc">${docCab('Quadro de funções')}<h3>Cargos administrativos</h3><table class="doc-t"><tbody>${bloco('Administrativa')}</tbody></table><h3 style="margin-top:14px">Funções da casa</h3><table class="doc-t"><tbody>${bloco('Da casa')}</tbody></table></div>`, 'doc-print');
  },
  mensF(t) { P.f = t.dataset.f; if (VIEW !== 'mensalidades') go('mensalidades', { f: t.dataset.f }); else render(); },
  cartF(t) { P.f = t.dataset.f; UI.sel = new Set(); render(); },

  /* Foto */
  fotoTrocar(t) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) abrirRecorte(f, r => run(async () => { await api('associado.foto', { assocId: t.dataset.id, foto: r.foto, mini: r.mini }, { msg: 'Enviando foto…' }); delete UI.fotos[t.dataset.id]; render(); toast('Foto atualizada'); })); };
    inp.click();
  },
  cropGirar() { UI.crop.rot = (UI.crop.rot + 1) % 4; UI.crop.x = UI.crop.y = 0; cropDraw(); },
  cropOk() { const cb = UI.crop.onOk, r = cropExport(); closeModal(); cb(r); },

  /* Funções do associado */
  funAdd(t) {
    const a = assoc(t.dataset.id), atuais = funcoesAtuais(a.id).map(x => x.funcaoId);
    openModal(`<h2>Atribuir função</h2><p class="muted">${esc(a.nome)}</p>
      <div class="field"><label for="m-fun">Função</label><select id="m-fun">${['Da casa', 'Administrativa'].map(tp => `<optgroup label="${tp}">${S.funcoes.filter(f => f.ativa && f.tipo === tp && !atuais.includes(f.id)).map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')}</optgroup>`).join('')}</select></div>
      <div class="field"><label for="m-ini">Desde</label><input id="m-ini" type="date" value="${TODAY()}" max="${TODAY()}"></div>
      <label class="check"><input type="checkbox" id="m-prin" ${atuais.length ? '' : 'checked disabled'}> Função principal (aparece na carteirinha)</label>
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="funAddOk" data-id="${a.id}">Atribuir</button></div>`);
  },
  funAddOk(t) { run(async () => { await api('assocFuncao.adicionar', { assocId: t.dataset.id, funcaoId: $('#m-fun').value, inicio: $('#m-ini').value, principal: $('#m-prin').checked }); closeModal(); render(); toast('Função atribuída'); }); },
  funEncerrar(t) {
    const x = S.assocFuncoes.find(y => y.id === t.dataset.id), f = funcao(x.funcaoId);
    openModal(`<h2>Encerrar função</h2><p class="muted">${esc(assoc(x.assocId).nome)} · ${esc(f.nome)} desde ${fmtD(x.inicio)}</p>
      <div class="field"><label for="m-fim">Até</label><input id="m-fim" type="date" value="${TODAY()}" min="${x.inicio}"></div>
      <p class="small muted">A função fica no histórico do associado.</p>
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="funEncerrarOk" data-id="${x.id}">Encerrar</button></div>`);
  },
  funEncerrarOk(t) { run(async () => { await api('assocFuncao.encerrar', { id: t.dataset.id, fim: $('#m-fim').value }); closeModal(); render(); toast('Função encerrada'); }); },
  funPrincipal(t) { run(async () => { await api('assocFuncao.principal', { id: t.dataset.id }); render(); toast('Função principal alterada'); }); },
  funExcluir(t) {
    const x = S.assocFuncoes.find(y => y.id === t.dataset.id);
    openModal(`<h2>Excluir este lançamento?</h2><p class="muted">Use só para corrigir um lançamento errado. Se a pessoa deixou a função, use <b>Encerrar</b>, que mantém o histórico.</p><p><b>${esc((funcao(x.funcaoId) || {}).nome)}</b> · ${esc(assoc(x.assocId).nome)}</p>
      <div class="modal-actions"><button class="btn" data-act="close">Voltar</button><button class="btn danger" data-act="funExcluirOk" data-id="${x.id}">Excluir</button></div>`);
  },
  funExcluirOk(t) { run(async () => { await api('assocFuncao.excluir', { id: t.dataset.id }); closeModal(); render(); toast('Lançamento excluído'); }); },

  /* Tabelas (admin) */
  funcaoNova(t) { ACT.funcaoForm(null, t.dataset.t); },
  funcaoEditar(t) { ACT.funcaoForm(funcao(t.dataset.id)); },
  funcaoForm(f, tipo) {
    openModal(`<h2>${f ? 'Editar função' : 'Nova função'}</h2>
      <div class="field"><label for="m-fnome">Nome</label><input id="m-fnome" value="${esc(f ? f.nome : '')}" maxlength="80"></div>
      <div class="field"><label for="m-ftipo">Tipo</label><select id="m-ftipo">${['Da casa', 'Administrativa'].map(tp => `<option ${(f ? f.tipo : tipo) === tp ? 'selected' : ''}>${tp}</option>`).join('')}</select></div>
      ${f ? `<label class="check"><input type="checkbox" id="m-fativa" ${f.ativa ? 'checked' : ''}> Ativa (aparece nas listas para atribuir)</label>` : ''}
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="funcaoOk" data-id="${f ? f.id : ''}">Salvar</button></div>`);
  },
  funcaoOk(t) { run(async () => { await api('funcao.salvar', { id: t.dataset.id || undefined, nome: $('#m-fnome').value, tipo: $('#m-ftipo').value, ativa: $('#m-fativa') ? $('#m-fativa').checked : true }); closeModal(); render(); toast('Função salva'); }); },
  catNova() { ACT.catForm(null); },
  catEditar(t) { ACT.catForm(categoria(t.dataset.id)); },
  catForm(c) {
    openModal(`<h2>${c ? 'Editar categoria' : 'Nova categoria'}</h2>
      <div class="field"><label for="m-cnome">Nome</label><input id="m-cnome" value="${esc(c ? c.nome : '')}" maxlength="60"></div>
      <div class="field"><label for="m-cval">Mensalidade (R$)</label><input id="m-cval" type="number" min="0" step="0.01" value="${c ? c.valor : ''}" placeholder="0,00"><span class="hint">0 = sem cobrança.</span></div>
      ${c ? `<label class="check"><input type="checkbox" id="m-cativa" ${c.ativa ? 'checked' : ''}> Ativa</label>` : ''}
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="catOk" data-id="${c ? c.id : ''}">Salvar</button></div>`);
  },
  catOk(t) { run(async () => { await api('categoria.salvar', { id: t.dataset.id || undefined, nome: $('#m-cnome').value, valor: String($('#m-cval').value || '0').replace(',', '.'), ativa: $('#m-cativa') ? $('#m-cativa').checked : true }); closeModal(); render(); toast('Categoria salva'); }); },
  assRemover() { run(async () => { await api('config.assinatura', { imagem: '' }); render(); toast('Assinatura removida'); }); },

  /* Mensalidades */
  pagNovo(t) {
    const id = t && t.dataset && t.dataset.id;
    if (!id) {
      const cand = S.associados.filter(a => a.situacao === 'Ativo' && financeiro(a).cobrado).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      if (!cand.length) { toast('Nenhum associado ativo com mensalidade. Defina os valores das categorias em Configurações.', 'bad'); return; }
      openModal(`<h2>Registrar pagamento</h2><div class="field"><label for="m-pq">Associado</label><input id="m-pq" list="m-plist" placeholder="Digite o nome ou a matrícula" autocomplete="off" data-in="pagBusca"><datalist id="m-plist">${cand.map(a => `<option value="${fmtMat(a.matricula)} · ${esc(a.nome)}">`).join('')}</datalist><span class="msg" id="m-pmsg"></span></div>
        <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="pagEscolher">Continuar</button></div>`);
      return;
    }
    const a = assoc(id), fin = financeiro(a);
    const futuros = []; for (let i = 1; i <= 6; i++) { const c = addMonthsComp(COMP_ATUAL(), i); if (!fin.pagas[c]) futuros.push(c); }
    const opcoes = [...fin.aberto, ...futuros];
    UI.pag = { id, valor: fin.valor };
    openModal(`<h2>Registrar pagamento</h2><p class="muted">${esc(a.nome)} · ${esc(catNome(a.categoriaId))} · ${fmtBRL(fin.valor)}/mês</p>
      ${fin.aberto.length ? `<p class="small">${plural(fin.aberto.length, 'mês em aberto', 'meses em aberto')}. Marque os meses pagos:</p>` : '<p class="small">Nenhum mês em aberto. Você pode registrar meses adiantados:</p>'}
      <div class="month-picks">${opcoes.map((c, i) => `<label class="mpick ${c < COMP_ATUAL() ? 'late' : c > COMP_ATUAL() ? 'future' : ''}"><input type="checkbox" data-ch="pagMes" value="${c}" ${i === 0 && fin.aberto.length ? 'checked' : ''}><span>${fmtComp(c)}</span></label>`).join('')}</div>
      <div class="fields"><div class="field"><label for="m-pforma">Forma</label><select id="m-pforma" data-ch="pagForma">${['PIX', 'Dinheiro', 'Transferência', 'Cartão', 'Isenção', 'Outro'].map(f => `<option>${f}</option>`).join('')}</select></div>
        <div class="field"><label for="m-pval">Valor total (R$)</label><input id="m-pval" type="number" min="0" step="0.01" value="${fin.aberto.length ? fin.valor.toFixed(2) : ''}"></div>
        <div class="field"><label for="m-pdata">Data do pagamento</label><input id="m-pdata" type="date" value="${TODAY()}" max="${TODAY()}"></div>
        <div class="field"><label for="m-pobs">Observação</label><input id="m-pobs" maxlength="300" placeholder="Opcional"></div></div>
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="pagOk">Registrar</button></div>`);
  },
  pagEscolher() {
    const v = $('#m-pq').value, m = /^(\d{1,6})/.exec(v.trim());
    const a = m ? S.associados.find(x => x.matricula === +m[1]) : S.associados.find(x => norm(x.nome) === norm(v));
    if (!a) { $('#m-pmsg').textContent = 'Escolha um associado da lista.'; return; }
    ACT.pagNovo({ dataset: { id: a.id } });
  },
  pagOk() {
    const comps = $$('#modal-root input[data-ch="pagMes"]:checked').map(i => i.value);
    if (!comps.length) { toast('Marque ao menos um mês.', 'bad'); return; }
    const forma = $('#m-pforma').value, val = String($('#m-pval').value || '').replace(',', '.');
    if (forma !== 'Isenção' && (val === '' || isNaN(+val))) { toast('Informe o valor total.', 'bad'); return; }
    run(async () => { await api('pagamento.registrar', { assocId: UI.pag.id, competencias: comps, valorTotal: forma === 'Isenção' ? 0 : +val, forma, dataPagamento: $('#m-pdata').value, obs: $('#m-pobs').value }); closeModal(); render(); toast(`${plural(comps.length, 'mês registrado', 'meses registrados')}`); });
  },
  pagCancelar(t) {
    const p = S.pagamentos.find(x => x.id === t.dataset.id);
    openModal(`<h2>Cancelar pagamento</h2><p class="muted">${esc(assoc(p.assocId).nome)} · ${fmtComp(p.competencia)} · ${fmtBRL(p.valor)} (${esc(p.forma)})</p>
      <div class="field"><label for="m-mot">Motivo</label><input id="m-mot" maxlength="300" placeholder="Ex.: lançado no associado errado"></div>
      <p class="small muted">O lançamento continua no histórico, marcado como cancelado, e o mês volta a ficar em aberto.</p>
      <div class="modal-actions"><button class="btn" data-act="close">Voltar</button><button class="btn danger" data-act="pagCancelarOk" data-id="${p.id}">Cancelar pagamento</button></div>`);
  },
  pagCancelarOk(t) { run(async () => { await api('pagamento.cancelar', { id: t.dataset.id, motivo: $('#m-mot').value }); closeModal(); render(); toast('Pagamento cancelado'); }); },

  /* Carteirinhas */
  cartEmitir(t) {
    const a = assoc(t.dataset.id), fin = financeiro(a), atual = carteirinhaAtiva(a.id), val = validadePrevista();
    if (fin.bloqueia && !isAdmin()) {
      openModal(`<h2>Mensalidades em atraso</h2><div class="note bad"><b>${esc(a.nome)} tem ${plural(fin.atraso, 'mês', 'meses')} em atraso</b><span>${fin.atrasadas.map(fmtComp).join(', ')}. A tolerância é de ${plural(S.config.toleranciaMeses, 'mês', 'meses')}.</span></div>
        <p class="small muted">Registre os pagamentos para liberar a carteirinha, ou peça a um administrador para liberar mesmo assim.</p>
        <div class="modal-actions"><button class="btn" data-act="close">Voltar</button><button class="btn primary" data-act="pagNovo" data-id="${a.id}">${ic('coin')} Registrar pagamento</button></div>`);
      return;
    }
    openModal(`<h2>${atual ? 'Renovar carteirinha' : 'Emitir carteirinha'}</h2>
      <dl class="facts"><div><dt>Associado</dt><dd>${esc(a.nome)}</dd></div><div><dt>Válida até</dt><dd><b>${fmtD(val)}</b></dd></div><div><dt>Função na carteirinha</dt><dd>${esc(funcaoPrincipal(a.id) || '—')}</dd></div><div><dt>Foto</dt><dd>${a.fotoMini ? 'cadastrada' : '<span style="color:var(--warn)">sem foto</span>'}</dd></div></dl>
      ${atual ? '<div class="note warn"><span>A carteirinha atual será substituída: o QR Code e o link pessoal antigos deixam de valer.</span></div>' : ''}
      ${fin.bloqueia ? `<div class="note bad"><b>${plural(fin.atraso, 'mês', 'meses')} em atraso (${fin.atrasadas.map(fmtComp).join(', ')})</b><span>Acima da tolerância. Como administrador, você pode liberar informando o motivo.</span></div>
        <div class="field"><label for="m-just">Motivo da liberação</label><input id="m-just" maxlength="300" placeholder="Ex.: acordo de pagamento"></div>` : ''}
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="cartEmitirOk" data-id="${a.id}" data-lib="${fin.bloqueia ? 1 : ''}">${fin.bloqueia ? 'Liberar e emitir' : atual ? 'Renovar' : 'Emitir'}</button></div>`);
  },
  cartEmitirOk(t) {
    run(async () => {
      const r = await api('carteirinha.emitir', { assocId: t.dataset.id, liberar: !!t.dataset.lib, justificativa: $('#m-just') ? $('#m-just').value : '' }, { msg: 'Emitindo…' });
      closeModal(); render(); opcoesPosEmissao(S.carteirinhas.find(c => c.id === r.id));
    });
  },
  cartImprimir(t) { const c = S.carteirinhas.find(x => x.id === t.dataset.id); closeModal(); run(() => imprimirCartoes([c], t.dataset.modo)); },
  cartImagem(t) {
    run(async () => {
      const c = S.carteirinhas.find(x => x.id === t.dataset.id), a = assoc(c.assocId);
      busy(true, 'Gerando imagem…');
      let blob; try { blob = await pngCompleto(await dadosCartao(c, { full: true })); } finally { busy(false); }
      const file = new File([blob], `carteirinha-${fmtMat(a.matricula)}-${slug(a.nome)}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Carteirinha de associado(a)', text: `Carteirinha de ${a.nome}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      baixar(blob, file.name); toast('Imagem baixada');
    });
  },
  cartLink(t) {
    const c = S.carteirinhas.find(x => x.id === t.dataset.id), a = assoc(c.assocId), link = linkPessoal(c);
    openModal(`<h2>Link pessoal da carteirinha</h2><p class="muted">${esc(a.nome)} abre este link no celular e vê a carteirinha sempre atualizada. Não precisa de login. Pode salvar na tela inicial.</p>
      <div class="inline"><input id="m-link" value="${esc(link)}" readonly onfocus="this.select()"><button class="btn" data-act="copiar" data-txt="${esc(link)}" data-ok="Link copiado">Copiar</button></div>
      <p class="small muted">Quem tiver o link vê a carteirinha (com CPF parcialmente oculto). Se o link cair em mãos erradas, renove a carteirinha: o link antigo deixa de funcionar.</p>
      <div class="modal-actions"><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Abrir</a>${a.telefone ? `<button class="btn" data-act="cartWhats" data-id="${c.id}">${ic('whats')} WhatsApp</button>` : ''}<button class="btn primary" data-act="close">Fechar</button></div>`);
  },
  cartWhats(t) {
    const c = S.carteirinhas.find(x => x.id === t.dataset.id), a = assoc(c.assocId);
    const msg = `Olá, ${a.nome.split(' ')[0]}! Sua carteirinha de associado(a) da ${assocCfg().nome} está pronta (válida até ${fmtD(c.validade)}). Abra pelo link e guarde no celular: ${linkPessoal(c)}`;
    window.open(`https://wa.me/${telWhats(a.telefone)}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  },
  cartEmail(t) {
    run(async () => {
      const c = S.carteirinhas.find(x => x.id === t.dataset.id), a = assoc(c.assocId);
      busy(true, 'Gerando imagens…'); let imagens = {};
      try { const d = await dadosCartao(c, { full: true, selo: false }); const [f, v] = await Promise.all([CARTAO.png(CARTAO.frente(d)), CARTAO.png(CARTAO.verso(d))]); imagens = { frente: await blobB64(f), verso: await blobB64(v) }; } finally { busy(false); }
      await api('carteirinha.email', { id: c.id, imagens }, { msg: 'Enviando e-mail…' });
      closeModal(); render(); toast(`Carteirinha enviada para ${a.email}`);
    });
  },
  cartCancelar(t) {
    const c = S.carteirinhas.find(x => x.id === t.dataset.id);
    openModal(`<h2>Cancelar carteirinha</h2><p class="muted">${esc(assoc(c.assocId).nome)} · válida até ${fmtD(c.validade)}</p>
      <div class="field"><label for="m-cmot">Motivo</label><input id="m-cmot" maxlength="300" placeholder="Ex.: perda, dados errados, desligamento"></div>
      <p class="small muted">O QR Code passa a mostrar "cancelada" e o link pessoal deixa de funcionar. Para dar uma nova, use Emitir.</p>
      <div class="modal-actions"><button class="btn" data-act="close">Voltar</button><button class="btn danger" data-act="cartCancelarOk" data-id="${c.id}">Cancelar carteirinha</button></div>`);
  },
  cartCancelarOk(t) { run(async () => { await api('carteirinha.cancelar', { id: t.dataset.id, motivo: $('#m-cmot').value }); closeModal(); render(); toast('Carteirinha cancelada'); }); },
  cartLote(t) { const cards = [...UI.sel].map(id => carteirinhaAtiva(id)).filter(Boolean).sort((a, b) => assoc(a.assocId).nome.localeCompare(assoc(b.assocId).nome, 'pt-BR')); run(() => imprimirCartoes(cards, t.dataset.modo)); },
  cartEmitirLote() {
    const sel = [...UI.sel].map(assoc).filter(a => a && a.situacao === 'Ativo');
    const bloq = sel.filter(a => financeiro(a).bloqueia), ok = sel.filter(a => !financeiro(a).bloqueia);
    openModal(`<h2>Emitir ou renovar carteirinhas</h2><p>${plural(ok.length, 'carteirinha será emitida', 'carteirinhas serão emitidas')}, válidas até <b>${fmtD(validadePrevista())}</b>. As atuais são substituídas.</p>
      ${bloq.length ? `<div class="note warn"><b>${plural(bloq.length, 'associado fica de fora', 'associados ficam de fora')} por mensalidades em atraso</b><span>${bloq.map(a => esc(a.nome)).join(', ')}. Emita individualmente${isAdmin() ? ', informando o motivo da liberação' : ' depois de registrar os pagamentos'}.</span></div>` : ''}
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="cartEmitirLoteOk" ${ok.length ? '' : 'disabled'}>Emitir ${ok.length}</button></div>`);
  },
  cartEmitirLoteOk() {
    const lista = [...UI.sel].map(assoc).filter(a => a && a.situacao === 'Ativo' && !financeiro(a).bloqueia);
    closeModal();
    run(async () => {
      let n = 0;
      for (const a of lista) { await api('carteirinha.emitir', { assocId: a.id }, { msg: `Emitindo ${n + 1} de ${lista.length}…` }); n++; }
      render(); toast(`${plural(n, 'carteirinha emitida', 'carteirinhas emitidas')}. Use "Imprimir" para imprimir as selecionadas.`);
    });
  },

  /* Administração */
  opPerfil(t) { const o = S.operadores[+t.dataset.i]; run(async () => { await api('operador.atualizar', { email: o.email, perfil: o.perfil === 'Admin' ? 'Operador' : 'Admin' }); render(); }); },
  opStatus(t) { const o = S.operadores[+t.dataset.i]; run(async () => { await api('operador.atualizar', { email: o.email, status: o.status === 'Ativo' ? 'Inativo' : 'Ativo' }); render(); }); },
};

/* ============ Formulários ============ */
function fieldErr(id, msg) { const m = $('#m-' + id); if (m) m.textContent = msg || ''; const f = m && m.closest('.field'); if (f) f.classList.toggle('err', !!msg); return !msg; }
const FORM = {
  assoc() {
    const ed = !!P.id; const val = id => ($('#f-' + id)?.value || '').trim();
    let ok = true;
    ok = fieldErr('nome', val('nome').length >= 3 ? '' : 'Informe o nome completo.') && ok;
    ok = fieldErr('cpf', !val('cpf') || cpfValido(val('cpf')) ? '' : 'CPF inválido.') && ok;
    ok = fieldErr('email', !val('email') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('email')) ? '' : 'E-mail inválido.') && ok;
    ok = fieldErr('cat', val('cat') ? '' : 'Escolha a categoria.') && ok;
    ok = fieldErr('ing', val('ing') && val('ing') <= TODAY() ? '' : 'Informe a data de ingresso.') && ok;
    ok = fieldErr('mat', !$('#f-mat') || !val('mat') || /^\d{1,6}$/.test(val('mat')) ? '' : 'Só números.') && ok;
    if (!ok) { $('.field.err input, .field.err select')?.focus(); return; }
    const p = { nome: val('nome'), cpf: digits(val('cpf')), rg: val('rg'), nascimento: val('nasc'), telefone: val('tel'), email: val('email'), endereco: val('end'), categoriaId: val('cat'), dataIngresso: val('ing'), situacao: val('sit'), obs: val('obs') };
    if (ed) { p.id = P.id; if ($('#f-mat')) p.matricula = val('mat'); }
    else if (val('mat')) p.matricula = val('mat');
    const foto = UI.foto, fun = !ed && val('fun');
    run(async () => {
      try {
        const r = await api('associado.salvar', p);
        if (!ed && fun) await api('assocFuncao.adicionar', { assocId: r.assocId, funcaoId: fun, inicio: p.dataIngresso, principal: true }, { msg: 'Salvando função…' });
        if (!ed && foto) await api('associado.foto', { assocId: r.assocId, foto: foto.foto, mini: foto.mini }, { msg: 'Enviando foto…' });
        UI.foto = null;
        toast(ed ? 'Cadastro atualizado' : `Associado cadastrado · matrícula ${fmtMat(r.matricula)}`);
        go('associado', { id: r.assocId });
      } catch (e) {
        if (e.code === 'DUP' && e.extra && e.extra.assocId) { fieldErr('cpf', e.message); openModal(`<h2>CPF já cadastrado</h2><p>${esc(e.message)}</p><div class="modal-actions"><button class="btn" data-act="close">Voltar</button><button class="btn primary" data-act="go" data-v="associado" data-id="${e.extra.assocId}">Abrir cadastro</button></div>`); return; }
        throw e;
      }
    });
  },
  config() {
    const v = id => ($('#' + id)?.value || '').trim();
    let ok = fieldErr('acnpj', !v('a-cnpj') || cnpjValido(v('a-cnpj')) ? '' : 'CNPJ inválido.');
    ok = fieldErr('aemail', !v('a-email') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('a-email')) ? '' : 'E-mail inválido.') && ok;
    if (!ok) return;
    run(async () => {
      await api('config.salvar', { config: { cobrancaDesde: v('c-desde'), toleranciaMeses: v('c-tol'), validadeModo: v('c-val'), presidenteNome: v('c-pres'), textoVerso: v('c-verso'), siteUrl: v('c-url'), assoc: { nome: v('a-nome'), cnpj: digits(v('a-cnpj')), telefone: v('a-tel'), endereco: v('a-end'), email: v('a-email'), site: v('a-site') } } });
      render(); toast('Configurações salvas');
    });
  },
  operador() {
    const email = $('#o-email').value.trim(), nome = $('#o-nome').value.trim();
    let ok = fieldErr('oemail', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Informe um e-mail válido.');
    ok = fieldErr('onome', nome ? '' : 'Informe o nome.') && ok;
    if (!ok) return;
    run(async () => { await api('operador.salvar', { email, nome, perfil: $('#o-perfil').value }); render(); toast('Operador adicionado'); });
  },
};

/* Entradas que filtram sem redesenhar a tela inteira */
const INP = {
  asQ(el) { P.q = el.value; $('#as-res').innerHTML = assocResults(); },
  mensQ(el) { P.q = el.value; $('#mens-res').innerHTML = mensResults(); },
  cartQ(el) { P.q = el.value; $('#cart-res').innerHTML = cartResults(); },
  atQ(el) { P.q = el.value; const q = norm(P.q); $('#at-res').innerHTML = atResults(S.atividades.filter(a => !q || norm(`${a.op} ${a.acao} ${a.det}`).includes(q)).slice(0, 80)); },
  cpfForm(el) { el.value = typeCPF(el.value); const d = digits(el.value); fieldErr('cpf', d.length === 11 && !cpfValido(d) ? 'CPF inválido.' : ''); },
  cropZoom(el) { if (UI.crop) { UI.crop.zoom = +el.value; cropDraw(); } },
  pagBusca() { $('#m-pmsg').textContent = ''; },
};
const CHG = {
  asSit(el) { P.sit = el.value; $('#as-res').innerHTML = assocResults(); },
  asCat(el) { P.cat = el.value; $('#as-res').innerHTML = assocResults(); },
  asFun(el) { P.fun = el.value; $('#as-res').innerHTML = assocResults(); },
  assocAno(el) { P.ano = el.value; render(); },
  mensMes(el) { if (/^\d{4}-\d{2}$/.test(el.value)) { P.mes = el.value; render(); } },
  cartSel(el) { el.checked ? UI.sel.add(el.dataset.id) : UI.sel.delete(el.dataset.id); $('#cart-bar').innerHTML = cartBarra(); },
  cartTodos(el) { cartLista().forEach(x => el.checked ? UI.sel.add(x.a.id) : UI.sel.delete(x.a.id)); $('#cart-res').innerHTML = cartResults(); $('#cart-bar').innerHTML = cartBarra(); },
  pagMes() { if ($('#m-pforma').value === 'Isenção') return; const n = $$('#modal-root input[data-ch="pagMes"]:checked').length; $('#m-pval').value = n ? (n * UI.pag.valor).toFixed(2) : ''; },
  pagForma(el) { const v = $('#m-pval'); v.disabled = el.value === 'Isenção'; if (el.value === 'Isenção') v.value = '0.00'; else CHG.pagMes(); },
  fotoArquivo(el) {
    const f = el.files && el.files[0]; el.value = ''; if (!f) return;
    abrirRecorte(f, r => { UI.foto = r; const pk = $('#photo-pick'); if (pk) pk.innerHTML = `<img src="${r.preview}" alt="Foto escolhida">`; const lb = $('label[for="f-foto"]'); if (lb) lb.innerHTML = `${ic('camera')} Trocar foto`; });
  },
  assinaturaArquivo(el) {
    const f = el.files && el.files[0]; el.value = ''; if (!f) return;
    run(async () => {
      const b64 = await processarAssinatura(f);
      openModal(`<h2>Conferir assinatura</h2><div class="sign-box big"><img src="data:image/png;base64,${b64}" alt="Assinatura processada"></div><p class="small muted">É assim que ela aparece no verso da carteirinha.</p>
        <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="assOk">Usar esta assinatura</button></div>`);
      UI.assinatura = b64;
    });
  },
};
ACT.assOk = () => run(async () => { await api('config.assinatura', { imagem: UI.assinatura }, { msg: 'Salvando assinatura…' }); UI.assinatura = null; closeModal(); render(); toast('Assinatura salva'); });

document.addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (!t || t.disabled) return; const f = ACT[t.dataset.act]; if (f) { if (t.tagName === 'A') e.preventDefault(); f(t, e); } });
document.addEventListener('input', e => { const n = e.target.dataset && e.target.dataset.in; if (n && INP[n]) INP[n](e.target); });
document.addEventListener('change', e => { const n = e.target.dataset && e.target.dataset.ch; if (n && CHG[n]) CHG[n](e.target); });
document.addEventListener('submit', e => { e.preventDefault(); const n = e.target.dataset.form; if (FORM[n]) FORM[n](e.target); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#modal-root').innerHTML) closeModal(); else if (UI.menu) { UI.menu = false; render(); } } });
// Ao voltar para o app depois de um tempo, recarrega os dados (outros operadores podem ter feito alterações)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S && Date.now() - UI.lastSync > 5 * 60 * 1000 && !$('#modal-root').innerHTML) boot(true); });

/* ============ Início ============ */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
if (configurado() && getToken()) boot(); else render();
