# Sistema de XP — GRINDSET Tracker

Documentação completa do sistema de experiência (XP) e progressão do personagem.

---

## Referência Rápida

| Ação                          | XP típico (sem bônus) | Multiplicadores ativos         |
|-------------------------------|----------------------:|-------------------------------|
| Quest fácil `daily`           | 10                    | Streak de quests, debuff       |
| Quest média `daily`           | 20                    | Streak de quests, debuff       |
| Quest difícil `daily`         | 35                    | Streak de quests, debuff       |
| Quest fácil `main`            | 15 (10 × 1.5)        | Streak de quests, debuff       |
| Quest difícil `main`          | 52 (35 × 1.5)        | Streak de quests, debuff       |
| Quest fácil `side`            | 7 (10 × 0.7)         | Streak de quests, debuff       |
| Check-in study                | 30                    | Streak global, debuff          |
| Check-in workout              | 35                    | Streak global, debuff          |
| Check-in work                 | 25                    | Streak global, debuff          |
| Check-in meditation           | 20                    | Streak global, debuff          |
| Check-in reading              | 25                    | Streak global, debuff          |
| Reflexão daily / gratitude    | 15                    | Nenhum                         |
| Reflexão weekly               | 30                    | Nenhum                         |
| Reflexão learning / insight   | 40                    | Nenhum                         |
| Milestone concluída           | 25                    | Nenhum                         |
| Objetivo curto                | 100                   | Nenhum                         |
| Objetivo médio                | 300                   | Nenhum                         |
| Objetivo longo                | 1.000                 | Nenhum                         |

**Multiplicadores empilháveis:**
- Streak global (check-ins): até 3.0× (90+ dias)
- Streak de quests (últimos 7 dias): até 1.5×
- Debuff `xp_reduction`: 0.9× / 0.75× / 0.5× (mín. 0.4×)

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Armazenamento](#armazenamento)
3. [Sistema de Níveis](#sistema-de-níveis)
4. [Fontes de XP](#fontes-de-xp)
5. [Multiplicadores](#multiplicadores)
6. [Sistema de Penalidade e Dívida](#sistema-de-penalidade-e-dívida)
7. [Reversões de XP](#reversões-de-xp)
8. [Feedback Visual (XP Toast)](#feedback-visual-xp-toast)
9. [Gold (paralelo ao XP)](#gold-paralelo-ao-xp)
10. [Atributos](#atributos)
11. [Registro de Eventos (xpEvents)](#registro-de-eventos-xpevents)
12. [Edge Cases](#edge-cases)
13. [Progressão Típica](#progressão-típica)
14. [Fluxo Completo — Exemplo](#fluxo-completo--exemplo)

---

## Visão Geral

O sistema de XP é o mecanismo central de progressão do GRINDSET. O personagem acumula XP realizando tarefas reais (quests, check-ins, reflexões, objetivos).

**Regra central da dívida:** é **impossível** ter XP positivo e dívida pendente ao mesmo tempo. Penalidades drenam o XP existente primeiro. Só o excedente vira dívida.

---

## Armazenamento

### Tabela `character`

```
totalXP        — XP acumulado total (nunca negativo)
currentXP      — igual ao totalXP (usado para cálculos de nível)
level          — nível atual (1–100)
title          — título baseado no nível
pendingPenalty — dívida de XP por quests falhadas (máx. 200 XP)
```

### Tabela `xpEvents`

```
id          — UUID
source      — 'quest' | 'check-in' | 'reflection' | 'objective' | 'activity'
sourceId    — ID do item de origem
amount      — positivo (ganho) ou negativo (penalidade/reversão)
description — texto legível
timestamp   — ISO datetime
```

> `xpEvents` é histórico. O saldo real vive em `character.totalXP` e `character.pendingPenalty`.

---

## Sistema de Níveis

### Fórmula

```
XP_necessário(nível) = floor(100 × nível^1.6)
```

| Nível | XP necessário nesse nível | XP total acumulado |
|------:|--------------------------:|-------------------:|
| 1     | 100                       | 0                  |
| 5     | 953                       | ~2.600             |
| 10    | 2.512                     | ~10.000            |
| 20    | 7.697                     | ~47.000            |
| 30    | 14.854                    | ~120.000           |
| 50    | 35.565                    | ~450.000           |
| 100   | 100.000                   | ~2.500.000         |

### Títulos

| Nível | Título          |
|------:|-----------------|
| 1     | Iniciante       |
| 5     | Aprendiz        |
| 10    | Praticante      |
| 15    | Dedicado        |
| 20    | Comprometido    |
| 25    | Disciplinado    |
| 30    | Experiente      |
| 35    | Veterano        |
| 40    | Expert          |
| 45    | Mestre          |
| 50    | Grande Mestre   |
| 60    | Lenda           |
| 70    | Mítico          |
| 80    | Transcendente   |
| 90    | Iluminado       |
| 100   | Ascendido       |

---

## Fontes de XP

### Quests — `questRepository.complete()`

#### XP base por dificuldade

| Dificuldade | XP base |
|-------------|--------:|
| Fácil       | 10      |
| Médio       | 20      |
| Difícil     | 35      |

O XP base é multiplicado pela categoria ao **criar** a quest. Na conclusão, aplica-se streak e debuff:

```
xpFinal = floor(quest.xpReward × debuffXP × streakBonus)
```

---

### Check-ins — `checkInRepository.checkIn()`

| Categoria   | XP base |
|-------------|--------:|
| study       | 30      |
| workout     | 35      |
| work        | 25      |
| meditation  | 20      |
| reading     | 25      |

```
xpEarned = floor(checkInXP × streakGlobal × debuffXP)
```

---

### Reflexões — `reflectionRepository.create()`

XP varia por tipo (sem multiplicadores adicionais):

| Tipo                   | XP  |
|------------------------|----:|
| daily, gratitude       | 15  |
| weekly                 | 30  |
| learning, insight      | 40  |

---

### Objetivos e Milestones

| Evento               | XP    |
|----------------------|------:|
| Milestone concluída  | 25    |
| Objetivo curto       | 100   |
| Objetivo médio       | 300   |
| Objetivo longo       | 1.000 |

Sem multiplicadores. XP passa pelo sistema de dívida normalmente.

---

### Atividades (legado)

```
xpFinal = floor((baseXP + duração × xpPerMinute) × debuffXP)
```

| Categoria   | XP base | XP/min |
|-------------|--------:|-------:|
| study       | 15      | 1.5    |
| workout     | 20      | 2.0    |
| work        | 12      | 1.2    |
| meditation  | 25      | 2.5    |
| reading     | 10      | 1.0    |

---

## Multiplicadores

### Categoria da Quest (aplicado ao criar)

| Categoria | Multiplicador |
|-----------|-------------:|
| main      | 1.5×         |
| daily     | 1.0×         |
| side      | 0.7×         |

### Bônus de Atributo (aplicado ao criar)

| Atributos impactados | Bônus |
|----------------------|------:|
| 1                    | 1.0×  |
| 2                    | 1.1×  |
| 3                    | 1.2×  |
| 4+                   | 1.3×  |

### Streak de Quests (aplicado ao completar)

```
streakBonus = min(1.5, 1 + completadasÚltimos7Dias × 0.05)
```

| Quests (7 dias) | Bônus     |
|----------------|----------:|
| 0              | 1.0×      |
| 5              | 1.25×     |
| 10+            | 1.5× (máx)|

### Streak Global (aplicado ao check-in)

| Streak contínuo | Multiplicador |
|----------------|-------------:|
| < 3 dias        | 1.0×         |
| 3 dias          | 1.1×         |
| 7 dias          | 1.25×        |
| 14 dias         | 1.5×         |
| 30 dias         | 2.0×         |
| 60 dias         | 2.5×         |
| 90 dias         | 3.0×         |

### Debuffs

Múltiplos debuffs do mesmo tipo se multiplicam (não somam). Floor mínimo de **0.4×** para XP e Gold.

| Tipo            | Sev. 1 | Sev. 2 | Sev. 3 |
|-----------------|-------:|-------:|-------:|
| xp_reduction    | 0.9×   | 0.75×  | 0.5×   |
| gold_reduction  | 0.9×   | 0.75×  | 0.5×   |
| attribute_decay | 0.95×  | 0.9×   | 0.8×   |

---

## Sistema de Penalidade e Dívida

### Invariante

```
(totalXP > 0) e (pendingPenalty > 0) NUNCA ocorrem simultaneamente.
```

### Ao falhar quest → `addPenalty(xpPenalty)`

Penalidade base × categoria × escalonamento:

```
multiplier = min(1.5, 1 + falhasÚltimos7Dias × 0.1)
xpPenalty  = floor(base × catMult × multiplier)
```

| Falhas recentes | Multiplicador |
|----------------|-------------:|
| 0              | 1.0×         |
| 3              | 1.3×         |
| 5+             | 1.5× (máx)   |

Penalidades base: fácil = 5, médio = 10, difícil = 18.

**Lógica:**
```
se totalXP >= penalidade:
    totalXP -= penalidade         // absorve tudo, sem dívida
else:
    dívida += (penalidade - totalXP)
    dívida  = min(dívida, 200)    // cap máximo: 200 XP
    totalXP = 0
```

### Ao ganhar XP → `addXP(amount)`

```
se pendingPenalty > 0:
    se amount <= pendingPenalty:
        pendingPenalty -= amount  // nenhum XP ganho
        netXP = 0
    else:
        netXP = amount - pendingPenalty
        pendingPenalty = 0
else:
    netXP = amount

totalXP += netXP
```

### Decay diário da dívida

A cada abertura do app (uma vez por dia), **se não houve novas falhas hoje**:

```
decayAmount = max(1, floor(pendingPenalty × 0.1))
pendingPenalty -= decayAmount
```

A dívida se reduz naturalmente em ~10% por dia sem falhas novas. Zera em ~10 dias.

---

## Reversões de XP

Removem XP diretamente (sem criar dívida):

| Operação                   | XP removido          |
|----------------------------|----------------------|
| Desmarcar quest completada | `quest.xpEarned`     |
| Desfazer check-in          | `checkIn.xpEarned`   |
| Deletar quest completada   | `quest.xpReward`     |

```
totalXP = max(0, totalXP - amount)
```

---

## Feedback Visual (XP Toast)

Todo ganho de XP dispara um evento DOM (`xp-feedback`) capturado pelo `XPToast` global.

**Sem dívida:**
```
+15 XP
```

**Com dívida parcialmente quitada:**
```
Bruto       +30 XP
Dívida paga -22 XP
──────────────────
Ganho real   +8 XP
Dívida restante: 0 XP
```

**Fontes com feedback:** quests (`source: 'quest'`), check-ins (`source: 'check-in'`).

---

## Gold (paralelo ao XP)

Gold segue a mesma estrutura mas **sem sistema de dívida** — penalidades são removidas imediatamente.

| Fonte                    | Gold base |
|--------------------------|----------:|
| Quest fácil completada   | 5         |
| Quest média completada   | 10        |
| Quest difícil completada | 20        |
| Check-in study           | 10        |
| Check-in workout         | 15        |
| Check-in work            | 12        |
| Check-in meditation      | 8         |
| Check-in reading         | 10        |
| Reflexão                 | 5         |
| Objetivo curto           | 50        |
| Objetivo médio           | 150       |
| Objetivo longo           | 500       |

**Penalidades:** fácil = 3, médio = 5, difícil = 10 (× catMult × escalonamento 1.5× máx).

---

## Atributos

Sete atributos, escala 0–100: `focus`, `discipline`, `energy`, `knowledge`, `strength`, `wisdom`, `resilience`.

**Por quest:**
```
ganho[attr] = DIFFICULTY_GAIN[dificuldade] × impact.weight × debuffAtributos
// easy: 0.5, medium: 1.0, hard: 2.0
```

**Por check-in:**
```
ganho[attr] = config.checkInAttributeGain × impact.weight × debuffAtributos
// study: 1.5, workout: 2.0, work: 1.0, meditation: 1.5, reading: 1.2
```

---

## Registro de Eventos (xpEvents)

| `source`     | Quando                                           |
|--------------|--------------------------------------------------|
| `quest`      | Quest completada, falhada, desmarcada, deletada  |
| `check-in`   | Check-in feito ou desfeito                       |
| `reflection` | Reflexão criada                                  |
| `objective`  | Milestone ou objetivo completado                 |
| `activity`   | Atividade registrada (legado)                    |

Eventos negativos têm `amount < 0`.

---

## Edge Cases

### Dívida máxima (200 XP)
Penalidades que empurrariam a dívida além de 200 XP são truncadas. O excesso é descartado.

```
pendingPenalty = min(200, pendingPenalty + additionalDebt)
```

### Level-down por reversão de XP
Desfazer uma quest ou check-in chama `removeXP()`, que pode reduzir o nível. O personagem nunca fica abaixo do nível 1 ou com XP < 0.

### Múltiplos level-ups em sequência
Ao completar um objetivo longo (+1000 XP) com pouco XP, vários níveis podem ser pulados na mesma operação — `getLevelFromTotalXP()` calcula o nível final correto em uma passagem.

### Dívida + auto-fail de quests atrasadas
Ao abrir o app, quests do dia anterior são marcadas como falhadas automaticamente (`failOverdueQuests`). Múltiplas falhas acumuladas podem criar dívida, mas o cap de 200 XP protege o jogador de dívidas excessivas de dias sem acesso.

### Debuffs empilhados com floor
Dois debuffs `xp_reduction` severidade 3 resultariam em `0.5 × 0.5 = 0.25×`, mas o floor de 0.4× garante sempre pelo menos 40% das recompensas.

---

## Progressão Típica

Estimativa baseada em hábitos diários consistentes.

### Cenário: usuário moderado
- 3 quests `daily` médias por dia (20 XP cada) → 60 XP/dia
- 2 check-ins diários (25 XP médio) → 50 XP/dia
- 1 reflexão diária (15 XP) → 15 XP/dia
- **Total bruto: ~125 XP/dia** (sem bônus de streak)

| Nível | XP acumulado | Dias estimados |
|------:|-------------:|---------------:|
| 5     | ~2.600       | ~21 dias       |
| 10    | ~10.000      | ~80 dias       |
| 20    | ~47.000      | ~376 dias      |
| 30    | ~120.000     | ~960 dias      |

### Cenário: usuário dedicado (com streak 30 dias, 2.0× check-in)
- 3 quests `main` difíceis (52 XP × 1.3× streak) → 202 XP/dia
- 4 check-ins × 2.0× streak → 240 XP/dia
- 1 reflexão learning (40 XP) → 40 XP/dia
- **Total bruto: ~480 XP/dia**

| Nível | Dias estimados |
|------:|---------------:|
| 10    | ~21 dias       |
| 20    | ~98 dias       |
| 30    | ~250 dias      |

---

## Fluxo Completo — Exemplo

**Estado inicial:** totalXP = 50, pendingPenalty = 0, streak = 0 dias.

### 1. Quest `main` difícil completada (sem debuff)

```
xpReward armazenado = 35 × 1.5 (main) = 52 XP
recentCompleted (7 dias) = 3 → streakBonus = 1 + 3×0.05 = 1.15
xpFinal = floor(52 × 1.0 × 1.15) = 59
```

`addXP(59)`: pendingPenalty = 0 → netXP = 59.

**Estado:** totalXP = 109, pendingPenalty = 0.

---

### 2. Quest `main` difícil falhada (2 falhas nos últimos 7 dias)

```
baseXP  = floor(18 × 1.5) = 27
mult    = min(1.5, 1 + 2×0.1) = 1.2
penalty = floor(27 × 1.2) = 32
```

`addPenalty(32)`: totalXP (109) ≥ 32 → totalXP = 77, dívida = 0.

**Estado:** totalXP = 77, pendingPenalty = 0.

---

### 3. Várias falhas acumuladas até zerar o XP

Após mais falhas: totalXP = 10, pendingPenalty = 0.

Quest fácil `daily` falha (5 falhas recentes):
```
penalty = floor(5 × 1.0 × 1.5) = 7
```

`addPenalty(7)`: 10 ≥ 7 → totalXP = 3.

Quest fácil `side` falha:
```
penalty = floor(5 × 0.7 × 1.5) = 5
```

`addPenalty(5)`: 3 < 5 → totalXP = 0, dívida = 2.

**Estado:** totalXP = 0, pendingPenalty = 2.

---

### 4. Check-in `workout` com streak global de 7 dias

```
xpEarned = floor(35 × 1.25) = 43
```

`addXP(43)`: pendingPenalty = 2, 43 > 2 → pendingPenalty = 0, netXP = 41.

**Estado:** totalXP = 41, pendingPenalty = 0.

Toast exibido:
```
Bruto        +43 XP
Dívida paga   -2 XP
─────────────────────
Ganho real   +41 XP
```

---

### 5. Reflexão `insight` escrita

```
xpAmount = 40 (tipo insight)
```

`addXP(40)`: sem dívida → netXP = 40.

**Estado:** totalXP = 81, pendingPenalty = 0.
