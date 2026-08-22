// Les matcheurs de jest-dom (toHaveTextContent, toBeInTheDocument, toHaveAccessibleName)
// sont enregistrés une fois pour toute la suite. En environnement node ils ne servent pas,
// mais leur simple enregistrement ne coûte rien.
import "@testing-library/jest-dom/vitest";
