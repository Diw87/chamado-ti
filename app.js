// CHAMADO T.I. 3.0 — carregador modular
// Os módulos são inseridos em ordem antes do DOMContentLoaded.
document.write('<script src="app-core.js"><\/script>');
document.write('<script src="app-render.js"><\/script>');
document.write('<script src="app-actions.js"><\/script>');
document.write('<script src="app-utils.js"><\/script>');
document.write('<script src="username-auth.js"><\/script>');
document.write('<script src="admin-user-actions.js"><\/script>');
document.write('<script src="inventory.js"><\/script>');
document.write('<script src="ui-shell.js?v=20260910-3"><\/script>');
document.write('<script src="auth-shell-fix.js?v=20260910-1"><\/script>');
document.write('<script src="access-management.js?v=20260910-1"><\/script>');
document.write('<script src="admin-edit-user.js?v=20260910-2"><\/script>');
// Primeiro acesso usa um fluxo isolado e estável. O antigo observador de PIN foi removido.
document.write('<script src="first-access-stable.js?v=20260910-1"><\/script>');