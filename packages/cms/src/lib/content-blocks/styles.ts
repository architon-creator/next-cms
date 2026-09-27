/** Card body: 18px regular headings, 12px / 18px text and lists (markers sit at the left edge, in line with the paragraphs). */
export const cardContentClass =
  "[&>:first-child]:mt-0! [&_h4]:mb-3 [&_h4]:text-lg [&_h4]:leading-6 [&_h4]:font-normal [&_p]:text-xs [&_p]:leading-[18px] [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:pl-0 [&_ul]:text-xs [&_ul]:leading-[18px] [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:pl-0 [&_ol]:text-xs [&_ol]:leading-[18px]";

/**
 * Definition-list box: each Heading 4 is a bold row label, followed by its
 * value (paragraphs/lists) — 12px text, bold labels, 26px between rows. Used
 * by Accordion's `necessities` field and by `SpecBoxList`'s `rows` field.
 */
export const definitionRowsClass =
  "[&_h4:not(:first-child)]:mt-[26px] [&_h4]:mb-1 [&_h4]:text-[1.05rem] [&_h4]:leading-6 [&_h4]:font-bold [&_p]:m-0! [&_p]:text-xs [&_p]:leading-[18px]! [&_p]:text-foreground";
