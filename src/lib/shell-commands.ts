// Detect heredoc delimiter in a line, e.g. <<EOF, <<'EOF', <<-"EOF"
export function findHeredocDelimiter(line: string): string {
  const match = line.match(/<<-?\s*['"]?(\w+)['"]?/);
  return match ? match[1] : '';
}

// Extract copyable commands from a shell snippet.
// Includes lines starting with "$ " (prompt stripped), "# " (comments),
// continuation lines (after \), and heredoc bodies.
// Skips command output.
export function extractShellCommands(text: string): string {
  const lines = text.split('\n');
  const result = [];
  let capturing = false;
  let inHeredoc = false;
  let heredocLabel = '';

  for (const line of lines) {
    if (inHeredoc) {
      result.push(line);
      if (line.trimEnd() === heredocLabel) {
        inHeredoc = false;
        heredocLabel = '';
      }
      continue;
    }

    if (line.startsWith('$ ') || line.startsWith('# ')) {
      const content = line.startsWith('$ ') ? line.slice(2) : line;
      result.push(content);
      heredocLabel = findHeredocDelimiter(content);
      inHeredoc = heredocLabel !== '';
      capturing = !inHeredoc && content.endsWith('\\');
      continue;
    }

    if (capturing) {
      result.push(line);
      heredocLabel = findHeredocDelimiter(line);
      inHeredoc = heredocLabel !== '';
      capturing = !inHeredoc && line.endsWith('\\');
    }
  }

  return result.join('\n');
}
