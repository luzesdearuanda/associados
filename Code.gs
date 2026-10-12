/**
 * Associados — Associação Centro de Umbanda Luzes de Aruanda
 * API do sistema (Google Apps Script). Implantar como "App da Web":
 *   Executar como: Eu · Quem pode acessar: Qualquer pessoa
 * A segurança é feita pelo login Google (ID token) + lista de operadores na planilha.
 * As únicas ações sem login são as públicas da carteirinha (validação pelo QR Code e link pessoal).
 *
 * Primeira vez: confira CLIENT_ID abaixo e rode a função setup().
 */

const IMPLANTACAO = {
  CLIENT_ID: '465545409460-4tie71du7u0scmaldu9fkvm83v00ldqt.apps.googleusercontent.com',
  PRIMEIRO_ADMIN: 'jose.augusto.rsn@gmail.com',
  NOME_PLANILHA: 'Associados Luzes de Aruanda - Dados',
  NOME_PASTA: 'Associados Luzes de Aruanda - Fotos',
};
const APP = { nome: 'Associados Luzes de Aruanda', versao: '1.0.0' };
const MAX_FOTO = 3 * 1024 * 1024;
const MAX_MINI = 30000;      // caracteres base64 da miniatura guardada na planilha
const MAX_ASSINATURA = 45000; // caracteres base64 da assinatura (limite de célula: 50 mil)

/* ===================== Esquema das abas ===================== */
// Tipos: s = texto, n = número, b = sim/não, j = JSON
const SCHEMAS = {
  Operadores: [['email', 's'], ['nome', 's'], ['perfil', 's'], ['status', 's'], ['ultimoAcesso', 's']],
  Categorias: [['id', 's'], ['nome', 's'], ['valor', 'n'], ['ativa', 'b']],
  Funcoes: [['id', 's'], ['nome', 's'], ['tipo', 's'], ['ativa', 'b']],
  Associados: [['id', 's'], ['matricula', 'n'], ['nome', 's'], ['cpf', 's'], ['rg', 's'], ['nascimento', 's'], ['endereco', 's'], ['telefone', 's'], ['email', 's'], ['categoriaId', 's'], ['situacao', 's'], ['dataIngresso', 's'], ['fotoId', 's'], ['fotoMini', 's'], ['obs', 's'], ['dataCadastro', 's'], ['cadastradoPor', 's'], ['atualizadoEm', 's']],
  AssocFuncoes: [['id', 's'], ['assocId', 's'], ['funcaoId', 's'], ['inicio', 's'], ['fim', 's'], ['principal', 'b'], ['obs', 's']],
  Pagamentos: [['id', 's'], ['assocId', 's'], ['competencia', 's'], ['valor', 'n'], ['dataPagamento', 's'], ['forma', 's'], ['obs', 's'], ['registradoEm', 's'], ['registradoPor', 's'], ['cancelado', 'b'], ['canceladoEm', 's'], ['canceladoPor', 's'], ['motivoCancelamento', 's']],
  Carteirinhas: [['id', 's'], ['assocId', 's'], ['emitidaEm', 's'], ['validade', 's'], ['status', 's'], ['token', 's'], ['codigo', 's'], ['funcao', 's'], ['categoria', 's'], ['liberadaPor', 's'], ['justificativa', 's'], ['emitidaPor', 's'], ['canceladaEm', 's'], ['canceladaPor', 's'], ['motivo', 's'], ['enviadaEm', 's']],
  Configuracoes: [['chave', 's'], ['valor', 'j']],
  RegistroAtividades: [['ts', 's'], ['op', 's'], ['acao', 's'], ['det', 's']],
};
const KEYS = { Operadores: 'email', Configuracoes: 'chave', RegistroAtividades: null };
const keyOf_ = (name, o) => { const k = KEYS.hasOwnProperty(name) ? KEYS[name] : 'id'; return k === null ? null : typeof k === 'function' ? k(o) : o[k]; };

const SITUACOES = ['Ativo', 'Afastado', 'Desligado', 'Falecido'];
const TIPOS_FUNCAO = ['Administrativa', 'Da casa'];
const FORMAS = ['Dinheiro', 'PIX', 'Transferência', 'Cartão', 'Isenção', 'Outro'];
const CATEGORIAS_INICIAIS = [['Efetivo', 0], ['Contribuinte', 0], ['Isento', 0]];
const FUNCOES_INICIAIS = [
  ['Presidente', 'Administrativa'], ['Vice-presidente', 'Administrativa'], ['Secretário(a)', 'Administrativa'], ['Tesoureiro(a)', 'Administrativa'], ['Conselho fiscal', 'Administrativa'],
  ['Dirigente espiritual', 'Da casa'], ['Médium', 'Da casa'], ['Cambone', 'Da casa'], ['Ogã', 'Da casa'],
];
const DEFAULT_CONFIG = {
  validadeModo: 'fimAno', toleranciaMeses: 2, cobrancaDesde: '', presidenteNome: '',
  textoVerso: 'Documento pessoal e intransferível. Confira a validade pelo QR Code.',
  siteUrl: 'https://luzesdearuanda.github.io/associados/',
  assoc: { nome: 'Associação Centro de Umbanda Luzes de Aruanda', cnpj: '10999897000162', endereco: 'Rua Napoleão Mojen, 48, bairro Planaltina, Passo Fundo - RS, CEP 99062-260', telefone: '', email: '', site: 'Instagram @luzesdearuanda' },
};
const CONFIG_EDITAVEL = Object.keys(DEFAULT_CONFIG);

/* ===================== Utilidades ===================== */
const z_ = n => String(n).padStart(2, '0');
const isoLocal_ = d => `${d.getFullYear()}-${z_(d.getMonth() + 1)}-${z_(d.getDate())}`;
const today_ = () => isoLocal_(new Date());
const now_ = () => { const d = new Date(); return `${isoLocal_(d)} ${z_(d.getHours())}:${z_(d.getMinutes())}`; };
const isIso_ = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isComp_ = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));
const fmtD_ = iso => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const digits_ = s => String(s || '').replace(/\D/g, '');
const norm_ = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const str_ = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 500);
const plural_ = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const fmtMat_ = n => String(n).padStart(4, '0');
const fmtBRL_ = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const esc_ = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const emailOk_ = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));
const compOf_ = iso => String(iso || '').slice(0, 7);
function addMonthsComp_(c, n) { const [y, m] = c.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${z_(d.getMonth() + 1)}`; }
function newId_(prefix, groups) { const h = Utilities.getUuid().replace(/-/g, '').toUpperCase(); return prefix + '-' + h.slice(0, (groups || 2) * 4).match(/.{4}/g).join('-'); }
function randomStr_(n, alphabet) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now());
  let out = ''; let i = 0;
  while (out.length < n) { if (i >= bytes.length) { return out + randomStr_(n - out.length, alphabet); } out += alphabet[(bytes[i++] + 256) % alphabet.length]; }
  return out;
}
const ALFA_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O, 1/I
const ALFA_TOKEN = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function cpfValido_(c) {
  c = digits_(c); if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (b, f) => { let s = 0; for (let i = 0; i < b.length; i++) s += +b[i] * (f - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  const d1 = dv(c.slice(0, 9), 10), d2 = dv(c.slice(0, 9) + d1, 11);
  return c.slice(9) === '' + d1 + d2;
}
function cnpjValido_(c) {
  c = digits_(c); if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (b, w) => { let s = 0; for (let i = 0; i < b.length; i++) s += +b[i] * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], w2 = [6].concat(w1);
  const d1 = dv(c.slice(0, 12), w1), d2 = dv(c.slice(0, 12) + d1, w2);
  return c.slice(12) === '' + d1 + d2;
}
const maskCPF_ = c => { c = digits_(c); return c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : ''; };
const maskRG_ = r => { r = String(r || ''); return r.length > 4 ? r.slice(0, r.length - 4).replace(/[0-9A-Za-z]/g, '*') + r.slice(-4) : r; };
function err_(code, message, extra) { const e = new Error(message); e.code = code; e.extra = extra; return e; }
const fail_ = msg => { throw err_('VALIDATION', msg); };
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

/* ===================== Contexto da requisição ===================== */
let CTX = null;
function resetCtx_() { CTX = { tables: {}, changes: {}, appended: {}, db: null }; }
function db_() {
  if (!CTX.db) {
    const id = prop_('SHEET_ID');
    if (!id) throw err_('SETUP', 'O sistema ainda não foi configurado. Rode a função setup() no Apps Script.');
    CTX.db = SpreadsheetApp.openById(id);
  }
  return CTX.db;
}
function sheet_(name) { const sh = db_().getSheetByName(name); if (!sh) throw err_('SETUP', `A aba ${name} não existe. Rode setup() de novo.`); return sh; }
function dec_(v, t) {
  if (v === null || v === undefined) v = '';
  if (Object.prototype.toString.call(v) === '[object Date]') v = `${isoLocal_(v)} ${z_(v.getHours())}:${z_(v.getMinutes())}`;
  if (t === 'n') return v === '' ? 0 : Number(v);
  if (t === 'b') return v === true || v === 1 || v === '1' || String(v).toUpperCase() === 'TRUE';
  if (t === 'j') { if (v === '') return null; try { return JSON.parse(String(v)); } catch (e) { return null; } }
  return String(v);
}
function enc_(v, t) {
  if (t === 'b') return v ? '1' : '0';
  if (t === 'j') return v == null ? '' : JSON.stringify(v);
  if (t === 'n') return v === '' || v == null || isNaN(Number(v)) ? '' : String(Number(v));
  return v == null ? '' : String(v);
}
function readRows_(name, firstRow, count) {
  const sh = sheet_(name), schema = SCHEMAS[name];
  if (count <= 0) return [];
  const vals = sh.getRange(firstRow, 1, count, schema.length).getValues();
  const out = [];
  vals.forEach((r, i) => {
    if (r.every(c => c === '' || c === null)) return;
    const o = { _row: firstRow + i };
    schema.forEach(([k, t], j) => { o[k] = dec_(r[j], t); });
    out.push(o);
  });
  return out;
}
function T_(name) {
  if (!CTX.tables[name]) { const last = sheet_(name).getLastRow(); CTX.tables[name] = last < 2 ? [] : readRows_(name, 2, last - 1); }
  return CTX.tables[name];
}
function readLast_(name, n) { const last = sheet_(name).getLastRow(); if (last < 2) return []; const first = Math.max(2, last - n + 1); return readRows_(name, first, last - first + 1); }
function rowOf_(name, o) { return SCHEMAS[name].map(([k, t]) => enc_(o[k], t)); }
function track_(name, o) {
  const k = keyOf_(name, o);
  if (k === null) { (CTX.appended[name] = CTX.appended[name] || []).push(clean_(o)); return; }
  (CTX.changes[name] = CTX.changes[name] || {})[k] = o;
}
function insert_(name, o) { insertMany_(name, [o]); return o; }
function insertMany_(name, list) {
  if (!list.length) return;
  const sh = sheet_(name), width = SCHEMAS[name].length, r = sh.getLastRow() + 1;
  const falta = r + list.length - 1 - sh.getMaxRows();
  if (falta > 0) sh.insertRowsAfter(sh.getMaxRows(), falta + 200);
  const rng = sh.getRange(r, 1, list.length, width);
  rng.setNumberFormat('@');
  rng.setValues(list.map(o => rowOf_(name, o)));
  list.forEach((o, i) => { o._row = r + i; if (CTX.tables[name]) CTX.tables[name].push(o); track_(name, o); });
}
function update_(name, o) { updateMany_(name, [o]); return o; }
function updateMany_(name, list) {
  if (!list.length) return;
  const sh = sheet_(name), width = SCHEMAS[name].length;
  const sorted = list.slice().sort((a, b) => a._row - b._row);
  let i = 0;
  while (i < sorted.length) {
    let j = i; while (j + 1 < sorted.length && sorted[j + 1]._row === sorted[j]._row + 1) j++;
    const block = sorted.slice(i, j + 1);
    const rng = sh.getRange(block[0]._row, 1, block.length, width);
    rng.setNumberFormat('@'); rng.setValues(block.map(o => rowOf_(name, o)));
    i = j + 1;
  }
  list.forEach(o => track_(name, o));
}
function deleteRow_(name, o) {
  sheet_(name).deleteRow(o._row);
  const arr = T_(name), i = arr.indexOf(o); if (i >= 0) arr.splice(i, 1);
  arr.forEach(x => { if (x._row > o._row) x._row--; });
}
function clean_(o) { if (!o || typeof o !== 'object') return o; const c = {}; Object.keys(o).forEach(k => { if (k !== '_row') c[k] = o[k]; }); return c; }
function log_(me, acao, det) { insert_('RegistroAtividades', { ts: now_(), op: me ? me.email : 'sistema', acao, det: str_(det, 900) }); }
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw err_('BUSY', 'O sistema está ocupado com outra gravação. Tente de novo em alguns segundos.');
  try { CTX.tables = {}; return fn(); } finally { lock.releaseLock(); }
}

/* ===================== Configuração ===================== */
function config_() {
  const c = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  T_('Configuracoes').forEach(r => {
    if (r.chave === 'assoc') c.assoc = Object.assign({}, DEFAULT_CONFIG.assoc, r.valor || {});
    else if (CONFIG_EDITAVEL.indexOf(r.chave) >= 0) c[r.chave] = r.valor;
  });
  if (!isComp_(c.cobrancaDesde)) c.cobrancaDesde = compOf_(today_());
  return c;
}
function cfgGet_(chave, padrao) { const r = T_('Configuracoes').find(x => x.chave === chave); return r ? r.valor : padrao; }
function setConfig_(chave, valor) {
  const r = T_('Configuracoes').find(x => x.chave === chave);
  if (r) { r.valor = valor; update_('Configuracoes', r); } else insert_('Configuracoes', { chave, valor });
}
const assinatura_ = () => cfgGet_('assinatura', '') || '';

/* ===================== Autenticação ===================== */
function clientId_() { return prop_('CLIENT_ID') || IMPLANTACAO.CLIENT_ID; }
function auth_(token) {
  if (!token) throw err_('AUTH', 'Entre com Google para continuar.');
  const cache = CacheService.getScriptCache();
  const key = 'tok_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  let email = cache.get(key);
  if (!email) {
    const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw err_('AUTH', 'Sua sessão expirou. Entre com Google de novo.');
    const info = JSON.parse(r.getContentText());
    if (info.aud !== clientId_()) throw err_('AUTH', 'Login não reconhecido por este sistema.');
    if (String(info.email_verified) !== 'true') throw err_('AUTH', 'O e-mail desta conta Google não está verificado.');
    if (info.iss !== 'accounts.google.com' && info.iss !== 'https://accounts.google.com') throw err_('AUTH', 'Login não reconhecido.');
    const ttl = Math.min(21600, Number(info.exp) - Math.floor(Date.now() / 1000) - 30);
    if (ttl <= 0) throw err_('AUTH', 'Sua sessão expirou. Entre com Google de novo.');
    email = String(info.email).toLowerCase();
    cache.put(key, email, ttl);
  }
  const op = T_('Operadores').find(o => o.email.toLowerCase() === email);
  if (!op) throw err_('FORBIDDEN', `${email} entrou com Google, mas não está na lista de operadores do cadastro de associados.`, { email });
  if (op.status !== 'Ativo') throw err_('FORBIDDEN', `${email} está inativa na lista de operadores do cadastro de associados.`, { email });
  return { email, nome: op.nome, perfil: op.perfil };
}
const isAdmin_ = me => me && me.perfil === 'Admin';
function requireAdmin_(me) { if (!isAdmin_(me)) throw err_('FORBIDDEN', 'Somente o administrador pode fazer isso.'); }

/* ===================== Entrada HTTP ===================== */
function doGet() { return json_({ ok: true, app: APP.nome, versao: APP.versao }); }
function doPost(e) {
  resetCtx_();
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const pub = PUBLICO[req.action];
    const fn = pub || ACTIONS[req.action];
    if (!fn) throw err_('NOTFOUND', 'Ação desconhecida.');
    const me = pub ? null : auth_(req.token);
    const result = fn(req.payload || {}, me);
    out = { ok: true, data: { result: result === undefined ? null : result, changes: pub ? {} : collectChanges_() } };
  } catch (x) {
    const known = !!x.code;
    if (!known) console.error(x && x.stack || x);
    out = { ok: false, error: { code: x.code || 'SERVER', message: known ? x.message : 'Erro inesperado no servidor. Tente de novo; se continuar, avise o administrador.', extra: x.extra || null, detail: known ? undefined : String(x && x.message || x) } };
  }
  return json_(out);
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function collectChanges_() {
  const ch = {};
  Object.keys(CTX.changes).forEach(n => { ch[n] = Object.keys(CTX.changes[n]).map(k => clean_(CTX.changes[n][k])); });
  Object.keys(CTX.appended).forEach(n => { ch[n] = CTX.appended[n]; });
  if (ch.Configuracoes) { ch.config = config_(); ch.assinatura = assinatura_(); ch.seqMatricula = Number(cfgGet_('seqMatricula', 0)) || 0; delete ch.Configuracoes; }
  if (CTX.deleted) ch.deleted = CTX.deleted;
  return ch;
}

/* ===================== Regras de negócio ===================== */
const findBy_ = (name, k, v) => T_(name).find(o => o[k] === v);
function getAssoc_(id) { const a = findBy_('Associados', 'id', id); if (!a) throw err_('NOTFOUND', 'Associado não encontrado.'); return a; }
const categoria_ = id => findBy_('Categorias', 'id', id);
const funcao_ = id => findBy_('Funcoes', 'id', id);
function funcaoPrincipal_(assocId) {
  const af = T_('AssocFuncoes').filter(x => x.assocId === assocId && (!x.fim || x.fim >= today_()));
  const p = af.find(x => x.principal) || af[0];
  return p ? (funcao_(p.funcaoId) || {}).nome || '' : '';
}
// Mensalidades: competências devidas desde max(início da cobrança, mês de ingresso) até o mês atual.
// Só associados ativos, em categoria com valor > 0. O mês atual ainda não conta como atraso.
function situacaoFinanceira_(a, cfg) {
  cfg = cfg || config_();
  const cat = categoria_(a.categoriaId), valor = cat ? Number(cat.valor) || 0 : 0;
  const atual = compOf_(today_());
  const pagas = {};
  T_('Pagamentos').forEach(p => { if (p.assocId === a.id && !p.cancelado) pagas[p.competencia] = true; });
  const aberto = [];
  if (a.situacao === 'Ativo' && valor > 0) {
    let c = [cfg.cobrancaDesde, compOf_(a.dataIngresso) || cfg.cobrancaDesde].sort().pop();
    let guard = 0;
    while (c <= atual && guard++ < 600) { if (!pagas[c]) aberto.push(c); c = addMonthsComp_(c, 1); }
  }
  const atrasadas = aberto.filter(c => c < atual);
  return { valor, aberto, atrasadas, atraso: atrasadas.length, devido: Math.round(aberto.length * valor * 100) / 100 };
}
function validadeNova_(cfg) {
  const d = new Date();
  if (cfg.validadeModo === '12meses') { const v = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate() - 1); return isoLocal_(v); }
  return `${d.getFullYear()}-12-31`;
}
function validaAssoc_(p, selfId) {
  const o = {
    nome: str_(p.nome, 150), cpf: digits_(p.cpf), rg: str_(p.rg, 30), nascimento: str_(p.nascimento, 10), endereco: str_(p.endereco, 250),
    telefone: str_(p.telefone, 40), email: str_(p.email, 150).toLowerCase(), categoriaId: str_(p.categoriaId, 40), situacao: str_(p.situacao, 20) || 'Ativo',
    dataIngresso: str_(p.dataIngresso, 10), obs: str_(p.obs, 1000),
  };
  if (o.nome.length < 3) fail_('Informe o nome completo.');
  if (o.cpf && !cpfValido_(o.cpf)) fail_('CPF inválido. Confira os números.');
  if (o.cpf && T_('Associados').some(x => x.id !== selfId && x.cpf === o.cpf)) { const d = T_('Associados').find(x => x.id !== selfId && x.cpf === o.cpf); throw err_('DUP', `Este CPF já pertence a ${d.nome} (matrícula ${fmtMat_(d.matricula)}).`, { assocId: d.id }); }
  if (o.nascimento && (!isIso_(o.nascimento) || o.nascimento > today_() || o.nascimento < '1900-01-01')) fail_('Data de nascimento inválida.');
  if (o.email && !emailOk_(o.email)) fail_('E-mail inválido.');
  if (!categoria_(o.categoriaId)) fail_('Escolha a categoria.');
  if (SITUACOES.indexOf(o.situacao) < 0) fail_('Situação inválida.');
  if (!isIso_(o.dataIngresso) || o.dataIngresso > today_()) fail_('Informe a data de ingresso (não pode ser futura).');
  return o;
}

/* ===================== Ações públicas (sem login) ===================== */
const PUBLICO = {
  // QR Code da carteirinha: só o necessário para conferir, sem documentos nem contatos
  'publico.validar'(p) {
    const codigo = String(p.codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const c = codigo.length >= 6 ? T_('Carteirinhas').find(x => x.codigo === codigo) : null;
    const cfg = config_();
    if (!c) return { encontrada: false, assocNome: cfg.assoc.nome };
    const a = findBy_('Associados', 'id', c.assocId) || {};
    const hoje = today_();
    let motivo = '';
    if (c.status === 'Substituída') motivo = 'Esta carteirinha foi substituída por uma emissão mais nova.';
    else if (c.status === 'Cancelada') motivo = 'Esta carteirinha foi cancelada.';
    else if (c.validade < hoje) motivo = `Carteirinha vencida em ${fmtD_(c.validade)}.`;
    else if (a.situacao !== 'Ativo') motivo = `Associado com situação "${a.situacao}".`;
    return {
      encontrada: true, valida: !motivo, motivo, status: c.status, validade: c.validade, emitidaEm: c.emitidaEm,
      nome: a.nome || '', matricula: a.matricula || 0, situacao: a.situacao || '', funcao: c.funcao, foto: a.fotoMini || '', assocNome: cfg.assoc.nome,
    };
  },
  // Link pessoal: a carteirinha atual, sempre com os dados do momento (CPF e RG parcialmente ocultos)
  'publico.carteirinha'(p) {
    const token = String(p.token || '');
    const c = token.length >= 20 ? T_('Carteirinhas').find(x => x.token === token) : null;
    if (!c) throw err_('NOTFOUND', 'Link de carteirinha não encontrado. Peça um novo link à secretaria.');
    if (c.status !== 'Ativa') throw err_('NOTFOUND', c.status === 'Substituída' ? 'Este link é de uma carteirinha que já foi substituída. Peça o link novo à secretaria.' : 'Esta carteirinha foi cancelada.');
    const a = getAssoc_(c.assocId), cfg = config_();
    let foto = '';
    if (a.fotoId) { try { foto = Utilities.base64Encode(DriveApp.getFileById(a.fotoId).getBlob().getBytes()); } catch (e) { foto = a.fotoMini || ''; } }
    return {
      carteirinha: { id: c.id, codigo: c.codigo, validade: c.validade, emitidaEm: c.emitidaEm, funcao: funcaoPrincipal_(a.id) || c.funcao, categoria: (categoria_(a.categoriaId) || {}).nome || c.categoria },
      associado: { nome: a.nome, matricula: a.matricula, cpf: maskCPF_(a.cpf), rg: maskRG_(a.rg), dataIngresso: a.dataIngresso, situacao: a.situacao, foto },
      config: { assoc: cfg.assoc, presidenteNome: cfg.presidenteNome, textoVerso: cfg.textoVerso, siteUrl: cfg.siteUrl }, assinatura: assinatura_(),
      vencida: c.validade < today_(),
    };
  },
};

/* ===================== Ações (com login) ===================== */
const ACTIONS = {
  bootstrap(p, me) {
    const op = T_('Operadores').find(o => o.email.toLowerCase() === me.email);
    if (op) { op.ultimoAcesso = now_(); update_('Operadores', op); }
    CTX.changes = {};
    return {
      me, app: APP, config: config_(), assinatura: assinatura_(), seqMatricula: Number(cfgGet_('seqMatricula', 0)) || 0,
      operadores: T_('Operadores').map(clean_), categorias: T_('Categorias').map(clean_), funcoes: T_('Funcoes').map(clean_),
      associados: T_('Associados').map(clean_), assocFuncoes: T_('AssocFuncoes').map(clean_), pagamentos: T_('Pagamentos').map(clean_),
      carteirinhas: T_('Carteirinhas').map(clean_), atividades: readLast_('RegistroAtividades', 300).reverse().map(clean_),
    };
  },

  /* ---- Associados ---- */
  'associado.salvar'(p, me) {
    return withLock_(() => {
      if (p.id) {
        const a = getAssoc_(p.id), o = validaAssoc_(p, a.id);
        if (p.matricula !== undefined && Number(p.matricula) !== a.matricula) {
          requireAdmin_(me);
          const m = parseInt(p.matricula, 10);
          if (!(m >= 1 && m <= 999999)) fail_('Matrícula inválida.');
          if (T_('Associados').some(x => x.id !== a.id && x.matricula === m)) fail_(`A matrícula ${fmtMat_(m)} já está em uso.`);
          o.matricula = m;
          if (m > (Number(cfgGet_('seqMatricula', 0)) || 0)) setConfig_('seqMatricula', m);
        }
        const antes = a.situacao;
        Object.assign(a, o, { atualizadoEm: now_() }); update_('Associados', a);
        log_(me, 'Edição de associado', `${fmtMat_(a.matricula)} ${a.nome}${antes !== a.situacao ? ` · situação ${antes} → ${a.situacao}` : ''}`);
        return { assocId: a.id };
      }
      const o = validaAssoc_(p, null);
      let mat;
      if (p.matricula !== undefined && p.matricula !== '' && p.matricula !== null) {
        mat = parseInt(p.matricula, 10);
        if (!(mat >= 1 && mat <= 999999)) fail_('Matrícula inválida.');
        if (T_('Associados').some(x => x.matricula === mat)) fail_(`A matrícula ${fmtMat_(mat)} já está em uso.`);
      } else {
        const usadas = T_('Associados').map(x => x.matricula);
        mat = Math.max(Number(cfgGet_('seqMatricula', 0)) || 0, usadas.length ? Math.max.apply(null, usadas) : 0) + 1;
      }
      if (mat > (Number(cfgGet_('seqMatricula', 0)) || 0)) setConfig_('seqMatricula', mat);
      const a = Object.assign({ id: newId_('ASC', 3), matricula: mat, fotoId: '', fotoMini: '', dataCadastro: today_(), cadastradoPor: me.email, atualizadoEm: now_() }, o);
      insert_('Associados', a);
      log_(me, 'Novo associado', `${fmtMat_(mat)} ${a.nome}`);
      return { assocId: a.id, matricula: mat };
    });
  },
  'associado.foto'(p, me) {
    const foto = String(p.foto || ''), mini = String(p.mini || '');
    const bytes = foto ? Utilities.base64Decode(foto) : [];
    if (!bytes.length) fail_('Foto vazia.');
    if (bytes.length > MAX_FOTO) fail_('Foto maior que 3 MB.');
    if (!mini || mini.length > MAX_MINI) fail_('Miniatura da foto inválida.');
    return withLock_(() => {
      const a = getAssoc_(p.assocId);
      const file = pasta_().createFile(Utilities.newBlob(bytes, 'image/jpeg', `${fmtMat_(a.matricula)} - ${a.nome}.jpg`));
      if (a.fotoId) { try { DriveApp.getFileById(a.fotoId).setTrashed(true); } catch (e) { } }
      a.fotoId = file.getId(); a.fotoMini = mini; a.atualizadoEm = now_(); update_('Associados', a);
      log_(me, 'Foto do associado', `${fmtMat_(a.matricula)} ${a.nome}`);
      return { assocId: a.id };
    });
  },
  'associado.fotoObter'(p) {
    const a = getAssoc_(p.assocId);
    if (!a.fotoId) return { foto: a.fotoMini || '' };
    try { return { foto: Utilities.base64Encode(DriveApp.getFileById(a.fotoId).getBlob().getBytes()) }; } catch (e) { return { foto: a.fotoMini || '' }; }
  },

  /* ---- Funções do associado ---- */
  'assocFuncao.adicionar'(p, me) {
    return withLock_(() => {
      const a = getAssoc_(p.assocId), f = funcao_(p.funcaoId);
      if (!f || !f.ativa) fail_('Escolha uma função ativa da lista.');
      const inicio = str_(p.inicio, 10) || today_();
      if (!isIso_(inicio)) fail_('Data de início inválida.');
      const atuais = T_('AssocFuncoes').filter(x => x.assocId === a.id && (!x.fim || x.fim >= today_()));
      if (atuais.some(x => x.funcaoId === f.id)) fail_(`${a.nome} já exerce a função ${f.nome}.`);
      const principal = !!p.principal || !atuais.length;
      if (principal) { const prev = atuais.filter(x => x.principal); prev.forEach(x => { x.principal = false; }); updateMany_('AssocFuncoes', prev); }
      const af = { id: newId_('FNA', 3), assocId: a.id, funcaoId: f.id, inicio, fim: '', principal, obs: str_(p.obs, 300) };
      insert_('AssocFuncoes', af);
      log_(me, 'Função atribuída', `${a.nome} · ${f.nome} desde ${fmtD_(inicio)}`);
      return { id: af.id };
    });
  },
  'assocFuncao.encerrar'(p, me) {
    return withLock_(() => {
      const af = findBy_('AssocFuncoes', 'id', p.id); if (!af) throw err_('NOTFOUND', 'Função não encontrada.');
      const fim = str_(p.fim, 10) || today_();
      if (!isIso_(fim) || fim < af.inicio) fail_('A data de término deve ser igual ou posterior ao início.');
      af.fim = fim; const eraPrincipal = af.principal; af.principal = false; update_('AssocFuncoes', af);
      if (eraPrincipal) {
        const outra = T_('AssocFuncoes').find(x => x.assocId === af.assocId && x.id !== af.id && (!x.fim || x.fim >= today_()));
        if (outra) { outra.principal = true; update_('AssocFuncoes', outra); }
      }
      const a = getAssoc_(af.assocId);
      log_(me, 'Função encerrada', `${a.nome} · ${(funcao_(af.funcaoId) || {}).nome} até ${fmtD_(fim)}`);
    });
  },
  'assocFuncao.principal'(p, me) {
    return withLock_(() => {
      const af = findBy_('AssocFuncoes', 'id', p.id); if (!af) throw err_('NOTFOUND', 'Função não encontrada.');
      if (af.fim && af.fim < today_()) fail_('Esta função já foi encerrada.');
      const outras = T_('AssocFuncoes').filter(x => x.assocId === af.assocId && x.principal && x.id !== af.id);
      outras.forEach(x => { x.principal = false; }); af.principal = true;
      updateMany_('AssocFuncoes', outras.concat([af]));
      log_(me, 'Função principal', `${getAssoc_(af.assocId).nome} · ${(funcao_(af.funcaoId) || {}).nome}`);
    });
  },
  'assocFuncao.excluir'(p, me) {
    return withLock_(() => {
      const af = findBy_('AssocFuncoes', 'id', p.id); if (!af) throw err_('NOTFOUND', 'Função não encontrada.');
      const nome = (funcao_(af.funcaoId) || {}).nome, a = getAssoc_(af.assocId);
      deleteRow_('AssocFuncoes', af);
      (CTX.deleted = CTX.deleted || []).push({ tabela: 'AssocFuncoes', id: af.id });
      log_(me, 'Função removida (lançamento errado)', `${a.nome} · ${nome}`);
    });
  },

  /* ---- Mensalidades ---- */
  'pagamento.registrar'(p, me) {
    return withLock_(() => {
      const a = getAssoc_(p.assocId);
      const comps = (Array.isArray(p.competencias) ? p.competencias : []).map(String).filter(isComp_);
      if (!comps.length) fail_('Escolha ao menos um mês.');
      if (comps.length > 24) fail_('No máximo 24 meses por lançamento.');
      const unicas = comps.filter((c, i) => comps.indexOf(c) === i).sort();
      const limite = addMonthsComp_(compOf_(today_()), 12);
      if (unicas.some(c => c > limite)) fail_('Só é possível adiantar até 12 meses.');
      const forma = FORMAS.indexOf(p.forma) >= 0 ? p.forma : 'Outro';
      const dataPagamento = str_(p.dataPagamento, 10) || today_();
      if (!isIso_(dataPagamento) || dataPagamento > today_()) fail_('Data do pagamento inválida.');
      const total = forma === 'Isenção' ? 0 : Number(p.valorTotal);
      if (isNaN(total) || total < 0) fail_('Valor inválido.');
      const ja = T_('Pagamentos').filter(x => x.assocId === a.id && !x.cancelado && unicas.indexOf(x.competencia) >= 0).map(x => x.competencia);
      if (ja.length) fail_(`Já existe pagamento para ${ja.map(c => c.split('-').reverse().join('/')).join(', ')}.`);
      const cada = Math.round(total / unicas.length * 100) / 100;
      const ts = now_();
      const rows = unicas.map((c, i) => ({
        id: newId_('PAG', 3), assocId: a.id, competencia: c, valor: i === unicas.length - 1 ? Math.round((total - cada * (unicas.length - 1)) * 100) / 100 : cada,
        dataPagamento, forma, obs: str_(p.obs, 300), registradoEm: ts, registradoPor: me.email, cancelado: false, canceladoEm: '', canceladoPor: '', motivoCancelamento: '',
      }));
      insertMany_('Pagamentos', rows);
      log_(me, forma === 'Isenção' ? 'Isenção de mensalidade' : 'Mensalidade registrada', `${fmtMat_(a.matricula)} ${a.nome} · ${unicas.map(c => c.split('-').reverse().join('/')).join(', ')} · ${fmtBRL_(total)} (${forma})`);
      return { ids: rows.map(r => r.id) };
    });
  },
  'pagamento.cancelar'(p, me) {
    requireAdmin_(me);
    return withLock_(() => {
      const pg = findBy_('Pagamentos', 'id', p.id); if (!pg) throw err_('NOTFOUND', 'Pagamento não encontrado.');
      if (pg.cancelado) fail_('Este pagamento já foi cancelado.');
      const motivo = str_(p.motivo, 300); if (!motivo) fail_('Informe o motivo do cancelamento.');
      Object.assign(pg, { cancelado: true, canceladoEm: now_(), canceladoPor: me.email, motivoCancelamento: motivo }); update_('Pagamentos', pg);
      const a = getAssoc_(pg.assocId);
      log_(me, 'Pagamento cancelado', `${a.nome} · ${pg.competencia.split('-').reverse().join('/')} · ${fmtBRL_(pg.valor)} · ${motivo}`);
    });
  },

  /* ---- Carteirinhas ---- */
  'carteirinha.emitir'(p, me) {
    return withLock_(() => {
      const a = getAssoc_(p.assocId), cfg = config_();
      if (a.situacao !== 'Ativo') fail_(`Só é possível emitir carteirinha para associado ativo. Situação atual: ${a.situacao}.`);
      const fin = situacaoFinanceira_(a, cfg);
      let liberadaPor = '', justificativa = '';
      if (fin.atraso > cfg.toleranciaMeses) {
        if (!p.liberar) throw err_('ATRASO', `${a.nome} tem ${plural_(fin.atraso, 'mensalidade atrasada', 'mensalidades atrasadas')} (tolerância: ${cfg.toleranciaMeses}).`, { atraso: fin.atraso, atrasadas: fin.atrasadas });
        requireAdmin_(me);
        justificativa = str_(p.justificativa, 300);
        if (!justificativa) fail_('Informe o motivo da liberação.');
        liberadaPor = me.email;
      }
      const ts = now_();
      const ativas = T_('Carteirinhas').filter(x => x.assocId === a.id && x.status === 'Ativa');
      ativas.forEach(x => { x.status = 'Substituída'; });
      updateMany_('Carteirinhas', ativas);
      let codigo; do { codigo = randomStr_(8, ALFA_CODIGO); } while (T_('Carteirinhas').some(x => x.codigo === codigo));
      const c = {
        id: newId_('CRT', 3), assocId: a.id, emitidaEm: ts, validade: validadeNova_(cfg), status: 'Ativa', token: randomStr_(32, ALFA_TOKEN), codigo,
        funcao: funcaoPrincipal_(a.id), categoria: (categoria_(a.categoriaId) || {}).nome || '', liberadaPor, justificativa, emitidaPor: me.email,
        canceladaEm: '', canceladaPor: '', motivo: '', enviadaEm: '',
      };
      insert_('Carteirinhas', c);
      log_(me, ativas.length ? 'Carteirinha renovada' : 'Carteirinha emitida', `${fmtMat_(a.matricula)} ${a.nome} · válida até ${fmtD_(c.validade)}${liberadaPor ? ` · liberada com ${plural_(fin.atraso, 'mês', 'meses')} em atraso: ${justificativa}` : ''}`);
      return { id: c.id };
    });
  },
  'carteirinha.cancelar'(p, me) {
    return withLock_(() => {
      const c = findBy_('Carteirinhas', 'id', p.id); if (!c) throw err_('NOTFOUND', 'Carteirinha não encontrada.');
      if (c.status !== 'Ativa') fail_('Esta carteirinha não está ativa.');
      const motivo = str_(p.motivo, 300); if (!motivo) fail_('Informe o motivo (ex.: perda, dados errados).');
      Object.assign(c, { status: 'Cancelada', canceladaEm: now_(), canceladaPor: me.email, motivo }); update_('Carteirinhas', c);
      log_(me, 'Carteirinha cancelada', `${getAssoc_(c.assocId).nome} · ${motivo}`);
    });
  },
  'carteirinha.email'(p, me) {
    const c = findBy_('Carteirinhas', 'id', p.id); if (!c) throw err_('NOTFOUND', 'Carteirinha não encontrada.');
    if (c.status !== 'Ativa') fail_('Só é possível enviar a carteirinha ativa.');
    const a = getAssoc_(c.assocId), cfg = config_();
    if (!emailOk_(a.email)) fail_(`${a.nome} não tem e-mail cadastrado.`);
    const link = cfg.siteUrl.replace(/\/?$/, '/') + 'carteirinha.html?t=' + c.token;
    const anexos = [];
    ['frente', 'verso'].forEach(lado => {
      const b64 = p.imagens && p.imagens[lado];
      if (b64) { const bytes = Utilities.base64Decode(String(b64)); if (bytes.length && bytes.length < 4 * 1024 * 1024) anexos.push(Utilities.newBlob(bytes, 'image/png', `carteirinha-${lado}.png`)); }
    });
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.5">
      <p>Olá, ${esc_(a.nome.split(' ')[0])}!</p>
      <p>Sua carteirinha de associado(a) da <b>${esc_(cfg.assoc.nome)}</b> está pronta. Ela é válida até <b>${fmtD_(c.validade)}</b>.</p>
      <p><a href="${esc_(link)}" style="display:inline-block;background:#1C3557;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Abrir minha carteirinha</a></p>
      <p style="font-size:13px;color:#555">Guarde este link: ele mostra sempre a carteirinha atualizada. Não compartilhe com outras pessoas.${anexos.length ? ' A imagem da carteirinha também vai em anexo.' : ''}</p>
      <p style="font-size:12px;color:#777">${esc_(cfg.assoc.nome)}</p></div>`;
    try { MailApp.sendEmail({ to: a.email, subject: `Sua carteirinha de associado(a) - ${cfg.assoc.nome}`, htmlBody: html, name: cfg.assoc.nome, attachments: anexos }); }
    catch (e) { throw err_('MAIL', `Não foi possível enviar o e-mail para ${a.email}: ${String(e && e.message || e)}. Confira o endereço ou envie o link pelo WhatsApp.`); }
    return withLock_(() => {
      const cc = findBy_('Carteirinhas', 'id', p.id); cc.enviadaEm = now_(); update_('Carteirinhas', cc);
      log_(me, 'Carteirinha enviada por e-mail', `${a.nome} · ${a.email}`);
      return { enviadaEm: cc.enviadaEm };
    });
  },

  /* ---- Tabelas auxiliares ---- */
  'funcao.salvar'(p, me) {
    requireAdmin_(me);
    return withLock_(() => {
      const nome = str_(p.nome, 80), tipo = TIPOS_FUNCAO.indexOf(p.tipo) >= 0 ? p.tipo : '';
      if (!nome) fail_('Informe o nome da função.');
      if (!tipo) fail_('Escolha o tipo da função.');
      if (T_('Funcoes').some(f => f.id !== p.id && norm_(f.nome) === norm_(nome))) fail_('Já existe uma função com este nome.');
      if (p.id) {
        const f = funcao_(p.id); if (!f) throw err_('NOTFOUND', 'Função não encontrada.');
        Object.assign(f, { nome, tipo, ativa: p.ativa !== false }); update_('Funcoes', f);
        log_(me, 'Função alterada', `${nome} (${tipo})${f.ativa ? '' : ' · inativa'}`);
        return { id: f.id };
      }
      const f = { id: newId_('FUN', 2), nome, tipo, ativa: true }; insert_('Funcoes', f);
      log_(me, 'Nova função', `${nome} (${tipo})`);
      return { id: f.id };
    });
  },
  'categoria.salvar'(p, me) {
    requireAdmin_(me);
    return withLock_(() => {
      const nome = str_(p.nome, 60), valor = Math.round(Number(p.valor) * 100) / 100;
      if (!nome) fail_('Informe o nome da categoria.');
      if (isNaN(valor) || valor < 0 || valor > 100000) fail_('Valor da mensalidade inválido.');
      if (T_('Categorias').some(c => c.id !== p.id && norm_(c.nome) === norm_(nome))) fail_('Já existe uma categoria com este nome.');
      if (p.id) {
        const c = categoria_(p.id); if (!c) throw err_('NOTFOUND', 'Categoria não encontrada.');
        if (p.ativa === false && T_('Associados').some(a => a.categoriaId === c.id && a.situacao === 'Ativo')) fail_('Há associados ativos nesta categoria. Mude a categoria deles antes de desativá-la.');
        Object.assign(c, { nome, valor, ativa: p.ativa !== false }); update_('Categorias', c);
        log_(me, 'Categoria alterada', `${nome} · ${fmtBRL_(valor)}${c.ativa ? '' : ' · inativa'}`);
        return { id: c.id };
      }
      const c = { id: newId_('CAT', 2), nome, valor, ativa: true }; insert_('Categorias', c);
      log_(me, 'Nova categoria', `${nome} · ${fmtBRL_(valor)}`);
      return { id: c.id };
    });
  },
  'config.salvar'(p, me) {
    requireAdmin_(me);
    return withLock_(() => {
      const c = p.config || {}, cur = config_();
      const novo = {
        validadeModo: c.validadeModo === '12meses' ? '12meses' : 'fimAno',
        toleranciaMeses: isNaN(parseInt(c.toleranciaMeses, 10)) ? cur.toleranciaMeses : Math.min(24, Math.max(0, parseInt(c.toleranciaMeses, 10))),
        cobrancaDesde: isComp_(c.cobrancaDesde) ? c.cobrancaDesde : cur.cobrancaDesde,
        presidenteNome: str_(c.presidenteNome, 100), textoVerso: str_(c.textoVerso, 200) || DEFAULT_CONFIG.textoVerso,
        siteUrl: /^https:\/\/[^\s]+$/.test(String(c.siteUrl || '')) ? String(c.siteUrl).trim() : cur.siteUrl,
      };
      const a = c.assoc || {};
      if (a.cnpj && !cnpjValido_(a.cnpj)) fail_('CNPJ inválido.');
      if (a.email && !emailOk_(a.email)) fail_('E-mail da associação inválido.');
      novo.assoc = { nome: str_(a.nome, 150) || DEFAULT_CONFIG.assoc.nome, cnpj: digits_(a.cnpj), endereco: str_(a.endereco, 250), telefone: str_(a.telefone, 40), email: str_(a.email, 150), site: str_(a.site, 120) };
      CONFIG_EDITAVEL.forEach(k => { if (JSON.stringify(novo[k]) !== JSON.stringify(cur[k])) setConfig_(k, novo[k]); });
      log_(me, 'Configurações', 'Regras atualizadas');
    });
  },
  'config.assinatura'(p, me) {
    requireAdmin_(me);
    const img = String(p.imagem || '');
    if (img && (img.length > MAX_ASSINATURA || !/^[A-Za-z0-9+/=]+$/.test(img))) fail_('Imagem da assinatura muito grande. Use uma imagem menor (até ~30 KB).');
    return withLock_(() => { setConfig_('assinatura', img); log_(me, 'Assinatura do presidente', img ? 'Atualizada' : 'Removida'); });
  },
  'operador.salvar'(p, me) {
    requireAdmin_(me);
    return withLock_(() => {
      const email = str_(p.email, 150).toLowerCase(), nome = str_(p.nome, 100);
      if (!emailOk_(email)) fail_('Informe um e-mail válido.');
      if (!nome) fail_('Informe o nome.');
      if (T_('Operadores').some(o => o.email.toLowerCase() === email)) fail_('Este e-mail já está na lista.');
      insert_('Operadores', { email, nome, perfil: p.perfil === 'Admin' ? 'Admin' : 'Operador', status: 'Ativo', ultimoAcesso: '' });
      log_(me, 'Novo operador', `${email} (${p.perfil === 'Admin' ? 'Admin' : 'Operador'})`);
    });
  },
  'operador.atualizar'(p, me) {
    requireAdmin_(me);
    return withLock_(() => {
      const o = T_('Operadores').find(x => x.email.toLowerCase() === String(p.email || '').toLowerCase()); if (!o) throw err_('NOTFOUND', 'Operador não encontrado.');
      if (o.email.toLowerCase() === me.email) fail_('Você não pode alterar o seu próprio acesso.');
      const perfil = p.perfil || o.perfil, status = p.status || o.status;
      const adminsAtivos = T_('Operadores').filter(x => x !== o && x.perfil === 'Admin' && x.status === 'Ativo').length + (perfil === 'Admin' && status === 'Ativo' ? 1 : 0);
      if (!adminsAtivos) fail_('Precisa existir ao menos um admin ativo.');
      o.perfil = perfil === 'Admin' ? 'Admin' : 'Operador'; o.status = status === 'Ativo' ? 'Ativo' : 'Inativo';
      update_('Operadores', o); log_(me, 'Operador atualizado', `${o.email} → ${o.perfil}, ${o.status}`);
    });
  },
};

/* ===================== Implantação ===================== */
function pasta_() {
  const id = prop_('DRIVE_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  const f = DriveApp.createFolder(IMPLANTACAO.NOME_PASTA);
  PropertiesService.getScriptProperties().setProperty('DRIVE_FOLDER_ID', f.getId());
  return f;
}
/** Rode uma vez no editor do Apps Script (menu Executar). Pode rodar de novo sem perder dados. */
function setup() {
  resetCtx_();
  const props = PropertiesService.getScriptProperties();
  let ss, id = props.getProperty('SHEET_ID');
  if (id) ss = SpreadsheetApp.openById(id);
  else { ss = SpreadsheetApp.create(IMPLANTACAO.NOME_PLANILHA); props.setProperty('SHEET_ID', ss.getId()); }
  CTX.db = ss;
  Object.keys(SCHEMAS).forEach(name => {
    let sh = ss.getSheetByName(name); if (!sh) sh = ss.insertSheet(name);
    const heads = SCHEMAS[name].map(c => c[0]);
    sh.getRange(1, 1, sh.getMaxRows(), heads.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, heads.length).setValues([heads]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  ss.getSheets().forEach(sh => { if (!SCHEMAS[sh.getName()] && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh); });
  pasta_();
  if (!T_('Categorias').length) insertMany_('Categorias', CATEGORIAS_INICIAIS.map(([nome, valor]) => ({ id: newId_('CAT', 2), nome, valor, ativa: true })));
  if (!T_('Funcoes').length) insertMany_('Funcoes', FUNCOES_INICIAIS.map(([nome, tipo]) => ({ id: newId_('FUN', 2), nome, tipo, ativa: true })));
  const cfgRows = T_('Configuracoes');
  CONFIG_EDITAVEL.forEach(k => {
    if (cfgRows.some(r => r.chave === k)) return;
    insert_('Configuracoes', { chave: k, valor: k === 'cobrancaDesde' ? compOf_(today_()) : DEFAULT_CONFIG[k] });
  });
  if (!cfgRows.some(r => r.chave === 'seqMatricula')) insert_('Configuracoes', { chave: 'seqMatricula', valor: 0 });
  if (!cfgRows.some(r => r.chave === 'assinatura')) insert_('Configuracoes', { chave: 'assinatura', valor: '' });
  if (!T_('Operadores').length) insert_('Operadores', { email: IMPLANTACAO.PRIMEIRO_ADMIN.toLowerCase(), nome: 'José Augusto', perfil: 'Admin', status: 'Ativo', ultimoAcesso: '' });
  log_({ email: 'setup' }, 'Setup', 'Estrutura conferida');
  const msg = [
    'Setup concluído.',
    'Planilha: ' + ss.getUrl(),
    'Pasta das fotos: ' + pasta_().getUrl(),
    'Client ID configurado: ' + (clientId_().indexOf('COLE_AQUI') === 0 ? 'NÃO (preencha IMPLANTACAO.CLIENT_ID)' : 'sim'),
  ].join('\n');
  Logger.log(msg);
  return msg;
}
