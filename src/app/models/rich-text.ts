// Rule formatting: a small BBCode-like markup, rendered as text nodes (never as HTML).
//   [color=green]..[/color]  [color=red]..[/color]  [color=orange]..[/color]  (no tag = white)
//   [u]..[/u] underline   [s]..[/s] strikethrough
//   a line starting with "* " is a bullet; consecutive bullets form one list
// Anything that isn't a valid tag stays visible as plain text.

export const RULE_COLORS = { green: '#0CD90D', red: '#E40303', orange: '#FF9933' } as const;
export type RuleColor = keyof typeof RULE_COLORS;

export interface Segment {
  text: string;
  color?: RuleColor;
  underline: boolean;
  strike: boolean;
}

export interface RuleBlock {
  list: boolean;
  lines: Segment[][];
}

const TAG = /\[(\/?)(color|u|s)(?:=(green|red|orange))?\]/g;
export const BULLET = /^\*\s+/;

export function parseLine(line: string): Segment[] {
  const out: Segment[] = [];
  const colors: RuleColor[] = [];
  let underline = 0;
  let strike = 0;
  let last = 0;
  const push = (text: string) => {
    if (text) out.push({ text, color: colors[colors.length - 1], underline: underline > 0, strike: strike > 0 });
  };
  for (const m of line.matchAll(TAG)) {
    const [raw, close, name, value] = m;
    const open = name === 'color' ? colors.length : name === 'u' ? underline : strike;
    const valid = close ? open > 0 && !value : name === 'color' ? !!value : !value;
    if (!valid) continue; // left in the text as-is
    push(line.slice(last, m.index));
    last = m.index! + raw.length;
    const step = close ? -1 : 1;
    if (name === 'color') close ? colors.pop() : colors.push(value as RuleColor);
    else if (name === 'u') underline += step;
    else strike += step;
  }
  push(line.slice(last));
  return out;
}

export function parseRules(rules: string[]): RuleBlock[] {
  const blocks: RuleBlock[] = [];
  for (const rule of rules) {
    if (!rule.trim()) continue;
    const list = BULLET.test(rule);
    const segments = parseLine(list ? rule.replace(BULLET, '') : rule);
    const current = blocks[blocks.length - 1];
    if (current?.list === list) current.lines.push(segments);
    else blocks.push({ list, lines: [segments] });
  }
  return blocks;
}
