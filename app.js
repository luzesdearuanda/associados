/* Secretaria Luzes de Aruanda — Associação Centro de Umbanda Luzes de Aruanda.
   Cadastro de associados, funções, mensalidades, carteirinhas e financeiro (livro-caixa). Os dados ficam na planilha da conta da associação;
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
  wallet: '<path d="M4 7.5V6a2 2 0 0 1 2-2h11v3.5"/><rect x="3" y="7.5" width="18" height="12.5" rx="2"/><path d="M16.5 13.75h.01"/>',
  clip: '<path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4l7.7-7.7"/>',
  swap: '<path d="M4 8h15l-3.5-3.5M20 16H5l3.5 3.5"/>',
  minus: '<path d="M5 12h14"/>',
  receipt: '<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
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
const TBL = { Operadores: ['operadores', 'email'], Categorias: ['categorias', 'id'], Funcoes: ['funcoes', 'id'], Associados: ['associados', 'id'], AssocFuncoes: ['assocFuncoes', 'id'], Pagamentos: ['pagamentos', 'id'], Carteirinhas: ['carteirinhas', 'id'], FinContas: ['finContas', 'id'], FinCategorias: ['finCategorias', 'id'], FinLancamentos: ['finLancamentos', 'id'], Documentos: ['documentos', 'id'], Isencoes: ['isencoes', 'id'] };
function applyChanges(ch) {
  if (!S) return;
  Object.keys(TBL).forEach(name => {
    const [key, id] = TBL[name];
    if (!S[key]) return; // operador não carrega as tabelas do financeiro
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
  catch (e) { if (e && e.code === 'AUTH') return; if (!e || !['VALIDATION', 'DUP', 'ATRASO', 'DOCS', 'FOTO', 'FORBIDDEN', 'NOTFOUND', 'MAIL', 'BUSY', 'NET'].includes(e.code)) console.error(e); toast((e && e.message) || 'Erro inesperado. Tente de novo.', 'bad'); }
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
// Módulos opcionais (modulos.js preenche MOD); desligados em Configurações, somem das telas
const MOD = {};
const modOn = m => !!(S && S.config && S.config.modulos && S.config.modulos[m]);
const firstName = () => (S.session.nome || S.session.email).split(' ')[0];
const assoc = id => S.associados.find(a => a.id === id);
const categoria = id => S.categorias.find(c => c.id === id);
const catNome = id => (categoria(id) || { nome: '—' }).nome;
const funcao = id => S.funcoes.find(f => f.id === id);
const funcoesAtuais = aid => S.assocFuncoes.filter(x => x.assocId === aid && (!x.fim || x.fim > TODAY()));
const funcoesTodas = aid => S.assocFuncoes.filter(x => x.assocId === aid).sort((a, b) => (a.fim ? 1 : 0) - (b.fim ? 1 : 0) || b.inicio.localeCompare(a.inicio));
// Na carteirinha: a função principal da casa e o cargo administrativo principal (um de cada tipo)
function principaisAtuais(aid) { const af = funcoesAtuais(aid); return ['Da casa', 'Administrativa'].map(t => { const d = af.filter(x => (funcao(x.funcaoId) || {}).tipo === t); return d.find(x => x.principal) || d[0]; }).filter(Boolean); }
function funcaoPrincipal(aid) { return principaisAtuais(aid).map(x => (funcao(x.funcaoId) || {}).nome).filter(Boolean).join(' · '); }
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
  const isentos = mesesIsentos(a.id), aberto = [];
  let inicio = '';
  if (a.situacao === 'Ativo' && valor > 0) {
    inicio = [S.config.cobrancaDesde, compOf(a.dataIngresso) || S.config.cobrancaDesde].sort().pop();
    let c = inicio, g = 0;
    while (c <= atual && g++ < 600) { if (!pagas[c] && !isentos[c]) aberto.push(c); c = addMonthsComp(c, 1); }
  }
  const atrasadas = aberto.filter(c => c < atual);
  return { valor, pagas, aberto, atrasadas, atraso: atrasadas.length, inicio, cobrado: a.situacao === 'Ativo' && valor > 0, bloqueia: atrasadas.length > S.config.toleranciaMeses, isentos, isencao: isencaoVigente(a.id) };
}
/* ---- Isenção de mensalidade por período (ex.: desemprego) ---- */
const MOTIVOS_ISENCAO = ['Desemprego', 'Doença', 'Outro'];
const isencoesDe = aid => (S.isencoes || []).filter(i => i.assocId === aid && !i.cancelada);
function mesesIsentos(aid) {
  const m = {};
  isencoesDe(aid).forEach(i => { let c = i.inicio, g = 0; while (c <= i.fim && g++ < 120) { m[c] = i; c = addMonthsComp(c, 1); } });
  return m;
}
// Isenção que vale agora ou começa no próximo mês
const isencaoVigente = aid => isencoesDe(aid).find(i => i.fim >= COMP_ATUAL() && i.inicio <= addMonthsComp(COMP_ATUAL(), 1)) || null;
// Prazo terminando: último mês isento é este ou o próximo (hora de renovar ou encerrar)
const isencaoRevisar = i => !!i && !i.encerrada && i.fim <= addMonthsComp(COMP_ATUAL(), 1);
const isencaoTxt = i => `${i.motivo === 'Outro' && i.obs ? i.obs.split(' · ')[0] : i.motivo} · ${fmtComp(i.inicio)} a ${fmtComp(i.fim)}`;
function finPill(a, fin = financeiro(a)) {
  if (!fin.cobrado) return pill(a.situacao === 'Ativo' ? 'Isento' : 'Sem cobrança', 'mute');
  const ise = fin.isencao && fin.isencao.inicio <= COMP_ATUAL() ? ' ' + pill(`Isento até ${fmtComp(fin.isencao.fim)}`, 'info') : '';
  if (!fin.atraso) return ise ? ise.trim() : pill('Em dia', 'ok');
  return pill(`${plural(fin.atraso, 'mês', 'meses')} em atraso`, fin.bloqueia ? 'bad' : 'warn') + ise;
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
    definitiva: fins.filter(x => direitoDefinitiva(x.a)),
    isencoes: fins.filter(x => x.f.cobrado && x.f.isencao),
    aniv: aniversariantes(new Date().getMonth() + 1),
  };
}

/* ============ Financeiro: consultas ============ */
const canFin = () => !!S && !!S.session && (S.session.perfil === 'Admin' || S.session.perfil === 'Tesouraria');
const r2 = v => Math.round(Number(v) * 100) / 100;
const FORMAS_FIN = ['PIX', 'Dinheiro', 'Transferência', 'Cartão', 'Boleto', 'Débito automático', 'Cheque', 'Outro'];
const finConta = id => (S.finContas || []).find(c => c.id === id);
const finCat = id => (S.finCategorias || []).find(c => c.id === id);
const finContaNome = id => (finConta(id) || { nome: '—' }).nome;
const finCatNome = id => (finCat(id) || { nome: '—' }).nome;
const finLanc = id => (S.finLancamentos || []).find(l => l.id === id);
const contasAtivas = () => (S.finContas || []).filter(c => c.ativa);
// Efeito de um lançamento no saldo de uma conta. Lançamentos com data anterior ao saldo inicial já estão contados nele.
function efeitoConta(l, c) {
  if (!c || l.cancelado || l.status !== 'Pago' || l.data < c.saldoInicialData) return 0;
  if (l.tipo === 'Transferência') return (l.contaDestinoId === c.id ? l.valor : 0) - (l.contaId === c.id ? l.valor : 0);
  if (l.contaId !== c.id) return 0;
  return l.tipo === 'Entrada' ? l.valor : -l.valor;
}
function saldoConta(id, ate) {
  const c = finConta(id); if (!c) return 0;
  return r2((S.finLancamentos || []).reduce((s, l) => s + (!ate || l.data <= ate ? efeitoConta(l, c) : 0), Number(c.saldoInicial) || 0));
}
const saldoTotal = ate => r2((S.finContas || []).reduce((s, c) => s + saldoConta(c.id, ate), 0));
const pendentes = () => (S.finLancamentos || []).filter(l => !l.cancelado && l.status === 'Pendente').sort((a, b) => a.vencimento.localeCompare(b.vencimento));
function finAlertas() { const p = pendentes(), h = TODAY(); return { vencidas: p.filter(l => l.vencimento < h), semana: p.filter(l => l.vencimento >= h && diffDays(h, l.vencimento) <= 7) }; }
function vencPill(l) {
  const d = diffDays(TODAY(), l.vencimento);
  return d < 0 ? pill(`Vencida há ${plural(-d, 'dia', 'dias')}`, 'bad') : d === 0 ? pill('Vence hoje', 'warn') : d <= 7 ? pill(`Vence em ${plural(d, 'dia', 'dias')}`, 'warn') : pill('A vencer', 'info');
}
const mesFim = c => { const [y, m] = c.split('-').map(Number); return isoLocal(new Date(y, m, 0)); };
const pessoaExtra = l => l.pessoa && !norm(l.descricao).includes(norm(l.pessoa)) ? l.pessoa : '';
const brNum = v => Number(v || 0).toFixed(2).replace('.', ',');
// Valor com sinal para mostrar na lista (transferência só tem sinal quando a lista está filtrada por conta)
function valorLanc(l, contaId) {
  if (l.tipo === 'Entrada') return { cls: 'fin-pos', s: '+' };
  if (l.tipo === 'Saída') return { cls: 'fin-neg', s: '−' };
  if (contaId) return l.contaDestinoId === contaId ? { cls: 'fin-pos', s: '+' } : { cls: 'fin-neg', s: '−' };
  return { cls: 'fin-neu', s: '' };
}

/* ============ Navegação ============ */
const NAV = [
  { sec: 'Secretaria' },
  { id: 'inicio', label: 'Início', ic: 'home' },
  { id: 'associados', label: 'Associados', ic: 'users' },
  { id: 'mensalidades', label: 'Mensalidades', ic: 'coin', badge: () => kpis().inadimplentes.length },
  { id: 'carteirinhas', label: 'Carteirinhas', ic: 'card', badge: () => kpis().vencidas.length },
  { id: 'funcoes', label: 'Funções', ic: 'star' },
  { id: 'cobranca', label: 'Cobrança', ic: 'send', mod: 'cobranca' },
  { id: 'agenda', label: 'Agenda', ic: 'calendar', mod: 'agenda' },
  { id: 'assembleias', label: 'Assembleias', ic: 'vote', mod: 'assembleias' },
  { id: 'campanhas', label: 'Campanhas', ic: 'gift', mod: 'campanhas' },
  { id: 'estoque', label: 'Estoque', ic: 'box', mod: 'estoque' },
  { id: 'livro', label: 'Livro de registro', ic: 'book', mod: 'livro' },
  { sec: 'Tesouraria', fin: true },
  { id: 'financeiro', label: 'Financeiro', ic: 'wallet', fin: true, badge: () => finAlertas().vencidas.length },
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
  if (!v || (v.admin && !isAdmin()) || (v.fin && !canFin()) || (v.mod && !modOn(v.mod))) { VIEW = 'inicio'; v = VIEWS.inicio; }
  app.innerHTML = shell(v.render());
  if (v.after) v.after();
}
function shell(content) {
  const cur = PARENT[VIEW] || VIEW;
  const nav = NAV.filter(n => (!n.admin || isAdmin()) && (!n.fin || canFin()) && (!n.mod || modOn(n.mod))).map(n => n.sec ? `<div class="nav-sec">${n.sec}</div>` :
    `<button data-act="go" data-v="${n.id}" ${cur === n.id ? 'aria-current="page"' : ''}>${ic(n.ic)}<span>${n.label}</span>${n.badge && n.badge() ? `<span class="count">${n.badge()}</span>` : ''}</button>`).join('');
  const k = kpis();
  const bn = (id, label, icn, extra = '') => `<button data-act="go" data-v="${id}" ${cur === id ? 'aria-current="page"' : ''}>${ic(icn)}<span>${label}</span>${extra}</button>`;
  return `
  <div class="shell">
    <aside class="side">
      <div class="side-brand"><div class="logo-sm"><img src="${LOGO}" alt=""></div><div><b>Luzes de Aruanda</b><span>Secretaria</span></div></div>
      <nav class="nav" aria-label="Menu principal">${nav}</nav>
      <div class="side-user"><div><b>${esc(S.session.nome)}</b> <span class="role">${S.session.perfil}</span></div><div class="email">${esc(S.session.email)}</div><button data-act="logout">Sair</button></div>
    </aside>
    <div class="main">
      <header class="topbar"><div class="logo-sm"><img src="${LOGO}" alt=""></div><b>Secretaria Luzes de Aruanda</b><span class="role">${S.session.perfil}</span></header>
      <main class="page">${content}</main>
    </div>
  </div>
  <nav class="bottom-nav" aria-label="Navegação">
    ${bn('inicio', 'Início', 'home')}
    ${bn('associados', 'Associados', 'users')}
    <button class="main-act" data-act="go" data-v="associadoForm" ${VIEW === 'associadoForm' && !P.id ? 'aria-current="page"' : ''}><span class="ic">${ic('plus')}</span><span>Novo</span></button>
    ${bn('mensalidades', 'Mensalidades', 'coin', k.inadimplentes.length ? `<span class="dot">${k.inadimplentes.length}</span>` : '')}
    <button data-act="menu" ${['carteirinhas', 'funcoes', 'financeiro', 'configuracoes', 'operadores', 'atividades', 'cobranca', 'agenda', 'assembleias', 'campanhas', 'estoque', 'livro'].includes(cur) ? 'aria-current="page"' : ''}>${ic('more')}<span>Mais</span>${k.vencidas.length ? `<span class="dot">${k.vencidas.length}</span>` : ''}</button>
  </nav>
  ${UI.menu ? `<div class="overlay" data-act="menuClose" style="place-items:end stretch;padding:0"></div><div class="sheet-menu" role="menu">
    <button data-act="go" data-v="carteirinhas">${ic('card')} Carteirinhas${k.vencidas.length ? ` (${k.vencidas.length} vencidas)` : ''}</button>
    <button data-act="go" data-v="funcoes">${ic('star')} Funções</button>
    ${MOD.menuMais ? MOD.menuMais() : ''}
    ${canFin() ? `<button data-act="go" data-v="financeiro">${ic('wallet')} Financeiro${finAlertas().vencidas.length ? ` (${finAlertas().vencidas.length} contas vencidas)` : ''}</button>` : ''}
    ${isAdmin() ? `<button data-act="go" data-v="configuracoes">${ic('gear')} Configurações</button>
    <button data-act="go" data-v="operadores">${ic('shield')} Operadores</button>
    <button data-act="go" data-v="atividades">${ic('clock')} Registro de atividades</button>` : ''}
    <button data-act="logout">${ic('logout')} Sair (${esc(S.session.email)})</button>
  </div>` : ''}`;
}

/* ============ Telas de acesso ============ */
const loginCard = body => `<div class="login"><div class="login-card">
    <div class="logo-disc"><img src="${LOGO}" alt="Logo da Associação Centro de Umbanda Luzes de Aruanda"></div>
    <div style="display:grid;gap:6px"><div class="eyebrow">Secretaria</div><h1>Associação Centro de Umbanda Luzes de Aruanda</h1><p class="muted">Associados, mensalidades, carteirinhas e financeiro</p></div>
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
      ...k.definitiva.map(x => ({ a: x.a, t: `completou ${plural(Number(S.config.anosDefinitiva) || 0, 'ano', 'anos')} de casa: emitir a carteirinha definitiva`, cls: 'warn' })),
      ...k.isencoes.filter(x => isencaoRevisar(x.f.isencao)).map(x => ({ a: x.a, t: `isenção termina em ${fmtComp(x.f.isencao.fim)}: renovar ou encerrar`, cls: 'warn' })),
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
      ${canFin() ? `<button class="btn" data-act="go" data-v="financeiro">${ic('wallet')} Financeiro</button>` : ''}
    </div>
    <div class="kpis">
      ${kpiBox('Associados ativos', k.ativos, `${k.total} no cadastro`, '', 'data-act="go" data-v="associados"')}
      ${kpiBox('Mensalidades em atraso', k.inadimplentes.length, `acima da tolerância de ${plural(S.config.toleranciaMeses, 'mês', 'meses')}`, k.inadimplentes.length ? 'bad' : '', 'data-act="go" data-v="mensalidades" data-f="inadimplentes"')}
      ${kpiBox('Carteirinhas vencidas', k.vencidas.length, k.vencendo.length ? `${k.vencendo.length} vencem em até 30 dias` : 'nenhuma vencendo em 30 dias', k.vencidas.length ? 'bad' : k.vencendo.length ? 'warn' : '', 'data-act="go" data-v="carteirinhas" data-f="vencidas"')}
      ${kpiBox('Sem carteirinha', k.semCart.length, 'associados ativos', '', 'data-act="go" data-v="carteirinhas" data-f="sem"')}
      ${k.definitiva.length ? kpiBox('Direito à definitiva', k.definitiva.length, `com provisória e ${plural(Number(S.config.anosDefinitiva) || 0, 'ano', 'anos')} de casa`, 'warn', 'data-act="go" data-v="carteirinhas" data-f="definitiva"') : ''}
      ${k.isencoes.length ? (rv => kpiBox('Isentos de mensalidade', k.isencoes.length, rv ? `${plural(rv, 'isenção termina', 'isenções terminam')} até ${fmtComp(addMonthsComp(COMP_ATUAL(), 1))}` : 'desemprego, doença e outros', rv ? 'warn' : '', 'data-act="go" data-v="mensalidades" data-f="isencao"'))(k.isencoes.filter(x => isencaoRevisar(x.f.isencao)).length) : ''}
      ${MOD.kpis ? MOD.kpis() : ''}
      ${(n => kpiBox('Documentação incompleta', n, n ? 'ativos sem todos os documentos' : 'todos os ativos com documentos', n ? 'warn' : '', 'data-act="go" data-v="associados" data-docs="incompleta"'))(S.associados.filter(a => a.situacao === 'Ativo' && !docStatus(a).completo).length)}
      ${canFin() ? (al => kpiBox('Saldo em caixa e bancos', fmtBRL(saldoTotal()), al.vencidas.length ? `${plural(al.vencidas.length, 'conta vencida', 'contas vencidas')} a pagar` : al.semana.length ? `${plural(al.semana.length, 'conta vence', 'contas vencem')} em 7 dias` : 'nenhuma conta vencida', al.vencidas.length ? 'money bad' : al.semana.length ? 'money warn' : 'money', `data-act="go" data-v="financeiro" ${al.vencidas.length || al.semana.length ? 'data-tab="pagar"' : ''}`))(finAlertas()) : ''}
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
    if (P.docs && (P.docs === 'incompleta') === docStatus(a).completo) return false;
    if (!q) return true;
    return norm(a.nome).includes(q) || (qd && (String(a.matricula) === String(+qd) || (qd.length >= 4 && a.cpf.includes(qd))));
  }).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
}
function assocResults() {
  const list = assocFiltrados();
  if (!list.length) return `<div class="table-wrap"><div class="empty">Nenhum associado encontrado.${P.q ? '' : ' <button class="btn sm" data-act="go" data-v="associadoForm">Cadastrar associado</button>'}</div></div>`;
  return `<p class="small muted">${plural(list.length, 'associado', 'associados')}</p><div class="table-wrap cards"><table><thead><tr><th>Associado</th><th>Categoria</th><th>Função</th><th>Mensalidade</th><th>Carteirinha</th></tr></thead><tbody>
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
      <div class="toolbar"><button class="btn sm" data-act="exportCsv">${ic('download')} Planilha (CSV)</button><button class="btn sm" data-act="printLista">${ic('print')} Imprimir lista</button><button class="btn sm" data-act="fichaBranco">${ic('file')} Ficha em branco</button><button class="btn primary" data-act="go" data-v="associadoForm">${ic('plus')} Novo associado</button></div></div>
      <div class="toolbar"><label class="search"><span class="sr">Buscar</span>${ic('search')}<input id="as-q" data-in="asQ" value="${esc(P.q || '')}" placeholder="Nome, matrícula ou CPF" autocomplete="off"></label>
        <div class="field" style="flex:0 1 170px"><label class="sr" for="as-sit">Situação</label><select id="as-sit" data-ch="asSit">${['Ativo', 'Afastado', 'Desligado', 'Falecido', 'todos'].map(s => `<option value="${s}" ${(P.sit || 'Ativo') === s ? 'selected' : ''}>${s === 'todos' ? 'Todas as situações' : s + 's'}</option>`).join('')}</select></div>
        <div class="field" style="flex:0 1 170px"><label class="sr" for="as-cat">Categoria</label><select id="as-cat" data-ch="asCat"><option value="">Todas as categorias</option>${S.categorias.map(c => `<option value="${c.id}" ${P.cat === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
        <div class="field" style="flex:0 1 190px"><label class="sr" for="as-fun">Função</label><select id="as-fun" data-ch="asFun"><option value="">Todas as funções</option>${S.funcoes.filter(f => f.ativa).map(f => `<option value="${f.id}" ${P.fun === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></div>
        <div class="field" style="flex:0 1 200px"><label class="sr" for="as-docs">Documentação</label><select id="as-docs" data-ch="asDocs"><option value="">Documentação: todas</option><option value="incompleta" ${P.docs === 'incompleta' ? 'selected' : ''}>Documentação incompleta</option><option value="completa" ${P.docs === 'completa' ? 'selected' : ''}>Documentação completa</option></select></div></div>
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
    else if (fin.isentos[c]) { st = 'Isento'; cls = 'isento'; }
    else if (c > atual) { st = 'A vencer'; cls = 'future'; }
    else if (c === atual) { st = 'Aberto'; cls = 'warn'; }
    else { st = 'Atrasado'; cls = 'bad'; }
    return `<div class="month ${cls}" title="${fmtCompLongo(c)}: ${st}${p ? ` · ${fmtBRL(p.valor)} em ${fmtD(p.dataPagamento)} (${p.forma})` : fin.isentos[c] && fin.cobrado ? ` (${esc(fin.isentos[c].motivo)})` : ''}"><b>${m}</b><span>${st}</span></div>`;
  }).join('')}</div>`;
}
VIEWS.associado = {
  render() {
    const a = assoc(P.id); if (!a) return '<div class="empty">Associado não encontrado.</div>';
    const fin = financeiro(a), cs = cartSt(a), afs = funcoesTodas(a.id), prAtuais = principaisAtuais(a.id).map(x => x.id), cards = carteirinhasDe(a.id);
    const ano = +(P.ano || new Date().getFullYear());
    const pags = S.pagamentos.filter(p => p.assocId === a.id).sort((x, y) => y.competencia.localeCompare(x.competencia) || y.registradoEm.localeCompare(x.registradoEm));
    const anos = [...new Set([new Date().getFullYear(), ...pags.map(p => +p.competencia.slice(0, 4))])].sort((x, y) => y - x);
    return `<div><button class="back" data-act="go" data-v="associados">${ic('back')} Associados</button>
      <div class="profile">
        <button class="profile-photo" data-act="fotoTrocar" data-id="${a.id}" aria-label="Trocar foto">${a.fotoMini ? `<img src="data:image/jpeg;base64,${a.fotoMini}" alt="Foto de ${esc(a.nome)}">` : `<span>${ic('camera')}<small>Adicionar foto</small></span>`}</button>
        <div class="profile-info"><h1>${esc(a.nome)}</h1>
          <p class="sub"><span class="mono">Matrícula ${fmtMat(a.matricula)}</span> · ${esc(catNome(a.categoriaId))} · desde ${fmtD(a.dataIngresso)}</p>
          <div class="pills">${pill(a.situacao, SIT_CLS[a.situacao] || 'mute')} ${finPill(a, fin)} ${pill(cs.label, cs.cls)} ${docStatus(a).completo ? '' : pill('Documentação incompleta', 'warn')}</div></div>
        <div class="toolbar profile-act"><button class="btn" data-act="go" data-v="associadoForm" data-id="${a.id}">${ic('edit')} Editar</button>${a.situacao === 'Ativo' ? `<button class="btn primary" data-act="cartEmitir" data-id="${a.id}">${ic('card')} ${cs.c ? 'Renovar carteirinha' : 'Emitir carteirinha'}</button>` : ''}</div>
      </div></div>
      <div class="grid-2">
        <section class="panel"><div class="panel-head"><h2>Dados pessoais</h2></div>
          <dl class="facts">
            ${a.nomeSocial ? `<div class="full"><dt>Nome social</dt><dd>${esc(a.nomeSocial)}</dd></div>` : ''}
            <div><dt>CPF</dt><dd class="mono">${showCPF(a.cpf)}</dd></div><div><dt>RG</dt><dd>${esc(a.rg || '—')}</dd></div>
            <div><dt>Nascimento</dt><dd>${a.nascimento ? `${fmtD(a.nascimento)} · ${idade(a.nascimento)} anos` : '—'}</dd></div>
            <div><dt>Naturalidade</dt><dd>${esc(a.naturalidade || '—')}</dd></div>
            <div><dt>Sexo</dt><dd>${esc(a.sexo || '—')}</dd></div><div><dt>Estado civil</dt><dd>${esc(a.estadoCivil || '—')}</dd></div>
            <div><dt>Profissão</dt><dd>${esc(a.profissao || '—')}</dd></div>
            <div><dt>Telefone</dt><dd>${a.telefone ? `<a href="tel:${digits(a.telefone)}">${esc(a.telefone)}</a>` : '—'}</dd></div>
            <div><dt>E-mail</dt><dd>${a.email ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : '—'}</dd></div>
            <div class="full"><dt>Endereço</dt><dd>${esc(enderecoDe(a) || '—')}</dd></div>
            <div class="full"><dt>Contato de emergência</dt><dd>${a.emergNome || a.emergTelefone ? `${esc(a.emergNome || '')}${a.emergParentesco ? ` (${esc(a.emergParentesco)})` : ''}${a.emergTelefone ? ` · <a href="tel:${digits(a.emergTelefone)}">${esc(a.emergTelefone)}</a>` : ''}` : '—'}</dd></div>
            ${a.responsavelNome ? `<div class="full"><dt>Responsável legal${ehMenor(a) ? ' (menor de 18 anos)' : ''}</dt><dd>${esc(a.responsavelNome)}${a.responsavelParentesco ? ` (${esc(a.responsavelParentesco)})` : ''}${a.responsavelCpf ? ` · CPF ${showCPF(a.responsavelCpf)}` : ''}${a.responsavelEmail ? ` · ${esc(a.responsavelEmail)}` : ''}</dd></div>` : ehMenor(a) ? '<div class="full"><dt>Responsável legal</dt><dd style="color:var(--warn)">menor de 18 anos sem responsável cadastrado</dd></div>' : ''}
            ${a.entradaCorrente ? `<div><dt>Entrada na corrente</dt><dd>${fmtD(a.entradaCorrente)}</dd></div>` : ''}
            ${a.outroTerreiro ? `<div><dt>Outro terreiro</dt><dd>${esc(a.outroTerreiro)}</dd></div>` : ''}
            ${a.saudeObs ? `<div class="full"><dt>Saúde</dt><dd>${esc(a.saudeObs)}</dd></div>` : ''}
            ${a.obs ? `<div class="full"><dt>Observações</dt><dd>${esc(a.obs)}</dd></div>` : ''}
          </dl></section>
        <section class="panel"><div class="panel-head"><h2>Funções</h2><button class="btn sm primary" data-act="funAdd" data-id="${a.id}">${ic('plus')} Atribuir função</button></div>
          ${afs.length ? `<div class="list">${afs.map(x => { const f = funcao(x.funcaoId) || { nome: '?', tipo: '' }, enc = x.fim && x.fim <= TODAY(), naCart = !enc && prAtuais.includes(x.id); return `<div class="row-item ${enc ? 'dim' : ''}">
            <span class="who"><b>${esc(f.nome)}${naCart ? ' <span class="chip">na carteirinha</span>' : ''}</b><span class="small muted">${esc(f.tipo)} · ${enc ? `de ${fmtD(x.inicio)} a ${fmtD(x.fim)}` : x.fim ? `até ${fmtD(x.fim)}` : `desde ${fmtD(x.inicio)}`}</span></span>
            <span class="row-actions">${enc ? '' : `${naCart ? '' : `<button class="btn sm ghost" data-act="funPrincipal" data-id="${x.id}">Usar na carteirinha</button>`}<button class="btn sm" data-act="funEncerrar" data-id="${x.id}">Encerrar</button>`}<button class="btn sm ghost icon" data-act="funExcluir" data-id="${x.id}" aria-label="Excluir lançamento" title="Excluir (lançamento errado)">${ic('x')}</button></span></div>`; }).join('')}</div>`
          : '<div class="empty">Nenhuma função atribuída.</div>'}
          <p class="small muted">Atribua quantas funções precisar: da casa e administrativas. Na carteirinha aparecem a função principal da casa e o cargo administrativo principal (ex.: Dirigente espiritual · Presidente).</p></section>
      </div>
      ${docsPainel(a)}
      ${MOD.painelAssoc ? MOD.painelAssoc(a) : ''}
      <section class="panel"><div class="panel-head"><h2>Mensalidades</h2>
        <div class="toolbar">${anos.length > 1 ? `<select data-ch="assocAno" aria-label="Ano">${anos.map(y => `<option ${y === ano ? 'selected' : ''}>${y}</option>`).join('')}</select>` : ''}${MOD.botoesMens ? MOD.botoesMens(a, fin) : ''}<button class="btn sm primary" data-act="pagNovo" data-id="${a.id}">${ic('coin')} Registrar pagamento</button></div></div>
        ${fin.cobrado ? `<p class="small muted">${esc(catNome(a.categoriaId))}: ${fmtBRL(fin.valor)} por mês, cobrado desde ${fmtComp(fin.inicio)}. ${fin.atraso ? `<b style="color:var(--bad)">${plural(fin.atraso, 'mês', 'meses')} em atraso: ${fin.atrasadas.map(fmtComp).join(', ')}</b>.` : 'Nenhum mês em atraso.'}</p>`
        : `<p class="small muted">${a.situacao === 'Ativo' ? `Categoria ${esc(catNome(a.categoriaId))} sem valor de mensalidade.` : `Associado ${a.situacao.toLowerCase()}: mensalidades não são cobradas.`}</p>`}
        ${isencaoPainel(a, fin)}
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
function isencaoPainel(a, fin) {
  const todas = (S.isencoes || []).filter(i => i.assocId === a.id).sort((x, y) => y.inicio.localeCompare(x.inicio)), v = fin.isencao;
  if (!fin.cobrado && !todas.length) return '';
  const btn = (act, rot, cls = '') => `<button class="btn sm ${cls}" data-act="${act}" data-id="${v.id}">${rot}</button>`;
  const ativa = v ? `<div class="note ${isencaoRevisar(v) ? 'warn' : 'info'}"><span><b>${v.inicio > COMP_ATUAL() ? 'Isenção a partir de' : 'Isento de mensalidade'} ${v.inicio > COMP_ATUAL() ? fmtComp(v.inicio) : ''}</b> · ${esc(isencaoTxt(v))}${v.renovacoes ? ` · ${plural(v.renovacoes, 'renovação', 'renovações')}` : ''}.
      ${isencaoRevisar(v) ? `<b>Prazo terminando:</b> renove ou encerre. Sem renovação, a cobrança volta em ${fmtComp(addMonthsComp(v.fim, 1))}.` : `A cobrança volta em ${fmtComp(addMonthsComp(v.fim, 1))}.`}
      ${fin.atraso ? (fin.atraso === 1 ? ' O mês em atraso de antes da isenção continua devido.' : ` Os ${fin.atraso} meses em atraso de antes da isenção continuam devidos.`) : ''}</span>
      ${canFin() ? `<span class="inline">${btn('isenRenovar', 'Renovar')}${btn('isenEncerrar', 'Encerrar')}${isAdmin() ? btn('isenCancelar', 'Cancelar (engano)', 'ghost danger-text') : ''}</span>` : ''}</div>`
    : fin.cobrado && canFin() ? `<div class="inline" style="margin:4px 0 10px"><button class="btn sm" data-act="isenConceder" data-id="${a.id}">${ic('plus')} Conceder isenção (desemprego, doença…)</button></div>` : '';
  const hist = todas.filter(i => i !== v);
  return ativa + (hist.length ? `<details style="margin:0 0 10px"><summary class="small" style="cursor:pointer;font-weight:600;color:var(--brand)">Isenções anteriores (${hist.length})</summary><div class="list" style="margin-top:8px">${hist.map(i => `<div class="row-item dim"><span class="who"><b>${esc(isencaoTxt(i))}</b><span class="small muted">${i.cancelada ? `Cancelada: ${esc(i.motivoCancelamento)}` : i.encerrada ? `Encerrada: ${esc(i.motivoEncerramento)}` : 'Prazo terminado'} · concedida por ${esc(i.concedidaPor)}</span></span></div>`).join('')}</div></details>` : '');
}
function cartPainel(a, cs) {
  const c = cs.c;
  return `<div class="cart-wrap"><div class="cart-preview" id="cart-prev"><div class="cart-face"></div><div class="cart-face"></div></div>
    <div class="cart-side">
      <dl class="facts"><div><dt>Tipo</dt><dd>${c.tipo ? esc(c.tipo) : '—'}${c.antecipadaPor ? ' <span class="small muted">(antecipada)</span>' : ''}${direitoDefinitiva(a) ? ' ' + pill('Direito à definitiva', 'warn') : ''}</dd></div><div><dt>Emitida em</dt><dd>${fmtStamp(c.emitidaEm)}</dd></div><div><dt>Validade</dt><dd>${pill(cs.label, cs.cls)}</dd></div>
        <div><dt>Código de validação</dt><dd class="mono">${CARTAO.fmtCod(c.codigo)}</dd></div>${c.enviadaEm ? `<div><dt>Enviada por e-mail</dt><dd>${fmtStamp(c.enviadaEm)}</dd></div>` : ''}
        ${c.antecipadaPor ? `<div class="full"><dt>Definitiva antes de ${plural(Number(S.config.anosDefinitiva) || 0, 'ano', 'anos')} de casa</dt><dd class="small">${esc(c.antecipadaPor)}: ${esc(c.motivoAntecipacao)}</dd></div>` : ''}
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
          <div class="field"><label for="f-nsoc">Nome social</label><input id="f-nsoc" value="${v('nomeSocial')}" autocomplete="off"><span class="hint">Opcional. Aparece na ficha.</span></div>
          <div class="field"><label for="f-sexo">Sexo</label><select id="f-sexo"><option value="">—</option>${SEXOS.map(x => `<option ${a && a.sexo === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          <div class="field"><label for="f-nasc">Data de nascimento</label><input id="f-nasc" type="date" value="${v('nascimento')}" max="${TODAY()}" data-ch="nascForm"><span class="msg" id="m-nasc"></span></div>
          <div class="field"><label for="f-nat">Naturalidade</label><input id="f-nat" value="${v('naturalidade')}" placeholder="Cidade/UF onde nasceu"></div>
          <div class="field"><label for="f-civil">Estado civil</label><select id="f-civil"><option value="">—</option>${ESTADOS_CIVIS.map(x => `<option ${a && a.estadoCivil === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          <div class="field"><label for="f-prof">Profissão</label><input id="f-prof" value="${v('profissao')}"></div>
          ${ed && !isAdmin() ? '' : `<div class="field"><label for="f-mat">Matrícula</label><input id="f-mat" class="mono" inputmode="numeric" value="${ed ? a.matricula : ''}" placeholder="${ed ? '' : `Automática: ${fmtMat(Math.max(S.seqMatricula || 0, ...S.associados.map(x => x.matricula), 0) + 1)}`}"><span class="hint">${ed ? 'Só o administrador altera.' : 'Deixe em branco para usar a próxima.'}</span><span class="msg" id="m-mat"></span></div>`}
        </div></fieldset>
        <fieldset><legend>Contato</legend><div class="fields">
          <div class="field"><label for="f-tel">Telefone / WhatsApp</label><input id="f-tel" inputmode="tel" value="${v('telefone')}" placeholder="(54) 90000-0000"></div>
          <div class="field"><label for="f-email">E-mail</label><input id="f-email" type="email" value="${v('email')}"><span class="hint">Usado para enviar a carteirinha.</span><span class="msg" id="m-email"></span></div>
        </div></fieldset>
        <fieldset><legend>Endereço</legend><div class="fields">
          ${a && a.endereco && !a.logradouro ? `<div class="field full"><div class="note">Endereço registrado antes: <b>${esc(a.endereco)}</b>. Preencha os campos abaixo para atualizar.</div></div>` : ''}
          <div class="field"><label for="f-cep">CEP</label><input id="f-cep" class="mono" inputmode="numeric" data-in="cepForm" value="${esc(a && a.cep ? fmtCEP(a.cep) : '')}" placeholder="00000-000"><span class="hint" id="m-cep-h">Digite o CEP para preencher a rua, o bairro e a cidade.</span><span class="msg" id="m-cep"></span></div>
          <div class="field full"><label for="f-logr">Logradouro</label><input id="f-logr" value="${v('logradouro')}" placeholder="Rua, avenida, travessa…"></div>
          <div class="field"><label for="f-num">Número</label><input id="f-num" value="${v('numero')}" placeholder="Ou s/n"></div>
          <div class="field"><label for="f-comp">Complemento</label><input id="f-comp" value="${v('complemento')}" placeholder="Apto, casa, bloco…"></div>
          <div class="field"><label for="f-bairro">Bairro</label><input id="f-bairro" value="${v('bairro')}"></div>
          <div class="field"><label for="f-cid">Cidade</label><input id="f-cid" value="${v('cidade')}"></div>
          <div class="field"><label for="f-uf">UF</label><select id="f-uf"><option value="">—</option>${UFS.map(x => `<option ${a && a.uf === x ? 'selected' : ''}>${x}</option>`).join('')}</select><span class="msg" id="m-uf"></span></div>
        </div></fieldset>
        <fieldset><legend>Contato de emergência</legend><div class="fields">
          <div class="field"><label for="f-enome">Nome</label><input id="f-enome" value="${v('emergNome')}"></div>
          <div class="field"><label for="f-epar">Parentesco</label><input id="f-epar" value="${v('emergParentesco')}" placeholder="Ex.: esposa, filho, amiga"></div>
          <div class="field"><label for="f-etel">Telefone</label><input id="f-etel" inputmode="tel" value="${v('emergTelefone')}" placeholder="(54) 90000-0000"></div>
        </div></fieldset>
        <fieldset id="f-resp-box" ${a && (ehMenor(a) || a.responsavelNome) ? '' : 'hidden'}><legend>Responsável legal (menor de 18 anos)</legend><div class="fields">
          <div class="field"><label for="f-rnome">Nome do responsável <span class="req">*</span></label><input id="f-rnome" value="${v('responsavelNome')}"><span class="msg" id="m-rnome"></span></div>
          <div class="field"><label for="f-rcpf">CPF do responsável</label><input id="f-rcpf" class="mono" inputmode="numeric" data-in="cpfResp" value="${esc(a && a.responsavelCpf ? fmtCPF(a.responsavelCpf) : '')}" placeholder="000.000.000-00"><span class="msg" id="m-rcpf"></span></div>
          <div class="field"><label for="f-rpar">Parentesco</label><input id="f-rpar" value="${v('responsavelParentesco')}" placeholder="Ex.: mãe, pai, avó"><span class="hint">Assina a ficha e o termo de uso de imagem.</span></div>
          <div class="field"><label for="f-remail">E-mail do responsável</label><input id="f-remail" type="email" inputmode="email" value="${v('responsavelEmail')}" placeholder="nome@exemplo.com"><span class="hint">Usado no cadastro da biblioteca se o menor não tiver e-mail.</span></div>
        </div></fieldset>
        <fieldset><legend>Associação</legend><div class="fields">
          <div class="field"><label for="f-cat">Categoria <span class="req">*</span></label><select id="f-cat"><option value="">Escolha…</option>${cats.map(c => `<option value="${c.id}" ${a && a.categoriaId === c.id ? 'selected' : ''}>${esc(c.nome)} · ${c.valor ? fmtBRL(c.valor) + '/mês' : 'sem mensalidade'}</option>`).join('')}</select><span class="msg" id="m-cat"></span></div>
          <div class="field"><label for="f-ing">Data de ingresso <span class="req">*</span></label><input id="f-ing" type="date" value="${v('dataIngresso', TODAY())}" max="${TODAY()}"><span class="msg" id="m-ing"></span></div>
          <div class="field"><label for="f-sit">Situação</label><select id="f-sit">${['Ativo', 'Afastado', 'Desligado', 'Falecido'].map(s => `<option ${(a ? a.situacao : 'Ativo') === s ? 'selected' : ''}>${s}</option>`).join('')}</select><span class="hint">Só associados ativos têm carteirinha válida e mensalidade cobrada.</span></div>
          ${ed ? '' : [['funC', 'Da casa', 'Função na casa'], ['funA', 'Administrativa', 'Cargo administrativo']].map(([id, t, rot]) => `<div class="field"><label for="f-${id}">${rot}</label><select id="f-${id}"><option value="">Nenhuma</option>${S.funcoes.filter(f => f.ativa && f.tipo === t).map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')}</select>${t === 'Administrativa' ? '<span class="hint">As duas aparecem na carteirinha. Outras funções podem ser atribuídas depois.</span>' : ''}</div>`).join('')}
          <div class="field"><label for="f-corr">Entrada na corrente</label><input id="f-corr" type="date" value="${v('entradaCorrente')}" max="${TODAY()}"><span class="hint">Quando começou a trabalhar na corrente mediúnica (se for o caso).</span><span class="msg" id="m-corr"></span></div>
          <div class="field"><label for="f-terr">Outro terreiro</label><input id="f-terr" value="${v('outroTerreiro')}" placeholder="Frequenta ou frequentou outra casa?"></div>
          <div class="field full"><label for="f-saude">Saúde: alergias, condições, medicamentos</label><textarea id="f-saude" placeholder="Informação útil em caso de mal-estar durante as giras.">${v('saudeObs')}</textarea></div>
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
    const fin = financeiro(a); const p = fin.pagas[mes], ise = fin.isentos[mes];
    const devido = fin.cobrado && mes >= fin.inicio && !ise;
    return { a, fin, p, devido, ise, st: p ? (p.forma === 'Isenção' ? 'isento' : 'pago') : ise && fin.cobrado ? 'isencao' : devido ? (mes > COMP_ATUAL() ? 'futuro' : 'aberto') : 'nao' };
  }).filter(x => x.fin.cobrado || x.p)
    .filter(x => f === 'todos' || (f === 'aberto' && x.st === 'aberto') || (f === 'pagos' && (x.st === 'pago' || x.st === 'isento')) || (f === 'inadimplentes' && x.fin.bloqueia) || (f === 'isencao' && x.st === 'isencao'))
    .filter(x => !q || norm(x.a.nome).includes(q) || String(x.a.matricula) === String(+digits(P.q)))
    .sort((x, y) => x.a.nome.localeCompare(y.a.nome, 'pt-BR'));
}
function mensResults() {
  const mes = P.mes || COMP_ATUAL(), list = mensLista();
  const ST = { pago: ['Pago', 'ok'], isento: ['Isento no mês', 'mute'], isencao: ['Isento', 'info'], aberto: ['Em aberto', 'warn'], futuro: ['A vencer', 'info'], nao: ['Não cobrado', 'mute'] };
  if (!list.length) return '<div class="table-wrap"><div class="empty">Ninguém nesta lista.</div></div>';
  return `<div class="table-wrap cards"><table><thead><tr><th>Associado</th><th>Mensalidade</th><th>${fmtComp(mes)}</th><th>Atraso total</th><th><span class="sr">Ações</span></th></tr></thead><tbody>
    ${list.map(x => `<tr><td class="lead"><button class="who-row linklike" data-act="go" data-v="associado" data-id="${x.a.id}">${avatar(x.a)}<div><div class="t">${esc(x.a.nome)}</div><div class="s mono">${fmtMat(x.a.matricula)}</div></div></button></td>
      <td data-label="Mensalidade">${esc(catNome(x.a.categoriaId))}<div class="s">${fmtBRL(x.fin.valor)}</div></td>
      <td data-label="${fmtComp(mes)}">${pill(...ST[x.st])}${x.p ? `<div class="s">${fmtD(x.p.dataPagamento)} · ${esc(x.p.forma)}</div>` : x.st === 'isencao' ? `<div class="s">${esc(x.ise.motivo)} até ${fmtComp(x.ise.fim)}</div>` : ''}</td>
      <td data-label="Atraso total">${x.fin.atraso ? pill(plural(x.fin.atraso, 'mês', 'meses'), x.fin.bloqueia ? 'bad' : 'warn') : '<span class="muted small">em dia</span>'}</td>
      <td class="actions">${x.fin.aberto.length || x.st === 'futuro' ? `<button class="btn sm primary" data-act="pagNovo" data-id="${x.a.id}">${ic('coin')} Registrar</button>` : ''}</td></tr>`).join('')}
  </tbody></table></div>`;
}
VIEWS.mensalidades = {
  render() {
    const mes = P.mes || COMP_ATUAL(), f = P.f || 'todos';
    const todos = S.associados.filter(a => a.situacao === 'Ativo').map(a => ({ a, fin: financeiro(a) })).filter(x => x.fin.cobrado);
    const devidos = todos.filter(x => mes >= x.fin.inicio && !x.fin.isentos[mes]), isentosMes = todos.filter(x => x.fin.isentos[mes] && !x.fin.pagas[mes]);
    const pagosMes = devidos.filter(x => x.fin.pagas[mes]);
    const recebidos = S.pagamentos.filter(p => !p.cancelado && compOf(p.dataPagamento) === mes);
    const esperado = devidos.reduce((s, x) => s + x.fin.valor, 0);
    const tab = (id, label, n) => `<button class="tab ${f === id ? 'on' : ''}" data-act="mensF" data-f="${id}">${label}${n != null ? ` <span class="count">${n}</span>` : ''}</button>`;
    return `<div class="page-head"><div><h1>Mensalidades</h1><p class="sub">Tolerância para emitir carteirinha: ${plural(S.config.toleranciaMeses, 'mês', 'meses')} em atraso. Cobrança desde ${fmtComp(S.config.cobrancaDesde)}.</p></div>
      <div class="toolbar">${modOn('cobranca') ? `<button class="btn sm" data-act="go" data-v="cobranca">${ic('send')} Cobrança</button>` : ''}<button class="btn sm" data-act="printMens">${ic('print')} Imprimir</button><button class="btn primary" data-act="pagNovo">${ic('coin')} Registrar pagamento</button></div></div>
      <div class="toolbar"><div class="field" style="flex:0 1 190px"><label for="m-mes">Mês</label><input id="m-mes" type="month" value="${mes}" data-ch="mensMes"></div>
        <label class="search" style="align-self:end"><span class="sr">Buscar</span>${ic('search')}<input id="m-q" data-in="mensQ" value="${esc(P.q || '')}" placeholder="Nome ou matrícula" autocomplete="off"></label></div>
      <div class="kpis">
        ${kpiBox(`Pagos em ${fmtComp(mes)}`, `${pagosMes.length} de ${devidos.length}`, devidos.length ? `${Math.round(pagosMes.length / devidos.length * 100)}% dos associados cobrados` : 'ninguém cobrado neste mês')}
        ${kpiBox('Esperado no mês', fmtBRL(esperado), isentosMes.length ? `soma das devidas · ${plural(isentosMes.length, 'isento', 'isentos')} no mês` : 'soma das mensalidades devidas')}
        ${kpiBox(`Recebido em ${fmtComp(mes)}`, fmtBRL(recebidos.reduce((s, p) => s + p.valor, 0)), `${plural(recebidos.length, 'lançamento', 'lançamentos')} com data de pagamento no mês`)}
        ${kpiBox('Acima da tolerância', todos.filter(x => x.fin.bloqueia).length, 'não podem renovar a carteirinha', todos.some(x => x.fin.bloqueia) ? 'bad' : '', 'data-act="mensF" data-f="inadimplentes"')}
      </div>
      <div class="tabs" role="tablist">${tab('todos', 'Todos')}${tab('aberto', 'Em aberto no mês', devidos.filter(x => !x.fin.pagas[mes] && mes <= COMP_ATUAL()).length)}${tab('pagos', 'Pagos no mês', pagosMes.length)}${tab('inadimplentes', 'Acima da tolerância', todos.filter(x => x.fin.bloqueia).length)}${isentosMes.length || f === 'isencao' ? tab('isencao', 'Com isenção', isentosMes.length) : ''}</div>
      <div id="mens-res">${mensResults()}</div>`;
  }
};

/* ---- Carteirinhas ---- */
function cartLista() {
  const f = P.f || 'todas', q = norm(P.q || '');
  return S.associados.filter(a => a.situacao === 'Ativo').map(a => ({ a, c: cartSt(a), fin: financeiro(a) }))
    .filter(x => f === 'todas' ? x.c.code !== 'nenhuma' : f === 'vencidas' ? x.c.code === 'vencida' : f === 'vence' ? x.c.code === 'vence' : f === 'sem' ? x.c.code === 'nenhuma' : f === 'prov' ? x.c.c && x.c.c.tipo === 'Provisória' : f === 'definitiva' ? direitoDefinitiva(x.a) : true)
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
      <td data-label="Carteirinha">${pill(x.c.label, x.c.cls)}${x.c.c && x.c.c.tipo === 'Provisória' ? ' ' + pill('Provisória', 'info') : ''}${direitoDefinitiva(x.a) ? ' ' + pill('Direito à definitiva', 'warn') : ''}</td><td data-label="Mensalidade">${finPill(x.a, x.fin)}</td><td data-label="Função">${esc(funcaoPrincipal(x.a.id) || '—')}</td></tr>`).join('')}
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
    return `<div class="page-head"><div><h1>Carteirinhas</h1><p class="sub">Provisória para quem tem menos de ${plural(Number(S.config.anosDefinitiva) || 0, 'ano', 'anos')} de casa (vale até completar esse tempo; foto opcional). Definitiva: ${regraValidade()}, com foto. Selecione para imprimir ou emitir várias de uma vez.</p></div>
      <a class="btn sm" href="validar.html" target="_blank" rel="noopener">${ic('check')} Página de validação</a></div>
      <div class="tabs" role="tablist">${tab('todas', 'Com carteirinha', ativas)}${tab('vence', 'Vencem em 30 dias', k.vencendo.length)}${tab('vencidas', 'Vencidas', k.vencidas.length)}${tab('sem', 'Sem carteirinha', k.semCart.length)}${tab('prov', 'Provisórias', S.associados.filter(a => a.situacao === 'Ativo' && (carteirinhaAtiva(a.id) || {}).tipo === 'Provisória').length)}${k.definitiva.length ? tab('definitiva', 'Direito à definitiva', k.definitiva.length) : ''}</div>
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
          const quem = S.assocFuncoes.filter(x => x.funcaoId === f.id && (!x.fim || x.fim > TODAY())).map(x => assoc(x.assocId)).filter(a => a && a.situacao === 'Ativo').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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
      <section class="panel"><div class="panel-head"><h2>Biblioteca</h2><div class="btns"><button class="btn sm" data-act="bibStatus">Ver situação</button><button class="btn sm" data-act="bibAtualizar">${ic('refresh')} Atualizar agora</button></div></div>
        <p class="small muted">Todo associado tem cadastro na biblioteca, criado e atualizado sozinho a partir deste cadastro (nome, CPF, e-mail, telefone e situação). Menor sem CPF ou e-mail usa os do responsável. Desligados e falecidos ficam inativos na biblioteca; mensalidades acima da tolerância impedem a retirada de livros até regularizar.</p>
        <div id="bib-st" class="small"></div></section>
      ${MOD.configHTML ? MOD.configHTML() : ''}
      <form class="panel form" data-form="config" novalidate>
        <fieldset><legend>Mensalidades</legend><div class="fields">
          <div class="field"><label for="c-desde">Cobrar mensalidades a partir de</label><input id="c-desde" type="month" value="${c.cobrancaDesde}"><span class="hint">Meses anteriores não contam como atraso. Use o mês em que o controle começou a ser feito no sistema.</span></div>
          <div class="field"><label for="c-tol">Tolerância de atraso (meses)</label><input id="c-tol" type="number" min="0" max="24" value="${c.toleranciaMeses}"><span class="hint">Acima disso a carteirinha não pode ser emitida nem renovada (o admin pode liberar, com motivo).</span></div>
          <div class="field"><label for="c-isen">Prazo padrão da isenção (meses)</label><input id="c-isen" type="number" min="1" max="12" value="${c.isencaoMeses || 6}"><span class="hint">Sugestão ao conceder isenção por desemprego ou doença. Depois dá para renovar.</span></div>
        </div></fieldset>
        <fieldset><legend>Carteirinha</legend><div class="fields">
          <div class="field"><label for="c-anosdef">Tempo de casa para a definitiva (anos)</label><input id="c-anosdef" type="number" min="0" max="10" value="${c.anosDefinitiva ?? 3}"><span class="hint">Contado da data de ingresso. Antes disso a carteirinha é provisória (foto opcional) e vale até a véspera de completar esse tempo.</span></div>
          <div class="field"><label for="c-vq">Validade da definitiva</label><div class="inline"><input id="c-vq" type="number" min="0" max="120" value="${c.valQtd ?? 5}" style="max-width:6rem"><select id="c-vu"><option value="anos" ${c.valUnid !== 'meses' ? 'selected' : ''}>anos</option><option value="meses" ${c.valUnid === 'meses' ? 'selected' : ''}>meses</option></select></div>
            <label class="check small"><input type="checkbox" id="c-vfim" ${c.valFimAno ? 'checked' : ''}> Terminar em 31 de dezembro do último ano</label><span class="hint">Contada da emissão. Ex.: 5 anos (padrão); 1 ano; 0 + 31 de dezembro = até o fim do ano da emissão.</span></div>
          <div class="field"><label for="c-pres">Nome do(a) presidente</label><input id="c-pres" value="${esc(c.presidenteNome || '')}"><span class="hint">Aparece sob a assinatura, no verso.</span></div>
          <div class="field full"><label for="c-verso">Texto do verso</label><input id="c-verso" maxlength="200" value="${esc(c.textoVerso || '')}"></div>
          <div class="field full"><label for="c-url">Endereço do sistema (usado no QR Code e nos links)</label><input id="c-url" value="${esc(c.siteUrl || '')}"><span class="hint">Só mude se o endereço do site mudar. Carteirinhas já impressas continuam apontando para o endereço antigo.</span></div>
        </div></fieldset>
        <fieldset><legend>Recibos do financeiro</legend><div class="fields">
          <div class="field"><label for="c-rass">Recibos assinados por</label><select id="c-rass"><option value="presidente" ${c.reciboAssina !== 'tesoureiro' ? 'selected' : ''}>Presidente (usa a assinatura cadastrada abaixo)</option><option value="tesoureiro" ${c.reciboAssina === 'tesoureiro' ? 'selected' : ''}>Tesoureiro(a) (assina à mão)</option></select></div>
          <div class="field"><label for="c-tes">Nome do(a) tesoureiro(a)</label><input id="c-tes" value="${esc(c.tesoureiroNome || '')}"><span class="hint">Aparece no recibo (se escolhido) e na prestação de contas.</span></div>
          <div class="field"><label for="c-cid">Cidade (no recibo)</label><input id="c-cid" value="${esc(c.cidade || '')}" placeholder="Passo Fundo - RS"></div>
        </div></fieldset>
        <fieldset><legend>Ficha de inscrição e termo de uso de imagem</legend><div class="fields">
          <div class="field full"><label for="c-decl">Declaração da ficha</label><textarea id="c-decl" rows="3" maxlength="1500">${esc(c.fichaDeclaracao || '')}</textarea></div>
          <div class="field full"><label for="c-termo">Texto do termo de uso de imagem</label><textarea id="c-termo" rows="9" maxlength="4000">${esc(c.termoImagem || '')}</textarea>
            <span class="hint">Linha em branco separa parágrafos. Marcadores preenchidos na impressão: <span class="mono">{associacao}</span>, <span class="mono">{cnpj}</span>, <span class="mono">{identificacao}</span> (nome e CPF de quem assina; para menor, do responsável) e <span class="mono">{imagem}</span>. Deixe vazio para voltar ao texto padrão.</span></div>
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
        <td data-label="Perfil">${self ? `<span class="role">${o.perfil}</span>` : `<select data-ch="opPerfil" data-i="${i}" aria-label="Perfil de ${esc(o.nome)}">${['Operador', 'Tesouraria', 'Admin'].map(pf => `<option ${o.perfil === pf ? 'selected' : ''}>${pf}</option>`).join('')}</select>`}</td><td data-label="Situação">${pill(o.status, o.status === 'Ativo' ? 'ok' : 'mute')}</td>
        <td data-label="Último acesso" class="num">${fmtStamp(o.ultimoAcesso)}</td>
        <td class="actions">${self ? '' : `<button class="btn sm ${o.status === 'Ativo' ? 'danger' : ''}" data-act="opStatus" data-i="${i}">${o.status === 'Ativo' ? 'Inativar' : 'Reativar'}</button>`}</td></tr>`; }).join('')}
      </tbody></table></div>
      <form class="panel form" data-form="operador" novalidate><h2>Adicionar operador</h2><div class="fields">
        <div class="field"><label for="o-email">E-mail da conta Google <span class="req">*</span></label><input id="o-email" type="email" placeholder="nome@gmail.com"><span class="msg" id="m-oemail"></span></div>
        <div class="field"><label for="o-nome">Nome <span class="req">*</span></label><input id="o-nome"><span class="msg" id="m-onome"></span></div>
        <div class="field"><label for="o-perfil">Perfil</label><select id="o-perfil"><option>Operador</option><option>Tesouraria</option><option>Admin</option></select><span class="hint"><b>Operador</b>: associados, mensalidades e carteirinhas. <b>Tesouraria</b>: tudo do operador e o financeiro (livro-caixa, contas a pagar, recibos, prestação de contas). <b>Admin</b>: tudo, mais operadores, configurações, CPF completo, cancelamento de mensalidades e liberação de carteirinha com atraso.</span></div>
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

/* ---- Financeiro ---- */
function finPeriodo() { return { de: P.de || COMP_ATUAL() + '-01', ate: P.ate || mesFim(COMP_ATUAL()) }; }
function finLista() {
  const { de, ate } = finPeriodo(), q = norm(P.q || '');
  return (S.finLancamentos || []).filter(l => l.status === 'Pago' && l.data >= de && l.data <= ate)
    .filter(l => P.canc === '1' || !l.cancelado)
    .filter(l => !P.conta || l.contaId === P.conta || l.contaDestinoId === P.conta)
    .filter(l => !P.tipo || l.tipo === P.tipo)
    .filter(l => !P.cat || l.categoriaId === P.cat)
    .filter(l => !q || norm(`${l.descricao} ${l.pessoa} ${l.documento} ${finCatNome(l.categoriaId)}`).includes(q))
    .sort((a, b) => b.data.localeCompare(a.data) || b.registradoEm.localeCompare(a.registradoEm));
}
function finLinha(l, contaId) {
  const v = valorLanc(l, contaId);
  const sub = l.tipo === 'Transferência' ? `Transferência: ${esc(finContaNome(l.contaId))} → ${esc(finContaNome(l.contaDestinoId))}` : `${esc(finCatNome(l.categoriaId))}${pessoaExtra(l) ? ` · ${esc(pessoaExtra(l))}` : ''}`;
  return `<tr class="clickable ${l.cancelado ? 'dim' : ''}" data-act="finVer" data-id="${l.id}">
    <td data-label="Data" class="num">${fmtD(l.data)}</td>
    <td class="lead"><div class="t">${esc(l.descricao)}${l.cancelado ? ' <span class="chip">cancelado</span>' : ''}</div><div class="s">${sub}</div></td>
    <td data-label="Conta">${l.tipo === 'Transferência' ? `${esc(finContaNome(l.contaId))} → ${esc(finContaNome(l.contaDestinoId))}` : esc(finContaNome(l.contaId))}</td>
    <td data-label="Valor" class="valor ${v.cls}">${v.s}${fmtBRL(l.valor)}</td>
    <td data-label="Anexos" class="fin-ic">${l.comprovanteId ? `<span title="Com comprovante">${ic('clip')}</span>` : ''}${l.reciboNum ? `<span class="small mono" title="Recibo emitido">R${l.reciboNum}</span>` : ''}</td></tr>`;
}
function finResults() {
  const list = finLista(), at = list.filter(l => !l.cancelado);
  const soma = f => r2(at.filter(f).reduce((s, l) => s + l.valor, 0));
  const ent = soma(l => l.tipo === 'Entrada'), sai = soma(l => l.tipo === 'Saída');
  const tin = P.conta ? soma(l => l.tipo === 'Transferência' && l.contaDestinoId === P.conta) : 0, tout = P.conta ? soma(l => l.tipo === 'Transferência' && l.contaId === P.conta) : 0;
  const resumo = `<p class="small fin-resumo"><span>Entradas <b class="fin-pos">${fmtBRL(ent)}</b></span><span>Saídas <b class="fin-neg">${fmtBRL(sai)}</b></span>${P.conta && (tin || tout) ? `<span>Transferências <b>${fmtBRL(tin - tout)}</b></span>` : ''}<span>Resultado <b class="${ent - sai + tin - tout < 0 ? 'fin-neg' : 'fin-pos'}">${fmtBRL(r2(ent - sai + tin - tout))}</b></span><span class="muted">${plural(at.length, 'lançamento', 'lançamentos')}</span></p>`;
  if (!list.length) return `${resumo}<div class="table-wrap"><div class="empty">Nenhum lançamento neste período.</div></div>`;
  return `${resumo}<div class="table-wrap cards"><table><thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th class="num">Valor</th><th><span class="sr">Anexos</span></th></tr></thead><tbody>
    ${list.map(l => finLinha(l, P.conta)).join('')}</tbody></table></div>`;
}
function finCaixaTab() {
  const { de, ate } = finPeriodo();
  return `<div class="toolbar fin-filtros">
      <div class="field"><label for="f-de">De</label><input id="f-de" type="date" value="${de}" data-ch="finDe"></div>
      <div class="field"><label for="f-ate">Até</label><input id="f-ate" type="date" value="${ate}" data-ch="finAte"></div>
      <div class="field"><label for="f-conta">Conta</label><select id="f-conta" data-ch="finContaF"><option value="">Todas</option>${(S.finContas || []).map(c => `<option value="${c.id}" ${P.conta === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
      <div class="field"><label for="f-tipo">Tipo</label><select id="f-tipo" data-ch="finTipoF"><option value="">Todos</option>${['Entrada', 'Saída', 'Transferência'].map(t => `<option ${P.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label for="f-cat">Categoria</label><select id="f-cat" data-ch="finCatF"><option value="">Todas</option>${['Entrada', 'Saída'].map(tp => `<optgroup label="${tp === 'Entrada' ? 'Entradas' : 'Saídas'}">${(S.finCategorias || []).filter(c => c.tipo === tp).map(c => `<option value="${c.id}" ${P.cat === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>`).join('')}</select></div>
      <label class="search"><span class="sr">Buscar</span>${ic('search')}<input id="f-q" data-in="finQ" value="${esc(P.q || '')}" placeholder="Descrição, pessoa ou documento" autocomplete="off"></label>
    </div>
    <div class="toolbar"><label class="check"><input type="checkbox" data-ch="finCanc" ${P.canc === '1' ? 'checked' : ''}> Mostrar cancelados</label><span style="flex:1"></span><button class="btn sm" data-act="finCsv">${ic('download')} Planilha (CSV)</button><button class="btn sm" data-act="finImprimir">${ic('print')} Imprimir</button></div>
    <div id="fin-res">${finResults()}</div>`;
}
function finPagarTab() {
  const p = pendentes();
  return `<div class="toolbar"><p class="small muted" style="margin:0;flex:1 1 260px">Contas com vencimento (luz, água, aluguel…). Só entram no saldo quando forem pagas.</p><button class="btn primary" data-act="finNovo" data-t="Saída" data-st="Pendente">${ic('plus')} Conta a pagar</button></div>
    ${p.length ? `<div class="table-wrap cards"><table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th><th><span class="sr">Ações</span></th></tr></thead><tbody>
    ${p.map(l => `<tr><td data-label="Vencimento" class="num"><b>${fmtD(l.vencimento)}</b> ${vencPill(l)}</td>
      <td class="lead"><button class="linklike" data-act="finVer" data-id="${l.id}"><div class="t">${esc(l.descricao)}</div>${l.pessoa ? `<div class="s">${esc(l.pessoa)}</div>` : ''}</button></td>
      <td data-label="Categoria">${esc(finCatNome(l.categoriaId))}</td><td data-label="Valor" class="valor">${fmtBRL(l.valor)}</td>
      <td class="actions"><button class="btn sm primary" data-act="finPagar" data-id="${l.id}">Pagar</button></td></tr>`).join('')}
    </tbody></table></div><p class="small muted">Total em aberto: <b>${fmtBRL(r2(p.reduce((s, l) => s + l.valor, 0)))}</b></p>`
    : '<div class="table-wrap"><div class="empty">Nenhuma conta a pagar em aberto.</div></div>'}`;
}
// Prestação de contas de um período
function finRelatorio(de, ate) {
  const contados = (S.finLancamentos || []).filter(l => !l.cancelado && l.status === 'Pago' && l.data >= de && l.data <= ate)
    .filter(l => { const c = finConta(l.contaId); return c && l.data >= c.saldoInicialData; })
    .sort((a, b) => a.data.localeCompare(b.data) || a.registradoEm.localeCompare(b.registradoEm));
  const contas = (S.finContas || []).map(c => {
    let ent = 0, sai = 0, tin = 0, tout = 0;
    contados.forEach(l => { const e = efeitoConta(l, c); if (!e) return; if (l.tipo === 'Entrada') ent += e; else if (l.tipo === 'Saída') sai -= e; else if (e > 0) tin += e; else tout -= e; });
    return { c, ant: saldoConta(c.id, addDays(de, -1)), ent: r2(ent), sai: r2(sai), tin: r2(tin), tout: r2(tout), fim: saldoConta(c.id, ate) };
  }).filter(x => x.c.ativa || x.ant || x.fim || x.ent || x.sai || x.tin || x.tout);
  const porCat = tipo => { const m = {}; contados.filter(l => l.tipo === tipo).forEach(l => { const k = l.categoriaId; m[k] = m[k] || { n: 0, v: 0 }; m[k].n++; m[k].v += l.valor; }); return Object.keys(m).map(k => ({ nome: finCatNome(k), n: m[k].n, v: r2(m[k].v) })).sort((a, b) => b.v - a.v); };
  const ent = porCat('Entrada'), sai = porCat('Saída'), tEnt = r2(ent.reduce((s, x) => s + x.v, 0)), tSai = r2(sai.reduce((s, x) => s + x.v, 0));
  return { de, ate, contas, ent, sai, tEnt, tSai, resultado: r2(tEnt - tSai), abertas: pendentes().filter(l => l.vencimento <= ate), lancs: contados };
}
function docRel(R) {
  const tot = k => r2(R.contas.reduce((s, x) => s + x[k], 0)), cfg = S.config;
  const catT = (titulo, rows, total) => `<h3>${titulo}</h3><table class="doc-t rel"><thead><tr><th>Categoria</th><th class="num">Lançamentos</th><th class="num">Total</th></tr></thead><tbody>
    ${rows.map(x => `<tr><td>${esc(x.nome)}</td><td class="num">${x.n}</td><td class="num">${fmtBRL(x.v)}</td></tr>`).join('') || '<tr><td colspan="3">Nenhum lançamento.</td></tr>'}
    <tr class="tot"><td>Total</td><td></td><td class="num">${fmtBRL(total)}</td></tr></tbody></table>`;
  return `<div class="doc">${docCab(`Prestação de contas · ${fmtD(R.de)} a ${fmtD(R.ate)}`)}
    <h3>Resumo por conta</h3>
    <table class="doc-t rel"><thead><tr><th>Conta</th><th class="num">Saldo anterior</th><th class="num">Entradas</th><th class="num">Saídas</th><th class="num">Transferências</th><th class="num">Saldo final</th></tr></thead><tbody>
    ${R.contas.map(x => `<tr><td>${esc(x.c.nome)}</td><td class="num">${fmtBRL(x.ant)}</td><td class="num">${fmtBRL(x.ent)}</td><td class="num">${fmtBRL(x.sai)}</td><td class="num">${fmtBRL(r2(x.tin - x.tout))}</td><td class="num"><b>${fmtBRL(x.fim)}</b></td></tr>`).join('')}
    <tr class="tot"><td>Total</td><td class="num">${fmtBRL(tot('ant'))}</td><td class="num">${fmtBRL(tot('ent'))}</td><td class="num">${fmtBRL(tot('sai'))}</td><td class="num">${fmtBRL(r2(tot('tin') - tot('tout')))}</td><td class="num"><b>${fmtBRL(tot('fim'))}</b></td></tr></tbody></table>
    <p class="rel-res">Resultado do período (entradas − saídas): <b>${fmtBRL(R.resultado)}</b>${R.resultado < 0 ? ' (déficit)' : R.resultado > 0 ? ' (superávit)' : ''}</p>
    ${catT('Entradas por categoria', R.ent, R.tEnt)}
    ${catT('Saídas por categoria', R.sai, R.tSai)}
    ${R.abertas.length ? `<h3>Contas a pagar em aberto (vencimento até ${fmtD(R.ate)})</h3><table class="doc-t rel"><thead><tr><th>Vencimento</th><th>Descrição</th><th class="num">Valor</th></tr></thead><tbody>
      ${R.abertas.map(l => `<tr><td>${fmtD(l.vencimento)}</td><td>${esc(l.descricao)}</td><td class="num">${fmtBRL(l.valor)}</td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td></td><td class="num">${fmtBRL(r2(R.abertas.reduce((s, l) => s + l.valor, 0)))}</td></tr></tbody></table>` : ''}
    <h3>Lançamentos do período (${R.lancs.length})</h3>
    <table class="doc-t rel doc-list"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria / conta</th><th class="num">Entrada</th><th class="num">Saída</th></tr></thead><tbody>
    ${R.lancs.map(l => `<tr><td>${fmtD(l.data)}</td><td>${esc(l.descricao)}${pessoaExtra(l) ? ` <span class="muted">· ${esc(pessoaExtra(l))}</span>` : ''}${l.reciboNum ? ` <span class="muted">· recibo ${RECIBO.fmtNum(l.reciboNum)}</span>` : ''}</td>
      <td>${l.tipo === 'Transferência' ? `Transferência: ${esc(finContaNome(l.contaId))} → ${esc(finContaNome(l.contaDestinoId))}` : `${esc(finCatNome(l.categoriaId))} · ${esc(finContaNome(l.contaId))}`}</td>
      <td class="num">${l.tipo === 'Entrada' ? fmtBRL(l.valor) : ''}</td><td class="num">${l.tipo === 'Saída' ? fmtBRL(l.valor) : ''}</td></tr>`).join('') || '<tr><td colspan="5">Nenhum lançamento.</td></tr>'}</tbody></table>
    <div class="rel-sign"><div><span class="line"></span>${esc(cfg.tesoureiroNome || '')}<br>Tesoureiro(a)</div><div><span class="line"></span>${esc(cfg.presidenteNome || '')}<br>Presidente</div><div><span class="line"></span><br>Conselho fiscal</div></div>
  </div>`;
}
function finRelatorioTab() {
  const de = P.rde || COMP_ATUAL() + '-01', ate = P.rate || mesFim(COMP_ATUAL());
  const y = +TODAY().slice(0, 4), mAnt = addMonthsComp(COMP_ATUAL(), -1);
  const atalho = (label, a, b) => `<button type="button" aria-pressed="${de === a && ate === b}" data-act="finPeriodo" data-de="${a}" data-ate="${b}">${label}</button>`;
  return `<div class="toolbar fin-filtros">
      <div class="field"><label for="r-de">De</label><input id="r-de" type="date" value="${de}" data-ch="relDe"></div>
      <div class="field"><label for="r-ate">Até</label><input id="r-ate" type="date" value="${ate}" data-ch="relAte"></div>
      <div class="seg" style="align-self:end">${atalho('Este mês', COMP_ATUAL() + '-01', mesFim(COMP_ATUAL()))}${atalho('Mês passado', mAnt + '-01', mesFim(mAnt))}${atalho('Este ano', y + '-01-01', y + '-12-31')}${atalho('Ano passado', (y - 1) + '-01-01', (y - 1) + '-12-31')}</div>
    </div>
    <div class="toolbar"><p class="small muted" style="margin:0;flex:1 1 260px">Resumo para a assembleia e o conselho fiscal. Na impressão, escolha "Salvar como PDF" para guardar ou enviar.</p><button class="btn sm" data-act="relCsv">${ic('download')} Planilha (CSV)</button><button class="btn sm primary" data-act="relImprimir">${ic('print')} Imprimir / PDF</button></div>
    <div class="doc-wrap">${docRel(finRelatorio(de, ate))}</div>`;
}
function finCadastrosTab() {
  const cats = tipo => (S.finCategorias || []).filter(c => c.tipo === tipo).sort((a, b) => (b.ativa - a.ativa) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const usos = id => (S.finLancamentos || []).filter(l => l.categoriaId === id && !l.cancelado).length;
  return `<section class="panel"><div class="panel-head"><h2>Contas</h2><button class="btn sm primary" data-act="finContaNova">${ic('plus')} Nova conta</button></div>
      <p class="small muted">O saldo inicial é o dinheiro que havia na conta no dia em que o controle começou. Lançamentos com data anterior a esse dia ficam no histórico, mas não mudam o saldo.</p>
      <div class="table-wrap cards"><table><thead><tr><th>Conta</th><th>Tipo</th><th>Saldo inicial</th><th class="num">Saldo atual</th><th>Situação</th><th><span class="sr">Ações</span></th></tr></thead><tbody>
      ${(S.finContas || []).map(c => `<tr class="${c.ativa ? '' : 'dim'}"><td class="lead"><b>${esc(c.nome)}</b></td><td data-label="Tipo">${c.tipo === 'Caixa' ? 'Caixa (dinheiro)' : 'Banco / PIX'}</td>
        <td data-label="Saldo inicial" class="num">${fmtBRL(c.saldoInicial)}<div class="s">em ${fmtD(c.saldoInicialData)}</div></td><td data-label="Saldo atual" class="valor">${fmtBRL(saldoConta(c.id))}</td>
        <td data-label="Situação">${pill(c.ativa ? 'Ativa' : 'Inativa', c.ativa ? 'ok' : 'mute')}</td><td class="actions"><button class="btn sm" data-act="finContaEditar" data-id="${c.id}">${ic('edit')} Editar</button></td></tr>`).join('')}
      </tbody></table></div></section>
    <div class="grid-2">${['Entrada', 'Saída'].map(tp => `<section class="panel"><div class="panel-head"><h2>Categorias de ${tp === 'Entrada' ? 'entrada' : 'saída'}</h2><button class="btn sm" data-act="finCatNova" data-t="${tp}">${ic('plus')} Nova</button></div>
      <div class="list">${cats(tp).map(c => `<div class="row-item ${c.ativa ? '' : 'dim'}"><span class="who"><b>${esc(c.nome)}</b><span class="small muted">${plural(usos(c.id), 'lançamento', 'lançamentos')}${c.sistema ? ' · usada nas mensalidades' : ''}${c.ativa ? '' : ' · inativa'}</span></span><button class="btn sm ghost" data-act="finCatEditar" data-id="${c.id}">${ic('edit')} Editar</button></div>`).join('')}</div></section>`).join('')}</div>`;
}
VIEWS.financeiro = {
  fin: true,
  render() {
    const tab = P.tab || 'caixa', al = finAlertas(), pend = pendentes();
    const contas = (S.finContas || []).filter(c => c.ativa || Math.abs(saldoConta(c.id)) > 0.004);
    const t = (id, label, n) => `<button class="tab ${tab === id ? 'on' : ''}" role="tab" aria-selected="${tab === id}" data-act="finTab" data-tab="${id}">${label}${n ? ` <span class="count">${n}</span>` : ''}</button>`;
    const body = tab === 'pagar' ? finPagarTab() : tab === 'relatorio' ? finRelatorioTab() : tab === 'cadastros' ? finCadastrosTab() : finCaixaTab();
    return `<div class="page-head"><div><h1>Financeiro</h1><p class="sub">Livro-caixa da associação: entradas, saídas, contas a pagar e prestação de contas.</p></div>
      <div class="toolbar"><button class="btn primary" data-act="finNovo" data-t="Entrada">${ic('plus')} Entrada</button><button class="btn" data-act="finNovo" data-t="Saída">${ic('minus')} Saída</button><button class="btn" data-act="finNovo" data-t="Transferência">${ic('swap')} Transferência</button></div></div>
      <div class="kpis">${contas.map(c => { const s = saldoConta(c.id); return kpiBox(esc(c.nome), fmtBRL(s), c.tipo === 'Caixa' ? 'dinheiro em espécie' : 'banco / PIX', s < 0 ? 'money bad' : 'money'); }).join('')}
        ${contas.length > 1 ? kpiBox('Saldo total', fmtBRL(saldoTotal()), 'todas as contas', saldoTotal() < 0 ? 'money bad' : 'money') : ''}
        ${kpiBox('Contas a pagar', pend.length, al.vencidas.length ? `${plural(al.vencidas.length, 'vencida', 'vencidas')} · ${fmtBRL(r2(al.vencidas.reduce((s, l) => s + l.valor, 0)))}` : al.semana.length ? `${al.semana.length} vencem em até 7 dias` : 'nenhuma vencida', al.vencidas.length ? 'bad' : al.semana.length ? 'warn' : '', 'data-act="finTab" data-tab="pagar"')}</div>
      <div class="tabs" role="tablist">${t('caixa', 'Livro-caixa')}${t('pagar', 'Contas a pagar', pend.length)}${t('relatorio', 'Prestação de contas')}${t('cadastros', 'Contas e categorias')}</div>
      ${body}`;
  }
};

/* ---- Ficha de inscrição e termo de uso de imagem (impressão A4) ---- */
const TIPOS_DOC = ['Ficha de inscrição assinada', 'Documento com foto (RG, CNH ou CIN)', 'Comprovante de residência', 'Certidão de nascimento', 'Documento do responsável legal', 'Comprovante para isenção', 'Outro'];
const [DOC_FICHA, DOC_FOTO, DOC_RESID, DOC_CERTIDAO, DOC_RESP] = TIPOS_DOC;
const TIPOS_DOC_ANTIGOS = { 'Documento de identidade': DOC_FOTO };
const SEXOS = ['Feminino', 'Masculino', 'Outro', 'Prefiro não informar'];
const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'];
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const fmtCEP = c => { c = digits(c); return c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : c; };
const tipoDoc = d => TIPOS_DOC_ANTIGOS[d.tipo] || d.tipo;
// Documentação obrigatória (igual à regra da API): ficha assinada, comprovante de residência e documento com foto.
// Menor de idade pode usar certidão de nascimento + documento do responsável no lugar do documento com foto.
function docStatus(a) {
  const tem = {}; docsDe(a.id).forEach(d => { tem[tipoDoc(d)] = true; });
  const menor = ehMenor(a), faltam = [];
  if (!tem[DOC_FICHA]) faltam.push('ficha de inscrição assinada');
  if (!tem[DOC_RESID]) faltam.push('comprovante de residência');
  if (!tem[DOC_FOTO] && !(menor && tem[DOC_CERTIDAO] && tem[DOC_RESP])) faltam.push(menor ? 'documento com foto (ou certidão de nascimento + documento do responsável)' : 'documento com foto (RG, CNH ou CIN)');
  return { completo: !faltam.length, faltam, tem };
}
// Primeiro documento obrigatório que falta (para já vir escolhido ao anexar)
function proxDoc(a) {
  const st = docStatus(a);
  if (!st.tem[DOC_FICHA]) return DOC_FICHA;
  if (!st.tem[DOC_FOTO] && !(ehMenor(a) && (st.tem[DOC_CERTIDAO] || st.tem[DOC_RESP]))) return DOC_FOTO;
  if (!st.tem[DOC_RESID]) return DOC_RESID;
  if (ehMenor(a) && !st.tem[DOC_FOTO]) return st.tem[DOC_CERTIDAO] ? DOC_RESP : DOC_CERTIDAO;
  return 'Outro';
}
const enderecoDe = a => {
  if (!a.logradouro) return a.endereco || '';
  const rua = [a.logradouro, a.numero].filter(Boolean).join(', ') + (a.complemento ? ' - ' + a.complemento : '');
  return [rua, a.bairro, [a.cidade, a.uf].filter(Boolean).join('/'), a.cep ? 'CEP ' + fmtCEP(a.cep) : ''].filter(Boolean).join(', ');
};
const docsDe = aid => (S.documentos || []).filter(d => d.assocId === aid && !d.excluido).sort((x, y) => y.enviadoEm.localeCompare(x.enviadoEm));
const ehMenor = a => !!(a && a.nascimento) && idade(a.nascimento) < 18;
const FICHA_CSS = `@page{size:A4 portrait;margin:12mm 14mm}
.ficha{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:10.5pt;line-height:1.35;background:#fff}
.ficha-pag{break-after:page;padding:0}.ficha-pag:last-child{break-after:auto}
.fh{display:flex;align-items:center;gap:10px;border-bottom:2px solid #2D7A38;padding-bottom:6px;margin-bottom:8px}
.fh img{width:46px;height:46px;border-radius:50%;flex:none}.fh .n{font-weight:700;font-size:11.5pt}.fh .s{font-size:8.5pt;color:#444}
.fh .mat{margin-left:auto;border:1.5px solid #1C3557;border-radius:6px;padding:3px 10px;text-align:center;font-size:7.5pt;color:#444;white-space:nowrap}
.fh .mat b{display:block;font-size:13pt;color:#1C3557;font-family:'Courier New',monospace;min-width:22mm}
.ft{text-align:center;font-size:13pt;font-weight:700;letter-spacing:.06em;margin:4px 0 10px;color:#1C3557}
.fgrid{display:grid;grid-template-columns:1fr 32mm;gap:10px;align-items:start}
.foto{width:30mm;height:40mm;border:1px solid #555;display:flex;align-items:center;justify-content:center;font-size:8pt;color:#777;text-align:center;overflow:hidden;justify-self:end}
.foto img{width:100%;height:100%;object-fit:cover}
table.fc{width:100%;border-collapse:collapse;table-layout:fixed}
table.fc td{border:1px solid #9aa4a0;padding:2px 6px 3px;vertical-align:top;height:9mm}
table.fc.top td{height:10mm}
table.fc .l{display:block;font-size:6.8pt;text-transform:uppercase;letter-spacing:.05em;color:#555}
table.fc .v{font-size:10pt;font-weight:600;overflow-wrap:anywhere}
table.fc td.fcons{height:auto;font-size:7.6pt;line-height:1.3;color:#222;padding:3px 6px}
.fcons .box{display:inline-block;width:3mm;height:3mm;border:1px solid #111;margin-right:5px;vertical-align:-.6mm}
.fsec{font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#2D7A38;margin:8px 0 3px}
.fdecl{margin:10px 0 4px;text-align:justify}.flocal{margin:10px 0 0}
.fass{display:grid;grid-template-columns:repeat(auto-fit,minmax(62mm,1fr));gap:14mm;margin-top:13mm;text-align:center;font-size:9pt;break-inside:avoid}
.fass span{display:block;border-top:1px solid #111;padding-top:3px}.fass small{display:block;color:#444}
.fuso{margin-top:7mm;border:1px dashed #888;padding:6px 8px;font-size:8.5pt;color:#333;display:flex;gap:18px;flex-wrap:wrap}
.termo p{text-align:justify;margin:0 0 9px}.linha{display:inline-block;min-width:70mm;border-bottom:1px solid #111}`;
// Monta a ficha (página 1) e o termo de imagem (página 2). Sem associado: ficha em branco para preencher à mão.
function fichaHTML(a, foto) {
  const c = assocCfg(), cfg = S.config, branco = !a, menor = branco || ehMenor(a);
  const v = x => (x === undefined || x === null || x === '') ? '' : esc(x);
  const cel = (rot, val, span = 1) => `<td colspan="${span}"><span class="l">${rot}</span><span class="v">${val || '&nbsp;'}</span></td>`;
  const funcoes = a ? principaisAtuais(a.id).map(x => (funcao(x.funcaoId) || {}).nome).filter(Boolean).concat(funcoesAtuais(a.id).filter(x => !principaisAtuais(a.id).includes(x)).map(x => (funcao(x.funcaoId) || {}).nome)).join(', ') : '';
  const cat = a ? categoria(a.categoriaId) : null;
  const cnpj = c.cnpj ? `CNPJ ${fmtCNPJ(c.cnpj)}` : '';
  const cab = `<div class="fh"><img src="${LOGO}" alt=""><div><div class="n">${esc(c.nome)}</div><div class="s">${esc([cnpj, c.endereco].filter(Boolean).join(' · '))}</div></div>
    <div class="mat">Matrícula<b>${a ? fmtMat(a.matricula) : '&nbsp;'}</b></div></div>`;
  const local = `${esc(cfg.cidade || '')}, ____ de ____________________ de ________.`;
  const tpl = (t, extra) => esc(t || '').replace(/\{associacao\}/g, `<b>${esc(c.nome)}</b>`).replace(/\{cnpj\}/g, esc(fmtCNPJ(c.cnpj || '')) || '____________________')
    .replace(/\{identificacao\}/g, extra.identificacao).replace(/\{imagem\}/g, extra.imagem)
    .split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  const L = '<span class="linha"></span>';
  const ident = branco ? `eu, ${L}, inscrito(a) no CPF sob o nº ${L}, (se responsável legal: responsável por ${L},)`
    : menor ? `eu, <b>${v(a.responsavelNome) || L}</b>, inscrito(a) no CPF sob o nº <b>${a.responsavelCpf ? fmtCPF(a.responsavelCpf) : L}</b>, ${a.responsavelParentesco ? esc(a.responsavelParentesco.toLowerCase()) + ' e ' : ''}responsável legal por <b>${v(a.nome)}</b>,`
    : `eu, <b>${v(a.nome)}</b>, inscrito(a) no CPF sob o nº <b>${a.cpf ? fmtCPF(a.cpf) : L}</b>,`;
  const imagem = branco ? 'minha imagem e voz (ou a imagem e a voz do(a) menor sob minha responsabilidade)' : menor ? 'a imagem e a voz do(a) menor acima identificado(a)' : 'minha imagem e minha voz';
  const assinantes = branco ? [['Associado(a)', ''], ['Responsável legal (se menor de 18 anos)', '']]
    : menor ? [['Responsável legal', a.responsavelNome], ['Associado(a)', a.nome]] : [['Associado(a)', a.nome]];
  const assHtml = list => `<div class="fass">${list.map(([r, n]) => `<div><span>${esc(n || '')}</span><small>${r}</small></div>`).join('')}</div>`;
  return `<div class="ficha">
  <section class="ficha-pag">${cab}
    <div class="ft">FICHA DE INSCRIÇÃO DE ASSOCIADO(A)</div>
    <div class="fgrid"><table class="fc top"><tbody>
      <tr>${cel('Nome completo', a && v(a.nome), 2)}</tr>
      <tr>${cel('Nome social', a && v(a.nomeSocial))}${cel('Sexo', a && v(a.sexo))}</tr>
      <tr>${cel('CPF', a && a.cpf ? fmtCPF(a.cpf) : '')}${cel('RG', a && v(a.rg))}</tr>
      <tr>${cel('Data de nascimento', a && a.nascimento ? `${fmtD(a.nascimento)} (${idade(a.nascimento)} anos)` : '')}${cel('Naturalidade', a && v(a.naturalidade))}</tr>
    </tbody></table><div class="foto">${foto ? `<img src="data:image/jpeg;base64,${foto}" alt="">` : 'Foto<br>3 × 4'}</div></div>
    <table class="fc" style="margin-top:-1px"><tbody>
      <tr>${cel('Estado civil', a && v(a.estadoCivil))}${cel('Profissão', a && v(a.profissao))}${cel('Telefone / WhatsApp', a && v(a.telefone))}${cel('E-mail', a && v(a.email))}</tr>
    </tbody></table>
    <div class="fsec">Endereço</div>
    <table class="fc"><tbody>
      ${a && !a.logradouro && a.endereco ? `<tr>${cel('Endereço completo', v(a.endereco), 4)}</tr>` : `
      <tr>${cel('Logradouro, número e complemento', a && v([a.logradouro, a.numero].filter(Boolean).join(', ') + (a.complemento ? ' - ' + a.complemento : '')), 3)}${cel('CEP', a && a.cep ? fmtCEP(a.cep) : '')}</tr>
      <tr>${cel('Bairro', a && v(a.bairro))}${cel('Cidade', a && v(a.cidade), 2)}${cel('UF', a && v(a.uf))}</tr>`}
    </tbody></table>
    <div class="fsec">Associação</div>
    <table class="fc"><tbody>
      <tr>${cel('Categoria', cat ? esc(cat.nome) : '')}${cel('Mensalidade', cat ? (cat.valor ? fmtBRL(cat.valor) + ' por mês' : 'sem mensalidade') : '')}${cel('Data de ingresso', a ? fmtD(a.dataIngresso) : '')}${cel('Entrada na corrente', a && a.entradaCorrente ? fmtD(a.entradaCorrente) : '')}</tr>
      <tr>${cel('Funções na casa e cargos', esc(funcoes), 2)}${cel('Frequenta ou frequentou outro terreiro?', a && v(a.outroTerreiro), 2)}</tr>
    </tbody></table>
    <div class="fsec">Contato de emergência e saúde</div>
    <table class="fc"><tbody>
      <tr>${cel('Contato de emergência', a && v(a.emergNome), 2)}${cel('Parentesco', a && v(a.emergParentesco))}${cel('Telefone', a && v(a.emergTelefone))}</tr>
      <tr>${cel('Alergias, condições de saúde e medicamentos', a && v(a.saudeObs), 4)}</tr>
      <tr><td colspan="4" class="fcons"><span class="box"></span>Autorizo a associação a registrar as informações de saúde acima e a usá-las somente para orientar o atendimento e avisar o contato de emergência se o(a) associado(a) passar mal durante as atividades da casa (LGPD, art. 11). A autorização pode ser retirada a qualquer momento na secretaria.</td></tr>
    </tbody></table>
    ${menor ? `<div class="fsec">Responsável legal ${branco ? '(preencher se o associado for menor de 18 anos)' : '(associado menor de 18 anos)'}</div>
    <table class="fc"><tbody><tr>${cel('Nome do responsável', a && v(a.responsavelNome), 2)}${cel('CPF do responsável', a && a.responsavelCpf ? fmtCPF(a.responsavelCpf) : '')}${cel('Parentesco', a && v(a.responsavelParentesco))}</tr></tbody></table>` : ''}
    <div class="fdecl">${tpl(cfg.fichaDeclaracao, { identificacao: '', imagem: '' })}</div>
    <div class="flocal">${local}</div>
    ${assHtml(assinantes)}
    <div class="fuso"><b>Uso da secretaria</b><span>Recebido por: ______________________________</span><span>Data: ____/____/________</span><span>Lançado no sistema: ( )</span></div>
  </section>
  <section class="ficha-pag termo">${cab}
    <div class="ft">TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM E VOZ</div>
    ${tpl(cfg.termoImagem, { identificacao: ident, imagem })}
    <div class="flocal">${local}</div>
    ${assHtml(branco ? [['Assinatura do(a) associado(a) ou do responsável legal', '']] : menor ? [['Responsável legal', a.responsavelNome]] : [['Associado(a)', a.nome]])}
  </section></div>`;
}
async function imprimirFicha(a) {
  let foto = '';
  if (a) { busy(true, 'Preparando a ficha…'); try { foto = await fotoCompleta(a.id); } catch (e) { foto = a.fotoMini || ''; } finally { busy(false); } }
  printHTML(fichaHTML(a, foto), 'ficha-print', FICHA_CSS);
}
// Abre um arquivo (base64) num modal: foto aparece na tela; PDF pode ser aberto ou baixado
function mostrarArquivo(r, titulo) {
  const bin = atob(r.dados), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (UI.compUrl) URL.revokeObjectURL(UI.compUrl);
  const url = UI.compUrl = URL.createObjectURL(new Blob([bytes], { type: r.mime }));
  openModal(`<h2>${esc(titulo)}</h2><p class="muted small">${esc(r.nome || '')}</p>
    ${/^image\//.test(r.mime) ? `<img class="comp-img" src="${url}" alt="${esc(titulo)}">` : `<div class="note"><span>${ic('file')} Arquivo PDF. Use os botões abaixo para abrir ou baixar.</span></div>`}
    <div class="modal-actions"><a class="btn" href="${url}" download="${esc(r.nome || 'arquivo')}">${ic('download')} Baixar</a><a class="btn" href="${url}" target="_blank" rel="noopener">Abrir em outra aba</a><button class="btn primary" data-act="close">Fechar</button></div>`, 'modal-wide');
}
const listaE = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : l[0] || '';
function docsPainel(a) {
  const docs = docsDe(a.id), st = docStatus(a);
  return `<section class="panel"><div class="panel-head"><h2>Ficha de inscrição e documentos</h2>
      <div class="toolbar"><button class="btn sm" data-act="fichaImprimir" data-id="${a.id}">${ic('print')} Imprimir ficha e termo</button><button class="btn sm primary" data-act="docAnexar" data-id="${a.id}">${ic('clip')} Anexar documento</button></div></div>
    ${st.completo ? `<div class="note ok"><span><b>Documentação completa.</b> Ficha e termo de imagem assinados${a.fichaEm ? ` (entregues em ${fmtD(a.fichaEm)})` : ''}, documento com foto e comprovante de residência.</span></div>`
      : `<div class="note warn"><span><b>Documentação incompleta</b>: falta ${esc(listaE(st.faltam))}. A carteirinha só é emitida com os documentos anexados.${st.tem[DOC_FICHA] ? '' : ` Imprima a ficha e o termo de uso de imagem, colha as assinaturas${ehMenor(a) ? ' (do responsável legal e do associado)' : ''}, escaneie ou fotografe e anexe como "Ficha de inscrição assinada".`}</span></div>`}
    <ul class="doc-check">${[[DOC_FICHA, 'Ficha de inscrição e termo assinados'], ...(ehMenor(a) ? [[DOC_FOTO, 'Documento com foto (RG, CNH ou CIN) — ou certidão de nascimento + documento do responsável', !!(st.tem[DOC_FOTO] || (st.tem[DOC_CERTIDAO] && st.tem[DOC_RESP]))]] : [[DOC_FOTO, 'Documento com foto (RG, CNH ou CIN)']]), [DOC_RESID, 'Comprovante de residência']]
      .map(([tp, rot, ok]) => { ok = ok === undefined ? !!st.tem[tp] : ok; return `<li class="${ok ? 'ok' : 'falta'}">${ic(ok ? 'check' : 'x')} ${rot}</li>`; }).join('')}</ul>
    ${docs.length ? `<div class="list">${docs.map(d => `<div class="row-item"><span class="who"><b>${esc(tipoDoc(d))}</b><span class="small muted">${esc(d.nome)} · ${fmtStamp(d.enviadoEm)} · ${esc(d.enviadoPor)}${d.obs ? ` · ${esc(d.obs)}` : ''}</span></span>
      <span class="row-actions"><button class="btn sm" data-act="docVer" data-id="${d.id}">${ic('file')} Abrir</button>${isAdmin() ? `<button class="btn sm ghost icon" data-act="docExcluir" data-id="${d.id}" aria-label="Excluir documento" title="Excluir documento">${ic('x')}</button>` : ''}</span></div>`).join('')}</div>`
      : '<p class="small muted">Nenhum documento anexado.</p>'}
  </section>`;
}

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
    tipo: c.tipo || '', nome: a.nome, matricula: a.matricula, funcao: funcaoPrincipal(a.id) || c.funcao, categoria: catNome(a.categoriaId) || c.categoria, validade: c.validade,
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
// Carteirinha provisória (menos de N anos de casa) e definitiva — mesma regra da API (versão 1.6)
function definitivaEm(a) {
  if (!a || !/^\d{4}-\d{2}-\d{2}$/.test(a.dataIngresso || '')) return '';
  const [y, m, d] = a.dataIngresso.split('-').map(Number), t = new Date(y + (Number(S.config.anosDefinitiva) || 0), m - 1, d); if (t.getMonth() !== m - 1) t.setDate(0);
  return isoLocal(t);
}
const tipoPrevisto = a => { const e = definitivaEm(a); return !e || e <= TODAY() ? 'Definitiva' : 'Provisória'; };
function validadePrevista(a, tipo) {
  tipo = tipo || (a ? tipoPrevisto(a) : 'Definitiva');
  if (tipo === 'Provisória') { const [y, m, d] = definitivaEm(a).split('-').map(Number); return isoLocal(new Date(y, m - 1, d - 1)); }
  const c = S.config, q = Math.max(0, parseInt(c.valQtd, 10) || 0), h = new Date();
  const v = c.valUnid === 'meses' ? new Date(h.getFullYear(), h.getMonth() + q, h.getDate() - (q ? 1 : 0)) : new Date(h.getFullYear() + q, h.getMonth(), h.getDate() - (q ? 1 : 0));
  return c.valFimAno ? `${v.getFullYear()}-12-31` : isoLocal(v);
}
const regraValidade = () => { const c = S.config, q = Number(c.valQtd) || 0; return q ? `${plural(q, c.valUnid === 'meses' ? 'mês' : 'ano', c.valUnid === 'meses' ? 'meses' : 'anos')}${c.valFimAno ? ', até 31 de dezembro do último ano' : ' a partir da emissão'}` : 'até 31 de dezembro do ano da emissão'; };
const temFoto = a => !!(a.fotoId || a.fotoMini);
// carteirinha ativa provisória de quem já completou o tempo: tem direito à definitiva
const direitoDefinitiva = a => { const c = carteirinhaAtiva(a.id); return !!c && c.tipo === 'Provisória' && a.situacao === 'Ativo' && tipoPrevisto(a) === 'Definitiva'; };

/* ---- Relatórios e planilha ---- */
function csvCampo(v) { v = String(v ?? ''); return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
function exportarCsv(list) {
  const cab = ['Matrícula', 'Nome', 'Nome social', 'CPF', 'RG', 'Nascimento', 'Sexo', 'Estado civil', 'Profissão', 'Naturalidade', 'Telefone', 'E-mail', 'Endereço', 'CEP', 'Bairro', 'Cidade', 'UF', 'Contato de emergência', 'Telefone de emergência', 'Categoria', 'Situação', 'Ingresso', 'Entrada na corrente', 'Funções na carteirinha', 'Outras funções', 'Carteirinha válida até', 'Meses em atraso', 'Isenção', 'Documentação'];
  const linhas = list.map(a => { const c = carteirinhaAtiva(a.id), f = financeiro(a), pr = funcaoPrincipal(a.id); const st = docStatus(a); return [fmtMat(a.matricula), a.nome, a.nomeSocial, isAdmin() ? fmtCPF(a.cpf) : maskCPF(a.cpf), a.rg, fmtD(a.nascimento).replace('—', ''), a.sexo, a.estadoCivil, a.profissao, a.naturalidade, a.telefone, a.email, enderecoDe(a), a.cep ? fmtCEP(a.cep) : '', a.bairro, a.cidade, a.uf, [a.emergNome, a.emergParentesco ? `(${a.emergParentesco})` : ''].filter(Boolean).join(' '), a.emergTelefone, catNome(a.categoriaId), a.situacao, fmtD(a.dataIngresso), a.entradaCorrente ? fmtD(a.entradaCorrente) : '', pr, funcoesAtuais(a.id).filter(x => !principaisAtuais(a.id).includes(x)).map(x => (funcao(x.funcaoId) || {}).nome).filter(Boolean).join(', '), c ? fmtD(c.validade) : '', f.atraso || '', f.isencao ? `${f.isencao.motivo} de ${fmtComp(f.isencao.inicio)} a ${fmtComp(f.isencao.fim)}` : '', st.completo ? 'Completa' : 'Falta: ' + st.faltam.join(', ')]; });
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
      <table class="doc-t"><thead><tr><th>Matr.</th><th>Nome</th><th>Categoria</th><th>Função</th><th>Telefone</th><th>Situação</th></tr></thead><tbody>
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
      const q = S.assocFuncoes.filter(x => x.funcaoId === f.id && (!x.fim || x.fim > TODAY())).map(x => ({ a: assoc(x.assocId), x })).filter(o => o.a && o.a.situacao === 'Ativo').sort((m, n) => m.a.nome.localeCompare(n.a.nome, 'pt-BR'));
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
      <label class="check"><input type="checkbox" id="m-prin"> Usar na carteirinha no lugar da atual do mesmo tipo</label>
      <p class="small muted">Se for a primeira função desse tipo (da casa ou administrativa), ela já vai para a carteirinha.</p>
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
    const futuros = []; for (let i = 1; i <= 6; i++) { const c = addMonthsComp(COMP_ATUAL(), i); if (!fin.pagas[c] && !fin.isentos[c]) futuros.push(c); }
    const opcoes = [...fin.aberto, ...futuros];
    UI.pag = { id, valor: fin.valor };
    openModal(`<h2>Registrar pagamento</h2><p class="muted">${esc(a.nome)} · ${esc(catNome(a.categoriaId))} · ${fmtBRL(fin.valor)}/mês</p>
      ${fin.aberto.length ? `<p class="small">${plural(fin.aberto.length, 'mês em aberto', 'meses em aberto')}. Marque os meses pagos:</p>` : '<p class="small">Nenhum mês em aberto. Você pode registrar meses adiantados:</p>'}
      <div class="month-picks">${opcoes.map((c, i) => `<label class="mpick ${c < COMP_ATUAL() ? 'late' : c > COMP_ATUAL() ? 'future' : ''}"><input type="checkbox" data-ch="pagMes" value="${c}" ${i === 0 && fin.aberto.length ? 'checked' : ''}><span>${fmtComp(c)}</span></label>`).join('')}</div>
      <div class="fields"><div class="field"><label for="m-pforma">Forma</label><select id="m-pforma" data-ch="pagForma">${['PIX', 'Dinheiro', 'Transferência', 'Cartão', 'Isenção', 'Outro'].map(f => `<option>${f}</option>`).join('')}</select></div>
        <div class="field"><label for="m-pval">Valor total (R$)</label><input id="m-pval" type="number" min="0" step="0.01" value="${fin.aberto.length ? fin.valor.toFixed(2) : ''}"></div>
        <div class="field"><label for="m-pdata">Data do pagamento</label><input id="m-pdata" type="date" value="${TODAY()}" max="${TODAY()}"></div>
        <div class="field"><label for="m-pobs">Observação</label><input id="m-pobs" maxlength="300" placeholder="Opcional"></div>
        ${canFin() && contasAtivas().length ? `<div class="field"><label for="m-pconta">Entrou na conta</label><select id="m-pconta"><option value="">Automático (dinheiro → caixa, demais → banco)</option>${contaOpts('')}</select></div>` : ''}</div>
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
    run(async () => { await api('pagamento.registrar', { assocId: UI.pag.id, competencias: comps, valorTotal: forma === 'Isenção' ? 0 : +val, forma, dataPagamento: $('#m-pdata').value, obs: $('#m-pobs').value, contaId: $('#m-pconta') ? $('#m-pconta').value : '' }); closeModal(); render(); toast(`${plural(comps.length, 'mês registrado', 'meses registrados')}`); });
  },
  pagCancelar(t) {
    const p = S.pagamentos.find(x => x.id === t.dataset.id);
    openModal(`<h2>Cancelar pagamento</h2><p class="muted">${esc(assoc(p.assocId).nome)} · ${fmtComp(p.competencia)} · ${fmtBRL(p.valor)} (${esc(p.forma)})</p>
      <div class="field"><label for="m-mot">Motivo</label><input id="m-mot" maxlength="300" placeholder="Ex.: lançado no associado errado"></div>
      <p class="small muted">O lançamento continua no histórico, marcado como cancelado, e o mês volta a ficar em aberto. O valor também sai do livro-caixa.</p>
      <div class="modal-actions"><button class="btn" data-act="close">Voltar</button><button class="btn danger" data-act="pagCancelarOk" data-id="${p.id}">Cancelar pagamento</button></div>`);
  },
  pagCancelarOk(t) { run(async () => { await api('pagamento.cancelar', { id: t.dataset.id, motivo: $('#m-mot').value }); closeModal(); render(); toast('Pagamento cancelado'); }); },

  /* Carteirinhas */
  cartEmitir(t) {
    const a = assoc(t.dataset.id), fin = financeiro(a), atual = carteirinhaAtiva(a.id), tipo = tipoPrevisto(a), val = validadePrevista(a, tipo), docs = docStatus(a);
    const anos = plural(Number(S.config.anosDefinitiva) || 0, 'ano', 'anos');
    const bloq = fin.bloqueia || !docs.completo;
    // a definitiva exige foto (não há liberação para isso)
    const faltaFoto = tipo === 'Definitiva' && !temFoto(a);
    const avisoFoto = faltaFoto ? `<div class="note bad"><b>Falta a foto</b><span>Com ${anos} de casa ou mais, ${esc(a.nome.split(' ')[0])} recebe a carteirinha definitiva, que exige foto.</span></div>` : '';
    const avisoFin = fin.bloqueia ? `<div class="note bad"><b>${plural(fin.atraso, 'mês', 'meses')} em atraso</b><span>${fin.atrasadas.map(fmtComp).join(', ')}. A tolerância é de ${plural(S.config.toleranciaMeses, 'mês', 'meses')}.</span></div>` : '';
    const avisoDocs = docs.completo ? '' : `<div class="note bad"><b>Documentação incompleta</b><span>Falta anexar: ${esc(listaE(docs.faltam))}.</span></div>`;
    if ((bloq && !isAdmin()) || faltaFoto) {
      openModal(`<h2>Carteirinha bloqueada</h2><p class="muted">${esc(a.nome)}</p>${avisoFoto}${avisoDocs}${avisoFin}
        <p class="small muted">${[faltaFoto ? 'Adicione a foto no cadastro' : '', docs.completo ? '' : 'anexe os documentos que faltam', fin.bloqueia ? 'registre os pagamentos' : ''].filter(Boolean).join(', ').replace(/^./, c => c.toUpperCase())} para liberar a carteirinha${bloq && !isAdmin() ? ', ou peça a um administrador para liberar os outros pontos' : ''}.${faltaFoto ? ' A foto não pode ser dispensada.' : ''}</p>
        <div class="modal-actions"><button class="btn" data-act="close">Voltar</button>${faltaFoto ? `<button class="btn" data-act="go" data-v="associado" data-id="${a.id}">${ic('camera')} Abrir o cadastro</button>` : ''}${fin.bloqueia ? `<button class="btn${docs.completo ? ' primary' : ''}" data-act="pagNovo" data-id="${a.id}">${ic('coin')} Registrar pagamento</button>` : ''}${docs.completo ? '' : `<button class="btn primary" data-act="docAnexar" data-id="${a.id}">${ic('clip')} Anexar documento</button>`}</div>`);
      return;
    }
    openModal(`<h2>${atual ? 'Renovar carteirinha' : 'Emitir carteirinha'}</h2>
      <dl class="facts"><div><dt>Associado</dt><dd>${esc(a.nome)}</dd></div><div><dt>Tipo</dt><dd><b>${tipo}</b>${tipo === 'Provisória' ? `<span class="small muted"> · definitiva a partir de ${fmtD(definitivaEm(a))}</span>` : ''}</dd></div><div><dt>Válida até</dt><dd><b>${fmtD(val)}</b></dd></div><div><dt>Função na carteirinha</dt><dd>${esc(funcaoPrincipal(a.id) || '—')}</dd></div><div><dt>Foto</dt><dd>${temFoto(a) ? 'cadastrada' : '<span class="muted">sem foto (opcional na provisória)</span>'}</dd></div></dl>
      ${tipo === 'Provisória' && isAdmin() ? `<details class="antecipa"><summary class="small">Emitir a definitiva antes de completar ${anos} de casa</summary>
        <p class="small muted">Use quando a data de ingresso não reflete o tempo real de casa. A definitiva valerá até ${fmtD(validadePrevista(a, 'Definitiva'))}${temFoto(a) ? '' : ' e exige foto: adicione a foto no cadastro antes'}.</p>
        <label class="check small"><input type="checkbox" id="m-ant" ${temFoto(a) ? '' : 'disabled'}> Emitir como definitiva</label>
        <div class="field"><label for="m-antmot">Motivo</label><input id="m-antmot" maxlength="300" placeholder="Ex.: frequenta a casa desde 2015" ${temFoto(a) ? '' : 'disabled'}></div></details>` : ''}
      ${atual ? '<div class="note warn"><span>A carteirinha atual será substituída: o QR Code e o link pessoal antigos deixam de valer.</span></div>' : ''}
      ${bloq ? `${avisoDocs}${avisoFin}<p class="small muted">Como administrador, você pode liberar informando o motivo. A liberação fica registrada no histórico.</p>
        <div class="field"><label for="m-just">Motivo da liberação</label><input id="m-just" maxlength="300" placeholder="${fin.bloqueia ? 'Ex.: acordo de pagamento' : 'Ex.: documentos serão entregues na próxima gira'}"></div>` : ''}
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="cartEmitirOk" data-id="${a.id}" data-lib="${bloq ? 1 : ''}">${bloq ? 'Liberar e emitir' : atual ? 'Renovar' : 'Emitir'}</button></div>`);
  },
  cartEmitirOk(t) {
    run(async () => {
      const r = await api('carteirinha.emitir', { assocId: t.dataset.id, liberar: !!t.dataset.lib, justificativa: $('#m-just') ? $('#m-just').value : '', antecipar: !!$('#m-ant')?.checked, motivoAntecipacao: $('#m-antmot') ? $('#m-antmot').value : '' }, { msg: 'Emitindo…' });
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
    const semFoto = sel.filter(a => tipoPrevisto(a) === 'Definitiva' && !temFoto(a)), comFoto = sel.filter(a => !semFoto.includes(a));
    const bloq = comFoto.filter(a => financeiro(a).bloqueia), semDocs = comFoto.filter(a => !financeiro(a).bloqueia && !docStatus(a).completo), ok = comFoto.filter(a => !financeiro(a).bloqueia && docStatus(a).completo);
    const nProv = ok.filter(a => tipoPrevisto(a) === 'Provisória').length, nDef = ok.length - nProv;
    openModal(`<h2>Emitir ou renovar carteirinhas</h2><p>${plural(ok.length, 'carteirinha será emitida', 'carteirinhas serão emitidas')}${nDef ? `: ${plural(nDef, 'definitiva', 'definitivas')} válida${nDef > 1 ? 's' : ''} até <b>${fmtD(validadePrevista(null, 'Definitiva'))}</b>` : ''}${nProv ? `${nDef ? ' e' : ':'} ${plural(nProv, 'provisória', 'provisórias')} (cada uma vale até a véspera de o associado completar ${plural(Number(S.config.anosDefinitiva) || 0, 'ano', 'anos')} de casa)` : ''}. As atuais são substituídas.</p>
      ${semFoto.length ? `<div class="note warn"><b>${plural(semFoto.length, 'associado fica de fora', 'associados ficam de fora')} por falta de foto</b><span>${semFoto.map(a => esc(a.nome)).join(', ')}. A carteirinha definitiva exige foto.</span></div>` : ''}
      ${bloq.length ? `<div class="note warn"><b>${plural(bloq.length, 'associado fica de fora', 'associados ficam de fora')} por mensalidades em atraso</b><span>${bloq.map(a => esc(a.nome)).join(', ')}. Emita individualmente${isAdmin() ? ', informando o motivo da liberação' : ' depois de registrar os pagamentos'}.</span></div>` : ''}
      ${semDocs.length ? `<div class="note warn"><b>${plural(semDocs.length, 'associado fica de fora', 'associados ficam de fora')} por documentação incompleta</b><span>${semDocs.map(a => esc(a.nome)).join(', ')}. Anexe os documentos no cadastro${isAdmin() ? ' ou emita individualmente, informando o motivo da liberação' : ''}.</span></div>` : ''}
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="cartEmitirLoteOk" ${ok.length ? '' : 'disabled'}>Emitir ${ok.length}</button></div>`);
  },
  cartEmitirLoteOk() {
    const lista = [...UI.sel].map(assoc).filter(a => a && a.situacao === 'Ativo' && !financeiro(a).bloqueia && docStatus(a).completo && !(tipoPrevisto(a) === 'Definitiva' && !temFoto(a)));
    closeModal();
    run(async () => {
      let n = 0;
      for (const a of lista) { await api('carteirinha.emitir', { assocId: a.id }, { msg: `Emitindo ${n + 1} de ${lista.length}…` }); n++; }
      render(); toast(`${plural(n, 'carteirinha emitida', 'carteirinhas emitidas')}. Use "Imprimir" para imprimir as selecionadas.`);
    });
  },

  /* Integração com a biblioteca */
  bibStatus() {
    run(async () => {
      const r = await api('biblioteca.status', {}, { msg: 'Consultando…' }), el = $('#bib-st'); if (!el) return;
      el.innerHTML = `<p><b>${plural(r.total, 'associado enviado', 'associados enviados')}</b> de ${r.associados}${r.ultimo ? ` · última atualização ${fmtStamp(r.ultimo)}` : ''}.</p>
        <p class="muted">${plural(r.bloqueados, 'bloqueado', 'bloqueados')} por mensalidades em atraso · ${plural(r.semCpf, 'sem CPF', 'sem CPF')} · ${plural(r.semEmail, 'sem e-mail (não recebe lembretes)', 'sem e-mail (não recebem lembretes)')}.</p>`;
    });
  },
  bibAtualizar() { run(async () => { const r = await api('biblioteca.exportar', {}, { msg: 'Atualizando a biblioteca…' }); toast(`Biblioteca: ${plural(r.novos, 'novo', 'novos')}, ${plural(r.atualizados, 'atualizado', 'atualizados')}`); ACT.bibStatus(); }); },
  /* Administração */
  opStatus(t) { const o = S.operadores[+t.dataset.i]; run(async () => { await api('operador.atualizar', { email: o.email, status: o.status === 'Ativo' ? 'Inativo' : 'Ativo' }); render(); }); },
};

/* ============ Financeiro: formulários e ações ============ */
const contaOpts = (sel, ativas = true) => (S.finContas || []).filter(c => !ativas || c.ativa || c.id === sel).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
const formaOpts = sel => `<option value="">—</option>${FORMAS_FIN.map(f => `<option ${f === sel ? 'selected' : ''}>${f}</option>`).join('')}`;
function contaPadrao(forma) { const at = contasAtivas(); return (at.find(c => c.tipo === (forma === 'Dinheiro' ? 'Caixa' : 'Banco')) || at[0] || {}).id || ''; }
function finForm(l, preset = {}) {
  if (l && l.origem === 'mensalidade') {
    openModal(`<h2>Editar lançamento da mensalidade</h2><p class="muted">${esc(l.pessoa)} · ${fmtBRL(l.valor)} em ${fmtD(l.data)}</p>
      <p class="small muted">Valor, data e associado vêm da mensalidade. Aqui dá para corrigir em qual conta o dinheiro entrou e a descrição.</p>
      <div class="fields"><div class="field"><label for="l-conta">Entrou na conta</label><select id="l-conta">${contaOpts(l.contaId)}</select></div>
        <div class="field"><label for="l-doc">Nº do documento</label><input id="l-doc" maxlength="80" value="${esc(l.documento)}" placeholder="Opcional"></div>
        <div class="field full"><label for="l-desc">Descrição</label><input id="l-desc" maxlength="300" value="${esc(l.descricao)}"></div></div>
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="finSalvar" data-id="${l.id}">Salvar</button></div>`);
    return;
  }
  const tipo = l ? l.tipo : preset.t || 'Entrada', st = l ? l.status : preset.st || 'Pago';
  UI.fin = { tipo, catSel: l ? l.categoriaId : '' };
  const v = (k, d = '') => esc(l ? (l[k] || d) : d);
  const at = contasAtivas(), conta = l ? l.contaId : contaPadrao(''), dest = l ? l.contaDestinoId : ((at.find(c => c.id !== conta) || {}).id || '');
  openModal(`<h2>${l ? 'Editar lançamento' : st === 'Pendente' ? 'Nova conta a pagar' : 'Novo lançamento'}</h2>
    ${l ? '' : `<div class="seg" role="group" aria-label="Tipo de lançamento">${['Entrada', 'Saída', 'Transferência'].map(t => `<button type="button" data-act="finTipo" data-t="${t}" aria-pressed="${t === tipo}">${t}</button>`).join('')}</div>`}
    <div class="fields" id="fin-form">
      <div class="field" data-show="Saída"><label for="l-st">Situação</label><select id="l-st" data-ch="finSt" ${l && l.status === 'Pago' ? 'disabled' : ''}><option value="Pago" ${st === 'Pago' ? 'selected' : ''}>Já foi paga</option><option value="Pendente" ${st === 'Pendente' ? 'selected' : ''}>A pagar (com vencimento)</option></select></div>
      <div class="field" data-st="Pago"><label for="l-data">Data</label><input id="l-data" type="date" value="${v('data', TODAY())}" max="${TODAY()}"></div>
      <div class="field" data-st="Pendente"><label for="l-venc">Vencimento</label><input id="l-venc" type="date" value="${v('vencimento', TODAY())}"></div>
      <div class="field"><label for="l-valor">Valor (R$)</label><input id="l-valor" type="number" min="0.01" step="0.01" inputmode="decimal" value="${l ? Number(l.valor).toFixed(2) : ''}" placeholder="0,00"></div>
      <div class="field" data-st="Pago"><label for="l-conta" id="l-conta-lb">Conta</label><select id="l-conta">${contaOpts(conta)}</select></div>
      <div class="field" data-show="Transferência"><label for="l-dest">Para a conta</label><select id="l-dest">${contaOpts(dest)}</select></div>
      <div class="field" data-show="Entrada Saída"><label for="l-cat">Categoria</label><select id="l-cat"></select></div>
      <div class="field full"><label for="l-desc">Descrição</label><input id="l-desc" maxlength="300" value="${v('descricao')}" placeholder="${tipo === 'Transferência' ? 'Ex.: depósito do caixa no banco' : 'Ex.: doação para a festa, conta de luz de março'}"></div>
      <div class="field" data-show="Entrada Saída"><label for="l-pessoa" id="l-pessoa-lb">Recebido de</label><input id="l-pessoa" list="l-pessoas" maxlength="150" value="${v('pessoa')}" autocomplete="off" placeholder="Nome (opcional)"><datalist id="l-pessoas">${S.associados.filter(a => a.situacao === 'Ativo').map(a => `<option value="${esc(a.nome)}">`).join('')}</datalist></div>
      <div class="field"><label for="l-forma">Forma</label><select id="l-forma">${formaOpts(l ? l.forma : '')}</select></div>
      <div class="field" data-show="Entrada Saída"><label for="l-doc">Nº do documento / nota</label><input id="l-doc" maxlength="80" value="${v('documento')}" placeholder="Opcional"></div>
      ${l ? '' : `<div class="field" data-st="Pendente"><label for="l-rep">Repetir todo mês</label><select id="l-rep">${[1, 2, 3, 4, 6, 12].map(n => `<option value="${n}">${n === 1 ? 'Não repetir' : `${n} meses (${n} parcelas)`}</option>`).join('')}</select></div>
      <div class="field full"><label for="l-arq">Comprovante (foto ou PDF)</label><input id="l-arq" type="file" accept="image/*,application/pdf"><span class="hint">Opcional. Pode anexar depois.</span></div>`}
    </div>
    <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="finSalvar" data-id="${l ? l.id : ''}">${l ? 'Salvar' : 'Lançar'}</button></div>`, 'modal-wide');
  finFormSync();
}
function finFormSync() {
  const f = UI.fin; if (!f || !$('#fin-form')) return;
  const st = f.tipo === 'Saída' ? $('#l-st').value : 'Pago';
  $$('#fin-form [data-st]').forEach(el => { el.hidden = el.dataset.st !== st; });
  $$('#fin-form [data-show]').forEach(el => { el.hidden = !el.dataset.show.split(' ').includes(f.tipo); });
  $('#l-conta-lb').textContent = f.tipo === 'Transferência' ? 'Da conta' : f.tipo === 'Entrada' ? 'Entrou na conta' : 'Saiu da conta';
  $('#l-pessoa-lb').textContent = f.tipo === 'Entrada' ? 'Recebido de' : 'Pago a';
  const sel = $('#l-cat'), cur = sel.value || f.catSel;
  const cats = (S.finCategorias || []).filter(c => c.tipo === f.tipo && (c.ativa || c.id === cur)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  sel.innerHTML = `<option value="">Escolha…</option>${cats.map(c => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}`;
  $$('[data-act="finTipo"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === f.tipo)));
}
// Comprovante: PDF vai como está; foto é reduzida (até 1800 px, JPEG) antes de enviar
function prepComprovante(file, maxPx = 1800, q = 0.82) {
  return new Promise((res, rej) => {
    const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (pdf) { if (file.size > 6 * 1024 * 1024) { rej(new Error('PDF maior que 6 MB. Use um arquivo menor.')); return; } blobB64(file).then(d => res({ mime: 'application/pdf', nome: file.name, dados: d }), rej); return; }
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) { rej(new Error('Envie uma foto ou um PDF.')); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, maxPx / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      res({ mime: 'image/jpeg', nome: file.name.replace(/\.[^.]+$/, '') + '.jpg', dados: c.toDataURL('image/jpeg', q).split(',')[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não foi possível abrir esta imagem. Use JPG, PNG ou PDF.')); };
    img.src = url;
  });
}
async function dadosRecibo(l, extenso) {
  const cfg = S.config, pres = cfg.reciboAssina !== 'tesoureiro';
  return {
    id: l.id, numero: l.reciboNum, valor: l.valor, extenso, pessoa: l.pessoa, descricao: l.descricao, forma: l.forma, data: l.data, cidade: cfg.cidade, assoc: assocCfg(),
    logo: await CARTAO.logo(LOGO), assinatura: pres ? S.assinatura : '', assinanteNome: pres ? cfg.presidenteNome : cfg.tesoureiroNome, assinanteCargo: pres ? 'Presidente' : 'Tesoureiro(a)', cancelado: l.cancelado,
  };
}
function finCsvLinhas(list) {
  return list.map(l => [fmtD(l.data || l.vencimento), l.tipo, l.descricao, l.pessoa, l.tipo === 'Transferência' ? '' : finCatNome(l.categoriaId), l.contaId ? finContaNome(l.contaId) : '', l.contaDestinoId ? finContaNome(l.contaDestinoId) : '', l.forma, l.documento,
    (l.tipo === 'Saída' ? '-' : '') + brNum(l.valor), l.cancelado ? 'Cancelado' : l.status === 'Pendente' ? `A pagar (vence ${fmtD(l.vencimento)})` : 'Pago', l.reciboNum ? RECIBO.fmtNum(l.reciboNum) : '', l.comprovanteId ? 'sim' : '', l.registradoPor]);
}
const FIN_CSV_CAB = ['Data', 'Tipo', 'Descrição', 'Pessoa', 'Categoria', 'Conta', 'Conta destino', 'Forma', 'Documento', 'Valor', 'Situação', 'Recibo', 'Comprovante', 'Registrado por'];
const csvTexto = rows => '﻿' + rows.map(r => r.map(csvCampo).join(';')).join('\r\n');

Object.assign(ACT, {
  finTab(t) { go('financeiro', { tab: t.dataset.tab }); },
  finNovo(t) {
    if (!contasAtivas().length) { toast('Cadastre uma conta antes (aba Contas e categorias).', 'bad'); return; }
    finForm(null, { t: t.dataset.t, st: t.dataset.st });
  },
  finTipo(t) { if (!UI.fin) return; UI.fin.tipo = t.dataset.t; finFormSync(); },
  finEditar(t) { finForm(finLanc(t.dataset.id)); },
  finSalvar(t) {
    const id = t.dataset.id, l = id ? finLanc(id) : null, val = s => ($(s) ? $(s).value : '').trim();
    if (l && l.origem === 'mensalidade') { run(async () => { await api('fin.editar', { id, contaId: val('#l-conta'), descricao: val('#l-desc'), documento: val('#l-doc') }); closeModal(); render(); toast('Lançamento atualizado'); }); return; }
    const f = UI.fin, st = f.tipo === 'Saída' ? val('#l-st') || 'Pago' : 'Pago';
    const pessoa = f.tipo === 'Transferência' ? '' : val('#l-pessoa'), a = pessoa ? S.associados.find(x => norm(x.nome) === norm(pessoa)) : null;
    const p = { id: id || undefined, tipo: f.tipo, status: st, data: val('#l-data'), vencimento: val('#l-venc'), valor: val('#l-valor').replace(',', '.'), contaId: st === 'Pago' ? val('#l-conta') : '', contaDestinoId: f.tipo === 'Transferência' ? val('#l-dest') : '',
      categoriaId: f.tipo === 'Transferência' ? '' : val('#l-cat'), descricao: val('#l-desc'), pessoa, assocId: a ? a.id : (l && l.pessoa === pessoa ? l.assocId : ''), forma: val('#l-forma'), documento: f.tipo === 'Transferência' ? '' : val('#l-doc'), repetir: +val('#l-rep') || 1 };
    if (!(+p.valor > 0)) { toast('Informe o valor.', 'bad'); $('#l-valor').focus(); return; }
    if (f.tipo !== 'Transferência' && !p.categoriaId) { toast('Escolha a categoria.', 'bad'); $('#l-cat').focus(); return; }
    if (!p.descricao) { toast('Informe a descrição.', 'bad'); $('#l-desc').focus(); return; }
    if (f.tipo === 'Transferência' && p.contaId === p.contaDestinoId) { toast('Escolha contas diferentes para a transferência.', 'bad'); return; }
    const arq = $('#l-arq') && $('#l-arq').files[0];
    run(async () => {
      const prep = arq ? await prepComprovante(arq) : null;
      const r = await api(id ? 'fin.editar' : 'fin.lancar', p);
      if (prep) await api('fin.comprovante', { id: r.id, ...prep }, { msg: 'Enviando comprovante…' });
      closeModal(); render();
      toast(id ? 'Lançamento atualizado' : st === 'Pendente' ? (r.ids.length > 1 ? `${r.ids.length} contas a pagar lançadas` : 'Conta a pagar lançada') : `${f.tipo} registrada`);
    });
  },
  finVer(t) {
    const l = finLanc(t.dataset.id); if (!l) return;
    const a = l.assocId ? assoc(l.assocId) : null, mens = l.origem === 'mensalidade', v = valorLanc(l, '');
    openModal(`<h2>${l.tipo === 'Saída' && l.status === 'Pendente' ? 'Conta a pagar' : l.tipo}</h2><p class="muted">${esc(l.descricao)}</p>
      ${l.cancelado ? `<div class="note bad"><b>Cancelado em ${fmtStamp(l.canceladoEm)}</b><span>${esc(l.canceladoPor)}: ${esc(l.motivoCancelamento)}</span></div>` : ''}
      <dl class="facts">
        <div><dt>Valor</dt><dd class="fin-big ${v.cls}">${v.s}${fmtBRL(l.valor)}</dd></div>
        <div><dt>${l.status === 'Pendente' ? 'Vencimento' : 'Data'}</dt><dd>${l.status === 'Pendente' ? `${fmtD(l.vencimento)} ${l.cancelado ? '' : vencPill(l)}` : fmtD(l.data)}</dd></div>
        ${l.tipo === 'Transferência' ? `<div><dt>Da conta</dt><dd>${esc(finContaNome(l.contaId))}</dd></div><div><dt>Para a conta</dt><dd>${esc(finContaNome(l.contaDestinoId))}</dd></div>`
        : `<div><dt>Categoria</dt><dd>${esc(finCatNome(l.categoriaId))}</dd></div><div><dt>Conta</dt><dd>${l.contaId ? esc(finContaNome(l.contaId)) : '—'}</dd></div>`}
        ${l.pessoa ? `<div><dt>${l.tipo === 'Entrada' ? 'Recebido de' : 'Pago a'}</dt><dd>${a ? `<button class="linklike" data-act="go" data-v="associado" data-id="${a.id}"><span class="t">${esc(l.pessoa)}</span></button>` : esc(l.pessoa)}</dd></div>` : ''}
        ${l.forma ? `<div><dt>Forma</dt><dd>${esc(l.forma)}</dd></div>` : ''}${l.documento ? `<div><dt>Documento</dt><dd>${esc(l.documento)}</dd></div>` : ''}
        ${l.reciboNum ? `<div><dt>Recibo</dt><dd class="mono">Nº ${RECIBO.fmtNum(l.reciboNum)}</dd></div>` : ''}
        <div><dt>Comprovante</dt><dd>${l.comprovanteId ? `<button class="linklike" data-act="finCompVer" data-id="${l.id}"><span class="t">${ic('clip')} ${esc(l.comprovanteNome || 'Abrir')}</span></button>` : '<span class="muted">nenhum</span>'}</dd></div>
        <div class="full"><dt>Registro</dt><dd class="small">${mens ? 'Mensalidade registrada' : 'Lançado'} por ${esc(l.registradoPor)} em ${fmtStamp(l.registradoEm)}${l.pagoEm ? ` · baixa por ${esc(l.pagoPor)} em ${fmtStamp(l.pagoEm)}` : ''}${l.atualizadoEm ? ` · alterado em ${fmtStamp(l.atualizadoEm)}` : ''}</dd></div>
      </dl>
      ${mens ? '<p class="small muted">Lançamento automático da mensalidade. Para desfazer, cancele o pagamento no cadastro do associado (administrador).</p>' : ''}
      <div class="modal-actions">
        ${!l.cancelado && l.status === 'Pendente' ? `<button class="btn primary" data-act="finPagar" data-id="${l.id}">Pagar</button>` : ''}
        ${!l.cancelado && l.tipo === 'Entrada' ? `<button class="btn" data-act="finRecibo" data-id="${l.id}">${ic('receipt')} Recibo</button>` : ''}
        ${!l.cancelado ? `<button class="btn" data-act="finCompAnexar" data-id="${l.id}">${ic('clip')} ${l.comprovanteId ? 'Trocar comprovante' : 'Anexar comprovante'}</button>` : ''}
        ${!l.cancelado ? `<button class="btn" data-act="finEditar" data-id="${l.id}">${ic('edit')} Editar</button>` : ''}
        ${!l.cancelado && !mens ? `<button class="btn danger" data-act="finCancelar" data-id="${l.id}">Cancelar lançamento</button>` : ''}
        <button class="btn" data-act="close">Fechar</button></div>`);
  },
  finPagar(t) {
    const l = finLanc(t.dataset.id);
    openModal(`<h2>Pagar conta</h2><p class="muted">${esc(l.descricao)} · vence ${fmtD(l.vencimento)}</p>
      <div class="fields"><div class="field"><label for="p-data">Pago em</label><input id="p-data" type="date" value="${TODAY()}" max="${TODAY()}"></div>
        <div class="field"><label for="p-valor">Valor pago (R$)</label><input id="p-valor" type="number" min="0.01" step="0.01" inputmode="decimal" value="${Number(l.valor).toFixed(2)}"><span class="hint">Ajuste se houve juros ou desconto.</span></div>
        <div class="field"><label for="p-conta">Saiu da conta</label><select id="p-conta">${contaOpts(l.contaId || contaPadrao(l.forma))}</select></div>
        <div class="field"><label for="p-forma">Forma</label><select id="p-forma">${formaOpts(l.forma)}</select></div>
        ${l.comprovanteId ? '' : '<div class="field full"><label for="p-arq">Comprovante (foto ou PDF)</label><input id="p-arq" type="file" accept="image/*,application/pdf"><span class="hint">Opcional.</span></div>'}</div>
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="finPagarOk" data-id="${l.id}">Confirmar pagamento</button></div>`);
  },
  finPagarOk(t) {
    const arq = $('#p-arq') && $('#p-arq').files[0];
    run(async () => {
      const prep = arq ? await prepComprovante(arq) : null;
      await api('fin.pagar', { id: t.dataset.id, data: $('#p-data').value, valor: $('#p-valor').value, contaId: $('#p-conta').value, forma: $('#p-forma').value });
      if (prep) await api('fin.comprovante', { id: t.dataset.id, ...prep }, { msg: 'Enviando comprovante…' });
      closeModal(); render(); toast('Pagamento registrado');
    });
  },
  finCancelar(t) {
    const l = finLanc(t.dataset.id);
    openModal(`<h2>Cancelar lançamento</h2><p class="muted">${esc(l.descricao)} · ${fmtBRL(l.valor)}</p>
      <div class="field"><label for="m-fmot">Motivo</label><input id="m-fmot" maxlength="300" placeholder="Ex.: lançado em duplicidade"></div>
      <p class="small muted">O lançamento continua no histórico, marcado como cancelado, e sai dos saldos e relatórios.</p>
      <div class="modal-actions"><button class="btn" data-act="close">Voltar</button><button class="btn danger" data-act="finCancelarOk" data-id="${l.id}">Cancelar lançamento</button></div>`);
  },
  finCancelarOk(t) { run(async () => { await api('fin.cancelar', { id: t.dataset.id, motivo: $('#m-fmot').value }); closeModal(); render(); toast('Lançamento cancelado'); }); },
  finCompAnexar(t) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,application/pdf';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; run(async () => { const prep = await prepComprovante(f); await api('fin.comprovante', { id: t.dataset.id, ...prep }, { msg: 'Enviando comprovante…' }); closeModal(); render(); toast('Comprovante anexado'); }); };
    inp.click();
  },
  finCompVer(t) {
    run(async () => {
      const r = await api('fin.comprovanteObter', { id: t.dataset.id }, { msg: 'Abrindo comprovante…' });
      mostrarArquivo(r, 'Comprovante');
    });
  },
  finRecibo(t) {
    run(async () => {
      const r = await api('fin.recibo', { id: t.dataset.id }, { msg: 'Gerando recibo…' });
      render(); // a lista passa a mostrar o número do recibo
      const l = finLanc(t.dataset.id), d = await dadosRecibo(l, r.extenso), a = l.assocId ? assoc(l.assocId) : null;
      UI.recibo = d;
      openModal(`<h2>Recibo nº ${RECIBO.fmtNum(d.numero)}</h2><div class="rec-preview">${RECIBO.svg(d)}</div>
        ${S.config.reciboAssina !== 'tesoureiro' && !S.assinatura ? '<div class="note warn"><span>Nenhuma assinatura cadastrada: o recibo sai com a linha em branco para assinar à mão. O administrador cadastra a assinatura em Configurações.</span></div>' : ''}
        <div class="btn-grid"><button class="btn" data-act="recImprimir">${ic('print')} Imprimir (A4, 2 vias)</button><button class="btn" data-act="recImagem">${ic('image')} Imagem para enviar</button>${a && a.telefone ? `<button class="btn" data-act="recWhats" data-tel="${esc(a.telefone)}">${ic('whats')} Avisar no WhatsApp</button>` : ''}</div>
        <div class="modal-actions"><button class="btn primary" data-act="close">Fechar</button></div>`, 'modal-wide');
    });
  },
  recImprimir() { printHTML(RECIBO.folhaA4(UI.recibo), 'print-rec', RECIBO.CSS_IMPRESSAO); },
  recImagem() {
    run(async () => {
      const d = UI.recibo; busy(true, 'Gerando imagem…');
      let blob; try { blob = await RECIBO.png(RECIBO.svg(d)); } finally { busy(false); }
      const file = new File([blob], `recibo-${RECIBO.fmtNum(d.numero)}-${slug(d.pessoa || 'associacao')}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: `Recibo nº ${RECIBO.fmtNum(d.numero)}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      baixar(blob, file.name); toast('Imagem do recibo baixada');
    });
  },
  recWhats(t) {
    const d = UI.recibo, nome = (d.pessoa || '').split(' ')[0];
    const msg = `Olá${nome ? ', ' + nome : ''}! A ${assocCfg().nome} confirma o recebimento de ${fmtBRL(d.valor)} referente a ${d.descricao} (recibo nº ${RECIBO.fmtNum(d.numero)}). Obrigado!`;
    window.open(`https://wa.me/${telWhats(t.dataset.tel)}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  },
  finCsv() { const { de, ate } = finPeriodo(); baixar(new Blob([csvTexto([FIN_CSV_CAB, ...finCsvLinhas(finLista().slice().reverse())])], { type: 'text/csv;charset=utf-8' }), `livro-caixa-${de}-a-${ate}.csv`); },
  finImprimir() {
    const { de, ate } = finPeriodo(), list = finLista().slice().reverse(), at = list.filter(l => !l.cancelado);
    const ent = r2(at.filter(l => l.tipo === 'Entrada').reduce((s, l) => s + l.valor, 0)), sai = r2(at.filter(l => l.tipo === 'Saída').reduce((s, l) => s + l.valor, 0));
    const filtros = [P.conta ? `conta ${finContaNome(P.conta)}` : '', P.tipo ? P.tipo.toLowerCase() + 's' : '', P.cat ? finCatNome(P.cat) : '', P.q ? `busca "${P.q}"` : ''].filter(Boolean).join(' · ');
    printHTML(`<div class="doc">${docCab(`Livro-caixa · ${fmtD(de)} a ${fmtD(ate)}${filtros ? ' · ' + filtros : ''}`)}
      <table class="doc-t rel doc-list"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria / conta</th><th class="num">Entrada</th><th class="num">Saída</th></tr></thead><tbody>
      ${list.map(l => `<tr class="${l.cancelado ? 'canc' : ''}"><td>${fmtD(l.data)}</td><td>${esc(l.descricao)}${pessoaExtra(l) ? ` <span class="muted">· ${esc(pessoaExtra(l))}</span>` : ''}${l.cancelado ? ' <b>(cancelado)</b>' : ''}</td>
        <td>${l.tipo === 'Transferência' ? `Transferência: ${esc(finContaNome(l.contaId))} → ${esc(finContaNome(l.contaDestinoId))}` : `${esc(finCatNome(l.categoriaId))} · ${esc(finContaNome(l.contaId))}`}</td>
        <td class="num">${l.tipo === 'Entrada' || (l.tipo === 'Transferência' && P.conta === l.contaDestinoId) ? fmtBRL(l.valor) : ''}</td><td class="num">${l.tipo === 'Saída' || (l.tipo === 'Transferência' && P.conta && P.conta === l.contaId) ? fmtBRL(l.valor) : ''}</td></tr>`).join('') || '<tr><td colspan="5">Nenhum lançamento.</td></tr>'}
      <tr class="tot"><td colspan="3">Totais (sem transferências)</td><td class="num">${fmtBRL(ent)}</td><td class="num">${fmtBRL(sai)}</td></tr></tbody></table>
      <p class="rel-res">Resultado: <b>${fmtBRL(r2(ent - sai))}</b></p></div>`, 'doc-print');
  },
  finPeriodo(t) { P.rde = t.dataset.de; P.rate = t.dataset.ate; render(); },
  relImprimir() { const de = P.rde || COMP_ATUAL() + '-01', ate = P.rate || mesFim(COMP_ATUAL()); printHTML(docRel(finRelatorio(de, ate)), 'doc-print'); },
  relCsv() {
    const de = P.rde || COMP_ATUAL() + '-01', ate = P.rate || mesFim(COMP_ATUAL()), R = finRelatorio(de, ate);
    const rows = [[`Prestação de contas ${fmtD(de)} a ${fmtD(ate)}`], [], ['Conta', 'Saldo anterior', 'Entradas', 'Saídas', 'Transferências', 'Saldo final'],
      ...R.contas.map(x => [x.c.nome, brNum(x.ant), brNum(x.ent), brNum(x.sai), brNum(x.tin - x.tout), brNum(x.fim)]), [],
      ['Entradas por categoria', 'Lançamentos', 'Total'], ...R.ent.map(x => [x.nome, x.n, brNum(x.v)]), ['Total', '', brNum(R.tEnt)], [],
      ['Saídas por categoria', 'Lançamentos', 'Total'], ...R.sai.map(x => [x.nome, x.n, brNum(x.v)]), ['Total', '', brNum(R.tSai)], [],
      ['Resultado do período', '', brNum(R.resultado)], [], FIN_CSV_CAB, ...finCsvLinhas(R.lancs)];
    baixar(new Blob([csvTexto(rows)], { type: 'text/csv;charset=utf-8' }), `prestacao-de-contas-${de}-a-${ate}.csv`);
  },
  finContaNova() { ACT.finContaForm(null); },
  finContaEditar(t) { ACT.finContaForm(finConta(t.dataset.id)); },
  finContaForm(c) {
    openModal(`<h2>${c ? 'Editar conta' : 'Nova conta'}</h2>
      <div class="fields"><div class="field full"><label for="k-nome">Nome</label><input id="k-nome" maxlength="60" value="${esc(c ? c.nome : '')}" placeholder="Ex.: Caixa da cantina, Banco do Brasil"></div>
        <div class="field"><label for="k-tipo">Tipo</label><select id="k-tipo"><option value="Caixa" ${c && c.tipo === 'Caixa' ? 'selected' : ''}>Caixa (dinheiro em espécie)</option><option value="Banco" ${c && c.tipo === 'Banco' ? 'selected' : ''}>Banco / PIX</option></select></div>
        <div class="field"><label for="k-saldo">Saldo inicial (R$)</label><input id="k-saldo" type="number" step="0.01" inputmode="decimal" value="${c ? Number(c.saldoInicial).toFixed(2) : '0.00'}"></div>
        <div class="field"><label for="k-data">Saldo do dia</label><input id="k-data" type="date" value="${c ? c.saldoInicialData : TODAY()}"><span class="hint">Lançamentos antes deste dia não mudam o saldo.</span></div>
        ${c ? `<label class="check field full"><input type="checkbox" id="k-ativa" ${c.ativa ? 'checked' : ''}> Ativa (aparece para novos lançamentos)</label>` : ''}</div>
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="finContaOk" data-id="${c ? c.id : ''}">Salvar</button></div>`);
  },
  finContaOk(t) { run(async () => { await api('fin.conta.salvar', { id: t.dataset.id || undefined, nome: $('#k-nome').value, tipo: $('#k-tipo').value, saldoInicial: String($('#k-saldo').value || '0').replace(',', '.'), saldoInicialData: $('#k-data').value, ativa: $('#k-ativa') ? $('#k-ativa').checked : true }); closeModal(); render(); toast('Conta salva'); }); },
  finCatNova(t) { ACT.finCatForm(null, t.dataset.t); },
  finCatEditar(t) { ACT.finCatForm(finCat(t.dataset.id)); },
  finCatForm(c, tipo) {
    openModal(`<h2>${c ? 'Editar categoria' : 'Nova categoria'}</h2>
      <div class="field"><label for="g-nome">Nome</label><input id="g-nome" maxlength="60" value="${esc(c ? c.nome : '')}"></div>
      <div class="field"><label for="g-tipo">Tipo</label><select id="g-tipo" ${c && c.sistema ? 'disabled' : ''}>${['Entrada', 'Saída'].map(tp => `<option ${(c ? c.tipo : tipo) === tp ? 'selected' : ''}>${tp}</option>`).join('')}</select></div>
      ${c && !c.sistema ? `<label class="check"><input type="checkbox" id="g-ativa" ${c.ativa ? 'checked' : ''}> Ativa (aparece para novos lançamentos)</label>` : ''}
      ${c && c.sistema ? '<p class="small muted">Esta categoria recebe as mensalidades automaticamente. Dá para mudar o nome.</p>' : ''}
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="finCatOk" data-id="${c ? c.id : ''}">Salvar</button></div>`);
  },
  finCatOk(t) { run(async () => { await api('fin.categoria.salvar', { id: t.dataset.id || undefined, nome: $('#g-nome').value, tipo: $('#g-tipo').value, ativa: $('#g-ativa') ? $('#g-ativa').checked : true }); closeModal(); render(); toast('Categoria salva'); }); },
});

/* ============ Ficha de inscrição e documentos: ações ============ */
Object.assign(ACT, {
  fichaImprimir(t) { closeModal(); run(() => imprimirFicha(assoc(t.dataset.id))); },
  fichaBranco() { run(() => imprimirFicha(null)); },
  fichaOferta(id) {
    const a = assoc(id); if (!a) return;
    openModal(`<h2>Associado cadastrado</h2><p class="muted">${esc(a.nome)} · matrícula ${fmtMat(a.matricula)}</p>
      <p>Imprima agora a <b>ficha de inscrição</b> e o <b>termo de uso de imagem</b> para ${ehMenor(a) ? 'o responsável legal e o associado assinarem' : 'o associado assinar'}. Depois, anexe no cadastro a ficha assinada, um documento com foto (RG, CNH ou CIN) e um comprovante de residência: sem eles a carteirinha não é emitida.</p>
      <div class="modal-actions"><button class="btn" data-act="close">Depois</button><button class="btn primary" data-act="fichaImprimir" data-id="${a.id}">${ic('print')} Imprimir ficha e termo</button></div>`);
  },
  docAnexar(t) {
    const a = assoc(t.dataset.id);
    openModal(`<h2>Anexar documento</h2><p class="muted">${esc(a.nome)} · matrícula ${fmtMat(a.matricula)}</p>
      <div class="field"><label for="d-tipo">Tipo</label><select id="d-tipo">${TIPOS_DOC.map(tp => `<option ${tp === proxDoc(a) ? 'selected' : ''}>${tp}</option>`).join('')}</select><span class="hint">Obrigatórios para a carteirinha: ficha assinada, documento com foto e comprovante de residência${ehMenor(a) ? ' (menor: pode ser certidão de nascimento + documento do responsável no lugar do documento com foto)' : ''}.</span></div>
      <div class="field"><label for="d-arq">Arquivo (foto ou PDF escaneado)</label><input id="d-arq" type="file" accept="image/*,application/pdf"><span class="hint">No celular, dá para fotografar a folha direto pela câmera. Fotos são reduzidas automaticamente; PDF até 6 MB.</span></div>
      <div class="field"><label for="d-obs">Observação</label><input id="d-obs" maxlength="300" placeholder="Opcional"></div>
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="docAnexarOk" data-id="${a.id}">Anexar</button></div>`);
  },
  docAnexarOk(t) {
    const f = $('#d-arq').files[0]; if (!f) { toast('Escolha o arquivo.', 'bad'); return; }
    const tipo = $('#d-tipo').value, obs = $('#d-obs').value;
    run(async () => {
      const prep = await prepComprovante(f, 2400, 0.85);
      await api('doc.enviar', { assocId: t.dataset.id, tipo, obs, ...prep }, { msg: 'Enviando documento…' });
      closeModal(); render(); const a = assoc(t.dataset.id); toast((tipo === DOC_FICHA ? 'Ficha assinada anexada' : 'Documento anexado') + (a && docStatus(a).completo ? ' · documentação completa' : ''));
    });
  },
  docVer(t) {
    const d = (S.documentos || []).find(x => x.id === t.dataset.id);
    run(async () => { const r = await api('doc.obter', { id: t.dataset.id }, { msg: 'Abrindo documento…' }); mostrarArquivo(r, d ? tipoDoc(d) : 'Documento'); });
  },
  docExcluir(t) {
    const d = (S.documentos || []).find(x => x.id === t.dataset.id);
    openModal(`<h2>Excluir documento</h2><p class="muted">${esc(tipoDoc(d))} · ${esc(d.nome)}</p>
      <div class="field"><label for="d-mot">Motivo</label><input id="d-mot" maxlength="300" placeholder="Ex.: arquivo errado, ilegível"></div>
      <p class="small muted">O arquivo vai para a lixeira do Drive e o registro fica no histórico.${[DOC_FICHA, DOC_FOTO, DOC_RESID, DOC_CERTIDAO, DOC_RESP].includes(tipoDoc(d)) ? ' Se não houver outro documento deste tipo, a documentação volta a ficar incompleta e a carteirinha fica bloqueada.' : ''}</p>
      <div class="modal-actions"><button class="btn" data-act="close">Voltar</button><button class="btn danger" data-act="docExcluirOk" data-id="${d.id}">Excluir</button></div>`);
  },
  isenConceder(t) {
    const a = assoc(t.dataset.id), fin = financeiro(a), meses = S.config.isencaoMeses || 6;
    openModal(`<h2>Conceder isenção de mensalidade</h2><p class="muted">${esc(a.nome)} · ${esc(catNome(a.categoriaId))} · ${fmtBRL(fin.valor)}/mês</p>
      <div class="fields"><div class="field"><label for="i-mot">Motivo</label><select id="i-mot">${MOTIVOS_ISENCAO.map(m => `<option>${m}</option>`).join('')}</select></div>
        <div class="field"><label for="i-ini">Primeiro mês isento</label><input id="i-ini" type="month" value="${COMP_ATUAL()}" max="${addMonthsComp(COMP_ATUAL(), 1)}" ${isAdmin() ? '' : `min="${addMonthsComp(COMP_ATUAL(), -3)}"`} data-ch="isenPrazo"></div>
        <div class="field"><label for="i-mes">Duração (meses)</label><input id="i-mes" type="number" min="1" max="12" value="${meses}" data-in="isenPrazo"><span class="hint" id="i-ate">Isento até ${fmtComp(addMonthsComp(COMP_ATUAL(), meses - 1))}.</span></div>
        <div class="field full"><label for="i-obs">Observação</label><input id="i-obs" maxlength="300" placeholder="Ex.: demitido em setembro; obrigatória se o motivo for Outro"></div>
        <div class="field full"><label for="i-arq">Comprovante (opcional)</label><input id="i-arq" type="file" accept="image/*,application/pdf"><span class="hint">Carteira de trabalho, termo de rescisão, atestado ou declaração. Fica nos documentos do associado.</span></div></div>
      ${fin.atraso ? `<div class="note warn"><span>${plural(fin.atraso, 'mês em atraso continua devido', 'meses em atraso continuam devidos')} (${fin.atrasadas.map(fmtComp).join(', ')}). A isenção vale do primeiro mês isento em diante.</span></div>` : ''}
      <p class="small muted">Perto do fim do prazo, o sistema avisa para renovar ou encerrar. Quando a pessoa voltar a trabalhar, use "Encerrar".</p>
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="isenConcederOk" data-id="${a.id}">Conceder isenção</button></div>`);
  },
  isenConcederOk(t) {
    const motivo = $('#i-mot').value, inicio = $('#i-ini').value, meses = $('#i-mes').value, obs = $('#i-obs').value.trim(), f = $('#i-arq').files[0];
    if (!inicio) { toast('Informe o primeiro mês isento.', 'bad'); return; }
    if (motivo === 'Outro' && !obs) { toast('Descreva o motivo em "Observação".', 'bad'); return; }
    run(async () => {
      let docId = '';
      if (f) { const prep = await prepComprovante(f, 2400, 0.85); docId = (await api('doc.enviar', { assocId: t.dataset.id, tipo: 'Comprovante para isenção', obs: `Isenção: ${motivo}`, ...prep }, { msg: 'Enviando comprovante…' })).id; }
      const r = await api('isencao.conceder', { assocId: t.dataset.id, motivo, inicio, meses, obs, docId }, { msg: 'Concedendo isenção…' });
      closeModal(); render(); toast(`Isenção concedida até ${fmtComp(r.fim)}`);
    });
  },
  isenRenovar(t) {
    const i = S.isencoes.find(x => x.id === t.dataset.id), a = assoc(i.assocId), meses = S.config.isencaoMeses || 6;
    openModal(`<h2>Renovar isenção</h2><p class="muted">${esc(a.nome)} · ${esc(isencaoTxt(i))}</p>
      <div class="fields"><div class="field"><label for="i-mes">Mais quantos meses?</label><input id="i-mes" type="number" min="1" max="12" value="${meses}" data-in="isenRenova" data-fim="${i.fim}"><span class="hint" id="i-ate">Isento até ${fmtComp(addMonthsComp(i.fim, meses))}.</span></div>
        <div class="field"><label for="i-obs">Observação</label><input id="i-obs" maxlength="300" placeholder="Ex.: continua desempregado"></div></div>
      <div class="modal-actions"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="isenRenovarOk" data-id="${i.id}">Renovar</button></div>`);
  },
  isenRenovarOk(t) { run(async () => { const r = await api('isencao.renovar', { id: t.dataset.id, meses: $('#i-mes').value, obs: $('#i-obs').value }); closeModal(); render(); toast(`Isenção renovada até ${fmtComp(r.fim)}`); }); },
  isenEncerrar(t) {
    const i = S.isencoes.find(x => x.id === t.dataset.id), a = assoc(i.assocId);
    const padrao = [addMonthsComp(i.inicio, 1), COMP_ATUAL()].sort().pop();
    openModal(`<h2>Encerrar isenção</h2><p class="muted">${esc(a.nome)} · ${esc(isencaoTxt(i))}</p>
      <div class="fields"><div class="field"><label for="i-desde">Volta a pagar a partir de</label><input id="i-desde" type="month" value="${padrao}" min="${addMonthsComp(i.inicio, 1)}" max="${addMonthsComp(i.fim, 1)}"><span class="hint">Os meses isentos antes disso continuam isentos.</span></div>
        <div class="field"><label for="i-emot">Motivo</label><input id="i-emot" maxlength="300" value="${i.motivo === 'Desemprego' ? 'Voltou a trabalhar' : ''}"></div></div>
      <div class="modal-actions"><button class="btn" data-act="close">Voltar</button><button class="btn primary" data-act="isenEncerrarOk" data-id="${i.id}">Encerrar isenção</button></div>`);
  },
  isenEncerrarOk(t) { run(async () => { await api('isencao.encerrar', { id: t.dataset.id, cobrarDesde: $('#i-desde').value, motivo: $('#i-emot').value }); closeModal(); render(); toast('Isenção encerrada'); }); },
  isenCancelar(t) {
    const i = S.isencoes.find(x => x.id === t.dataset.id), a = assoc(i.assocId);
    openModal(`<h2>Cancelar isenção</h2><p class="muted">${esc(a.nome)} · ${esc(isencaoTxt(i))}</p>
      <p class="small">Use só para isenção lançada por engano: todos os meses dela voltam a ser cobrados. Para quem voltou a trabalhar, use "Encerrar".</p>
      <div class="field"><label for="i-cmot">Motivo</label><input id="i-cmot" maxlength="300" placeholder="Ex.: lançada no associado errado"></div>
      <div class="modal-actions"><button class="btn" data-act="close">Voltar</button><button class="btn danger" data-act="isenCancelarOk" data-id="${i.id}">Cancelar isenção</button></div>`);
  },
  isenCancelarOk(t) { run(async () => { await api('isencao.cancelar', { id: t.dataset.id, motivo: $('#i-cmot').value }); closeModal(); render(); toast('Isenção cancelada'); }); },
  docExcluirOk(t) { run(async () => { await api('doc.excluir', { id: t.dataset.id, motivo: $('#d-mot').value }); closeModal(); render(); toast('Documento excluído'); }); },
});

/* ============ Formulários ============ */
function fieldErr(id, msg) { const m = $('#m-' + id); if (m) m.textContent = msg || ''; const f = m && m.closest('.field'); if (f) f.classList.toggle('err', !!msg); return !msg; }
// Preenche o endereço pelo CEP (ViaCEP; se falhar, BrasilAPI). Não apaga o que já foi digitado se o CEP não for encontrado.
async function buscarCep(cep) {
  const h = $('#m-cep-h'); if (h) h.textContent = 'Buscando o CEP…';
  const pega = async (url, conv) => { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000); try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) return null; const j = await r.json(); return j && !j.erro ? conv(j) : null; } catch (e) { return null; } finally { clearTimeout(t); } };
  const e = await pega(`https://viacep.com.br/ws/${cep}/json/`, j => ({ logradouro: j.logradouro, bairro: j.bairro, cidade: j.localidade, uf: j.uf }))
    || await pega(`https://brasilapi.com.br/api/cep/v1/${cep}`, j => ({ logradouro: j.street, bairro: j.neighborhood, cidade: j.city, uf: j.state }));
  if (digits($('#f-cep')?.value || '') !== cep) return; // o CEP mudou enquanto buscava
  if (!e) { if (h) h.textContent = 'Digite o CEP para preencher a rua, o bairro e a cidade.'; fieldErr('cep', 'CEP não encontrado. Preencha o endereço à mão.'); return; }
  [['logr', e.logradouro], ['bairro', e.bairro], ['cid', e.cidade], ['uf', e.uf]].forEach(([id, x]) => { const el = $('#f-' + id); if (el && x) el.value = x; });
  if (h) h.textContent = 'Endereço preenchido pelo CEP. Confira e informe o número.';
  const n = $('#f-num'); if (n && !n.value) n.focus();
}
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
    const menor = !!val('nasc') && idade(val('nasc')) < 18;
    ok = fieldErr('rnome', !menor || val('rnome').length >= 3 ? '' : 'Informe o responsável legal (menor de 18 anos).') && ok;
    ok = fieldErr('rcpf', !val('rcpf') || cpfValido(val('rcpf')) ? '' : 'CPF inválido.') && ok;
    ok = fieldErr('cep', !val('cep') || digits(val('cep')).length === 8 ? '' : 'CEP com 8 números.') && ok;
    ok = fieldErr('corr', !val('corr') || val('corr') <= TODAY() ? '' : 'Data no futuro.') && ok;
    if (!ok) { $('.field.err input, .field.err select')?.focus(); return; }
    const p = { nome: val('nome'), cpf: digits(val('cpf')), rg: val('rg'), nascimento: val('nasc'), telefone: val('tel'), email: val('email'), endereco: P.id && !val('logr') ? (assoc(P.id) || {}).endereco || '' : '', categoriaId: val('cat'), dataIngresso: val('ing'), situacao: val('sit'), obs: val('obs'), responsavelNome: val('rnome'), responsavelCpf: digits(val('rcpf')), responsavelParentesco: val('rpar'), responsavelEmail: val('remail'),
      nomeSocial: val('nsoc'), sexo: val('sexo'), estadoCivil: val('civil'), profissao: val('prof'), naturalidade: val('nat'),
      cep: digits(val('cep')), logradouro: val('logr'), numero: val('num'), complemento: val('comp'), bairro: val('bairro'), cidade: val('cid'), uf: val('uf'),
      emergNome: val('enome'), emergParentesco: val('epar'), emergTelefone: val('etel'), entradaCorrente: val('corr'), outroTerreiro: val('terr'), saudeObs: val('saude') };
    if (ed) { p.id = P.id; if ($('#f-mat')) p.matricula = val('mat'); }
    else if (val('mat')) p.matricula = val('mat');
    const foto = UI.foto, funs = ed ? [] : [val('funC'), val('funA')].filter(Boolean);
    run(async () => {
      try {
        const r = await api('associado.salvar', p);
        for (const fun of funs) await api('assocFuncao.adicionar', { assocId: r.assocId, funcaoId: fun, inicio: p.dataIngresso, principal: true }, { msg: 'Salvando funções…' });
        if (!ed && foto) await api('associado.foto', { assocId: r.assocId, foto: foto.foto, mini: foto.mini }, { msg: 'Enviando foto…' });
        UI.foto = null;
        toast(ed ? 'Cadastro atualizado' : `Associado cadastrado · matrícula ${fmtMat(r.matricula)}`);
        go('associado', { id: r.assocId });
        if (!ed) ACT.fichaOferta(r.assocId);
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
      await api('config.salvar', { config: { cobrancaDesde: v('c-desde'), toleranciaMeses: v('c-tol'), isencaoMeses: v('c-isen'), anosDefinitiva: v('c-anosdef'), valQtd: v('c-vq'), valUnid: v('c-vu'), valFimAno: !!$('#c-vfim')?.checked, presidenteNome: v('c-pres'), textoVerso: v('c-verso'), siteUrl: v('c-url'), reciboAssina: v('c-rass'), tesoureiroNome: v('c-tes'), cidade: v('c-cid'), fichaDeclaracao: v('c-decl'), termoImagem: ($('#c-termo')?.value || '').trim(), assoc: { nome: v('a-nome'), cnpj: digits(v('a-cnpj')), telefone: v('a-tel'), endereco: v('a-end'), email: v('a-email'), site: v('a-site') } } });
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
Object.assign(INP, {
  isenPrazo() { const ini = $('#i-ini').value, n = parseInt($('#i-mes').value, 10); const h = $('#i-ate'); if (h) h.textContent = ini && n >= 1 && n <= 12 ? `Isento até ${fmtComp(addMonthsComp(ini, n - 1))}.` : 'De 1 a 12 meses.'; },
  isenRenova(el) { const n = parseInt(el.value, 10); $('#i-ate').textContent = n >= 1 && n <= 12 ? `Isento até ${fmtComp(addMonthsComp(el.dataset.fim, n))}.` : 'De 1 a 12 meses.'; },
  cepForm(el) {
    const d = digits(el.value).slice(0, 8); el.value = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
    fieldErr('cep', '');
    if (d.length === 8 && UI.cepUlt !== d) { UI.cepUlt = d; buscarCep(d); }
  },
  cpfResp(el) { el.value = typeCPF(el.value); const d = digits(el.value); fieldErr('rcpf', d.length === 11 && !cpfValido(d) ? 'CPF inválido.' : ''); },
  finQ(el) { P.q = el.value; $('#fin-res').innerHTML = finResults(); },
});
Object.assign(CHG, {
  isenPrazo() { INP.isenPrazo(); },
  asDocs(el) { P.docs = el.value; $('#as-res').innerHTML = assocResults(); },
  nascForm(el) { const box = $('#f-resp-box'); if (box) box.hidden = !(el.value && idade(el.value) < 18) && !($('#f-rnome') && $('#f-rnome').value); },
  finDe(el) { if (el.value) { P.de = el.value; $('#fin-res').innerHTML = finResults(); } },
  finAte(el) { if (el.value) { P.ate = el.value; $('#fin-res').innerHTML = finResults(); } },
  finContaF(el) { P.conta = el.value; $('#fin-res').innerHTML = finResults(); },
  finTipoF(el) { P.tipo = el.value; $('#fin-res').innerHTML = finResults(); },
  finCatF(el) { P.cat = el.value; $('#fin-res').innerHTML = finResults(); },
  finCanc(el) { P.canc = el.checked ? '1' : ''; $('#fin-res').innerHTML = finResults(); },
  finSt() { finFormSync(); },
  relDe(el) { if (el.value) { P.rde = el.value; render(); } },
  relAte(el) { if (el.value) { P.rate = el.value; render(); } },
  opPerfil(el) { const o = S.operadores[+el.dataset.i]; run(async () => { try { await api('operador.atualizar', { email: o.email, perfil: el.value }); toast(`${o.nome}: perfil ${el.value}`); } finally { render(); } }); },
});
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
