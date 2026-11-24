/* =========================================================
   Página /consultas (E06b): o cliente escolhe, autoriza, paga por PIX
   e acompanha o resultado em Minha conta → Consultas.
   ========================================================= */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const D = window.Dados, C = D.Conta, MG = window.MG;
  const { esc, icone, avisar, modal } = MG;
  const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const lista = $("[data-consultas-lista]");
  const CHAVE = "mg_consulta_comprar";
  let produtos = [];

  async function desenhar() {
    produtos = await D.consultaProdutos();
    if (!produtos.length) { lista.hidden = true; $("[data-consultas-fechado]").hidden = false; return; }
    lista.innerHTML = produtos.map((p) => `<article class="consulta-card${p.destaque ? " destaque" : ""}${p.tipo === "documentos" ? " gratuita" : ""}">
      ${p.destaque ? `<span class="etiqueta">Mais completa</span>` : ""}
      <h2>${esc(p.nome)}</h2>
      <p>${esc(p.descricao || "")}</p>
      ${(p.itens || []).length ? `<ul>${p.itens.map((t) => `<li>${icone("check")}<span>${esc(t)}</span></li>`).join("")}</ul>` : ""}
      <div class="consulta-preco"><strong>${p.tipo === "documentos" ? "Grátis" : esc(brl(p.preco))}</strong><small>${esc(p.prazo || "")}</small></div>
      <button type="button" class="btn ${p.tipo === "documentos" ? "btn-contorno-rosa" : "btn-primario"} btn-bloco" data-comprar="${esc(p.id)}">${p.tipo === "documentos" ? "Começar análise grátis" : "Consultar agora"}</button>
    </article>`).join("");
  }

  async function comprar(id) {
    const p = produtos.find((x) => x.id === id);
    if (!p) return;
    await window.ContaPronta;
    if (!C.usuario || !C.perfilCompleto()) {
      try { sessionStorage.setItem(CHAVE, id); } catch (e) { /* ok */ }
      avisar(C.usuario ? "Complete seu cadastro para consultar." : "Entre na sua conta para consultar. É rapidinho, só com o código do e-mail.");
      setTimeout(() => { location.href = "/conta?voltar=consultas"; }, 900);
      return;
    }
    if (p.tipo === "documentos") return analiseGratuita(p);
    const perfil = C.perfil || {};
    const doc = perfil.tipo === "pj" ? perfil.cnpj : perfil.cpf;
    const m = modal(`<div class="consulta-fluxo">
      <span class="quiz-num">Passo 1 de 2 · Autorização</span>
      <h2>${esc(p.nome)}</h2>
      <p class="consulta-valor">${esc(brl(p.preco))} <small>${esc(p.prazo || "")}</small></p>
      <p><strong>Documento consultado:</strong> ${esc(perfil.tipo === "pj" ? "CNPJ" : "CPF")} ${esc(doc || "")} <small>(do seu cadastro)</small></p>
      <form class="form-modal" novalidate>
        <label class="aceite"><input type="checkbox" name="aceite"><span>Autorizo a Milena Garbim · Limpa Nome a consultar ${esc((D.TIPOS_CONSULTA || {})[p.tipo] || p.nome)} no meu ${esc(perfil.tipo === "pj" ? "CNPJ" : "CPF")}, somente para me entregar este resultado, conforme a <a href="/privacidade" target="_blank">Política de Privacidade</a> e a LGPD.</span></label>
        <div class="botoes-form"><button type="submit" class="btn btn-primario">Continuar para o pagamento</button><button type="button" class="btn-texto" data-fechar>Cancelar</button></div>
      </form></div>`);
    const f = m.querySelector("form");
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!f.aceite.checked) { avisar("Marque a autorização para continuar."); return; }
      const b = f.querySelector("button[type=submit]"); b.disabled = true;
      try {
        const cid = await C.comprarConsulta(p.id, true);
        try { sessionStorage.removeItem(CHAVE); } catch (err) { /* ok */ }
        const todas = await C.consultas();
        await mostrarPix(m, todas.find((x) => x.id === cid) || { id: cid, valor: p.preco, numero: "" }, p);
      } catch (err) { avisar(err.message); b.disabled = false; }
    });
  }

  /** Análise gratuita guiada: passo a passo + envio dos relatórios */
  function analiseGratuita(p) {
    const pj = (C.perfil || {}).tipo === "pj";
    const m = modal(`<div class="consulta-fluxo analise-gratuita">
      <span class="quiz-num">Análise gratuita</span>
      <h2>Baixe seus relatórios e envie aqui</h2>
      <p>São gratuitos e só você pode emiti-los. Envie <strong>pelo menos um</strong> — quanto mais, melhor a análise.</p>
      <ol class="guia-relatorios">
        <li><strong>Registrato (Banco Central)</strong> — dívidas com bancos. Entre com sua conta gov.br e gere o relatório de empréstimos e financiamentos em PDF. <a href="https://www.bcb.gov.br/cidadaniafinanceira/registrato" target="_blank" rel="noopener">Abrir Registrato</a></li>
        <li><strong>Serasa</strong> — dívidas negativadas e score. No app ou site da Serasa, entre com seu ${pj ? "CNPJ" : "CPF"} e tire prints das telas de dívidas e score. <a href="https://www.serasa.com.br" target="_blank" rel="noopener">Abrir Serasa</a></li>
        <li><strong>Boa Vista (Consumidor Positivo)</strong> — dívidas e score na Boa Vista. Tire prints das telas. <a href="https://www.consumidorpositivo.com.br" target="_blank" rel="noopener">Abrir Consumidor Positivo</a></li>
        <li><strong>Protestos em cartório</strong> — consulte seu ${pj ? "CNPJ" : "CPF"} e tire print do resultado. <a href="https://www.pesquisaprotesto.com.br" target="_blank" rel="noopener">Abrir pesquisa de protestos</a></li>
      </ol>
      <form class="form-modal" novalidate>
        <label class="campo"><span>Seus relatórios <small>(PDF ou fotos · até 8 arquivos de 10 MB)</small></span><input type="file" name="arquivos" multiple accept="application/pdf,image/jpeg,image/png,image/webp"></label>
        <label class="campo"><span>Quer contar algo? <small>(opcional)</small></span><textarea name="obs" rows="2" maxlength="1000" placeholder="Ex.: o banco negou meu financiamento e não sei o motivo."></textarea></label>
        <label class="aceite"><input type="checkbox" name="aceite"><span>Envio meus próprios relatórios e autorizo a Milena Garbim · Limpa Nome a analisá-los somente para me orientar, conforme a <a href="/privacidade" target="_blank">Política de Privacidade</a> e a LGPD.</span></label>
        <div class="botoes-form"><button type="submit" class="btn btn-primario">Enviar para análise</button><button type="button" class="btn-texto" data-fechar>Cancelar</button></div>
      </form></div>`);
    const f = m.querySelector("form");
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!f.arquivos.files.length) { avisar("Escolha pelo menos um relatório (PDF ou foto)."); return; }
      if (!f.aceite.checked) { avisar("Marque a autorização para continuar."); return; }
      const b = f.querySelector("button[type=submit]"); b.disabled = true; b.textContent = "Enviando...";
      try {
        await C.enviarAnaliseGratuita(f.arquivos.files, f.obs.value, true);
        try { sessionStorage.removeItem(CHAVE); } catch (err) { /* ok */ }
        m.querySelector(".consulta-fluxo").innerHTML = `<h2>Recebido! ✅</h2><p>A Milena vai analisar seus relatórios e responder em até 2 dias úteis. A análise aparece em <strong>Minha conta → Consultas</strong>, com aviso no seu celular.</p>
          <div class="botoes-form"><a class="btn btn-primario" href="/conta?aba=consultas">Acompanhar minha análise</a></div>`;
      } catch (err) { avisar(err.message); b.disabled = false; b.textContent = "Enviar para análise"; }
    });
  }

  /** Passo 2: PIX com QR Code e "Já paguei" */
  async function mostrarPix(m, c, p) {
    const caixa = m.querySelector(".consulta-fluxo") || m;
    // Pagamento automático (Asaas): QR da cobrança e confirmação sozinha
    if (await D.pagamentoAutomatico()) {
      caixa.innerHTML = `<p class="vazio">Gerando o seu PIX...</p>`;
      try { return await pixAutomatico(caixa, c, await C.cobrarPix(c.id)); }
      catch (err) { avisar(err.message + " Usando o PIX direto."); }
    }
    const site = await D.site();
    const pix = (site.contatos || {}).pix || {};
    if (!pix.chave) {
      caixa.innerHTML = `<h2>Quase lá!</h2><p>O pagamento online está indisponível no momento. Sua consulta <strong>${esc(c.numero || "")}</strong> foi registrada: fale com a Milena para combinar o pagamento.</p>
        <div class="botoes-form"><a class="btn btn-primario" href="/conta?aba=consultas">Ver minhas consultas</a></div>`;
      return;
    }
    const codigo = window.ChatUI.pixCodigo({ chave: pix.chave, tipo: pix.tipo, nome: pix.nome, cidade: pix.cidade, valor: c.valor, descricao: "Consulta " + (c.numero || ""), txid: c.pagamento_ref || c.numero });
    caixa.innerHTML = `<span class="quiz-num">Passo 2 de 2 · Pagamento</span>
      <h2>Pague com PIX</h2>
      <p class="consulta-valor">${esc(brl(c.valor))} <small>Consulta ${esc(c.numero || "")}</small></p>
      <div class="pix-qr consulta-qr">Gerando QR Code...</div>
      <label class="campo"><span>PIX copia e cola</span><textarea readonly rows="3" class="pix-copia">${esc(codigo)}</textarea></label>
      <div class="botoes-form"><button type="button" class="btn btn-contorno-rosa" data-copiar>Copiar código</button><button type="button" class="btn btn-primario" data-paguei>Já paguei</button></div>
      <p class="adm-dica">Depois de pagar, toque em <strong>Já paguei</strong>. Assim que o pagamento for confirmado, a consulta é feita e o resultado aparece em <strong>Minha conta → Consultas</strong>, com aviso no seu celular.</p>`;
    try { caixa.querySelector(".consulta-qr").innerHTML = await window.ChatUI.qrSvg(codigo); } catch (e) { caixa.querySelector(".consulta-qr").textContent = "Use o código copia e cola abaixo."; }
    caixa.querySelector("[data-copiar]").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(codigo); avisar("Código PIX copiado!"); } catch (e) { caixa.querySelector(".pix-copia").select(); avisar("Selecione e copie o código."); }
    });
    caixa.querySelector("[data-paguei]").addEventListener("click", async (e) => {
      e.target.disabled = true;
      try {
        await C.informarPagamento(c.id);
        caixa.innerHTML = `<h2>Recebemos o seu aviso ✅</h2><p>Assim que o pagamento for confirmado, sua consulta <strong>${esc(c.numero || "")}</strong> é feita e o resultado aparece na sua conta. Você também recebe um aviso no celular.</p>
          <div class="botoes-form"><a class="btn btn-primario" href="/conta?aba=consultas">Acompanhar minha consulta</a></div>`;
      } catch (err) { avisar(err.message); e.target.disabled = false; }
    });
  }
  /** PIX gerado pelo Asaas: mostra o QR e espera o pagamento cair (sem "Já paguei") */
  async function pixAutomatico(caixa, c, cob) {
    caixa.innerHTML = `<span class="quiz-num">Passo 2 de 2 · Pagamento</span>
      <h2>Pague com PIX</h2>
      <p class="consulta-valor">${esc(brl(cob.valor || c.valor))} <small>Consulta ${esc(cob.numero || c.numero || "")}</small></p>
      <div class="pix-qr consulta-qr">Gerando QR Code...</div>
      <label class="campo"><span>PIX copia e cola</span><textarea readonly rows="3" class="pix-copia">${esc(cob.payload)}</textarea></label>
      <div class="botoes-form"><button type="button" class="btn btn-contorno-rosa" data-copiar>Copiar código</button></div>
      <p class="pix-esperando"><span class="girando" aria-hidden="true"></span> Aguardando o pagamento… <strong>assim que o PIX cair, a consulta começa sozinha</strong>. Pode deixar esta tela aberta ou fechar: o resultado aparece em Minha conta → Consultas.</p>`;
    try { caixa.querySelector(".consulta-qr").innerHTML = await window.ChatUI.qrSvg(cob.payload); } catch (e) { caixa.querySelector(".consulta-qr").textContent = "Use o código copia e cola abaixo."; }
    caixa.querySelector("[data-copiar]").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(cob.payload); avisar("Código PIX copiado!"); } catch (e) { caixa.querySelector(".pix-copia").select(); avisar("Selecione e copie o código."); }
    });
    // confere a cada 5 s (por até 20 min) se o pagamento já foi confirmado
    const inicio = Date.now();
    const conferir = async () => {
      if (!document.body.contains(caixa)) return;   // modal fechado
      try {
        const atual = (await C.consultas()).find((x) => x.id === c.id);
        if (atual && atual.pagamento_status === "pago") {
          caixa.innerHTML = `<h2>Pagamento confirmado! ✅</h2><p>Sua consulta <strong>${esc(atual.numero || "")}</strong> já está sendo feita. O resultado aparece em <strong>Minha conta → Consultas</strong> e você recebe um aviso no celular.</p>
            <div class="botoes-form"><a class="btn btn-primario" href="/conta?aba=consultas">Ver minha consulta</a></div>`;
          return;
        }
      } catch (e) { /* tenta de novo */ }
      if (Date.now() - inicio < 20 * 60 * 1000) setTimeout(conferir, 5000);
    };
    setTimeout(conferir, 5000);
  }
  window.ConsultasPix = { mostrarPix };
  if (!lista) return;   // na página Minha conta, este arquivo só fornece o PIX

  lista.addEventListener("click", (e) => { const b = e.target.closest("[data-comprar]"); if (b) comprar(b.dataset.comprar); });
  desenhar().then(async () => {
    let pendente = null;
    try { pendente = sessionStorage.getItem(CHAVE); } catch (e) { /* ok */ }
    pendente = pendente || new URLSearchParams(location.search).get("comprar");
    if (pendente && produtos.some((p) => p.id === pendente)) { await window.ContaPronta; if (C.usuario && C.perfilCompleto()) comprar(pendente); }
  }).catch(() => { lista.innerHTML = `<p class="vazio">Não foi possível carregar as consultas agora.</p>`; });
})();
