import { redirect } from "next/navigation";

// "Por jornada" is the default Clasificación view now (the standalone
// "General" ranking was removed). Anything that still links to
// /clasificacion lands here and gets forwarded to the canonical URL.
export default function ClasificacionRedirectPage() {
  redirect("/clasificacion/jornada");
}
