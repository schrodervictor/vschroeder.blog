import { describe, it, expect } from 'vitest';
import { extractShellCommands, findHeredocDelimiter } from './shell-commands';

describe('findHeredocDelimiter', () => {
  it('returns empty string for plain commands', () => {
    expect(findHeredocDelimiter('echo hello')).toBe('');
  });

  it('detects <<EOF', () => {
    expect(findHeredocDelimiter('cat <<EOF')).toBe('EOF');
  });

  it('detects <<-EOF (with dash for indented heredocs)', () => {
    expect(findHeredocDelimiter('cat <<-EOF')).toBe('EOF');
  });

  it("detects quoted delimiter <<'EOF'", () => {
    expect(findHeredocDelimiter("cat <<'EOF'")).toBe('EOF');
  });

  it('detects double-quoted delimiter <<"EOF"', () => {
    expect(findHeredocDelimiter('cat <<"EOF"')).toBe('EOF');
  });

  it('detects heredoc mid-line', () => {
    expect(findHeredocDelimiter('tee /etc/config <<EOF')).toBe('EOF');
  });

  it('detects custom labels', () => {
    expect(findHeredocDelimiter("cat <<'SCRIPT'")).toBe('SCRIPT');
  });
});

describe('extractShellCommands', () => {
  it('extracts a simple command', () => {
    const input = '$ echo hello\nhello';
    expect(extractShellCommands(input)).toBe('echo hello');
  });

  it('strips $ prompt but keeps # comments', () => {
    const input = [
      '# this is a comment',
      '$ ls -la',
      'total 42',
    ].join('\n');
    expect(extractShellCommands(input)).toBe(
      ['# this is a comment', 'ls -la'].join('\n')
    );
  });

  it('skips output lines', () => {
    const input = [
      '$ whoami',
      'victor',
      '$ pwd',
      '/home/victor',
    ].join('\n');
    expect(extractShellCommands(input)).toBe('whoami\npwd');
  });

  it('captures continuation lines (backslash)', () => {
    const input = [
      '$ docker run \\',
      '  --rm \\',
      '  -it ubuntu',
      'some output',
    ].join('\n');
    expect(extractShellCommands(input)).toBe(
      ['docker run \\', '  --rm \\', '  -it ubuntu'].join('\n')
    );
  });

  it('preserves space indentation in continuation lines', () => {
    const input = [
      '$ terraform apply \\',
      '    -var="region=eu" \\',
      '    -auto-approve',
    ].join('\n');
    expect(extractShellCommands(input)).toBe(
      ['terraform apply \\', '    -var="region=eu" \\', '    -auto-approve'].join('\n')
    );
  });

  it('preserves tab indentation in continuation lines', () => {
    const input = [
      '$ curl \\',
      '\t-X POST \\',
      '\t-H "Content-Type: application/json" \\',
      '\thttp://localhost:8080/api',
      '{"ok":true}',
    ].join('\n');
    expect(extractShellCommands(input)).toBe(
      ['curl \\', '\t-X POST \\', '\t-H "Content-Type: application/json" \\', '\thttp://localhost:8080/api'].join('\n')
    );
  });

  it('captures heredoc body', () => {
    const input = [
      "$ cat <<'EOF'",
      'line one',
      'line two',
      'EOF',
      'some output',
    ].join('\n');
    expect(extractShellCommands(input)).toBe(
      ["cat <<'EOF'", 'line one', 'line two', 'EOF'].join('\n')
    );
  });

  it('preserves space indentation inside heredoc', () => {
    const input = [
      "$ cat > config.yaml <<'EOF'",
      'server:',
      '  host: localhost',
      '  port: 8080',
      '  nested:',
      '    deep: value',
      'EOF',
    ].join('\n');
    expect(extractShellCommands(input)).toBe(
      [
        "cat > config.yaml <<'EOF'",
        'server:',
        '  host: localhost',
        '  port: 8080',
        '  nested:',
        '    deep: value',
        'EOF',
      ].join('\n')
    );
  });

  it('preserves tab indentation inside heredoc', () => {
    const input = [
      "$ cat > Makefile <<'EOF'",
      'build:',
      '\tgo build -o bin/app',
      '',
      'test:',
      '\tgo test ./...',
      'EOF',
    ].join('\n');
    expect(extractShellCommands(input)).toBe(
      [
        "cat > Makefile <<'EOF'",
        'build:',
        '\tgo build -o bin/app',
        '',
        'test:',
        '\tgo test ./...',
        'EOF',
      ].join('\n')
    );
  });

  it('preserves mixed tabs and spaces inside heredoc', () => {
    const input = [
      '$ cat <<EOF',
      '\t  mixed indent',
      '  \ttabs after spaces',
      'EOF',
    ].join('\n');
    expect(extractShellCommands(input)).toBe(
      ['cat <<EOF', '\t  mixed indent', '  \ttabs after spaces', 'EOF'].join('\n')
    );
  });

  it('captures heredoc after continuation lines', () => {
    const input = [
      '$ cat \\',
      "  <<'EOF'",
      'hello world',
      'EOF',
    ].join('\n');
    expect(extractShellCommands(input)).toBe(
      ['cat \\', "  <<'EOF'", 'hello world', 'EOF'].join('\n')
    );
  });

  it('handles multiple commands with mixed features', () => {
    const input = [
      '$ mkdir -p /tmp/test',
      '$ cd /tmp/test',
      "$ cat > file.txt <<'EOF'",
      'some content',
      'EOF',
      '$ ls',
      'file.txt',
    ].join('\n');
    expect(extractShellCommands(input)).toBe(
      [
        'mkdir -p /tmp/test',
        'cd /tmp/test',
        "cat > file.txt <<'EOF'",
        'some content',
        'EOF',
        'ls',
      ].join('\n')
    );
  });

  it('returns empty string for output-only text', () => {
    const input = 'just some output\nmore output';
    expect(extractShellCommands(input)).toBe('');
  });

  it('handles empty input', () => {
    expect(extractShellCommands('')).toBe('');
  });
});
