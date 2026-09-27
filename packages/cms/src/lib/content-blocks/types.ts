import type { ImageField, KeyTextField, LinkField, RichTextField } from "@prismicio/client";

/**
 * The `blocks` Group's item shape — structural, not tied to any one slice's
 * generated type. Any slice whose `blocks` Group uses these exact field ids
 * (Accordion's `with_cards` variation, `FlexibleContent`, …) can pass its
 * `slice.primary.blocks` straight to `<Blocks>` without a per-slice cast:
 * Prismic generates the same field types for identically-configured fields,
 * so the generated Group-item type is structurally assignable to this one.
 */
export type BlockItem = {
  text: RichTextField;
  image: ImageField;
  card_heading: KeyTextField;
  card_body: RichTextField;
  link_label: KeyTextField;
  link: LinkField;
  button_label: KeyTextField;
  button_link: LinkField;
  button_caption: KeyTextField;
};
