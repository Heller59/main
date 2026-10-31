export type Locale = 'en' | 'es';

export interface Strings {
  weekdays: string[];
  months: string[];
  calendar: {
    dow: string[];
    prevMonth: string;
    nextMonth: string;
    legendTrash: string;
    legendRecycling: string;
    legendBulk: string;
  };
  kind: {
    trash: string;
    recycling: string;
    bulk: string;
  };
  schedule: {
    putOutBins: (date: string) => string;
    putOutBulk: (date: string) => string;
    bulkDetail: (start: string, end: string) => string;
    zoneSingle: (zone: string) => string;
    zonePair: (a: string, b: string) => string;
  };
  event: {
    today: string;
    tomorrow: string;
    daysAgo: (n: number) => string;
    inDays: (n: number) => string;
    close: string;
  };
  upcoming: {
    comingUpNext: string;
    restOfSchedule: string;
    emptyState: string;
  };
  home: {
    headerSubtitle: (township: string, year: number) => string;
    credit: (source: string) => string;
    remindersOnA11y: string;
    remindersOffA11y: string;
    settingsA11y: string;
  };
  settings: {
    title: string;
    closeA11y: string;
    remindersTitle: string;
    remindersNote: string;
    permissionBlocked: string;
    whenToNotify: string;
    anchorHintBulk: string;
    anchorHintDefault: string;
    leadSameDay: string;
    leadOneDay: string;
    leadNDays: (n: number) => string;
    reminderFootnote: string;
    increaseDays: string;
    decreaseDays: string;
    about: string;
    regularTrashDay: string;
    bulkPickupZone: string;
    recyclingWebSite: string;
    recyclingWebSiteValue: string;
    hoaPortal: string;
    hoaPortalValue: string;
    aboutFootnote: (source: string) => string;
    language: string;
    languageSystem: string;
    languageEnglish: string;
    languageSpanish: string;
  };
  notifications: {
    collectionIs: (date: string) => string;
  };
}

const en: Strings = {
  weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  months: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  calendar: {
    dow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    legendTrash: 'Trash',
    legendRecycling: 'Recycling',
    legendBulk: 'Bulk',
  },
  kind: {
    trash: 'Trash Collection',
    recycling: 'Recycling Collection',
    bulk: 'Bulk Collection',
  },
  schedule: {
    putOutBins: (date) => `Bins out after 6 PM on ${date}.`,
    putOutBulk: (date) => `Bulk items out starting ${date}.`,
    bulkDetail: (start, end) => `Curbside by 6 AM. Crews collect ${start} through ${end}.`,
    zoneSingle: (zone) => `Zone ${zone}`,
    zonePair: (a, b) => `Zones ${a} & ${b}`,
  },
  event: {
    today: 'Today',
    tomorrow: 'Tomorrow',
    daysAgo: (n) => `${n} days ago`,
    inDays: (n) => `in ${n} days`,
    close: 'Close',
  },
  upcoming: {
    comingUpNext: 'Coming up next',
    restOfSchedule: 'Rest of the schedule',
    emptyState: 'No collections left this year. Load next year’s schedule to see more.',
  },
  home: {
    headerSubtitle: (township, year) => `${township} · ${year} schedule`,
    credit: (source) => `Schedule data: ${source}.\nTap a highlighted date for details.`,
    remindersOnA11y: 'Reminders are on. Open settings',
    remindersOffA11y: 'Reminders are off. Open settings',
    settingsA11y: 'Settings',
  },
  settings: {
    title: 'Settings',
    closeA11y: 'Close settings',
    remindersTitle: 'Collection reminders',
    remindersNote: 'Get a notification before each trash, recycling and bulk pickup.',
    permissionBlocked:
      'Notifications are blocked for this app. Tap to open your device settings and allow them.',
    whenToNotify: 'When to notify me',
    anchorHintBulk: 'Before the Monday you can start putting items out',
    anchorHintDefault: 'Before pickup day',
    leadSameDay: 'Same day, at noon',
    leadOneDay: '1 day before, at noon',
    leadNDays: (n) => `${n} days before, at noon`,
    reminderFootnote: 'Every reminder arrives at 12:00 noon on the day you choose.',
    increaseDays: 'Increase days',
    decreaseDays: 'Decrease days',
    about: 'About',
    regularTrashDay: 'Regular trash day',
    bulkPickupZone: 'Bulk pickup zone',
    recyclingWebSite: 'Recycling Web Site',
    recyclingWebSiteValue: 'Burlington County Recycling',
    hoaPortal: 'Orchards at Greentree',
    hoaPortalValue: 'Portal',
    aboutFootnote: (source) =>
      `Dates come from the ${source}. Always defer to the township if the two ever disagree.`,
    language: 'Language',
    languageSystem: 'System',
    languageEnglish: 'English',
    languageSpanish: 'Español',
  },
  notifications: {
    collectionIs: (date) => `Collection is ${date}.`,
  },
};

const es: Strings = {
  weekdays: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  months: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  calendar: {
    dow: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
    prevMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    legendTrash: 'Basura',
    legendRecycling: 'Reciclaje',
    legendBulk: 'Voluminosos',
  },
  kind: {
    trash: 'Recolección de basura',
    recycling: 'Recolección de reciclaje',
    bulk: 'Recolección de voluminosos',
  },
  schedule: {
    putOutBins: (date) => `Botes afuera después de las 6 PM el ${date}.`,
    putOutBulk: (date) => `Artículos voluminosos afuera a partir del ${date}.`,
    bulkDetail: (start, end) =>
      `En la acera antes de las 6 AM. Las cuadrillas recolectan de ${start} a ${end}.`,
    zoneSingle: (zone) => `Zona ${zone}`,
    zonePair: (a, b) => `Zonas ${a} y ${b}`,
  },
  event: {
    today: 'Hoy',
    tomorrow: 'Mañana',
    daysAgo: (n) => `hace ${n} días`,
    inDays: (n) => `en ${n} días`,
    close: 'Cerrar',
  },
  upcoming: {
    comingUpNext: 'Próximamente',
    restOfSchedule: 'Resto del calendario',
    emptyState:
      'No quedan recolecciones este año. Cargue el calendario del próximo año para ver más.',
  },
  home: {
    headerSubtitle: (township, year) => `${township} · Calendario ${year}`,
    credit: (source) =>
      `Datos del calendario: ${source}.\nToque una fecha resaltada para ver los detalles.`,
    remindersOnA11y: 'Los recordatorios están activados. Abrir ajustes',
    remindersOffA11y: 'Los recordatorios están desactivados. Abrir ajustes',
    settingsA11y: 'Ajustes',
  },
  settings: {
    title: 'Ajustes',
    closeA11y: 'Cerrar ajustes',
    remindersTitle: 'Recordatorios de recolección',
    remindersNote:
      'Reciba una notificación antes de cada recolección de basura, reciclaje y voluminosos.',
    permissionBlocked:
      'Las notificaciones están bloqueadas para esta app. Toque para abrir los ajustes del dispositivo y permitirlas.',
    whenToNotify: 'Cuándo notificarme',
    anchorHintBulk: 'Antes del lunes en que puede empezar a sacar los artículos',
    anchorHintDefault: 'Antes del día de recolección',
    leadSameDay: 'El mismo día, al mediodía',
    leadOneDay: '1 día antes, al mediodía',
    leadNDays: (n) => `${n} días antes, al mediodía`,
    reminderFootnote: 'Cada recordatorio llega a las 12:00 del mediodía el día que elija.',
    increaseDays: 'Aumentar días',
    decreaseDays: 'Disminuir días',
    about: 'Acerca de',
    regularTrashDay: 'Día regular de basura',
    bulkPickupZone: 'Zona de recolección de voluminosos',
    recyclingWebSite: 'Sitio web de reciclaje',
    recyclingWebSiteValue: 'Burlington County Recycling',
    hoaPortal: 'Orchards at Greentree',
    hoaPortalValue: 'Portal',
    aboutFootnote: (source) =>
      `Las fechas provienen de ${source}. Siempre priorice la información del municipio si las dos no coinciden.`,
    language: 'Idioma',
    languageSystem: 'Sistema',
    languageEnglish: 'English',
    languageSpanish: 'Español',
  },
  notifications: {
    collectionIs: (date) => `La recolección es ${date}.`,
  },
};

export const translations: Record<Locale, Strings> = { en, es };
