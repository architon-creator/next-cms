/**
 * Values of the items that start expanded. Every item starts collapsed unless
 * the editor ticked `start_expanded`.
 */
export function getOpenValues(items: { start_expanded?: boolean | null }[]): string[] {
  return items.flatMap((item, index) => (item.start_expanded ? [itemValue(index)] : []));
}

export function itemValue(index: number): string {
  return `item-${index}`;
}
