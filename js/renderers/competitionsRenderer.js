/**
 * Competitions Renderer
 * Handles rendering of competitions lists and cards
 */

import { LEAGUE_NAMES_SIMPLE } from '../utils/leagueConfig.js';
import { formatDate } from '../utils/dateUtils.js';

/**
 * Render competitions list
 * @param {Array} competitions - Array of competitions
 * @param {string} elementId - ID of element to render into
 */
export function renderCompetitions(competitions, elementId) {
    const listElement = document.getElementById(elementId);

    if (competitions.length === 0) {
        listElement.innerHTML = '<div class="no-competitions">Ingen konkurranser</div>';
        return;
    }

    listElement.innerHTML = '';
    competitions.forEach(competition => {
        const card = createCompetitionCard(competition);
        listElement.appendChild(card);
    });
}

/**
 * Create competition card
 * @param {Object} competition - Competition data
 * @returns {HTMLElement} Competition card element
 */
export function createCompetitionCard(competition) {
    const card = document.createElement('div');
    card.className = 'competition-card';

    const user = firebase.auth().currentUser;
    const isCreator = user && competition.creatorId === user.uid;

    const leagues = competition.leagues || competition.matchIds || [];
    let leaguesList = '';
    let periodText = '';

    if (competition.competitionType === 'round' && competition.selectedRounds) {
        // Round-based competition
        periodText = '🎯 Rundebasert';

        const parts = [];
        if (competition.selectedRounds?.premierLeague) {
            const rounds = competition.selectedRounds.premierLeague.sort((a, b) => a - b);
            const roundText = rounds.length === 1
                ? `Runde ${rounds[0]}`
                : `Runde ${rounds[0]}-${rounds[rounds.length - 1]}`;
            parts.push(`PL (${roundText})`);
        }

        if (competition.selectedRounds?.championsLeague) {
            const rounds = competition.selectedRounds.championsLeague;
            const roundText = rounds.map(r => r.replace('League Stage - ', 'Runde ').replace('Matchday', 'MD')).join(', ');
            parts.push(`CL (${roundText})`);
        }

        if (competition.selectedRounds?.europaLeague) {
            const rounds = competition.selectedRounds.europaLeague;
            const roundText = rounds.map(r => r.replace('League Stage - ', 'Runde ').replace('Matchday', 'MD')).join(', ');
            parts.push(`EL (${roundText})`);
        }

        leaguesList = parts.join(' + ');

    } else {
        // Date-based competition (or round-based without selectedRounds)
        if (competition.startDate && competition.endDate) {
            const startDate = competition.startDate.toDate();
            const endDate = competition.endDate.toDate();
            periodText = `${formatDate(startDate)} - ${formatDate(endDate)}`;
        } else {
            periodText = 'Ingen datoer satt';
        }

        leaguesList = Array.isArray(leagues) && typeof leagues[0] === 'number'
            ? leagues.map(id => LEAGUE_NAMES_SIMPLE[id] || `Liga ${id}`).join(', ')
            : 'Alle ligaer';
    }

    // Clean up competition name - remove duplicate "League" and format nicely
    let displayName = competition.name;
    displayName = displayName.replace(/League Stage - (\d+)/g, '(Runde $1)');
    displayName = displayName.replace(/Matchday (\d+)/g, '(MD $1)');

    card.innerHTML = `
        <div class="competition-header">
            <h3 class="competition-name">${displayName}</h3>
            ${isCreator ? '<span class="creator-badge">👑 Opprettet av deg</span>' : ''}
        </div>
        <p class="competition-description">${competition.description || 'Ingen beskrivelse'}</p>
        <div class="competition-info">
            <div class="info-item">
                <span class="info-label">📅 Type:</span>
                <span class="info-value">${periodText}</span>
            </div>
            <div class="info-item">
                <span class="info-label">🏆 Ligaer/Runder:</span>
                <span class="info-value">${leaguesList}</span>
            </div>
            <div class="info-item">
                <span class="info-label">👥 Deltakere:</span>
                <span class="info-value">${competition.participants.length} personer</span>
            </div>
        </div>
        <button onclick="viewCompetition('${competition.id}')" class="btn-view-competition">
            Se konkurranse →
        </button>
    `;

    return card;
}
