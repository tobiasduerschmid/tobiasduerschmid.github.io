(function () {
  'use strict';

  var STORAGE_KEY = 'se-gym-hero-avatar';
  var SCHEMA_VERSION = 1;

  function choice(value, label) {
    return { value: value, label: label };
  }

  function choiceGroup(label, options) {
    return { label: label, options: options };
  }

  var HERO_CHOICE_SETS = {
    heroKind: {
      id: 'hero-cust-kind',
      label: 'Hero type',
      path: ['kind'],
      preview: 'full',
      groups: [
        choiceGroup('Hero type', [
          choice('human', 'Human hero'),
          choice('bruin', 'Bruin mascot')
        ])
      ]
    },
    presentation: {
      groups: [
        choiceGroup('Presentation', [
          choice('male', 'Masculine'),
          choice('female', 'Feminine')
        ])
      ]
    },
    hairStyle: {
      id: 'hero-cust-hair-style',
      label: 'Hair style',
      path: ['appearance', 'hairStyle'],
      preview: 'hair',
      groups: [
        choiceGroup('Short styles', [
          choice('short', 'Short crop'),
          choice('textured-crop', 'Textured crop'),
          choice('wispy-crop', 'Wispy short crop'),
          choice('casual-messy-crop', 'Casual messy crop'),
          choice('textured-fringe', 'Textured fringe'),
          choice('straight-fringe', 'Straight fringe'),
          choice('side-parted-short', 'Side-parted short cut'),
          choice('thick-side-swept', 'Thick side-swept cut'),
          choice('ivy-league', 'Ivy League cut'),
          choice('soft-two-block', 'Soft two-block cut'),
          choice('middle-part-flow', 'Middle-part flow'),
          choice('slick-back', 'Slicked-back short cut'),
          choice('neat-straight-fringe', 'Neat straight fringe'),
          choice('pixie', 'Pixie cut'),
          choice('fade', 'Fade'),
          choice('crew-cut', 'Crew cut'),
          choice('buzz', 'Buzz cut'),
          choice('undercut', 'Undercut'),
          choice('mohawk', 'Mohawk'),
          choice('pompadour', 'Pompadour'),
          choice('bowl-cut', 'Bowl cut')
        ]),
        choiceGroup('Medium and long styles', [
          choice('bob', 'Bob'),
          choice('layered-bob', 'Layered bob'),
          choice('wavy-lob', 'Wavy lob'),
          choice('side-part-lob', 'Side-part lob'),
          choice('shoulder-length', 'Shoulder length'),
          choice('flipped-lob', 'Flipped lob'),
          choice('wolf-cut', 'Wolf cut layers'),
          choice('long-layers', 'Long layers'),
          choice('straight-long-layers', 'Straight long layers'),
          choice('long-center-part', 'Long center part'),
          choice('butterfly-layers', 'Butterfly layers'),
          choice('long-straight', 'Long straight hair'),
          choice('loose-waves', 'Loose waves'),
          choice('center-part', 'Center part'),
          choice('sleek-bob-bangs', 'Sleek bob with bangs'),
          choice('curtain-bangs', 'Curtain bangs'),
          choice('soft-bangs', 'Soft bangs'),
          choice('low-pony-bangs', 'Low ponytail with bangs'),
          choice('side-swept', 'Side-swept'),
          choice('shag', 'Layered shag'),
          choice('long', 'Long and flowing'),
          choice('wavy', 'Wavy and long')
        ]),
        choiceGroup('Curls, coils, and natural texture', [
          choice('curly', 'Curly'),
          choice('curly-bob', 'Curly bob'),
          choice('voluminous-curls', 'Voluminous curls'),
          choice('curly-layers', 'Curly layers'),
          choice('coils', 'Coils'),
          choice('two-strand-twists', 'Two-strand twists'),
          choice('twist-out', 'Twist-out'),
          choice('coily-puff', 'Coily puff'),
          choice('double-puffs', 'Double puffs'),
          choice('bantu-knots', 'Bantu knots'),
          choice('afro', 'Afro'),
          choice('rounded-afro', 'Rounded Afro')
        ]),
        choiceGroup('Braids, locs, and tied styles', [
          choice('locs', 'Long locs'),
          choice('loose-locs', 'Loose locs'),
          choice('locs-bun', 'Locs bun'),
          choice('braids', 'Thick braids'),
          choice('long-braid', 'Long braid'),
          choice('french-braid', 'French braid'),
          choice('braided-pony', 'Braided ponytail'),
          choice('side-braid', 'Side braid'),
          choice('braided-bun', 'Braided bun'),
          choice('box-braids', 'Box braids'),
          choice('knotless-braids', 'Knotless braids'),
          choice('cornrows', 'Cornrows'),
          choice('bun', 'High bun'),
          choice('space-buns', 'Space buns'),
          choice('low-bun', 'Low bun'),
          choice('messy-bun', 'Messy bun'),
          choice('ponytail', 'Ponytail'),
          choice('high-pony', 'High ponytail'),
          choice('sleek-low-pony', 'Sleek low ponytail'),
          choice('claw-clip-updo', 'Claw-clip updo'),
          choice('half-up', 'Half-up'),
          choice('pigtails', 'Pigtails'),
          choice('top-knot', 'Top knot')
        ]),
        choiceGroup('No visible hair', [
          choice('bald', 'Bald')
        ])
      ]
    },
    eyebrowStyle: {
      id: 'hero-cust-eyebrow',
      label: 'Eyebrows',
      path: ['appearance', 'eyebrowStyle'],
      preview: 'eyebrows',
      groups: [
        choiceGroup('Eyebrows', [
          choice('arched', 'Arched'),
          choice('straight', 'Straight'),
          choice('light-straight', 'Light straight brow'),
          choice('full-straight', 'Full straight brow'),
          choice('thick', 'Thick'),
          choice('thin', 'Thin'),
          choice('rounded', 'Rounded'),
          choice('angular', 'Angular')
        ])
      ]
    },
    eyeShape: {
      id: 'hero-cust-eye-shape',
      label: 'Eye shape',
      path: ['appearance', 'eyeShape'],
      preview: 'eyes',
      groups: [
        choiceGroup('Eye shape', [
          choice('round', 'Round'),
          choice('almond', 'Almond'),
          choice('soft-almond', 'Soft almond'),
          choice('single-eyelid', 'Single eyelid'),
          choice('soft-single-eyelid', 'Soft single eyelid'),
          choice('hooded', 'Hooded'),
          choice('smiling', 'Smiling eyes'),
          choice('wide', 'Wide-set bright'),
          choice('clear-round', 'Bright round eyes')
        ])
      ]
    },
    noseShape: {
      id: 'hero-cust-nose-shape',
      label: 'Nose shape',
      path: ['appearance', 'noseShape'],
      preview: 'nose',
      groups: [
        choiceGroup('Nose shape', [
          choice('soft', 'Soft bridge'),
          choice('rounded', 'Rounded'),
          choice('broad', 'Broad'),
          choice('narrow', 'Narrow'),
          choice('straight-narrow', 'Straight narrow bridge'),
          choice('prominent-straight', 'Prominent straight bridge'),
          choice('button', 'Button'),
          choice('defined-bridge', 'Defined bridge'),
          choice('long-soft-bridge', 'Long soft bridge'),
          choice('soft-rounded-bridge', 'Soft rounded bridge'),
          choice('rounded-tip', 'Soft rounded tip'),
          choice('slim-rounded-tip', 'Slim rounded tip'),
          choice('soft-upturned', 'Gentle upturned'),
          choice('gentle-bridge', 'Gentle bridge'),
          choice('soft-low-bridge', 'Soft low bridge')
        ])
      ]
    },
    mouthStyle: {
      id: 'hero-cust-mouth-style',
      label: 'Mouth',
      path: ['appearance', 'mouthStyle'],
      preview: 'mouth',
      groups: [
        choiceGroup('Mouth', [
          choice('smile', 'Smile'),
          choice('soft-smile', 'Soft smile'),
          choice('grin', 'Grin'),
          choice('closed-smile', 'Closed smile'),
          choice('neutral', 'Neutral'),
          choice('full-lips', 'Full lips'),
          choice('bright-smile', 'Bright smile'),
          choice('toothy-smile', 'Toothy smile'),
          choice('cheerful-grin', 'Cheerful grin'),
          choice('open-smile', 'Open smile'),
          choice('excited-smile', 'Excited smile')
        ])
      ]
    },
    blushStyle: {
      id: 'hero-cust-blush-style',
      label: 'Cheek tint',
      path: ['appearance', 'blushStyle'],
      preview: 'cheeks',
      groups: [
        choiceGroup('Cheek tint', [
          choice('natural', 'Natural'),
          choice('subtle', 'Subtle'),
          choice('none', 'None')
        ])
      ]
    },
    headStyle: {
      id: 'hero-cust-head-style',
      label: 'Head shape',
      path: ['appearance', 'headStyle'],
      preview: 'head-shape',
      groups: [
        choiceGroup('Natural face shapes', [
          choice('default', 'Balanced oval'),
          choice('soft-oval', 'Soft oval'),
          choice('round', 'Round face'),
          choice('full-cheeks', 'Full cheeks'),
          choice('full-oval', 'Full oval'),
          choice('narrow', 'Narrow face'),
          choice('tapered-oval', 'Tapered oval'),
          choice('gentle-taper', 'Gentle tapered face'),
          choice('oblong', 'Oblong face')
        ]),
        choiceGroup('Jaw and cheekbone shapes', [
          choice('heart', 'Tapered chin'),
          choice('diamond', 'Defined cheekbones'),
          choice('square', 'Square jaw'),
          choice('soft-square', 'Soft square jaw'),
          choice('slim-square-jaw', 'Slim square jaw'),
          choice('long-tapered-jaw', 'Long tapered jaw'),
          choice('narrow-angular-jaw', 'Narrow angular jaw'),
          choice('soft-v-jaw', 'Soft V-shaped jaw'),
          choice('full-straight-jaw', 'Full straight jaw'),
          choice('soft-round-jaw', 'Soft round jaw'),
          choice('soft-angular', 'Soft angular face'),
          choice('broad', 'Broad face')
        ]),
        choiceGroup('Additional shapes', [
          choice('feminine', 'Soft features'),
          choice('oval', 'Long oval')
        ])
      ]
    },
    facialHair: {
      id: 'hero-cust-facial-hair',
      label: 'Facial hair',
      path: ['appearance', 'facialHair'],
      preview: 'facial-hair',
      groups: [
        choiceGroup('Facial hair', [
          choice('none', 'None'),
          choice('clean-shaven', 'Clean-shaven'),
          choice('stubble', 'Light stubble'),
          choice('soft-mustache', 'Soft mustache'),
          choice('mustache', 'Mustache'),
          choice('soul-patch', 'Soul patch'),
          choice('light-goatee', 'Light goatee'),
          choice('goatee', 'Goatee'),
          choice('sideburns', 'Sideburns'),
          choice('chin-strap', 'Chin strap'),
          choice('short-beard', 'Short beard'),
          choice('trimmed-beard', 'Trimmed beard'),
          choice('full-beard', 'Full beard')
        ])
      ]
    },
    faceFeature: {
      id: 'hero-cust-face-feature',
      label: 'Facial details',
      path: ['appearance', 'faceFeature'],
      preview: 'face-detail',
      groups: [
        choiceGroup('Facial details', [
          choice('none', 'None'),
          choice('freckles', 'Freckles'),
          choice('beauty-mark', 'Beauty mark'),
          choice('dimples', 'Dimples'),
          choice('smile-lines', 'Smile lines')
        ])
      ]
    },
    bodyType: {
      id: 'hero-cust-body-type',
      label: 'Body type',
      path: ['body', 'type'],
      preview: 'body',
      groups: [
        choiceGroup('Everyday frames', [
          choice('petite', 'Petite frame'),
          choice('lean', 'Lean frame'),
          choice('slim-shouldered', 'Slim-shouldered frame'),
          choice('average', 'Medium frame'),
          choice('tall', 'Tall frame')
        ]),
        choiceGroup('Athletic and strong builds', [
          choice('athletic', 'Athletic build'),
          choice('muscular', 'Strong build'),
          choice('broad', 'Broad-shouldered build'),
          choice('solid', 'Solid build')
        ]),
        choiceGroup('Curved and full frames', [
          choice('curvy', 'Curved frame'),
          choice('fuller-hip', 'Fuller-hip frame'),
          choice('full-frame', 'Full frame'),
          choice('plus-size', 'Plus-size frame')
        ])
      ]
    },
    outfitStyle: {
      id: 'hero-cust-outfit-style',
      label: 'Outfit style',
      path: ['outfit', 'style'],
      preview: 'outfit',
      groups: [
        choiceGroup('Outfit style', [
          choice('super-suit', 'Super suit'),
          choice('hoodie', 'Hoodie'),
          choice('crewneck-sweatshirt', 'Crewneck sweatshirt'),
          choice('varsity-jacket', 'Varsity jacket'),
          choice('denim-jacket', 'Denim jacket'),
          choice('flannel-overshirt', 'Flannel overshirt'),
          choice('striped-knit', 'Striped knit top'),
          choice('windbreaker', 'Windbreaker'),
          choice('lab-coat', 'Lab coat'),
          choice('polo-shirt', 'Polo shirt'),
          choice('collared-shirt', 'Button-up shirt'),
          choice('oxford-shirt', 'Oxford button-up'),
          choice('kurta-top', 'Kurta top'),
          choice('campus-blouse', 'Campus blouse'),
          choice('cardigan', 'Cardigan'),
          choice('blazer', 'Blazer'),
          choice('captain-jacket', 'Captain jacket'),
          choice('utility-vest', 'Utility vest')
        ])
      ]
    },
    accessory: {
      id: 'hero-cust-accessories',
      label: 'Accessories and headwear',
      multiple: true,
      groups: [
        choiceGroup('None', [
          choice('none', 'None')
        ]),
        choiceGroup('Eyewear and face', [
          choice('glasses', 'Glasses'),
          choice('rectangular-glasses', 'Rectangular glasses'),
          choice('thin-rectangular-glasses', 'Thin rectangular glasses'),
          choice('semi-rimless-glasses', 'Semi-rimless glasses'),
          choice('wireframe-glasses', 'Wireframe glasses'),
          choice('round-rim-glasses', 'Round-rim glasses'),
          choice('safety-goggles', 'Safety goggles'),
          choice('spectacles', 'Round spectacles'),
          choice('visor', 'Visor'),
          choice('tech-visor', 'Tech visor'),
          choice('mask', 'Hero mask'),
          choice('monocle', 'Monocle'),
          choice('eyepatch', 'Eyepatch')
        ]),
        choiceGroup('Jewelry and details', [
          choice('earrings', 'Earrings'),
          choice('hoop-earrings', 'Small hoop earrings'),
          choice('hair-clips', 'Hair clips'),
          choice('over-ear-headphones', 'Over-ear headphones'),
          choice('wireless-earbuds', 'Wireless earbuds'),
          choice('wired-earbuds', 'Wired earbuds'),
          choice('chain-necklace', 'Chain necklace'),
          choice('campus-lanyard', 'Campus lanyard'),
          choice('forehead-jewel', 'Forehead jewel')
        ]),
        choiceGroup('Headwear', [
          choice('headband', 'Headband'),
          choice('beanie', 'Beanie'),
          choice('baseball-cap', 'Baseball cap'),
          choice('bucket-hat', 'Bucket hat'),
          choice('bandana', 'Bandana'),
          choice('headwrap', 'Headwrap'),
          choice('draped-scarf', 'Draped head scarf'),
          choice('hijab', 'Hijab'),
          choice('turban', 'Turban'),
          choice('crown', 'Crown'),
          choice('halo', 'Halo')
        ])
      ]
    }
  };

  function flattenChoiceOptions(definition) {
    var values = [];
    var groups = definition && definition.groups ? definition.groups : [];
    for (var g = 0; g < groups.length; g++) {
      var options = groups[g].options || [];
      for (var i = 0; i < options.length; i++) values.push(options[i]);
    }
    return values;
  }

  function choiceValues(key) {
    return flattenChoiceOptions(HERO_CHOICE_SETS[key]).map(function (item) { return item.value; });
  }

  var ENUMS = {
    heroKind: choiceValues('heroKind'),
    presentation: choiceValues('presentation'),
    hairStyle: choiceValues('hairStyle'),
    eyebrowStyle: choiceValues('eyebrowStyle'),
    eyeShape: choiceValues('eyeShape'),
    noseShape: choiceValues('noseShape'),
    mouthStyle: choiceValues('mouthStyle'),
    blushStyle: choiceValues('blushStyle'),
    headStyle: choiceValues('headStyle'),
    facialHair: choiceValues('facialHair'),
    faceFeature: choiceValues('faceFeature'),
    bodyType: choiceValues('bodyType'),
    outfitStyle: choiceValues('outfitStyle'),
    accessory: choiceValues('accessory')
  };

  var HERO_CHOICE_VALUE_ALIASES = {
    hairStyle: {
      'dreads-bun': 'locs-bun'
    },
    eyeShape: {
      monolid: 'single-eyelid',
      'soft-monolid': 'soft-single-eyelid'
    },
    bodyType: {
      stocky: 'solid',
      pear: 'fuller-hip',
      voluptuous: 'full-frame'
    },
    faceFeature: {
      'cheek-lines': 'none'
    },
    accessory: {
      'forehead-accent': 'forehead-jewel'
    }
  };

  function canonicalChoiceValue(key, value) {
    var aliases = HERO_CHOICE_VALUE_ALIASES[key];
    if (!aliases || typeof value !== 'string') return value;
    return aliases[value] || value;
  }

  // Silhouette overlays add readable secondary cues; torso geometry handles the primary body profile.
  var BODY_SILHOUETTES = {
    'petite':          [],
    'lean':            [],
    'slim-shouldered': [],
    'average':         [],
    'athletic':        ['shoulder'],
    'muscular':        ['shoulder'],
    'broad':           ['shoulder'],
    'solid':           ['shoulder'],
    'tall':            [],
    'curvy':           ['waist'],
    'fuller-hip':      ['hip'],
    'full-frame':      ['waist', 'hip'],
    'plus-size':       ['waist', 'hip']
  };
  var ALL_SILHOUETTE_FEATURES = ['bust', 'waist', 'hip', 'shoulder'];
  var HAIR_COVERING_ACCESSORIES = { headwrap: true, 'draped-scarf': true, hijab: true, turban: true };
  var FACE_ACCESSORIES = ['glasses', 'rectangular-glasses', 'thin-rectangular-glasses', 'semi-rimless-glasses', 'wireframe-glasses', 'round-rim-glasses', 'safety-goggles', 'tech-visor', 'spectacles', 'monocle', 'mask', 'eyepatch'];
  var DETAIL_ACCESSORIES = ['earrings', 'hoop-earrings', 'hair-clips', 'over-ear-headphones', 'wireless-earbuds', 'wired-earbuds', 'chain-necklace', 'campus-lanyard', 'forehead-jewel', 'crown', 'halo'];
  var HEADWEAR_ACCESSORIES = ['headband', 'beanie', 'baseball-cap', 'bucket-hat', 'bandana', 'headwrap', 'draped-scarf', 'hijab', 'turban', 'visor'];
  var FACE_ACCESSORY_PRIORITY = ['mask', 'eyepatch', 'tech-visor', 'safety-goggles', 'round-rim-glasses', 'semi-rimless-glasses', 'thin-rectangular-glasses', 'wireframe-glasses', 'rectangular-glasses', 'glasses', 'spectacles', 'monocle'];
  var HEAD_ACCESSORY_PRIORITY = ['hijab', 'headwrap', 'draped-scarf', 'turban', 'beanie', 'baseball-cap', 'bucket-hat', 'bandana', 'visor', 'crown', 'headband'];
  var EAR_ACCESSORY_PRIORITY = ['hoop-earrings', 'earrings'];
  var DETAIL_ACCESSORY_PRIORITY = ['over-ear-headphones', 'wireless-earbuds', 'wired-earbuds', 'hair-clips', 'chain-necklace', 'campus-lanyard', 'forehead-jewel', 'halo'];

  // Body-type → body-shape (SVG geometry override). Average uses the default torso.
  // These use distinct but natural profiles so picker previews read without looking caricatured.
  var BODY_SHAPES = {
    'petite':     'narrow-shoulders',
    'lean':            'compact-lean',
    'slim-shouldered': 'slim-shouldered',
    'tall':            'tall-lean',
    'athletic':        'v-shape',
    'muscular':        'muscular',
    'broad':           'broad',
    'solid':           'solid',
    'curvy':           'curvy',
    'fuller-hip': 'fuller-hip',
    'full-frame': 'full-frame',
    'plus-size':  'plus-size'
  };

  var DEFAULTS = {
    version: SCHEMA_VERSION,
    kind: 'human',
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
      blushStyle: 'natural',
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
  var BRUIN_DEFAULTS = {
    skin: '#8b5a35',
    hairColor: '#3d2818',
    eyeColor: '#1f140c',
    bodyType: 'athletic',
    outfitStyle: 'super-suit'
  };
  var COLOR_CONTROLS = [
    { id: 'hero-cust-skin', palette: 'skin', swatchLabel: 'skin', paletteLabel: 'Preset swatches for skin', hslLabel: 'HSL sliders for skin' },
    { id: 'hero-cust-hair-color', palette: 'hair', swatchLabel: 'hair', paletteLabel: 'Preset swatches for hair', hslLabel: 'HSL sliders for hair' },
    { id: 'hero-cust-eye-color', palette: 'eye', swatchLabel: 'eyes', paletteLabel: 'Preset swatches for eyes', hslLabel: 'HSL sliders for eyes' },
    { id: 'hero-cust-suit', palette: 'suit', swatchLabel: 'suit', paletteLabel: 'Preset swatches for suit', hslLabel: 'HSL sliders for suit' },
    { id: 'hero-cust-cape-outer', palette: 'cape', swatchLabel: 'cape and headwear', paletteLabel: 'Preset swatches for cape and headwear', hslLabel: 'HSL sliders for cape and headwear' },
    { id: 'hero-cust-cape-inner', palette: 'capeInner', swatchLabel: 'accent', paletteLabel: 'Preset swatches for accent', hslLabel: 'HSL sliders for accent' }
  ];

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
  var BRUIN_FUR_WEIGHTS = weightedPalette(['#7a4e2f', '#8b5a35', '#6a4830', '#5c3a22', '#a06840'], [8, 10, 8, 6, 4], 2);
  var BODY_TYPE_WEIGHTS = []
    .concat(weightedValues(['average', 'athletic', 'lean', 'slim-shouldered', 'curvy', 'solid'], 9))
    .concat(weightedValues(['petite', 'tall', 'broad', 'full-frame'], 5))
    .concat(weightedValues(['muscular', 'fuller-hip', 'plus-size'], 3));
  var HEAD_STYLE_WEIGHTS = []
    .concat(weightedValues(['default', 'soft-oval', 'round', 'full-cheeks', 'full-oval', 'oval', 'soft-square', 'slim-square-jaw', 'soft-v-jaw', 'full-straight-jaw', 'soft-round-jaw'], 8))
    .concat(weightedValues(['heart', 'diamond', 'square', 'long-tapered-jaw', 'narrow-angular-jaw', 'broad', 'narrow', 'oblong', 'tapered-oval', 'gentle-taper', 'soft-angular', 'feminine'], 3));
  var PRESENTATION_BODY_WEIGHTS = {
    male: []
      .concat(weightedValues(['average', 'athletic', 'lean', 'slim-shouldered', 'solid'], 9))
      .concat(weightedValues(['tall', 'broad', 'muscular'], 5))
      .concat(weightedValues(['petite', 'curvy', 'fuller-hip', 'full-frame', 'plus-size'], 2)),
    female: []
      .concat(weightedValues(['average', 'athletic', 'lean', 'slim-shouldered', 'curvy'], 9))
      .concat(weightedValues(['petite', 'tall', 'fuller-hip', 'full-frame', 'plus-size'], 5))
      .concat(weightedValues(['solid', 'broad', 'muscular'], 2))
  };
  var PRESENTATION_HEAD_STYLE_WEIGHTS = {
    male: []
      .concat(weightedValues(['default', 'soft-square', 'slim-square-jaw', 'full-straight-jaw', 'oval', 'soft-oval', 'broad', 'square', 'round', 'soft-angular'], 8))
      .concat(weightedValues(['long-tapered-jaw', 'narrow-angular-jaw', 'full-cheeks', 'full-oval', 'narrow', 'oblong', 'diamond', 'tapered-oval', 'gentle-taper', 'soft-round-jaw', 'heart'], 3)),
    female: []
      .concat(weightedValues(['soft-oval', 'round', 'full-cheeks', 'full-oval', 'heart', 'oval', 'soft-v-jaw', 'soft-round-jaw', 'tapered-oval', 'gentle-taper'], 8))
      .concat(weightedValues(['default', 'diamond', 'soft-square', 'narrow', 'oblong', 'soft-angular', 'square', 'broad', 'feminine'], 3))
  };
  var FACE_FEATURE_WEIGHTS = []
    .concat(weightedValues(['none'], 15))
    .concat(weightedValues(['freckles', 'beauty-mark', 'dimples', 'smile-lines'], 2));
  var CAMPUS_FACE_ACCESSORIES = [
    weightedValue([], 34),
    weightedValue(['glasses'], 14),
    weightedValue(['rectangular-glasses'], 10),
    weightedValue(['thin-rectangular-glasses'], 9),
    weightedValue(['semi-rimless-glasses'], 8),
    weightedValue(['wireframe-glasses'], 9),
    weightedValue(['round-rim-glasses'], 8),
    weightedValue(['spectacles'], 4),
    weightedValue(['earrings'], 6),
    weightedValue(['hoop-earrings'], 5),
    weightedValue(['hair-clips'], 5),
    weightedValue(['headband'], 4),
    weightedValue(['beanie'], 4),
    weightedValue(['baseball-cap'], 4),
    weightedValue(['bucket-hat'], 2),
    weightedValue(['bandana'], 2),
    weightedValue(['over-ear-headphones'], 5),
    weightedValue(['wireless-earbuds'], 4),
    weightedValue(['wired-earbuds'], 4),
    weightedValue(['chain-necklace'], 4),
    weightedValue(['campus-lanyard'], 4),
    weightedValue(['glasses', 'earrings'], 5),
    weightedValue(['wireframe-glasses', 'hoop-earrings'], 4),
    weightedValue(['round-rim-glasses', 'hair-clips'], 4),
    weightedValue(['wireless-earbuds', 'chain-necklace'], 3),
    weightedValue(['wired-earbuds', 'campus-lanyard'], 2)
  ];
  var SHORT_HAIR_STYLES = ['short', 'textured-crop', 'wispy-crop', 'casual-messy-crop', 'textured-fringe', 'straight-fringe', 'neat-straight-fringe', 'side-parted-short', 'thick-side-swept', 'ivy-league', 'soft-two-block', 'middle-part-flow', 'slick-back', 'pixie', 'fade', 'crew-cut', 'buzz', 'undercut', 'pompadour'];
  var LONG_HAIR_STYLES = ['bob', 'layered-bob', 'sleek-bob-bangs', 'wavy-lob', 'side-part-lob', 'shoulder-length', 'flipped-lob', 'wolf-cut', 'long-layers', 'straight-long-layers', 'long-center-part', 'butterfly-layers', 'long-straight', 'loose-waves', 'center-part', 'curtain-bangs', 'soft-bangs', 'low-pony-bangs', 'side-swept', 'shag', 'long', 'wavy', 'ponytail', 'high-pony', 'sleek-low-pony', 'claw-clip-updo', 'half-up', 'low-bun', 'messy-bun'];
  var TEXTURED_HAIR_STYLES = ['curly', 'curly-bob', 'voluminous-curls', 'curly-layers', 'coils', 'two-strand-twists', 'twist-out', 'coily-puff', 'double-puffs', 'bantu-knots', 'afro', 'rounded-afro'];
  var BRAID_LOC_STYLES = ['locs', 'loose-locs', 'locs-bun', 'braids', 'long-braid', 'french-braid', 'braided-pony', 'side-braid', 'braided-bun', 'box-braids', 'knotless-braids', 'cornrows'];
  var FACIAL_HAIR_STYLES = ['none', 'clean-shaven', 'stubble', 'soft-mustache', 'mustache', 'light-goatee', 'goatee', 'short-beard', 'trimmed-beard'];
  var POLISHED_SHORT_HAIR_STYLES = ['short', 'textured-crop', 'wispy-crop', 'casual-messy-crop', 'textured-fringe', 'straight-fringe', 'neat-straight-fringe', 'side-parted-short', 'thick-side-swept', 'ivy-league', 'soft-two-block', 'middle-part-flow', 'slick-back', 'fade', 'crew-cut', 'buzz', 'undercut', 'pompadour'];
  var POLISHED_FEMININE_HAIR_STYLES = ['pixie', 'bob', 'layered-bob', 'sleek-bob-bangs', 'wavy-lob', 'side-part-lob', 'shoulder-length', 'flipped-lob', 'wolf-cut', 'long-layers', 'straight-long-layers', 'long-center-part', 'butterfly-layers', 'long-straight', 'loose-waves', 'center-part', 'curtain-bangs', 'soft-bangs', 'low-pony-bangs', 'side-swept', 'shag', 'ponytail', 'high-pony', 'sleek-low-pony', 'claw-clip-updo', 'half-up', 'low-bun', 'messy-bun', 'french-braid'];
  var POLISHED_TEXTURED_HAIR_STYLES = ['curly', 'curly-bob', 'voluminous-curls', 'curly-layers', 'coils', 'two-strand-twists', 'twist-out', 'coily-puff', 'double-puffs', 'afro', 'rounded-afro'];
  var POLISHED_BRAID_LOC_STYLES = ['locs', 'loose-locs', 'locs-bun', 'long-braid', 'french-braid', 'braided-pony', 'side-braid', 'braided-bun', 'box-braids', 'knotless-braids', 'cornrows'];
  var FRIENDLY_MOUTH_RANDOM_WEIGHTS = {
    'cheerful-grin': 10,
    'bright-smile': 9,
    'toothy-smile': 9,
    'open-smile': 7,
    'soft-smile': 7,
    'smile': 6,
    'closed-smile': 5,
    'excited-smile': 5,
    'grin': 4,
    'full-lips': 3,
    'neutral': 1
  };
  var MILESTONE_TIERS = ['none', 'bronze', 'silver', 'gold', 'diamond'];
  var MILESTONE_TOKENS = {
    none: {
      metal: '#b7793c',
      metalLight: '#f5d2a5',
      metalDark: '#6b3e1d',
      glow: '#f5a35c',
      jewel: '#f2a45d'
    },
    bronze: {
      metal: '#b7793c',
      metalLight: '#f5d2a5',
      metalDark: '#6b3e1d',
      glow: '#f2a45d',
      jewel: '#f0a15b'
    },
    silver: {
      metal: '#c8d0d9',
      metalLight: '#f8fbff',
      metalDark: '#677381',
      glow: '#c8e4f4',
      jewel: '#8fc7e8'
    },
    gold: {
      metal: '#ffd100',
      metalLight: '#fff6ad',
      metalDark: '#9a6b00',
      glow: '#ffd86f',
      jewel: '#ffbf3a'
    },
    diamond: {
      metal: '#bdefff',
      metalLight: '#ffffff',
      metalDark: '#237a9d',
      glow: '#a7f4ff',
      jewel: '#74dcff'
    }
  };
  var MASCULINE_FACE_ACCESSORIES = [
    weightedValue([], 34),
    weightedValue(['glasses'], 13),
    weightedValue(['rectangular-glasses'], 12),
    weightedValue(['thin-rectangular-glasses'], 12),
    weightedValue(['semi-rimless-glasses'], 10),
    weightedValue(['wireframe-glasses'], 8),
    weightedValue(['baseball-cap'], 6),
    weightedValue(['beanie'], 5),
    weightedValue(['over-ear-headphones'], 6),
    weightedValue(['wireless-earbuds'], 4),
    weightedValue(['chain-necklace'], 4),
    weightedValue(['wired-earbuds'], 4),
    weightedValue(['campus-lanyard'], 3),
    weightedValue(['bandana'], 3)
  ];
  var FEMININE_FACE_ACCESSORIES = [
    weightedValue([], 24),
    weightedValue(['earrings'], 9),
    weightedValue(['hoop-earrings'], 8),
    weightedValue(['hair-clips'], 8),
    weightedValue(['round-rim-glasses'], 8),
    weightedValue(['semi-rimless-glasses'], 7),
    weightedValue(['wireframe-glasses'], 7),
    weightedValue(['thin-rectangular-glasses'], 6),
    weightedValue(['glasses'], 6),
    weightedValue(['headband'], 5),
    weightedValue(['over-ear-headphones'], 5),
    weightedValue(['wireless-earbuds'], 4),
    weightedValue(['chain-necklace'], 3),
    weightedValue(['wired-earbuds'], 4),
    weightedValue(['campus-lanyard'], 3),
    weightedValue(['bandana'], 3),
    weightedValue(['glasses', 'earrings'], 5),
    weightedValue(['round-rim-glasses', 'hoop-earrings'], 4),
    weightedValue(['round-rim-glasses', 'hair-clips'], 5),
    weightedValue(['wireframe-glasses', 'hair-clips'], 4)
  ];
  // Random recipes keep personal traits independent while nudging style pieces into polished campus combinations.
  var MALE_STYLE_RECIPES = [
    {
      weight: 18,
      hairStyles: POLISHED_SHORT_HAIR_STYLES,
      outfitStyles: ['hoodie', 'crewneck-sweatshirt', 'varsity-jacket', 'denim-jacket', 'flannel-overshirt', 'windbreaker', 'polo-shirt', 'collared-shirt', 'oxford-shirt', 'blazer'],
      accessories: MASCULINE_FACE_ACCESSORIES,
      facialHairChance: 0.48,
      facialHairStyles: FACIAL_HAIR_STYLES,
      eyeShapes: ['round', 'almond', 'soft-almond', 'hooded', 'single-eyelid', 'clear-round'],
      noseShapes: ['soft', 'rounded', 'rounded-tip', 'slim-rounded-tip', 'broad', 'narrow', 'straight-narrow', 'prominent-straight', 'long-soft-bridge', 'soft-rounded-bridge', 'gentle-bridge', 'defined-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin', 'neutral']
    },
    {
      weight: 13,
      hairStyles: POLISHED_TEXTURED_HAIR_STYLES.concat(['locs', 'loose-locs', 'cornrows', 'locs-bun']),
      outfitStyles: ['hoodie', 'crewneck-sweatshirt', 'denim-jacket', 'flannel-overshirt', 'windbreaker', 'polo-shirt', 'kurta-top', 'cardigan', 'collared-shirt', 'oxford-shirt', 'blazer'],
      accessories: [
        weightedValue([], 26),
        weightedValue(['glasses'], 8),
        weightedValue(['rectangular-glasses'], 7),
        weightedValue(['thin-rectangular-glasses'], 7),
        weightedValue(['semi-rimless-glasses'], 6),
        weightedValue(['wireframe-glasses'], 5),
        weightedValue(['baseball-cap'], 3),
        weightedValue(['over-ear-headphones'], 4),
        weightedValue(['wireless-earbuds'], 4),
        weightedValue(['wired-earbuds'], 3),
        weightedValue(['chain-necklace'], 4),
        weightedValue(['campus-lanyard'], 3),
        weightedValue(['bandana'], 2)
      ],
      facialHairChance: 0.34,
      facialHairStyles: ['none', 'clean-shaven', 'stubble', 'soft-mustache', 'mustache', 'light-goatee', 'goatee', 'short-beard', 'trimmed-beard'],
      eyeShapes: ['round', 'almond', 'soft-almond', 'hooded', 'smiling', 'clear-round'],
      noseShapes: ['soft', 'rounded', 'rounded-tip', 'slim-rounded-tip', 'broad', 'prominent-straight', 'gentle-bridge', 'defined-bridge', 'long-soft-bridge', 'soft-rounded-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin', 'neutral', 'full-lips']
    },
    {
      weight: 10,
      hairStyles: POLISHED_SHORT_HAIR_STYLES.concat(POLISHED_BRAID_LOC_STYLES),
      outfitStyles: ['kurta-top', 'polo-shirt', 'collared-shirt', 'oxford-shirt', 'blazer', 'hoodie', 'crewneck-sweatshirt', 'denim-jacket', 'flannel-overshirt', 'windbreaker'],
      accessories: [
        weightedValue(['turban'], 12),
        weightedValue(['turban', 'rectangular-glasses'], 5),
        weightedValue(['turban', 'thin-rectangular-glasses'], 5),
        weightedValue(['turban', 'wireframe-glasses'], 5),
        weightedValue(['turban', 'wireless-earbuds'], 3),
        weightedValue(['turban', 'wired-earbuds'], 2),
        weightedValue(['turban', 'chain-necklace'], 3),
        weightedValue(['turban', 'campus-lanyard'], 2)
      ],
      facialHairChance: 0.42,
      facialHairStyles: ['none', 'clean-shaven', 'stubble', 'soft-mustache', 'mustache', 'light-goatee', 'short-beard', 'trimmed-beard'],
      eyeShapes: ['round', 'almond', 'soft-almond', 'hooded'],
      noseShapes: ['soft', 'rounded', 'rounded-tip', 'slim-rounded-tip', 'broad', 'gentle-bridge', 'defined-bridge', 'straight-narrow', 'prominent-straight'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin', 'neutral']
    },
    {
      weight: 7,
      hairStyles: POLISHED_SHORT_HAIR_STYLES.concat(['locs', 'loose-locs', 'cornrows', 'coils', 'twist-out']),
      outfitStyles: ['lab-coat', 'polo-shirt', 'collared-shirt', 'oxford-shirt', 'blazer', 'hoodie', 'crewneck-sweatshirt'],
      accessories: [
        weightedValue(['safety-goggles'], 10),
        weightedValue(['wireframe-glasses'], 8),
        weightedValue(['rectangular-glasses'], 7),
        weightedValue(['thin-rectangular-glasses'], 7),
        weightedValue(['semi-rimless-glasses'], 6),
        weightedValue(['round-rim-glasses'], 5),
        weightedValue([], 5),
        weightedValue(['glasses'], 5),
        weightedValue(['wireless-earbuds'], 3),
        weightedValue(['wired-earbuds'], 3),
        weightedValue(['over-ear-headphones'], 2),
        weightedValue(['chain-necklace'], 2),
        weightedValue(['campus-lanyard'], 2)
      ],
      facialHairChance: 0.36,
      facialHairStyles: ['none', 'clean-shaven', 'stubble', 'soft-mustache', 'mustache', 'light-goatee', 'trimmed-beard'],
      eyeShapes: ['round', 'almond', 'soft-almond', 'single-eyelid', 'hooded', 'wide', 'clear-round'],
      noseShapes: ['soft', 'rounded', 'rounded-tip', 'slim-rounded-tip', 'broad', 'narrow', 'straight-narrow', 'prominent-straight', 'gentle-bridge', 'defined-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin', 'neutral']
    },
    {
      weight: 10,
      hairStyles: POLISHED_SHORT_HAIR_STYLES.concat(['locs', 'loose-locs', 'shoulder-length', 'center-part', 'flipped-lob']),
      outfitStyles: ['cardigan', 'polo-shirt', 'collared-shirt', 'oxford-shirt', 'blazer', 'striped-knit', 'varsity-jacket', 'kurta-top', 'denim-jacket', 'crewneck-sweatshirt'],
      accessories: [
        weightedValue([], 24),
        weightedValue(['round-rim-glasses'], 7),
        weightedValue(['wireframe-glasses'], 7),
        weightedValue(['rectangular-glasses'], 6),
        weightedValue(['thin-rectangular-glasses'], 6),
        weightedValue(['semi-rimless-glasses'], 5),
        weightedValue(['glasses'], 5),
        weightedValue(['over-ear-headphones'], 5),
        weightedValue(['wireless-earbuds'], 4),
        weightedValue(['wired-earbuds'], 4),
        weightedValue(['chain-necklace'], 4),
        weightedValue(['campus-lanyard'], 3),
        weightedValue(['bandana'], 3)
      ],
      facialHairChance: 0.28,
      facialHairStyles: ['none', 'clean-shaven', 'stubble', 'soft-mustache', 'mustache'],
      eyeShapes: ['round', 'almond', 'soft-almond', 'single-eyelid', 'hooded', 'smiling', 'clear-round'],
      noseShapes: ['soft', 'rounded', 'rounded-tip', 'slim-rounded-tip', 'button', 'soft-upturned', 'gentle-bridge', 'defined-bridge', 'straight-narrow', 'soft-rounded-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin', 'neutral']
    }
  ];
  var FEMALE_STYLE_RECIPES = [
    {
      weight: 17,
      hairStyles: POLISHED_FEMININE_HAIR_STYLES,
      outfitStyles: ['cardigan', 'collared-shirt', 'campus-blouse', 'striped-knit', 'blazer', 'denim-jacket', 'flannel-overshirt', 'varsity-jacket', 'kurta-top'],
      accessories: FEMININE_FACE_ACCESSORIES,
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['round', 'almond', 'soft-almond', 'hooded', 'smiling', 'wide', 'soft-single-eyelid'],
      noseShapes: ['soft', 'rounded', 'rounded-tip', 'narrow', 'button', 'soft-upturned', 'gentle-bridge', 'defined-bridge', 'soft-low-bridge', 'soft-rounded-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin', 'full-lips']
    },
    {
      weight: 14,
      hairStyles: POLISHED_TEXTURED_HAIR_STYLES,
      outfitStyles: ['hoodie', 'crewneck-sweatshirt', 'cardigan', 'windbreaker', 'denim-jacket', 'flannel-overshirt', 'collared-shirt', 'campus-blouse', 'blazer'],
      accessories: [
        weightedValue([], 22),
        weightedValue(['earrings'], 8),
        weightedValue(['hoop-earrings'], 7),
        weightedValue(['hair-clips'], 5),
        weightedValue(['headband'], 6),
        weightedValue(['glasses'], 6),
        weightedValue(['semi-rimless-glasses'], 5),
        weightedValue(['wireframe-glasses'], 5),
        weightedValue(['glasses', 'hoop-earrings'], 4),
        weightedValue(['over-ear-headphones'], 4),
        weightedValue(['wireless-earbuds'], 4),
        weightedValue(['wired-earbuds'], 3),
        weightedValue(['chain-necklace'], 3),
        weightedValue(['campus-lanyard'], 3),
        weightedValue(['bandana'], 2)
      ],
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['round', 'almond', 'soft-almond', 'smiling', 'wide'],
      noseShapes: ['soft', 'rounded', 'rounded-tip', 'broad', 'button', 'soft-upturned', 'soft-rounded-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin', 'full-lips']
    },
    {
      weight: 13,
      hairStyles: POLISHED_BRAID_LOC_STYLES.concat(['braids']),
      outfitStyles: ['hoodie', 'crewneck-sweatshirt', 'denim-jacket', 'flannel-overshirt', 'windbreaker', 'utility-vest', 'kurta-top', 'cardigan', 'blazer'],
      accessories: [
        weightedValue([], 22),
        weightedValue(['earrings'], 7),
        weightedValue(['hoop-earrings'], 7),
        weightedValue(['glasses'], 5),
        weightedValue(['wireframe-glasses'], 4),
        weightedValue(['baseball-cap'], 3),
        weightedValue(['over-ear-headphones'], 4),
        weightedValue(['wireless-earbuds'], 4),
        weightedValue(['wired-earbuds'], 3),
        weightedValue(['chain-necklace'], 3),
        weightedValue(['campus-lanyard'], 3),
        weightedValue(['bandana'], 2)
      ],
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['round', 'almond', 'soft-almond', 'hooded', 'smiling'],
      noseShapes: ['soft', 'rounded', 'rounded-tip', 'broad', 'gentle-bridge', 'defined-bridge', 'soft-rounded-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin', 'neutral', 'full-lips']
    },
    {
      weight: 10,
      hairStyles: POLISHED_FEMININE_HAIR_STYLES.concat(POLISHED_TEXTURED_HAIR_STYLES).concat(POLISHED_BRAID_LOC_STYLES),
      outfitStyles: ['kurta-top', 'cardigan', 'collared-shirt', 'campus-blouse', 'striped-knit', 'windbreaker', 'blazer'],
      accessories: [
        weightedValue(['draped-scarf'], 8),
        weightedValue(['hijab'], 8),
        weightedValue(['draped-scarf', 'earrings'], 3),
        weightedValue(['hijab', 'wireless-earbuds'], 3),
        weightedValue(['hijab', 'wired-earbuds'], 2),
        weightedValue(['draped-scarf', 'chain-necklace'], 3),
        weightedValue(['draped-scarf', 'campus-lanyard'], 2)
      ],
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['round', 'almond', 'soft-almond', 'single-eyelid', 'soft-single-eyelid', 'hooded'],
      noseShapes: ['soft', 'rounded', 'rounded-tip', 'broad', 'narrow', 'gentle-bridge', 'soft-low-bridge', 'soft-rounded-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin', 'full-lips']
    },
    {
      weight: 7,
      hairStyles: ['pixie', 'bob', 'layered-bob', 'sleek-bob-bangs', 'wavy-lob', 'flipped-lob', 'soft-bangs', 'low-pony-bangs', 'claw-clip-updo', 'ponytail', 'half-up', 'locs', 'twist-out', 'curly-layers', 'coils'],
      outfitStyles: ['lab-coat', 'collared-shirt', 'campus-blouse', 'cardigan', 'striped-knit', 'blazer'],
      accessories: [
        weightedValue(['safety-goggles'], 9),
        weightedValue(['wireframe-glasses'], 8),
        weightedValue(['rectangular-glasses'], 7),
        weightedValue(['semi-rimless-glasses'], 6),
        weightedValue(['round-rim-glasses'], 5),
        weightedValue([], 5),
        weightedValue(['glasses'], 5),
        weightedValue(['wireless-earbuds'], 3),
        weightedValue(['wired-earbuds'], 3),
        weightedValue(['over-ear-headphones'], 2),
        weightedValue(['chain-necklace'], 2),
        weightedValue(['campus-lanyard'], 2)
      ],
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['round', 'almond', 'soft-almond', 'single-eyelid', 'soft-single-eyelid', 'hooded', 'wide'],
      noseShapes: ['soft', 'rounded', 'rounded-tip', 'broad', 'narrow', 'gentle-bridge', 'defined-bridge', 'soft-low-bridge', 'soft-rounded-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin', 'neutral']
    },
    {
      weight: 10,
      hairStyles: POLISHED_FEMININE_HAIR_STYLES.concat(['locs', 'loose-locs']),
      outfitStyles: ['cardigan', 'collared-shirt', 'campus-blouse', 'striped-knit', 'blazer', 'varsity-jacket', 'kurta-top', 'denim-jacket'],
      accessories: [
        weightedValue([], 20),
        weightedValue(['round-rim-glasses'], 8),
        weightedValue(['wireframe-glasses'], 8),
        weightedValue(['earrings'], 6),
        weightedValue(['hoop-earrings'], 5),
        weightedValue(['glasses'], 5),
        weightedValue(['over-ear-headphones'], 4),
        weightedValue(['wireless-earbuds'], 4),
        weightedValue(['wired-earbuds'], 3),
        weightedValue(['chain-necklace'], 3),
        weightedValue(['campus-lanyard'], 3),
        weightedValue(['bandana'], 2)
      ],
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['round', 'almond', 'soft-almond', 'single-eyelid', 'soft-single-eyelid', 'hooded', 'smiling'],
      noseShapes: ['soft', 'rounded', 'rounded-tip', 'button', 'soft-upturned', 'gentle-bridge', 'defined-bridge', 'soft-low-bridge', 'soft-rounded-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin', 'full-lips', 'neutral']
    },
    {
      weight: 11,
      hairStyles: ['straight-long-layers', 'long-center-part', 'sleek-bob-bangs', 'low-pony-bangs', 'long-straight', 'soft-bangs', 'center-part', 'side-part-lob', 'flipped-lob', 'claw-clip-updo', 'half-up'],
      outfitStyles: ['campus-blouse', 'cardigan', 'collared-shirt', 'striped-knit', 'blazer', 'denim-jacket', 'hoodie', 'crewneck-sweatshirt', 'varsity-jacket'],
      accessories: [
        weightedValue([], 18),
        weightedValue(['hair-clips'], 9),
        weightedValue(['round-rim-glasses'], 8),
        weightedValue(['wireframe-glasses'], 7),
        weightedValue(['rectangular-glasses'], 6),
        weightedValue(['semi-rimless-glasses'], 5),
        weightedValue(['earrings'], 5),
        weightedValue(['hair-clips', 'round-rim-glasses'], 5),
        weightedValue(['hair-clips', 'wireframe-glasses'], 4),
        weightedValue(['over-ear-headphones'], 5),
        weightedValue(['wireless-earbuds'], 4),
        weightedValue(['wired-earbuds'], 4),
        weightedValue(['chain-necklace'], 3),
        weightedValue(['campus-lanyard'], 3),
        weightedValue(['bandana'], 2)
      ],
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['soft-single-eyelid', 'single-eyelid', 'almond', 'soft-almond', 'hooded', 'smiling'],
      noseShapes: ['soft-low-bridge', 'soft', 'rounded-tip', 'button', 'gentle-bridge', 'soft-upturned', 'soft-rounded-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin']
    },
    {
      weight: 8,
      hairStyles: ['straight-long-layers', 'long-center-part', 'long-straight', 'long-layers', 'loose-waves', 'side-braid', 'long-braid', 'low-bun', 'half-up'],
      outfitStyles: ['kurta-top', 'campus-blouse', 'cardigan', 'collared-shirt', 'striped-knit', 'windbreaker', 'blazer'],
      accessories: [
        weightedValue([], 16),
        weightedValue(['earrings'], 7),
        weightedValue(['hoop-earrings'], 6),
        weightedValue(['wireframe-glasses'], 5),
        weightedValue(['round-rim-glasses'], 5),
        weightedValue(['hijab'], 4),
        weightedValue(['draped-scarf'], 3),
        weightedValue(['hair-clips'], 4),
        weightedValue(['wireless-earbuds'], 4),
        weightedValue(['wired-earbuds'], 3),
        weightedValue(['chain-necklace'], 3),
        weightedValue(['campus-lanyard'], 3),
        weightedValue(['over-ear-headphones'], 2)
      ],
      facialHairChance: 0,
      facialHairStyles: ['none'],
      eyeShapes: ['almond', 'soft-almond', 'hooded', 'soft-single-eyelid', 'single-eyelid', 'round'],
      noseShapes: ['gentle-bridge', 'defined-bridge', 'rounded-tip', 'soft-low-bridge', 'soft', 'rounded', 'soft-rounded-bridge'],
      mouthStyles: ['smile', 'soft-smile', 'closed-smile', 'bright-smile', 'toothy-smile', 'cheerful-grin', 'full-lips']
    }
  ];

  function cleanAccessories(values) {
    if (!Array.isArray(values)) return [];
    var seen = {};
    var cleaned = [];
    for (var i = 0; i < values.length; i++) {
      var value = canonicalChoiceValue('accessory', values[i]);
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
      if (detail === 'hair-clips' && head && HAIR_COVERING_ACCESSORIES[head]) continue;
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

  function randomMouthStyle(recipe) {
    var seen = {};
    var styles = (recipe && recipe.mouthStyles && recipe.mouthStyles.length ? recipe.mouthStyles : ['smile']).slice();
    ['bright-smile', 'toothy-smile', 'cheerful-grin', 'closed-smile', 'open-smile', 'excited-smile'].forEach(function (style) {
      if (styles.indexOf(style) === -1) styles.push(style);
    });
    var weighted = [];
    for (var i = 0; i < styles.length; i++) {
      var style = styles[i];
      if (ENUMS.mouthStyle.indexOf(style) === -1 || seen[style]) continue;
      seen[style] = true;
      weighted.push(weightedValue(style, FRIENDLY_MOUTH_RANDOM_WEIGHTS[style] || 3));
    }
    return weightedFrom(weighted.length ? weighted : [weightedValue('smile', 1)]);
  }

  function normalizePresentation(value) {
    return value === 'male' || value === 'female' ? value : null;
  }

  function normalizeHeroKind(value) {
    return value === 'bruin' ? 'bruin' : 'human';
  }

  function randomPresentation() {
    return Math.random() < 0.5 ? 'male' : 'female';
  }

  function randomRecipeForPresentation(presentation) {
    return weightedFrom(presentation === 'male' ? MALE_STYLE_RECIPES : FEMALE_STYLE_RECIPES);
  }

  function normalizeAvatar(obj) {
    if (!obj || !obj.outfit) return obj;
    obj.kind = normalizeHeroKind(obj.kind);
    var accessories = getAccessories(obj.outfit);
    obj.outfit.accessories = accessories;
    obj.outfit.accessory = accessories[0] || 'none';
    if (obj.appearance) {
      obj.appearance.hairStyle = canonicalChoiceValue('hairStyle', obj.appearance.hairStyle);
      if (obj.appearance.eyeShape !== undefined) obj.appearance.eyeShape = canonicalChoiceValue('eyeShape', obj.appearance.eyeShape);
      if (obj.appearance.headStyle === undefined) obj.appearance.headStyle = 'default';
      if (obj.appearance.eyeShape === undefined) obj.appearance.eyeShape = 'round';
      if (obj.appearance.noseShape === undefined) obj.appearance.noseShape = 'soft';
      if (obj.appearance.mouthStyle === undefined) obj.appearance.mouthStyle = 'smile';
      if (obj.appearance.blushStyle === undefined) obj.appearance.blushStyle = 'natural';
      if (obj.appearance.facialHair === undefined) obj.appearance.facialHair = 'none';
      if (obj.appearance.faceFeature === undefined) obj.appearance.faceFeature = 'none';
      obj.appearance.faceFeature = canonicalChoiceValue('faceFeature', obj.appearance.faceFeature);
    }
    if (obj.body) obj.body.type = canonicalChoiceValue('bodyType', obj.body.type);
    if (obj.outfit.style === undefined) obj.outfit.style = DEFAULTS.outfit.style;
    return obj;
  }

  function randomAvatar(presentation, kind) {
    var heroKind = normalizeHeroKind(kind);
    var selectedPresentation = normalizePresentation(presentation) || randomPresentation();
    var recipe = randomRecipeForPresentation(selectedPresentation);
    var accessories = heroKind === 'bruin' ? [] : randomAccessories(recipe);
    return {
      version: SCHEMA_VERSION,
      kind: heroKind,
      appearance: {
        presentation: selectedPresentation,
        skin: heroKind === 'bruin' ? pickWeightedColor(BRUIN_FUR_WEIGHTS) : randomSkinTone(),
        hairColor: heroKind === 'bruin' ? '#3d2818' : pickWeightedColor(HAIR_COLOR_WEIGHTS),
        hairStyle: heroKind === 'bruin' ? 'bald' : randomFrom(recipe.hairStyles),
        eyeColor: heroKind === 'bruin' ? '#1f140c' : pickWeightedColor(EYE_COLOR_WEIGHTS),
        eyebrowStyle: weightedFrom(weightedValues(['arched', 'straight', 'rounded', 'light-straight', 'full-straight'], 4).concat(weightedValues(['thick', 'thin', 'angular'], 2))),
        headStyle: weightedFrom(PRESENTATION_HEAD_STYLE_WEIGHTS[selectedPresentation] || HEAD_STYLE_WEIGHTS),
        eyeShape: randomFrom(recipe.eyeShapes),
        noseShape: randomFrom(recipe.noseShapes),
        mouthStyle: randomMouthStyle(recipe),
        blushStyle: weightedFrom([weightedValue('natural', 5), weightedValue('subtle', 3), weightedValue('none', 1)]),
        facialHair: heroKind === 'bruin' ? 'none' : randomFacialHair(recipe),
        faceFeature: heroKind === 'bruin' ? 'none' : weightedFrom(FACE_FEATURE_WEIGHTS)
      },
      body: { type: heroKind === 'bruin' ? 'athletic' : weightedFrom(PRESENTATION_BODY_WEIGHTS[selectedPresentation] || BODY_TYPE_WEIGHTS) },
      outfit: {
        style: heroKind === 'bruin' ? 'super-suit' : randomFrom(recipe.outfitStyles),
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

  function clampPercent(n) {
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function normalizeHue(n) {
    var h = Math.round(Number(n) || 0) % 360;
    return h < 0 ? h + 360 : h;
  }

  function rgbToHsl(rgb) {
    var r = rgb.r / 255;
    var g = rgb.g / 255;
    var b = rgb.b / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h = 0;
    var s = 0;
    var l = (max + min) / 2;
    var d = max - min;

    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d) + (g < b ? 6 : 0);
      else if (max === g) h = ((b - r) / d) + 2;
      else h = ((r - g) / d) + 4;
      h *= 60;
    }

    return {
      h: normalizeHue(h),
      s: clampPercent(s * 100),
      l: clampPercent(l * 100)
    };
  }

  function hslToRgb(h, s, l) {
    var hue = normalizeHue(h) / 360;
    var sat = clampPercent(s) / 100;
    var light = clampPercent(l) / 100;

    if (sat === 0) {
      var gray = clampByte(light * 255);
      return { r: gray, g: gray, b: gray };
    }

    function hueToRgb(p, q, t) {
      var next = t;
      if (next < 0) next += 1;
      if (next > 1) next -= 1;
      if (next < 1 / 6) return p + (q - p) * 6 * next;
      if (next < 1 / 2) return q;
      if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
      return p;
    }

    var q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
    var p = 2 * light - q;
    return {
      r: clampByte(hueToRgb(p, q, hue + 1 / 3) * 255),
      g: clampByte(hueToRgb(p, q, hue) * 255),
      b: clampByte(hueToRgb(p, q, hue - 1 / 3) * 255)
    };
  }

  function hexToHsl(hex) {
    return rgbToHsl(hexToRgb(hex));
  }

  function hslToHex(hsl) {
    return rgbToHex(hslToRgb(hsl.h, hsl.s, hsl.l));
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

  function skinRelativeAccent(base, accent, amount, maxRatio) {
    var t = Math.max(0, Math.min(1, amount));
    var result = mix(base, accent, t);
    while (t > 0.06 && contrastRatio(result, base) > maxRatio) {
      t -= 0.04;
      result = mix(base, accent, t);
    }
    return result;
  }

  function avatarContrastTokens(skin, hair) {
    var skinLum = relativeLuminance(skin);
    var hairLum = relativeLuminance(hair);
    var skinShadow = darken(skin, 0.22);
    var skinMid = mix(skin, skinShadow, skinLum < 0.2 ? 0.36 : 0.28);
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
    var cheek = darkSkin
      ? skinRelativeAccent(skin, '#9a665d', deepSkin ? 0.32 : 0.28, 1.8)
      : skinRelativeAccent(skin, '#e07a68', skinLum > 0.65 ? 0.34 : 0.28, 1.85);
    var mouthFill = darkSkin
      ? skinRelativeAccent(skinShadow, '#5a2418', deepSkin ? 0.24 : 0.18, 1.75)
      : '#5a2418';
    var mouthLine = darkSkin
      ? firstContrastColorAgainstAll(['#f1c27d', '#e0a080', '#fff2b8', '#3a1408'], skinRamp, compactTarget)
      : '#3a1408';
    var lipFill = darkSkin
      ? skinRelativeAccent(skin, '#8f5148', deepSkin ? 0.42 : 0.36, 2.05)
      : skinRelativeAccent(skin, '#b85a55', skinLum > 0.65 ? 0.42 : 0.34, 2.2);
    var lipShadow = darkSkin ? mix(lipFill, skinShadow, 0.42) : mix(lipFill, '#7a2e2e', 0.42);
    var lipHighlight = darkSkin
      ? skinRelativeAccent(lipFill, warmHighlight, 0.3, 1.55)
      : skinRelativeAccent(lipFill, '#ffd0bc', 0.34, 1.55);
    var eyebrow = contrastRatio(hair, skin) < 3
      ? firstContrastColorAgainstAll([hairRim, faceLine, lighten(hair, 0.58), mix(hair, '#f1c27d', 0.38), darken(hair, 0.5)], skinRamp, featureTarget)
      : hair;
    var skinHighlightSoft = darkSkin
      ? mix(skin, warmHighlight, deepSkin ? 0.34 : 0.28)
      : mix(skin, '#fff2df', 0.28);
    var skinAmbient = darkSkin
      ? mix(skin, warmHighlight, 0.16)
      : mix(skin, '#ffe6cc', 0.18);
    var facePlaneShadow = darkSkin
      ? mix(skinShadow, '#160c07', deepSkin ? 0.32 : 0.22)
      : darken(skin, 0.24);
    var jawLine = firstContrastColorAgainstAll(
      darkSkin
        ? [faceLine, '#b08a69', mix(skin, '#f1c27d', 0.68), '#f4d7b5']
        : [darken(skin, 0.42), '#7a4a2a', darken(skin, 0.58)],
      skinRamp,
      darkSkin ? 2.8 : 2.35
    );

    return {
      skinMid: skinMid,
      skinAmbient: skinAmbient,
      skinShadow: skinShadow,
      skinHighlight: warmHighlight,
      skinHighlightSoft: skinHighlightSoft,
      faceLine: faceLine,
      faceShadow: darkSkin ? mix(skinShadow, faceLine, 0.38) : darken(skin, 0.35),
      facePlaneShadow: facePlaneShadow,
      jawLine: jawLine,
      faceMark: faceMark,
      noseFill: darkSkin ? faceLine : faceLine,
      noseHighlight: darkSkin ? warmHighlight : '#fff1dc',
      cheek: cheek,
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
      cheekOpacity: darkSkin ? '0.34' : '0.3',
      contourOpacity: darkSkin ? '0.58' : '0.18',
      subtleLineOpacity: darkSkin ? '0.66' : '0.24',
      hairDetailOpacity: darkSkin && darkHair ? '0.74' : '0.5',
      faceHighlightOpacity: darkSkin ? '0.2' : '0.14',
      faceAmbientOpacity: darkSkin ? '0.18' : '0.1',
      faceShadowOpacity: darkSkin ? '0.26' : '0.1',
      jawLineOpacity: darkSkin ? '0.46' : '0.22',
      neckShadowOpacity: darkSkin ? '0.52' : '0.28',
      neckHighlightOpacity: darkSkin ? '0.22' : '0.18',
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

  function normalizeMilestoneTier(value) {
    var normalized = String(value || 'none').toLowerCase().replace(/^milestone-/, '');
    return MILESTONE_TIERS.indexOf(normalized) !== -1 ? normalized : 'none';
  }

  function applyMilestoneToSvg(svg, tier) {
    if (!svg) return;
    var normalized = normalizeMilestoneTier(tier);
    var tokens = MILESTONE_TOKENS[normalized] || MILESTONE_TOKENS.none;
    svg.setAttribute('data-hero-milestone', normalized);
    svg.style.setProperty('--hero-milestone-metal', tokens.metal);
    svg.style.setProperty('--hero-milestone-metal-light', tokens.metalLight);
    svg.style.setProperty('--hero-milestone-metal-dark', tokens.metalDark);
    svg.style.setProperty('--hero-milestone-glow', tokens.glow);
    svg.style.setProperty('--hero-milestone-jewel', tokens.jewel);
    setSlot(svg, 'milestone-power', normalized);
  }

  function applyMilestoneToScope(tier, scope) {
    var root = scope || document;
    var normalized = normalizeMilestoneTier(tier);
    var svgs = root.querySelectorAll('[data-gym-hero-svg]');
    for (var i = 0; i < svgs.length; i++) applyMilestoneToSvg(svgs[i], normalized);
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

  function setHeroKindLayers(svg, kind) {
    var heroKind = normalizeHeroKind(kind);
    var groups = svg.querySelectorAll('[data-hero-kind-layer]');
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      group.setAttribute('display', group.getAttribute('data-hero-kind-layer') === heroKind ? 'inline' : 'none');
    }
  }

  function applyBodyTypeToSvg(svg, bodyType) {
    bodyType = canonicalChoiceValue('bodyType', bodyType);
    svg.setAttribute('data-hero-body', bodyType);
    var features = BODY_SILHOUETTES[bodyType] || [];
    for (var f = 0; f < ALL_SILHOUETTE_FEATURES.length; f++) {
      var feat = ALL_SILHOUETTE_FEATURES[f];
      var groups = svg.querySelectorAll('[data-hero-slot="silhouette"][data-hero-feature="' + feat + '"]');
      var show = features.indexOf(feat) !== -1;
      for (var i = 0; i < groups.length; i++) {
        groups[i].setAttribute('display', show ? 'inline' : 'none');
      }
    }

    var bodyShape = BODY_SHAPES[bodyType];
    var bodyShapeGroups = svg.querySelectorAll('[data-hero-slot="body-shape"]');
    for (var bi = 0; bi < bodyShapeGroups.length; bi++) {
      var bg = bodyShapeGroups[bi];
      bg.setAttribute('display', bg.getAttribute('data-hero-option') === bodyShape ? 'inline' : 'none');
    }
    var defaultTorso = svg.querySelector('[data-hero-default-torso]');
    if (defaultTorso) {
      defaultTorso.style.display = bodyShape ? 'none' : '';
    }
  }

  function applyToSvg(svg, state) {
    var heroKind = normalizeHeroKind(state.kind);
    var bodyType = canonicalChoiceValue('bodyType', state.body.type);
    var hairStyle = canonicalChoiceValue('hairStyle', state.appearance.hairStyle);
    var eyeShape = canonicalChoiceValue('eyeShape', state.appearance.eyeShape || 'round');
    var contrastTokens = avatarContrastTokens(state.appearance.skin, state.appearance.hairColor);
    svg.style.setProperty('--hero-skin-light', state.appearance.skin);
    svg.style.setProperty('--hero-skin', darken(state.appearance.skin, 0.22));
    svg.style.setProperty('--hero-skin-mid', contrastTokens.skinMid);
    svg.style.setProperty('--hero-skin-ambient', contrastTokens.skinAmbient);
    svg.style.setProperty('--hero-skin-shadow', contrastTokens.skinShadow);
    svg.style.setProperty('--hero-skin-highlight', contrastTokens.skinHighlight);
    svg.style.setProperty('--hero-skin-highlight-soft', contrastTokens.skinHighlightSoft);
    svg.style.setProperty('--hero-face-line', contrastTokens.faceLine);
    svg.style.setProperty('--hero-face-shadow', contrastTokens.faceShadow);
    svg.style.setProperty('--hero-face-plane-shadow', contrastTokens.facePlaneShadow);
    svg.style.setProperty('--hero-jaw-line', contrastTokens.jawLine);
    svg.style.setProperty('--hero-face-mark', contrastTokens.faceMark);
    svg.style.setProperty('--hero-nose-fill', contrastTokens.noseFill);
    svg.style.setProperty('--hero-nose-highlight', contrastTokens.noseHighlight);
    svg.style.setProperty('--hero-cheek', contrastTokens.cheek);
    var blushStyle = state.appearance.blushStyle || 'natural';
    var cheekOpacity = blushStyle === 'none'
      ? '0'
      : (blushStyle === 'subtle' ? String(parseFloat(contrastTokens.cheekOpacity) * 0.55) : contrastTokens.cheekOpacity);
    svg.style.setProperty('--hero-cheek-opacity', cheekOpacity);
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
    svg.style.setProperty('--hero-face-highlight-opacity', contrastTokens.faceHighlightOpacity);
    svg.style.setProperty('--hero-face-ambient-opacity', contrastTokens.faceAmbientOpacity);
    svg.style.setProperty('--hero-face-shadow-opacity', contrastTokens.faceShadowOpacity);
    svg.style.setProperty('--hero-jaw-line-opacity', contrastTokens.jawLineOpacity);
    svg.style.setProperty('--hero-neck-shadow-opacity', contrastTokens.neckShadowOpacity);
    svg.style.setProperty('--hero-neck-highlight-opacity', contrastTokens.neckHighlightOpacity);
    svg.style.setProperty('--hero-glasses-frame', contrastTokens.glassesFrame);
    svg.style.setProperty('--hero-glasses-frame-dark', contrastTokens.glassesFrameDark);
    svg.style.setProperty('--hero-glasses-metal', contrastTokens.glassesMetal);
    svg.style.setProperty('--hero-lens-fill', contrastTokens.lensFill);
    svg.style.setProperty('--hero-bruin-fur-light', lighten(state.appearance.skin, 0.28));
    svg.style.setProperty('--hero-bruin-fur', state.appearance.skin);
    svg.style.setProperty('--hero-bruin-fur-dark', darken(state.appearance.skin, 0.42));
    svg.style.setProperty('--hero-bruin-muzzle', mix(lighten(state.appearance.skin, 0.42), '#f1c27d', 0.18));
    svg.style.setProperty('--hero-bruin-line', firstContrastColorAgainstAll(['#1f140c', '#2a1609', '#f7ead7', '#ffffff'], [state.appearance.skin], 3));
    svg.style.setProperty('--hero-suit-light', lighten(state.outfit.suit, 0.35));
    svg.style.setProperty('--hero-suit', state.outfit.suit);
    svg.style.setProperty('--hero-suit-dark', darken(state.outfit.suit, 0.4));
    svg.style.setProperty('--hero-cape-light', lighten(state.outfit.capeOuter, 0.3));
    svg.style.setProperty('--hero-cape', state.outfit.capeOuter);
    svg.style.setProperty('--hero-cape-dark', darken(state.outfit.capeOuter, 0.55));
    svg.style.setProperty('--hero-cape-inner-light', lighten(state.outfit.capeInner, 0.4));
    svg.style.setProperty('--hero-cape-inner', state.outfit.capeInner);

    svg.setAttribute('data-hero-kind', heroKind);
    setHeroKindLayers(svg, heroKind);

    var accessories = getAccessories(state.outfit);
    var compositedAccessories = getCompositedAccessories(accessories);
    var hidesHair = compositedAccessories.some(function (accessory) { return !!HAIR_COVERING_ACCESSORIES[accessory]; });
    var renderedHairStyle = hidesHair ? 'bald' : hairStyle;
    setSlot(svg, 'hair', renderedHairStyle);
    setSlot(svg, 'eyebrow', state.appearance.eyebrowStyle);
    setSlot(svg, 'eye-shape', eyeShape);
    var headStyle = state.appearance.headStyle || 'default';
    setSlot(svg, 'head-shape', headStyle);
    setSlot(svg, 'face-clear', headStyle);
    setSlot(svg, 'head-features', headStyle);
    setSlot(svg, 'hairline', hidesHair ? 'none' : renderedHairStyle);
    setSlot(svg, 'nose-shape', state.appearance.noseShape || 'soft');
    setSlot(svg, 'face-feature', canonicalChoiceValue('faceFeature', state.appearance.faceFeature || 'none'));
    setSlot(svg, 'facial-hair', state.appearance.facialHair || 'none');
    setSlot(svg, 'mouth-style', state.appearance.mouthStyle || 'smile');
    setSlot(svg, 'hair-root', hidesHair ? 'none' : renderedHairStyle);
    setSlot(svg, 'outfit-style', state.outfit.style || DEFAULTS.outfit.style);
    setMultiSlot(svg, 'accessory', compositedAccessories);

    applyBodyTypeToSvg(svg, heroKind === 'bruin' ? 'athletic' : bodyType);

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
    applyMilestoneToSvg(svg, svg.getAttribute('data-hero-milestone') || window.SEGymHeroMilestone || 'none');
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
  function inEnum(v, key) { return typeof v === 'string' && ENUMS[key].indexOf(canonicalChoiceValue(key, v)) !== -1; }

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
    if (obj.kind !== undefined && !inEnum(obj.kind, 'heroKind')) return { ok: false, error: 'Invalid hero type.' };
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
    if (a.blushStyle !== undefined && !inEnum(a.blushStyle, 'blushStyle')) return { ok: false, error: 'Invalid cheek tint.' };
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
    CHOICE_SETS: HERO_CHOICE_SETS,
    DEFAULTS: DEFAULTS,
    randomPresentation: randomPresentation,
    randomAvatar: randomAvatar,
    validateAvatar: validateAvatar,
    loadAvatar: loadAvatar,
    saveAvatar: saveAvatar,
    clearAvatar: clearAvatar,
    normalizeAvatar: normalizeAvatar,
    normalizeMilestoneTier: normalizeMilestoneTier,
    getCompositedAccessories: getCompositedAccessories,
    applyMilestoneToSvg: applyMilestoneToSvg,
    applyMilestoneToScope: applyMilestoneToScope,
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
    var choiceControls = [];
    var choicePreviewId = 0;
    var choicePreviewRenderToken = 0;
    var choicePreviewForegroundHandle = 0;
    var choicePreviewBackgroundHandle = 0;
    var choicePreviewScrollHandle = 0;
    var choicePreviewForegroundQueue = [];
    var choicePreviewBackgroundQueue = [];
    var latestChoicePreviewState = null;
    var latestChoicePreviewSnapshot = null;
    var choicePreviewObserver = null;

    function $(id) { return modal.querySelector('#' + id); }

    function normalizedColorValue(input) {
      return input && isHex(input.value) ? input.value.toLowerCase() : '#000000';
    }

    function rememberHsl(input, hsl, hex) {
      input._heroHsl = {
        h: normalizeHue(hsl.h),
        s: clampPercent(hsl.s),
        l: clampPercent(hsl.l)
      };
      input._heroHslHex = (hex || hslToHex(input._heroHsl)).toLowerCase();
      return input._heroHsl;
    }

    function hslForInput(input, hex) {
      var normalizedHex = (hex || normalizedColorValue(input)).toLowerCase();
      if (input._heroHsl && input._heroHslHex === normalizedHex) return input._heroHsl;
      return rememberHsl(input, hexToHsl(normalizedHex), normalizedHex);
    }

    function setText(el, text) {
      if (el) el.textContent = text;
    }

    function formatHslValue(channel, value) {
      return channel === 'hue' || channel === 'h' ? String(value) + ' deg' : String(value) + '%';
    }

    function setRangeValue(range, output, channel, value) {
      if (!range) return;
      range.value = String(value);
      range.setAttribute('aria-valuetext', formatHslValue(channel, value));
      setText(output, formatHslValue(channel, value));
    }

    function normalizeHexEntry(value) {
      var text = String(value || '').trim();
      if (text && text.charAt(0) !== '#') text = '#' + text;
      return isHex(text) ? text.toLowerCase() : null;
    }

    function setHexInputValidity(hexInput, isValid) {
      if (!hexInput) return;
      if (isValid) {
        hexInput.removeAttribute('aria-invalid');
        hexInput.setCustomValidity('');
      } else {
        hexInput.setAttribute('aria-invalid', 'true');
        hexInput.setCustomValidity('Enter a hex color like #2774AE.');
      }
    }

    function syncHexInput(tool, hex) {
      if (!tool || !tool.hexInput) return;
      tool.hexInput.value = hex.toUpperCase();
      setHexInputValidity(tool.hexInput, true);
    }

    function hslCss(h, s, l) {
      return 'hsl(' + normalizeHue(h) + ', ' + clampPercent(s) + '%, ' + clampPercent(l) + '%)';
    }

    function applyRangeSpectrums(tool, hsl) {
      if (!tool) return;
      tool.hue.style.setProperty('--hero-cust-range-bg', [
        'linear-gradient(90deg',
        hslCss(0, hsl.s, hsl.l),
        hslCss(60, hsl.s, hsl.l),
        hslCss(120, hsl.s, hsl.l),
        hslCss(180, hsl.s, hsl.l),
        hslCss(240, hsl.s, hsl.l),
        hslCss(300, hsl.s, hsl.l),
        hslCss(360, hsl.s, hsl.l) + ')'
      ].join(', '));
      tool.saturation.style.setProperty('--hero-cust-range-bg',
        'linear-gradient(90deg, ' + hslCss(hsl.h, 0, hsl.l) + ', ' + hslCss(hsl.h, 100, hsl.l) + ')');
      tool.lightness.style.setProperty('--hero-cust-range-bg',
        'linear-gradient(90deg, ' + hslCss(hsl.h, hsl.s, 0) + ', ' + hslCss(hsl.h, hsl.s, 50) + ', ' + hslCss(hsl.h, hsl.s, 100) + ')');
    }

    function syncColorTool(input) {
      if (!input || !input._heroColorTool) return;
      var tool = input._heroColorTool;
      var hex = normalizedColorValue(input);
      var hsl = hslForInput(input, hex);
      syncHexInput(tool, hex);
      setRangeValue(tool.hue, tool.hueOutput, 'h', hsl.h);
      setRangeValue(tool.saturation, tool.saturationOutput, 's', hsl.s);
      setRangeValue(tool.lightness, tool.lightnessOutput, 'l', hsl.l);
      applyRangeSpectrums(tool, hsl);
      for (var i = 0; i < tool.swatches.length; i++) {
        var swatch = tool.swatches[i];
        swatch.setAttribute('aria-pressed', swatch.getAttribute('data-color') === hex ? 'true' : 'false');
      }
    }

    function syncAllColorTools() {
      for (var i = 0; i < COLOR_CONTROLS.length; i++) {
        syncColorTool($(COLOR_CONTROLS[i].id));
      }
    }

    function resetColorHslFromInput(input) {
      if (!input) return;
      rememberHsl(input, hexToHsl(normalizedColorValue(input)), normalizedColorValue(input));
    }

    function resetAllColorHslFromForm() {
      for (var i = 0; i < COLOR_CONTROLS.length; i++) {
        resetColorHslFromInput($(COLOR_CONTROLS[i].id));
      }
    }

    function updateColorInput(input, hex, hsl, silent) {
      if (!input || !isHex(hex)) return;
      input.value = hex.toLowerCase();
      rememberHsl(input, hsl || hexToHsl(input.value), input.value);
      syncColorTool(input);
      if (!silent) refreshPreview();
    }

    function updateColorFromHsl(input) {
      if (!input || !input._heroColorTool) return;
      var tool = input._heroColorTool;
      var nextHsl = {
        h: Number(tool.hue.value),
        s: Number(tool.saturation.value),
        l: Number(tool.lightness.value)
      };
      updateColorInput(input, hslToHex(nextHsl), nextHsl);
    }

    function updateColorFromHex(input, commit) {
      if (!input || !input._heroColorTool || !input._heroColorTool.hexInput) return;
      var hexInput = input._heroColorTool.hexInput;
      var hex = normalizeHexEntry(hexInput.value);
      if (!hex) {
        if (commit) {
          syncHexInput(input._heroColorTool, normalizedColorValue(input));
        } else {
          setHexInputValidity(hexInput, false);
        }
        return;
      }
      setHexInputValidity(hexInput, true);
      updateColorInput(input, hex);
    }

    function createHexEntry(input, swatchLabel) {
      var wrapper = document.createElement('div');
      wrapper.className = 'hero-cust-color-entry';

      var fieldId = input.id + '-hex';
      var labelEl = document.createElement('label');
      labelEl.setAttribute('for', fieldId);
      labelEl.textContent = 'Hex';

      var field = document.createElement('input');
      field.type = 'text';
      field.id = fieldId;
      field.className = 'hero-cust-color-value';
      field.maxLength = 7;
      field.pattern = '#?[0-9A-Fa-f]{6}';
      field.autocomplete = 'off';
      field.spellcheck = false;
      field.setAttribute('aria-label', 'Hex color for ' + swatchLabel);
      field.title = 'Enter a hex color like #2774AE';
      field.addEventListener('input', function () { updateColorFromHex(input, false); });
      field.addEventListener('change', function () { updateColorFromHex(input, true); });
      field.addEventListener('blur', function () { updateColorFromHex(input, true); });

      wrapper.appendChild(labelEl);
      wrapper.appendChild(field);
      return { wrapper: wrapper, input: field };
    }

    function createHslRow(input, channel, label, min, max) {
      var row = document.createElement('div');
      row.className = 'hero-cust-hsl-row';

      var labelEl = document.createElement('label');
      var rangeId = input.id + '-' + channel;
      var output = document.createElement('output');
      output.id = rangeId + '-value';
      output.setAttribute('for', rangeId);
      labelEl.setAttribute('for', rangeId);
      labelEl.appendChild(document.createTextNode(label + ' '));
      labelEl.appendChild(output);

      var range = document.createElement('input');
      range.type = 'range';
      range.id = rangeId;
      range.min = String(min);
      range.max = String(max);
      range.step = '1';
      range.addEventListener('input', function () { updateColorFromHsl(input); });
      range.addEventListener('change', function () { updateColorFromHsl(input); });

      row.appendChild(labelEl);
      row.appendChild(range);
      return { row: row, range: range, output: output };
    }

    function buildColorTools(config) {
      var input = $(config.id);
      if (!input || input._heroColorTool) return;

      var tools = document.createElement('div');
      tools.className = 'hero-cust-color-tools';
      tools.setAttribute('data-hero-color-tools', config.id);

      var hexEntry = createHexEntry(input, config.swatchLabel);
      tools.appendChild(hexEntry.wrapper);

      var palette = document.createElement('div');
      palette.className = 'hero-cust-color-palette';
      palette.setAttribute('role', 'group');
      palette.setAttribute('aria-label', config.paletteLabel);

      var swatches = [];
      var colors = PALETTES[config.palette] || [];
      var seenColors = {};
      for (var i = 0; i < colors.length; i++) {
        var color = colors[i].toLowerCase();
        if (seenColors[color]) continue;
        seenColors[color] = true;
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'hero-cust-color-swatch';
        button.setAttribute('data-color', color);
        button.setAttribute('aria-label', 'Use ' + config.swatchLabel + ' preset ' + color.toUpperCase());
        button.setAttribute('aria-pressed', 'false');
        button.style.setProperty('--hero-cust-swatch', color);
        button.addEventListener('click', function () {
          updateColorInput(input, this.getAttribute('data-color'));
        });
        palette.appendChild(button);
        swatches.push(button);
      }
      tools.appendChild(palette);

      var hslGroup = document.createElement('div');
      hslGroup.className = 'hero-cust-hsl-controls';
      hslGroup.setAttribute('role', 'group');
      hslGroup.setAttribute('aria-label', config.hslLabel);

      var hue = createHslRow(input, 'hue', 'Hue', 0, 359);
      var saturation = createHslRow(input, 'saturation', 'Saturation', 0, 100);
      var lightness = createHslRow(input, 'lightness', 'Lightness', 0, 100);
      hslGroup.appendChild(hue.row);
      hslGroup.appendChild(saturation.row);
      hslGroup.appendChild(lightness.row);
      tools.appendChild(hslGroup);

      input._heroColorTool = {
        hexInput: hexEntry.input,
        swatches: swatches,
        hue: hue.range,
        hueOutput: hue.output,
        saturation: saturation.range,
        saturationOutput: saturation.output,
        lightness: lightness.range,
        lightnessOutput: lightness.output
      };
      input.insertAdjacentElement('afterend', tools);
      syncColorTool(input);
    }

    function initColorTools() {
      for (var i = 0; i < COLOR_CONTROLS.length; i++) {
        buildColorTools(COLOR_CONTROLS[i]);
      }
    }

    function populateSelectFromChoiceSet(select, key, definition) {
      if (!select || !definition || select._heroChoicePopulated) return;
      var current = select.value;
      select.textContent = '';
      var groups = definition.groups || [];
      var needsGroups = groups.length > 1 || (groups[0] && groups[0].label !== definition.label);
      for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        var parent = select;
        if (needsGroups) {
          parent = document.createElement('optgroup');
          parent.label = group.label;
          select.appendChild(parent);
        }
        var options = group.options || [];
        for (var i = 0; i < options.length; i++) {
          var option = document.createElement('option');
          option.value = options[i].value;
          option.textContent = options[i].label;
          parent.appendChild(option);
        }
      }
      if (current && ENUMS[key] && ENUMS[key].indexOf(current) !== -1) select.value = current;
      select._heroChoicePopulated = true;
    }

    function populateAccessoryCheckboxes() {
      var definition = HERO_CHOICE_SETS.accessory;
      var container = modal.querySelector('[data-hero-choice="accessory"]');
      if (!definition || !container || container._heroChoicePopulated) return;
      container.textContent = '';
      for (var g = 0; g < definition.groups.length; g++) {
        var group = definition.groups[g];
        var options = group.options || [];
        var visibleOptions = options.filter(function (option) { return option.value !== 'none'; });
        if (visibleOptions.length === 0) continue;

        if (definition.groups.length > 1) {
          var heading = document.createElement('span');
          heading.className = 'hero-cust-checkbox-heading';
          heading.textContent = group.label;
          container.appendChild(heading);
        }

        for (var i = 0; i < visibleOptions.length; i++) {
          var option = visibleOptions[i];
          var label = document.createElement('label');
          var input = document.createElement('input');
          input.type = 'checkbox';
          input.name = 'hero-cust-accessory';
          input.value = option.value;
          label.appendChild(input);
          label.appendChild(document.createTextNode(' ' + option.label));
          container.appendChild(label);
        }
      }
      container._heroChoicePopulated = true;
    }

    function cloneAvatarState(state) {
      return JSON.parse(JSON.stringify(state || DEFAULTS));
    }

    function setPathValue(obj, path, value) {
      var cursor = obj;
      for (var i = 0; i < path.length - 1; i++) {
        if (!cursor[path[i]]) cursor[path[i]] = {};
        cursor = cursor[path[i]];
      }
      cursor[path[path.length - 1]] = value;
    }

    function choiceState(definition, value, baseState) {
      var state = cloneAvatarState(baseState || readForm());
      setPathValue(state, definition.path, value);
      if (definition.key === 'heroKind' && value === 'bruin') {
        state.appearance.skin = BRUIN_DEFAULTS.skin;
        state.appearance.hairColor = BRUIN_DEFAULTS.hairColor;
        state.appearance.hairStyle = 'bald';
        state.appearance.eyeColor = BRUIN_DEFAULTS.eyeColor;
        state.appearance.facialHair = 'none';
        state.appearance.faceFeature = 'none';
        state.body.type = BRUIN_DEFAULTS.bodyType;
        state.outfit.style = BRUIN_DEFAULTS.outfitStyle;
        state.outfit.accessory = 'none';
        state.outfit.accessories = [];
      }
      return normalizeAvatar(state);
    }

    function updateUrlReference(value, idMap) {
      if (!value) return value;
      var next = value.replace(/url\(#([^)]+)\)/g, function (match, id) {
        return idMap[id] ? 'url(#' + idMap[id] + ')' : match;
      });
      if (next.charAt(0) === '#') {
        var plain = next.slice(1);
        if (idMap[plain]) return '#' + idMap[plain];
      }
      return next;
    }

    function uniquifySvgIds(svg, suffix) {
      var idMap = {};
      var idNodes = svg.querySelectorAll('[id]');
      for (var i = 0; i < idNodes.length; i++) {
        var oldId = idNodes[i].id;
        var newId = oldId + '-' + suffix;
        idMap[oldId] = newId;
        idNodes[i].id = newId;
      }

      var attrs = ['href', 'xlink:href', 'clip-path', 'fill', 'stroke', 'filter', 'mask', 'marker-start', 'marker-mid', 'marker-end'];
      var nodes = svg.querySelectorAll('*');
      for (var n = 0; n < nodes.length; n++) {
        for (var a = 0; a < attrs.length; a++) {
          if (!nodes[n].hasAttribute(attrs[a])) continue;
          nodes[n].setAttribute(attrs[a], updateUrlReference(nodes[n].getAttribute(attrs[a]), idMap));
        }
      }
    }

    var CHOICE_PREVIEW_VIEWBOXES = {
      full: '238 34 324 596',
      hair: '292 54 216 278',
      eyebrows: '352 138 96 78',
      eyes: '352 154 96 78',
      nose: '370 178 60 50',
      mouth: '360 202 80 66',
      cheeks: '342 178 116 94',
      'head-shape': '326 92 148 184',
      'facial-hair': '344 184 112 92',
      'face-detail': '350 178 100 82',
      body: '270 228 260 340',
      outfit: '286 226 228 294',
      face: '346 138 108 118',
      head: '318 78 164 208',
      upper: '246 86 308 374'
    };

    var FACE_PREVIEW_CROPS = {
      hair: true,
      eyebrows: true,
      eyes: true,
      nose: true,
      mouth: true,
      cheeks: true,
      'head-shape': true,
      'facial-hair': true,
      'face-detail': true,
      face: true,
      head: true
    };

    var UPPER_PREVIEW_CROPS = {
      body: true,
      outfit: true,
      upper: true
    };

    function previewViewBox(crop) {
      return CHOICE_PREVIEW_VIEWBOXES[crop] || CHOICE_PREVIEW_VIEWBOXES.full;
    }

    function collectDisplaySnapshot(root, selector) {
      var nodes = root.querySelectorAll(selector);
      var values = [];
      for (var i = 0; i < nodes.length; i++) values.push(nodes[i].getAttribute('display') || '');
      return values;
    }

    function collectInlineDisplaySnapshot(root, selector) {
      var nodes = root.querySelectorAll(selector);
      var values = [];
      for (var i = 0; i < nodes.length; i++) values.push(nodes[i].style.display || '');
      return values;
    }

    function applyDisplaySnapshot(root, selector, values) {
      var nodes = root.querySelectorAll(selector);
      for (var i = 0; i < nodes.length && i < values.length; i++) {
        if (values[i]) nodes[i].setAttribute('display', values[i]);
        else nodes[i].removeAttribute('display');
      }
    }

    function applyInlineDisplaySnapshot(root, selector, values) {
      var nodes = root.querySelectorAll(selector);
      for (var i = 0; i < nodes.length && i < values.length; i++) {
        nodes[i].style.display = values[i] || '';
      }
    }

    function setSnapshotAttribute(svg, name, value) {
      if (value) svg.setAttribute(name, value);
      else svg.removeAttribute(name);
    }

    function captureChoicePreviewSnapshot() {
      var source = modal.querySelector('.hero-cust-preview [data-gym-hero-svg]');
      if (!source) return null;
      var emblemText = source.querySelector('[data-hero-emblem-text]');
      return {
        source: source,
        styleCssText: source.style.cssText,
        kind: source.getAttribute('data-hero-kind') || '',
        body: source.getAttribute('data-hero-body') || '',
        milestone: source.getAttribute('data-hero-milestone') || '',
        ready: source.getAttribute('data-hero-avatar-ready') || '',
        slots: collectDisplaySnapshot(source, '[data-hero-slot]'),
        kindLayers: collectDisplaySnapshot(source, '[data-hero-kind-layer]'),
        defaultTorsoDisplay: collectInlineDisplaySnapshot(source, '[data-hero-default-torso]'),
        defaultBuckleDisplay: collectInlineDisplaySnapshot(source, '[data-hero-buckle-default]'),
        emblemText: emblemText ? emblemText.textContent : ''
      };
    }

    function applyChoicePreviewSnapshot(svg, snapshot, baseState) {
      if (!snapshot) {
        applyToSvg(svg, baseState);
        return;
      }
      svg.style.cssText = snapshot.styleCssText;
      setSnapshotAttribute(svg, 'data-hero-kind', snapshot.kind);
      setSnapshotAttribute(svg, 'data-hero-body', snapshot.body);
      setSnapshotAttribute(svg, 'data-hero-milestone', snapshot.milestone);
      setSnapshotAttribute(svg, 'data-hero-avatar-ready', snapshot.ready);
      applyDisplaySnapshot(svg, '[data-hero-slot]', snapshot.slots);
      applyDisplaySnapshot(svg, '[data-hero-kind-layer]', snapshot.kindLayers);
      applyInlineDisplaySnapshot(svg, '[data-hero-default-torso]', snapshot.defaultTorsoDisplay);
      applyInlineDisplaySnapshot(svg, '[data-hero-buckle-default]', snapshot.defaultBuckleDisplay);
      var emblemText = svg.querySelector('[data-hero-emblem-text]');
      if (emblemText) emblemText.textContent = snapshot.emblemText;
    }

    function applyChoicePreviewDelta(svg, definition, optionValue, baseState) {
      if (!definition || !definition.key) return;
      if (definition.key === 'heroKind') {
        applyToSvg(svg, choiceState(definition, optionValue, baseState));
        return;
      }
      if (definition.key === 'hairStyle') {
        var accessories = getAccessories(baseState.outfit);
        var compositedAccessories = getCompositedAccessories(accessories);
        var hidesHair = compositedAccessories.some(function (accessory) { return !!HAIR_COVERING_ACCESSORIES[accessory]; });
        var renderedHairStyle = hidesHair ? 'bald' : canonicalChoiceValue('hairStyle', optionValue);
        setSlot(svg, 'hair', renderedHairStyle);
        setSlot(svg, 'hairline', hidesHair ? 'none' : renderedHairStyle);
        setSlot(svg, 'hair-root', hidesHair ? 'none' : renderedHairStyle);
      } else if (definition.key === 'eyebrowStyle') {
        setSlot(svg, 'eyebrow', optionValue);
      } else if (definition.key === 'eyeShape') {
        setSlot(svg, 'eye-shape', canonicalChoiceValue('eyeShape', optionValue));
      } else if (definition.key === 'noseShape') {
        setSlot(svg, 'nose-shape', optionValue);
      } else if (definition.key === 'mouthStyle') {
        setSlot(svg, 'mouth-style', optionValue);
      } else if (definition.key === 'blushStyle') {
        var contrastTokens = avatarContrastTokens(baseState.appearance.skin, baseState.appearance.hairColor);
        svg.style.setProperty('--hero-cheek-opacity', optionValue === 'none' ? '0' : contrastTokens.cheekOpacity);
      } else if (definition.key === 'headStyle') {
        setSlot(svg, 'head-shape', optionValue);
        setSlot(svg, 'face-clear', optionValue);
        setSlot(svg, 'head-features', optionValue);
      } else if (definition.key === 'facialHair') {
        setSlot(svg, 'facial-hair', optionValue);
      } else if (definition.key === 'faceFeature') {
        setSlot(svg, 'face-feature', optionValue);
      } else if (definition.key === 'bodyType') {
        applyBodyTypeToSvg(svg, normalizeHeroKind(baseState.kind) === 'bruin' ? 'athletic' : canonicalChoiceValue('bodyType', optionValue));
      } else if (definition.key === 'outfitStyle') {
        setSlot(svg, 'outfit-style', optionValue);
      }
    }

    function createChoicePreviewSvg(definition, optionValue, baseState, snapshot) {
      var source = snapshot && snapshot.source ? snapshot.source : modal.querySelector('.hero-cust-preview [data-gym-hero-svg]');
      if (!source) return null;
      var svg = source.cloneNode(true);
      var suffix = 'choice-' + definition.key + '-' + optionValue + '-' + (++choicePreviewId);
      svg.querySelectorAll('animate, animateTransform').forEach(function (node) { node.remove(); });
      svg.setAttribute('viewBox', previewViewBox(definition.preview));
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.removeAttribute('data-gym-hero-svg');
      svg.setAttribute('data-hero-choice-svg', '');
      svg.removeAttribute('id');
      uniquifySvgIds(svg, suffix);
      updateChoicePreviewSvg(svg, definition, optionValue, baseState || DEFAULTS, snapshot);
      return svg;
    }

    function updateChoicePreviewSvg(svg, definition, optionValue, baseState, snapshot) {
      var state = cloneAvatarState(baseState || DEFAULTS);
      if (definition.key === 'heroKind') {
        applyToSvg(svg, choiceState(definition, optionValue, state));
        return;
      }
      applyChoicePreviewSnapshot(svg, snapshot || captureChoicePreviewSnapshot(), state);
      applyChoicePreviewDelta(svg, definition, optionValue, state);
    }

    function renderChoicePreview(button, definition, baseState, signature, snapshot) {
      var preview = button.querySelector('.hero-cust-choice-preview');
      if (!preview) return;
      var optionValue = button.getAttribute('data-choice-value');
      var existing = preview.querySelector('[data-hero-choice-svg]');
      if (existing) {
        updateChoicePreviewSvg(existing, definition, optionValue, baseState, snapshot);
        button._heroChoicePreviewRendered = true;
        button._heroChoicePreviewSignature = signature || choicePreviewSignature(definition, optionValue, baseState);
        button._heroChoicePendingSignature = '';
        setChoicePreviewPending(button, false);
        return;
      }
      var svg = createChoicePreviewSvg(definition, optionValue, baseState, snapshot);
      if (!svg) return;
      preview.textContent = '';
      preview.appendChild(svg);
      button._heroChoicePreviewRendered = true;
      button._heroChoicePreviewSignature = signature || choicePreviewSignature(definition, optionValue, baseState);
      button._heroChoicePendingSignature = '';
      setChoicePreviewPending(button, false);
    }

    function syncChoiceControl(control) {
      if (!control || !control.select) return;
      var value = control.select.value;
      var buttons = control.picker ? control.picker.querySelectorAll('[data-choice-value]') : [];
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].setAttribute('aria-pressed', buttons[i].getAttribute('data-choice-value') === value ? 'true' : 'false');
      }
    }

    function syncAllChoiceControls() {
      for (var i = 0; i < choiceControls.length; i++) syncChoiceControl(choiceControls[i]);
    }

    function scheduleChoicePreviewFrame(callback) {
      if (typeof window.requestAnimationFrame === 'function') {
        return window.requestAnimationFrame(callback);
      }
      return window.setTimeout(callback, 16);
    }

    function cancelChoicePreviewFrame(handle) {
      if (!handle) return;
      if (typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(handle);
      } else {
        window.clearTimeout(handle);
      }
    }

    function scheduleChoicePreviewIdle(callback) {
      if (typeof window.requestIdleCallback === 'function') {
        return window.requestIdleCallback(callback, { timeout: 800 });
      }
      return window.setTimeout(function () {
        callback({
          didTimeout: true,
          timeRemaining: function () { return 8; }
        });
      }, 80);
    }

    function cancelChoicePreviewIdle(handle) {
      if (!handle) return;
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    }

    function cancelQueuedChoicePreviewRenders() {
      cancelChoicePreviewFrame(choicePreviewForegroundHandle);
      cancelChoicePreviewIdle(choicePreviewBackgroundHandle);
      choicePreviewForegroundHandle = 0;
      choicePreviewBackgroundHandle = 0;
      choicePreviewForegroundQueue = [];
      choicePreviewBackgroundQueue = [];
    }

    function refreshLatestChoicePreviewContext() {
      latestChoicePreviewState = cloneAvatarState(readForm());
      latestChoicePreviewSnapshot = captureChoicePreviewSnapshot();
      return latestChoicePreviewState;
    }

    function choicePreviewValue(definition, optionValue, baseState, key) {
      if (definition.key === key) return optionValue;
      if (key === 'heroKind') return normalizeHeroKind(baseState.kind);
      if (key === 'hairStyle') return canonicalChoiceValue('hairStyle', baseState.appearance.hairStyle);
      if (key === 'eyebrowStyle') return baseState.appearance.eyebrowStyle;
      if (key === 'eyeShape') return canonicalChoiceValue('eyeShape', baseState.appearance.eyeShape || 'round');
      if (key === 'noseShape') return baseState.appearance.noseShape || 'soft';
      if (key === 'mouthStyle') return baseState.appearance.mouthStyle || 'smile';
      if (key === 'blushStyle') return baseState.appearance.blushStyle || 'natural';
      if (key === 'headStyle') return baseState.appearance.headStyle || 'default';
      if (key === 'facialHair') return baseState.appearance.facialHair || 'none';
      if (key === 'faceFeature') return baseState.appearance.faceFeature || 'none';
      if (key === 'bodyType') return canonicalChoiceValue('bodyType', baseState.body.type);
      if (key === 'outfitStyle') return baseState.outfit.style || DEFAULTS.outfit.style;
      return '';
    }

    function choiceAppearanceSignature(definition, optionValue, baseState) {
      return {
        skin: baseState.appearance.skin,
        hairColor: baseState.appearance.hairColor,
        eyeColor: baseState.appearance.eyeColor,
        hairStyle: choicePreviewValue(definition, optionValue, baseState, 'hairStyle'),
        eyebrowStyle: choicePreviewValue(definition, optionValue, baseState, 'eyebrowStyle'),
        eyeShape: choicePreviewValue(definition, optionValue, baseState, 'eyeShape'),
        noseShape: choicePreviewValue(definition, optionValue, baseState, 'noseShape'),
        mouthStyle: choicePreviewValue(definition, optionValue, baseState, 'mouthStyle'),
        blushStyle: choicePreviewValue(definition, optionValue, baseState, 'blushStyle'),
        headStyle: choicePreviewValue(definition, optionValue, baseState, 'headStyle'),
        facialHair: choicePreviewValue(definition, optionValue, baseState, 'facialHair'),
        faceFeature: choicePreviewValue(definition, optionValue, baseState, 'faceFeature')
      };
    }

    function choicePreviewSignature(definition, optionValue, baseState) {
      if (definition.key === 'heroKind') {
        return JSON.stringify(choiceState(definition, optionValue, baseState));
      }

      var crop = definition.preview || 'full';
      var signature = {
        key: definition.key,
        option: optionValue,
        crop: crop,
        kind: choicePreviewValue(definition, optionValue, baseState, 'heroKind')
      };

      if (FACE_PREVIEW_CROPS[crop]) {
        signature.appearance = choiceAppearanceSignature(definition, optionValue, baseState);
        signature.outfit = {
          capeOuter: baseState.outfit.capeOuter,
          accessories: getAccessories(baseState.outfit)
        };
      } else if (UPPER_PREVIEW_CROPS[crop]) {
        signature.appearance = choiceAppearanceSignature(definition, optionValue, baseState);
        signature.body = {
          type: choicePreviewValue(definition, optionValue, baseState, 'bodyType')
        };
        signature.outfit = {
          style: choicePreviewValue(definition, optionValue, baseState, 'outfitStyle'),
          suit: baseState.outfit.suit,
          capeOuter: baseState.outfit.capeOuter,
          capeInner: baseState.outfit.capeInner,
          accessories: getAccessories(baseState.outfit),
          emblem: baseState.outfit.emblem || ''
        };
      } else {
        signature.state = choiceState(definition, optionValue, baseState);
      }
      return JSON.stringify(signature);
    }

    function setChoicePreviewPending(button, isPending) {
      if (!button) return;
      if (isPending) {
        button.setAttribute('data-choice-pending', 'true');
        button.setAttribute('aria-busy', 'true');
      } else {
        button.removeAttribute('data-choice-pending');
        button.removeAttribute('aria-busy');
      }
    }

    function choicePreviewViewportBox() {
      if (modal.hidden) return null;
      var root = modal.querySelector('.hero-cust-box') || modal;
      return root.getBoundingClientRect();
    }

    function isChoiceButtonInViewportBox(button, rootBox) {
      if (!button || !rootBox || modal.hidden || button.offsetParent === null) return false;
      var box = button.getBoundingClientRect();
      return box.bottom >= rootBox.top && box.top <= rootBox.bottom && box.right >= rootBox.left && box.left <= rootBox.right;
    }

    function processChoicePreviewItem(item, state, token) {
      if (!item || token !== choicePreviewRenderToken) return false;
      if (item.button._heroChoicePreviewSignature === item.signature && item.button.querySelector('[data-hero-choice-svg]')) {
        setChoicePreviewPending(item.button, false);
        return false;
      }
      renderChoicePreview(item.button, item.definition, state, item.signature, item.snapshot);
      return true;
    }

    function renderChoiceButtonPreviewForState(button, definition, state, snapshot) {
      if (!button || !definition || !state) return false;
      var optionValue = button.getAttribute('data-choice-value');
      var signature = choicePreviewSignature(definition, optionValue, state);
      if (button._heroChoicePreviewSignature === signature && button.querySelector('[data-hero-choice-svg]')) {
        setChoicePreviewPending(button, false);
        return false;
      }
      button._heroChoicePendingSignature = signature;
      setChoicePreviewPending(button, true);
      renderChoicePreview(button, definition, state, signature, snapshot);
      return true;
    }

    function renderVisibleChoicePreviewButtons() {
      if (modal.hidden) return;
      var rootBox = choicePreviewViewportBox();
      if (!rootBox) return;
      var state = refreshLatestChoicePreviewContext();
      for (var c = 0; c < choiceControls.length; c++) {
        var control = choiceControls[c];
        if (!control.picker) continue;
        var buttons = control.picker.querySelectorAll('[data-choice-value]');
        for (var b = 0; b < buttons.length; b++) {
          if (isChoiceButtonInViewportBox(buttons[b], rootBox)) {
            renderChoiceButtonPreviewForState(buttons[b], control.definition, state, latestChoicePreviewSnapshot);
          }
        }
      }
    }

    function scheduleVisibleChoicePreviewRefresh() {
      if (choicePreviewScrollHandle) return;
      choicePreviewScrollHandle = scheduleChoicePreviewFrame(function () {
        choicePreviewScrollHandle = 0;
        renderVisibleChoicePreviewButtons();
      });
    }

    function runChoicePreviewQueue(queue, state, token, maxItems, budgetMs) {
      var start = Date.now();
      var rendered = 0;
      while (queue.length && rendered < maxItems && Date.now() - start < budgetMs) {
        var item = queue.shift();
        if (processChoicePreviewItem(item, state, token)) rendered++;
      }
      return queue.length > 0;
    }

    function scheduleForegroundChoicePreviewWork(token, state) {
      if (choicePreviewForegroundHandle) return;
      choicePreviewForegroundHandle = scheduleChoicePreviewFrame(function step() {
        choicePreviewForegroundHandle = 0;
        if (token !== choicePreviewRenderToken) return;
        if (runChoicePreviewQueue(choicePreviewForegroundQueue, state, token, 4, 12)) {
          scheduleForegroundChoicePreviewWork(token, state);
          return;
        }
        scheduleBackgroundChoicePreviewWork(token, state);
      });
    }

    function scheduleBackgroundChoicePreviewWork(token, state) {
      if (choicePreviewBackgroundHandle || choicePreviewForegroundQueue.length) return;
      choicePreviewBackgroundHandle = scheduleChoicePreviewIdle(function step(deadline) {
        choicePreviewBackgroundHandle = 0;
        if (token !== choicePreviewRenderToken) return;
        var budget = deadline && typeof deadline.timeRemaining === 'function'
          ? Math.max(4, Math.min(12, deadline.timeRemaining()))
          : 8;
        if (runChoicePreviewQueue(choicePreviewBackgroundQueue, state, token, 3, budget)) {
          scheduleBackgroundChoicePreviewWork(token, state);
        }
      });
    }

    function observeChoiceButton(button, definition) {
      button._heroChoiceDefinition = definition;
      if (!('IntersectionObserver' in window)) {
        button._heroChoiceInView = true;
        return;
      }
      if (!choicePreviewObserver) {
        choicePreviewObserver = new IntersectionObserver(function (entries) {
          var state = null;
          var snapshot = null;
          for (var i = 0; i < entries.length; i++) {
            var button = entries[i].target;
            button._heroChoiceInView = entries[i].isIntersecting;
            if (!entries[i].isIntersecting) continue;
            if (!state) {
              state = refreshLatestChoicePreviewContext();
              snapshot = latestChoicePreviewSnapshot;
            }
            var definition = button._heroChoiceDefinition;
            renderChoiceButtonPreviewForState(button, definition, state, snapshot);
          }
        }, {
          root: modal.querySelector('.hero-cust-box') || null,
          rootMargin: '48px',
          threshold: 0.01
        });
      }
      choicePreviewObserver.observe(button);
    }

    function queueAllChoicePreviewRenders(baseState) {
      var state = cloneAvatarState(baseState);
      latestChoicePreviewState = state;
      latestChoicePreviewSnapshot = captureChoicePreviewSnapshot();
      var token = ++choicePreviewRenderToken;
      var foreground = [];
      var background = [];
      var renderedBackground = [];
      var queued = [];
      var rootBox = choicePreviewViewportBox();

      cancelQueuedChoicePreviewRenders();

      function add(button, definition) {
        if (!button || queued.indexOf(button) !== -1) return;
        var optionValue = button.getAttribute('data-choice-value');
        var signature = choicePreviewSignature(definition, optionValue, state);
        var hasCurrentPreview = button._heroChoicePreviewSignature === signature && button.querySelector('[data-hero-choice-svg]');
        if (hasCurrentPreview) {
          setChoicePreviewPending(button, false);
          return;
        }
        queued.push(button);
        button._heroChoicePendingSignature = signature;
        setChoicePreviewPending(button, true);
        var item = { button: button, definition: definition, signature: signature, snapshot: latestChoicePreviewSnapshot };
        var hasRenderedPreview = !!button.querySelector('[data-hero-choice-svg]');
        if (button.getAttribute('aria-pressed') === 'true' || button._heroChoiceInView || isChoiceButtonInViewportBox(button, rootBox)) {
          foreground.push(item);
        } else if (hasRenderedPreview) {
          renderedBackground.push(item);
        } else {
          background.push(item);
        }
      }

      for (var c = 0; c < choiceControls.length; c++) {
        var control = choiceControls[c];
        if (!control.picker) continue;
        var buttons = control.picker.querySelectorAll('[data-choice-value]');
        for (var b = 0; b < buttons.length; b++) add(buttons[b], control.definition);
      }

      choicePreviewForegroundQueue = foreground;
      choicePreviewBackgroundQueue = renderedBackground.concat(background);
      scheduleForegroundChoicePreviewWork(token, state);
      scheduleBackgroundChoicePreviewWork(token, state);
    }

    function refreshChoicePreviews(baseState) {
      queueAllChoicePreviewRenders(baseState);
    }

    function buildChoicePicker(select, key, definition) {
      if (!select || !definition || !definition.preview || select._heroChoicePicker) return null;

      var picker = document.createElement('div');
      picker.className = 'hero-cust-choice-picker';
      picker.setAttribute('role', 'group');
      picker.setAttribute('aria-label', definition.label + ' preview choices');
      picker.setAttribute('data-hero-choice-picker', key);
      picker.setAttribute('data-preview-crop', definition.preview);

      for (var g = 0; g < definition.groups.length; g++) {
        var group = definition.groups[g];
        var section = document.createElement('div');
        section.className = 'hero-cust-choice-section';

        if (definition.groups.length > 1) {
          var heading = document.createElement('p');
          heading.className = 'hero-cust-choice-section-title';
          heading.textContent = group.label;
          section.appendChild(heading);
        }

        var grid = document.createElement('div');
        grid.className = 'hero-cust-choice-grid';
        var options = group.options || [];
        for (var i = 0; i < options.length; i++) {
          var option = options[i];
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'hero-cust-choice-button';
          button.setAttribute('data-choice-value', option.value);
          button.setAttribute('aria-pressed', 'false');
          button.setAttribute('aria-label', 'Choose ' + definition.label + ': ' + option.label);

          var preview = document.createElement('span');
          preview.className = 'hero-cust-choice-preview';
          button.appendChild(preview);

          var check = document.createElement('span');
          check.className = 'hero-cust-choice-check';
          check.setAttribute('aria-hidden', 'true');
          button.appendChild(check);

          var label = document.createElement('span');
          label.className = 'hero-cust-choice-label';
          label.textContent = option.label;
          button.appendChild(label);

          button.addEventListener('click', function () {
            select.value = this.getAttribute('data-choice-value');
            select.dispatchEvent(new Event('change', { bubbles: true }));
          });

          grid.appendChild(button);
          observeChoiceButton(button, definition);
        }
        section.appendChild(grid);
        picker.appendChild(section);
      }

      select.insertAdjacentElement('afterend', picker);
      select._heroChoicePicker = picker;
      return picker;
    }

    function initChoiceControls() {
      Object.keys(HERO_CHOICE_SETS).forEach(function (key) {
        var definition = HERO_CHOICE_SETS[key];
        definition.key = key;
        if (definition.multiple) return;
        if (!definition.id) return;
        var select = $(definition.id);
        if (!select) return;
        populateSelectFromChoiceSet(select, key, definition);
        choiceControls.push({
          key: key,
          definition: definition,
          select: select,
          picker: buildChoicePicker(select, key, definition)
        });
      });
      populateAccessoryCheckboxes();
      syncAllChoiceControls();
    }

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
        kind: ($('hero-cust-kind') ? $('hero-cust-kind').value : 'human'),
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
          blushStyle: ($('hero-cust-blush-style') ? $('hero-cust-blush-style').value : 'natural'),
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
      if ($('hero-cust-kind')) $('hero-cust-kind').value = normalizeHeroKind(state.kind);
      $('hero-cust-skin').value = state.appearance.skin;
      $('hero-cust-hair-color').value = state.appearance.hairColor;
      $('hero-cust-hair-style').value = canonicalChoiceValue('hairStyle', state.appearance.hairStyle);
      $('hero-cust-eye-color').value = state.appearance.eyeColor;
      $('hero-cust-eyebrow').value = state.appearance.eyebrowStyle;
      if ($('hero-cust-head-style')) $('hero-cust-head-style').value = state.appearance.headStyle || 'default';
      if ($('hero-cust-eye-shape')) $('hero-cust-eye-shape').value = canonicalChoiceValue('eyeShape', state.appearance.eyeShape || 'round');
      if ($('hero-cust-nose-shape')) $('hero-cust-nose-shape').value = state.appearance.noseShape || 'soft';
      if ($('hero-cust-mouth-style')) $('hero-cust-mouth-style').value = state.appearance.mouthStyle || 'smile';
      if ($('hero-cust-blush-style')) $('hero-cust-blush-style').value = state.appearance.blushStyle || 'natural';
      if ($('hero-cust-facial-hair')) $('hero-cust-facial-hair').value = state.appearance.facialHair || 'none';
      if ($('hero-cust-face-feature')) $('hero-cust-face-feature').value = state.appearance.faceFeature || 'none';
      var bodySelect = $('hero-cust-body-type');
      if (bodySelect && inEnum(state.body.type, 'bodyType')) bodySelect.value = canonicalChoiceValue('bodyType', state.body.type);
      $('hero-cust-outfit-style').value = state.outfit.style || DEFAULTS.outfit.style;
      $('hero-cust-suit').value = state.outfit.suit;
      $('hero-cust-cape-outer').value = state.outfit.capeOuter;
      $('hero-cust-cape-inner').value = state.outfit.capeInner;
      writeAccessoriesForm(state);
      $('hero-cust-emblem').value = state.outfit.emblem;
      resetAllColorHslFromForm();
      syncAllColorTools();
    }

    function applyBruinFormDefaults() {
      if ($('hero-cust-skin')) updateColorInput($('hero-cust-skin'), BRUIN_DEFAULTS.skin, null, true);
      if ($('hero-cust-hair-color')) updateColorInput($('hero-cust-hair-color'), BRUIN_DEFAULTS.hairColor, null, true);
      if ($('hero-cust-eye-color')) updateColorInput($('hero-cust-eye-color'), BRUIN_DEFAULTS.eyeColor, null, true);
      if ($('hero-cust-hair-style')) $('hero-cust-hair-style').value = 'bald';
      if ($('hero-cust-facial-hair')) $('hero-cust-facial-hair').value = 'none';
      if ($('hero-cust-face-feature')) $('hero-cust-face-feature').value = 'none';
      var bodySelect = $('hero-cust-body-type');
      if (bodySelect) bodySelect.value = BRUIN_DEFAULTS.bodyType;
      if ($('hero-cust-outfit-style')) $('hero-cust-outfit-style').value = BRUIN_DEFAULTS.outfitStyle;
      var checkboxes = modal.querySelectorAll('input[name="hero-cust-accessory"]');
      for (var i = 0; i < checkboxes.length; i++) checkboxes[i].checked = false;
    }

    function refreshPreview() {
      var s = readForm();
      var preview = modal.querySelector('[data-gym-hero-svg]');
      if (preview) applyToSvg(preview, s);
      syncAllChoiceControls();
      refreshChoicePreviews(s);
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
      setStatus('');
      modal.hidden = false;
      document.body.classList.add('hero-cust-modal-open');
      modal.classList.add('hero-cust-open');
      refreshPreview();
      var first = $('hero-cust-kind') || $('hero-cust-skin');
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
      var current = readForm();
      var r = randomAvatar(null, current.kind);
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

    initChoiceControls();
    initColorTools();

    var choicePreviewScrollRoot = modal.querySelector('.hero-cust-box');
    if (choicePreviewScrollRoot) choicePreviewScrollRoot.addEventListener('scroll', scheduleVisibleChoicePreviewRefresh, { passive: true });
    window.addEventListener('resize', scheduleVisibleChoicePreviewRefresh);

    modal.querySelectorAll('input[type="color"]').forEach(function (el) {
      el.addEventListener('input', function () {
        resetColorHslFromInput(el);
        syncColorTool(el);
        refreshPreview();
      });
      el.addEventListener('change', function () {
        resetColorHslFromInput(el);
        syncColorTool(el);
        refreshPreview();
      });
    });

    modal.querySelectorAll('select').forEach(function (el) {
      function onSelectChange() {
        if (el.id === 'hero-cust-kind' && el.value === 'bruin') applyBruinFormDefaults();
        refreshPreview();
      }
      el.addEventListener('input', onSelectChange);
      el.addEventListener('change', onSelectChange);
    });

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
