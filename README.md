# Milena Garbim · Limpa Nome — site institucional

Site estático (HTML, CSS e JavaScript puro — sem build, sem servidor) da **Limpa Nome Garbim**, assessoria de
crédito e recuperação do nome. Fundadora, proprietária e acionista: **Milena Garbim**.

Identidade visual clara e suave (rosa, nude, champanhe e ameixa), com a marca **MILENA GARBIM** ao lado da foto
dela no cabeçalho e a **assinatura** em letra cursiva (fonte Great Vibes) no topo, na seção da fundadora, no
formulário, nas chamadas e no rodapé. As cores ficam em variáveis no início de `assets/css/style.css`.

Segue o mesmo padrão do site da Policoating (repositório Color-Weg): páginas estáticas, `config.js` com os dados
da empresa e atendimento fechado pelo **WhatsApp**.

## Páginas

| Página | Conteúdo |
|---|---|
| `index.html` | Destaque com medidor de score, selos, "você se identifica?", serviços, como funciona, Milena Garbim, formulário de análise, dúvidas |
| `servicos.html` | Os 6 serviços em detalhe, CPF x CNPJ e aviso de transparência |
| `como-funciona.html` | Passo a passo, documentos para ter em mãos e direitos do consumidor (CDC) |
| `sobre.html` | Milena Garbim, missão/visão/valores e compromissos |
| `duvidas.html` | Perguntas frequentes (com dados estruturados para o Google) e alerta contra golpes |
| `privacidade.html` | Política de Privacidade (LGPD) |
| `404.html` | Página de "não encontrado" (usada automaticamente pelo GitHub Pages) |

## O que preencher antes de publicar

Tudo em [`assets/js/config.js`](assets/js/config.js):

- `whatsapp` — número com 55 + DDD, só dígitos (ex.: `"5516999999999"`). **Enquanto estiver vazio**, os botões
  de WhatsApp levam ao formulário e o formulário usa o e-mail (se houver).
- `telefone`, `email`, `cnpj`, `horario`, `endereco` — aparecem no topo e no rodapé (vazios ficam escondidos).
- `redes` — Instagram, Facebook, TikTok, YouTube (vazio esconde o ícone).

**Fotos da Milena** (em `assets/img/`): `milena-garbim.jpg` (original), `milena-garbim-retrato.jpg` (recorte 4:5
usado no topo e em Quem somos) e `milena-garbim-avatar.jpg` (rosto, usado na marca do cabeçalho e no formulário).
Para trocar a foto, substitua esses arquivos mantendo os nomes.

## Formulário de análise

Não grava nada em servidor: monta a mensagem (nome, WhatsApp, cidade, serviço, faixa de valor, órgãos onde está
negativado e detalhes) e abre o WhatsApp com ela pronta. Não pede CPF nem senhas. Os cartões de serviço levam ao
formulário já com o serviço selecionado (`index.html?servico=...#analise`).

## Publicar no GitHub Pages

1. **Settings → Pages → Build and deployment → Deploy from a branch**, escolha a branch e a pasta `/ (root)`.
2. Com domínio próprio: crie o arquivo `CNAME` com o domínio (ex.: `limpanomegarbim.com.br`), aponte o DNS para o
   GitHub Pages e acrescente `Sitemap: https://SEU-DOMINIO/sitemap.xml` no `robots.txt` com um `sitemap.xml`.

## Cuidados com o conteúdo

O texto evita promessas que o setor não pode cumprir ("apagar dívida", "score garantido") e deixa claro que a
empresa não é órgão de proteção ao crédito. Ao editar, mantenha esse tom: é o que diferencia uma assessoria séria
e evita problemas com o Código de Defesa do Consumidor. Depoimentos só devem ser publicados se forem reais e
autorizados pelos clientes.
