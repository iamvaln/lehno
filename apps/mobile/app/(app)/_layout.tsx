import { Stack } from "expo-router";

/* L'application connectée. Une pile, sans en-tête natif : les écrans portent
   leur propre titre — la fiche écrit le nom en grand, et une barre qui le
   redirait le dirait deux fois. */
export default function Application() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
