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
  "pt-[7px]! pb-12! text-base text-ink [&_a]:text-primary [&_a]:no-underline [&_a]:hover:text-primary [&_a]:hover:underline [&_p]:mt-4 [&_p]:mb-0 [&_p]:leading-6 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:pl-0 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:pl-0";
