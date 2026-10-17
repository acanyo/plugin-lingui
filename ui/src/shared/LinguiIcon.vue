<script setup lang="ts">
defineProps<{ name: string }>()
const paths: Record<string, string[]> = {
  undo: ['M3 10h7', 'M3 10V3', 'M3 10a9 9 0 1 1 2 9'],
  redo: ['M21 10h-7', 'M21 10V3', 'M21 10a9 9 0 1 0-2 9'],
  desktop: ['M3 4h18v12H3z', 'M12 16v4', 'M8 20h8'],
  phone: ['M7 2h10v20H7z', 'M11 18h2'],
  expand: ['M8 3H3v5', 'M16 3h5v5', 'M3 16v5h5', 'M21 16v5h-5'],
  shrink: ['M3 8h5V3', 'M16 3v5h5', 'M8 21v-5H3', 'M21 16h-5v5'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  edit: ['m14 4 6 6', 'm4 14 12-12 6 6-12 12H4v-6Z'],
  copy: ['M9 9h12v12H9z', 'M15 5V3H3v12h2'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 16v5h16v-5'],
  trash: ['M3 6h18', 'M9 6V3h6v3', 'm5 6 1 15h12l1-15', 'M10 10v7', 'M14 10v7'],
  reset: ['M3 10a9 9 0 1 1 2 9', 'M3 3v7h7'],
  sort: ['M3 6h18', 'M6 12h12', 'M9 18h6'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  columns: ['M4 4h16v16H4z', 'M12 4v16', 'M4 10h16'],
  calculator: [
    'M5 3h14v18H5z',
    'M8 7h8',
    'M8 12h.01',
    'M12 12h.01',
    'M16 12h.01',
    'M8 16h.01',
    'M12 16h.01',
    'M16 16h.01',
  ],
  signpost: ['M12 3v18', 'M5 5h12l4 4-4 4H5V5Z'],
  quote: ['M10 6H4v7h6V6Z', 'M4 18c4 0 6-2 6-5', 'M20 6h-6v7h6V6Z', 'M14 18c4 0 6-2 6-5'],
  chart: ['M4 3v18h17', 'M8 16v-4', 'M13 16V7', 'M18 16v-6'],
  search: ['M20 20l-5-5', 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  palette: [
    'M12 3a9 9 0 0 0 0 18h1a2 2 0 0 0 1.6-3.2c-.7-1-.2-2.3 1.1-2.3H18A3 3 0 0 0 21 12a9 9 0 0 0-9-9Z',
    'M7.5 10h.01',
    'M10 6.5h.01',
    'M14.5 6.5h.01',
    'M17 10h.01',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  refresh: [
    'M20 7v5h-5',
    'M4 17v-5h5',
    'M5.2 8a7 7 0 0 1 11.6-3L20 8',
    'M4 16l3.2 3A7 7 0 0 0 18.8 16',
  ],
  close: ['m6 6 12 12', 'M18 6 6 18'],
  chevronLeft: ['m14 5-7 7 7 7'],
  chevronDown: ['m5 9 7 7 7-7'],
  arrowUp: ['M12 19V5', 'm5 12 7-7 7 7'],
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
  message: [
    'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z',
  ],
  help: [
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4',
    'M12 17h.01',
  ],
}
</script>
<template>
  <svg
    class="lg-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(path, index) in paths[name] ?? paths.info" :key="index" :d="path" />
  </svg>
</template>
