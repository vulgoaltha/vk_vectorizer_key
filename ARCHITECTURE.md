# Architecture - Vectorizer Key

## Organização Geral do Projeto

A aplicação segue uma estrutura modular padrão orientada ao crescimento.
Esta organização foi preparada para suportar a adição escalável de novos módulos, garantindo que o código compartilhado fique centralizado e o código funcional fique bem delimitado (Domain-Driven Design).

### Responsabilidades de Cada Diretório

- **`src/app/`**: Configurações de inicialização da aplicação, providers raízes e pontos de montagem.
- **`src/assets/`**: Recursos estáticos como imagens, favicons, SVGs e arquivos pesados.
- **`src/features/`**: **Funcionalidades prontas e em uso ativo no projeto.** Aqui residem as lógicas finais e consolidadas, como `vectorizer`, `upload`, e `export`.
- **`src/shared/`**: **Código reutilizável.** Contém todos os componentes, hooks, utils e contexts genéricos. Nenhuma regra de negócio estrita deve residir no core do `shared`. É a "caixa de ferramentas" universal da aplicação.
- **`src/modules/`**: **Módulos Independentes e Expansões Futuras.** Todo e qualquer novo contexto arquitetural deve ser criado aqui, possuindo sua própria base isolada até atingir maturidade para integrar a UI principal.
- **`src/services/`**: Serviços globais, integração com APIs, workers e funções abstratas de rede/lógica bruta.
- **`src/config/`**: Variáveis de ambiente e constantes de inicialização (ex: Supabase, chaves).
- **`src/constants/`**: Valores imutáveis globais.
- **`src/types/`**: Interfaces e tipos TypeScript de escopo global.

## O Fluxo Recomendado para Evolução do Software

1. O desenvolvimento de uma nova funcionalidade (Ex: *AI Vectorization* ou *Cloud Sync*) começa obrigatoriamente dentro de `src/modules/{nome}/`.
2. Componentes visuais locais, hooks dedicados e tipagens do módulo não devem vazar para `src/shared/` a menos que sejam úteis para outros módulos.
3. Quando maduro e validado, o módulo é incorporado à UI ou promovido a uma `feature`.

### Diferença entre Features, Shared e Modules
- **Shared:** Pedaços genéricos de código (Botões genéricos, Formatadores de Data).
- **Features:** Ações que o usuário final já executa no software agora (Ex: A tela atual de Imagem -> Vetor).
- **Modules:** Pilares arquiteturais inteiros que fornecem novos contextos ou integrações (Ex: Módulo de Licenciamento, Motor de IA, Sincronização em Nuvem).

## Padrão de Crescimento (Roadmap Arquitetural)

As seguintes funcionalidades foram previstas e já possuem diretórios base em `src/modules/` para isolamento de suas lógicas futuras:

- **AI Vectorization (`src/modules/ai`)**: Abordagens neurais para vetorização sem perdas.
- **Batch Processing (`src/modules/batch`)**: Filas e processamento em lote via Web Workers.
- **Cloud Sync (`src/modules/cloud`)**: Sincronização de perfis e vetores salvos.
- **License Manager (`src/modules/licensing`)**: Autenticação de software, limites e restrições.
- **Authentication (`src/modules/auth`)**: Sistema de login e controle de sessão.
- **Plugin System (`src/modules/plugins`)**: Extensibilidade via scripts de terceiros.
- **Automatic Updates (`src/modules/updates`)**: Controle de versão e fallback OTA.
