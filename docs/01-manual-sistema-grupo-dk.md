# Manual do sistema — Grupo DK (Centro Automotivo + Locadora)

| Campo | Valor |
|--------|--------|
| **Versão do manual** | 1.1 |
| **Data** | maio de 2026 |
| **Site** | [grupodkempreendimentos.com.br](https://grupodkempreendimentos.com.br/) |
| **Hospedagem** | Vercel (ficheiros estáticos + PWA) |

Este manual descreve a plataforma web **tal como está hoje**. Deve ser **revisto e atualizado** sempre que houver alteração relevante no código ou nos processos.

---

## 1. O que é o sistema

Aplicação **web progressiva (PWA)**: funciona no navegador e pode ser **instalada** como atalho no telemóvel ou computador. Reúne:

- **DK Centro Automotivo** — informação institucional e redes.
- **DK Locadora** — login de **cliente** e de **funcionário**, cadastros operacionais, consultas e ferramentas administrativas.

---

## 2. Onde os dados ficam guardados (muito importante)

- Os dados de cadastros, locações, lançamentos, etc. são guardados no **navegador** do utilizador (`localStorage`), **neste aparelho**.
- **Não** existe, nesta versão, um servidor central de base de dados: **outro telemóvel ou outro PC não vê automaticamente os mesmos dados**.
- Para **copiar** dados entre máquinas, use **Exportar backup (JSON)** e **Restaurar backup (JSON)** na área de administrador (quando disponível para o seu perfil).
- **Deploy na Vercel** publica apenas os **ficheiros do site** (`index.html`, `app.js`, etc.), **não** os dados locais dos utilizadores.

---

## 3. Acesso e perfis

### 3.1 Cliente

- **Entrada:** CPF + senha (senha inicial indicada no ecrã, ex.: `1234` até ser alterada no processo interno da DK).
- **Após login:** vê apenas informação do **seu** contrato (veículo, datas, valores resumidos, situação financeira simplificada).

### 3.2 Funcionário (colaborador)

- **Entrada:** CPF do funcionário + senha definida pelo **titular (owner)** ou fluxo de primeiro acesso.
- **Perfis:** operacional (permissões por módulos) ou administrador, conforme cadastro de funcionário.

---

## 4. Barra superior (todas as áreas)

- **Acesso cliente** / **Acesso colaborador** — abre a zona de login correspondente.
- **Instalar App** — aparece quando o navegador permite instalar a PWA.
- **Buscar atualizações** — força verificação de nova versão (útil após publicação na Vercel).

---

## 5. Página inicial (Grupo DK)

- **Layout da home:** opcionalmente editável (editar / salvar / resetar layout) — uso mais avançado.
- **Coluna QR “DK Locadora no celular”:** código para abrir o fluxo de **cadastro com IA** (`#cadastro-ia`) no telemóvel; texto orienta a instalar a PWA.
- **Painéis** Centro Automotivo e Locadora — ligações a Instagram, WhatsApp e botões para **área institucional** ou **login Locadora**.

---

## 6. Área do cliente (sem login)

### 6.1 Cadastro com IA (fotos)

- **Localização:** opcional (botão “Capturar localização”).
- **Três ficheiros:** frete da CNH, verso da CNH, comprovante de residência.
- **Processar com IA:** envia imagens (reduzidas no aparelho) para a API OpenAI; preenche o formulário abaixo quando possível.
- **Requisito:** neste **mesmo aparelho** deve estar guardada a **chave OpenAI** (ver secção 12).
- Após processar: **rever** dados, preencher o que faltar, **confirmar endereço** e só então enviar.

### 6.2 Cadastro para avaliação (formulário público)

- Campos: CPF, nome, contactos, CNH, EAR, CEP, município/UF, endereço, complemento, etc.
- **CEP:** consulta automática (ViaCEP) quando o CEP está completo.
- **Confirmar endereço:** obrigatório antes de **Enviar para avaliação**.
- O pedido fica na fila **Validação de cadastro** para o administrador (no **mesmo** navegador onde o admin trabalha).

---

## 7. Área do cliente (com login)

- Painel **“Meu veículo contratado”** com dados do contrato associado ao CPF/senha.
- **Sair** encerra a sessão.

---

## 8. Painel do funcionário — estrutura do menu

Três blocos principais (acordeão):

1. **01 - Operação** — cadastros e lançamentos do dia a dia.  
2. **02 - Informação** — consultas por âmbito (ativos / inativos / todos / caixa).  
3. **03 - Área do administrador** — dados de utilização, validação de cadastros, QR, backups, etc.

---

## 9. 01 - Operação (detalhe por ferramenta)

### 9.1 Cadastro do cliente

- Formulário completo (CPF, código automático, dados pessoais, CNH, EAR, endereço com CEP e confirmação).
- **Cadastro com IA (mesmo fluxo do cliente)** — fotos + processamento; preenche campos para revisão.
- **Enviar para avaliação** — envia para fila de validação (se aplicável ao fluxo atual).
- Ações adicionais (conforme permissão): limpar, editar, bloquear, desbloquear, excluir, relatórios PDF/Excel.
- **Lista resumida** de clientes na operação pode estar oculta por decisão de interface; validações pendentes aparecem em **03**.

### 9.2 Cadastro do veículo

- Tipo (carro/moto), placa, tag, marca, modelo, valor, cor, chassi, ano, renavam, motor.
- Guardar, limpar, atualizar, cancelar veículo (com fluxos de senha quando exigido).
- **Lista recente** de veículos no ecrã pode estar **oculta** (apenas dados em memória local continuam a existir).

### 9.3 Cadastro da locação

- **Protocolo / número do contrato:** identificador **único** da locação (liga **CPF do cliente** + **placa** + período neste registo). É gerado automaticamente como **AAAAMMDD** + **sequência do dia** (001, 002, … conforme ordem das locações gravadas naquele dia no mesmo navegador/base). O campo pode ser editado só em casos excepcionais (ex.: migração).
- **Plano:** **DK MINHA MOTO** ou **DK MEU TRANSPORTE** — altera regras de data fim, valores (locação + investimento quando aplicável) e periodicidade.
- **Sugestões:** placa, CPF e nome do cliente enquanto digita.
- **Datas e valores** conforme regras do plano selecionado.

### 9.4 Cadastro de manutenção

- Registo de manutenção por veículo (tipo, datas, valores, etc.) e relatório.

### 9.5 Lançamento de aluguel

- Registo de pagamentos semanais por CPF/placa e **número de contrato** quando aplicável.
- **Comprovante com IA:** colar imagem ou texto, configurar **chave OpenAI** uma vez **neste navegador**, extrair dados, aplicar ao formulário; controlo de **duplicidade** de comprovante.
- Resumo e histórico conforme implementação atual.

### 9.6 Lançamento de despesas

- Área reservada / em evolução.

### 9.7 Cadastro de funcionário (geralmente só owner)

- Perfis operacional vs administrador, permissões por módulo, senhas e primeiro acesso.

---

## 10. 02 - Informação

- **Contratos ativos / inativos / todos** — filtra o conjunto de registos usado nas consultas.
- Consultas por placa, modelo, tempo de locação, receita, situação financeira (O × P), inadimplência, quadro geral, etc. (conforme botões disponíveis).

---

## 11. 03 - Área do administrador

### 11.1 Dados de utilização

- Relatórios, histórico de alterações, **exportar / importar backup JSON** (com confirmação por senha quando aplicável).
- **Enviar QR via WhatsApp** — partilha o link público de cadastro/IA.

### 11.2 Validação de cadastro

- Lista pedidos **pendentes** (cliente público ou operação).
- **Aprovar** — integra no cadastro principal de clientes.
- **Reprovar** — remove da fila pendente (conforme lógica atual).

---

## 12. Inteligência artificial (OpenAI)

- Usada em: **comprovante de pagamento** e **cadastro com documentos (CNH + comprovante)**.
- A **chave da API** é guardada **localmente** no navegador (não na Vercel por defeito nesta arquitetura).
- **Cada aparelho** que for usar IA deve **guardar a chave** uma vez na área de comprovante.
- A avaliação de “autenticidade” de documentos é **heurística**; a decisão final é humana.

---

## 13. Contratos e identificadores (regra de negócio)

- **Número de contrato** é **único**. O mesmo cliente e a mesma placa em **outro período** = **outro** contrato (outro número).
- **CPF** identifica pessoa no cadastro; o **contrato** amarra cliente + veículo + período.

---

## 14. Rotina combinada de atualização da documentação (13:00)

**Nota técnica:** o assistente em Cursor **não envia lembretes automáticos** às 13h. Para cumprir o combinado:

1. Defina um **alarme ou lembrete** no telemóvel/agenda às **13:00** com o texto sugerido: *“Rever manual DK + apresentação de utilizadores”*.  
2. Quando for altura, abra o projeto no Cursor e peça explicitamente, por exemplo:  
   *“Atualize `docs/01-manual-sistema-grupo-dk.md` e `docs/02-apresentacao-usuarios-grupo-dk.md` com as alterações desde [data ou lista de mudanças].”*  
3. Incremente a **versão** e a **data** no topo de ambos os ficheiros após cada revisão.

---

## 15. Histórico de revisões do manual

| Versão | Data | Notas |
|--------|------|--------|
| 1.0 | 2026-05 | Primeira versão para avaliação. |
| 1.1 | 2026-05 | Protocolo de locação automático (AAAAMMDD + sequência). |

---

*Documento gerado para uso interno Grupo DK. Ajustar conforme decisões de produto e jurídicas.*
