import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { renderAndroidWidget } from "./render";

/**
 * ANDROID WIDGET — obrada zahtjeva sustava (7.8.2026.).
 *
 * Ovo se izvršava BEZ APLIKACIJE, u headless JS zadatku koji Android
 * pokrene po svom rasporedu. Zato ovdje NEMA hookova, storea ni React
 * konteksta — sve se čita izravno iz AsyncStoragea.
 *
 * To je i glavna razlika od iOS-a: ondje widget ne može pokrenuti naš JS,
 * pa mu aplikacija unaprijed gura gotove podatke (`updateTimeline`).
 * Ovdje se podaci čitaju u trenutku crtanja, pa su uvijek svježi koliko
 * je svjež zadnji dohvat.
 *
 * Sam crtež živi u `render.tsx` (8.8.2026.): otkad `pushWidget` traži
 * osvježavanje pri promjeni grada, isti widget se crta s DVA mjesta, pa
 * je izgled morao u zajedničku funkciju da se ne raziđu.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  // Brisanje ne treba crtež.
  if (props.widgetAction === "WIDGET_DELETED") return;

  const widget = await renderAndroidWidget({
    widgetName: props.widgetInfo.widgetName,
    width: props.widgetInfo.width,
  });

  // `null` = podataka još nema; zaslon se ne dira, ostaje zadnji izgled.
  if (!widget) return;

  props.renderWidget(widget);
}
