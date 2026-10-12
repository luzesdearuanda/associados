/* Carteirinha de associado(a): desenho da frente e do verso em SVG no tamanho de cartão de crédito (85,6 × 54 mm).
   O mesmo desenho serve para a tela, a impressão (A4 ou cartão PVC), a imagem PNG e as páginas públicas.
   Unidades do desenho: décimos de milímetro (856 × 540). Requer qrcode.js (Kazuhiko Arase, licença MIT). */
'use strict';
(function () {
  const W = 856, H = 540;
  const COR = { navy: '#1C3557', verde: '#2D7A38', ouro: '#C08623', texto: '#16241B', cinza: '#58695F', linha: '#D6E0D7', fundo: '#FFFFFF', claro: '#F3F6F2' };
  const FONTE = 'Arial, Helvetica, sans-serif';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtD = iso => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
  const fmtMat = n => String(n || 0).padStart(4, '0');
  const fmtCod = c => String(c || '').replace(/^(.{4})(.{4})$/, '$1-$2');

  // Medição de texto (mesma fonte do SVG) para quebrar e reduzir nomes longos
  let ctx = null;
  function largura(txt, px, bold) {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${bold ? 'bold ' : ''}${px}px ${FONTE}`;
    return ctx.measureText(txt).width;
  }
  // Devolve { linhas, px } cabendo em maxW, com até maxLinhas
  function ajustar(txt, maxW, pxMax, pxMin, maxLinhas, bold) {
    txt = String(txt || '').trim().replace(/\s+/g, ' ');
    for (let px = pxMax; px >= pxMin; px -= 1) {
      if (largura(txt, px, bold) <= maxW) return { linhas: [txt], px };
      if (maxLinhas > 1) {
        // quebra equilibrada: escolhe o ponto em que a linha mais longa fica mais curta
        const pal = txt.split(' '); let melhor = null;
        for (let i = 1; i < pal.length; i++) {
          const l1 = pal.slice(0, i).join(' '), l2 = pal.slice(i).join(' '), w = Math.max(largura(l1, px, bold), largura(l2, px, bold));
          if (w <= maxW && (!melhor || w < melhor.w)) melhor = { w, linhas: [l1, l2] };
        }
        if (melhor) return { linhas: melhor.linhas, px };
      }
    }
    // último recurso: corta com reticências
    let t = txt; while (t.length > 3 && largura(t + '…', pxMin, bold) > maxW) t = t.slice(0, -1);
    return { linhas: [t + (t === txt ? '' : '…')], px: pxMin };
  }
  function texto(x, y, linhas, px, opt = {}) {
    const lh = opt.lh || Math.round(px * 1.15);
    return linhas.map((l, i) => `<text x="${x}" y="${y + i * lh}" font-family="${FONTE}" font-size="${px}" ${opt.bold ? 'font-weight="700"' : ''} fill="${opt.cor || COR.texto}" ${opt.anchor ? `text-anchor="${opt.anchor}"` : ''} ${opt.ls ? `letter-spacing="${opt.ls}"` : ''}>${esc(l)}</text>`).join('');
  }
  const rotulo = (x, y, t) => texto(x, y, [t.toUpperCase()], 15, { cor: COR.cinza, bold: true, ls: 1.5 });
  const mime = b64 => /^iVBOR/.test(b64 || '') ? 'image/png' : 'image/jpeg';
  const dataUrl = b64 => !b64 ? '' : /^data:/.test(b64) ? b64 : `data:${mime(b64)};base64,${b64}`;

  function qrPath(conteudo, x, y, tam) {
    if (typeof qrcode !== 'function') return `<rect x="${x}" y="${y}" width="${tam}" height="${tam}" fill="${COR.claro}"/>`;
    const q = qrcode(0, 'M'); q.addData(conteudo); q.make();
    const n = q.getModuleCount(), m = tam / (n + 4); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${(x + (c + 2) * m).toFixed(2)} ${(y + (r + 2) * m).toFixed(2)}h${m.toFixed(2)}v${m.toFixed(2)}h-${m.toFixed(2)}z`;
    return `<rect x="${x}" y="${y}" width="${tam}" height="${tam}" fill="#fff"/><path d="${d}" fill="#000" shape-rendering="crispEdges"/>`;
  }
  function validarUrl(siteUrl, codigo) { return String(siteUrl || '').replace(/\/?$/, '/') + 'validar.html?c=' + encodeURIComponent(codigo || ''); }
  function nomeAssoc(nome) {
    // "Associação Centro de Umbanda Luzes de Aruanda" → duas linhas equilibradas
    return ajustar(nome || 'Associação', 560, 25, 18, 2, true);
  }
  function selo(txt, cor) {
    return `<g transform="rotate(-18 ${W / 2} ${H / 2})"><rect x="${W / 2 - 260}" y="${H / 2 - 48}" width="520" height="96" rx="12" fill="none" stroke="${cor}" stroke-width="8" opacity=".85"/>${texto(W / 2, H / 2 + 22, [txt], 60, { bold: true, cor, anchor: 'middle', ls: 6 })}</g>`;
  }
  const svgAbre = (id, mm) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${mm ? 'width="85.6mm" height="54mm"' : `width="${W}" height="${H}"`} role="img" aria-label="${id}">`;
  const moldura = () => `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="28" fill="${COR.fundo}" stroke="${COR.linha}" stroke-width="2"/>`;
  const clip = id => `<clipPath id="${id}"><rect x="0" y="0" width="${W}" height="${H}" rx="28"/></clipPath>`;

  /* d: { nome, matricula, funcao, categoria, validade, cpf, rg, dataIngresso, foto, codigo, assoc:{nome,cnpj,endereco}, presidenteNome, assinatura, textoVerso, siteUrl, logo, selo }
     opt: { mm: true para impressão em milímetros } */
  function frente(d, opt = {}) {
    const u = 'f' + Math.random().toString(36).slice(2, 8);
    const an = nomeAssoc(d.assoc && d.assoc.nome);
    const nm = ajustar(d.nome || '', 500, 38, 24, 2, true);
    // Funções: "Da casa · Administrativa" → uma por linha, mesmo tamanho de fonte
    const fPartes = String(d.funcao || '—').split(' · ').filter(Boolean).slice(0, 2);
    const fAj = fPartes.map(t => ajustar(t, 500, fPartes.length > 1 ? 26 : 28, 17, 1, true));
    const fn = { linhas: fAj.map(x => x.linhas[0]), px: Math.min(...fAj.map(x => x.px)) };
    const yNome = 228, yNome2 = yNome + (nm.linhas.length - 1) * Math.round(nm.px * 1.1);
    const foto = dataUrl(d.foto), logo = d.logo || '';
    return `${svgAbre('Frente da carteirinha de ' + esc(d.nome), opt.mm)}<defs>${clip(u + 'c')}<clipPath id="${u}p"><rect x="40" y="148" width="234" height="312" rx="14"/></clipPath><clipPath id="${u}l"><circle cx="78" cy="66" r="46"/></clipPath></defs>
      <g clip-path="url(#${u}c)">${moldura()}
        <rect x="0" y="0" width="${W}" height="132" fill="${COR.navy}"/>
        <rect x="0" y="132" width="${W}" height="6" fill="${COR.ouro}"/>
        <circle cx="78" cy="66" r="50" fill="#fff"/>${logo ? `<image href="${logo}" x="32" y="20" width="92" height="92" preserveAspectRatio="xMidYMid slice" clip-path="url(#${u}l)"/>` : ''}
        ${texto(148, an.linhas.length > 1 ? 56 : 74, an.linhas, an.px, { bold: true, cor: '#fff', lh: Math.round(an.px * 1.2) })}
        ${texto(148, an.linhas.length > 1 ? 56 + an.linhas.length * Math.round(an.px * 1.2) + 4 : 104, ['CARTEIRA DE ASSOCIADO(A)'], 16, { bold: true, cor: '#E3B252', ls: 2.5 })}
        <rect x="40" y="148" width="234" height="312" rx="14" fill="${COR.claro}"/>
        ${foto ? `<image href="${foto}" x="40" y="148" width="234" height="312" preserveAspectRatio="xMidYMid slice" clip-path="url(#${u}p)"/>`
        : `<g fill="#C9D3CB"><circle cx="157" cy="262" r="52"/><path d="M68 440c8-70 50-104 89-104s81 34 89 104z"/></g>${texto(157, 446, ['SEM FOTO'], 15, { cor: COR.cinza, bold: true, anchor: 'middle', ls: 1.5 })}`}
        <rect x="40" y="148" width="234" height="312" rx="14" fill="none" stroke="${COR.verde}" stroke-width="4"/>
        ${rotulo(306, 180, 'Nome')}
        ${texto(306, yNome, nm.linhas, nm.px, { bold: true, cor: COR.navy, lh: Math.round(nm.px * 1.1) })}
        ${rotulo(306, yNome2 + 52, fn.linhas.length > 1 ? 'Funções' : 'Função')}
        ${texto(306, yNome2 + 86, fn.linhas, fn.px, { bold: true, lh: Math.round(fn.px * 1.2) })}
        ${rotulo(306, 430, 'Matrícula')}${texto(306, 466, [fmtMat(d.matricula)], 34, { bold: true, cor: COR.navy, ls: 1 })}
        ${rotulo(556, 430, 'Válida até')}${texto(556, 466, [fmtD(d.validade)], 34, { bold: true, cor: COR.verde })}
        <rect x="0" y="${H - 44}" width="${W}" height="44" fill="${COR.verde}"/>
        ${texto(W / 2, H - 15, [String(d.categoria || 'Associado(a)').toUpperCase()], 18, { bold: true, cor: '#fff', anchor: 'middle', ls: 4 })}
        ${d.selo ? selo(d.selo.txt, d.selo.cor) : ''}
      </g></svg>`;
  }
  function verso(d, opt = {}) {
    const u = 'v' + Math.random().toString(36).slice(2, 8);
    const a = d.assoc || {};
    const cnpj = String(a.cnpj || '').replace(/\D/g, '');
    const cnpjF = cnpj.length === 14 ? `CNPJ ${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}` : '';
    const rod = ajustar([cnpjF, a.endereco].filter(Boolean).join(' · '), 780, 15, 11, 2, false);
    const aviso = ajustar(d.textoVerso || '', 286, 15, 11, 2, false);
    const ass = dataUrl(d.assinatura);
    const pres = ajustar(d.presidenteNome ? `${d.presidenteNome} · Presidente` : 'Presidente', 440, 17, 12, 1, true);
    const campos = [['CPF', d.cpf || '—'], ['RG', d.rg || '—'], ['Associado(a) desde', fmtD(d.dataIngresso)]];
    return `${svgAbre('Verso da carteirinha de ' + esc(d.nome), opt.mm)}<defs>${clip(u + 'c')}</defs>
      <g clip-path="url(#${u}c)">${moldura()}
        <rect x="0" y="0" width="${W}" height="70" fill="${COR.navy}"/>
        ${(t => texto(40, 45, t.linhas, t.px, { bold: true, cor: '#fff' }))(ajustar(a.nome || '', 776, 22, 15, 1, true))}
        ${campos.map(([k, v], i) => rotulo(40, 120 + i * 74, k) + texto(40, 152 + i * 74, [v], 26, { bold: true })).join('')}
        ${ass ? `<image href="${ass}" x="40" y="330" width="420" height="96" preserveAspectRatio="xMidYMax meet"/>` : ''}
        <line x1="40" y1="430" x2="470" y2="430" stroke="${COR.texto}" stroke-width="2"/>
        ${texto(40, 456, pres.linhas, pres.px, { bold: true, cor: COR.cinza })}
        ${qrPath(validarUrl(d.siteUrl, d.codigo), 578, 92, 238)}
        ${texto(697, 352, ['Confira a validade'], 17, { bold: true, anchor: 'middle', cor: COR.navy })}
        ${texto(697, 378, [fmtCod(d.codigo)], 19, { anchor: 'middle', cor: COR.cinza, ls: 2 })}
        <rect x="0" y="${H - 66}" width="${W}" height="66" fill="${COR.claro}"/>
        ${texto(W / 2, H - (rod.linhas.length > 1 ? 40 : 28), rod.linhas, rod.px, { anchor: 'middle', cor: COR.cinza })}
        ${d.textoVerso ? texto(697, 418, aviso.linhas, aviso.px, { cor: COR.cinza, anchor: 'middle', lh: Math.round(aviso.px * 1.3) }) : ''}
        ${d.selo ? selo(d.selo.txt, d.selo.cor) : ''}
      </g></svg>`;
  }

  // Converte o SVG em PNG (300 dpi por padrão: 1011 × 638 px)
  function png(svg, larguraPx = 1011) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = larguraPx; c.height = Math.round(larguraPx * H / W);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => b ? res(b) : rej(new Error('Não foi possível gerar a imagem.')), 'image/png');
      };
      img.onerror = () => rej(new Error('Não foi possível gerar a imagem da carteirinha.'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/width="85.6mm" height="54mm"/, `width="${W}" height="${H}"`));
    });
  }
  let logoCache = null;
  function logo(src = 'logo.png') {
    if (logoCache) return Promise.resolve(logoCache);
    return fetch(src).then(r => r.blob()).then(b => new Promise(res => { const fr = new FileReader(); fr.onload = () => { logoCache = fr.result; res(logoCache); }; fr.onerror = () => res(''); fr.readAsDataURL(b); })).catch(() => '');
  }
  // Folha A4: frente e verso lado a lado, 5 por folha, com linhas de corte
  function folhaA4(lista) {
    const pags = []; for (let i = 0; i < lista.length; i += 5) pags.push(lista.slice(i, i + 5));
    return pags.map(p => `<div class="a4-page">${p.map(d => `<div class="a4-row"><div class="a4-card">${frente(d, { mm: true })}</div><div class="a4-card">${verso(d, { mm: true })}</div></div>`).join('')}</div>`).join('');
  }
  // Cartão PVC: uma face por página (frente, verso, frente, verso…), para impressoras de crachá frente e verso
  function paginasPVC(lista) { return lista.map(d => `<div class="pvc-page">${frente(d, { mm: true })}</div><div class="pvc-page">${verso(d, { mm: true })}</div>`).join(''); }
  const CSS_IMPRESSAO = {
    a4: '@page{size:A4 portrait;margin:8mm 10mm}.a4-page{break-after:page;display:grid;gap:3mm;justify-content:center}.a4-page:last-child{break-after:auto}.a4-row{display:flex;gap:4mm;break-inside:avoid}.a4-card{width:85.6mm;height:54mm;outline:.2mm dashed #999;outline-offset:1mm}.a4-card svg{display:block;width:85.6mm;height:54mm}',
    pvc: '@page{size:85.6mm 54mm;margin:0}.pvc-page{width:85.6mm;height:54mm;break-after:page;overflow:hidden}.pvc-page:last-child{break-after:auto}.pvc-page svg{display:block;width:85.6mm;height:54mm}',
  };
  window.CARTAO = { frente, verso, png, logo, validarUrl, folhaA4, paginasPVC, CSS_IMPRESSAO, dataUrl, fmtCod, W, H };
})();
