import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Trenutno vrijeme koje se OSVJEŽAVA (dorada 6.8.2026.): sat u heroju je
 * bio zamrznut jer se `new Date()` čita samo pri renderu — pokazivao je
 * trenutak zadnjeg dohvata podataka, a ne stvarni sat.
 *
 * Otkucaj je poravnat na PUNU minutu, ne fiksnih 60 s: inače bi se
 * prikaz mijenjao npr. u 12:00:37 umjesto točno u 12:01:00.
 *
 * Pri povratku iz pozadine se osvježi odmah — dok je aplikacija skrivena
 * tajmeri ne rade pouzdano, pa bi se sat vratio zaostao.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const msToNextMinute = 60_000 - (Date.now() % 60_000);
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msToNextMinute);
    };
    schedule();

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      setNow(new Date());
      clearTimeout(timer);
      schedule();
    });

    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return now;
}
