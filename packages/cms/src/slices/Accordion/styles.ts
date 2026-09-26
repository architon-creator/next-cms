/**
 * Class constants for the Accordion. Values come from measuring the source
 * design (ZIPAIR Boarding Process / Special Assistance) in browser DevTools.
 * The `!` and `[&_p]` forms exist to override the shared `ui` accordion, which
 * styles every `a` and `p` inside its content.
 */

/** Trigger row: 20px above/below a 24px line; the shared chevrons are hidden (we draw our own). */
export const triggerClass =
  "cursor-pointer items-center! gap-2.5 py-5! text-base hover:no-underline **:data-[slot=accordion-trigger-icon]:hidden!";

export const titleClass =
  "flex-1 font-bold text-ink group-hover/accordion-trigger:text-primary group-hover/accordion-trigger:underline";

export const iconClass =
  "material-symbols-outlined pointer-events-none shrink-0 leading-none text-primary transition-transform group-aria-expanded/accordion-trigger:rotate-180";

/** Panel: 7px above, 48px below; 16px / 24px body text; links plain, underlined on hover, never recoloured. */
export const contentClass =
  "pt-[7px]! pb-12! text-base text-ink [&_a]:text-primary [&_a]:no-underline [&_a]:hover:text-primary [&_a]:hover:underline [&_p]:mt-4 [&_p]:mb-0 [&_p]:leading-6";

/** Card body: 18px regular headings, 12px / 18px text and lists. */
export const cardContentClass =
  "[&>:first-child]:mt-0! [&_h4]:mb-3 [&_h4]:text-lg [&_h4]:leading-6 [&_h4]:font-normal [&_p]:text-xs [&_p]:leading-[18px] [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-xs [&_ul]:leading-[18px] [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-xs [&_ol]:leading-[18px]";

/** Necessities box: 12px text, bold sub-headings, 26px between groups. */
export const necessitiesContentClass =
  "[&_h4:not(:first-child)]:mt-[26px] [&_h4]:mb-1 [&_h4]:text-[1.05rem] [&_h4]:leading-6 [&_h4]:font-bold [&_p]:m-0! [&_p]:text-xs [&_p]:leading-[18px]! [&_p]:text-foreground";
