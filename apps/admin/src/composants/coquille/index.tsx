// La coquille du back-office : la grille, la navigation latérale et la barre
// haute. Trois composants qui ne connaissent aucune donnée — ils reçoivent des
// libellés et rendent des gestes ; les pages, elles, vivent dans children.
export { AdminShell, type AdminShellProps } from "./AdminShell.js";
export { Sidebar, type SidebarProps, type SidebarItem, type SidebarFamille } from "./Sidebar.js";
export { Topbar, type TopbarProps, type LangueOutil } from "./Topbar.js";
