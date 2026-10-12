/* Recibo de entrada (doação, mensalidade, evento…): desenho em SVG no tamanho 148 × 100 mm.
   O mesmo desenho serve para a tela, a impressão (A4 com 1ª e 2ª via) e a imagem PNG para WhatsApp.
   Unidades do desenho: décimos de milímetro (1480 × 1000). */
'use strict';
(function () {
  const W = 1480, H = 1000;
  const COR = { navy: '#1C3557', verde: '#2D7A38', ouro: '#C08623', texto: '#16241B', cinza: '#58695F', linha: '#D6E0D7', claro: '#F3F6F2' };
  const FONTE = 'Arial, Helvetica, sans-serif';
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtD = iso => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
  const dataLonga = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${y}`; };
  const fmtBRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtNum = n => String(n || 0).padStart(6, '0');
  const mime = b64 => /^iVBOR/.test(b64 || '') ? 'image/png' : 'image/jpeg';
  const dataUrl = b64 => !b64 ? '' : /^data:/.test(b64) ? b64 : `data:${mime(b64)};base64,${b64}`;

  let ctx = null;
  function largura(txt, px, bold) {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${bold ? 'bold ' : ''}${px}px ${FONTE}`;
    return ctx.measureText(txt).width;
  }
  // Quebra um texto com trechos em negrito ([{t, b}]) em linhas de até maxW; reduz a fonte se passar de maxLinhas
  function paragrafo(trechos, maxW, pxMax, pxMin, maxLinhas) {
    const palavras = []; trechos.forEach(tr => String(tr.t).split(/\s+/).filter(Boolean).forEach(p => palavras.push({ t: p, b: !!tr.b })));
    for (let px = pxMax; px >= pxMin; px -= 1) {
      const linhas = []; let cur = [], w = 0; const esp = largura(' ', px, false);
      palavras.forEach(p => {
        const pw = largura(p.t, px, p.b);
        if (cur.length && w + esp + pw > maxW) { linhas.push(cur); cur = []; w = 0; }
        w += (cur.length ? esp : 0) + pw; cur.push(p);
      });
      if (cur.length) linhas.push(cur);
      if (linhas.length <= maxLinhas || px === pxMin) return { linhas: linhas.slice(0, maxLinhas), px };
    }
  }
  function linhasSvg(x, y, par, cor) {
    const lh = Math.round(par.px * 1.45);
    return par.linhas.map((l, i) => `<text x="${x}" y="${y + i * lh}" font-family="${FONTE}" font-size="${par.px}" fill="${cor || COR.texto}">${l.map((p, k) => `<tspan${p.b ? ' font-weight="700"' : ''}>${k ? ' ' : ''}${esc(p.t)}</tspan>`).join('')}</text>`).join('');
  }
  function cabe(txt, maxW, pxMax, pxMin, bold) { let px = pxMax; while (px > pxMin && largura(txt, px, bold) > maxW) px--; let t = txt; while (t.length > 3 && largura(t + '…', px, bold) > maxW) t = t.slice(0, -1); return { t: t === txt ? t : t + '…', px }; }
  const texto = (x, y, t, px, o = {}) => `<text x="${x}" y="${y}" font-family="${FONTE}" font-size="${px}" ${o.bold ? 'font-weight="700"' : ''} fill="${o.cor || COR.texto}" ${o.anchor ? `text-anchor="${o.anchor}"` : ''} ${o.ls ? `letter-spacing="${o.ls}"` : ''}>${esc(t)}</text>`;

  /* d: { numero, valor, extenso, pessoa, descricao, forma, data, cidade, assoc:{nome,cnpj,endereco}, logo, assinatura, assinanteNome, assinanteCargo, via, cancelado }
     opt: { mm: true para impressão em milímetros } */
  function svg(d, opt = {}) {
    const a = d.assoc || {}, u = 'r' + Math.random().toString(36).slice(2, 8);
    const cnpj = String(a.cnpj || '').replace(/\D/g, '');
    const cnpjF = cnpj.length === 14 ? `CNPJ ${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}` : '';
    const nomeA = cabe(a.nome || 'Associação', 1200, 34, 24, true);
    const sub = cabe([cnpjF, a.endereco].filter(Boolean).join(' · '), 1200, 21, 15, false);
    const valorTxt = fmtBRL(d.valor);
    const corpo = paragrafo([
      { t: 'Recebemos de' }, { t: d.pessoa || '______________________________', b: true },
      { t: 'a importância de' }, { t: d.extenso || '', b: true }, { t: `(${valorTxt}),` },
      { t: 'referente a' }, { t: (d.descricao || '').replace(/\.$/, '') + '.', b: true },
    ], 1360, 32, 22, 6);
    const info = [d.forma ? `Forma de pagamento: ${d.forma}` : '', d.data ? `Data do pagamento: ${fmtD(d.data)}` : ''].filter(Boolean).join('     ·     ');
    const ass = dataUrl(d.assinatura);
    const nomeAss = cabe(d.assinanteNome || '', 600, 24, 16, true);
    // forma e data logo abaixo do texto (sobe quando o texto é curto)
    const yInfo = Math.min(730, 420 + (corpo.linhas.length - 1) * Math.round(corpo.px * 1.45) + 90);
    const local = `${d.cidade ? d.cidade + ', ' : ''}${dataLonga(d.data || new Date().toISOString())}.`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${opt.mm ? 'width="148mm" height="100mm"' : `width="${W}" height="${H}"`} role="img" aria-label="Recibo nº ${fmtNum(d.numero)}">
      <defs><clipPath id="${u}c"><rect x="0" y="0" width="${W}" height="${H}" rx="24"/></clipPath><clipPath id="${u}l"><circle cx="100" cy="88" r="56"/></clipPath></defs>
      <g clip-path="url(#${u}c)">
        <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="24" fill="#fff" stroke="${COR.linha}" stroke-width="2"/>
        <rect x="0" y="0" width="${W}" height="176" fill="${COR.navy}"/><rect x="0" y="176" width="${W}" height="6" fill="${COR.ouro}"/>
        <circle cx="100" cy="88" r="60" fill="#fff"/>${d.logo ? `<image href="${d.logo}" x="44" y="32" width="112" height="112" preserveAspectRatio="xMidYMid slice" clip-path="url(#${u}l)"/>` : ''}
        ${texto(190, 82, nomeA.t, nomeA.px, { bold: true, cor: '#fff' })}
        ${texto(190, 124, sub.t, sub.px, { cor: '#D8E2EC' })}
        ${d.via ? texto(W - 40, 40, d.via.toUpperCase(), 16, { bold: true, cor: '#E3B252', anchor: 'end', ls: 2 }) : ''}
        ${texto(60, 278, 'RECIBO', 56, { bold: true, cor: COR.navy, ls: 4 })}
        ${texto(60, 322, `Nº ${fmtNum(d.numero)}`, 26, { bold: true, cor: COR.cinza, ls: 2 })}
        <rect x="960" y="222" width="460" height="104" rx="14" fill="${COR.claro}" stroke="${COR.ouro}" stroke-width="3"/>
        ${texto(1190, 292, valorTxt, Math.min(52, Math.floor(420 / Math.max(1, valorTxt.length) * 1.7)), { bold: true, cor: COR.verde, anchor: 'middle' })}
        ${linhasSvg(60, 420, corpo)}
        ${info ? texto(60, yInfo, info, 22, { cor: COR.cinza }) : ''}
        ${texto(60, yInfo + (info ? 64 : 0), local, 24)}
        ${ass ? `<image href="${ass}" x="800" y="760" width="600" height="120" preserveAspectRatio="xMidYMax meet"/>` : ''}
        <line x1="800" y1="884" x2="1420" y2="884" stroke="${COR.texto}" stroke-width="2"/>
        ${texto(1110, 916, nomeAss.t, nomeAss.px, { bold: true, anchor: 'middle' })}
        ${texto(1110, 946, d.assinanteCargo || '', 20, { cor: COR.cinza, anchor: 'middle' })}
        ${texto(60, 960, `Recibo nº ${fmtNum(d.numero)}`, 16, { cor: COR.cinza })}
        ${d.cancelado ? `<g transform="rotate(-14 ${W / 2} ${H / 2})"><rect x="${W / 2 - 330}" y="${H / 2 - 60}" width="660" height="120" rx="14" fill="none" stroke="#B4332A" stroke-width="10" opacity=".85"/>${texto(W / 2, H / 2 + 28, 'CANCELADO', 78, { bold: true, cor: '#B4332A', anchor: 'middle', ls: 8 })}</g>` : ''}
      </g></svg>`;
  }
  // PNG para enviar (1480 × 1000 px)
  function png(s, larguraPx = W) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = larguraPx; c.height = Math.round(larguraPx * H / W);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => b ? res(b) : rej(new Error('Não foi possível gerar a imagem.')), 'image/png');
      };
      img.onerror = () => rej(new Error('Não foi possível gerar a imagem do recibo.'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.replace(/width="148mm" height="100mm"/, `width="${W}" height="${H}"`));
    });
  }
  // Folha A4: 1ª via (pagador) e 2ª via (associação), com linha de corte
  function folhaA4(d) {
    return `<div class="rec-page"><div class="rec-via">${svg({ ...d, via: '1ª via · pagador' }, { mm: true })}</div><div class="rec-corte"></div><div class="rec-via">${svg({ ...d, via: '2ª via · associação' }, { mm: true })}</div></div>`;
  }
  const CSS_IMPRESSAO = '@page{size:A4 portrait;margin:10mm}.rec-page{display:grid;justify-content:center;gap:6mm}.rec-via svg{display:block;width:148mm;height:100mm}.rec-corte{border-top:.3mm dashed #999;width:170mm;margin:0 auto}';
  window.RECIBO = { svg, png, folhaA4, CSS_IMPRESSAO, fmtNum, W, H };
})();
