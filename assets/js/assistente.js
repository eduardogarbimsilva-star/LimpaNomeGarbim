/* =========================================================
   Milena Garbim · Limpa Nome — Assistente virtual (IA)
   - Com a função "assistente" do Supabase ligada: respostas da IA (Claude) em tempo real
   - Sem ela (ou se falhar): modo básico, que responde com as dúvidas e serviços do site
   ========================================================= */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const CFG = window.SITE_CONFIG || {}, SB = CFG.supabase || {}, D = window.Dados, MG = window.MG || {};
  const esc = MG.esc || ((t) => String(t));
  const ENDPOINT = (CFG.assistente && CFG.assistente.endpoint) || (SB.url ? SB.url.replace(/\/$/, "") + "/functions/v1/assistente" : "");
  const CHAVE = "mg_assistente";
  const MARCAS = { DIAGNOSTICO: ["Fazer o diagnóstico", "index.html#diagnostico"], SERVICOS: ["Ver serviços", "servicos.html"], WHATSAPP: ["Falar com a Milena", "whatsapp"], CONTA: ["Minha conta", "conta.html"] };
  const SUGESTOES = ["O que é limpar o nome?", "Como funciona o Bacen?", "Quanto custa?", "Quais documentos preciso?", "Quanto tempo demora?"];
  const BOAS_VINDAS = "Oi! Sou a assistente virtual da Milena Garbim ✨ Posso tirar suas dúvidas sobre nome sujo, Bacen, score e os nossos serviços. Como posso ajudar?";

  let conversa = [];
  try { conversa = JSON.parse(sessionStorage.getItem(CHAVE)) || []; } catch (e) { conversa = []; }
  const guardar = () => { try { sessionStorage.setItem(CHAVE, JSON.stringify(conversa.slice(-30))); } catch (e) { /* ok */ } };
  let modoBasico = !ENDPOINT, respondendo = false;

  /* ---------- Texto da resposta: negrito, listas, quebras e botões ---------- */
  function separarMarcas(texto) {
    const acoes = [];
    const limpo = texto.replace(/\[(DIAGNOSTICO|SERVICOS|WHATSAPP|CONTA)\]/g, (_, m) => { if (!acoes.includes(m)) acoes.push(m); return ""; })
      .replace(/\[[A-Z]{0,12}$/, "").trim();
    return { limpo, acoes };
  }
  function formatar(t) {
    const linhas = esc(t).split("\n");
    let html = "", lista = false;
    linhas.forEach((l) => {
      const item = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/);
      if (item) { if (!lista) { html += "<ul>"; lista = true; } html += `<li>${item[1]}</li>`; return; }
      if (lista) { html += "</ul>"; lista = false; }
      if (l.trim()) html += `<p>${l}</p>`;
    });
    if (lista) html += "</ul>";
    return html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }
  function linkWhats() {
    const n = String(CFG.whatsapp || "").replace(/\D/g, "");
    const ultima = [...conversa].reverse().find((m) => m.role === "user");
    const texto = "Olá, Milena! Vim pela assistente do site" + (ultima ? ` e minha dúvida é: ${ultima.content}` : ".");
    return n ? "https://wa.me/" + n + "?text=" + encodeURIComponent(texto) : "index.html#analise";
  }
  function botoes(acoes) {
    return acoes.length ? `<div class="ia-acoes">${acoes.map((a) => {
      const [rot, destino] = MARCAS[a];
      return destino === "whatsapp" ? `<a class="ia-acao whats" href="${esc(linkWhats())}" target="_blank" rel="noopener">${rot}</a>` : `<a class="ia-acao" href="${destino}" data-ia-fechar-ir>${rot}</a>`;
    }).join("")}</div>` : "";
  }

  /* ---------- Janela ---------- */
  const foto = "assets/img/milena-garbim-avatar.jpg";
  const botao = document.createElement("button");
  botao.type = "button"; botao.className = "ia-abrir"; botao.setAttribute("aria-label", "Abrir a assistente virtual");
  botao.innerHTML = `<span class="ia-abrir-foto"><img src="${foto}" alt="" data-foto="avatar"><i>✨</i></span><span class="ia-abrir-texto"><strong>Dúvidas?</strong><small>Pergunte à assistente</small></span>`;
  const janela = document.createElement("section");
  janela.className = "ia-janela"; janela.hidden = true; janela.setAttribute("role", "dialog"); janela.setAttribute("aria-label", "Assistente virtual");
  janela.innerHTML = `<header class="ia-cab">
      <span class="ia-foto"><img src="${foto}" alt="" data-foto="avatar"><i>✨</i></span>
      <div><strong>Assistente virtual</strong><small class="ia-status">Inteligência artificial · responde na hora</small></div>
      <button type="button" class="ia-limpar" title="Nova conversa" aria-label="Começar nova conversa">↺</button>
      <button type="button" class="modal-fechar" data-ia-fechar aria-label="Fechar">×</button>
    </header>
    <div class="ia-mensagens" aria-live="polite"></div>
    <div class="ia-sugestoes">${SUGESTOES.map((s) => `<button type="button">${esc(s)}</button>`).join("")}</div>
    <form class="ia-envio">
      <textarea rows="1" maxlength="1500" placeholder="Escreva sua dúvida..." aria-label="Sua pergunta"></textarea>
      <button type="submit" aria-label="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg></button>
    </form>
    <p class="ia-aviso">Assistente com IA: pode errar. Não envie CPF, senhas ou documentos aqui. Para seu caso, fale com a Milena.</p>`;
  document.body.appendChild(botao);
  document.body.appendChild(janela);
  const caixa = $(".ia-mensagens", janela), form = $(".ia-envio", janela), campo = $("textarea", form);

  function bolha(m) {
    if (m.role === "user") return `<div class="chat-msg minha"><p>${esc(m.content).replace(/\n/g, "<br>")}</p></div>`;
    const { limpo, acoes } = separarMarcas(m.content);
    return `<div class="chat-msg dele ia-msg"><span class="chat-quem">Assistente${m.basico ? " · modo básico" : ""}</span>${formatar(limpo)}${botoes(acoes)}</div>`;
  }
  function desenhar() {
    $(".ia-status", janela).textContent = modoBasico ? "Modo básico · respostas do site" : "Inteligência artificial · responde na hora";
    caixa.innerHTML = bolha({ role: "assistant", content: BOAS_VINDAS }) + conversa.map(bolha).join("");
    $(".ia-sugestoes", janela).hidden = conversa.length > 0;
    caixa.scrollTop = caixa.scrollHeight;
  }
  function abrir() {
    janela.hidden = false; botao.classList.add("aberto");
    document.body.classList.add("ia-aberta");
    desenhar();
    if (matchMedia("(pointer: fine)").matches) setTimeout(() => campo.focus({ preventScroll: true }), 60);
  }
  function fechar() { janela.hidden = true; botao.classList.remove("aberto"); document.body.classList.remove("ia-aberta"); }
  botao.addEventListener("click", () => (janela.hidden ? abrir() : fechar()));
  janela.addEventListener("click", (e) => {
    if (e.target.closest("[data-ia-fechar]")) fechar();
    if (e.target.closest("[data-ia-fechar-ir]")) fechar();
    const s = e.target.closest(".ia-sugestoes button");
    if (s) perguntar(s.textContent);
  });
  $(".ia-limpar", janela).addEventListener("click", () => { conversa = []; guardar(); desenhar(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !janela.hidden) fechar(); });
  document.addEventListener("click", (e) => { if (e.target.closest("[data-abrir-assistente]")) { e.preventDefault(); abrir(); } });
  campo.addEventListener("input", () => { campo.style.height = "auto"; campo.style.height = Math.min(campo.scrollHeight, 120) + "px"; });
  campo.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener("submit", (e) => { e.preventDefault(); perguntar(campo.value); });

  /* ---------- Perguntar ---------- */
  async function perguntar(texto) {
    texto = String(texto || "").trim().slice(0, 1500);
    if (!texto || respondendo) return;
    respondendo = true;
    campo.value = ""; campo.style.height = "auto";
    conversa.push({ role: "user", content: texto });
    desenhar();
    const bolhaIA = document.createElement("div");
    bolhaIA.className = "chat-msg dele ia-msg";
    bolhaIA.innerHTML = `<span class="chat-quem">Assistente</span><span class="digitando"><i></i><i></i><i></i></span>`;
    caixa.appendChild(bolhaIA); caixa.scrollTop = caixa.scrollHeight;
    let resposta = "", basico = false;
    try {
      if (modoBasico) throw new Error("básico");
      resposta = await perguntarIA(bolhaIA);
    } catch (err) {
      if (!resposta) { basico = true; modoBasico = modoBasico || /básico|Failed to fetch|404|fetch/i.test(String(err.message)); resposta = await respostaBasica(texto); }
    }
    conversa.push({ role: "assistant", content: resposta, basico });
    guardar();
    respondendo = false;
    desenhar();
  }

  async function perguntarIA(bolhaIA) {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SB.anonKey || "", Authorization: "Bearer " + (SB.anonKey || "") },
      body: JSON.stringify({ mensagens: conversa.map(({ role, content }) => ({ role, content })) })
    });
    if (!r.ok || !r.body) {
      let msg = "falha " + r.status;
      try { msg = (await r.json()).erro || msg; } catch (e) { /* ok */ }
      if (r.status === 429) return msg + "\n[WHATSAPP]";
      throw new Error(msg);
    }
    const leitor = r.body.getReader(), dec = new TextDecoder();
    let buffer = "", texto = "";
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      const partes = buffer.split("\n\n");
      buffer = partes.pop();
      for (const p of partes) {
        const linha = p.split("\n").find((l) => l.startsWith("data: "));
        if (!linha) continue;
        const ev = JSON.parse(linha.slice(6));
        if (ev.tipo === "texto") {
          texto += ev.t;
          const { limpo } = separarMarcas(texto);
          bolhaIA.innerHTML = `<span class="chat-quem">Assistente</span>${formatar(limpo)}`;
          caixa.scrollTop = caixa.scrollHeight;
        } else if (ev.tipo === "erro") {
          if (!texto) throw new Error(ev.mensagem);
          texto += "\n\n" + ev.mensagem;
        }
      }
    }
    if (!texto.trim()) throw new Error("resposta vazia");
    return texto;
  }

  /* ---------- Modo básico: responde com o conteúdo do site ---------- */
  const normal = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const PARADAS = new Set("o a os as um uma de do da dos das e em no na nos nas que qual quais como para pra por com meu minha eu voce se ser e sao tem ter ja mais muito isso esse essa ou ao".split(" "));
  const palavras = (t) => normal(t).split(/[^a-z0-9]+/).filter((p) => p.length > 2 && !PARADAS.has(p));
  async function respostaBasica(pergunta) {
    const q = normal(pergunta), termos = palavras(pergunta);
    if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|opa)\b/.test(q) && termos.length <= 2) return "Oi! Que bom ter você aqui 😊 Me conta: seu nome está negativado, o banco está negando crédito ou é outra situação?\n[DIAGNOSTICO]";
    if (/(humano|atendente|pessoa|milena|whats|zap|telefone|ligar|falar com)/.test(q)) return "Claro! A Milena atende pessoalmente pelo WhatsApp, no horário de atendimento. Toque no botão abaixo e a mensagem já vai pronta.\n[WHATSAPP]";
    if (/(quanto custa|preco|valor|cobra|taxa|pagar pelo)/.test(q)) return "O valor depende de cada caso: primeiro a Milena faz a análise (sem compromisso) e depois envia uma proposta por escrito, antes de qualquer pagamento. Nada é cobrado pelo site.\n[DIAGNOSTICO]\n[WHATSAPP]";
    if (/(documento|documentos|preciso levar|o que preciso)/.test(q)) return "Para começar, ajuda ter:\n- Documento com foto (RG ou CNH)\n- Contratos, faturas ou boletos das dívidas\n- Comprovantes de pagamentos já feitos\nSe não tiver tudo, sem problema: a Milena ajuda a levantar o resto.\n[SERVICOS]";
    let cat = { categorias: [], servicos: [] }, site = { faq: [] };
    try { [cat, site] = await Promise.all([D.catalogo(true), D.site()]); } catch (e) { /* segue com o que tiver */ }
    const candidatos = [];
    (site.faq || []).forEach((f) => candidatos.push({ texto: f.r, chave: f.p + " " + f.r, peso: 1.2 }));
    cat.servicos.forEach((s) => {
      const c = cat.categorias.find((x) => x.id === s.categoria) || {};
      candidatos.push({ texto: `**${s.nome}**: ${s.resumo || ""}${(s.itens || []).length ? "\n" + s.itens.map((i) => "- " + i).join("\n") : ""}`, chave: [c.nome, s.nome, s.resumo, s.descricao].join(" "), peso: 1, servico: true });
    });
    let melhor = null, nota = 0;
    candidatos.forEach((c) => {
      const chave = new Set(palavras(c.chave));
      const n = termos.reduce((t, p) => t + (chave.has(p) || [...chave].some((k) => k.startsWith(p.slice(0, 5))) ? 1 : 0), 0) * c.peso;
      if (n > nota) { nota = n; melhor = c; }
    });
    if (melhor && nota >= 1) return melhor.texto + (melhor.servico ? "\n[SERVICOS]\n[WHATSAPP]" : "\n[DIAGNOSTICO]");
    return "Não encontrei essa resposta por aqui, mas a Milena pode te ajudar pessoalmente. Se quiser, faça também o diagnóstico gratuito de 30 segundos.\n[WHATSAPP]\n[DIAGNOSTICO]";
  }
})();
