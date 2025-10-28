/**
 * League Configuration
 * Inneholder alle liga-navn, emojis og metadata
 */

// Liga-navn med emojis (matches preferences.js AVAILABLE_LEAGUES)
export const LEAGUE_NAMES = {
    // International
    1: '🌍 World Cup',
    2: '⭐ Champions League',
    3: '🇪🇺 Europa League',
    4: '🇪🇺 Euro Championship',
    9: '🌎 Copa America',
    11: '🏆 Copa Sudamericana',
    12: '🏆 CAF Champions League',
    13: '🏆 Copa Libertadores',
    14: '🏆 CAF Confederation Cup',
    15: '🌍 FIFA Club World Cup',
    17: '🇨🇳 Super League',
    848: '🇪🇺 Conference League',
    960: '🇪🇺 UEFA Nations League',
    531: '🏆 UEFA Super Cup',

    // England
    39: '⚽ Premier League',
    40: '⚽ Championship',
    41: '⚽ League One',
    42: '⚽ League Two',
    45: '🏆 FA Cup',
    46: '🏆 FA Community Shield',
    48: '🏆 League Cup (EFL Cup)',

    // Spain
    140: '🇪🇸 La Liga',
    141: '🇪🇸 La Liga 2',
    143: '🏆 Copa del Rey',
    556: '🏆 Super Cup (ESP)',

    // Germany
    78: '🇩🇪 Bundesliga',
    79: '🇩🇪 2. Bundesliga',
    80: '🇩🇪 3. Liga',
    81: '🏆 DFB Pokal',
    529: '🏆 Super Cup (GER)',

    // Italy
    135: '🇮🇹 Serie A',
    136: '🇮🇹 Serie B',
    137: '🏆 Coppa Italia',
    547: '🏆 Super Cup (ITA)',

    // France
    61: '🇫🇷 Ligue 1',
    62: '🇫🇷 Ligue 2',
    65: '🏆 Coupe de France',
    66: '🇫🇷 National',
    526: '🏆 Coupe de la Ligue',
    527: '🏆 Trophée des Champions',

    // Netherlands
    88: '🇳🇱 Eredivisie',
    89: '🇳🇱 Eerste Divisie',
    90: '🏆 KNVB Beker',

    // Portugal
    94: '🇵🇹 Primeira Liga',
    95: '🇵🇹 Segunda Liga',
    96: '🏆 Taça de Portugal',
    550: '🏆 Super Cup (POR)',

    // Belgium
    144: '🇧🇪 Jupiler Pro League',
    145: '🇧🇪 Challenger Pro League',

    // Turkey
    203: '🇹🇷 Süper Lig',
    204: '🇹🇷 1. Lig',
    206: '🏆 Turkish Cup',

    // Greece
    197: '🇬🇷 Super League',
    198: '🇬🇷 Super League 2',

    // Russia
    235: '🇷🇺 Premier League',
    236: '🇷🇺 FNL',

    // Ukraine
    333: '🇺🇦 Premier League',

    // Austria
    218: '🇦🇹 Bundesliga',

    // Switzerland
    207: '🇨🇭 Super League',
    208: '🇨🇭 Challenge League',

    // Sweden
    113: '🇸🇪 Allsvenskan',
    114: '🇸🇪 Superettan',

    // Norway
    103: '🇳🇴 Eliteserien',
    104: '🇳🇴 OBOS-ligaen',
    105: '🏆 NM Cupen',

    // Denmark
    119: '🇩🇰 Superliga',
    120: '🇩🇰 1. Division',

    // Finland
    244: '🇫🇮 Veikkausliiga',

    // Poland
    106: '🇵🇱 Ekstraklasa',

    // Czech Republic
    345: '🇨🇿 Czech Liga',

    // Hungary
    271: '🇭🇺 NB I',

    // Romania
    283: '🇷🇴 Liga I',

    // Bulgaria
    172: '🇧🇬 First League',

    // Serbia
    289: '🇷🇸 SuperLiga',

    // Croatia
    210: '🇭🇷 1. HNL',

    // Scotland
    179: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Premiership',
    180: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Championship',

    // Ireland
    357: '🇮🇪 Premier Division',

    // USA
    253: '🇺🇸 MLS',
    254: '🇺🇸 USL Championship',

    // Mexico
    262: '🇲🇽 Liga MX',
    263: '🇲🇽 Liga de Expansión MX',

    // Brazil
    71: '🇧🇷 Série A',
    72: '🇧🇷 Série B',
    73: '🏆 Copa do Brasil',

    // Argentina
    128: '🇦🇷 Liga Profesional',
    129: '🏆 Copa Argentina',

    // Chile
    265: '🇨🇱 Primera División',

    // Colombia
    239: '🇨🇴 Primera A',

    // Japan
    98: '🇯🇵 J1 League',
    99: '🇯🇵 J2 League',

    // South Korea
    292: '🇰🇷 K League 1',

    // Australia
    188: '🇦🇺 A-League',

    // Saudi Arabia
    307: '🇸🇦 Pro League',

    // UAE
    301: '🇦🇪 Pro League',

    // Qatar
    305: '🇶🇦 Stars League',

    // Egypt
    233: '🇪🇬 Premier League',

    // South Africa
    288: '🇿🇦 Premier Division'
};

/**
 * Hent liga-navn for en gitt liga-ID
 * @param {number} leagueId - Liga-ID
 * @returns {string} Liga-navn med emoji
 */
export function getLeagueName(leagueId) {
    return LEAGUE_NAMES[leagueId] || `Liga ${leagueId}`;
}

/**
 * Sjekk om en liga er en internasjonal turnering
 * @param {number} leagueId - Liga-ID
 * @returns {boolean}
 */
export function isInternationalCompetition(leagueId) {
    return [1, 2, 3, 4, 9, 11, 12, 13, 14, 15, 848, 960, 531].includes(leagueId);
}

/**
 * Sjekk om en liga er en cup-turnering
 * @param {number} leagueId - Liga-ID
 * @returns {boolean}
 */
export function isCupCompetition(leagueId) {
    const cupIds = [45, 46, 48, 65, 73, 81, 90, 96, 105, 129, 143, 206, 526, 527, 529, 531, 547, 550, 556];
    return cupIds.includes(leagueId);
}
