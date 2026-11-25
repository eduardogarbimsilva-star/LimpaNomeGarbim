/* =========================================================
   Milena Garbim · Limpa Nome — Minha conta
   Entrar com código por e-mail, cadastro PF/PJ e acompanhamento das solicitações
   ========================================================= */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const D = window.Dados, C = D.Conta, BR = window.BR, MG = window.MG;
  const { esc, fmt, brl, icone, avisar } = MG;
  const params = new URLSearchParams(location.search);
  const voltar = /^\/?[a-z-]+(\.html)?$/.test(params.get("voltar") || "") ? "/" + params.get("voltar").replace(/^\//, "").replace(/\.html$/, "") : "";
  const querEnviar = params.get("enviar") === "1";
  const dataHora = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const data = (d) => new Date(d).toLocaleDateString("pt-BR");

  const TELAS = ["conta-carregando", "conta-entrar", "conta-cadastro", "conta-painel"];
  const mostrar = (id) => TELAS.forEach((t) => { $("#" + t).hidden = t !== id; });
  $("#conta-demo").hidden = D.online;

  /* =========================================================
     Entrar / criar conta
     ========================================================= */
  let modo = "entrar", emailAtual = "";
  $$(".abas-login [data-modo]").forEach((b) => b.addEventListener("click", () => {
    modo = b.dataset.modo;
    $$(".abas-login [data-modo]").forEach((x) => x.classList.toggle("ativo", x === b));
    $("#aceite-criar").hidden = modo !== "criar";
    $("#btn-codigo").textContent = modo === "criar" ? "Criar conta e receber código" : "Receber código por e-mail";
  }));
  if (params.get("criar") === "1") $('.abas-login [data-modo="criar"]').click();

  $("#c-email").addEventListener("blur", (e) => {
    const s = BR.sugerirEmail(e.target.value.trim());
    const dica = $("#dica-email");
    dica.hidden = !s;
    if (s) dica.innerHTML = `Você quis dizer <button type="button" class="btn-texto">${esc(s)}</button>?`;
  });
  $("#dica-email").addEventListener("click", (e) => {
    if (!e.target.matches("button")) return;
    $("#c-email").value = e.target.textContent; $("#dica-email").hidden = true;
  });

  async function pedirCodigo(email, botao) {
    const original = botao.textContent;
    botao.disabled = true; botao.textContent = "Enviando...";
    try {
      const r = await C.enviarCodigo(email, modo === "criar");
      emailAtual = email.trim().toLowerCase();
      $("#c-email-mostra").textContent = emailAtual;
      $("#codigo-demo").hidden = !r.codigoDemo;
      if (r.codigoDemo) $("#codigo-demo").innerHTML = `Modo demonstração — seu código: <strong>${esc(r.codigoDemo)}</strong>`;
      if (r.jaTinhaConta) avisar("Este e-mail já tem cadastro. Enviamos o código para você entrar.");
      $("#form-email").hidden = true; $("#form-codigo").hidden = false;
      $("#c-codigo").value = ""; $("#c-codigo").focus();
    } catch (e) { avisar(e.message); }
    finally { botao.disabled = false; botao.textContent = original; }
  }
  $("#form-email").addEventListener("submit", (e) => {
    e.preventDefault();
    if (modo === "criar" && !e.target.aceite.checked) return avisar("Para criar a conta, aceite a Política de Privacidade.");
    pedirCodigo(e.target.email.value, $("#btn-codigo"));
  });
  $("#c-reenviar").addEventListener("click", (e) => pedirCodigo(emailAtual, e.target));
  $("#c-trocar").addEventListener("click", () => { $("#form-codigo").hidden = true; $("#form-email").hidden = false; $("#c-email").focus(); });
  $("#form-codigo").addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = $("button[type=submit]", e.target);
    b.disabled = true;
    try { await C.verificarCodigo(emailAtual, e.target.codigo.value); await decidir(true); }
    catch (err) { avisar(err.message); }
    finally { b.disabled = false; }
  });

  /* =========================================================
     Cadastro
     ========================================================= */
  const form = $("#conta-cadastro");
  $$("[data-mascara]", form).forEach((inp) => inp.addEventListener("input", () => { inp.value = BR.mascaras[inp.dataset.mascara](inp.value); }));
  function tipoCadastro() { return form.tipo.value; }
  function alternarTipo() {
    const pj = tipoCadastro() === "pj";
    $$("[data-pf]", form).forEach((el) => { el.hidden = pj; });
    $$("[data-pj]", form).forEach((el) => { el.hidden = !pj; });
  }
  $$("input[name=tipo]", form).forEach((r) => r.addEventListener("change", alternarTipo));

  // CEP: busca o endereço assim que tiver 8 dígitos (digitado, colado ou preenchido pelo celular)
  let cepBuscado = "", cepBusca = null;
  async function buscarEndereco(focar) {
    const cep = BR.so(form.cep.value);
    if (!D.moduloLigado("busca_cep")) return null;   // desligado no painel (Módulos)
    if (cep.length !== 8 || cep === cepBuscado) return cepBusca;
    cepBuscado = cep;
    cepBusca = (async () => {
      try {
        const d = await BR.buscarCep(cep);
        if (BR.so(form.cep.value) !== cep) return;
        ["logradouro", "bairro", "cidade"].forEach((k) => { if (d[k]) form[k].value = d[k]; });
        const uf = BR.ufSigla(d.uf);
        if (uf) form.uf.value = uf;
        if (focar && document.activeElement === form.cep) form.numero.focus();
      } catch (e) {
        cepBuscado = "";
        avisar(e.message === "CEP não encontrado." ? "CEP não encontrado. Confira os números ou preencha cidade e estado manualmente." : e.message);
      }
    })();
    return cepBusca;
  }
  form.cep.addEventListener("input", () => { if (BR.so(form.cep.value).length === 8) buscarEndereco(true); });
  form.cep.addEventListener("blur", () => buscarEndereco(false));
  form.cep.addEventListener("change", () => buscarEndereco(false));
  // Estado: o preenchimento automático do celular pode mandar o nome por extenso
  form.uf.addEventListener("change", () => { const s = BR.ufSigla(form.uf.value); if (s && s !== form.uf.value) form.uf.value = s; });
  $("#k-buscar-cnpj").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const d = await BR.buscarCnpj(form.cnpj.value);
      form.razao_social.value = d.razao_social || "";
      form.nome_fantasia.value = d.nome_fantasia || "";
      if (d.cep) form.cep.value = BR.mascaras.cep(d.cep);
      ["logradouro", "numero", "complemento", "bairro", "cidade"].forEach((k) => { if (d[k]) form[k].value = d[k]; });
      if (BR.ufSigla(d.uf)) form.uf.value = BR.ufSigla(d.uf);
      if (d.telefone && !form.telefone.value) form.telefone.value = BR.mascaras.telefone(d.telefone);
      if (d.situacao && d.situacao !== "ATIVA") avisar("Atenção: situação do CNPJ na Receita: " + d.situacao);
    } catch (err) { avisar(err.message); }
    finally { e.target.disabled = false; }
  });

  function preencherCadastro(p) {
    p = p || {};
    const tipo = p.tipo || "pf";
    $$("input[name=tipo]", form).forEach((r) => { r.checked = r.value === tipo; });
    ["nome", "cpf", "cnpj", "razao_social", "nome_fantasia", "responsavel", "telefone", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"]
      .forEach((k) => { if (form[k]) form[k].value = k === "uf" ? BR.ufSigla(p[k]) : p[k] || ""; });
    alternarTipo();
  }

  function lerCadastro() {
    const L = (k, max) => BR.limpar(form[k].value, max);
    const pj = tipoCadastro() === "pj";
    const d = {
      tipo: pj ? "pj" : "pf",
      nome: pj ? null : L("nome", 100), cpf: pj ? null : BR.mascaras.cpf(form.cpf.value),
      cnpj: pj ? BR.mascaras.cnpj(form.cnpj.value) : null, razao_social: pj ? L("razao_social", 150) : null,
      nome_fantasia: pj ? L("nome_fantasia", 150) || null : null, responsavel: pj ? L("responsavel", 100) : null,
      telefone: BR.mascaras.telefone(form.telefone.value), cep: BR.so(form.cep.value) ? BR.mascaras.cep(form.cep.value) : null,
      logradouro: L("logradouro", 150) || null, numero: L("numero", 20) || null, complemento: L("complemento", 80) || null,
      bairro: L("bairro", 80) || null, cidade: L("cidade", 80), uf: BR.ufSigla(form.uf.value)
    };
    if (!pj && !BR.nomeValido(d.nome)) throw new Error("Informe seu nome completo (nome e sobrenome).");
    if (!pj && !BR.cpfValido(d.cpf)) throw new Error("CPF inválido. Confira os números.");
    if (pj && !BR.cnpjValido(d.cnpj)) throw new Error("CNPJ inválido. Confira os números.");
    if (pj && d.razao_social.length < 3) throw new Error("Informe a razão social.");
    if (pj && !BR.nomeValido(d.responsavel)) throw new Error("Informe o nome completo do responsável.");
    if (!BR.telefoneValido(d.telefone)) throw new Error("Telefone inválido. Use DDD + número (celular começa com 9).");
    if (d.cep && !BR.cepValido(d.cep)) throw new Error("CEP inválido.");
    if (d.cidade.length < 2) throw new Error("Informe a cidade.");
    if (!BR.UFS.includes(d.uf)) throw new Error("Selecione o estado.");
    return d;
  }

  let editando = false, ouvindo = null;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = $("button[type=submit]", form);
    try {
      b.disabled = true;
      await buscarEndereco(false); // espera a busca do CEP terminar antes de validar
      b.disabled = false;
      const d = lerCadastro();
      b.disabled = true;
      await C.salvarPerfil(d);
      avisar("Cadastro salvo!");
      editando = false;
      if (querEnviar && window.Solicitacao && window.Solicitacao.ids().length) { location.href = "/servicos?solicitacao=1"; return; }
      await decidir();
    } catch (err) { avisar(err.message); }
    finally { b.disabled = false; }
  });
  $("#k-cancelar").addEventListener("click", () => { editando = false; decidir(); });

  /* =========================================================
     Área logada
     ========================================================= */
  $$(".abas [data-aba]").forEach((b) => b.addEventListener("click", () => abrirAba(b.dataset.aba)));
  function abrirAba(aba) {
    if (aba === "mensagens") montarCaixa();
    if (aba === "consultas") desenharConsultas();
    $$(".abas [data-aba]").forEach((x) => { x.classList.toggle("ativo", x.dataset.aba === aba); x.setAttribute("aria-selected", x.dataset.aba === aba); });
    $$("[data-painel]").forEach((p) => { p.hidden = p.dataset.painel !== aba; });
  }
  $("#conta-sair").addEventListener("click", async () => { await C.sair(); location.href = "/"; });

  function seloStatus(s) {
    const st = D.STATUS[s] || { nome: s, cor: "cinza" };
    return `<span class="selo-status st-${st.cor}">${esc(st.nome)}</span>`;
  }
  function linhaTempo(p) {
    return `<ol class="linha-tempo">${(p.andamento || []).map((a) => {
      const quem = a.autor === "cliente" ? "Você" : a.autor === "equipe" ? "Equipe Milena Garbim" : "Site";
      return `<li class="lt-${esc(a.autor)}"><div class="lt-cab"><strong>${esc(quem)}</strong><time>${esc(dataHora(a.data))}</time></div>
        ${a.status ? `<p class="lt-status">Situação: ${seloStatus(a.status)}</p>` : ""}${a.texto ? `<p>${fmt(a.texto)}</p>` : ""}</li>`;
    }).join("")}</ol>`;
  }
  const PASSOS = ["recebido", "confirmado", "em_andamento", "concluido"];
  const POSICAO = { recebido: 0, em_analise: 0, confirmado: 1, aguardando_cliente: 2, em_andamento: 2, concluido: 3 };
  function progresso(p) {
    if (p.status === "cancelado") return "";
    const atual = POSICAO[p.status] ?? 0;
    return `<ol class="progresso">${PASSOS.map((s, i) => `<li class="${i <= atual ? "feito" : ""}${i === atual ? " atual" : ""}"><span></span>${esc(D.STATUS[s].nome)}</li>`).join("")}</ol>`;
  }

  async function desenharPedidos() {
    const alvo = $("#conta-pedidos");
    alvo.innerHTML = `<p class="vazio">Carregando suas solicitações...</p>`;
    let lista = [];
    try { [lista, consultasAtuais] = await Promise.all([C.listarPedidos(), (C.consultas ? C.consultas() : Promise.resolve([])).catch(() => []), D.Chat.naoLidas("cliente").then((r) => { naoLidas = r; }).catch(() => {})]); }
    catch (e) { alvo.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
    pedidosAtuais = lista;
    if (!lista.length) {
      alvo.innerHTML = `<div class="cartao centro caixa-aviso">${icone("sacola", "icone-svg grande")}<h3>Nenhuma solicitação ainda</h3><p>Escolha os serviços no catálogo e envie a sua solicitação. Você acompanha tudo por aqui.</p><a href="/servicos" class="btn btn-primario">Ver serviços</a></div>`;
      return;
    }
    const pendentes = consultasAtuais.filter((c) => c.status === "aguardando_autorizacao").length;
    alvo.innerHTML = (pendentes ? `<p class="aviso-cliente aviso-consulta">${icone("alerta")}A Milena pediu sua autorização para ${pendentes === 1 ? "uma consulta" : pendentes + " consultas"} do seu CPF/CNPJ. Veja no pedido abaixo.</p>` : "") + lista.map((p, i) => {
      const itens = p.itens || [];
      return `<details class="pedido-cartao"${i === 0 ? " open" : ""} data-pedido="${esc(p.id)}">
        <summary>
          <div><strong>${esc(p.numero)}</strong><small>${esc(data(p.criado_em))} · ${itens.length} ${itens.length === 1 ? "serviço" : "serviços"}</small></div>
          ${seloStatus(p.status)}
        </summary>
        <div class="pedido-corpo">
          ${progresso(p)}
          ${p.status === "aguardando_cliente" ? `<p class="aviso-cliente">${icone("alerta")}A equipe está aguardando uma resposta sua. Veja a última mensagem abaixo.</p>` : ""}
          <ul class="pedido-itens">${itens.map((it) => `<li><span><small>${esc(it.categoria || "")}</small>${esc(it.nome)}</span><span>${it.preco ? (it.a_partir ? "a partir de " : "") + brl(it.preco) : "Sob consulta"}</span></li>`).join("")}</ul>
          ${p.observacoes ? `<p class="pedido-obs"><strong>Sua observação:</strong> ${esc(p.observacoes)}</p>` : ""}
          <h4>Andamento</h4>
          ${linhaTempo(p)}
          ${blocoConsultas(p.id)}
          ${blocoChat(p)}
          ${["recebido", "em_analise", "confirmado", "aguardando_cliente"].includes(p.status) ? `<p class="pedido-cancelar"><button type="button" class="btn-texto perigo" data-cancelar-pedido="${esc(p.id)}">${icone("x")}Cancelar este pedido</button></p>` : ""}
        </div>
      </details>`;
    }).join("");
    D.site().then((s) => {   // links de WhatsApp dos pedidos
      const n = String(s.contatos.whatsapp || "").replace(/\D/g, "");
      $$("#conta-pedidos [data-whats]").forEach((a) => { if (n) { a.href = "https://wa.me/" + n + "?text=" + encodeURIComponent(a.dataset.whats); a.target = "_blank"; a.rel = "noopener"; } else a.hidden = true; });
    });
  }
  /* ---------- Chat do pedido (abre na hora: a assistente atende até a Milena responder) ---------- */
  let consultasAtuais = [];
  let pedidosAtuais = [], naoLidas = {}, fotoMilena = "assets/img/milena-garbim-avatar.jpg";
  D.site().then((s) => { fotoMilena = s.fotos.avatar || fotoMilena; });
  /* ---------- Aba "Consultas" (E06b): compradas no site, com andamento e resultado ---------- */
  async function desenharConsultas() {
    const alvo = $("#conta-consultas");
    alvo.innerHTML = `<p class="vazio">Carregando suas consultas...</p>`;
    try { consultasAtuais = await C.consultas(); } catch (e) { alvo.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }
    const minhas = consultasAtuais.filter((c) => c.origem === "cliente");
    const passos = (c) => {
      if (c.tipo === "documentos") return `<ol class="progresso consulta-progresso"><li class="feito"><span></span>Enviado</li><li class="feito"><span></span>Em análise</li><li class="${c.status === "concluida" ? "feito" : ""}"><span></span>Resposta</li></ol>`;
      const pago = c.pagamento_status === "pago", feita = c.status === "concluida";
      return `<ol class="progresso consulta-progresso"><li class="feito"><span></span>Pedido</li><li class="${pago ? "feito" : ""}"><span></span>Pagamento</li><li class="${pago ? "feito" : ""}"><span></span>Consulta</li><li class="${feita ? "feito" : ""}"><span></span>Resultado</li></ol>`;
    };
    alvo.innerHTML = (minhas.length ? minhas.map((c) => {
      const st = (D.STATUS_CONSULTA || {})[c.status] || { nome: c.status, cor: "cinza" };
      const nomeSt = c.tipo === "documentos" && c.status === "autorizada" ? "Em análise pela Milena" : c.status === "autorizada" ? "Pagamento confirmado — consultando" : c.status === "aguardando_pagamento" && c.informou_pago_em ? "Pagamento em conferência" : st.nome;
      return `<div class="consulta-item"><div class="consulta-cab"><div><strong>${c.tipo === "documentos" ? "Análise gratuita" : esc(((D.TIPOS_CONSULTA || {})[c.tipo] || "Consulta").replace(/^./, (l) => l.toUpperCase()))}</strong><small> · ${esc(c.numero || "")} · ${c.tipo === "documentos" ? "grátis" : esc(brl(c.valor || 0))}</small></div><span class="selo-status st-${st.cor}">${esc(nomeSt)}</span></div>
        ${passos(c)}
        ${c.status === "aguardando_pagamento" ? `<div class="botoes-form">${c.informou_pago_em ? `<p class="adm-dica">Você avisou que pagou. Estamos conferindo — você será avisado aqui e no celular.</p>` : `<button type="button" class="btn btn-primario" data-pagar-consulta="${esc(c.id)}">${c.gateway_id ? "Ver o PIX de novo" : "Pagar com PIX"}</button>`}</div>` : ""}
        ${c.status === "concluida" ? resultadoConsulta(c) : ""}
        ${c.consentimento_texto ? `<details class="consulta-aceite"><summary>Ver a autorização que você deu</summary><p>${esc(c.consentimento_texto)}</p></details>` : ""}</div>`;
    }).join("") : `<div class="cartao centro caixa-aviso"><h3>Nenhuma consulta ainda</h3><p>Consulte restrições, protestos, score e dívidas com bancos do seu CPF ou CNPJ.</p><a href="/consultas" class="btn btn-primario">Fazer uma consulta</a></div>`)
      + (minhas.length ? `<p class="centro"><a href="/consultas" class="btn btn-contorno-rosa">Fazer outra consulta</a></p>` : "");
    D.site().then((st) => { const n = String((st.contatos || {}).whatsapp || "").replace(/\D/g, ""); alvo.querySelectorAll("[data-whats]").forEach((x) => { if (n) { x.href = "https://wa.me/" + n + "?text=" + encodeURIComponent(x.dataset.whats); x.target = "_blank"; x.rel = "noopener"; } else x.hidden = true; }); });
  }
  function resultadoConsulta(c) {
    const pend = Array.isArray(c.pendencias) ? c.pendencias : [];
    const dt = (d) => (d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR") : "");
    return `<div class="consulta-resultado"><h4>Resultado</h4><p class="consulta-resumo">${esc(c.resultado_resumo || "")}</p>
      ${pend.length ? `<div class="tabela-rolagem"><table class="tabela tabela-pend"><thead><tr><th>Onde</th><th>Credor</th><th>Valor</th><th>Data</th></tr></thead><tbody>${pend.map((x) => `<tr><td>${esc(x.orgao || "")}</td><td>${esc(x.credor || "")}</td><td>${esc(x.valor || "")}</td><td>${esc(x.data || "")}</td></tr>`).join("")}</tbody></table></div>
        <p class="centro"><a class="btn btn-whats" data-whats="Olá, Milena! Recebi o resultado da consulta ${esc(c.numero || "")} e quero ajuda para resolver.">Quero ajuda para resolver</a></p>` : `<p>Nenhuma pendência encontrada nesta consulta. 🎉</p>`}
      <small class="consulta-fonte">Fonte: ${esc(c.fonte || "")} · consultado em ${esc(dt(c.data_consulta))}</small></div>`;
  }
  $("#conta-consultas").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-pagar-consulta]");
    if (!b || !window.ConsultasPix) return;
    const c = consultasAtuais.find((x) => x.id === b.dataset.pagarConsulta);
    const m = MG.modal(`<div class="consulta-fluxo"></div>`);
    await window.ConsultasPix.mostrarPix(m, c, {});
  });

  /* ---------- Consultas do CPF/CNPJ (E06): o cliente autoriza e vê o resultado ---------- */
  function blocoConsultas(pedidoId) {
    const lista = consultasAtuais.filter((c) => c.pedido_id === pedidoId);
    if (!lista.length) return "";
    const TIPOS = D.TIPOS_CONSULTA || {}, ST = D.STATUS_CONSULTA || {};
    const dt = (d) => (d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR") : "");
    return `<h4>Consultas do seu CPF/CNPJ</h4>` + lista.map((c) => {
      const st = ST[c.status] || { nome: c.status, cor: "cinza" };
      const nomeSt = c.status === "autorizada" ? "Autorizada — a Milena vai consultar" : st.nome;
      let corpo = "";
      if (c.status === "aguardando_autorizacao") {
        corpo = `<p>A Milena quer consultar <strong>${esc(TIPOS[c.tipo] || c.tipo)}</strong> em seu nome.</p>
          <p><strong>Para quê:</strong> ${esc(c.finalidade)}</p>
          <p class="consulta-termo">Ao autorizar, você permite essa consulta <strong>somente para este atendimento</strong>, conforme a <a href="/privacidade" target="_blank">Política de Privacidade</a> e a LGPD. A data e a hora da sua autorização ficam registradas. Você pode recusar.</p>
          <div class="botoes-form"><button type="button" class="btn btn-primario" data-consulta-resp="${esc(c.id)}" data-sim="1">Autorizo a consulta</button><button type="button" class="btn-texto" data-consulta-resp="${esc(c.id)}" data-sim="0">Não autorizo</button></div>`;
      } else if (c.status === "concluida") {
        const pend = Array.isArray(c.pendencias) ? c.pendencias : [];
        corpo = `<p class="consulta-resumo">${esc(c.resultado_resumo || "")}</p>
          ${pend.length ? `<div class="tabela-rolagem"><table class="tabela tabela-pend"><thead><tr><th>Onde</th><th>Credor</th><th>Valor</th><th>Data</th></tr></thead><tbody>${pend.map((x) => `<tr><td>${esc(x.orgao || "")}</td><td>${esc(x.credor || "")}</td><td>${esc(x.valor || "")}</td><td>${esc(x.data || "")}</td></tr>`).join("")}</tbody></table></div>` : `<p>Nenhuma pendência encontrada nesta consulta.</p>`}
          <small class="consulta-fonte">Fonte: ${esc(c.fonte || "")} · consultado em ${esc(dt(c.data_consulta))}</small>`;
      }
      const aceite = c.consentimento_texto ? `<details class="consulta-aceite"><summary>Ver a autorização que você deu</summary><p>${esc(c.consentimento_texto)}</p></details>` : "";
      return `<div class="consulta-item"><div class="consulta-cab"><strong>${esc(TIPOS[c.tipo] || c.tipo)}</strong><span class="selo-status st-${st.cor}">${esc(nomeSt)}</span></div>${corpo}${aceite}</div>`;
    }).join("");
  }

  function blocoChat(p) {
    const whats = `<a class="btn btn-contorno-rosa" data-whats="Olá! Quero falar sobre a minha solicitação ${esc(p.numero)}.">WhatsApp</a>`;
    if (D.Chat.aberto(p)) {
      const n = naoLidas[p.id] || 0;
      return `<div class="chat-bloco aberto"><div>${icone("chat")}<div><strong>Chat com a Milena</strong><small>Converse por aqui: a assistente virtual responde na hora e a Milena acompanha. As mensagens ficam na aba Mensagens.</small></div></div>
        <div class="botoes-form"><button type="button" class="btn btn-primario" data-abrir-chat="${esc(p.id)}">${icone("chat")}Abrir conversa${n ? `<span class="selo-chat" data-selo-chat="${esc(p.id)}">${n}</span>` : ""}</button>${whats}</div></div>`;
    }
    if (p.status === "cancelado") return `<div class="chat-bloco"><div>${icone("cadeado")}<div><strong>Chat encerrado</strong><small>Este pedido foi cancelado. Se precisar, fale com a gente pelo WhatsApp.</small></div></div><div class="botoes-form">${whats}</div></div>`;
    return `<div class="chat-bloco"><div>${icone("cadeado")}<div><strong>Chat com a Milena</strong><small>O chat abre assim que a Milena confirmar o seu pedido. Enquanto isso, se precisar, chame no WhatsApp.</small></div></div><div class="botoes-form">${whats}</div></div>`;
  }
  async function atualizarNaoLidas() {
    try { naoLidas = await D.Chat.naoLidas("cliente"); } catch (e) { return; }
    $$("[data-abrir-chat]").forEach((b) => {
      const n = naoLidas[b.dataset.abrirChat] || 0;
      let selo = $(".selo-chat", b);
      if (n && !selo) { b.insertAdjacentHTML("beforeend", `<span class="selo-chat">${n}</span>`); }
      else if (n) selo.textContent = n; else if (selo) selo.remove();
    });
    const total = Object.values(naoLidas).reduce((a, b) => a + b, 0);
    const aba = $('.abas [data-aba="mensagens"]');
    if (aba) aba.innerHTML = `${icone("chat")}Mensagens` + (total ? ` <span class="selo-chat">${total}</span>` : "");
  }
  /* Aba Mensagens: conversas estilo WhatsApp */
  let caixa = null;
  function montarCaixa() {
    if (caixa) return caixa;
    caixa = window.ChatUI.caixaEntrada($("#conta-mensagens"), {
      como: "cliente",
      vazio: "Suas conversas aparecem aqui assim que você fizer um pedido.",
      conversas: async () => (await C.listarPedidos()).map((p) => ({
        pedido: p, titulo: "Milena Garbim", foto: fotoMilena, nomeCliente: "Você",
        subtitulo: `Pedido ${p.numero} · ${(p.itens || []).map((i) => i.nome).join(", ")}`
      })),
      aoMudar: atualizarNaoLidas
    });
    return caixa;
  }
  function abrirChat(id) {
    abrirAba("mensagens");
    montarCaixa().abrirConversa(id);
  }
  $("#conta-pedidos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-abrir-chat]");
    if (b) abrirChat(b.dataset.abrirChat);
    const c = e.target.closest("[data-cancelar-pedido]");
    if (c) cancelarPedido(c.dataset.cancelarPedido);
    const cr = e.target.closest("[data-consulta-resp]");
    if (cr) responderConsulta(cr);
  });

  async function responderConsulta(b) {
    const sim = b.dataset.sim === "1";
    if (!sim && !(await MG.confirmar("Sem a consulta, a Milena pode não conseguir ver todas as pendências do seu nome. Deseja mesmo recusar?", { titulo: "Recusar a consulta?", botao: "Recusar" }))) return;
    b.disabled = true;
    try { await C.responderConsulta(b.dataset.consultaResp, sim); avisar(sim ? "Obrigado! Sua autorização foi registrada." : "Tudo bem, a consulta não será feita."); await desenharPedidos(); }
    catch (err) { avisar(err.message); b.disabled = false; }
  }

  /* Cancelar o próprio pedido: o motivo é obrigatório */
  function cancelarPedido(id) {
    const p = pedidosAtuais.find((x) => x.id === id);
    if (!p) return;
    const MOTIVOS = ["Pedi o serviço errado", "Desisti / não preciso mais", "Vou resolver de outra forma", "Achei que era outra coisa", "Outro motivo"];
    const m = MG.modal(`<h2>Cancelar o pedido ${esc(p.numero)}?</h2>
      <p>Conte para a Milena o motivo. Isso ajuda a melhorar o atendimento.</p>
      <form class="form-modal" novalidate>
        <div class="motivos">${MOTIVOS.map((t, i) => `<label class="aceite"><input type="radio" name="motivo" value="${esc(t)}"${i === 0 ? " checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div>
        <label class="campo"><span>Explique com suas palavras <small>(obrigatório)</small></span><textarea name="detalhe" rows="3" maxlength="400" placeholder="Ex.: escolhi Limpa Nome, mas o meu problema é no Bacen."></textarea></label>
        <div class="botoes-form"><button type="submit" class="btn btn-primario perigo-btn">Cancelar pedido</button><button type="button" class="btn-texto" data-fechar>Voltar</button></div>
      </form>`);
    const f = m.querySelector("form");
    f.detalhe.focus();
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const detalhe = f.detalhe.value.trim();
      if (detalhe.length < 10) { avisar("Explique o motivo com pelo menos 10 letras."); f.detalhe.focus(); return; }
      const motivo = (f.motivo.value || "Outro motivo") + " — " + detalhe;
      const b = f.querySelector("button[type=submit]"); b.disabled = true;
      try { await C.cancelarPedido(id, motivo); m.closest(".modal-fundo").remove(); avisar("Pedido cancelado. A Milena foi avisada."); await desenharPedidos(); }
      catch (err) { avisar(err.message); b.disabled = false; }
    });
  }

  /* Avisos no celular/computador do cliente: pede a cada visita enquanto não estiver ativo */
  async function oferecerAvisos() {
    if (!D.online || !D.Push || !D.Push.suportado() || !pedidosAtuais.length) return;
    if (!D.moduloLigado("notificacoes")) return;
    if (await D.Push.sincronizar(true)) return;
    if (Notification.permission === "denied") return;
    try { if (sessionStorage.getItem("mg_push_depois")) return; } catch (e) { /* ok */ }
    if ($(".modal-fundo")) return;
    const m = MG.modal(`<div class="pedir-push"><span class="ic-2fa">🔔</span><h2>Quer ser avisado na hora?</h2>
      <p>Ative as notificações para saber assim que a Milena responder ou o seu pedido mudar de situação.</p>
      <div class="botoes-form"><button type="button" class="btn btn-primario" data-sim-push>Ativar notificações</button><button type="button" class="btn-texto" data-fechar data-depois>Agora não</button></div></div>`);
    m.querySelector("[data-depois]").addEventListener("click", () => { try { sessionStorage.setItem("mg_push_depois", "1"); } catch (e) { /* ok */ } });
    const sim = m.querySelector("[data-sim-push]");
    sim.addEventListener("click", async () => {
      sim.disabled = true;
      try { await D.Push.ativar(true); m.closest(".modal-fundo").remove(); avisar("Pronto! Você será avisado quando houver novidade no seu pedido."); }
      catch (err) { avisar(err.message); sim.disabled = false; }
    });
  }

  function desenharDados() {
    const p = C.perfil || {};
    const linha = (r, v) => v ? `<div><dt>${esc(r)}</dt><dd>${esc(v)}</dd></div>` : "";
    const end = [p.logradouro && `${p.logradouro}${p.numero ? ", " + p.numero : ""}${p.complemento ? " - " + p.complemento : ""}`, p.bairro, p.cidade && `${p.cidade}/${p.uf}`, p.cep].filter(Boolean).join(" · ");
    $("#conta-dados").innerHTML = `<dl class="lista-dados">
      ${p.tipo === "pj" ? linha("Razão social", p.razao_social) + linha("Nome fantasia", p.nome_fantasia) + linha("CNPJ", p.cnpj) + linha("Responsável", p.responsavel) : linha("Nome", p.nome) + linha("CPF", p.cpf)}
      ${linha("E-mail", C.usuario.email)}${linha("Telefone", p.telefone)}${linha("Endereço", end)}
    </dl><button type="button" class="btn btn-contorno-rosa" id="editar-dados">${icone("lapis")}Editar meus dados</button>`;
    $("#editar-dados").addEventListener("click", () => { editando = true; decidir(); });
  }

  /* =========================================================
     Qual tela mostrar
     ========================================================= */
  async function decidir(acabouDeEntrar) {
    if (!C.usuario) { mostrar("conta-entrar"); return; }
    if (voltar && (voltar !== "/consultas" || C.perfilCompleto())) { location.href = voltar; return; }   // consultas precisam do cadastro completo (CPF/CNPJ)
    if (!C.perfilCompleto() || editando) {
      // a equipe pode ir direto ao painel sem cadastro de cliente
      preencherCadastro(C.perfil);
      $("#k-cancelar").hidden = !editando;
      mostrar("conta-cadastro");
      if (!editando) D.Painel.meuPapel().then((papel) => {
        if (papel && !$("#aviso-equipe")) form.insertAdjacentHTML("afterbegin", `<p id="aviso-equipe" class="aviso-cliente">${icone("painel")}Você é da equipe. <a href="/admin">Ir para o painel</a> — o cadastro abaixo é só para quem também é cliente.</p>`);
      });
      return;
    }
    if (acabouDeEntrar && querEnviar && window.Solicitacao && window.Solicitacao.ids().length) { location.href = "/servicos?solicitacao=1"; return; }
    $("#conta-nome").textContent = C.nomeExibicao();
    $("#conta-email").textContent = C.usuario.email;
    mostrar("conta-painel");
    desenharDados();
    await desenharPedidos();
    atualizarNaoLidas();
    if (!ouvindo) ouvindo = D.Chat.ouvir(null, atualizarNaoLidas);
    D.modulos().then(() => { const tem = consultasAtuais.some((c) => c.origem === "cliente"); $("[data-aba-consultas]").hidden = !(tem || D.moduloLigado("consultas")); if (params.get("aba") === "consultas" && !$("[data-aba-consultas]").hidden) abrirAba("consultas"); }).catch(() => {});
    const pedirChat = params.get("chat");
    if (pedirChat) abrirChat(pedirChat);
    D.Painel.meuPapel().then((papel) => { $("#link-painel").hidden = !papel; if (!papel) setTimeout(oferecerAvisos, 1200); }).catch(() => {});
  }

  window.ContaPronta.then(() => decidir(false)).catch(() => mostrar("conta-entrar"));
})();
