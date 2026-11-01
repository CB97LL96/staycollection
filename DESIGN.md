---
name: Coleção SKZ
description: Impresso como o encarte de um álbum; papel couché, tinta preta, réguas grossas e cada era com a sua cor.
colors:
  papel: "#F7F6F2"
  folha: "#FFFFFF"
  papel-fundo: "#ECEAE3"
  tinta: "#111114"
  tinta-suave: "#4B4A52"
  lapis: "#66656D"
  linha: "#DCD9D0"
  vermelho-atraso: "#C2311E"
  vermelho-atraso-claro: "#FBE3DE"
  ocre: "#835600"
  ocre-claro: "#FBEFD2"
  verde: "#1F6E43"
  verde-claro: "#DCEFE3"
  azul: "#1F51BF"
  azul-claro: "#E2EAFB"
  plastico: "#1B1B20"
  era-do-it: "#D9362B"
  era-hop: "#2E6FE0"
  era-ate: "#D99A12"
  era-this-that: "#1F8A70"
  era-karma: "#6A4BC4"
  papel-noite: "#111114"
  folha-noite: "#1A1A1F"
  tinta-noite: "#F7F6F2"
typography:
  valor:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(56px, 9vw, 84px)"
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: "-0.045em"
  era:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(34px, 5vw, 52px)"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.04em"
  titulo:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.035em"
  secao:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    letterSpacing: "0.14em"
  corpo:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  item:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 650
  adesivo:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  foto: "7px"
  controle: "10px"
  faixa: "16px"
  adesivo: "99px"
spacing:
  gutter-celular: "16px"
  gutter-desktop: "32px"
  linha: "12px 2px"
components:
  botao-principal:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    rounded: "{rounded.controle}"
    padding: "9px 14px"
    height: "40px"
  botao:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    rounded: "{rounded.controle}"
    padding: "9px 14px"
    height: "40px"
  chip-ativo:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    rounded: "{rounded.adesivo}"
  adesivo-certo:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    rounded: "{rounded.adesivo}"
    padding: "4px 10px"
  faixa-vindo:
    backgroundColor: "{colors.plastico}"
    textColor: "{colors.papel}"
    rounded: "{rounded.faixa}"
    padding: "14px"
---

# Design System: Coleção SKZ

## Overview

**Creative North Star: "O encarte do álbum"**

O app é impresso como o encarte de um álbum de K-pop: papel couché claro, tinta preta, títulos grandes e apertados, réguas grossas separando as partes. Cada era (o álbum por trás de uma CEG) tem uma cor, e essa cor só aparece em títulos de era, pontos e faixas. As fotos dos cards continuam sendo o que mais chama atenção.

O vocabulário da interface **não** é de álbum. Nada de "tracklist", "faixas" ou "bandeja" nos textos. O mundo do encarte vive na forma (tipo, régua, adesivo, plástico). O único lugar onde a linguagem de álbum aparece é a Coleção, com o nome da era como título.

**Key Characteristics:**
- Papel #F7F6F2 e tinta #111114. No escuro, inverte para o encarte preto.
- Archivo do 400 ao 900. O valor devido e o nome da era são enormes.
- Réguas de 2px em tinta sob os títulos de seção. Linhas de lista em hairline.
- Adesivos redondos: cheios para o certo, tracejados para o suposto.
- Uma faixa escura, como plástico de photocard, para os cards que estão vindo.
- Sem sombras e sem cartões flutuando. A estrutura vem das réguas.

## Colors

Tinta e papel fazem quase todo o trabalho. As cores de estado e de era são pontuais.

### Primary
- **Tinta** (#111114): texto, réguas, botão principal, chip ativo e adesivo certo. É o "acento" do sistema.

### Neutral
- **Papel** (#F7F6F2): fundo.
- **Folha** (#FFFFFF): campos e superfícies raras.
- **Papel de fundo** (#ECEAE3): hover de linha, notas e fundo de foto que ainda não carregou.
- **Tinta suave** (#4B4A52) e **Lápis** (#66656D): textos de apoio, os dois com contraste AA.
- **Linha** (#DCD9D0): divisória entre linhas.
- **Plástico** (#1B1B20): a faixa "Vindo pra mim".

### Estado
- **Vermelho de atraso** (#C2311E): vencida, devo e adesivo de atraso.
- **Ocre** (#835600): vence em até 7 dias, liberado.
- **Azul** (#1F51BF): a caminho.
- **Verde** (#1F6E43): comigo, paga.

### Era
Cores fixas para as eras conhecidas: DO IT vermelho, HOP azul, ATE amarelo, THIS & THAT verde, KARMA roxo, além de outras no código (`ERA_COR`). Para as demais, uma paleta de 8 cores escolhida pelo nome.

### Named Rules
**A Regra da Cor da Era.** A cor da era só aparece no nome da era (Coleção), na faixa de 4px no topo do cartão da CEG e no ponto ao lado de uma conta. Nunca vira fundo de área.

**A Regra do Adesivo Tracejado.** "A confirmar" e "sem valor" usam adesivo tracejado. Nunca são somados ao que é certo.

## Typography

**Fonte:** Archivo (Google Fonts), com fallback na fonte do sistema.

**Character:** uma grotesca de encarte. Fica pesada e apertada nos números e nos nomes de era, neutra no texto corrido.

### Hierarchy
- **Valor** (900, 56 a 84px, 0.92, -0.045em): "Devo hoje" no topo do Início.
- **Era** (900, 34 a 52px, maiúsculas): título de cada era na Coleção, na cor da era.
- **Título** (900, 40px; 32px no celular): nome da aba.
- **Seção** (800, 12px, maiúsculas, +0.14em): "Pra fazer hoje", "Vencidas", com régua de 2px embaixo e contagem à direita.
- **Item** (650, 15.5px): título de cada linha.
- **Corpo** (400, 15px): textos de apoio a 13px.
- **Adesivo** (700, 12px): estados.

### Named Rules
**A Regra da Lista Numerada.** A lista do dia no Início é numerada (01, 02…) porque a ordem é a prioridade. O prazo ou a ação fica à direita, em negrito.

## Layout

No desktop, um trilho de 232px com uma régua de 2px. Ele tem a marca em maiúsculas, as abas em texto (a ativa sublinhada com 3px), "Nova compra" e, no pé, o tema e o app antigo. O conteúdo vai até 1080px. No celular, a barra de abas embaixo usa texto em maiúsculas, com régua de 2px no topo. "Nova compra" vira uma pílula preta flutuante.

Início, de cima para baixo: linha com marca e data, o valor devido com adesivos, "Pra fazer hoje" numerado, a faixa "Vindo pra mim" com até 6 fotos (5 no celular) e "Pagas por último".

A Coleção é agrupada por era, da mais nova para a mais antiga, com grade automática de no mínimo 118px (3 colunas no celular).

## Elevation & Depth

Plano. Não há sombras, nem em cartões nem em painéis. A profundidade aparece só em duas camadas: a folha lateral, com uma régua de 2px na borda e um véu escuro atrás, e a faixa de plástico, com o brilho das divisórias das fotos.

### Named Rules
**A Regra da Régua.** Separação vem de régua (2px de tinta) ou de hairline (1px de linha), nunca de sombra.

## Shapes

Foto com cantos de 7px, controles com 10px, a faixa de plástico com 16px, adesivos e chips em pílula, avatares em círculo com anel de 1.5px em tinta. O cartão de CEG não tem cantos: é uma faixa de cor de 4px no topo e uma hairline embaixo.

## Components

### Buttons
- **Principal:** tinta com texto papel, 10px de canto, mínimo de 40px.
- **Secundário:** transparente, borda de 1.5px em tinta.
- **Dois toques:** ações em lote ou que apagam pedem confirmação por alguns segundos.

### Chips e seletor
Borda de 1.5px em tinta. O ativo fica preenchido em tinta. O seletor segmentado tem moldura de 1.5px e o item ativo preenchido.

### Linha da lista do dia
Número em lápis, título em 650, linha de apoio com ponto da era ou avatar da comunidade, e o prazo ou a ação à direita: em vermelho quando venceu, em ocre quando vence logo, em adesivo tracejado quando é "confirmar".

### Faixa "Vindo pra mim"
Plástico escuro com até 6 fotos, cada uma numa divisória com brilho suave. É um botão que abre a Coleção filtrada em "Vindo".

### Título de era
Nome em maiúsculas, enorme, na cor da era, com régua de 2px da mesma cor e a contagem à direita em tinta.

### Folha de detalhes
Fundo papel, título em caixa alta de 12px com régua de 2px. Na conta, a origem vem antes do valor.

## Do's and Don'ts

### Do:
- **Do** manter os textos sem termos de álbum, exceto o nome da era na Coleção.
- **Do** mostrar o valor devido certo em destaque e os palpites em adesivo tracejado.
- **Do** usar a cor da era só em título, ponto e faixa.
- **Do** oferecer "desfazer" em toda gravação.

### Don't:
- **Don't** usar sombra para separar coisas. Use régua.
- **Don't** pintar áreas inteiras com a cor da era.
- **Don't** somar "a confirmar" ou "sem valor" ao que é certo.
- **Don't** usar travessão em texto da interface.
