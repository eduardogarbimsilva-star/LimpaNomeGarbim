/* =========================================================
   Seus direitos — calculadoras
   - Prazo máximo da negativação (5 anos do vencimento: CDC art. 43 §1º, Súmula 323 STJ)
   - Prazo de baixa depois do pagamento (5 dias úteis: Súmula 548 STJ)
   A conta é feita no aparelho da pessoa; nada é enviado.
   ========================================================= */
(function () {
  "use strict";
  const $ = (s, el) => (el || document).querySelector(s);
  const DIA = 86400000;
  const fmtData = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const lerData = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const chave = (d) => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  /* Feriados nacionais (fixos + Sexta-feira Santa). Feriados estaduais e municipais não entram. */
  function pascoa(a) {
    const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4, g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3);
    const i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4, m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451);
    const mes = Math.floor((i + m - 7 * n + 114) / 31), dia = ((i + m - 7 * n + 114) % 31) + 1;
    return new Date(a, mes - 1, dia);
  }
  function feriados(ano) {
    const fixos = [[1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25]].map(([m, d]) => new Date(ano, m - 1, d));
    const sexta = new Date(pascoa(ano).getTime() - 2 * DIA);
    return new Set(fixos.concat(sexta).map(chave));
  }
  function somarDiasUteis(inicio, n) {
    const d = new Date(inicio);
    let cont = 0, cache = {};
    while (cont < n) {
      d.setDate(d.getDate() + 1);
      const fs = cache[d.getFullYear()] || (cache[d.getFullYear()] = feriados(d.getFullYear()));
      if (d.getDay() !== 0 && d.getDay() !== 6 && !fs.has(chave(d))) cont++;
    }
    return d;
  }

  const zap = () => String((window.SITE_CONFIG || {}).whatsapp || "").replace(/\D/g, "");
  const botaoZap = (texto) => zap() ? `<a class="btn btn-whats" target="_blank" rel="noopener" href="https://wa.me/${zap()}?text=${encodeURIComponent(texto)}">Falar com a Milena</a>` : `<a class="btn btn-primario" href="/#analise">Pedir análise</a>`;

  function calcular(form) {
    const tipo = form.getAttribute("data-calc");
    const out = $(".calc-resultado", form);
    const data = lerData(form.data.value);
    out.hidden = false;
    out.className = "calc-resultado";
    if (!data) { out.innerHTML = "<p>Escolha uma data para calcular.</p>"; return; }
    if (data > hoje()) { out.innerHTML = "<p>Essa data ainda não chegou. Confira o dia, o mês e o ano.</p>"; return; }

    if (tipo === "prazo") {
      const limite = new Date(data); limite.setFullYear(limite.getFullYear() + 5);
      if (hoje() > limite) {
        out.classList.add("alerta");
        out.innerHTML = `<strong>Já passou do prazo.</strong>
          <p>O registro só poderia ficar até <b>${fmtData(limite)}</b>. Se ainda aparece no SPC, Serasa, Boa Vista ou Cenprot, ele deve ser retirado.</p>
          <p class="calc-obs">A dívida não deixa de existir — mas a negativação tem limite. Atenção: plataformas de acordo (como o “Limpa Nome” do Serasa) não são negativação.</p>
          ${botaoZap("Olá, Milena! Usei a calculadora do site: tenho uma negativação com vencimento em " + data.toLocaleDateString("pt-BR") + ", que já passou de 5 anos. Pode me ajudar?")}`;
      } else {
        const dias = Math.ceil((limite - hoje()) / DIA);
        out.classList.add("ok");
        out.innerHTML = `<strong>Ainda dentro do prazo.</strong>
          <p>Esse registro pode ficar até <b>${fmtData(limite)}</b> (faltam ${dias.toLocaleString("pt-BR")} dias). Antes disso, dá para sair negociando ou contestando — se for indevido.</p>
          ${botaoZap("Olá, Milena! Usei a calculadora do site: tenho uma dívida com vencimento em " + data.toLocaleDateString("pt-BR") + ". Quero entender o melhor caminho.")}`;
      }
    } else {
      const limite = somarDiasUteis(data, 5);
      if (hoje() > limite) {
        out.classList.add("alerta");
        out.innerHTML = `<strong>O prazo do credor acabou.</strong>
          <p>A retirada deveria ter sido pedida até <b>${fmtData(limite)}</b>. Guarde o comprovante: é possível exigir a baixa e, em muitos casos, indenização.</p>
          <p class="calc-obs">Contamos dias úteis com feriados nacionais. Pagamentos fora do horário bancário contam a partir do dia útil seguinte.</p>
          ${botaoZap("Olá, Milena! Paguei uma dívida em " + data.toLocaleDateString("pt-BR") + " e meu nome continua negativado. Pode me ajudar?")}`;
      } else {
        out.classList.add("ok");
        out.innerHTML = `<strong>Ainda dentro do prazo do credor.</strong>
          <p>O credor tem até <b>${fmtData(limite)}</b> para pedir a retirada. Depois disso, as consultas podem levar mais alguns dias para atualizar.</p>
          <p class="calc-obs">Se passar dessa data e o nome continuar negativado, fale com a gente.</p>`;
      }
    }
  }

  document.querySelectorAll("[data-calc]").forEach((form) => {
    const inp = form.data;
    if (inp) inp.max = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    form.addEventListener("submit", (e) => { e.preventDefault(); calcular(form); });
  });
})();
