---
name: Coleção SKZ
description: Um fichário de quarto, papel morno e um verde de folha; as fotos dos cards são o único elemento barulhento da tela.
colors:
  papel: "#F5F2EC"
  folha-branca: "#FFFFFF"
  papel-fundo: "#EEE9E1"
  grafite: "#24211D"
  grafite-suave: "#6A645B"
  lapis: "#948C80"
  linha: "#E2DBD0"
  verde-folha: "#3D5A4E"
  verde-folha-claro: "#E1EAE4"
  tijolo: "#A3442C"
  tijolo-claro: "#F6E3DC"
  mostarda: "#8A6418"
  mostarda-clara: "#F4EAD3"
  musgo: "#3C6B4D"
  musgo-claro: "#E0EDE3"
  anil: "#3C5C7A"
  anil-claro: "#E1E9F1"
  papel-noite: "#161513"
  folha-noite: "#201E1B"
  grafite-noite: "#EEE9E1"
  verde-folha-noite: "#9FC2AF"
typography:
  titulo:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  numero:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "26px"
    fontWeight: 750
    letterSpacing: "-0.01em"
  secao:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  corpo:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  apoio:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
  etiqueta:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  foto: "10px"
  controle: "12px"
  cartao: "16px"
  folha: "20px"
  pilula: "99px"
spacing:
  gutter-celular: "16px"
  gutter-desktop: "32px"
  grade-fotos: "14px"
  linha: "13px 16px"
components:
  botao-principal:
    backgroundColor: "{colors.verde-folha}"
    textColor: "{colors.folha-branca}"
    rounded: "{rounded.controle}"
    padding: "9px 14px"
    height: "40px"
  botao:
    backgroundColor: "{colors.folha-branca}"
    textColor: "{colors.grafite}"
    rounded: "{rounded.controle}"
    padding: "9px 14px"
    height: "40px"
  chip:
    backgroundColor: "{colors.folha-branca}"
    textColor: "{colors.grafite}"
    rounded: "{rounded.pilula}"
    padding: "6px 13px"
    height: "34px"
  chip-ativo:
    backgroundColor: "{colors.grafite}"
    textColor: "{colors.papel}"
    rounded: "{rounded.pilula}"
  cartao:
    backgroundColor: "{colors.folha-branca}"
    rounded: "{rounded.cartao}"
    padding: "14px 16px"
  pilula-atrasada:
    backgroundColor: "{colors.tijolo-claro}"
    textColor: "{colors.tijolo}"
    rounded: "{rounded.pilula}"
    padding: "2px 9px"
---

# Design System: Coleção SKZ

## Overview

**Creative North Star: "O fichário de quarto"**

O app é o fichário que fica na escrivaninha dela: papel morno, folhas brancas soltas, um verde de capa de caderno. Quem faz barulho são as fotos dos photocards e as fotos dos grupos e comunidades. Todo o resto (texto, linhas, botões) fica em grafite e areia para não competir com elas. O pedido dela é "cozy e sem superestimular", então a interface é quieta e as cores de alerta aparecem só quando algo pede ação.

A densidade é de ferramenta diária. Ela abre o app quase todo dia para ver o que deve e o que está vindo, então cada tela começa pelo que precisa dela. O detalhe abre numa folha lateral (no celular, de baixo para cima) sem tirá-la do lugar.

**Key Characteristics:**
- Fundo de papel morno (#F5F2EC), folhas brancas com sombra baixa e nenhuma borda pesada.
- Um único acento, o verde de folha, para a ação principal e para o progresso.
- Fotos com cantos de 10px, no formato de photocard (55:85).
- Cor de estado só em pílulas pequenas: tijolo para atrasada, mostarda para "vence logo", anil para "a caminho", musgo para "comigo".
- Fonte do sistema, sem fonte web.

## Colors

Uma paleta de papelaria: neutros mornos, um verde de capa e quatro tons de estado que só aparecem em pílulas.

### Primary
- **Verde de folha** (#3D5A4E): botão principal ("Nova compra", "Paguei"), barra de etapas da CEG e borda de foco. No escuro, vira o verde claro (#9FC2AF) com texto escuro por cima.

### Neutral
- **Papel** (#F5F2EC): fundo da página e da folha lateral.
- **Folha branca** (#FFFFFF): cartões, linhas de lista, campos e chips.
- **Papel de fundo** (#EEE9E1): fundo de foto que ainda não carregou, controle segmentado e avatar sem foto.
- **Grafite** (#24211D): texto principal e chip selecionado.
- **Grafite suave** (#6A645B): texto de apoio, como comunidade, tipo e contagens.
- **Lápis** (#948C80): o terceiro nível, usado em mês da data, "sem valor" e placeholders.
- **Linha** (#E2DBD0): divisórias entre linhas e borda de chip e campo.

### Estado (só em pílulas e números de alerta)
- **Tijolo** (#A3442C sobre #F6E3DC): vencida, atrasada, "devo".
- **Mostarda** (#8A6418 sobre #F4EAD3): vence em até 7 dias, liberado, no Brasil.
- **Anil** (#3C5C7A sobre #E1E9F1): a caminho, vindo pra mim.
- **Musgo** (#3C6B4D sobre #E0EDE3): comigo.

### Named Rules
**A Regra das Fotos Falam.** Nenhum fundo, faixa ou ilustração colorida compete com as fotos dos cards e dos grupos. Cor saturada fora de foto só aparece em pílula de estado ou no botão principal.

**A Regra do Suposto Tracejado.** O que é "a confirmar" usa pílula sem fundo, com borda tracejada em lápis. Nunca tem a mesma cor do que é certo.

## Typography

**Body Font:** fonte do sistema (ui-sans-serif, system-ui, Segoe UI, Roboto)

**Character:** uma voz só, neutra e legível no celular. A hierarquia vem do peso e do tamanho, não de uma segunda família.

### Hierarchy
- **Título** (700, 26px; 23px no celular; 1.2): o nome da aba no topo.
- **Número** (750, 26px): os totais do Início ("Devo agora", "Vindo pra mim") e o valor na folha da conta (28px).
- **Seção** (700, 16px): cabeçalhos como "Precisa de você" e "Vencidas", com a contagem em lápis ao lado.
- **Corpo** (400, 15px, 1.45): títulos de linha (em 600) e textos.
- **Apoio** (400, 13.5px): a segunda linha das listas (comunidade, tipo, CEG).
- **Etiqueta** (700, 12px): pílulas de estado e o mês na data.

### Named Rules
**A Regra da Data Grande.** Em listas de contas, o dia aparece grande (19px, 700) numa coluna própria de 46px, com o mês pequeno embaixo. Prazo é a primeira coisa que o olho encontra.

## Layout

No desktop, um trilho fixo de 232px à esquerda (marca, 4 abas, "Nova compra", tema, app antigo) e o conteúdo com até 1080px e 32px de respiro. Abaixo de 820px, o trilho some e entra uma barra de abas fixa embaixo, com "Nova compra" como botão flutuante logo acima dela, à direita. A margem lateral no celular é de 16px.

A grade de fotos usa colunas automáticas de no mínimo 118px no desktop e 3 colunas fixas no celular, com 14px de espaço (10px no celular). A grade de CEGs usa colunas de no mínimo 300px e vira 1 coluna no celular. As linhas de lista têm 13px por 16px de respiro e divisória de 1px.

## Elevation & Depth

A profundidade vem de folhas brancas sobre papel com uma sombra ambiente bem baixa. A folha lateral é a única camada que flutua de verdade, com um véu escuro de 38% atrás.

### Shadow Vocabulary
- **Folha** (`box-shadow: 0 1px 2px rgba(36,33,29,.06), 0 6px 18px rgba(36,33,29,.06)`): cartões, painéis de lista, número do Início e segmento ativo.
- **Folha lateral** (`box-shadow: -10px 0 30px rgba(0,0,0,.12)`): o painel de detalhes.
- **Botão flutuante** (`box-shadow: 0 6px 18px rgba(0,0,0,.18)`): só o "Nova compra" do celular.

### Named Rules
**A Regra da Folha Solta.** Cartões não têm borda. Uma folha se separa do papel pela cor e pela sombra baixa. Borda de 1px só em controles (chip, campo, botão secundário).

## Shapes

Cantos suaves, sem nada reto nem redondo demais. Foto com 10px, controle com 12px, cartão com 16px, a folha lateral do celular com 20px no topo, e pílulas e chips totalmente arredondados. Avatares de comunidade e de grupo são sempre círculos, com um anel de 1px na cor da linha.

## Components

### Buttons
- **Shape:** 12px, altura mínima de 40px (32px no tamanho pequeno).
- **Principal:** verde de folha com texto branco. É um por tela ou por folha, e marca a ação que encerra a tarefa ("Paguei", "Salvar compra", "Recebi").
- **Secundário:** folha branca com borda de linha. No hover, a borda escurece para lápis.
- **Confirmação em dois toques:** ações em lote ou que apagam ("Paguei tudo", "Apagar", "Aceitar todas") trocam o texto por "Toque de novo…" por 4 a 5 segundos.

### Chips
- **Style:** folha branca, borda de linha, 34px de altura, contagem em lápis.
- **State:** selecionado vira grafite com texto papel. As fileiras de filtro rolam na horizontal sem barra visível.

### Cards / Containers
- **Cartão de CEG ou de comunidade:** avatar (40 a 52px), título que pode quebrar em 2 linhas, faixa de até 5 fotos de 38px e uma barra de 7 etapas em verde.
- **Painel de lista:** folha com cantos de 16px e linhas sem cantos próprios.
- **Tarefa do Início:** ícone num quadrado de 40px pintado no tom do estado, com texto e um botão pequeno.

### Inputs / Fields
- **Style:** folha branca, borda de linha, cantos de 12px, 11px de respiro. A busca tem a lupa à esquerda.
- **Focus:** contorno de 2px em verde de folha, afastado 2px.

### Navigation
- **Desktop:** itens do trilho com ícone de 20px e texto 600. O item ativo vira folha branca com sombra. Um selo em tijolo mostra quantas contas venceram.
- **Celular:** 4 abas com ícone de 22px e rótulo de 11.5px. A ativa fica em grafite, as outras em lápis.

### Folha de detalhes
Painel de 520px à direita no desktop. No celular, ocupa 92% da altura e sobe de baixo com cantos de 20px. Fecha no X, no Esc ou tocando fora. Dentro dela podem aparecer: um cabeçalho com avatar e o número grande, uma lista de pares rótulo/valor, a linha de ações e as listas relacionadas.

### Foto de card
Formato de photocard (55:85), cantos de 10px e anel de 1px. A pílula de estado fica no canto de baixo à esquerda e a contagem "×2" no canto de cima à direita, em grafite. Pedido sem card vira um retângulo de papel de fundo com borda tracejada e o nome no meio.

## Do's and Don'ts

### Do:
- **Do** começar cada tela pelo que precisa dela: vencidas primeiro, depois "vence em 7 dias".
- **Do** mostrar a origem antes do valor nas linhas de conta: avatar e comunidade na segunda linha.
- **Do** oferecer "desfazer" em toda gravação, no aviso de baixo, por 7 segundos.
- **Do** carregar as fotos só quando entram na tela.

### Don't:
- **Don't** somar "a confirmar" com "devo". O suposto aparece separado e tracejado.
- **Don't** usar tijolo fora de atraso ou dívida. Ele perde força se virar decoração.
- **Don't** colocar fundo colorido ou gradiente atrás das fotos.
- **Don't** usar travessão em texto da interface. Ela pediu explicitamente.
