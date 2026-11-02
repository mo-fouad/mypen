import { describe, expect, test } from "bun:test";

import {
  SceneGraph,
  type Variable,
  type VariableValue,
} from "@open-pencil/scene-graph";
import { parseColor } from "@open-pencil/scene-graph/color";

import { tokenSections } from "@/app/editor/tokens/panel";

function graphWith(
  variables: Array<[string, Variable["type"], Record<string, VariableValue>]>,
) {
  const graph = new SceneGraph();
  graph.addCollection({
    id: "c",
    name: "Theme",
    modes: [
      { modeId: "light", name: "Light" },
      { modeId: "dark", name: "Dark" },
    ],
    defaultModeId: "light",
    variableIds: [],
  });
  for (const [id, type, valuesByMode] of variables)
    graph.addVariable({
      id,
      name: id,
      type,
      collectionId: "c",
      valuesByMode,
      description: "",
      hiddenFromPublishing: false,
    });
  return graph;
}

function onlyRow(graph: SceneGraph, modes: Record<string, string>, id: string) {
  const row = tokenSections(graph, modes)[0]?.rows.find(
    (candidate) => candidate.id === id,
  );
  if (!row) throw new Error(`missing ${id}`);
  return row;
}

describe("tokenSections", () => {
  test("reads values for the chosen mode", () => {
    const graph = graphWith([
      [
        "bg",
        "COLOR",
        { light: parseColor("#ffffff"), dark: parseColor("#000000") },
      ],
    ]);
    const before = structuredClone(graph.variables.get("bg"));
    const light = onlyRow(graph, {}, "bg");
    const dark = onlyRow(graph, { c: "dark" }, "bg");
    expect(light.color).not.toBeNull();
    expect(dark.color).not.toBeNull();
    expect(light.color).not.toBe(dark.color);
    expect(light.color).toContain("255");
    expect(dark.color).toContain("0");
    expect(structuredClone(graph.variables.get("bg"))).toEqual(before);
    const section = tokenSections(graph, {})[0];
    expect(section?.modes).toEqual([
      { id: "light", name: "Light" },
      { id: "dark", name: "Dark" },
    ]);
  });

  test("shows an alias by its target", () => {
    const graph = graphWith([
      [
        "A",
        "COLOR",
        { light: parseColor("#3B2AA8"), dark: parseColor("#3B2AA8") },
      ],
      ["B", "COLOR", { light: { aliasId: "A" }, dark: { aliasId: "A" } }],
    ]);
    const a = onlyRow(graph, {}, "A");
    const b = onlyRow(graph, {}, "B");
    expect(b.aliasOf).toBe("A");
    expect(b.color).toBe(a.color);
    expect(a.aliasOf).toBeNull();
  });

  test("formats numbers and strings", () => {
    const graph = graphWith([
      ["gap", "FLOAT", { light: 12, dark: 12 }],
      ["font", "STRING", { light: "Inter", dark: "Inter" }],
    ]);
    expect(onlyRow(graph, {}, "gap")).toMatchObject({
      display: "12",
      color: null,
    });
    expect(onlyRow(graph, {}, "font")).toMatchObject({
      display: "Inter",
      color: null,
    });
  });
});
