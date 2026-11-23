/* =========================================================
   Diagnóstico inteligente (E05)
   Motor de perguntas condicionais com regras versionadas no banco.
   - Só usa as respostas da pessoa: não consulta CPF, não inventa dados.
   - O resultado mostra "por que" foi indicado (explicação da regra).
   - Enquanto o módulo "Diagnóstico inteligente" estiver desligado,
     o questionário antigo de 3 perguntas continua igual.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Validação das regras (usada no painel antes de salvar) ---------- */
  function validar(r) {
    const erros = [];
    if (!r || typeof r !== "object") return ["As regras precisam ser um objeto JSON."];
    const P = r.perguntas || {};
    const ids = Object.keys(P);
    if (!ids.length) erros.push("Nenhuma pergunta cadastrada.");
    if (!P[r.inicio]) erros.push(`A pergunta inicial "${r.inicio}" não existe.`);
    const valores = {};
    ids.forEach((id) => {
      const q = P[id];
      if (!q.texto) erros.push(`Pergunta "${id}" sem texto.`);
      if (!Array.isArray(q.opcoes) || q.opcoes.length < 2) erros.push(`Pergunta "${id}" precisa de pelo menos 2 opções.`);
      valores[id] = new Set();
      (q.opcoes || []).forEach((o, i) => {
        if (!o.valor || !o.texto) erros.push(`Pergunta "${id}", opção ${i + 1}: falta valor ou texto.`);
        if (valores[id].has(o.valor)) erros.push(`Pergunta "${id}": valor "${o.valor}" repetido.`);
        valores[id].add(o.valor);
        if (o.ir !== "fim" && !P[o.ir]) erros.push(`Pergunta "${id}", opção "${o.valor}": vai para "${o.ir}", que não existe.`);
      });
    });
    // sem voltas infinitas
    const visitando = new Set(), feito = new Set();
    const ciclo = (id) => {
      if (feito.has(id)) return false;
      if (visitando.has(id)) return true;
      visitando.add(id);
      const tem = (P[id].opcoes || []).some((o) => o.ir !== "fim" && P[o.ir] && ciclo(o.ir));
      visitando.delete(id); feito.add(id);
      return tem;
    };
    if (P[r.inicio] && ciclo(r.inicio)) erros.push("As perguntas fazem uma volta sem fim (ciclo).");
    const confere = (se, onde) => Object.entries(se || {}).forEach(([q, vs]) => {
      if (!P[q]) erros.push(`${onde}: pergunta "${q}" não existe.`);
      else (vs || []).forEach((v) => { if (!valores[q].has(v)) erros.push(`${onde}: "${q}" não tem a opção "${v}".`); });
    });
    if (!Array.isArray(r.resultados) || !r.resultados.length) erros.push("Nenhum resultado cadastrado.");
    (r.resultados || []).forEach((x, i) => {
      if (!x.titulo || !x.explicacao) erros.push(`Resultado ${i + 1}: falta título ou explicação.`);
      if (!Array.isArray(x.servicos)) erros.push(`Resultado ${i + 1}: "servicos" deve ser uma lista.`);
      confere(x.se, `Resultado "${x.id || i + 1}"`);
    });
    if (!(r.resultados || []).some((x) => !x.se || !Object.keys(x.se).length)) erros.push('Falta um resultado padrão (com "se": {}) para quando nenhuma regra servir.');
    (r.notas || []).forEach((n, i) => confere(n.se, `Nota ${i + 1}`));
    return erros;
  }

  /* ---------- Avaliação: primeira regra que combina com as respostas ---------- */
  const combina = (se, resp) => Object.entries(se || {}).every(([q, vs]) => resp[q] !== undefined && vs.includes(resp[q]));
  function avaliar(r, resp) {
    const resultado = (r.resultados || []).find((x) => combina(x.se, resp));
    const notas = (r.notas || []).filter((n) => combina(n.se, resp)).map((n) => n.texto);
    return { resultado, notas };
  }

  /** Todos os caminhos possíveis (para testes e para o simulador do painel) */
  function caminhos(r) {
    const saida = [];
    const andar = (id, resp) => {
      (r.perguntas[id].opcoes || []).forEach((o) => {
        const nova = Object.assign({}, resp, { [id]: o.valor });
        if (o.ir === "fim") saida.push(nova); else andar(o.ir, nova);
      });
    };
    andar(r.inicio, {});
    return saida;
  }

  /* ---------- Interface ---------- */
  function montar(raiz, r, opcoes) {
    const o = Object.assign({ catalogo: { servicos: [] }, esc: (t) => String(t), icone: () => "", whats: () => "", aoSolicitar: null, versao: null }, opcoes || {});
    const { esc, icone } = o;
    let resp = {}, historico = [];
    // estimativa de passos restantes: maior caminho a partir de cada pergunta
    const memo = {};
    const fundo = (id) => memo[id] ?? (memo[id] = 1 + Math.max(0, ...r.perguntas[id].opcoes.map((x) => (x.ir === "fim" ? 0 : fundo(x.ir)))));

    function pergunta(id) {
      const q = r.perguntas[id];
      const feitos = historico.length, total = feitos + fundo(id);
      raiz.innerHTML = `<div class="quiz-barra"><span style="width:${Math.round(feitos / total * 100)}%"></span></div>
        <div class="quiz-passo ativo"><span class="quiz-num">Pergunta ${feitos + 1}${total > feitos + 1 ? ` de até ${total}` : ""}</span>
        <h3>${esc(q.texto)}</h3>
        <div class="quiz-ops">${q.opcoes.map((x) => `<button type="button" class="quiz-op" data-diag-op="${esc(x.valor)}">${esc(x.texto)}</button>`).join("")}</div>
        ${historico.length ? `<button type="button" class="btn-texto quiz-voltar" data-diag-voltar>← Voltar</button>` : ""}</div>`;
      raiz.dataset.pergunta = id;
      const primeiro = raiz.querySelector(".quiz-op");
      if (primeiro && o.focar) primeiro.focus();
      o.focar = true;
    }

    function resultadoTela() {
      const { resultado, notas } = avaliar(r, resp);
      const ativos = (resultado.servicos || []).map((id) => o.catalogo.servicos.find((s) => s.id === id)).filter(Boolean);
      const linhas = historico.map((id) => { const q = r.perguntas[id]; const op = q.opcoes.find((x) => x.valor === resp[id]); return { q: q.texto, a: op ? op.texto : resp[id] }; });
      const resumo = "Olá, Milena! Fiz o diagnóstico no site:\n" + linhas.map((l) => `• ${l.q} ${l.a}`).join("\n") + `\nIndicação: ${resultado.titulo}`;
      const link = o.whats(resumo);
      raiz.innerHTML = `<div class="quiz-barra"><span style="width:100%"></span></div>
        <div class="quiz-resultado aparece"><span class="quiz-num">Seu resultado</span>
        <h3>Caminho indicado: <em>${esc(resultado.titulo)}</em></h3>
        <div class="diag-porque"><strong>Por que indicamos isso</strong><p>${esc(resultado.explicacao)}</p></div>
        ${notas.map((n) => `<p class="quiz-nota">${icone("alerta")}${esc(n)}</p>`).join("")}
        <div class="quiz-indicados">${ativos.slice(0, 3).map((s) => `<div class="quiz-servico"><div><strong>${esc(s.nome)}</strong><small>${esc(s.resumo || "")}</small></div>
          ${o.aoSolicitar ? `<button type="button" class="btn btn-primario" data-quiz-solicitar="${esc(s.id)}">${icone("mais")}Solicitar</button>` : ""}</div>`).join("")}</div>
        <details class="diag-respostas"><summary>Suas respostas</summary><ul>${linhas.map((l) => `<li><span>${esc(l.q)}</span> <strong>${esc(l.a)}</strong></li>`).join("")}</ul></details>
        <div class="botoes-form">
          ${link ? `<a class="btn btn-whats" href="${esc(link)}" target="_blank" rel="noopener">Falar com a Milena</a>` : ""}
          <button type="button" class="btn-texto" data-diag-refazer>Refazer</button>
        </div>
        <p class="quiz-aviso">Orientação inicial baseada só nas suas respostas — nada foi consultado no seu CPF. A análise com a Milena confirma o melhor caminho.${o.versao ? ` <span class="diag-versao">Regras v${esc(o.versao)}</span>` : ""}</p></div>`;
      raiz.dataset.resultado = resultado.id || "";
    }

    raiz.addEventListener("click", (e) => {
      const op = e.target.closest("[data-diag-op]");
      if (op) {
        const id = raiz.dataset.pergunta, q = r.perguntas[id];
        const escolha = q.opcoes.find((x) => x.valor === op.dataset.diagOp);
        resp[id] = escolha.valor; historico.push(id);
        op.classList.add("escolhida");
        setTimeout(() => (escolha.ir === "fim" ? resultadoTela() : pergunta(escolha.ir)), 200);
        return;
      }
      if (e.target.closest("[data-diag-voltar]")) { const id = historico.pop(); delete resp[id]; pergunta(id); return; }
      if (e.target.closest("[data-diag-refazer]")) { resp = {}; historico = []; pergunta(r.inicio); return; }
      const sol = e.target.closest("[data-quiz-solicitar]");
      if (sol && o.aoSolicitar) o.aoSolicitar(sol.dataset.quizSolicitar);
    });
    o.focar = false;
    pergunta(r.inicio);
    return { responder: (id, valor) => { resp[id] = valor; } };
  }

  window.Diagnostico = { validar, avaliar, caminhos, montar };
})();
