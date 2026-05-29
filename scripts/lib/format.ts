// Re-export from the shared module. The download script uses these to
// project DB rows back into the Python pipeline shape.

export {
  stageToFase,
  roundToJornada,
  tipoPartidoFromFase,
} from "../../src/lib/fixtures/pythonFormat";

export { utcIsoToMadridLocal } from "../../src/lib/dates/madridTime";
