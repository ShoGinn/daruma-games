export function oneLine(
    strings: TemplateStringsArray,
    ...keys: Array<string | number | bigint>
): string {
    return strings
        .reduce((result, part, i) => `${result}${part}${keys[i] ?? ''}`, '')
        .replace(/(?:\n(?:\s*))+/g, ' ')
        .split('NEWLINE')
        .join('\n')
        .trim();
}

export function numberAlign(number: number, align: number = 2): string {
    return number.toString().padStart(align, ' ');
}

export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

export function onlyDigits(string: string): string {
    return string.replace(/\D/g, '');
}
