export const paintings = [
  {
    id: 'renoir', title: 'Woman with a Parasol in a Garden', artist: 'Pierre-Auguste Renoir',
    credit: 'Renoir, 1875', src: '/images/renoir-woman-parasol-garden.webp', width: 2400, height: 2016,
    url: 'https://www.museothyssen.org/en/collection/artists/renoir-pierre-auguste/woman-parasol-garden',
    crop: 'object-[center_36%] compact:object-[50%_center]',
    description: 'Two figures stand among flowering shrubs and dense greenery.',
  },
  {
    id: 'knox', title: 'Landscape with Tourists at Loch Katrine', artist: 'John Knox',
    credit: 'Knox, c. 1815–1820', src: '/images/knox-loch-katrine.webp', width: 2400, height: 1723,
    url: 'https://www.nationalgalleries.org/art-and-artists/20897',
    crop: 'object-center compact:object-[45%_center]',
    description: 'Tourists overlook a mountain loch beneath an expansive sky.',
  },
  {
    id: 'monet', title: 'The Water-Lily Pond', artist: 'Claude Monet',
    credit: 'Monet, 1899', src: '/images/monet-water-lily-pond.webp', width: 3200, height: 3105,
    url: 'https://www.nationalgallery.org.uk/paintings/claude-monet-the-water-lily-pond',
    crop: 'object-[center_48%] compact:object-center',
    description: 'A curved bridge crosses a lily-covered pond surrounded by willows and reflected greenery.',
  },
  {
    id: 'kensett', title: 'Lake George', artist: 'John Frederick Kensett',
    credit: 'Kensett, 1869', src: '/images/kensett-lake-george.webp', width: 3200, height: 2164,
    url: 'https://www.metmuseum.org/art/collection/search/11311',
    crop: 'object-center compact:object-[42%_center]',
    description: 'Still lake water, wooded islands, and distant mountains beneath a luminous sky.',
  },
  {
    id: 'sorolla', title: 'Valencian Fishermen', artist: 'Joaquín Sorolla',
    credit: 'Sorolla, 1895', src: '/images/sorolla-valencian-fishermen.webp', width: 3200, height: 2372,
    url: 'https://www.nationalgallery.org.uk/paintings/joaquin-sorolla-valencian-fishermen',
    crop: 'object-center compact:object-[58%_center]',
    description: 'Fishermen work with wicker baskets in sunlit surf beside a sailing boat.',
  },
] as const;

export type Painting = typeof paintings[number];

export function pickPainting(previousId: string | null, random = Math.random()): Painting {
  const candidates = paintings.filter(painting => painting.id !== previousId);
  return candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random * candidates.length)))];
}

export function nextPainting(currentId: string | null): Painting {
  return paintings[(paintings.findIndex(painting => painting.id === currentId) + 1) % paintings.length];
}
