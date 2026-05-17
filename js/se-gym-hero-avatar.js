(function () {
  'use strict';

  var STORAGE_KEY = 'se-gym-hero-avatar';
  var SCHEMA_VERSION = 1;

  var ENUMS = {
    presentation: ['male', 'female'],
    hairStyle: ['short', 'textured-crop', 'straight-fringe', 'side-parted-short', 'soft-two-block', 'slick-back', 'long', 'long-layers', 'long-straight', 'loose-waves', 'wavy-lob', 'curtain-bangs', 'soft-bangs', 'curly', 'curly-bob', 'voluminous-curls', 'curly-layers', 'wavy', 'locs', 'loose-locs', 'braids', 'long-braid', 'braided-pony', 'side-braid', 'braided-bun', 'afro', 'rounded-afro', 'coily-puff', 'double-puffs', 'bantu-knots', 'bun', 'ponytail', 'high-pony', 'sleek-low-pony', 'claw-clip-updo', 'pigtails', 'mohawk', 'undercut', 'top-knot', 'pixie', 'cornrows', 'bowl-cut', 'bob', 'layered-bob', 'pompadour', 'side-swept', 'dreads-bun', 'bald', 'fade', 'buzz', 'shoulder-length', 'center-part', 'shag', 'coils', 'twist-out', 'box-braids', 'low-bun', 'messy-bun', 'half-up'],
    eyebrowStyle: ['arched', 'straight', 'thick', 'thin', 'rounded', 'angular'],
    eyeShape: ['round', 'almond', 'monolid', 'hooded', 'smiling', 'wide'],
    noseShape: ['soft', 'rounded', 'broad', 'narrow', 'button', 'defined-bridge'],
    mouthStyle: ['smile', 'soft-smile', 'grin', 'neutral', 'full-lips'],
    headStyle: ['default', 'feminine', 'round', 'heart', 'oval', 'square', 'soft-oval', 'full-cheeks', 'narrow', 'oblong', 'diamond', 'soft-square', 'broad', 'full-oval', 'tapered-oval', 'soft-round-jaw', 'soft-angular'],
    facialHair: ['none', 'stubble', 'mustache', 'soul-patch', 'goatee', 'sideburns', 'chin-strap', 'short-beard', 'trimmed-beard', 'full-beard'],
    faceFeature: ['none', 'freckles', 'beauty-mark', 'dimples', 'cheek-lines'],
    bodyType: ['petite', 'petite-curved', 'short-soft', 'short-curved', 'slim', 'narrow-shoulders', 'compact-lean', 'lean', 'medium-lean', 'straight', 'average', 'soft', 'soft-medium', 'athletic', 'athletic-curved', 'soft-athletic', 'v-shape', 'muscular', 'compact-strong', 'broad', 'broad-lean', 'stocky', 'tall', 'tall-lean', 'tall-soft', 'tall-curved', 'curvy', 'balanced-curved', 'medium-curved', 'rounded', 'medium-full', 'soft-tapered', 'hourglass', 'pear', 'soft-full-hips', 'voluptuous', 'plus-size', 'balanced-full'],
    outfitStyle: ['super-suit', 'hoodie', 'varsity-jacket', 'denim-jacket', 'windbreaker', 'lab-coat', 'collared-shirt', 'kurta-top', 'cardigan', 'captain-jacket', 'utility-vest'],
    accessory: ['none', 'glasses', 'rectangular-glasses', 'wireframe-glasses', 'round-rim-glasses', 'safety-goggles', 'visor', 'tech-visor', 'headband', 'spectacles', 'mask', 'monocle', 'eyepatch', 'earrings', 'hoop-earrings', 'forehead-accent', 'beanie', 'crown', 'halo', 'baseball-cap', 'bucket-hat', 'headwrap', 'draped-scarf', 'hijab', 'turban']
  };

  // Silhouette overlays are used only for shoulder emphasis; torso geometry handles body contours.
  var BODY_SILHOUETTES = {
    'petite':      [],
    'petite-curved': [],
    'short-soft':  [],
    'short-curved': [],
    'slim':        [],
    'narrow-shoulders': [],
    'compact-lean': [],
    'lean':        [],
    'medium-lean': [],
    'straight':    [],
    'average':     [],
    'soft':        [],
    'soft-medium': [],
    'athletic':    ['shoulder'],
    'athletic-curved': ['shoulder'],
    'soft-athletic': ['shoulder'],
    'v-shape':     ['shoulder'],
    'muscular':    ['shoulder'],
    'compact-strong': ['shoulder'],
    'broad':       ['shoulder'],
    'broad-lean':  ['shoulder'],
    'stocky':      ['shoulder'],
    'tall':        [],
    'tall-lean':   [],
    'tall-soft':   [],
    'tall-curved': [],
    'curvy':       [],
    'balanced-curved': [],
    'medium-curved': [],
    'rounded':     [],
    'medium-full': [],
    'soft-tapered': [],
    'hourglass':   [],
    'pear':        [],
    'soft-full-hips': [],
    'voluptuous':  [],
    'plus-size':   [],
    'balanced-full': []
  };
  var ALL_SILHOUETTE_FEATURES = ['bust', 'waist', 'hip', 'shoulder'];
  var HAIR_COVERING_ACCESSORIES = { headwrap: true, 'draped-scarf': true, hijab: true, turban: true };
  var FACE_ACCESSORIES = ['glasses', 'rectangular-glasses', 'wireframe-glasses', 'round-rim-glasses', 'safety-goggles', 'tech-visor', 'spectacles', 'monocle', 'mask', 'eyepatch'];
  var DETAIL_ACCESSORIES = ['earrings', 'hoop-earrings', 'forehead-accent', 'crown', 'halo'];
  var HEADWEAR_ACCESSORIES = ['headband', 'beanie', 'baseball-cap', 'bucket-hat', 'headwrap', 'draped-scarf', 'hijab', 'turban', 'visor'];
  var FACE_ACCESSORY_PRIORITY = ['mask', 'eyepatch', 'tech-visor', 'safety-goggles', 'round-rim-glasses', 'wireframe-glasses', 'rectangular-glasses', 'glasses', 'spectacles', 'monocle'];
  var HEAD_ACCESSORY_PRIORITY = ['hijab', 'headwrap', 'draped-scarf', 'turban', 'beanie', 'baseball-cap', 'bucket-hat', 'visor', 'crown', 'headband'];
  var EAR_ACCESSORY_PRIORITY = ['hoop-earrings', 'earrings'];
  var DETAIL_ACCESSORY_PRIORITY = ['forehead-accent', 'halo'];

  // Body-type → body-shape (SVG geometry override). Types not listed here use the default torso.
  // The shapes are full silhouette swaps so the body actually looks different, not just scaled.
  var BODY_SHAPES = {
    'petite-curved': 'petite-curved',
    'short-soft': 'short-soft',
    'short-curved': 'short-curved',
    'narrow-shoulders': 'narrow-shoulders',
    'compact-lean': 'compact-lean',
    'medium-lean': 'medium-lean',
    'straight':   'straight',
    'soft':       'soft',
    'soft-medium': 'soft-medium',
    'athletic-curved': 'athletic-curved',
    'soft-athletic': 'soft-athletic',
    'v-shape':    'v-shape',
    'compact-strong': 'compact-strong',
    'broad-lean': 'broad-lean',
    'stocky':     'stocky',
    'tall-lean':  'tall-lean',
    'tall-soft':  'tall-soft',
    'tall-curved': 'tall-curved',
    'curvy':      'curvy',
    'balanced-curved': 'balanced-curved',
    'medium-curved': 'medium-curved',
    'rounded':    'rounded',
    'medium-full': 'medium-full',
    'soft-tapered': 'soft-tapered',
    'hourglass':  'hourglass',
    'pear':       'pear',
    'soft-full-hips': 'soft-full-hips',
    'voluptuous': 'voluptuous',
    'plus-size':  'plus-size',
    'balanced-full': 'balanced-full',
    'muscular':   'muscular',
    'broad':      'broad'
  };

  var DEFAULTS = {
    version: SCHEMA_VERSION,
    appearance: {
      skin: '#dfa07a',
      hairColor: '#1f140c',
      hairStyle: 'short',
      eyeColor: '#1f140c',
      eyebrowStyle: 'arched',
      headStyle: 'default',
      eyeShape: 'round',
      noseShape: 'soft',
      mouthStyle: 'smile',
      facialHair: 'none',
      faceFeature: 'none'
    },
    body: { type: 'athletic' },
    outfit: {
      style: 'super-suit',
      suit: '#1F6EBD',
      capeOuter: '#15538f',
      capeInner: '#FFD100',
      accessory: 'none',
      accessories: [],
      emblem: ''
    }
  };

  var PALETTES = {
    skin: ['#fce0c0', '#f4d3a5', '#f0c294', '#e4b477', '#dfa07a', '#c9925d', '#c08660', '#a06840', '#8b5a35', '#7a4e2f', '#5c3a22', '#3d2515'],
    hair: ['#1f140c', '#3d2818', '#6a4830', '#a07050', '#c08555', '#d8b074', '#e8d090', '#704530', '#1a1a1a', '#2e2e2e', '#5e3a2f', '#854a3a', '#b85a3a', '#9a3a2a', '#d8b074', '#7a4a2f'],
    eye: ['#1f140c', '#3a2818', '#5a4030', '#3a5a3a', '#3a5a7a', '#5a3a7a', '#7a4a3a', '#2a2a4a'],
    suit: ['#1F6EBD', '#1F8FBD', '#1FBD8F', '#5A1FBD', '#BD1F6E', '#BD8F1F', '#8FBD1F', '#1FBD1F', '#bd2a2a', '#2a4abd', '#222244', '#2a2a2a'],
    cape: ['#15538f', '#8f1515', '#15568f', '#558f15', '#558f15', '#8f8f15', '#5a158f', '#0f0f0f', '#5a5a5a', '#8f4a15', '#15568f', '#3a3a3a'],
    capeInner: ['#FFD100', '#FF8F00', '#FF1F1F', '#1FFF8F', '#8F1FFF', '#FFFFFF', '#0a0a0a', '#FFE470']
  };

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function weightedFrom(items) {
    var total = 0;
    for (var i = 0; i < items.length; i++) total += items[i].weight;
    var roll = Math.random() * total;
    for (var j = 0; j < items.length; j++) {
      roll -= items[j].weight;
      if (roll <= 0) return Object.prototype.hasOwnProperty.call(items[j], 'value') ? items[j].value : items[j];
    }
    var fallback = items[items.length - 1];
    return Object.prototype.hasOwnProperty.call(fallback, 'value') ? fallback.value : fallback;
  }

  function weightedValue(value, weight) {
    return { value: value, weight: weight };
  }

  function weightedValues(values, weight) {
    var items = [];
    for (var i = 0; i < values.length; i++) items.push(weightedValue(values[i], weight));
    return items;
  }

  function weightedPalette(values, commonWeight, accentWeight) {
    var items = [];
    for (var i = 0; i < values.length; i++) {
      var weight = i < commonWeight.length ? commonWeight[i] : accentWeight;
      items.push(weightedValue(values[i], weight));
    }
    return items;
  }

  function pickWeightedColor(items) {
    return weightedFrom(items);
  }

  var SKIN_TONE_BANDS = [
    weightedValue(['#fce0c0', '#f4d3a5', '#f0c294'], 1),
    weightedValue(['#e4b477', '#dfa07a', '#c9925d', '#c08660'], 1),
    weightedValue(['#a06840', '#8b5a35', '#7a4e2f'], 1),
    weightedValue(['#5c3a22', '#3d2515'], 1)
  ];
  var HAIR_COLOR_WEIGHTS = weightedPalette(PALETTES.hair, [16, 15, 13, 9, 6, 4, 3, 10, 16, 9, 13, 5, 2, 2, 3, 8], 1);
  var EYE_COLOR_WEIGHTS = weightedPalette(PALETTES.eye, [12, 11, 8, 4, 4, 2, 5, 2], 2);
  var SUIT_COLOR_WEIGHTS = weightedPalette(PALETTES.suit, [14, 10, 8, 2, 3, 5, 2, 4, 8, 11, 12, 12], 1);
  var CAPE_COLOR_WEIGHTS = weightedPalette(PALETTES.cape, [13, 5, 10, 5, 5, 2, 2, 9, 8, 4, 10, 9], 1);
  var ACCENT_COLOR_WEIGHTS = weightedPalette(PALETTES.capeInner, [10, 4, 3, 2, 2, 8, 4, 8], 1);
  var BODY_TYPE_WEIGHTS = []
    .concat(weightedValues(['average', 'athletic', 'lean', 'slim', 'straight', 'soft', 'medium-lean', 'soft-medium'], 9))
    .concat(weightedValues(['tall', 'curvy', 'broad', 'stocky', 'petite', 'rounded', 'v-shape', 'balanced-curved', 'medium-curved', 'short-soft', 'short-curved', 'tall-soft', 'soft-athletic', 'medium-full'], 4))
    .concat(weightedValues(['petite-curved', 'narrow-shoulders', 'compact-lean', 'athletic-curved', 'muscular', 'compact-strong', 'broad-lean', 'tall-lean', 'tall-curved', 'soft-tapered', 'hourglass', 'pear', 'soft-full-hips', 'voluptuous', 'plus-size', 'balanced-full'], 2));
  var HEAD_STYLE_WEIGHTS = []
    .concat(weightedValues(['default', 'soft-oval', 'round', 'full-cheeks', 'full-oval', 'oval', 'soft-square', 'soft-round-jaw'], 8))
    .concat(weightedValues(['heart', 'diamond', 'square', 'broad', 'narrow', 'oblong', 'tapered-oval', 'soft-angular', 'feminine'], 3));
  var PRESENTATION_BODY_WEIGHTS = {
    male: []
      .concat(weightedValues(['average', 'athletic', 'lean', 'slim', 'straight', 'soft', 'medium-lean', 'soft-medium'], 9))
      .concat(weightedValues(['tall', 'broad', 'stocky', 'v-shape', 'muscular', 'broad-lean', 'tall-lean', 'compact-lean', 'compact-strong', 'narrow-shoulders', 'soft-athletic', 'tall-soft'], 5))
      .concat(weightedValues(['petite', 'curvy', 'rounded', 'balanced-curved', 'medium-curved', 'petite-curved', 'short-soft', 'short-curved', 'athletic-curved', 'tall-curved', 'medium-full', 'soft-tapered', 'hourglass', 'pear', 'soft-full-hips', 'voluptuous', 'plus-size', 'balanced-full'], 2)),
    female: []
      .concat(weightedValues(['average', 'athletic', 'lean', 'slim', 'straight', 'soft', 'medium-lean', 'soft-medium'], 9))
      .concat(weightedValues(['petite', 'curvy', 'rounded', 'balanced-curved', 'medium-curved', 'petite-curved', 'short-soft', 'short-curved', 'athletic-curved', 'soft-athletic', 'tall-soft', 'tall-curved', 'medium-full', 'soft-tapered', 'plus-size'], 5))
      .concat(weightedValues(['narrow-shoulders', 'compact-lean', 'v-shape', 'muscular', 'compact-strong', 'broad', 'broad-lean', 'stocky', 'tall', 'tall-lean', 'hourglass', 'pear', 'soft-full-hips', 'voluptuous', 'balanced-full'], 2))
  };
  var PRESENTATION_HEAD_STYLE_WEIGHTS = {
    male: []
      .concat(weightedValues(['default', 'soft-square', 'oval', 'soft-oval', 'broad', 'square', 'round', 'soft-angular'], 8))
      .concat(weightedValues(['full-cheeks', 'full-oval', 'narrow', 'oblong', 'diamond', 'tapered-oval', 'soft-round-jaw', 'heart'], 3)),
    female: []
      .concat(weightedValues(['soft-oval', 'round', 'full-cheeks', 'full-oval', 'heart', 'oval', 'soft-round-jaw', 'tapered-oval'], 8))
      .concat(weightedValues(['default', 'diamond', 'soft-square', 'narrow', 'oblong', 'soft-angular', 'square', 'broad', 'feminine'], 3))
  };
  var FACE_FEATURE_WEIGHTS = []
    .concat(weightedValues(['none'], 15))
    .concat(weightedValues(['freckles', 'beauty-mark', 'dimples', 'cheek-lines'], 2));
  var CAMPUS_FACE_ACCESSORIES = [
    weightedValue([], 34),
    weightedValue(['glasses'], 14),
    weightedValue(['rectangular-glasses'], 10),
    weightedValue(['wireframe-glasses'], 9),
    weightedValue(['round-rim-glasses'], 8),
    weightedValue(['spectacles'], 4),
    weightedValue(['earrings'], 6),
    weightedValue(['hoop-earrings'], 5),
    weightedValue(['headband'], 4),
    weightedValue(['beanie'], 4),
    weightedValue(['baseball-cap'], 4),
    weightedValue(['bucket-hat'], 2),
    weightedValue(['glasses', 'earrings'], 5),
    weightedValue(['wireframe-glasses', 'hoop-earrings'], 4)
  ];
  var SHORT_HAIR_STYLES = ['short', 'textured-crop', 'straight-fringe', 'side-parted-short', 'soft-two-block', 'slick-back', 'pixie', 'fade', 'buzz', 'undercut', 'pompadour'];
  var LONG_HAIR_STYLES = ['bob', 'layered-bob', 'wavy-lob', 'shoulder-length', 'long-layers', 'long-straight', 'loose-waves', 'center-part', 'curtain-bangs', 'soft-bangs', 'side-swept', 'shag', 'long', 'wavy', 'ponytail', 'high-pony', 'sleek-low-pony', 'claw-clip-updo', 'half-up', 'low-bun', 'messy-bun'];
  var TEXTURED_HAIR_STYLES = ['curly', 'curly-bob', 'voluminous-curls', 'curly-layers', 'coils', 'twist-out', 'coily-puff', 'double-puffs', 'bantu-knots', 'afro', 'rounded-afro'];
  var BRAID_LOC_STYLES = ['locs', 'loose-locs', 'dreads-bun', 'braids', 'long-braid', 'braided-pony', 'side-braid', 'braided-bun', 'box-braids', 'cornrows'];
  var FACIAL_HAIR_STYLES = ['none', 'stubble', 'mustache', 'goatee', 'short-beard', 'trimmed-beard'];
  var POLISHED_SHORT_HAIR_STYLES = ['short', 'textured-crop', 'straight-fringe', 'side-parted-short', 'soft-two-block', 'slick-back', 'fade', 'buzz', 'undercut', 'pompadour'];
  var POLISHED_FEMININE_HAIR_STYLES = ['pixie', 'bob', 'layered-bob', 'wavy-lob', 'shoulder-length', 'long-layers', 'long-straight', 'loose-waves', 'center-part', 'curtain-bangs', 'soft-bangs', 'side-swept', 'shag', 'ponytail', 'high-pony', 'sleek-low-pony', 'claw-clip-updo', 'half-up', 'low-bun', 'messy-bun'];
  var POLISHED_TEXTURED_HAIR_STYLES = ['curly', 'curly-bob', 'voluminous-curls', 'curly-layers', 'coils', 'twist-out', 'coily-puff', 'double-puffs', 'afro', 'rounded-afro'];
  var POLISHED_BRAID_LOC_STYLES = ['locs', 'loose-locs', 'dreads-bun', 'long-braid', 'braided-pony', 'side-braid', 'braided-bun', 'box-braids', 'cornrows'];
  var MASCULINE_FACE_ACCESSORIES = [
    weightedValue([], 34),
    weightedValue(['glasses'], 13),
    weightedValue(['rectangular-glasses'], 12),
    weightedValue(['wireframe-glasses'], 8),
    weightedValue(['baseball-cap'], 6),
    weightedValue(['beanie'], 5)
  ];
  var FEMININE_FACE_ACCESSORIES = [
    weightedValue([], 24),
    weightedValue(['earrings'], 9),
    weightedValue(['hoop-earrings'], 8),
    weightedValue(['round-rim-glasses'], 8),
    weightedValue(['wireframe-glasses'], 7),
    weightedValue(['glasses'], 6),
    weightedValue(['headband'], 5),
    weightedValue(['glasses', 'earrings'], 5),
    weightedValue(['round-rim-glasses', 'hoop-earrings'], 4)
  ];
  // Random recipes keep personal traits independent while nudging style pieces into polished campus combinations.
  var MALE_STYLE_RECIPES = [
    {
      weight: 18,
      hairStyles: POLISHED_SHORT_HAIR_STYLES,
      outfitStyles: ['hoodie', 'varsity-jacket', 'denim-jacket', 'windbreaker', 'collared-shirt'],
      accessories: MASCULINE_FACE_ACCESSORIES,
      facialHairChance: 0.48,
      facialHairStyles: FACIAL_HAIR_STYLES,
      eyeShapes: ['round', 'almond', 'hooded', 'monolid'],
      noseShapes: ['soft', 'rounded', 'broad', 'narrow', 'defined-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'neutral']
    },
    {
      weight: 13,
      hairStyles: POLISHED_TEXTURED_HAIR_STYLES.concat(['locs', 'loose-locs', 'cornrows', 'dreads-bun']),
      outfitStyles: ['hoodie', 'denim-jacket', 'windbreaker', 'kurta-top', 'cardigan', 'collared-shirt'],
      accessories: [
        weightedValue([], 26),
        weightedValue(['glasses'], 8),
        weightedValue(['rectangular-glasses'], 7),
        weightedValue(['wireframe-glasses'], 5),
        weightedValue(['baseball-cap'], 3)
      ],
      facialHairChance: 0.34,
      facialHairStyles: ['none', 'stubble', 'mustache', 'goatee', 'short-beard', 'trimmed-beard'],
      eyeShapes: ['round', 'almond', 'hooded', 'smiling'],
      noseShapes: ['soft', 'rounded', 'broad', 'defined-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'neutral', 'full-lips']
    },
    {
      weight: 10,
      hairStyles: POLISHED_SHORT_HAIR_STYLES.concat(POLISHED_BRAID_LOC_STYLES),
      outfitStyles: ['kurta-top', 'collared-shirt', 'hoodie', 'denim-jacket', 'windbreaker'],
      accessories: [
        weightedValue(['turban'], 12),
        weightedValue(['turban', 'rectangular-glasses'], 5),
        weightedValue(['turban', 'wireframe-glasses'], 5)
      ],
      facialHairChance: 0.42,
      facialHairStyles: ['none', 'stubble', 'mustache', 'short-beard', 'trimmed-beard'],
      eyeShapes: ['round', 'almond', 'hooded'],
      noseShapes: ['soft', 'rounded', 'broad', 'defined-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'neutral']
    },
    {
      weight: 7,
      hairStyles: POLISHED_SHORT_HAIR_STYLES.concat(['locs', 'loose-locs', 'cornrows', 'coils', 'twist-out']),
      outfitStyles: ['lab-coat', 'collared-shirt', 'hoodie'],
      accessories: [
        weightedValue(['safety-goggles'], 10),
        weightedValue(['wireframe-glasses'], 8),
        weightedValue(['rectangular-glasses'], 7),
        weightedValue(['round-rim-glasses'], 5),
        weightedValue([], 5),
        weightedValue(['glasses'], 5)
      ],
      facialHairChance: 0.36,
      facialHairStyles: ['none', 'stubble', 'mustache', 'trimmed-beard'],
      eyeShapes: ['round', 'almond', 'monolid', 'hooded', 'wide'],
      noseShapes: ['soft', 'rounded', 'broad', 'narrow', 'defined-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'neutral']
    },
    {
      weight: 10,
      hairStyles: POLISHED_SHORT_HAIR_STYLES.concat(['locs', 'loose-locs', 'shoulder-length', 'center-part']),
      outfitStyles: ['cardigan', 'collared-shirt', 'varsity-jacket', 'kurta-top', 'denim-jacket'],
      accessories: [
        weightedValue([], 24),
        weightedValue(['round-rim-glasses'], 7),
        weightedValue(['wireframe-glasses'], 7),
        weightedValue(['rectangular-glasses'], 6),
        weightedValue(['glasses'], 5)
      ],
      facialHairChance: 0.28,
      facialHairStyles: ['none', 'stubble', 'mustache'],
      eyeShapes: ['round', 'almond', 'monolid', 'hooded', 'smiling'],
      noseShapes: ['soft', 'rounded', 'button', 'defined-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'neutral']
    }
  ];
  var FEMALE_STYLE_RECIPES = [
    {
      weight: 17,
      hairStyles: POLISHED_FEMININE_HAIR_STYLES,
      outfitStyles: ['cardigan', 'collared-shirt', 'denim-jacket', 'varsity-jacket', 'kurta-top'],
      accessories: FEMININE_FACE_ACCESSORIES,
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['round', 'almond', 'hooded', 'smiling', 'wide'],
      noseShapes: ['soft', 'rounded', 'narrow', 'button', 'defined-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'full-lips']
    },
    {
      weight: 14,
      hairStyles: POLISHED_TEXTURED_HAIR_STYLES,
      outfitStyles: ['hoodie', 'cardigan', 'windbreaker', 'denim-jacket', 'collared-shirt'],
      accessories: [
        weightedValue([], 22),
        weightedValue(['earrings'], 8),
        weightedValue(['hoop-earrings'], 7),
        weightedValue(['headband'], 6),
        weightedValue(['glasses'], 6),
        weightedValue(['wireframe-glasses'], 5),
        weightedValue(['glasses', 'hoop-earrings'], 4)
      ],
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['round', 'almond', 'smiling', 'wide'],
      noseShapes: ['soft', 'rounded', 'broad', 'button'],
      mouthStyles: ['smile', 'soft-smile', 'full-lips']
    },
    {
      weight: 13,
      hairStyles: POLISHED_BRAID_LOC_STYLES.concat(['braids']),
      outfitStyles: ['hoodie', 'denim-jacket', 'windbreaker', 'utility-vest', 'kurta-top', 'cardigan'],
      accessories: [
        weightedValue([], 22),
        weightedValue(['earrings'], 7),
        weightedValue(['hoop-earrings'], 7),
        weightedValue(['glasses'], 5),
        weightedValue(['wireframe-glasses'], 4),
        weightedValue(['baseball-cap'], 3)
      ],
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['round', 'almond', 'hooded', 'smiling'],
      noseShapes: ['soft', 'rounded', 'broad', 'defined-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'neutral', 'full-lips']
    },
    {
      weight: 10,
      hairStyles: POLISHED_FEMININE_HAIR_STYLES.concat(POLISHED_TEXTURED_HAIR_STYLES).concat(POLISHED_BRAID_LOC_STYLES),
      outfitStyles: ['kurta-top', 'cardigan', 'collared-shirt', 'windbreaker'],
      accessories: [
        weightedValue(['draped-scarf'], 8),
        weightedValue(['hijab'], 8),
        weightedValue(['draped-scarf', 'earrings'], 3)
      ],
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['round', 'almond', 'monolid', 'hooded'],
      noseShapes: ['soft', 'rounded', 'broad', 'narrow'],
      mouthStyles: ['smile', 'soft-smile', 'full-lips']
    },
    {
      weight: 7,
      hairStyles: ['pixie', 'bob', 'layered-bob', 'wavy-lob', 'soft-bangs', 'claw-clip-updo', 'ponytail', 'half-up', 'locs', 'twist-out', 'curly-layers', 'coils'],
      outfitStyles: ['lab-coat', 'collared-shirt', 'cardigan'],
      accessories: [
        weightedValue(['safety-goggles'], 9),
        weightedValue(['wireframe-glasses'], 8),
        weightedValue(['rectangular-glasses'], 7),
        weightedValue(['round-rim-glasses'], 5),
        weightedValue([], 5),
        weightedValue(['glasses'], 5)
      ],
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['round', 'almond', 'monolid', 'hooded', 'wide'],
      noseShapes: ['soft', 'rounded', 'broad', 'narrow', 'defined-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'neutral']
    },
    {
      weight: 10,
      hairStyles: POLISHED_FEMININE_HAIR_STYLES.concat(['locs', 'loose-locs']),
      outfitStyles: ['cardigan', 'collared-shirt', 'varsity-jacket', 'kurta-top', 'denim-jacket'],
      accessories: [
        weightedValue([], 20),
        weightedValue(['round-rim-glasses'], 8),
        weightedValue(['wireframe-glasses'], 8),
        weightedValue(['forehead-accent'], 3),
        weightedValue(['earrings'], 6),
        weightedValue(['hoop-earrings'], 5),
        weightedValue(['glasses'], 5)
      ],
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['round', 'almond', 'monolid', 'hooded', 'smiling'],
      noseShapes: ['soft', 'rounded', 'button', 'defined-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'full-lips', 'neutral']
    }
  ];

  function cleanAccessories(values) {
    if (!Array.isArray(values)) return [];
    var seen = {};
    var cleaned = [];
    for (var i = 0; i < values.length; i++) {
      var value = values[i];
      if (typeof value !== 'string' || value === 'none') continue;
      if (ENUMS.accessory.indexOf(value) === -1 || seen[value]) continue;
      seen[value] = true;
      cleaned.push(value);
    }
    return cleaned;
  }

  function getAccessories(outfit) {
    if (!outfit) return [];
    if (Array.isArray(outfit.accessories)) return cleanAccessories(outfit.accessories);
    return cleanAccessories([outfit.accessory || 'none']);
  }

  function firstSelected(accessories, priority) {
    for (var i = 0; i < priority.length; i++) {
      if (accessories.indexOf(priority[i]) !== -1) return priority[i];
    }
    return null;
  }

  function getCompositedAccessories(accessories) {
    var selected = cleanAccessories(accessories);
    var composited = [];
    var face = firstSelected(selected, FACE_ACCESSORY_PRIORITY);
    var head = firstSelected(selected, HEAD_ACCESSORY_PRIORITY);
    if (face) composited.push(face);
    if (head) composited.push(head);
    var ear = firstSelected(selected, EAR_ACCESSORY_PRIORITY);
    if (ear) composited.push(ear);
    for (var i = 0; i < DETAIL_ACCESSORY_PRIORITY.length; i++) {
      var detail = DETAIL_ACCESSORY_PRIORITY[i];
      if (selected.indexOf(detail) !== -1) composited.push(detail);
    }
    return composited;
  }

  function randomSkinTone() {
    return randomFrom(weightedFrom(SKIN_TONE_BANDS));
  }

  function randomFacialHair(recipe) {
    if (!recipe || !recipe.facialHairChance || Math.random() >= recipe.facialHairChance) return 'none';
    var style = randomFrom(recipe.facialHairStyles || ['stubble']);
    return style === 'none' ? 'stubble' : style;
  }

  function randomAccessories(recipe) {
    return cleanAccessories(weightedFrom((recipe && recipe.accessories) || CAMPUS_FACE_ACCESSORIES));
  }

  function normalizePresentation(value) {
    return value === 'male' || value === 'female' ? value : null;
  }

  function randomPresentation() {
    return Math.random() < 0.5 ? 'male' : 'female';
  }

  function randomRecipeForPresentation(presentation) {
    return weightedFrom(presentation === 'male' ? MALE_STYLE_RECIPES : FEMALE_STYLE_RECIPES);
  }

  function normalizeAvatar(obj) {
    if (!obj || !obj.outfit) return obj;
    var accessories = getAccessories(obj.outfit);
    obj.outfit.accessories = accessories;
    obj.outfit.accessory = accessories[0] || 'none';
    if (obj.appearance && obj.appearance.headStyle === undefined) obj.appearance.headStyle = 'default';
    if (obj.appearance && obj.appearance.eyeShape === undefined) obj.appearance.eyeShape = 'round';
    if (obj.appearance && obj.appearance.noseShape === undefined) obj.appearance.noseShape = 'soft';
    if (obj.appearance && obj.appearance.mouthStyle === undefined) obj.appearance.mouthStyle = 'smile';
    if (obj.appearance && obj.appearance.facialHair === undefined) obj.appearance.facialHair = 'none';
    if (obj.appearance && obj.appearance.faceFeature === undefined) obj.appearance.faceFeature = 'none';
    if (obj.outfit.style === undefined) obj.outfit.style = DEFAULTS.outfit.style;
    return obj;
  }

  function randomAvatar(presentation) {
    var selectedPresentation = normalizePresentation(presentation) || randomPresentation();
    var recipe = randomRecipeForPresentation(selectedPresentation);
    var accessories = randomAccessories(recipe);
    return {
      version: SCHEMA_VERSION,
      appearance: {
        presentation: selectedPresentation,
        skin: randomSkinTone(),
        hairColor: pickWeightedColor(HAIR_COLOR_WEIGHTS),
        hairStyle: randomFrom(recipe.hairStyles),
        eyeColor: pickWeightedColor(EYE_COLOR_WEIGHTS),
        eyebrowStyle: weightedFrom(weightedValues(['arched', 'straight', 'rounded'], 4).concat(weightedValues(['thick', 'thin', 'angular'], 2))),
        headStyle: weightedFrom(PRESENTATION_HEAD_STYLE_WEIGHTS[selectedPresentation] || HEAD_STYLE_WEIGHTS),
        eyeShape: randomFrom(recipe.eyeShapes),
        noseShape: randomFrom(recipe.noseShapes),
        mouthStyle: randomFrom(recipe.mouthStyles),
        facialHair: randomFacialHair(recipe),
        faceFeature: weightedFrom(FACE_FEATURE_WEIGHTS)
      },
      body: { type: weightedFrom(PRESENTATION_BODY_WEIGHTS[selectedPresentation] || BODY_TYPE_WEIGHTS) },
      outfit: {
        style: randomFrom(recipe.outfitStyles),
        suit: pickWeightedColor(SUIT_COLOR_WEIGHTS),
        capeOuter: pickWeightedColor(CAPE_COLOR_WEIGHTS),
        capeInner: pickWeightedColor(ACCENT_COLOR_WEIGHTS),
        accessory: accessories[0] || 'none',
        accessories: accessories,
        emblem: ''
      }
    };
  }

  function clampByte(n) { return Math.max(0, Math.min(255, Math.round(n))); }

  function lighten(hex, pct) {
    var c = hex.replace('#', '');
    var r = parseInt(c.substr(0, 2), 16);
    var g = parseInt(c.substr(2, 2), 16);
    var b = parseInt(c.substr(4, 2), 16);
    var lr = clampByte(r + (255 - r) * pct);
    var lg = clampByte(g + (255 - g) * pct);
    var lb = clampByte(b + (255 - b) * pct);
    return '#' + [lr, lg, lb].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  function darken(hex, pct) {
    var c = hex.replace('#', '');
    var r = parseInt(c.substr(0, 2), 16);
    var g = parseInt(c.substr(2, 2), 16);
    var b = parseInt(c.substr(4, 2), 16);
    var dr = clampByte(r * (1 - pct));
    var dg = clampByte(g * (1 - pct));
    var db = clampByte(b * (1 - pct));
    return '#' + [dr, dg, db].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  function hexToRgb(hex) {
    var c = (hex || '#000000').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    return {
      r: parseInt(c.substr(0, 2), 16) || 0,
      g: parseInt(c.substr(2, 2), 16) || 0,
      b: parseInt(c.substr(4, 2), 16) || 0
    };
  }

  function rgbToHex(rgb) {
    return '#' + [rgb.r, rgb.g, rgb.b].map(function (v) {
      return clampByte(v).toString(16).padStart(2, '0');
    }).join('');
  }

  function mix(hexA, hexB, amountB) {
    var a = hexToRgb(hexA);
    var b = hexToRgb(hexB);
    var t = Math.max(0, Math.min(1, amountB));
    return rgbToHex({
      r: a.r * (1 - t) + b.r * t,
      g: a.g * (1 - t) + b.g * t,
      b: a.b * (1 - t) + b.b * t
    });
  }

  function relativeLuminance(hex) {
    var rgb = hexToRgb(hex);
    function channel(v) {
      var s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    return channel(rgb.r) * 0.2126 + channel(rgb.g) * 0.7152 + channel(rgb.b) * 0.0722;
  }

  function contrastRatio(hexA, hexB) {
    var a = relativeLuminance(hexA);
    var b = relativeLuminance(hexB);
    var lighter = Math.max(a, b);
    var darker = Math.min(a, b);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function firstContrastColor(candidates, adjacent, minRatio) {
    var best = candidates[0];
    var bestRatio = contrastRatio(best, adjacent);
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      var ratio = contrastRatio(candidate, adjacent);
      if (ratio >= minRatio) return candidate;
      if (ratio > bestRatio) {
        best = candidate;
        bestRatio = ratio;
      }
    }
    return best;
  }

  function firstContrastColorAgainstAll(candidates, adjacents, minRatio) {
    var best = candidates[0];
    var bestScore = 0;
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      var score = Infinity;
      for (var j = 0; j < adjacents.length; j++) {
        score = Math.min(score, contrastRatio(candidate, adjacents[j]));
      }
      if (score >= minRatio) return candidate;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  function avatarContrastTokens(skin, hair) {
    var skinLum = relativeLuminance(skin);
    var hairLum = relativeLuminance(hair);
    var skinShadow = darken(skin, 0.22);
    var skinRamp = [skin, skinShadow];
    var darkSkin = skinLum < 0.24;
    var deepSkin = skinLum < 0.13;
    var darkHair = hairLum < 0.18;
    var featureTarget = darkSkin ? 3.12 : 3;
    var compactTarget = darkSkin ? 3.35 : 3;
    var warmHighlight = firstContrastColorAgainstAll(
      darkSkin
        ? [
          mix(skin, '#d4a47d', 0.62),
          '#b08a69',
          mix(skin, '#f1c27d', 0.72),
          '#d7b08b',
          '#f4d7b5'
        ]
        : [
          mix(lighten(skin, 0.28), '#f1c27d', 0.08),
          lighten(skin, 0.38),
          mix(skin, '#ffffff', 0.5)
        ],
      [skin],
      darkSkin ? 2.2 : 1.35
    );
    var hairHighlight = darkHair
      ? mix(lighten(hair, darkSkin ? 0.48 : 0.38), '#8a6748', darkSkin ? 0.22 : 0.12)
      : lighten(hair, 0.35);
    var deepFeatureCandidates = [
      '#8a6a55',
      mix(skin, '#d4a47d', 0.66),
      mix(skin, '#f1c27d', 0.72),
      '#b08a69',
      '#d7b08b',
      '#f4d7b5'
    ];
    var faceLine = firstContrastColorAgainstAll(
      darkSkin
        ? deepFeatureCandidates
        : [darken(skin, 0.46), '#7a4a2a', darken(skin, 0.62), '#3a1408'],
      skinRamp,
      featureTarget
    );
    var faceMark = firstContrastColorAgainstAll(
      darkSkin
        ? [mix(skin, '#f1c27d', 0.76), '#b08a69', '#d7b08b', '#f4d7b5']
        : ['#7a4a2a', '#3a1408', darken(skin, 0.52), darken(skin, 0.65)],
      skinRamp,
      compactTarget
    );
    var hairRim = firstContrastColorAgainstAll(
      darkHair || contrastRatio(hair, skin) < 2.4
        ? [
          mix(hair, '#b08a69', deepSkin ? 0.62 : 0.52),
          '#8a6a55',
          mix(skin, '#f1c27d', 0.7),
          '#b08a69',
          '#f1c27d',
          '#f7ead7'
        ]
        : [darken(hair, 0.45), lighten(hair, 0.42), '#241208'],
      darkSkin ? [skin, hair] : [skin],
      darkSkin ? 3 : 2.65
    );
    var glassesFrame = firstContrastColorAgainstAll(
      darkSkin
        ? ['#dce8f7', '#f1c46b', '#ffffff', '#203040', '#111827']
        : ['#203040', '#111827', '#dce8f7', '#f1c46b', '#ffffff'],
      darkSkin ? [skin, hair] : [skin],
      3
    );
    var glassesFrameDark = firstContrastColorAgainstAll(
      darkSkin
        ? ['#f8fbff', '#dce8f7', '#203040', '#0d1a24']
        : ['#0d1a24', '#203040', '#f8fbff', '#dce8f7'],
      darkSkin ? [skin, hair] : [skin],
      3
    );
    var metalFrame = firstContrastColorAgainstAll(
      darkSkin
        ? ['#f1c46b', '#fff2b8', '#b88030', '#593100']
        : ['#b88030', '#593100', '#f1c46b', '#fff2b8'],
      darkSkin ? [skin, hair] : [skin],
      3
    );
    var mouthFill = darkSkin
      ? firstContrastColorAgainstAll([mix(skin, '#b45d55', 0.72), '#9a665d', '#b56a62', '#c8796d'], skinRamp, 2.45)
      : '#5a2418';
    var mouthLine = darkSkin
      ? firstContrastColorAgainstAll(['#f1c27d', '#e0a080', '#fff2b8', '#3a1408'], skinRamp, compactTarget)
      : '#3a1408';
    var lipFill = darkSkin
      ? firstContrastColorAgainstAll([mix(skin, '#c86b62', 0.74), '#b56a62', '#c8796d', '#d89084'], skinRamp, 2.35)
      : '#b44a4a';
    var lipShadow = darkSkin ? mix(lipFill, skinShadow, 0.34) : '#8f3232';
    var lipHighlight = darkSkin
      ? firstContrastColorAgainstAll(['#f1b69a', '#ffd0bc', warmHighlight], [lipFill], 1.65)
      : '#ffb0a0';
    var eyebrow = contrastRatio(hair, skin) < 3
      ? firstContrastColorAgainstAll([hairRim, faceLine, lighten(hair, 0.58), mix(hair, '#f1c27d', 0.38), darken(hair, 0.5)], skinRamp, featureTarget)
      : hair;

    return {
      skinHighlight: warmHighlight,
      faceLine: faceLine,
      faceShadow: darkSkin ? mix(skinShadow, faceLine, 0.38) : darken(skin, 0.35),
      faceMark: faceMark,
      noseFill: darkSkin ? faceLine : faceLine,
      noseHighlight: darkSkin ? warmHighlight : '#fff1dc',
      cheek: darkSkin ? mix(skin, '#d98978', 0.58) : '#e87b6a',
      mouthFill: mouthFill,
      mouthLine: mouthLine,
      lipFill: lipFill,
      lipShadow: lipShadow,
      lipHighlight: lipHighlight,
      eyebrow: eyebrow,
      hairHighlight: hairHighlight,
      hairRim: hairRim,
      hairShadow: hairLum < 0.28 ? 'rgba(0, 0, 0, 0.42)' : 'rgba(53, 31, 15, 0.24)',
      featureRim: darkSkin ? 'rgba(255, 226, 185, 0.72)' : 'rgba(44, 21, 8, 0.22)',
      featureShadow: darkSkin ? 'rgba(0, 0, 0, 0.44)' : 'rgba(0, 47, 82, 0.18)',
      noseOpacity: darkSkin ? '0.92' : '0.35',
      nostrilOpacity: darkSkin ? '0.96' : '0.3',
      cheekOpacity: darkSkin ? '0.56' : '0.35',
      contourOpacity: darkSkin ? '0.58' : '0.18',
      subtleLineOpacity: darkSkin ? '0.66' : '0.24',
      hairDetailOpacity: darkSkin && darkHair ? '0.74' : '0.5',
      glassesFrame: glassesFrame,
      glassesFrameDark: glassesFrameDark,
      glassesMetal: metalFrame,
      lensFill: darkSkin ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.12)'
    };
  }

  function setSlot(svg, slotName, option) {
    var groups = svg.querySelectorAll('[data-hero-slot="' + slotName + '"]');
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var opt = g.getAttribute('data-hero-option');
      g.setAttribute('display', opt === option ? 'inline' : 'none');
    }
  }

  function setMultiSlot(svg, slotName, options) {
    var selected = {};
    for (var i = 0; i < options.length; i++) selected[options[i]] = true;
    var groups = svg.querySelectorAll('[data-hero-slot="' + slotName + '"]');
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      var opt = group.getAttribute('data-hero-option');
      var show = opt === 'none' ? options.length === 0 : !!selected[opt];
      group.setAttribute('display', show ? 'inline' : 'none');
    }
  }

  function applyToSvg(svg, state) {
    var contrastTokens = avatarContrastTokens(state.appearance.skin, state.appearance.hairColor);
    svg.style.setProperty('--hero-skin-light', state.appearance.skin);
    svg.style.setProperty('--hero-skin', darken(state.appearance.skin, 0.22));
    svg.style.setProperty('--hero-skin-highlight', contrastTokens.skinHighlight);
    svg.style.setProperty('--hero-face-line', contrastTokens.faceLine);
    svg.style.setProperty('--hero-face-shadow', contrastTokens.faceShadow);
    svg.style.setProperty('--hero-face-mark', contrastTokens.faceMark);
    svg.style.setProperty('--hero-nose-fill', contrastTokens.noseFill);
    svg.style.setProperty('--hero-nose-highlight', contrastTokens.noseHighlight);
    svg.style.setProperty('--hero-cheek', contrastTokens.cheek);
    svg.style.setProperty('--hero-cheek-opacity', contrastTokens.cheekOpacity);
    svg.style.setProperty('--hero-mouth-fill', contrastTokens.mouthFill);
    svg.style.setProperty('--hero-mouth-line', contrastTokens.mouthLine);
    svg.style.setProperty('--hero-lip-fill', contrastTokens.lipFill);
    svg.style.setProperty('--hero-lip-shadow', contrastTokens.lipShadow);
    svg.style.setProperty('--hero-lip-highlight', contrastTokens.lipHighlight);
    svg.style.setProperty('--hero-hair', state.appearance.hairColor);
    svg.style.setProperty('--hero-hair-light', contrastTokens.hairHighlight);
    svg.style.setProperty('--hero-hair-dark', darken(state.appearance.hairColor, 0.35));
    svg.style.setProperty('--hero-hair-rim', contrastTokens.hairRim);
    svg.style.setProperty('--hero-hair-shadow', contrastTokens.hairShadow);
    svg.style.setProperty('--hero-hair-detail-opacity', contrastTokens.hairDetailOpacity);
    svg.style.setProperty('--hero-eye', state.appearance.eyeColor);
    svg.style.setProperty('--hero-eyebrow', contrastTokens.eyebrow);
    svg.style.setProperty('--hero-feature-rim', contrastTokens.featureRim);
    svg.style.setProperty('--hero-feature-shadow', contrastTokens.featureShadow);
    svg.style.setProperty('--hero-nose-opacity', contrastTokens.noseOpacity);
    svg.style.setProperty('--hero-nostril-opacity', contrastTokens.nostrilOpacity);
    svg.style.setProperty('--hero-contour-opacity', contrastTokens.contourOpacity);
    svg.style.setProperty('--hero-subtle-line-opacity', contrastTokens.subtleLineOpacity);
    svg.style.setProperty('--hero-glasses-frame', contrastTokens.glassesFrame);
    svg.style.setProperty('--hero-glasses-frame-dark', contrastTokens.glassesFrameDark);
    svg.style.setProperty('--hero-glasses-metal', contrastTokens.glassesMetal);
    svg.style.setProperty('--hero-lens-fill', contrastTokens.lensFill);
    svg.style.setProperty('--hero-suit-light', lighten(state.outfit.suit, 0.35));
    svg.style.setProperty('--hero-suit', state.outfit.suit);
    svg.style.setProperty('--hero-suit-dark', darken(state.outfit.suit, 0.4));
    svg.style.setProperty('--hero-cape-light', lighten(state.outfit.capeOuter, 0.3));
    svg.style.setProperty('--hero-cape', state.outfit.capeOuter);
    svg.style.setProperty('--hero-cape-dark', darken(state.outfit.capeOuter, 0.55));
    svg.style.setProperty('--hero-cape-inner-light', lighten(state.outfit.capeInner, 0.4));
    svg.style.setProperty('--hero-cape-inner', state.outfit.capeInner);

    svg.setAttribute('data-hero-body', state.body.type);

    var accessories = getAccessories(state.outfit);
    var compositedAccessories = getCompositedAccessories(accessories);
    var hidesHair = compositedAccessories.some(function (accessory) { return !!HAIR_COVERING_ACCESSORIES[accessory]; });
    var renderedHairStyle = hidesHair ? 'bald' : state.appearance.hairStyle;
    setSlot(svg, 'hair', renderedHairStyle);
    setSlot(svg, 'eyebrow', state.appearance.eyebrowStyle);
    setSlot(svg, 'eye-shape', state.appearance.eyeShape || 'round');
    var headStyle = state.appearance.headStyle || 'default';
    setSlot(svg, 'head-shape', headStyle);
    setSlot(svg, 'face-clear', headStyle);
    setSlot(svg, 'head-features', headStyle);
    setSlot(svg, 'hairline', hidesHair ? 'none' : renderedHairStyle);
    setSlot(svg, 'nose-shape', state.appearance.noseShape || 'soft');
    setSlot(svg, 'face-feature', state.appearance.faceFeature || 'none');
    setSlot(svg, 'facial-hair', state.appearance.facialHair || 'none');
    setSlot(svg, 'mouth-style', state.appearance.mouthStyle || 'smile');
    setSlot(svg, 'hair-root', hidesHair ? 'none' : renderedHairStyle);
    setSlot(svg, 'outfit-style', state.outfit.style || DEFAULTS.outfit.style);
    setMultiSlot(svg, 'accessory', compositedAccessories);

    // Silhouette overlays — show only those mapped to this body type
    var features = BODY_SILHOUETTES[state.body.type] || [];
    for (var f = 0; f < ALL_SILHOUETTE_FEATURES.length; f++) {
      var feat = ALL_SILHOUETTE_FEATURES[f];
      var groups = svg.querySelectorAll('[data-hero-slot="silhouette"][data-hero-feature="' + feat + '"]');
      var show = features.indexOf(feat) !== -1;
      for (var i = 0; i < groups.length; i++) {
        groups[i].setAttribute('display', show ? 'inline' : 'none');
      }
    }

    // Body-shape geometry swap — replaces the default torso when a distinctive silhouette is needed.
    var bodyShape = BODY_SHAPES[state.body.type];
    var bodyShapeGroups = svg.querySelectorAll('[data-hero-slot="body-shape"]');
    for (var bi = 0; bi < bodyShapeGroups.length; bi++) {
      var bg = bodyShapeGroups[bi];
      bg.setAttribute('display', bg.getAttribute('data-hero-option') === bodyShape ? 'inline' : 'none');
    }
    var defaultTorso = svg.querySelector('[data-hero-default-torso]');
    if (defaultTorso) {
      defaultTorso.style.display = bodyShape ? 'none' : '';
    }

    var emblemGroup = svg.querySelector('[data-hero-slot="emblem"]');
    var emblemText = svg.querySelector('[data-hero-emblem-text]');
    var defaultBuckle = svg.querySelector('[data-hero-buckle-default]');
    var hasEmblem = !!(state.outfit.emblem || '');
    if (emblemGroup && emblemText) {
      emblemText.textContent = state.outfit.emblem || '';
      emblemGroup.setAttribute('display', hasEmblem ? 'inline' : 'none');
    }
    if (defaultBuckle) {
      defaultBuckle.style.display = hasEmblem ? 'none' : '';
    }
    svg.setAttribute('data-hero-avatar-ready', 'true');
  }

  function applyAvatarToScope(state, scope) {
    var svgs = scope.querySelectorAll('[data-gym-hero-svg]');
    for (var i = 0; i < svgs.length; i++) applyToSvg(svgs[i], state);
  }

  function applyRandomAvatarsToScope(scope) {
    var svgs = scope.querySelectorAll('[data-gym-hero-svg]');
    for (var i = 0; i < svgs.length; i++) applyToSvg(svgs[i], randomAvatar());
  }

  var HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
  function isHex(v) { return typeof v === 'string' && HEX_COLOR.test(v); }
  function inEnum(v, key) { return typeof v === 'string' && ENUMS[key].indexOf(v) !== -1; }

  function countGraphemes(s) {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      var seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
      var count = 0;
      var it = seg.segment(s)[Symbol.iterator]();
      while (!it.next().done) count++;
      return count;
    }
    return Array.from(s).length;
  }

  function isValidEmblem(v) {
    if (typeof v !== 'string') return false;
    if (v === '') return true;
    // Accept any single grapheme cluster — covers Extended_Pictographic emoji,
    // flag emojis (Regional_Indicator pairs), ZWJ sequences, skin-tone modifiers,
    // and keycap sequences which Intl.Segmenter correctly groups as one grapheme.
    if (countGraphemes(v) !== 1) return false;
    try {
      // Reject plain ASCII letters/digits — must contain an emoji-class codepoint
      return /\p{Extended_Pictographic}|\p{Regional_Indicator}|[⃣️]/u.test(v);
    } catch (e) {
      // Fallback for older browsers: accept if string is non-trivial in length (most emojis are 2-8 code units)
      return v.length >= 1 && v.length <= 8;
    }
  }

  function validateAvatar(obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'Invalid JSON object.' };
    if (obj.version !== SCHEMA_VERSION) return { ok: false, error: 'Unsupported version (expected ' + SCHEMA_VERSION + ').' };
    var a = obj.appearance, b = obj.body, o = obj.outfit;
    if (!a || typeof a !== 'object') return { ok: false, error: 'Missing appearance section.' };
    if (!b || typeof b !== 'object') return { ok: false, error: 'Missing body section.' };
    if (!o || typeof o !== 'object') return { ok: false, error: 'Missing outfit section.' };
    if (!isHex(a.skin)) return { ok: false, error: 'Invalid skin color (expected #rrggbb).' };
    if (!isHex(a.hairColor)) return { ok: false, error: 'Invalid hair color.' };
    if (!isHex(a.eyeColor)) return { ok: false, error: 'Invalid eye color.' };
    if (a.presentation !== undefined && !inEnum(a.presentation, 'presentation')) return { ok: false, error: 'Invalid presentation.' };
    if (!inEnum(a.hairStyle, 'hairStyle')) return { ok: false, error: 'Invalid hair style.' };
    if (!inEnum(a.eyebrowStyle, 'eyebrowStyle')) return { ok: false, error: 'Invalid eyebrow style.' };
    if (a.headStyle !== undefined && !inEnum(a.headStyle, 'headStyle')) return { ok: false, error: 'Invalid head style.' };
    if (a.eyeShape !== undefined && !inEnum(a.eyeShape, 'eyeShape')) return { ok: false, error: 'Invalid eye shape.' };
    if (a.noseShape !== undefined && !inEnum(a.noseShape, 'noseShape')) return { ok: false, error: 'Invalid nose shape.' };
    if (a.mouthStyle !== undefined && !inEnum(a.mouthStyle, 'mouthStyle')) return { ok: false, error: 'Invalid mouth style.' };
    if (a.facialHair !== undefined && !inEnum(a.facialHair, 'facialHair')) return { ok: false, error: 'Invalid facial hair style.' };
    if (a.faceFeature !== undefined && !inEnum(a.faceFeature, 'faceFeature')) return { ok: false, error: 'Invalid facial feature.' };
    if (!inEnum(b.type, 'bodyType')) return { ok: false, error: 'Invalid body type.' };
    if (o.style !== undefined && !inEnum(o.style, 'outfitStyle')) return { ok: false, error: 'Invalid outfit style.' };
    if (!isHex(o.suit)) return { ok: false, error: 'Invalid suit color.' };
    if (!isHex(o.capeOuter)) return { ok: false, error: 'Invalid cape outer color.' };
    if (!isHex(o.capeInner)) return { ok: false, error: 'Invalid cape inner color.' };
    if (o.accessory !== undefined && !inEnum(o.accessory, 'accessory')) return { ok: false, error: 'Invalid accessory.' };
    if (o.accessories !== undefined) {
      if (!Array.isArray(o.accessories)) return { ok: false, error: 'Accessories must be a list.' };
      for (var ai = 0; ai < o.accessories.length; ai++) {
        if (!inEnum(o.accessories[ai], 'accessory')) return { ok: false, error: 'Invalid accessory.' };
      }
    }
    if (!isValidEmblem(o.emblem)) return { ok: false, error: 'Emblem must be empty or a single emoji.' };
    return { ok: true };
  }

  function loadAvatar() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!validateAvatar(parsed).ok) return null;
      return normalizeAvatar(parsed);
    } catch (e) {
      return null;
    }
  }

  function saveAvatar(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clearAvatar() {
    localStorage.removeItem(STORAGE_KEY);
  }

  window.HeroAvatar = {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    ENUMS: ENUMS,
    DEFAULTS: DEFAULTS,
    randomPresentation: randomPresentation,
    randomAvatar: randomAvatar,
    validateAvatar: validateAvatar,
    loadAvatar: loadAvatar,
    saveAvatar: saveAvatar,
    clearAvatar: clearAvatar,
    normalizeAvatar: normalizeAvatar,
    getCompositedAccessories: getCompositedAccessories,
    applyRandomAvatarsToScope: applyRandomAvatarsToScope,
    applyAvatarToScope: applyAvatarToScope,
    applyToSvg: applyToSvg,
    isValidEmblem: isValidEmblem
  };

  function initAvatar() {
    var saved = loadAvatar();
    if (saved) {
      applyAvatarToScope(saved, document);
    } else {
      applyRandomAvatarsToScope(document);
    }
  }

  function initModal() {
    var modal = document.getElementById('hero-customizer-modal');
    var openBtn = document.getElementById('customize-hero-btn');
    if (!modal || !openBtn) return;

    var previousFocus = null;

    function $(id) { return modal.querySelector('#' + id); }

    function readAccessoriesForm() {
      var selected = [];
      var checkboxes = modal.querySelectorAll('input[name="hero-cust-accessory"]:checked');
      for (var i = 0; i < checkboxes.length; i++) selected.push(checkboxes[i].value);
      return cleanAccessories(selected);
    }

    function writeAccessoriesForm(state) {
      var selected = {};
      var accessories = getAccessories(state.outfit);
      for (var i = 0; i < accessories.length; i++) selected[accessories[i]] = true;
      var checkboxes = modal.querySelectorAll('input[name="hero-cust-accessory"]');
      for (var c = 0; c < checkboxes.length; c++) {
        checkboxes[c].checked = !!selected[checkboxes[c].value];
      }
    }

    function readForm() {
      var bodyChoice = $('hero-cust-body-type');
      var accessories = readAccessoriesForm();
      return {
        version: SCHEMA_VERSION,
        appearance: {
          skin: $('hero-cust-skin').value,
          hairColor: $('hero-cust-hair-color').value,
          hairStyle: $('hero-cust-hair-style').value,
          eyeColor: $('hero-cust-eye-color').value,
          eyebrowStyle: $('hero-cust-eyebrow').value,
          headStyle: ($('hero-cust-head-style') ? $('hero-cust-head-style').value : 'default'),
          eyeShape: ($('hero-cust-eye-shape') ? $('hero-cust-eye-shape').value : 'round'),
          noseShape: ($('hero-cust-nose-shape') ? $('hero-cust-nose-shape').value : 'soft'),
          mouthStyle: ($('hero-cust-mouth-style') ? $('hero-cust-mouth-style').value : 'smile'),
          facialHair: ($('hero-cust-facial-hair') ? $('hero-cust-facial-hair').value : 'none'),
          faceFeature: ($('hero-cust-face-feature') ? $('hero-cust-face-feature').value : 'none')
        },
        body: { type: bodyChoice ? bodyChoice.value : 'athletic' },
        outfit: {
          style: $('hero-cust-outfit-style').value,
          suit: $('hero-cust-suit').value,
          capeOuter: $('hero-cust-cape-outer').value,
          capeInner: $('hero-cust-cape-inner').value,
          accessory: accessories[0] || 'none',
          accessories: accessories,
          emblem: $('hero-cust-emblem').value
        }
      };
    }

    function writeForm(state) {
      $('hero-cust-skin').value = state.appearance.skin;
      $('hero-cust-hair-color').value = state.appearance.hairColor;
      $('hero-cust-hair-style').value = state.appearance.hairStyle;
      $('hero-cust-eye-color').value = state.appearance.eyeColor;
      $('hero-cust-eyebrow').value = state.appearance.eyebrowStyle;
      if ($('hero-cust-head-style')) $('hero-cust-head-style').value = state.appearance.headStyle || 'default';
      if ($('hero-cust-eye-shape')) $('hero-cust-eye-shape').value = state.appearance.eyeShape || 'round';
      if ($('hero-cust-nose-shape')) $('hero-cust-nose-shape').value = state.appearance.noseShape || 'soft';
      if ($('hero-cust-mouth-style')) $('hero-cust-mouth-style').value = state.appearance.mouthStyle || 'smile';
      if ($('hero-cust-facial-hair')) $('hero-cust-facial-hair').value = state.appearance.facialHair || 'none';
      if ($('hero-cust-face-feature')) $('hero-cust-face-feature').value = state.appearance.faceFeature || 'none';
      var bodySelect = $('hero-cust-body-type');
      if (bodySelect && inEnum(state.body.type, 'bodyType')) bodySelect.value = state.body.type;
      $('hero-cust-outfit-style').value = state.outfit.style || DEFAULTS.outfit.style;
      $('hero-cust-suit').value = state.outfit.suit;
      $('hero-cust-cape-outer').value = state.outfit.capeOuter;
      $('hero-cust-cape-inner').value = state.outfit.capeInner;
      writeAccessoriesForm(state);
      $('hero-cust-emblem').value = state.outfit.emblem;
    }

    function refreshPreview() {
      var s = readForm();
      var preview = modal.querySelector('[data-gym-hero-svg]');
      if (preview) applyToSvg(preview, s);
    }

    function setStatus(msg, isError) {
      var status = $('hero-cust-status');
      if (!status) return;
      status.textContent = msg;
      status.classList.toggle('hero-cust-status-error', !!isError);
    }

    function openModal() {
      previousFocus = document.activeElement;
      var initial = loadAvatar() || randomAvatar();
      writeForm(initial);
      refreshPreview();
      setStatus('');
      modal.hidden = false;
      document.body.classList.add('hero-cust-modal-open');
      modal.classList.add('hero-cust-open');
      var first = $('hero-cust-skin');
      if (first) first.focus();
    }

    function closeModal() {
      modal.hidden = true;
      document.body.classList.remove('hero-cust-modal-open');
      modal.classList.remove('hero-cust-open');
      if (previousFocus && document.contains(previousFocus) && typeof previousFocus.focus === 'function') previousFocus.focus();
    }

    function onKeydown(e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== 'Tab') return;
      var focusables = modal.querySelectorAll('input:not([type="file"]), select, button, [tabindex]:not([tabindex="-1"])');
      var visible = [];
      for (var i = 0; i < focusables.length; i++) {
        var el = focusables[i];
        if (!el.disabled && el.offsetParent !== null && !el.hidden) visible.push(el);
      }
      if (visible.length === 0) return;
      var first = visible[0], last = visible[visible.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function saveAndClose() {
      var state = readForm();
      var v = validateAvatar(state);
      if (!v.ok) { setStatus(v.error, true); return; }
      saveAvatar(state);
      applyAvatarToScope(state, document);
      closeModal();
    }

    function doRandomize() {
      var r = randomAvatar();
      writeForm(r);
      refreshPreview();
      setStatus('Randomized — press Save to keep it.');
    }

    function doReset() {
      writeForm(DEFAULTS);
      refreshPreview();
      setStatus('Reset to defaults — press Save to keep it.');
    }

    function doUseRandomHeroes() {
      clearAvatar();
      applyRandomAvatarsToScope(document);
      writeForm(randomAvatar());
      refreshPreview();
      setStatus('Saved hero removed. Page heroes now randomize separately on each load.');
    }

    function doDownload() {
      var state = readForm();
      var v = validateAvatar(state);
      if (!v.ok) { setStatus(v.error, true); return; }
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'se-gym-hero-avatar.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      setStatus('Downloaded hero avatar JSON.');
    }

    function doUpload(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var parsed = JSON.parse(String(e.target.result));
          var v = validateAvatar(parsed);
          if (!v.ok) { setStatus(v.error, true); return; }
          normalizeAvatar(parsed);
          writeForm(parsed);
          refreshPreview();
          setStatus('Avatar loaded into preview — press Save to keep it.');
        } catch (err) {
          setStatus('Could not parse JSON file.', true);
        }
      };
      reader.onerror = function () { setStatus('Could not read file.', true); };
      reader.readAsText(file);
    }

    openBtn.addEventListener('click', openModal);

    modal.querySelectorAll('input[type="color"], select').forEach(function (el) {
      el.addEventListener('input', refreshPreview);
      el.addEventListener('change', refreshPreview);
    });

    var bodySelect = $('hero-cust-body-type');
    if (bodySelect) {
      bodySelect.addEventListener('input', refreshPreview);
      bodySelect.addEventListener('change', refreshPreview);
    }

    modal.querySelectorAll('input[name="hero-cust-accessory"]').forEach(function (el) {
      el.addEventListener('change', refreshPreview);
    });

    var emblemInput = $('hero-cust-emblem');
    emblemInput.addEventListener('input', function () {
      var v = emblemInput.value;
      if (!isValidEmblem(v)) {
        setStatus('Emblem must be a single emoji.', true);
        return;
      }
      setStatus('');
      refreshPreview();
    });

    modal.querySelectorAll('[data-emblem-quickpick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        emblemInput.value = btn.getAttribute('data-emblem-quickpick');
        setStatus('');
        refreshPreview();
      });
    });

    var clearBtn = $('hero-cust-emblem-clear');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      emblemInput.value = '';
      setStatus('');
      refreshPreview();
    });

    $('hero-cust-cancel').addEventListener('click', closeModal);
    $('hero-cust-close').addEventListener('click', closeModal);
    $('hero-cust-save').addEventListener('click', saveAndClose);
    $('hero-cust-randomize').addEventListener('click', doRandomize);
    $('hero-cust-reset').addEventListener('click', doReset);
    $('hero-cust-use-random').addEventListener('click', doUseRandomHeroes);
    $('hero-cust-download').addEventListener('click', doDownload);

    var uploadBtn = $('hero-cust-upload');
    var uploadInput = $('hero-cust-upload-input');
    uploadBtn.addEventListener('click', function () { uploadInput.click(); });
    uploadInput.addEventListener('change', function (e) {
      doUpload(e.target.files && e.target.files[0]);
      uploadInput.value = '';
    });

    document.addEventListener('keydown', onKeydown);

    var backdrop = modal.querySelector('.hero-cust-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeModal);
  }

  function updateCustomizeButtonVisibility() {
    var btn = document.getElementById('customize-hero-btn');
    if (!btn) return;
    var active = !!(window.PersonalGym && typeof window.PersonalGym.isPersonalGymActive === 'function' && window.PersonalGym.isPersonalGymActive());
    btn.hidden = !active;
  }

  function initButtonVisibility() {
    updateCustomizeButtonVisibility();
    var toggle = document.getElementById('activatePersonalGymToggle');
    if (toggle) toggle.addEventListener('change', updateCustomizeButtonVisibility);
  }

  function start() {
    initAvatar();
    initModal();
    initButtonVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
