interface BadgeProps {
  variant: 'success' | 'error' | 'warning' | 'info' | 'gray';
  children: React.ReactNode;
  dot?: boolean;
}

const variantClasses = {
  success: 'badge-success',
  error: 'badge-error',
  warning: 'badge-warning',
  info: 'badge-info',
  gray: 'badge-gray',
};

const dotColors = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  gray: 'bg-gray-400',
};

export function Badge({ variant, children, dot = false }: BadgeProps) {
  return (
    <span className={variantClasses[variant]}>
      {dot && (
        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}

// ─── Result badge (for change log) ───────────────────────────────────────────

export function ResultBadge({ result }: { result: string }) {
  switch (result) {
    case 'success': return <Badge variant="success" dot>Success</Badge>;
    case 'failed':  return <Badge variant="error" dot>Failed</Badge>;
    case 'skipped': return <Badge variant="gray" dot>Skipped</Badge>;
    case 'read':    return <Badge variant="info" dot>Read</Badge>;
    default:        return <Badge variant="gray">{result}</Badge>;
  }
}

// ─── Action badge ─────────────────────────────────────────────────────────────

export function ActionBadge({ action }: { action: string }) {
  switch (action) {
    case 'add':     return <Badge variant="success">ADD</Badge>;
    case 'set':     return <Badge variant="warning">SET</Badge>;
    case 'remove':  return <Badge variant="error">REMOVE</Badge>;
    case 'read':    return <Badge variant="info">READ</Badge>;
    case 'connect': return <Badge variant="info">CONNECT</Badge>;
    default:        return <Badge variant="gray">{action.toUpperCase()}</Badge>;
  }
}
