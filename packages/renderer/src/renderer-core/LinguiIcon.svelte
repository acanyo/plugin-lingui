<script lang="ts">
    let { name }: { name: string } = $props()
    const paths: Record<string, string[]> = {
        search: ['M20 20l-5-5', 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0'],
        calendar: ['M4 5h16v16H4z', 'M8 3v4', 'M16 3v4', 'M4 10h16'],
        eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
        eyeOff: ['M3 3l18 18', 'M9 5c1-.3 2-.5 3-.5 6 0 10 7.5 10 7.5s-1 2-3 4', 'M6 6c-3 2-4 6-4 6s4 7 10 7c2 0 4-.8 5-2'],
        cube: ['m12 3 9 5v8l-9 5-9-5V8l9-5Z', 'm3 8 9 5 9-5', 'M12 13v8'],
        database: [
            'M20 6c0 2-3.6 3-8 3S4 8 4 6s3.6-3 8-3 8 1 8 3Z',
            'M4 6v12c0 2 3.6 3 8 3s8-1 8-3V6',
            'M4 12c0 2 3.6 3 8 3s8-1 8-3',
        ],
        heap: ['m5 4-3 5h20l-3-5H5Z', 'M4 13h16', 'M5 17h14', 'M6 21h12'],
        list: ['M4 4v13a3 3 0 0 0 3 3h2', 'M4 10h5', 'M13 5h7', 'M13 12h7', 'M13 19h7'],
        cpu: [
            'M6 6h12v12H6z',
            'M9 9h6v6H9z',
            'M9 3v3',
            'M15 3v3',
            'M9 18v3',
            'M15 18v3',
            'M3 9h3',
            'M3 15h3',
            'M18 9h3',
            'M18 15h3',
        ],
        chevronDown: ['m6 9 6 6 6-6'],
        close: ['M6 6l12 12', 'M18 6 6 18'],
        arrowDown: ['M12 5v14', 'm7 14 5 5 5-5'],
        warning: [
            'M10.3 3.8 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z',
            'M12 9v4',
            'M12 17h.01',
        ],
        info: ['M12 8h.01', 'M12 11v6', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z'],
        check: ['m5 12 4 4L19 6'],
        code: ['m8 5-7 7 7 7', 'm16 5 7 7-7 7', 'm14 3-4 18'],
        layers: ['m12 3 10 5-10 5L2 8l10-5Z', 'm2 12 10 5 10-5', 'm2 16 10 5 10-5'],
        book: [
            'M4 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-3H4V3Z',
            'M20 3h-4a3 3 0 0 0-3 3v15a4 4 0 0 1 4-3h3V3Z',
        ],
        sparkles: ['m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z'],
        arrow: ['M4 12h16', 'm14 6 6 6-6 6'],
        clock: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'M12 6v6l4 2'],
        help: [
            'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
            'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4',
            'M12 17h.01',
        ],
    }
</script>

<svg
    class="lg-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    >{#each paths[name] ?? paths.info! as path}<path d={path} />{/each}</svg
>
