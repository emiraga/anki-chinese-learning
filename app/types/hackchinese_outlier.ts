// Type definitions for HackChinese Outlier character data
/* eslint-disable @typescript-eslint/naming-convention */

export interface ComponentAnalysis {
  id: number;
  outlier_datum_id: number;
  position: number;
  component: string;
  description: string;
  created_at: string;
  updated_at: string;
  component_type: string;
  component_type_desc: string;
  charset: "simp" | "trad";
}

export interface HackChineseOutlierCharacter {
  id: number;
  word_id: number;
  form_explanation_simp: string;
  form_explanation_trad: string | null;
  ancient_form_image: string | null;
  meaning_tree_as_character_simp: string;
  meaning_tree_as_character_trad: string | null;
  meaning_tree_as_component_simp: string;
  meaning_tree_as_component_trad: string | null;
  simplified: string;
  so_diagram_simp: string;
  so_diagram_trad: string | null;
  free: boolean;
  component_analyses: ComponentAnalysis[];
}
