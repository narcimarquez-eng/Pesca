/**
 * Catálogo de especies, zonas y puntos de referencia de PescaApp.
 *
 * Es JSON incrustado en JavaScript para que funcione también abriendo index.html
 * directamente (file://), donde fetch() no puede leer archivos locales.
 *
 * REVISIÓN DE DATOS (importante):
 * - Las tallas mínimas son REFERENCIAS orientativas. Cuando la fuente no está
 *   confirmada, el campo queda vacío y la app lo indica. La talla aplicable a
 *   pesca recreativa depende de la comunidad autónoma: confírmala siempre.
 * - Pesos, longitudes, profundidades y hábitats son valores orientativos
 *   tomados de fuentes divulgativas (FishBase, FAO). Pueden no ser exactos.
 * - No hay vedas registradas (closedSeasons vacío) porque no se han podido
 *   verificar en esta versión. Para añadirlas, sigue el ejemplo del comentario.
 *
 * Cómo añadir una especie: copia un objeto de `species`, cambia `id` (único,
 * sin espacios), rellena los campos y añade el id a las zonas en `zones`.
 * Cómo añadir una zona: añade un objeto a `zones` y uno o más puntos de
 * referencia en `zoneAnchors` con su `zoneId`.
 */
(function (root) {
  'use strict';

  const PescaApp = (root.PescaApp = root.PescaApp || {});

  PescaApp.speciesData = {
    meta: {
      version: '1.0.0',
      lastReviewed: '2026-10-12',
      disclaimer:
        'Datos orientativos recopilados de fuentes públicas. Pueden no estar actualizados ni ser completos y no sustituyen a la normativa oficial vigente.',
      /** Fuentes citadas por las especies y zonas. */
      sources: [
        'Reglamento (CE) n.º 850/98 del Consejo, anexo XII (tallas mínimas de referencia)',
        'Real Decreto 560/1995 (tallas mínimas; texto consolidado del BOE, anexos I y II)',
        'Real Decreto 1615/2005 (tabla de tallas mediterránea, según fuente consultada)',
        'Real Decreto 347/2011 (pesca marítima de recreo en aguas exteriores)',
        'Reglamento (UE) 2019/1241 (medidas técnicas de pesca)',
        'Reglamento (UE) 2024/491 (medidas técnicas para el besugo, según fuente consultada)',
        'Gobierno Vasco: tallas mínimas y cupos de especies (euskadi.eus)',
        'Comunidad de Madrid: guías de lubina, robalo y corvina, y de salmonete',
        'Junta de Andalucía: tabla de tallas mínimas 2025',
        'Manual de formación pesquera 2025 (según fuente consultada)',
        'FishBase (fishbase.se) y FAO FishFinder: nombres científicos, tallas máximas y hábitat',
      ],
    },

    /**
     * Zonas del catálogo. Cada especie indica en qué zonas aparece.
     * `regulationNote` recuerda qué normativa de referencia se ha usado en la zona.
     */
    zones: [
      {
        id: 'atlantico_norte',
        name: 'Atlántico norte y Cantábrico',
        regions: 'Galicia, Asturias, Cantabria y País Vasco',
        regulationNote:
          'Tallas de referencia: Reglamento (CE) 850/98 (anexo XII) y Real Decreto 560/1995, según fuentes consultadas. Confirma en la normativa de tu comunidad autónoma.',
      },
      {
        id: 'atlantico_sur',
        name: 'Atlántico sur (Golfo de Cádiz)',
        regions: 'Huelva y Cádiz',
        regulationNote:
          'Tallas de referencia: Real Decreto 560/1995 (anexo I, caladero del Golfo de Cádiz) y normativa andaluza. Confirma en la normativa vigente.',
      },
      {
        id: 'mediterraneo',
        name: 'Mediterráneo',
        regions: 'Andalucía mediterránea, Murcia, Comunidad Valenciana, Cataluña y Baleares',
        regulationNote:
          'Tallas de referencia: normativa comunitaria del Mediterráneo y tabla del Real Decreto 1615/2005, según fuente consultada. Confirma con tu comunidad autónoma.',
      },
      {
        id: 'canarias',
        name: 'Canarias',
        regions: 'Islas Canarias',
        regulationNote:
          'Canarias tiene normativa propia de pesca recreativa. Consulta siempre la normativa canaria vigente antes de retener cualquier pieza.',
      },
    ],

    /**
     * Puntos costeros de referencia. La ubicación se asigna a la zona del punto
     * más cercano. Para cubrir una nueva costa, añade puntos con su zoneId.
     */
    zoneAnchors: [
      { zoneId: 'atlantico_norte', name: 'Ribadeo', lat: 43.539, lon: -7.041 },
      { zoneId: 'atlantico_norte', name: 'Ferrol', lat: 43.484, lon: -8.236 },
      { zoneId: 'atlantico_norte', name: 'A Coruña', lat: 43.362, lon: -8.41 },
      { zoneId: 'atlantico_norte', name: 'Finisterre', lat: 42.905, lon: -9.265 },
      { zoneId: 'atlantico_norte', name: 'Vigo', lat: 42.241, lon: -8.721 },
      { zoneId: 'atlantico_norte', name: 'Ribadesella', lat: 43.462, lon: -5.061 },
      { zoneId: 'atlantico_norte', name: 'Gijón', lat: 43.532, lon: -5.661 },
      { zoneId: 'atlantico_norte', name: 'Santander', lat: 43.462, lon: -3.81 },
      { zoneId: 'atlantico_norte', name: 'Bermeo', lat: 43.422, lon: -2.729 },
      { zoneId: 'atlantico_norte', name: 'San Sebastián', lat: 43.318, lon: -1.981 },
      { zoneId: 'atlantico_sur', name: 'Ayamonte', lat: 37.211, lon: -7.4 },
      { zoneId: 'atlantico_sur', name: 'Huelva', lat: 37.2, lon: -6.95 },
      { zoneId: 'atlantico_sur', name: 'Sanlúcar de Barrameda', lat: 36.78, lon: -6.353 },
      { zoneId: 'atlantico_sur', name: 'Cádiz', lat: 36.527, lon: -6.289 },
      { zoneId: 'atlantico_sur', name: 'Algeciras', lat: 36.141, lon: -5.456 },
      { zoneId: 'atlantico_sur', name: 'Tarifa', lat: 36.014, lon: -5.604 },
      { zoneId: 'mediterraneo', name: 'Estepona', lat: 36.426, lon: -5.146 },
      { zoneId: 'mediterraneo', name: 'Málaga', lat: 36.721, lon: -4.421 },
      { zoneId: 'mediterraneo', name: 'Motril', lat: 36.745, lon: -3.519 },
      { zoneId: 'mediterraneo', name: 'Almería', lat: 36.834, lon: -2.464 },
      { zoneId: 'mediterraneo', name: 'Cabo de Gata', lat: 36.717, lon: -2.187 },
      { zoneId: 'mediterraneo', name: 'Cartagena', lat: 37.6, lon: -0.983 },
      { zoneId: 'mediterraneo', name: 'Alicante', lat: 38.345, lon: -0.481 },
      { zoneId: 'mediterraneo', name: 'Valencia', lat: 39.47, lon: -0.376 },
      { zoneId: 'mediterraneo', name: 'Castellón', lat: 39.986, lon: 0.051 },
      { zoneId: 'mediterraneo', name: 'Tarragona', lat: 41.119, lon: 1.245 },
      { zoneId: 'mediterraneo', name: 'Barcelona', lat: 41.385, lon: 2.173 },
      { zoneId: 'mediterraneo', name: 'Blanes (Costa Brava)', lat: 41.675, lon: 2.791 },
      { zoneId: 'mediterraneo', name: 'Roses', lat: 42.261, lon: 3.175 },
      { zoneId: 'mediterraneo', name: 'Ibiza', lat: 38.907, lon: 1.421 },
      { zoneId: 'mediterraneo', name: 'Palma de Mallorca', lat: 39.57, lon: 2.65 },
      { zoneId: 'mediterraneo', name: 'Mahón (Menorca)', lat: 39.889, lon: 4.266 },
      { zoneId: 'canarias', name: 'Lanzarote (Arrecife)', lat: 28.963, lon: -13.55 },
      { zoneId: 'canarias', name: 'Fuerteventura (Morro Jable)', lat: 28.05, lon: -14.38 },
      { zoneId: 'canarias', name: 'Gran Canaria (Las Palmas)', lat: 28.124, lon: -15.436 },
      { zoneId: 'canarias', name: 'Tenerife (Santa Cruz)', lat: 28.464, lon: -16.252 },
      { zoneId: 'canarias', name: 'La Gomera (San Sebastián)', lat: 28.091, lon: -17.114 },
      { zoneId: 'canarias', name: 'La Palma (Santa Cruz)', lat: 28.684, lon: -17.764 },
      { zoneId: 'canarias', name: 'El Hierro (La Restinga)', lat: 27.628, lon: -17.961 },
    ],

    /**
     * Especies. Campos principales:
     * - minSizeCm: talla mínima de referencia por zona (null o ausente = sin dato confirmado).
     * - protected: true si la especie tiene protección o captura restringida.
     * - closedSeasons: vedas. Ejemplo para añadir una:
     *   { zones: ['mediterraneo'], months: [4, 5, 6], reason: 'periodo de freza', source: 'Orden X (BOE)' }
     * - lengthWeight: relación W = a · L^b (opcional). Si no existe, se calibra con
     *   la longitud y el peso máximos, o se usa una aproximación genérica.
     * - alertNote: aviso que se muestra junto a las comprobaciones de la captura.
     */
    species: [
      {
        id: 'lubina',
        commonName: 'Lubina',
        scientificName: 'Dicentrarchus labrax',
        aliases: ['Róbalo', 'Robalo'],
        family: 'Moronidae',
        zones: ['atlantico_norte', 'atlantico_sur', 'mediterraneo'],
        habitat:
          'Costera: fondos rocosos y arenosos, escolleras, rompientes y desembocaduras de ríos y puertos.',
        depthRangeM: [0, 100],
        averageWeightKg: 1.5,
        maxWeightKg: 12,
        maxLengthCm: 103,
        peakMonths: [10, 11, 12, 1, 2, 3],
        peakNote: 'Otoño e invierno en general. En primavera y verano es frecuente en estuarios.',
        baits: [
          'Sardina, jurel o caballa (cebo natural)',
          'Gamba y cangrejo de roca',
          'Señuelos: vinilos, jigs y peces de superficie',
        ],
        techniques: [
          'Spinning desde orilla o escollera',
          'Surfcasting desde playa',
          'Cebo vivo o curricán desde embarcación',
        ],
        minSizeCm: { atlantico_norte: 36, atlantico_sur: 36, mediterraneo: 25 },
        minSizeNote:
          '36 cm en el Atlántico (Reglamento (CE) 850/98, anexo XII, que el Gobierno Vasco indica también para pesca recreativa) y 25 cm en el Mediterráneo (guía de la Comunidad de Madrid).',
        protected: false,
        closedSeasons: [],
        restrictions: 'Respeta los cupos diarios y las tallas de tu comunidad autónoma.',
        sources: [
          'FishBase: Dicentrarchus labrax',
          'Reglamento (CE) 850/98, anexo XII',
          'Comunidad de Madrid: guía de lubina, robalo y corvina',
        ],
      },
      {
        id: 'dorada',
        commonName: 'Dorada',
        scientificName: 'Sparus aurata',
        aliases: ['Dorada de roca'],
        family: 'Sparidae',
        zones: ['atlantico_sur', 'mediterraneo'],
        habitat:
          'Costera: praderas de posidonia, fondos arenosos, puertos y lagunas litorales. Tolera aguas salobres.',
        depthRangeM: [0, 150],
        averageWeightKg: 0.8,
        maxWeightKg: 7,
        maxLengthCm: 70,
        peakMonths: [10, 11, 12, 1, 2, 3],
        peakNote: 'Mayor actividad en otoño e invierno.',
        baits: [
          'Gusano (lombriz) y almeja',
          'Mejillón y cangrejo',
          'Calamar o sardina (cebo natural)',
        ],
        techniques: [
          'Fondo con plomo y cebo natural',
          'Spinning ligero en escolleras y puertos',
        ],
        minSizeCm: { mediterraneo: 20 },
        minSizeNote:
          '20 cm en el Mediterráneo (tabla de tallas del Real Decreto 1615/2005, según fuente consultada). Sin talla de referencia confirmada para el Atlántico.',
        protected: false,
        closedSeasons: [],
        restrictions: 'Confirma cupos y tallas en la normativa de tu comunidad autónoma.',
        sources: [
          'Real Decreto 1615/2005 (tabla mediterránea, según fuente consultada)',
          'FishBase: Sparus aurata',
        ],
      },
      {
        id: 'sargo',
        commonName: 'Sargo',
        scientificName: 'Diplodus sargus',
        aliases: ['Sargo común'],
        family: 'Sparidae',
        zones: ['atlantico_norte', 'atlantico_sur', 'mediterraneo'],
        habitat: 'Costera: zonas rocosas con algas, escolleras, espigones y praderas.',
        depthRangeM: [0, 60],
        averageWeightKg: 0.3,
        maxWeightKg: 1.5,
        maxLengthCm: 45,
        peakMonths: [5, 6, 7, 8, 9, 10],
        peakNote: 'Primavera y verano, con aguas templadas.',
        baits: ['Mejillón, almeja o gusano', 'Cangrejo pequeño', 'Sardina troceada'],
        techniques: [
          'Fondo desde escollera o espigón',
          'Spinning ligero con señuelos pequeños',
        ],
        minSizeCm: { atlantico_norte: 15, atlantico_sur: 15 },
        minSizeNote:
          '15 cm para el sargo (Diplodus spp.) en los caladeros cantábrico, noroeste y Golfo de Cádiz, según el anexo I del Real Decreto 560/1995 (fuente consultada). Sin talla confirmada para el Mediterráneo.',
        protected: false,
        closedSeasons: [],
        restrictions: 'Consulta cupos y tallas en la normativa vigente.',
        sources: [
          'Real Decreto 560/1995, anexo I (Diplodus spp.)',
          'FishBase: Diplodus sargus',
        ],
      },
      {
        id: 'salmonete',
        commonName: 'Salmonete',
        scientificName: 'Mullus surmuletus',
        aliases: ['Salmonete de roca'],
        family: 'Mullidae',
        zones: ['atlantico_norte', 'atlantico_sur', 'mediterraneo'],
        habitat:
          'Fondos arenosos y fangosos cerca de la costa, bordes de roca y zonas con algas.',
        depthRangeM: [10, 150],
        averageWeightKg: 0.2,
        maxWeightKg: 1,
        maxLengthCm: 40,
        peakMonths: [5, 6, 7, 8, 9, 10],
        peakNote: 'Primavera y verano.',
        baits: ['Gusano de arena', 'Gamba o camarón pelado', 'Calamar pequeño'],
        techniques: [
          'Fondo con dos anzuelos y plomo',
          'Pesca desde playa con cebo fresco',
        ],
        minSizeCm: { atlantico_norte: 15, atlantico_sur: 15, mediterraneo: 11 },
        minSizeNote:
          '11 cm en el Mediterráneo y 15 cm en el Atlántico, según las guías consultadas (Comunidad de Madrid y Junta de Andalucía 2025).',
        protected: false,
        closedSeasons: [],
        restrictions: 'Confirma las tallas en la normativa vigente de tu comunidad.',
        sources: [
          'Comunidad de Madrid: guía de salmonete',
          'Junta de Andalucía: tabla de tallas mínimas 2025',
          'FishBase: Mullus surmuletus',
        ],
      },
      {
        id: 'chopa',
        commonName: 'Chopa',
        scientificName: 'Spondyliosoma cantharus',
        aliases: [],
        family: 'Sparidae',
        zones: ['atlantico_sur', 'mediterraneo'],
        habitat:
          'Costera: fondos rocosos y praderas. Suele agruparse cerca de la orilla.',
        depthRangeM: [0, 80],
        averageWeightKg: 0.3,
        maxWeightKg: 1.5,
        maxLengthCm: 50,
        peakMonths: [4, 5, 6, 7, 8, 9],
        peakNote: 'Primavera y verano.',
        baits: ['Gusano y mejillón', 'Cangrejo y gamba'],
        techniques: ['Fondo desde escollera', 'Spinning ligero sobre roca'],
        minSizeCm: {},
        minSizeNote: 'Sin talla de referencia confirmada en las fuentes consultadas.',
        protected: false,
        closedSeasons: [],
        restrictions: 'Consulta cupos y tallas en la normativa vigente.',
        sources: ['FishBase: Spondyliosoma cantharus'],
      },
      {
        id: 'corvina',
        commonName: 'Corvina',
        scientificName: 'Argyrosomus regius',
        aliases: [],
        family: 'Sciaenidae',
        zones: ['atlantico_sur', 'mediterraneo'],
        habitat:
          'Costera: fondos arenosos y de roca, desembocaduras, estuarios y bocanas de bahías en aguas someras.',
        depthRangeM: [0, 100],
        averageWeightKg: 3,
        maxWeightKg: 50,
        maxLengthCm: 200,
        peakMonths: [5, 6, 7, 8, 9, 10],
        peakNote: 'Primavera y verano, con mayor actividad en estuarios y bocanas.',
        baits: [
          'Calamar o sardina (cebo natural)',
          'Gamba y boquerón',
          'Señuelos de fondo y vinilos',
        ],
        techniques: ['Surfcasting con plomo pesado', 'Spinning con vinilos en estuarios'],
        minSizeCm: {},
        minSizeNote:
          'No hay talla de referencia confirmada en las fuentes consultadas.',
        protected: false,
        closedSeasons: [],
        alertNote:
          'La corvina puede tener normativa específica (cupos, tallas o periodos) según la zona. Confírmala antes de retener cualquier pieza.',
        restrictions:
          'Puede tener normativa específica (cupos, tallas o periodos) según la zona. Consulta la normativa vigente antes de retener.',
        sources: [
          'Comunidad de Madrid: guía de lubina, robalo y corvina',
          'FishBase: Argyrosomus regius',
        ],
      },
      {
        id: 'pez-limon',
        commonName: 'Pez limón',
        scientificName: 'Seriola dumerili',
        aliases: ['Medregal', 'Serviola'],
        family: 'Carangidae',
        zones: ['atlantico_sur', 'mediterraneo', 'canarias'],
        habitat:
          'Pelágica: escolleras profundas, bajos y zonas con dispositivos de concentración en aguas cálidas.',
        depthRangeM: [5, 300],
        averageWeightKg: 5,
        maxWeightKg: 60,
        maxLengthCm: 190,
        peakMonths: [6, 7, 8, 9, 10],
        peakNote: 'Verano y comienzos de otoño.',
        baits: ['Señuelos de superficie y jigs metálicos', 'Sardina o caballa vivas'],
        techniques: [
          'Spinning con jig desde embarcación',
          'Cebo vivo desde barco o escollera',
        ],
        minSizeCm: {},
        minSizeNote: 'Sin talla de referencia confirmada en las fuentes consultadas.',
        protected: false,
        closedSeasons: [],
        restrictions:
          'Consulta cupos y tallas en la normativa autonómica. En ejemplares grandes puede acumular más mercurio: modera su consumo.',
        sources: ['FishBase: Seriola dumerili'],
      },
      {
        id: 'bonito',
        commonName: 'Bonito',
        scientificName: 'Sarda sarda',
        aliases: ['Bonito atlántico'],
        family: 'Scombridae',
        zones: ['atlantico_sur', 'mediterraneo', 'canarias'],
        habitat:
          'Pelágica: aguas abiertas y litorales, en cardúmenes cerca de la superficie.',
        depthRangeM: [0, 200],
        averageWeightKg: 1.5,
        maxWeightKg: 10,
        maxLengthCm: 90,
        peakMonths: [6, 7, 8, 9, 10],
        peakNote: 'Verano y otoño.',
        baits: ['Plumas, cucharillas y peces de superficie', 'Sardina o boquerón vivos'],
        techniques: ['Spinning desde barco o escollera', 'Curricán de superficie'],
        minSizeCm: {},
        minSizeNote: 'Sin talla de referencia confirmada en las fuentes consultadas.',
        protected: false,
        closedSeasons: [],
        restrictions:
          'Los túnidos y especies afines pueden tener cupos y normas propias. Consulta la normativa vigente.',
        sources: ['FishBase: Sarda sarda'],
      },
      {
        id: 'mero',
        commonName: 'Mero',
        scientificName: 'Epinephelus marginatus',
        aliases: ['Cherne'],
        family: 'Serranidae',
        zones: ['mediterraneo', 'canarias'],
        habitat: 'Costera: fondos rocosos con cuevas y grietas, en aguas limpias.',
        depthRangeM: [5, 100],
        averageWeightKg: 3,
        maxWeightKg: 50,
        maxLengthCm: 120,
        peakMonths: [],
        peakNote:
          'No procede buscar un periodo de pesca: la especie está sujeta a protección.',
        baits: [],
        techniques: [],
        minSizeCm: {},
        minSizeNote:
          'Sin talla de referencia. La especie está sujeta a protección, así que no debe retenerse.',
        protected: true,
        protectionNote:
          'Especie protegida o de captura restringida en varias zonas (revisión no verificada en esta versión). No debe retenerse: devuélvela con cuidado y consulta la normativa de tu comunidad autónoma.',
        closedSeasons: [],
        restrictions:
          'No retener. Manipúlala con cuidado y devuélvela viva cuando sea posible.',
        sources: ['FishBase: Epinephelus marginatus'],
      },
      {
        id: 'barracuda',
        commonName: 'Barracuda',
        scientificName: 'Sphyraena viridensis',
        aliases: ['Picúo', 'Picudo'],
        family: 'Sphyraenidae',
        zones: ['canarias'],
        habitat:
          'Pelágica costera: cerca de la superficie, bajos, islotes y bordes de escolleras en aguas cálidas.',
        depthRangeM: [0, 80],
        averageWeightKg: 1,
        maxWeightKg: 6,
        maxLengthCm: 75,
        peakMonths: [6, 7, 8, 9, 10],
        peakNote: 'Verano y otoño, con aguas cálidas.',
        baits: ['Señuelos de superficie y cucharillas', 'Sardina viva'],
        techniques: ['Spinning desde costa o embarcación con señuelos rápidos'],
        minSizeCm: {},
        minSizeNote: 'Sin talla de referencia confirmada en las fuentes consultadas.',
        protected: false,
        closedSeasons: [],
        alertNote:
          'Riesgo de ciguatera en ejemplares grandes: no consumas piezas grandes y acude a un profesional sanitario si tienes síntomas tras comerla.',
        restrictions:
          'Riesgo de ciguatera en ejemplares grandes. Evita consumir piezas grandes.',
        sources: ['FishBase: Sphyraena viridensis'],
      },
      {
        id: 'chicharro',
        commonName: 'Chicharro (jurel)',
        scientificName: 'Trachurus trachurus',
        aliases: ['Jurel', 'Chicharro', 'Jurel atlántico'],
        family: 'Carangidae',
        zones: ['atlantico_norte', 'atlantico_sur', 'mediterraneo', 'canarias'],
        habitat:
          'Pelágica costera: cardúmenes en superficie y columna de agua. Muy abundante en verano y otoño.',
        depthRangeM: [0, 200],
        averageWeightKg: 0.3,
        maxWeightKg: 2,
        maxLengthCm: 60,
        peakMonths: [6, 7, 8, 9, 10],
        peakNote: 'Verano y otoño.',
        baits: ['Plumas y cucharillas', 'Gamba o sardina (cebo natural)'],
        techniques: ['Chiqueo o spinning ligero', 'Fondo con plomo corto'],
        minSizeCm: { atlantico_norte: 15, atlantico_sur: 15 },
        minSizeNote:
          'Referencia de 15 cm de la normativa de medidas técnicas de la UE. Dato no verificado en esta versión. En Canarias suele tratarse de Trachurus picturatus, sin talla incluida.',
        protected: false,
        closedSeasons: [],
        restrictions: 'Confirma las tallas en la normativa vigente.',
        sources: [
          'Reglamento (UE) 2019/1241 (medidas técnicas, no verificado)',
          'FishBase: Trachurus trachurus',
        ],
      },
      {
        id: 'caballa',
        commonName: 'Caballa',
        scientificName: 'Scomber scombrus',
        aliases: [],
        family: 'Scombridae',
        zones: ['atlantico_norte', 'atlantico_sur'],
        habitat:
          'Pelágica: forma cardúmenes en superficie y capas altas de la columna de agua.',
        depthRangeM: [0, 200],
        averageWeightKg: 0.4,
        maxWeightKg: 2,
        maxLengthCm: 50,
        peakMonths: [5, 6, 7, 8, 9, 10],
        peakNote: 'Primavera y verano, cuando llega en cardúmenes a la costa.',
        baits: ['Plumas y cucharillas', 'Gusano o sardina (fondo)'],
        techniques: [
          'Chiqueo con plumas (spinning ligero)',
          'Pesca desde barco con cebo vivo',
        ],
        minSizeCm: {},
        minSizeNote:
          'Sin talla de referencia confirmada. La fuente consultada solo describe tolerancias de la normativa profesional.',
        protected: false,
        closedSeasons: [],
        restrictions: 'Revisa los cupos vigentes en la normativa de tu comunidad.',
        sources: ['FishBase: Scomber scombrus'],
      },
      {
        id: 'lenguado',
        commonName: 'Lenguado',
        scientificName: 'Solea solea',
        aliases: ['Lenguado común', 'Lenguado europeo'],
        family: 'Soleidae',
        zones: ['atlantico_norte', 'atlantico_sur', 'mediterraneo'],
        habitat:
          'Fondos arenosos y fangosos, a menudo semienterrado. Playas de arena y zonas someras.',
        depthRangeM: [5, 100],
        averageWeightKg: 0.3,
        maxWeightKg: 3,
        maxLengthCm: 60,
        peakMonths: [4, 5, 6, 7, 8, 9],
        peakNote: 'Primavera y verano.',
        baits: ['Gusano (lombriz) y gamba', 'Calamar o almeja'],
        techniques: ['Fondo con plomo y cebo en arena', 'Surfcasting desde playa'],
        minSizeCm: {},
        minSizeNote:
          'Sin talla de referencia confirmada en las fuentes consultadas.',
        protected: false,
        closedSeasons: [],
        restrictions: 'Consulta la normativa vigente para tallas y cupos.',
        sources: ['FishBase: Solea solea'],
      },
      {
        id: 'congrio',
        commonName: 'Congrio',
        scientificName: 'Conger conger',
        aliases: ['Congrio común'],
        family: 'Congridae',
        zones: ['atlantico_norte', 'atlantico_sur', 'mediterraneo'],
        habitat:
          'Fondos rocosos y tapaderos con grietas donde se refugia. Sobre todo activo de noche.',
        depthRangeM: [10, 400],
        averageWeightKg: 2,
        maxWeightKg: 20,
        maxLengthCm: 150,
        peakMonths: [5, 6, 7, 8, 9, 10],
        peakNote: 'Mayor actividad nocturna en aguas templadas.',
        baits: ['Caballa, jurel o sardina (cebo fuerte)', 'Calamar o pulpo'],
        techniques: [
          'Fondo nocturno con plomo y cebo fresco',
          'Pesca desde escollera o barco',
        ],
        minSizeCm: {},
        minSizeNote: 'Sin talla de referencia confirmada en las fuentes consultadas.',
        protected: false,
        closedSeasons: [],
        restrictions:
          'Tiene una mordedura potente: manipúlalo con cuidado y con herramientas adecuadas.',
        sources: ['FishBase: Conger conger'],
      },
      {
        id: 'besugo',
        commonName: 'Besugo',
        scientificName: 'Pagellus bogaraveo',
        aliases: [],
        family: 'Sparidae',
        zones: ['atlantico_norte', 'atlantico_sur'],
        habitat: 'Fondos profundos y rocosos del talud continental, en aguas frías.',
        depthRangeM: [50, 500],
        averageWeightKg: 1,
        maxWeightKg: 4,
        maxLengthCm: 60,
        peakMonths: [],
        peakNote:
          'No hay un periodo pico confirmado en las fuentes consultadas.',
        baits: ['Calamar o pulpo', 'Sardina o caballa en fondo profundo'],
        techniques: ['Fondo profundo con plomo y bajo de anzuelos múltiples'],
        minSizeCm: {},
        minSizeNote:
          'Sin talla confirmada. El Reglamento (UE) 2024/491 mantiene medidas técnicas específicas para el besugo: consulta el texto vigente.',
        protected: false,
        closedSeasons: [],
        restrictions:
          'Consulta cupos y tallas en la normativa vigente (medidas técnicas específicas).',
        sources: [
          'Reglamento (UE) 2024/491 (según fuente consultada)',
          'FishBase: Pagellus bogaraveo',
        ],
      },
      {
        id: 'san-pedro',
        commonName: 'Pez de San Pedro',
        scientificName: 'Zeus faber',
        aliases: ['San Pedro'],
        family: 'Zeidae',
        zones: ['atlantico_norte', 'atlantico_sur', 'mediterraneo'],
        habitat:
          'Fondos de arena y fango de profundidad media, zonas de talud y bordes de roca.',
        depthRangeM: [20, 300],
        averageWeightKg: 0.5,
        maxWeightKg: 4,
        maxLengthCm: 65,
        peakMonths: [6, 7, 8, 9, 10],
        peakNote: 'Verano y otoño.',
        baits: ['Sardina o boquerón', 'Gamba y calamar'],
        techniques: ['Fondo con plomo y cebo natural', 'Curricán lento de fondo'],
        minSizeCm: {},
        minSizeNote: 'Sin talla de referencia confirmada en las fuentes consultadas.',
        protected: false,
        closedSeasons: [],
        restrictions: 'Consulta cupos y tallas en la normativa vigente.',
        sources: ['FishBase: Zeus faber'],
      },
      {
        id: 'abadejo',
        commonName: 'Abadejo (colín amarillo)',
        scientificName: 'Pollachius pollachius',
        aliases: ['Colín amarillo', 'Colín', 'Pollack'],
        family: 'Gadidae',
        zones: ['atlantico_norte', 'atlantico_sur'],
        habitat: 'Rocas y fondos duros, zonas de corriente y escolleras profundas.',
        depthRangeM: [5, 200],
        averageWeightKg: 1.5,
        maxWeightKg: 15,
        maxLengthCm: 120,
        peakMonths: [9, 10, 11, 12, 1, 2, 3],
        peakNote: 'Otoño e invierno.',
        baits: ['Sardina, jurel o pulpo (cebo natural)', 'Señuelos de superficie y jigs'],
        techniques: [
          'Spinning desde escollera o barco',
          'Curricán de fondo con jigs',
        ],
        minSizeCm: { atlantico_norte: 30, atlantico_sur: 30 },
        minSizeNote:
          '30 cm según un manual de formación pesquera de 2025. La fuente no cita la base legal: verifícalo en la normativa vigente.',
        protected: false,
        closedSeasons: [],
        restrictions: 'Confirma la talla y los cupos en la normativa vigente.',
        sources: [
          'Manual de formación pesquera 2025 (según fuente consultada)',
          'FishBase: Pollachius pollachius',
        ],
      },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
