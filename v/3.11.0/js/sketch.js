// Minimal sketches: simple vector line art drawn by the app itself.
// Every background shares one look (colors, glow, lettering) chosen in settings, so everything stays on theme.
const Sketch = (() => {
  // Built-in subjects: viewBox size [w, h], strokes, circles, and faint ground/horizon lines.
  const SUBJECTS = {
    // Traced from a public-domain U.S. Army (DVIDS) photo of a CH-47F.
    chinook: {
      name: 'CH-47 Chinook', size: [600, 240], zoom: 1.25, weight: 0.8,
      paths: [
        'M91.5 184.9 L131.6 191.9 L494.6 191.9 L515.5 180.5 C537.3 170.1 560.9 148.3 559.1 131.7 L550.4 117.7 L545.2 58.4 Q544.3 46.2 534.7 45.3 L437.0 47.0 Q430.9 47.9 430.0 54.9 L414.3 105.5 L179.6 96.8 L179.6 77.6 L136.0 60.1 L93.2 60.1 Q87.1 61.0 87.1 67.1 L86.2 103.8 L82.8 105.5 L68.8 131.7 Q57.4 133.4 50.5 137.8 Q40.9 143.9 40.0 157.0 Q40.0 171.8 54.8 177.0 Q72.3 182.3 91.5 184.9 Z',
        'M70.5 130.8 L78.4 109.9 L86.2 108.1 L80.1 133.4 ZM87.1 116.8 L98.5 116.8 L96.7 136.9 L85.4 136.9 ZM100.2 116.8 L109.8 117.7 L107.2 136.9 L98.5 136.9 ZM81.0 140.4 L105.4 140.4 L100.2 162.2 L74.9 162.2 ZM50.5 138.7 L74.0 142.1 M78.4 137.8 L66.2 177.0 M47.0 143.0 Q44.4 157.9 48.7 171.8 M87.1 105.5 L105.4 103.8 L106.3 112.5 L87.1 113.4 Z',
        'M118.5 66.2 H138.6 V76.7 H118.5 Z',
        'M120.3 51.4 H143.0 M130.7 51.4 V60.1 M489.3 36.6 H510.3 M499.8 36.6 V45.3',
        'M146.4 116.0 H183.1 V177.0 H146.4 ZM143.8 180.5 H182.2 V205.0 H143.8 Z',
        'M197.9 191.9 Q196.2 154.4 210.1 153.5 L506.8 156.1',
        'M440.5 100.3 Q442.2 88.1 454.4 88.1 L503.3 89.8 L503.3 114.2 L470.1 117.7 Q445.7 116.0 440.5 100.3 ZM470.1 88.1 V117.7 M503.3 91.5 H526.0 V112.5 H503.3',
        'M423.0 70.6 H431.7 V91.5 H423.0 ZM489.3 45.3 V81.1 H515.5 M515.5 129.9 H522.5 V136.9 H515.5 ZM538.2 135.2 H545.2 V142.1 H538.2 ZM400.3 133.4 H422.1 V143.0 H400.3 Z',
        'M242.4 191.9 V201.5 M266.8 191.9 V210.2 M498.1 191.9 V200.6 M503.3 187.5 H543.4 V198.0 H506.8',
        'M342.8 103.8 V93.3 H358.5 M249.4 100.3 V88.1 M285.2 102.0 V91.5 M139.5 97.7 L207.5 100.3 M327.0 192.8 V199.7 M388.1 192.8 V198.0'
      ],
      rotors: [{ hub: [130.7, 48.8], r: 300, blades: 3 }, { hub: [499.8, 34.8], r: 300, blades: 3, reverse: true }],
      circles: [[130.7,  48.8,  3.5],  [499.8,  34.8,  3.5],  [123.8,  120.3,  3.9],  [156.9,  136.9,  8.7],  [245.0,  136.9,  9.2],  [317.4,  139.5,  8.7],  [384.6,  142.1,  8.4],  [450.1,  143.9,  8.4],  [242.4,  201.5,  11.3],  [242.4,  201.5,  4.4],  [266.8,  210.2,  13.1],  [266.8,  210.2,  4.4],  [498.1,  200.6,  10.5],  [498.1,  200.6,  3.5],  [259.9,  129.1,  2.2]],
      faint: [
        'M179.6 112.5 L414.3 117.7 M218.9 109.0 V153.5 M279.9 110.7 V154.4 M345.4 112.5 V155.2 M410.8 114.2 V156.1 M201.4 171.8 L511.1 175.3 M98.5 178.8 L131.6 180.5 M437.0 74.1 L480.6 72.3 M86.2 102.0 L179.6 96.8 M96.7 67.1 V100.3 M102.8 67.1 V100.3',
        'M-200 223.3 L800 223.3'
      ]
    },
    blackhawk: {
      name: 'UH-60 Black Hawk', size: [600, 240], zoom: 1.4,
      paths: [
        'M70 150 C 70 124, 92 106, 128 100 L 190 94 L 330 92 L 340 104 L 470 124 L 538 120 L 556 62 L 572 62 L 566 132 L 470 148 L 332 160 L 304 170 L 122 172 C 90 170, 70 164, 70 150 Z',
        'M186 94 L200 78 L326 78 L338 94',
        'M84 130 L104 108 L142 104 L142 130 Z',
        'M196 106 H234 V128 H196 Z M246 106 H284 V128 H246 Z',
        'M262 78 V68',
        'M150 172 V192 M466 150 L472 186',
        'M498 144 L560 136 L562 142 L500 150'
      ],
      circles: [[150, 198, 9], [473, 190, 6], [564, 98, 4]],
      rotors: [{hub: [262, 66], r: 250, blades: 4}],
      match: ["black hawk", "blackhawk", "uh 60", "uh60", "helicopter"],
      faint: [
        'M-200 208 L800 208',
        'M538 98 A26 26 0 1 0 590 98 A26 26 0 1 0 538 98 Z',
        'M542 98 H586 M564 76 V120',
        'M182 98 V166 M300 96 V166',
        'M110 112 L120 132',
        'M316 82 L336 92',
        'M90 150 H300',
        'M150 186 H164'
      ]
    },
    abrams: {
      name: 'M1 Abrams tank', size: [600, 230], zoom: 1.45,
      paths: [
        'M112 150 H 498 Q 520 152 510 170 L 490 194 H 142 L 112 172 Q 102 152 112 150 Z',
        'M120 150 L 138 122 L 468 122 L 498 144',
        'M188 122 L 198 94 L 380 90 L 438 100 L 452 122',
        'M438 104 H 588 V 112 H 438',
        'M582 101 V 114',
        'M258 90 V 78 H 290 V 90',
        'M232 92 L 238 84 H 250 V 91'
      ],
      circles: [[160, 182, 13], [210, 182, 13], [260, 182, 13], [310, 182, 13], [360, 182, 13], [410, 182, 13], [460, 182, 13], [124, 166, 12], [500, 164, 12]],
      match: ["abrams", "m1a2", "m1 tank", "tank"],
      faint: [
        'M-200 202 L800 202',
        'M120 160 H 494',
        'M432 98 V 118',
        'M188 102 L 168 106 V 120',
        'M214 92 L 200 36',
        'M300 90 L 320 80 H 340',
        'M140 136 H 466',
        'M150 194 Q 300 198 480 194',
        'M560 104 V 112 M548 104 V 112'
      ]
    },
    cybertruck: {
      name: 'Cybertruck', size: [600, 230],
      paths: [
        'M40 110 L265 40 L560 90 L558 160 L533 160 L517 118 L433 118 L417 160 L185 160 L169 118 L85 118 L69 160 L44 160 L38 140 Z',
        'M160 92 L262 51 L400 71 L400 92 Z',
        'M285 53 V92',
        'M40 110 L64 103'
      ],
      circles: [[127, 163, 41], [475, 163, 41], [127, 163, 27], [475, 163, 27], [127, 163, 7], [475, 163, 7]],
      faint: [
        'M-200 204 L800 204',
        'M285 92 V156 M400 92 V156',
        'M185 150 H417',
        'M400 71 L556 97',
        'M552 92 V104',
        'M312 104 H326 M420 104 H434',
        'M44 132 H76',
        'M44 112 L238 48',
        'M150 103 L138 99 L140 108 Z',
        'M113 150 L141 176 M461 150 L489 176'
      ]
    },
    lightcycle: {
      name: 'Light-cycle', size: [600, 230],
      paths: [
        'M70 148 C 70 96, 104 80, 150 80 L 292 96 C 318 64, 382 58, 424 82 L 462 82 C 526 84, 542 118, 540 148',
        'M206 156 L 404 156',
        'M292 96 L 300 138 L 330 138',
        'M330 76 C 352 68, 386 68, 408 80'
      ],
      circles: [[140, 148, 66], [470, 148, 66], [140, 148, 50], [470, 148, 50], [140, 148, 14], [470, 148, 14]],
      faint: [
        'M-200 214 L800 214',
        'M168 92 L284 106',
        'M432 92 L520 112',
        'M220 140 H390',
        'M-40 120 H40 M-60 140 H30 M-30 160 H50',
        'M100 112 C 120 100, 150 96, 180 100',
        'M520 116 L536 124',
        'M300 120 H330'
      ]
    },
    airliner: {
      name: 'Airliner', size: [600, 220],
      paths: [
        'M150 105 L520 105 C 548 105, 566 118, 573 134 C 568 146, 548 155, 520 155 L190 155 C 150 154, 96 132, 44 117 L48 110 C 70 108, 110 105, 150 105 Z',
        'M150 105 L94 22 L74 22 L56 108',
        'M112 118 L44 112 L50 120 L118 124',
        'M338 150 L246 150 L212 143 L224 141 L320 144',
        'M300 156 L360 156 C 370 156, 372 178, 360 178 L 304 178 C 300 172, 298 162, 300 156 Z',
        'M340 150 L344 156',
        'M532 113 L552 113 L560 120 L536 120 Z',
        'M212 143 L204 126 L210 126 L224 141'
      ],
      circles: [[140, 124, 2.4], [153, 124, 2.4], [166, 124, 2.4], [179, 124, 2.4], [192, 124, 2.4], [205, 124, 2.4], [218, 124, 2.4], [231, 124, 2.4], [244, 124, 2.4], [257, 124, 2.4], [270, 124, 2.4], [283, 124, 2.4], [296, 124, 2.4], [309, 124, 2.4], [322, 124, 2.4], [335, 124, 2.4], [348, 124, 2.4], [361, 124, 2.4], [374, 124, 2.4], [387, 124, 2.4], [400, 124, 2.4], [413, 124, 2.4], [426, 124, 2.4], [439, 124, 2.4], [452, 124, 2.4], [465, 124, 2.4], [478, 124, 2.4], [491, 124, 2.4], [504, 124, 2.4]],
      faint: [
        'M60 136 H558',
        'M512 110 V142 H524 V110 Z',
        'M104 112 V140 H114 V112',
        'M72 34 L92 104',
        'M304 167 H366',
        'M300 156 C 306 160, 306 174, 304 178',
        'M44 117 L40 116',
        'M470 150 V156 M200 150 V156',
        'M540 128 Q 548 126 556 130'
      ]
    },
    monorail: {
      name: 'Monorail', size: [600, 240],
      paths: [
        'M40 166 L40 100 Q 40 90 52 90 L 488 90 C 526 90, 556 108, 570 140 L 572 166 Z',
        'M500 92 C 520 96, 546 110, 558 132 L 520 132 Z',
        'M220 90 V166 M400 90 V166',
        'M64 104 H130 Q 134 104 134 108 V122 Q 134 126 130 126 H64 Q 60 126 60 122 V108 Q 60 104 64 104 Z M156 104 H204 Q 208 104 208 108 V122 Q 208 126 204 126 H156 Q 152 126 152 122 V108 Q 152 104 156 104 Z M244 104 H330 Q 334 104 334 108 V122 Q 334 126 330 126 H244 Q 240 126 240 122 V108 Q 240 104 244 104 Z M356 104 H404 Q 408 104 408 108 V122 Q 408 126 404 126 H356 Q 352 126 352 122 V108 Q 352 104 356 104 Z M430 104 H490 Q 494 104 494 108 V122 Q 494 126 490 126 H430 Q 426 126 426 122 V108 Q 426 104 430 104 Z'
      ],
      circles: [[562, 154, 3]],
      faint: [
        'M-200 158 L800 158',
        'M-200 186 L800 186',
        'M136 186 L140 240 M164 186 L160 240 M436 186 L440 240 M464 186 L460 240',
        'M40 146 H568',
        'M138 100 V156 M150 100 V156 M336 100 V156 M348 100 V156',
        'M50 166 V172 H560 V166',
        'M120 186 H180 M420 186 H480',
        'M500 160 H514',
        'M52 96 V160',
        'M44 120 H56'
      ]
    },
    skyline: {
      name: 'City skyline', size: [600, 230],
      paths: [
        'M0 200 V172 H28 V150 H40 V176 H44 L52 50 H68 L76 176 H80 V128 H104 V112 H118 V160 H140 V120 H156 V104 H166 V140 H172 V118 H180 V96 H188 V78 H194 V58 H197 V40 H203 V58 H206 V78 H212 V96 H220 V118 H228 V140 H236 V110 H256 V150 H270 V122 H286 V86 L290 74 L294 70 L296 58 L298 54 L300 30 L302 54 L304 58 L306 70 L310 74 L314 86 V160 H328 V96 H346 V150 H360 V128 H372 V30 H388 V150 H400 V112 H424 V164 H440 V92 L452 80 L464 92 V170 H482 V126 H506 V150 H520 V108 H544 V180 H566 V140 H586 V176 H600 V200',
        'M60 50 V8',
        'M200 40 V20'
      ],
      circles: [],
      faint: [
        'M-200 200 L800 200',
        'M60 218 H180 M300 218 H470',
        'M44 176 L60 50 L76 176',
        'M292 78 Q 300 66 308 78 M294 66 Q 300 56 306 66',
        'M376 40 V146 M384 40 V146',
        'M374 60 H386 M374 80 H386 M374 100 H386 M374 120 H386',
        'M186 110 V136 M200 104 V136 M214 110 V136',
        'M300 96 V156',
        'M444 104 H460 M444 120 H460 M444 136 H460 M444 152 H460',
        'M524 120 H540 M524 136 H540 M524 152 H540 M524 168 H540',
        'M104 124 H116 M84 140 H100 M84 156 H100',
        'M20 208 H60 M90 212 H150 M200 208 H240 M286 212 H316 M372 208 H392 M440 212 H470 M520 208 H560'
      ]
    },
    castle: {
      name: 'Castle on a cliff', size: [600, 250],
      paths: [
        'M0 228 L110 228 L150 188 L166 150 L470 150 L494 186 L540 228 L600 228',
        'M226 150 V96 L292 60 L358 96 V150',
        'M372 150 V64 L384 22 L396 64 V150',
        'M200 150 V110 L210 84 L220 110 V150',
        'M176 150 V126 H182 V120 H188 V126 H194 V120 H200 V126',
        'M410 150 V108 L420 86 L430 108 V150',
        'M444 150 V124 H450 V118 H456 V124 H462 V118 H468 V150',
        'M384 22 V8 L398 13 L384 18'
      ],
      circles: [[292, 82, 6]],
      faint: [
        'M-200 236 L800 236',
        'M60 246 H150 M310 246 H430',
        'M240 110 V122 M256 110 V122 M272 110 V122 M312 110 V122 M328 110 V122 M344 110 V122',
        'M240 132 V142 M256 132 V142 M272 132 V142 M312 132 V142 M328 132 V142 M344 132 V142',
        'M284 150 V134 Q 292 126 300 134 V150',
        'M384 80 V92 M384 106 V118 M210 118 V128 M420 116 V126',
        'M226 104 H358',
        'M372 64 H396 M200 110 H220 M410 108 H430',
        'M150 200 L178 214 M168 176 L190 196 M478 172 L496 196 M500 206 L520 222',
        'M292 150 L282 188 L300 188',
        'M226 150 H358 M240 96 L292 68 L344 96',
        'M200 84 V76 L210 79 L200 82'
      ]
    },
    drone: {
      name: 'Drone', size: [600, 200], zoom: 1.6,
      paths: [
        'M252 106 Q 300 92 348 106 L 340 126 H 260 Z',
        'M256 110 L186 96 M344 110 L414 96',
        'M176 92 H196 V100 H176 Z M404 92 H424 V100 H404 Z',
        'M186 92 V86 M414 86 V92',
        'M126 86 H246 M354 86 H474',
        'M268 126 L252 164 M332 126 L348 164',
        'M234 164 H270 M330 164 H366',
        'M288 128 H312 V142 H288 Z'
      ],
      circles: [[300, 135, 4], [186, 86, 3], [414, 86, 3]],
      faint: [
        'M134 82 Q 186 76 238 82 M362 82 Q 414 76 466 82',
        'M266 116 H334',
        'M286 104 H314',
        'M256 146 L252 140 M344 146 L348 140',
        'M296 126 V128 M304 126 V128',
        'M296 100 H304',
        'M240 164 V168 M264 164 V168 M336 164 V168 M360 164 V168'
      ]
    },
    fighter: {
      name: 'Fighter jet', size: [600, 250], zoom: 1.35,
      paths: [
        'M300 10 L306 26 L311 44 L314 60 L326 68 L327 108 L382 165 L382 182 L326 200 L322 202 L362 234 L362 244 L320 238 L312 236 L310 242 L290 242 L288 236 L280 238 L238 244 L238 234 L278 202 L274 200 L218 182 L218 165 L273 108 L274 68 L286 60 L289 44 L294 26 L300 10 Z',
        'M300 36 C 307 46, 307 76, 300 90 C 293 76, 293 46, 300 36',
        'M316 170 L330 214 M284 170 L270 214',
        'M292 236 H308'
      ],
      circles: [],
      faint: [
        'M300 94 V230',
        'M314 62 L316 108 M286 62 L284 108',
        'M336 186 L374 176 M264 186 L226 176',
        'M306 120 V170 M294 120 V170',
        'M300 26 V34',
        'M296 52 H304 M294 70 H306',
        'M326 108 L340 124 M274 108 L260 124',
        'M346 238 L356 240 M254 238 L244 240'
      ]
    },
    mountains: {
      name: 'Mountains', size: [600, 230],
      paths: [
        'M0 196 L60 150 L96 120 L118 96 L132 108 L156 74 L172 98 L192 92 L222 30 L236 52 L250 46 L262 66 L272 58 L290 112 L320 128 L360 104 L392 84 L430 70 L462 72 L486 92 L540 140 L600 178',
        'M206 62 L214 70 L222 58 L232 70 L240 60',
        'M148 86 L156 92 L164 84',
        'M402 80 L414 86 L430 76 L446 84 L462 78'
      ],
      circles: [[520, 60, 20]],
      faint: [
        'M0 212 L120 182 L210 198 L330 168 L430 192 L520 170 L600 204',
        'M222 30 L216 90 M236 52 L246 96 M262 66 L268 100 M156 74 L162 110',
        'M430 70 L428 104 M462 72 L470 104',
        'M40 196 L46 184 L52 196 M60 198 L66 184 L72 198 M540 198 L546 186 L552 198 M560 200 L566 188 L572 200',
        'M330 52 Q 335 47 340 52 Q 345 47 350 52',
        'M354 64 Q 358 60 362 64 Q 366 60 370 64',
        'M80 222 H200 M300 222 H420'
      ]
    },
    cruise: {
      name: 'Cruise ship', size: [600, 230],
      paths: [
        'M40 150 L576 146 L552 196 L56 196 L40 172 Z',
        'M56 150 V118 L80 118 V100 L108 100 V82 L136 82 V66 L470 66 C 504 68, 526 84, 540 110 L 556 148',
        'M150 66 L160 34 L196 34 L200 66',
        'M470 66 V56 H520 V66',
        'M96 172 H520',
        'M470 56 L476 40 L484 40 L490 56'
      ],
      circles: [[110, 162, 2.6], [130, 162, 2.6], [150, 162, 2.6], [170, 162, 2.6], [190, 162, 2.6], [210, 162, 2.6], [230, 162, 2.6], [250, 162, 2.6], [270, 162, 2.6], [290, 162, 2.6], [310, 162, 2.6], [330, 162, 2.6], [350, 162, 2.6], [370, 162, 2.6], [390, 162, 2.6], [410, 162, 2.6], [430, 162, 2.6], [450, 162, 2.6], [470, 162, 2.6], [490, 162, 2.6], [510, 162, 2.6]],
      faint: [
        'M-200 206 L800 206',
        'M80 112 H536 M108 96 H526 M136 80 H510',
        'M70 128 H546',
        'M110 140 Q 112 134 120 134 H146 Q 152 134 152 140 Z M180 140 Q 182 134 190 134 H216 Q 222 134 222 140 Z M250 140 Q 252 134 260 134 H286 Q 292 134 292 140 Z M320 140 Q 322 134 330 134 H356 Q 362 134 362 140 Z M390 140 Q 392 134 400 134 H426 Q 432 134 432 140 Z M460 140 Q 462 134 470 134 H496 Q 502 134 502 140 Z',
        'M154 46 H198',
        'M360 66 V50 L372 54 L360 58',
        'M40 216 Q 60 210 80 216 Q 100 222 120 216 M440 216 Q 460 210 480 216 Q 500 222 520 216',
        'M480 74 H528 M486 78 V86 M500 78 V86 M514 78 V86',
        'M476 40 V30 M470 34 H484',
        'M42 150 V172 M576 146 L568 150'
      ]
    }
  };

  // Liveries (looks). "neon" glows in the chosen accent colour; the rest set their own colours.
  // bg is a CSS background (it may include a grid); light = dark lines on a light ground (clock turns dark too).
  const rg = (a, b, c) => `radial-gradient(ellipse at 50% 45%, ${a} 0%, ${b} 62%, ${c || b} 100%)`;
  const G = (a, b, c) => ({ bg: rg(a, b, c), grad: [a, b, c || b] });
  const LOOKS = {
    neon: { name: 'Neon glow on black', glow: true, width: 2.4 },
    dark: { name: 'White on black', glow: false, width: 2, bg: '#000000', stroke: '#f5f5f7', text: '#f5f5f7', light: false },
    light: { name: 'Black on white', glow: false, width: 2, bg: '#f5f5f7', stroke: '#1d1d1f', text: '#1d1d1f', light: true },
    paper: { name: 'Ink on paper', glow: false, width: 2.2, ...G('#fbf6ea', '#f1e8d4', '#e4d8bd'), stroke: '#22201c', text: '#2b2722', light: true },
    vanilla: { name: 'Espresso on vanilla', glow: false, width: 2.2, ...G('#fbefcf', '#f2e0b0', '#e6cf96'), stroke: '#3a2618', text: '#4a3020', light: true },
    sepia: { name: 'Sepia print', glow: false, width: 2.1, ...G('#eedcb6', '#dfc699', '#cdb07e'), stroke: '#4e3218', text: '#5a3a1c', light: true },
    graphite: { name: 'Graphite on stone', glow: false, width: 1.9, ...G('#ecebe7', '#dddbd5', '#cfccc4'), stroke: '#2f3033', text: '#3a3b3e', light: true },
    blueprint: { name: 'Blueprint', glow: false, width: 2, stroke: '#eef6ff', text: '#eef6ff', light: false,
      grid: true, grad: ['#2862ab', '#184782', '#0f3262'],
      bg: 'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 44px 44px, linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 44px 44px, ' + rg('#2862ab', '#184782', '#0f3262') },
    chalk: { name: 'Chalk on slate', glow: false, width: 2.3, ...G('#38483f', '#26312b', '#1b231f'), stroke: '#efeee4', text: '#efeee4', light: false },
    gold: { name: 'Army black and gold', glow: true, width: 2.2, ...G('#1d1a12', '#0b0a08', '#040404'), stroke: '#d9b54a', text: '#ecd27e', light: false },
    od: { name: 'Olive drab', glow: false, width: 2.2, ...G('#4f5b37', '#323c22', '#252d19'), stroke: '#ebe1c1', text: '#ebe1c1', light: false },
    nvg: { name: 'Night vision', glow: true, width: 2.2, ...G('#0d3416', '#04140a', '#010603'), stroke: '#8dff8a', text: '#c9ffc4', light: false },
    warm: { name: 'Low light (warm, easy on the eyes at night)', glow: false, width: 2, ...G('#1d140c', '#0b0805', '#050302'), stroke: '#c8874a', text: '#d9a06a', light: false },
    auto: { name: 'Auto: ink on paper by day, low light at night' },
    mix: { name: 'Mix: each sketch gets its own livery, changing daily' }
  };
  const ACCENTS = {
    blue: { name: 'Electric blue', stroke: '#5cc8ff', text: '#bfe8ff', tint: '#0b1d3a' },
    cyan: { name: 'Cyan', stroke: '#3ff0ff', text: '#c8fbff', tint: '#062a33' },
    violet: { name: 'Violet', stroke: '#b493ff', text: '#e2d6ff', tint: '#1c0f3a' },
    amber: { name: 'Amber', stroke: '#ffbe5c', text: '#ffe6bf', tint: '#2b1a06' },
    mint: { name: 'Mint', stroke: '#5cffb4', text: '#c9ffe6', tint: '#062a1d' },
    red: { name: 'Red', stroke: '#ff5c6c', text: '#ffd0d5', tint: '#2b0710' }
  };

  // Resolve the colours: a sketch's own livery wins over the default look; "auto" follows the time of day.
  function theme(look = {}, sk) {
    let style = sk && LOOKS[sk.livery] ? sk.livery : look.style;
    if (style === 'auto') { const h = new Date().getHours(); style = h >= 7 && h < 19 ? 'paper' : 'warm'; }
    if (style === 'mix') {   // a steady pick per sketch for the day, so a sketch keeps its colours all day
      const pool = ['neon', 'paper', 'vanilla', 'blueprint', 'gold', 'od', 'nvg', 'chalk', 'sepia', 'graphite'];
      const key = sk ? String(sk.subject || '') + String((sk.custom && sk.custom.name) || sk.name || '') : '';
      let hsh = Math.floor(Date.now() / 864e5) * 7; for (const c of key) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
      style = pool[hsh % pool.length];
    }
    const l = LOOKS[style] || LOOKS.neon;
    if (style !== 'neon' && l.stroke) return l;
    const a = ACCENTS[look.accent] || ACCENTS.blue;
    return { ...LOOKS.neon, stroke: a.stroke, text: a.text, light: false, grad: [a.tint, '#050b18', '#010206'],
      bg: `radial-gradient(ellipse at 50% 55%, ${a.tint} 0%, #050b18 55%, #010206 100%)` };
  }

  const PATH_OK = /^[MLHVCSQTAZ0-9.,\s-]+$/;
  const safe = (arr) => (arr || []).filter((d) => typeof d === 'string' && PATH_OK.test(d));
  const num = (x) => typeof x === 'number' && isFinite(x);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cleanText = (t) => String(t || '').replace(/[^\p{L}\p{N} .,'!?&:-]/gu, '').trim().toUpperCase().slice(0, 24);

  // Motion styles shown in settings. "auto" picks per sketch (spinning rotors when it has them, else a gentle float).
  const SPEEDS = { slow: 'Slow', normal: 'Normal', fast: 'Fast' };
  const SPEED_X = { slow: 1.7, normal: 1, fast: 0.55 };
  const MOTIONS = { auto: 'Auto (best for each sketch)', glow: 'Breathing glow', float: 'Gentle float', sweep: 'Light sweep', stars: 'Starfield', off: 'Off' };

  function rng0(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  // Full-screen SVG (1920x1080 frame, scales to fill any screen).
  // sk = { subject, custom?, text? }; look = { style, accent, textPos, animate, motion }.
  function render(sk, look = {}, { thumb = false } = {}) {
    const base = sk.custom || SUBJECTS[sk.subject] || SUBJECTS.cybertruck;
    const subj = { ...base, paths: safe(base.paths), faint: safe(base.faint),
      circles: (base.circles || []).filter((c) => Array.isArray(c) && c.length === 3 && c.every(num)),
      rotors: (Array.isArray(base.rotors) ? base.rotors : []).filter((r) => r && Array.isArray(r.hub) && r.hub.length === 2 && r.hub.every(num) && num(r.r) && r.r > 2 && r.r < 900).slice(0, 4) };
    const size = Array.isArray(subj.size) && subj.size.every(num) ? subj.size : [600, 230];
    const st = theme(look, sk);
    const animate = look.animate !== false && !thumb;
    const [w, h] = size;
    const scale = ((thumb ? 1100 : 760) / w) * (num(subj.zoom) ? subj.zoom : 1);
    const x = 960 - (w / 2) * scale;
    const text = cleanText(sk.text);
    const below = look.textPos === 'below';
    const y = 600 - (h * scale) / 2 + (text ? (below ? -30 : 40) : 0);
    let i = 0;
    const count = subj.faint.length + subj.paths.length + subj.circles.length + subj.rotors.length;
    const step = Math.min(0.35, 3 / Math.max(1, count)); // detailed sketches still finish drawing in ~3-4 s
    const anim = () => (animate ? ` class="d" style="animation-delay:${(0.15 + step * i++).toFixed(2)}s"` : '');
    const drawn = animate ? 0.15 + step * count + 1.8 : 0;          // when the draw-in is finished
    // Per-sketch choices win over the default; Eco mode (look.still) and reduced-motion keep everything still.
    const pick = sk.motion && MOTIONS[sk.motion] ? sk.motion : look.motion;
    let motion = thumb || look.still || reducedMotion() ? 'off' : (MOTIONS[pick] ? pick : 'off');
    if (motion === 'auto') motion = subj.rotors.length ? 'rotors' : 'float';
    const sp = SPEED_X[sk.speed] || SPEED_X[look.speed] || 1;
    const spin = motion !== 'off' && subj.rotors.length > 0;
    // Rotors seen from the side: blades travel around a flat disc (an ellipse), so they sweep realistically.
    const SQ = 0.065, STEPS = 24;
    const rotors = subj.rotors.map((r, n) => {
      const R = r.r, nb = Math.min(Math.max(Math.round(r.blades || 2), 2), 6), dir = r.reverse ? -1 : 1;
      const dur = (1.5 * sp).toFixed(2) + 's', begin = (drawn + n * 0.17).toFixed(2) + 's';
      const pt = (a) => [(R * Math.cos(a)).toFixed(1), (R * SQ * Math.sin(a)).toFixed(1)];
      let blades = '';
      for (let b = 0; b < nb; b++) {
        const a0 = (b / nb) * Math.PI * 2 + 0.35;
        const [x2, y2] = pt(a0);
        let a = '';
        if (spin) {
          const xs = [], ys = [];
          for (let k = 0; k <= STEPS; k++) { const [px, py] = pt(a0 + dir * (k / STEPS) * Math.PI * 2); xs.push(px); ys.push(py); }
          a = `<animate attributeName="x2" values="${xs.join(';')}" dur="${dur}" begin="${begin}" repeatCount="indefinite"/><animate attributeName="y2" values="${ys.join(';')}" dur="${dur}" begin="${begin}" repeatCount="indefinite"/>`;
        }
        blades += `<line x1="0" y1="0" x2="${x2}" y2="${y2}">${a}</line>`;
      }
      const disc = spin ? `<ellipse cx="0" cy="0" rx="${R}" ry="${(R * SQ).toFixed(1)}" opacity=".22"/>` : '';
      return `<g transform="translate(${r.hub[0]} ${r.hub[1]})"${animate ? ` class="t" style="animation-delay:${(0.15 + step * i++).toFixed(2)}s"` : ''}>${disc}${blades}<circle cx="0" cy="0" r="${(R * 0.012 + 1.5).toFixed(1)}"/></g>`;
    }).join('');
    const strokes = [
      ...subj.faint.map((d) => `<path d="${d}" pathLength="1" opacity="${num(subj.weight) ? '.5' : '.28'}"${anim()}/>`),
      ...subj.paths.map((d) => `<path d="${d}" pathLength="1"${anim()}/>`),
      ...subj.circles.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" pathLength="1"${anim()}/>`)
    ].join('') + rotors;
    const glowAnim = motion === 'glow' && st.glow
      ? `<animate attributeName="stdDeviation" values="5;10;5" dur="${(5 * sp).toFixed(1)}s" begin="${drawn.toFixed(2)}s" repeatCount="indefinite"/>` : '';
    const glow = st.glow
      ? `<filter id="g" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="5" result="b">${glowAnim}</feGaussianBlur><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
      : '';
    // Light sweep: a soft band of light that passes across the lines every few seconds.
    const sweepDefs = motion === 'sweep'
      ? `<linearGradient id="swg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="swm" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080"><rect x="-700" y="0" width="560" height="1080" fill="url(#swg)" transform="skewX(-18)"><animate attributeName="x" values="-700;-700;2500" keyTimes="0;.4;1" dur="${(6 * sp).toFixed(1)}s" begin="${drawn.toFixed(2)}s" repeatCount="indefinite"/></rect></mask>`
      : '';
    // Starfield: faint twinkling points, kept away from the drawing.
    let stars = '';
    if (motion === 'stars') {
      const r = rng0(([...(sk.subject || '') + (subj.name || '')].reduce((a2, c) => a2 * 31 + c.charCodeAt(0), 7)));
      for (let n = 0; n < 70; n++) {
        const sx = Math.round(r() * 1920), sy = Math.round(r() * 1080), rad = (0.8 + r() * 1.6).toFixed(1);
        if (sx > x - 60 && sx < x + w * scale + 60 && sy > y - 80 && sy < y + h * scale + 60) continue;
        const d = ((2.5 + r() * 4) * sp).toFixed(1), b = (drawn + r() * 4).toFixed(1);
        stars += `<circle cx="${sx}" cy="${sy}" r="${rad}" fill="${st.text}" opacity=".15"><animate attributeName="opacity" values=".1;.75;.1" dur="${d}s" begin="${b}s" repeatCount="indefinite"/></circle>`;
      }
    }
    const css = `<style>${animate ? `.d{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.8s cubic-bezier(.6,.05,.3,1) forwards}
         .t{opacity:0;animation:fade 1.6s ease forwards;animation-delay:${(0.4 + step * i).toFixed(2)}s}
         @keyframes draw{to{stroke-dashoffset:0}}@keyframes fade{to{opacity:1}}` : ''}
         ${motion === 'float' ? `.fl{animation:fl ${(7 * sp).toFixed(1)}s ease-in-out ${drawn.toFixed(2)}s infinite}@keyframes fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}` : ''}
         @media (prefers-reduced-motion: reduce){.d,.t,.fl{animation:none;stroke-dashoffset:0;opacity:1;transform:none}}</style>`;
    const ty = below ? Math.round(y + h * scale + 120) : Math.round(y - 70);
    const word = text
      ? `<text x="960" y="${ty}" text-anchor="middle" class="${animate ? 't' : ''}" fill="${st.text}"
           font-family="'Segoe UI Variable Display','Segoe UI',system-ui,sans-serif" font-weight="300" font-size="${thumb ? 64 : 44}"
           letter-spacing="26" ${st.glow ? 'filter="url(#g)"' : ''}>${esc(text)}</text>`
      : '';
    const gAttrs = `transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(4)})" fill="none" stroke="${st.stroke}"
         stroke-width="${((thumb ? st.width * 2.6 : st.width) * (num(subj.weight) ? subj.weight : 1) / scale).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round"`;
    const sweepLayer = motion === 'sweep'
      ? `<g mask="url(#swm)"><g ${gAttrs.replace(`stroke="${st.stroke}"`, `stroke="${st.light ? '#000000' : '#ffffff'}"`).replace(/stroke-width="([\d.]+)"/, (m, v) => `stroke-width="${(v * 1.6).toFixed(3)}"`)} opacity="${st.light ? '.55' : '1'}" ${st.glow ? 'filter="url(#g)"' : ''}>${strokes.replace(/ class="d" style="[^"]*"/g, '')}</g></g>`
      : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <defs>${glow}${sweepDefs}</defs>${css}${stars}
      <g class="fl"><g ${gAttrs}
         ${st.glow ? 'filter="url(#g)"' : ''}>${strokes}</g>${sweepLayer}</g>
      ${word}</svg>`;
  }

  const background = (look, sk) => theme(look, sk).bg;

  // A still image of a sketch with its background, for use as a desktop or phone wallpaper (PNG blob).
  async function toImage(sk, look, w, h) {
    const t = theme(look, sk), c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const [a, b, d] = t.grad || [t.bg, t.bg, t.bg];
    g.save(); g.translate(w / 2, h * 0.45); g.scale(1, h / w);
    const R = w * 0.78, rad = g.createRadialGradient(0, 0, 0, 0, 0, R);
    rad.addColorStop(0, a); rad.addColorStop(0.62, b); rad.addColorStop(1, d);
    g.fillStyle = rad; g.fillRect(-w, -w * 2, w * 2, w * 4); g.restore();
    if (t.grid) { g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = Math.max(1, w / 1920); const step = 44 * w / 1920 * (h > w ? 1.6 : 1);
      for (let x = 0; x < w; x += step) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, h); g.stroke(); }
      for (let y = 0; y < h; y += step) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(w, y + .5); g.stroke(); } }
    let svg = render(sk, { ...look, animate: false, motion: 'off' }, {}).replace('width="100%" height="100%"', `width="${w}" height="${h}"`);
    if (h > w) svg = svg.replace('viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice"', 'viewBox="400 0 1120 1080" preserveAspectRatio="xMidYMid meet"');
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      g.drawImage(img, 0, 0, w, h);
    } finally { URL.revokeObjectURL(url); }
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }
  const isLight = (look, sk) => !!theme(look, sk).light;

  // ---------- "Surprise me": new drawings made on this computer, in the same style ----------

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const f = (n) => n.toFixed(1);
  const between = (r, a, b) => a + (b - a) * r();

  const GENERATORS = {
    ridge: { name: 'Mountain range', make(r) {
      const pts = []; let x = 0, up = true;
      pts.push([0, between(r, 175, 200)]);
      while (x < 600) {
        x += between(r, 55, 105);
        pts.push([Math.min(x, 600), up ? between(r, 30, 105) : between(r, 120, 165)]);
        up = !up;
      }
      pts[pts.length - 1][1] = between(r, 170, 200);
      const back = []; x = 0;
      while (x <= 600) { back.push([x, between(r, 150, 205)]); x += between(r, 70, 130); }
      back.push([600, between(r, 170, 205)]);
      const sun = r() < 0.75 ? [[f(between(r, 90, 510)) * 1, f(between(r, 30, 70)) * 1, f(between(r, 14, 26)) * 1]] : [];
      return { size: [600, 230], paths: ['M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L')],
        circles: sun, faint: ['M' + back.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L')] };
    } },
    waves: { name: 'Ocean waves', make(r) {
      const lines = [];
      const rows = 3;
      for (let k = 0; k < rows; k++) {
        const y = 140 + k * 30, amp = between(r, 10, 16) * (1 - k * 0.2), len = between(r, 150, 210);
        let d = `M0 ${f(y)}`;
        for (let x = 0; x < 600; x += len) d += ` Q ${f(x + len / 4)} ${f(y - amp)} ${f(x + len / 2)} ${f(y)} T ${f(Math.min(x + len, 600))} ${f(y)}`;
        lines.push(d);
      }
      const sx = between(r, 180, 420), sr = between(r, 46, 64);
      const sun = `M${f(sx - sr)} 116 A ${f(sr)} ${f(sr)} 0 0 1 ${f(sx + sr)} 116`;
      return { size: [600, 230], paths: [sun, ...lines.slice(0, 2)], circles: [], faint: ['M-200 116 L800 116', ...lines.slice(2)] };
    } },
    city: { name: 'City skyline', make(r) {
      let x = 0, d = `M0 ${f(between(r, 185, 200))}`;
      while (x < 600) {
        const bw = between(r, 22, 48), bh = between(r, 60, 175), top = 200 - bh;
        d += ` H${f(x)} V${f(top)}`;
        if (r() < 0.22) d += ` L${f(x + bw / 2)} ${f(top - between(r, 20, 50))} L${f(x + bw)} ${f(top)}`;
        else d += ` H${f(x + bw)}`;
        x += bw; d += ` V${f(between(r, 185, 200))}`;
      }
      d += ' H600';
      return { size: [600, 230], paths: [d], circles: r() < 0.5 ? [[f(between(r, 60, 540)) * 1, 30, 12]] : [],
        faint: ['M-200 200 L800 200', `M${f(between(r, 40, 120))} 218 H${f(between(r, 180, 260))} M${f(between(r, 320, 380))} 218 H${f(between(r, 460, 540))}`] };
    } },
    stars: { name: 'Constellation', make(r) {
      const n = 6 + Math.floor(r() * 4), pts = [];
      for (let k = 0; k < n; k++) pts.push([between(r, 60 + k * (480 / n), 60 + (k + 1) * (480 / n)), between(r, 30, 200)]);
      const path = 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L');
      const branch = `M${f(pts[2][0])} ${f(pts[2][1])} L${f(between(r, 150, 450))} ${f(between(r, 20, 210))}`;
      const circles = pts.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10, Math.round(between(r, 3, 6) * 10) / 10]);
      return { size: [600, 230], zoom: 1.25, paths: [path, branch], circles, faint: [] };
    } },
    planet: { name: 'Planet', make(r) {
      const cx = 300, cy = 115, R = between(r, 48, 66), rx = R * between(r, 1.7, 2.1), ry = R * between(r, 0.32, 0.45);
      const ring = `M${f(cx - rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(cy)}`;
      const ringBack = `M${f(cx - rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 0 1 ${f(cx + rx)} ${f(cy)}`;
      const mx = between(r, 60, 140) * (r() < 0.5 ? 1 : -1);
      return { size: [600, 230], zoom: 1.6, paths: [ring], circles: [[cx, cy, Math.round(R * 10) / 10], [Math.round((cx + rx + mx * 0.6) * 10) / 10, Math.round(between(r, 30, 200) * 10) / 10, 7]],
        faint: [ringBack] };
    } }
  };

  function generate(kind, seed = Math.floor(Math.random() * 2 ** 31)) {
    const keys = Object.keys(GENERATORS);
    const k = GENERATORS[kind] ? kind : keys[seed % keys.length];
    const g = GENERATORS[k];
    const out = g.make(rng(seed));
    return { id: 'g' + seed.toString(36), name: g.name, kind: k, ...out };
  }

  return { MOTIONS, SPEEDS, SUBJECTS, LOOKS, ACCENTS, GENERATORS, render, background, isLight, generate, cleanText, toImage };
})();
