import React, { createContext, useContext, useMemo } from 'react';

// Diccionario de mensajes
const messages = {
  es: {
    // Comunes
    'common.loading': 'Cargando...',
    'common.back_to_menu': 'VOLVER AL MENÚ',

    // Auth / Landing
    'auth.title': 'NEON SNAKE',
    'auth.login_title': 'INICIAR SESIÓN',
    'auth.register_title': 'CREAR CUENTA',
    'auth.welcome': '¡Bienvenido! Crea tu cuenta para empezar a jugar.',
    'auth.field.username': 'Usuario',
    'auth.field.username_placeholder': 'Elegí tu nombre de usuario',
    'auth.field.email': 'Email',
    'auth.field.email_optional_note': 'Si perdés acceso a tu cuenta, el email te permite recuperarla.',
    'auth.field.password': 'Contraseña',
    'auth.field.password_placeholder': 'Mínimo 6 caracteres',
    'auth.submit.loading': 'CARGANDO...',
    'auth.submit.login': 'ENTRAR',
    'auth.submit.register': '¡CREAR CUENTA Y JUGAR!',
    'auth.toggle.to_register': '¿Primera vez? Creá tu cuenta',
    'auth.toggle.to_login': '¿Ya tenés cuenta? Iniciá sesión',

    // Game Over
    'gameover.title': 'GAME OVER',
    'gameover.level_reached': 'Nivel alcanzado:',
    'gameover.total_xp': 'XP Total:',

    // Victory
    'victory.congrats': '¡FELICITACIONES!',
    'victory.completed_25': '¡Completaste los 25 niveles!',
    'victory.series_prefix': '⚡ Serie',
    'victory.series_suffix': 'Completada ⚡',
    'victory.final_score': 'Tu Puntuación Final',
    'victory.new_record': '✨ ¡NUEVO RÉCORD PERSONAL! ✨',
    'victory.previous_best': 'Tu récord anterior:',
    'victory.world_ranking': 'Ranking Mundial',
    'victory.position_prefix': 'Posición #',
    'victory.improve_title': '¿Querés mejorar tu marca?',
    'victory.rebirth_description': 'Hacé Rebirth para volver a nivel 1',
    'victory.rebirth_advantage_prefix': '✨ Ventaja: Todos los upgrades empiezan en nivel',
    'victory.rebirth_advantage_suffix': '✨',
    'victory.rebirth_button': '♻️ REBIRTH',

    // Leaderboards
    'leaderboard.xp_title': 'RANKING XP',
    'leaderboard.username': 'Usuario',
    'leaderboard.xp': 'XP',
    'leaderboard.rebirth_and_level_title': '🔄⭐ REBIRTH & NIVEL',
    'leaderboard.loading': 'Cargando...',
    'leaderboard.rebirth': 'Rebirth',
    'leaderboard.level': 'Nivel',
    'leaderboard.total': 'Totales',
    'leaderboard.total_xp_title': 'XP TOTAL',
    'leaderboard.total_stars_title': 'ESTRELLAS TOTALES',
    'leaderboard.stars': 'Estrellas',
    'leaderboard.series_title': 'SERIE',
    'leaderboard.series': 'Serie',

    // Game UI (header, menu, shop)
    'game.username': 'Usuario',
    'game.xp_total': 'XP Total',
    'game.stars_total': '⭐ Total',
    'game.level': 'Nivel',
    'game.level_global': 'Nivel Global',
    'game.series': 'Serie',
    'game.play': 'Jugar',
    'game.logout': 'Salir',
    'game.level_progress': 'Progreso Nivel',
    'game.health': 'Vida',
    'game.shop': 'TIENDA',
    'game.shop_cart': '🛒 TIENDA',
    'game.skins': 'SKINS',
    'game.instruction_move': 'Mueve el mouse/trackpad para controlar tu serpiente',
    'game.instruction_eat': 'Come puntos brillantes para ganar XP',
    'game.instruction_stars': '⭐ Recoge estrellas para avanzar de nivel',
    'game.next_level': 'SIGUIENTE NIVEL',
    'game.shop_skins_title': '🎨 TIENDA DE SKINS',
    'game.go_to_shop': 'IR A LA TIENDA',
    'game.buy': 'COMPRAR',
    'game.free': 'GRATIS',
    'game.max': '✓ MAX',
    'game.upgrade_shield': 'ESCUDO',
    'game.upgrade_magnet': 'IMÁN',
    'game.upgrade_cannon': 'CAÑÓN',
    'game.upgrade_speed': 'VELOCIDAD',
    'game.upgrade_health': 'VIDA',
    'game.upgrade_head': 'CABEZA',
    'game.buy_level': 'COMPRAR NIVEL',

    // Level intro
    'level_intro.level': 'NIVEL',
    'level_intro.objective': 'OBJETIVO:',
    'level_intro.collect_prefix': 'Recolecta ',
    'level_intro.collect_suffix': ' estrellas ⭐',
    'level_intro.dangers': 'PELIGROS:',
    'level_intro.tip_label': 'CONSEJO:',
    'level_intro.start': 'COMENZAR',
    'level_intro.title_fallback': 'Nivel',
    'level_intro.tip_fallback': 'Buena suerte!',
    'level_intro.danger_enemy_snakes': 'víboras enemigas',
    'level_intro.danger_map_borders': 'Bordes del mapa',
    'level_intro.danger_structures': 'estructuras',
    'level_intro.danger_find_structures': 'Si buscas XP, encuentra las estructuras',
    'level_intro.danger_structures_xp': 'Las estructuras esconden tesoros de XP',
    'level_intro.danger_no_structures': 'Sin estructuras',
    'level_intro.danger_killer_saws': 'sierras asesinas',
    'level_intro.danger_saws': 'Sierras',
    'level_intro.danger_floating_cannons': 'cañones flotantes',
    'level_intro.danger_cannons': 'Cañones',
    'level_intro.danger_resentful_one': '1 víbora resentida',
    'level_intro.danger_resentful_many': 'víboras resentidas',
    'level_intro.danger_resentful_label': 'VIBORA RESENTIDA',
    'level_intro.danger_shoots_one': 'dispara',
    'level_intro.danger_shoots_many': 'disparan',
    'level_intro.danger_shield_2_3': 'Dos o tres tienen escudo',
    'level_intro.danger_shield_one': 'tiene escudo',
    'level_intro.danger_shield_many': 'tienen escudo',
    'level_intro.danger_faster': 'Enemigos MÁS RÁPIDOS',
    'level_intro.danger_your_speed': 'TU velocidad aumenta',
    'level_intro.danger_giant_map': 'Mapa GIGANTE',
    'level_intro.danger_everything': 'TODO',
    'level_intro.title_1': 'Primeros Pasos', 'level_intro.title_2': 'Calentando', 'level_intro.title_3': 'Nuevos Obstáculos', 'level_intro.title_4': 'Territorio Hostil',
    'level_intro.title_5': 'Zona de Guerra', 'level_intro.title_6': 'Sin Tregua', 'level_intro.title_7': 'Supervivencia', 'level_intro.title_8': 'Último Respiro',
    'level_intro.title_9': 'Sierras Asesinas', 'level_intro.title_10': 'La Resentida', 'level_intro.title_11': 'Infierno', 'level_intro.title_12': 'Sin Escape',
    'level_intro.title_13': 'Velocidad Mortal', 'level_intro.title_14': 'Emboscada', 'level_intro.title_15': 'Campo Abierto', 'level_intro.title_16': 'Fuego Cruzado',
    'level_intro.title_17': 'Tormenta', 'level_intro.title_18': 'Jugador Rápido', 'level_intro.title_19': 'Resistencia', 'level_intro.title_20': 'Elite',
    'level_intro.title_21': 'Veterano', 'level_intro.title_22': 'Enemigos Veloces', 'level_intro.title_23': 'Penúltimo', 'level_intro.title_24': 'La Antesala',
    'level_intro.title_25': 'EL FINAL',
    'level_intro.tip_1': 'Mata enemigos chocando tu cuerpo contra sus cabezas. Cada enemigo muerto deja una estrella dorada.',
    'level_intro.tip_2': 'TIP: Compra el CANON en la tienda! Disparar facilita mucho conseguir estrellas',
    'level_intro.tip_3': 'Cuidado! Algunos enemigos ahora disparan',
    'level_intro.tip_4': 'Los enemigos con escudo brillan azul',
    'level_intro.tip_5': 'Busca las cajas verdes con vida extra',
    'level_intro.tip_6': 'Tu escudo te da chance de esquivar balas',
    'level_intro.tip_7': 'Mejora tu velocidad de bala en la tienda',
    'level_intro.tip_8': 'El imán atrae XP y estrellas hacia ti',
    'level_intro.tip_9': 'Las sierras rebotan por el mapa. Evítalas!',
    'level_intro.tip_10': 'La víbora arcoíris te persigue. Es un duelo!',
    'level_intro.tip_11': 'Los cañones flotantes disparan doble',
    'level_intro.tip_12': 'Las sierras grandes hacen más daño',
    'level_intro.tip_13': 'Los enemigos ahora son más rápidos',
    'level_intro.tip_14': 'Tocar a la resentida la mata y reaparece',
    'level_intro.tip_15': 'Sin estructuras donde esconderte',
    'level_intro.tip_16': 'Las resentidas dejan caja de vida al morir',
    'level_intro.tip_17': 'Dispara con click izquierdo o ESPACIO',
    'level_intro.tip_18': 'Aprovecha tu mayor velocidad',
    'level_intro.tip_19': 'Cada estrella del mismo enemigo cura 1 vez',
    'level_intro.tip_20': 'Las resentidas disparan doble y rápido',
    'level_intro.tip_21': 'Mira el minimapa para ubicar enemigos',
    'level_intro.tip_22': 'Los enemigos ahora corren a tu velocidad',
    'level_intro.tip_23': 'Ya casi! Un nivel más!',
    'level_intro.tip_24': 'Prepara todo para el nivel final',
    'level_intro.tip_25': '100 estrellas. Esto es todo. Buena suerte!',
  },
  en: {
    // Common
    'common.loading': 'Loading...',
    'common.back_to_menu': 'BACK TO MENU',

    // Auth / Landing
    'auth.title': 'NEON SNAKE',
    'auth.login_title': 'LOG IN',
    'auth.register_title': 'CREATE ACCOUNT',
    'auth.welcome': 'Welcome! Create your account to start playing.',
    'auth.field.username': 'Username',
    'auth.field.username_placeholder': 'Choose your username',
    'auth.field.email': 'Email',
    'auth.field.email_optional_note': 'If you lose access to your account, email lets you recover it.',
    'auth.field.password': 'Password',
    'auth.field.password_placeholder': 'At least 6 characters',
    'auth.submit.loading': 'LOADING...',
    'auth.submit.login': 'LOG IN',
    'auth.submit.register': 'CREATE ACCOUNT AND PLAY!',
    'auth.toggle.to_register': 'First time? Create your account',
    'auth.toggle.to_login': 'Already have an account? Log in',

    // Game Over
    'gameover.title': 'GAME OVER',
    'gameover.level_reached': 'Level reached:',
    'gameover.total_xp': 'Total XP:',

    // Victory
    'victory.congrats': 'CONGRATULATIONS!',
    'victory.completed_25': 'You completed all 25 levels!',
    'victory.series_prefix': '⚡ Series',
    'victory.series_suffix': 'Completed ⚡',
    'victory.final_score': 'Your Final Score',
    'victory.new_record': '✨ NEW PERSONAL RECORD! ✨',
    'victory.previous_best': 'Your previous best:',
    'victory.world_ranking': 'World Ranking',
    'victory.position_prefix': 'Position #',
    'victory.improve_title': 'Want to beat your score?',
    'victory.rebirth_description': 'Do a Rebirth to go back to level 1',
    'victory.rebirth_advantage_prefix': '✨ Advantage: All upgrades start at level',
    'victory.rebirth_advantage_suffix': '✨',
    'victory.rebirth_button': '♻️ REBIRTH',

    // Leaderboards
    'leaderboard.xp_title': 'XP RANKING',
    'leaderboard.username': 'User',
    'leaderboard.xp': 'XP',
    'leaderboard.rebirth_and_level_title': '🔄⭐ REBIRTH & LEVEL',
    'leaderboard.loading': 'Loading...',
    'leaderboard.rebirth': 'Rebirth',
    'leaderboard.level': 'Level',
    'leaderboard.total': 'Total',
    'leaderboard.total_xp_title': 'TOTAL XP',
    'leaderboard.total_stars_title': 'TOTAL STARS',
    'leaderboard.stars': 'Stars',
    'leaderboard.series_title': 'SERIES',
    'leaderboard.series': 'Series',

    // Game UI (header, menu, shop)
    'game.username': 'User',
    'game.xp_total': 'Total XP',
    'game.stars_total': '⭐ Total',
    'game.level': 'Level',
    'game.level_global': 'Global Level',
    'game.series': 'Series',
    'game.play': 'Play',
    'game.logout': 'Log out',
    'game.level_progress': 'Level progress',
    'game.health': 'Health',
    'game.shop': 'SHOP',
    'game.shop_cart': '🛒 SHOP',
    'game.skins': 'SKINS',
    'game.instruction_move': 'Move the mouse/trackpad to control your snake',
    'game.instruction_eat': 'Eat glowing points to earn XP',
    'game.instruction_stars': '⭐ Collect stars to advance to the next level',
    'game.next_level': 'NEXT LEVEL',
    'game.shop_skins_title': '🎨 SKIN SHOP',
    'game.go_to_shop': 'GO TO SHOP',
    'game.buy': 'BUY',
    'game.free': 'FREE',
    'game.max': '✓ MAX',
    'game.upgrade_shield': 'SHIELD',
    'game.upgrade_magnet': 'MAGNET',
    'game.upgrade_cannon': 'CANNON',
    'game.upgrade_speed': 'SPEED',
    'game.upgrade_health': 'HEALTH',
    'game.upgrade_head': 'HEAD',
    'game.buy_level': 'BUY LEVEL',

    // Level intro
    'level_intro.level': 'LEVEL',
    'level_intro.objective': 'OBJECTIVE:',
    'level_intro.collect_prefix': 'Collect ',
    'level_intro.collect_suffix': ' stars ⭐',
    'level_intro.dangers': 'DANGERS:',
    'level_intro.tip_label': 'TIP:',
    'level_intro.start': 'START',
    'level_intro.title_fallback': 'Level',
    'level_intro.tip_fallback': 'Good luck!',
    'level_intro.danger_enemy_snakes': 'enemy snakes',
    'level_intro.danger_map_borders': 'Map borders',
    'level_intro.danger_structures': 'structures',
    'level_intro.danger_find_structures': 'If you want XP, find the structures',
    'level_intro.danger_structures_xp': 'Structures hide XP treasures',
    'level_intro.danger_no_structures': 'No structures',
    'level_intro.danger_killer_saws': 'killer saws',
    'level_intro.danger_saws': 'Saws',
    'level_intro.danger_floating_cannons': 'floating cannons',
    'level_intro.danger_cannons': 'Cannons',
    'level_intro.danger_resentful_one': '1 resentful snake',
    'level_intro.danger_resentful_many': 'resentful snakes',
    'level_intro.danger_resentful_label': 'RESENTFUL SNAKE',
    'level_intro.danger_shoots_one': 'shoots',
    'level_intro.danger_shoots_many': 'shoot',
    'level_intro.danger_shield_2_3': 'Two or three have a shield',
    'level_intro.danger_shield_one': 'has a shield',
    'level_intro.danger_shield_many': 'have a shield',
    'level_intro.danger_faster': 'FASTER enemies',
    'level_intro.danger_your_speed': 'YOUR speed increases',
    'level_intro.danger_giant_map': 'GIANT map',
    'level_intro.danger_everything': 'EVERYTHING',
    'level_intro.title_1': 'First Steps', 'level_intro.title_2': 'Warming Up', 'level_intro.title_3': 'New Obstacles', 'level_intro.title_4': 'Hostile Territory',
    'level_intro.title_5': 'War Zone', 'level_intro.title_6': 'No Mercy', 'level_intro.title_7': 'Survival', 'level_intro.title_8': 'Last Breath',
    'level_intro.title_9': 'Killer Saws', 'level_intro.title_10': 'The Resentful', 'level_intro.title_11': 'Hell', 'level_intro.title_12': 'No Escape',
    'level_intro.title_13': 'Deadly Speed', 'level_intro.title_14': 'Ambush', 'level_intro.title_15': 'Open Field', 'level_intro.title_16': 'Crossfire',
    'level_intro.title_17': 'Storm', 'level_intro.title_18': 'Speed Player', 'level_intro.title_19': 'Endurance', 'level_intro.title_20': 'Elite',
    'level_intro.title_21': 'Veteran', 'level_intro.title_22': 'Fast Enemies', 'level_intro.title_23': 'Penultimate', 'level_intro.title_24': 'The Antechamber',
    'level_intro.title_25': 'THE END',
    'level_intro.tip_1': 'Kill enemies by hitting their heads with your body. Each dead enemy drops a golden star.',
    'level_intro.tip_2': 'TIP: Buy the CANNON in the shop! Shooting makes getting stars much easier',
    'level_intro.tip_3': 'Watch out! Some enemies shoot now',
    'level_intro.tip_4': 'Enemies with a shield glow blue',
    'level_intro.tip_5': 'Look for green health boxes',
    'level_intro.tip_6': 'Your shield lets you dodge bullets',
    'level_intro.tip_7': 'Upgrade your bullet speed in the shop',
    'level_intro.tip_8': 'The magnet pulls XP and stars toward you',
    'level_intro.tip_9': 'Saws bounce around the map. Avoid them!',
    'level_intro.tip_10': 'The rainbow snake chases you. It\'s a duel!',
    'level_intro.tip_11': 'Floating cannons shoot double',
    'level_intro.tip_12': 'Big saws deal more damage',
    'level_intro.tip_13': 'Enemies are faster now',
    'level_intro.tip_14': 'Touching the resentful one kills it and it respawns',
    'level_intro.tip_15': 'No structures to hide in',
    'level_intro.tip_16': 'Resentful snakes drop a health box when they die',
    'level_intro.tip_17': 'Shoot with left click or SPACE',
    'level_intro.tip_18': 'Use your higher speed',
    'level_intro.tip_19': 'Each star from the same enemy heals once',
    'level_intro.tip_20': 'Resentful snakes shoot double and fast',
    'level_intro.tip_21': 'Check the minimap to find enemies',
    'level_intro.tip_22': 'Enemies now run at your speed',
    'level_intro.tip_23': 'Almost there! One more level!',
    'level_intro.tip_24': 'Get ready for the final level',
    'level_intro.tip_25': '100 stars. This is it. Good luck!',
  },
};

const LanguageContext = createContext({
  lang: 'en',
  t: (key) => key,
});

const LANG_STORAGE_KEY = 'viborita_lang';

const detectLanguage = () => {
  if (typeof window === 'undefined') return 'en';
  // Preferencia guardada (permite forzar idioma)
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === 'es' || stored === 'en') return stored;
  // Navegador: preferir la primera lengua del usuario (contenido), luego language
  const raw =
    (navigator.languages && navigator.languages[0]) ||
    navigator.language ||
    navigator.userLanguage ||
    'en';
  const lang = String(raw).toLowerCase().split(/[-_]/)[0];
  if (lang === 'es') return 'es';
  return 'en';
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = React.useState(detectLanguage);
  const setLang = useMemo(
    () => (newLang) => {
      if (newLang !== 'es' && newLang !== 'en') return;
      localStorage.setItem(LANG_STORAGE_KEY, newLang);
      setLangState(newLang);
    },
    []
  );

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (key) => {
        const byLang = messages[lang] || messages.en;
        return byLang[key] || messages.en[key] || key;
      },
    }),
    [lang]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
