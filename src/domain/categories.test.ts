import { expect, test } from "vitest";
import {
  UNGROUPED,
  groupByCategory,
  usedCategories,
} from "./categories";
import { createAdversary, createCharacter, createEnvironment } from "./factories";

function adversary(name: string, category: string) {
  return { ...createAdversary(name), category };
}

test("sheets are grouped under their category", () => {
  const groups = groupByCategory([
    adversary("Lobo", "Bosque"),
    adversary("Bandido", "Camino"),
    adversary("Oso", "Bosque"),
  ]);

  expect(groups).toHaveLength(2);
  expect(groups[0]?.name).toBe("Bosque");
  expect(groups[0]?.sheets.map((sheet) => sheet.name)).toEqual([
    "Lobo",
    "Oso",
  ]);
  expect(groups[1]?.name).toBe("Camino");
});

test("categories are listed alphabetically", () => {
  const groups = groupByCategory([
    adversary("A", "Zulo"),
    adversary("B", "Acantilado"),
    adversary("C", "Muralla"),
  ]);

  expect(groups.map((group) => group.name)).toEqual([
    "Acantilado",
    "Muralla",
    "Zulo",
  ]);
});

test("uncategorised sheets land in a group of their own, always last", () => {
  const groups = groupByCategory([
    adversary("Suelto", ""),
    adversary("Lobo", "Bosque"),
  ]);

  expect(groups.map((group) => group.name)).toEqual([
    "Bosque",
    UNGROUPED,
  ]);
  expect(groups[1]?.ungrouped).toBe(true);
  expect(groups[1]?.sheets.map((sheet) => sheet.name)).toEqual(["Suelto"]);
});

test("whitespace is not a category", () => {
  const groups = groupByCategory([adversary("Suelto", "   ")]);

  expect(groups).toHaveLength(1);
  expect(groups[0]?.ungrouped).toBe(true);
});

test("no uncategorised group appears when every sheet has one", () => {
  const groups = groupByCategory([adversary("Lobo", "Bosque")]);

  expect(groups).toHaveLength(1);
  expect(groups[0]?.ungrouped).toBe(false);
});

test("an empty list yields no groups rather than an empty heading", () => {
  expect(groupByCategory([])).toEqual([]);
});

test("environments group by the GM's category, not the rules type", () => {
  const social = { ...createEnvironment("Taberna"), category: "Ciudad" };
  const explore = { ...createEnvironment("Cueva"), category: "Bosque" };

  // Both keep their own rules type, which must not affect grouping.
  expect(social.environmentType).toBe("Exploration");
  expect(explore.environmentType).toBe("Exploration");

  const groups = groupByCategory([social, explore]);
  expect(groups.map((group) => group.name)).toEqual(["Bosque", "Ciudad"]);
});

test("characters have no category, so they never split into groups", () => {
  const groups = groupByCategory([
    createCharacter("Alice", "p1"),
    createCharacter("Bob", "p2"),
  ]);

  expect(groups).toHaveLength(1);
  expect(groups[0]?.ungrouped).toBe(true);
  expect(groups[0]?.sheets).toHaveLength(2);
});

test("suggestions list each category once, sorted", () => {
  expect(
    usedCategories([
      adversary("A", "Bosque"),
      adversary("B", "Acantilado"),
      adversary("C", "Bosque"),
      adversary("D", ""),
    ]),
  ).toEqual(["Acantilado", "Bosque"]);
});

test("differing case makes separate groups, which the suggestions prevent", () => {
  // Documents the trade-off: grouping is by exact text, so the editor's
  // suggestions are what keep one group from becoming two.
  const groups = groupByCategory([
    adversary("A", "Bosque"),
    adversary("B", "bosque"),
  ]);

  expect(groups).toHaveLength(2);
});
