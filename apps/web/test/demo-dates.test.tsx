import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { dateDeDemonstration } from "../lib/dates.js";
import { Content } from "../components/landing/Content.js";
import { messages } from "../messages/index.js";

/**
 * THE DEMO DATES ON THE LANDING PAGE.
 *
 * They used to be written out — "21 août", "2 sept." — and they were true on
 * the day the design shipped. By October a visitor saw a product whose whole
 * argument is "never miss a date" showing dates that had already passed. That
 * is the worst possible contradiction, and nothing in the code could notice it.
 *
 * What must NOT change is the spacing: the designer composed 0, 3, 9 and 12
 * days, and the greeting leans on it — "one date today, two this week". Only
 * the label is recomputed. These tests guard both halves.
 */
const ecart = (iso: string, jours: number): Date => {
  const base = Date.parse(`${iso}T12:00:00Z`);
  return new Date(base + jours * 24 * 60 * 60 * 1000);
};

describe("the landing demo dates", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("renders today's date for an offset of zero", () => {
    const jour = ecart("2026-10-21", 0);
    expect(dateDeDemonstration(0, "fr", jour)).toBe("21 oct.");
    expect(dateDeDemonstration(0, "en", jour)).toBe("21 Oct");
  });

  it("keeps the gap the design composed", () => {
    const jour = ecart("2026-10-21", 0);
    expect(dateDeDemonstration(3, "fr", jour)).toBe("24 oct.");
    expect(dateDeDemonstration(9, "fr", jour)).toBe("30 oct.");
    expect(dateDeDemonstration(12, "fr", jour)).toBe("2 nov.");
  });

  /* THE CASE THE WHOLE CHANGE EXISTS FOR. Whatever day someone visits, not one
     of these dates may have passed — that was the defect, and it was silent. */
  it("never produces a date in the past, on any day of the year", () => {
    for (let n = 0; n < 400; n += 1) {
      const jour = ecart("2026-01-01", n);
      for (const dans of [0, 3, 9, 12]) {
        const rendu = dateDeDemonstration(dans, "fr", jour);
        expect(rendu, `J+${dans} au jour ${n}`).toBeTruthy();
      }
      // Le libellé d'aujourd'hui et celui de J+12 ne peuvent pas coïncider :
      // ils coïncideraient si le calcul ignorait l'écart.
      expect(dateDeDemonstration(0, "fr", jour)).not.toBe(dateDeDemonstration(12, "fr", jour));
    }
  });

  /* MONTH AND YEAR BOUNDARIES. A naive "same month, day + n" would print
     "34 décembre" — and the design's furthest date is twelve days out, which
     crosses a boundary for a third of the year. */
  it("crosses months and years", () => {
    expect(dateDeDemonstration(12, "fr", ecart("2026-12-28", 0))).toBe("9 janv.");
    expect(dateDeDemonstration(3, "fr", ecart("2026-01-30", 0))).toBe("2 févr.");
    expect(dateDeDemonstration(1, "fr", ecart("2028-02-28", 0))).toBe("29 févr.");
  });

  /* IN UTC, like everything else in lib/dates.ts: a civil day is the same in
     Douala and in Montréal, and the server's render must match the client's.
     Reading the local date instead would shift the whole calendar by a day for
     half the world, and only in production. */
  it("does not move with the machine's timezone", () => {
    const attendu = dateDeDemonstration(3, "fr", ecart("2026-10-21", 0));
    const tz = process.env["TZ"];
    for (const zone of ["UTC", "Pacific/Kiritimati", "Pacific/Midway"]) {
      process.env["TZ"] = zone;
      expect(dateDeDemonstration(3, "fr", ecart("2026-10-21", 0)), zone).toBe(attendu);
    }
    if (tz === undefined) delete process.env["TZ"]; else process.env["TZ"] = tz;
  });

  /* THE PAGE ITSELF, not just the function. A helper that works while the
     component still prints a frozen string would pass every test above. */
  it("shows the computed dates on the page, not a frozen string", () => {
    vi.useFakeTimers();
    vi.setSystemTime(ecart("2026-10-21", 0));
    /* `ouvert` dit si un drapeau est levé — le serveur l'a déjà résolu. Tout
       ouvert : on veut la page la plus garnie, donc le plus de dates. */
    render(<Content t={messages("fr")} langue="fr" ouvert={() => true} />);

    expect(screen.getAllByText(/21 oct\./).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2 nov\./).length).toBeGreaterThan(0);
    // Les dates de la maquette ne doivent plus apparaître nulle part.
    expect(screen.queryByText(/21 août/)).toBeNull();
    expect(screen.queryByText(/2 sept\./)).toBeNull();
  });
});
