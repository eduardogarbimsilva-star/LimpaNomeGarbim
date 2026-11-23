#!/usr/bin/env python3
"""
Sugestões de texto para os 20 produtos do Portfólio Ditto (E04b).
O PDF só traz nome, pergunta e logotipos; estas explicações são descrições
GERAIS de cada tipo de produto, para facilitar a revisão. Sem taxas, prazos
ou promessa de aprovação. Ficam como rascunho até a Milena confirmar com o parceiro.

Gera: supabase/e04b_sugestoes_ditto.sql (só preenche onde ainda está vazio)
Uso:  python3 ferramentas/sugestoes_ditto.py
"""
import json, os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = "Documento com foto (RG ou CNH)"
P = {
 "DITTO-01": ("Empréstimo para quem trabalha com carteira assinada em empresa privada, com as parcelas descontadas direto do salário. Por ter desconto em folha, costuma ter juros menores que o crédito pessoal comum.",
   ["Trabalhar com carteira assinada (CLT)", "Ter margem consignável disponível"], [DOC, "CPF", "Comprovante de residência", "Holerite recente", "Carteira de Trabalho Digital"],
   "C6 Bank, Facta, Hand+, Prata Digital, V8 Digital e outras"),
 "DITTO-02": ("Antecipa parcelas do saque-aniversário do FGTS: o valor é pago de uma vez e as parcelas são quitadas com o próprio saldo do FGTS, sem desconto no salário.",
   ["Ter saldo no FGTS", "Ter aderido ao saque-aniversário no aplicativo FGTS", "Autorizar a instituição no aplicativo FGTS"], [DOC, "CPF", "Conta bancária em seu nome"],
   "Prata Digital, Facta, icred, VCTex"),
 "DITTO-03": ("Usa o limite disponível do seu cartão de crédito para liberar dinheiro na conta. O valor é parcelado nas próximas faturas do cartão.",
   ["Ter cartão de crédito em seu nome", "Ter limite disponível no cartão"], [DOC, "CPF", "Cartão de crédito"],
   "Novo Saque, Prata Digital, Lotus"),
 "DITTO-04": ("Empréstimo sem desconto em folha e sem garantia: o dinheiro cai na conta e você paga em parcelas mensais. A aprovação depende da análise de crédito da instituição.",
   ["Ser maior de 18 anos", "CPF regular"], [DOC, "CPF", "Comprovante de residência", "Comprovante de renda"],
   "Crefisa, Presença Bank"),
 "DITTO-05": ("Empréstimo consignado para aposentados e pensionistas do INSS, com as parcelas descontadas direto do benefício. Os juros têm um teto definido pelo INSS.",
   ["Receber aposentadoria ou pensão do INSS", "Ter margem consignável disponível"], [DOC, "CPF", "Comprovante de residência", "Extrato do benefício (Meu INSS)"],
   "Ditto Bank, icred, Facta, C6 Bank"),
 "DITTO-06": ("Cartão de crédito consignado para aposentados e pensionistas, que usa a Reserva de Margem Consignável (RMC): o valor mínimo da fatura é descontado direto do benefício. Pode permitir saque, conforme a instituição.",
   ["Receber benefício do INSS ou de órgão conveniado", "Ter margem disponível para cartão consignado"], [DOC, "CPF", "Comprovante de residência", "Extrato do benefício (Meu INSS)"],
   "Presença Bank"),
 "DITTO-07": ("Cartão benefício consignado, que usa a Reserva de Cartão Consignado (RCC), com desconto direto no benefício. Pode trazer vantagens como descontos e assistências, conforme a instituição.",
   ["Receber benefício do INSS ou de órgão conveniado", "Ter margem disponível para cartão benefício"], [DOC, "CPF", "Comprovante de residência", "Extrato do benefício (Meu INSS)"],
   "Presença Bank"),
 "DITTO-08": ("Para quem já tem consignado: a portabilidade leva o contrato para outra instituição com condições melhores, e o refinanciamento renegocia o contrato atual, podendo liberar um valor extra (troco).",
   ["Ter um empréstimo consignado ativo", "Ter parcelas já pagas, conforme a regra da instituição"], [DOC, "CPF", "Extrato do benefício ou holerite", "Dados do contrato atual"],
   "Facta, C6 Bank, icred, Ditto Bank"),
 "DITTO-09": ("Empréstimo consignado para servidores públicos federais (ativos, aposentados e pensionistas) do SIAPE, com as parcelas descontadas direto na folha de pagamento.",
   ["Ser servidor federal, aposentado ou pensionista no SIAPE", "Ter margem consignável disponível"], [DOC, "CPF", "Contracheque recente", "Comprovante de residência"],
   "Presença Bank"),
 "DITTO-10": ("Empréstimo consignado para servidores de prefeituras que têm convênio com a instituição, com as parcelas descontadas direto na folha de pagamento.",
   ["Ser servidor de prefeitura conveniada", "Ter margem consignável disponível"], [DOC, "CPF", "Contracheque recente", "Comprovante de residência"],
   "Presença Bank, Hub"),
 "DITTO-11": ("Empréstimo consignado para servidores de órgãos públicos conveniados (estaduais ou municipais), com as parcelas descontadas direto na folha de pagamento.",
   ["Ser servidor de órgão público conveniado", "Ter margem consignável disponível"], [DOC, "CPF", "Contracheque recente", "Comprovante de residência"],
   "Hub, Presença Bank"),
 "DITTO-12": ("Empréstimo para quem recebe o Bolsa Família, oferecido por algumas instituições. Atenção: as regras desse tipo de crédito mudam com frequência; confirme se está disponível e em quais condições antes de oferecer.",
   ["Receber o Bolsa Família", "Confirmar as regras atuais com a instituição"], [DOC, "CPF", "Comprovante do benefício"],
   "Crefisa"),
 "DITTO-13": ("Crédito de valor menor para quem tem um pequeno negócio ou trabalha por conta própria, usado para capital de giro, equipamentos ou estoque, geralmente com orientação de um agente de crédito.",
   ["Ter um pequeno negócio ou trabalhar por conta própria"], [DOC, "CPF", "Comprovante de residência", "Informações sobre o negócio"],
   "logotipo não identificado no PDF"),
 "DITTO-14": ("Empréstimo em que as parcelas são cobradas junto com a conta de luz. Disponível apenas em algumas distribuidoras de energia.",
   ["Conta de luz no seu nome", "Morar em região de distribuidora conveniada"], [DOC, "CPF", "Conta de luz recente"],
   "Crefaz"),
 "DITTO-15": ("Empréstimo com o carro como garantia: você continua usando o veículo e, por haver garantia, os juros costumam ser menores e os prazos maiores que no crédito pessoal.",
   ["Veículo no seu nome", "Veículo dentro do ano e modelo aceitos pela instituição"], [DOC, "CPF", "Comprovante de residência", "Documento do veículo (CRLV)"],
   "Prata Digital"),
 "DITTO-16": ("Empréstimo com um imóvel próprio como garantia. Permite valores mais altos e prazos mais longos, com juros menores que outras linhas, e você continua usando o imóvel.",
   ["Imóvel no seu nome, com documentação regular"], [DOC, "CPF", "Comprovante de renda", "Matrícula atualizada do imóvel", "Carnê do IPTU"],
   "Bradesco"),
 "DITTO-17": ("Financiamento para comprar casa ou apartamento, novo ou usado. Normalmente exige uma entrada, e o restante é pago em parcelas ao longo de vários anos, com o imóvel como garantia.",
   ["Ter o valor da entrada", "Renda compatível com a parcela"], [DOC, "CPF", "Comprovante de renda", "Comprovante de residência", "Documentos do imóvel"],
   "Bradesco, Itaú, Santander, Inter"),
 "DITTO-18": ("Solução complementar para facilitar o acesso a consultas e exames. Confirme com o parceiro a rede de atendimento, os valores e se é ou não um plano de saúde antes de oferecer.",
   [], [DOC, "CPF"],
   "Lotus"),
 "DITTO-19": ("Assinatura de energia de fontes renováveis que pode gerar desconto na conta de luz, sem obra nem instalação. O desconto depende da distribuidora e do parceiro.",
   ["Conta de luz no seu nome", "Distribuidora atendida pelo parceiro"], ["CPF", "Conta de luz recente"],
   "Ditto Energy"),
 "DITTO-20": ("Indicação para abrir conta digital em um banco parceiro.",
   ["Ser maior de 18 anos", "Ter CPF"], [DOC, "CPF", "Celular"],
   "Banco do Brasil, C6 Bank"),
}

def obs(inst):
    return (f"Instituições citadas no Portfólio Ditto: {inst}. Isso NÃO confirma parceria da Milena com elas. "
            "Descrição, requisitos e documentos são SUGESTÕES automáticas: confirme com o parceiro antes de publicar.")

q = lambda s: "'" + s.replace("'", "''") + "'"
arr = lambda l: "array[" + ", ".join(q(x) for x in l) + "]::text[]" if l else "'{}'::text[]"
linhas = ["-- E04b: sugestões de texto para os 20 produtos Ditto (só onde ainda está vazio; status continua rascunho)"]
for k, (d, req, docs, inst) in P.items():
    linhas.append(f"update public.produtos_credito set descricao_comercial = coalesce(descricao_comercial, {q(d)}), "
                  f"requisitos = case when requisitos = '{{}}' then {arr(req)} else requisitos end, "
                  f"documentos = case when documentos = '{{}}' then {arr(docs)} else documentos end, "
                  f"observacao = {q(obs(inst))} where id = {q(k)} and status = 'rascunho';")
open(os.path.join(RAIZ, "supabase", "e04b_sugestoes_ditto.sql"), "w").write("\n".join(linhas) + "\n")

# modo demonstração: padrao.js
p = os.path.join(RAIZ, "assets", "js", "padrao.js")
s = open(p).read()
ini = s.index("window.PADRAO.produtosCredito = ") + len("window.PADRAO.produtosCredito = ")
fim = s.index(";\n", ini)
lista = json.loads(s[ini:fim])
for x in lista:
    d, req, docs, inst = P[x["id"]]
    x.update(descricao_comercial=d, requisitos=req, documentos=docs, observacao=obs(inst))
s = s[:ini] + json.dumps(lista, ensure_ascii=False) + s[fim:]
open(p, "w").write(s)
print("ok", len(P))
