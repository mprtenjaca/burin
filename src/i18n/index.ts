import { hr } from "./hr";
import type { Dict } from "./hr";

/**
 * Aktivni rječnik. Kad dodamo još jezika: uvesti ih ovdje (tipizirane kao
 * `Dict`), držati mapu `{ hr, en, ... }` i birati prema postavci jezika.
 */
export const t: Dict = hr;

export type { Dict };
