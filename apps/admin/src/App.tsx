import { useEffect, type ReactNode } from "react";

// La surcharge du back-office tient à une classe sur <body> : index.html la pose
// pour l'application servie, cet effet la pose pour tout autre hôte — un test, un
// aperçu de composant. Sans elle, l'outil hérite de la densité du produit.
function useClasseAdmin(): void {
  useEffect(() => {
    document.body.classList.add("lehno-admin");
  }, []);
}

export function App(): ReactNode {
  useClasseAdmin();

  return (
    <div>
      <header>
        <span>Lehno</span>
      </header>
      <main>{null}</main>
    </div>
  );
}
