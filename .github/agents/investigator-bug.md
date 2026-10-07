---
description: Investiga um bug e adiciona um teste de regressão.
name: investigar-bug
argument-hint: descrição do problema observado
agent: agent
---

# Investigar bug

Investigue o problema: `${input:problema:descreva o comportamento observado}`.

- Examine o código e os testes relacionados antes de propor mudanças.
- Identifique a causa raiz e faça a menor correção necessária.
- Adicione um teste de regressão seguindo os padrões do projeto.
- Não altere arquivos fora do escopo do problema.
- Execute os testes relevantes e informe o resultado.
- Se não conseguir reproduzir ou confirmar a causa, explique o que falta sem inventar uma solução.