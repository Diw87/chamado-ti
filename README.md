# CHAMADO T.I.

Central de Serviços de Tecnologia da Informação da Prefeitura Municipal de Olho d'Água das Cunhãs.

## Versão 2.0

A versão 2.0 recebeu uma reformulação completa de interface e fluxo de atendimento, com foco em uso institucional e gestão operacional.

### Recursos atuais

- Dashboard profissional de atendimento
- Indicadores de chamados abertos, em atendimento e resolvidos
- Controle de SLA por prioridade
- Identificação automática de chamados em risco ou atrasados
- Prioridades: Baixa, Média, Alta e Crítica
- Prazos de referência: 48h, 24h, 8h e 4h
- Fila prioritária de chamados
- Abertura de chamados com dados de solicitante, setor, local e patrimônio
- Categorias de suporte de T.I.
- Edição de status e prioridade
- Histórico completo de atendimento
- Notas técnicas por chamado
- Registro da solução aplicada
- Encerramento de chamado
- Pesquisa e filtros avançados
- Relatórios por setor, categoria e status
- Indicador de atendimento dentro do SLA
- Exportação CSV
- Interface responsiva para computador, tablet e celular
- Identidade visual institucional

## Armazenamento atual

Nesta etapa os dados são persistidos no navegador através de `localStorage`.

A aplicação também realiza migração automática dos dados salvos pela versão 1.0 para a estrutura da versão 2.0.

## Próxima etapa para produção

Para utilização simultânea por várias secretarias e usuários, a arquitetura deverá receber:

- autenticação de usuários;
- perfis de acesso para solicitante, técnico e administrador;
- banco de dados centralizado;
- anexos de imagens e documentos;
- notificações;
- recuperação de senha;
- trilha de auditoria no servidor;
- regras de segurança e backup.

O front-end atual foi organizado para permitir essa evolução sem necessidade de refazer a interface.

## GitHub Pages

A interface estática pode ser publicada pelo GitHub Pages usando:

- Branch: `main`
- Diretório: `/ (root)`

Arquivos principais:

- `index.html`
- `style.css`
- `app.js`
- `.nojekyll`
