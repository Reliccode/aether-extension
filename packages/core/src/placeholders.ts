// Placeholder parsing and template filling utilities

export interface PlaceholderInfo {
    name: string;       // e.g., "first_name"
    displayName: string; // e.g., "First Name"
    fullMatch: string;  // e.g., "{{first_name}}" or "{FIRST_NAME}"
}

export function parseTemplate(content: string): PlaceholderInfo[] {
    const placeholders: PlaceholderInfo[] = [];
    const seen = new Set<string>();
    const regex = /\{\{?([a-zA-Z_][a-zA-Z0-9_]*)\}?\}/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const name = match[1].toLowerCase();
        if (!seen.has(name)) {
            seen.add(name);
            placeholders.push({ name, displayName: formatDisplayName(name), fullMatch: match[0] });
        }
    }
    return placeholders;
}

function formatDisplayName(name: string): string {
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export function fillTemplate(content: string, values: Record<string, string>): string {
    let result = content;
    for (const [key, value] of Object.entries(values)) {
        const patterns = [
            new RegExp(`\\{\\{${key}\\}\\}`, 'gi'),
            new RegExp(`\\{${key}\\}`, 'gi'),
            new RegExp(`\\{\\{${key.toUpperCase()}\\}\\}`, 'g'),
            new RegExp(`\\{${key.toUpperCase()}\\}`, 'g'),
        ];
        for (const pattern of patterns) {
            result = result.replace(pattern, value);
        }
    }
    return result;
}

export function hasPlaceholders(content: string): boolean {
    return parseTemplate(content).length > 0;
}
