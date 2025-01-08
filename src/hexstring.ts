// TODO: properly type this thing
export type HexString<L extends number> = string & { length: L };

export function isHexString<L extends number>(subject: unknown, length?: L): subject is HexString<L> {
  if ('string' !== typeof subject) return false;
  if ('number' === typeof length && subject.length !== length) return false;
  return !subject.match(/[^0-9a-zA-Z]/);
}

export function randomHexString<L extends number>(length?: L): HexString<L> {
  // @ts-ignore Shut up, it's a number, like I said 1 line prior
  if ('number' !== typeof length) length = 64;
  let output = '';
  while(output.length < length) output += Math.random().toString(16).slice(2);
  return output.slice(0, length) as HexString<L>;
}

