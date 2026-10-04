
export function insertAt(text, start, end, insert) {
  return { text: text.slice(0, start) + insert + text.slice(end), cursor: start + insert.length };
}

export function replaceOnce(text, from, to) {
  const i = text.indexOf(from);
  return i === -1 ? text : text.slice(0, i) + to + text.slice(i + from.length);
}

export const imageMarkdown = (url, alt = 'image') => `![${alt}](${url})`;
