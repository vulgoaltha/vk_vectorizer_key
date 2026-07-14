# Architecture - Vectorizer Key

## Organização do Projeto

A aplicação segue uma estrutura modular padrão em React/Vite, pensada para escalabilidade e fácil manutenção. 
Este não é um MVP monolítico. As funcionalidades estão organizadas por contexto (Domain-Driven).

### Estrutura Base
- `src/components/` - Componentes visuais reutilizáveis (botões, modais, UI kit).
- `src/features/` - Domínios da aplicação que já estão finalizados ou ativos (ex: `vectorizer`).
- `src/pages/` - Componentes de página inteira que são mapeados pelas rotas (`@tanstack/react-router`).
- `src/services/` - Integrações externas, lógicas complexas e manipulação de API/Workers.
- `src/hooks/` - Hooks customizados do React.
- `src/contexts/` - Providers globais (Autenticação, Tema, etc).
- `src/utils/` - Funções utilitárias puras (formatação, manipulação de strings).
- `src/types/` - Definições globais de TypeScript (`.d.ts` e interfaces).
- `src/assets/` - Imagens, ícones, fontes e outros recursos estáticos pesados.
- `src/config/` - Configurações globais (env vars, chaves).
- `src/constants/` - Variáveis imutáveis globais.

### Módulos Futuros (`src/modules/future/`)
Para garantir a sanidade da base de código principal, **todas as novas funcionalidades em estágio de desenvolvimento ou aprovação devem ser isoladas na pasta `src/modules/future/`.**
Apenas quando uma funcionalidade atinge maturidade (Production Ready) ela é promovida para `src/features/`.

#### Como adicionar novas funcionalidades:
1. Crie uma pasta dentro de `src/modules/future/nome-do-modulo/`.
2. Encapsule seus componentes, tipos e lógicas locais dentro dessa pasta.
3. Exporte a funcionalidade completa em um `index.ts`.
4. Não importe nada de `future/` para os domínios core sem que a funcionalidade esteja homologada.

## Boas Práticas Adotadas
- **Desacoplamento:** O projeto foi convertido para um Single Page Application puro (SPA), garantindo independência de provedores de SSR (Server-Side Rendering).
- **Sem UUIDs para arquivos:** Arquivos exportados seguem rigidamente a lógica `NomeOriginal-VK.extensão`.
- **Identidade Estável:** A interface original nunca deve ser alterada durante manutenções estruturais.
- **Limpeza:** Códigos legados, ferramentas não utilizadas e dependências externas (como o ecossistema Lovable) devem ser limpos permanentemente do projeto.
