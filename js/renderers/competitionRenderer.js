/**
 * Competition Renderer
 * Handles rendering of competition details, leaderboard, and matches
 */

import { LEAGUE_NAMES_SIMPLE } from '../utils/leagueConfig.js';
import { calculatePoints } from '../utils/matchUtils.js';
import { formatDate } from '../utils/dateUtils.js';

/**
 * Render competition details
 * @param {Object} competition - Competition data
 * @param {boolean} allMatchesCompleted - Whether all matches are completed
 * @param {Array} competitionMatches - All matches in competition
 */
export function renderCompetitionDetails(competition, allMatchesCompleted, competitionMatches) {
    document.getElementById('competitionName').textContent = competition.name;
    document.getElementById('competitionDescription').textContent = competition.description || 'Ingen beskrivelse';
    document.getElementById('creatorName').textContent = competition.creatorName;

    const leagues = competition.leagues || [];
    let leaguesText = '';

    // Display period/rounds based on competition type
    if (competition.competitionType === 'round' && competition.selectedRounds) {
        // Round-based competition
        document.getElementById('competitionPeriod').textContent = '🎯 Rundebasert konkurranse';

        // Build leagues text with rounds
        const parts = [];

        if (competition.selectedRounds?.premierLeague) {
            const rounds = competition.selectedRounds.premierLeague.sort((a, b) => a - b);
            const roundText = rounds.length === 1
                ? `Runde ${rounds[0]}`
                : `Runde ${rounds[0]}-${rounds[rounds.length - 1]}`;
            parts.push(`Premier League (${roundText})`);
        }

        if (competition.selectedRounds?.championsLeague) {
            const rounds = competition.selectedRounds.championsLeague;
            const roundText = rounds.map(r => r.replace('League Stage - ', '').replace('Matchday', 'MD')).join(', ');
            parts.push(`Champions League (${roundText})`);
        }

        leaguesText = parts.join(' + ');

    } else {
        // Date-based competition (or round-based without selectedRounds)
        if (competition.startDate && competition.endDate) {
            const startDate = competition.startDate.toDate();
            const endDate = competition.endDate.toDate();
            document.getElementById('competitionPeriod').textContent =
                `${formatDate(startDate)} - ${formatDate(endDate)}`;
        } else {
            document.getElementById('competitionPeriod').textContent = 'Ingen datoer satt';
        }

        leaguesText = leagues.map(id => LEAGUE_NAMES_SIMPLE[id] || `Liga ${id}`).join(', ') || 'Alle ligaer';
    }

    document.getElementById('matchCount').textContent = leaguesText;
    document.getElementById('participantCount').textContent = `${competition.participants.length} deltakere`;

    // Determine status
    const now = new Date();
    let startDate, endDate;

    if (competition.competitionType === 'round' || competition.competitionType === 'custom') {
        // For round-based or custom, determine start/end from matches
        if (competitionMatches.length > 0) {
            const dates = competitionMatches.map(m => new Date(m.commence_time || m.date));
            startDate = new Date(Math.min(...dates));
            endDate = new Date(Math.max(...dates));
        } else {
            startDate = now;
            endDate = now;
        }
    } else if (competition.startDate && competition.endDate) {
        // Date-based competition with explicit start/end dates
        startDate = competition.startDate.toDate();
        endDate = competition.endDate.toDate();
    } else {
        // Fallback - use current date
        startDate = now;
        endDate = now;
    }

    let status = 'upcoming';
    let statusText = '📅 Kommende';
    let statusClass = 'status-upcoming';

    // Determine status based on start date and match completion
    if (now < startDate) {
        // Competition hasn't started yet
        status = 'upcoming';
        statusText = '⏰ Kommende';
        statusClass = 'status-upcoming';
    } else if (allMatchesCompleted === true) {
        // All matches are completed - competition is finished
        status = 'completed';
        statusText = '✅ Fullført';
        statusClass = 'status-completed';
    } else {
        // Competition has started but not all matches are completed
        status = 'active';
        statusText = '🔴 Aktiv';
        statusClass = 'status-active';
    }

    const statusBadge = document.getElementById('competitionStatus');
    statusBadge.textContent = statusText;
    statusBadge.className = `competition-status-badge ${statusClass}`;

    // Show join button if user is not a participant
    const user = firebase.auth().currentUser;
    const isParticipant = user && competition.participants.includes(user.uid);
    const joinBtn = document.getElementById('joinBtn');

    if (user && !isParticipant && status !== 'completed') {
        joinBtn.style.display = 'inline-block';
    } else {
        joinBtn.style.display = 'none';
    }

    // Show/hide share button based on competition status
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        if (status === 'completed') {
            shareBtn.style.display = 'none';
        } else {
            shareBtn.style.display = 'inline-block';
        }
    }

    // Show delete button only for creator
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        const isCreator = user && competition.creatorId === user.uid;

        if (isCreator) {
            deleteBtn.style.display = 'inline-block';
        } else {
            deleteBtn.style.display = 'none';
        }
    }
}

/**
 * Render leaderboard
 * @param {Array} participants - Array of participants with points
 * @param {Array} competitionMatches - All matches in competition
 */
export function renderLeaderboard(participants, competitionMatches) {
    const leaderboardList = document.getElementById('leaderboardList');

    if (participants.length === 0) {
        leaderboardList.innerHTML = '<div class="no-participants">Ingen deltakere ennå</div>';
        return;
    }

    leaderboardList.innerHTML = '';

    participants.forEach((participant, index) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';

        const user = firebase.auth().currentUser;
        if (user && participant.userId === user.uid) {
            row.classList.add('current-user');
        }

        let positionEmoji = `${index + 1}.`;
        if (index === 0) positionEmoji = '🥇';
        else if (index === 1) positionEmoji = '🥈';
        else if (index === 2) positionEmoji = '🥉';

        // Check if at least one match has started or is completed
        const now = new Date();
        const anyMatchStarted = competitionMatches.some(match => {
            const matchDate = new Date(match.commence_time || match.date);
            return matchDate <= now;
        });

        // Make name clickable only if at least one match has started
        const nameStyle = anyMatchStarted ? 'cursor: pointer;' : 'cursor: default; opacity: 0.7;';
        const nameOnClick = anyMatchStarted ? `onclick="showUserTips('${participant.userId}', '${participant.userName.replace(/'/g, "\\'")}')"` : '';

        row.innerHTML = `
            <div class="leaderboard-position">${positionEmoji}</div>
            <div class="leaderboard-name" style="${nameStyle}" ${nameOnClick}>
                ${participant.userName}
            </div>
            <div class="leaderboard-score">${participant.totalPoints.toFixed(2)}</div>
        `;

        leaderboardList.appendChild(row);
    });
}

/**
 * Render competition matches
 * @param {Array} matches - Array of matches
 * @param {Array} userTips - User's tips
 * @param {Function} calculateMatchPoints - Function to calculate points
 * @param {Object} footballApi - API service for team logos
 */
export function renderCompetitionMatches(matches, userTips, calculateMatchPoints, footballApi) {
    const matchesList = document.getElementById('competitionMatchesList');
    matchesList.innerHTML = '';

    if (matches.length === 0) {
        matchesList.innerHTML = '<div class="no-matches">Ingen kamper funnet for denne konkurransen</div>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group by date with relative labels
    const matchesByDate = {};
    matches.forEach(match => {
        const matchDate = new Date(match.commence_time || match.date);
        matchDate.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor((matchDate - today) / (1000 * 60 * 60 * 24));

        let dateLabel;
        if (daysDiff === 0) {
            dateLabel = 'I dag';
        } else if (daysDiff === 1) {
            dateLabel = 'I morgen';
        } else if (daysDiff === -1) {
            dateLabel = 'I går';
        } else if (daysDiff < -1 && daysDiff > -7) {
            // Last week
            const weekday = matchDate.toLocaleDateString('nb-NO', { weekday: 'long' });
            dateLabel = weekday.charAt(0).toUpperCase() + weekday.slice(1);
        } else {
            // Format: "Fredag, 17. oktober"
            const weekday = matchDate.toLocaleDateString('nb-NO', { weekday: 'long' });
            const day = matchDate.getDate();
            const month = matchDate.toLocaleDateString('nb-NO', { month: 'long' });
            dateLabel = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day}. ${month}`;
        }

        if (!matchesByDate[dateLabel]) {
            matchesByDate[dateLabel] = { date: matchDate, matches: [] };
        }
        matchesByDate[dateLabel].matches.push(match);
    });

    // Sort by actual date
    const sortedDates = Object.keys(matchesByDate).sort((a, b) => {
        return matchesByDate[a].date - matchesByDate[b].date;
    });

    sortedDates.forEach(dateLabel => {
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.textContent = dateLabel;
        matchesList.appendChild(dateHeader);

        matchesByDate[dateLabel].matches.forEach(match => {
            const card = createCompetitionMatchCard(match, userTips, calculateMatchPoints, footballApi);
            matchesList.appendChild(card);
        });
    });
}

/**
 * Create competition match card
 * @param {Object} match - Match data
 * @param {Array} userTips - User's tips
 * @param {Function} calculateMatchPoints - Function to calculate points
 * @param {Object} footballApi - API service for team logos
 * @returns {HTMLElement} Match card element
 */
export function createCompetitionMatchCard(match, userTips, calculateMatchPoints, footballApi) {
    const card = document.createElement('div');
    card.className = 'competition-match-card';

    const userTip = userTips.find(tip => String(tip.matchId) === String(match.id));
    const hasTip = !!userTip;

    if (hasTip) {
        card.classList.add('has-tip');
    }

    const time = new Date(match.commence_time || match.date).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
    const homeLogo = match.homeLogo || footballApi.getTeamLogo(match.homeTeam);
    const awayLogo = match.awayLogo || footballApi.getTeamLogo(match.awayTeam);

    let resultDisplay = '';
    let statusDisplay = `<span class="match-time">${time}</span>`;

    if (match.result) {
        resultDisplay = `
            <div class="match-result-display">
                <span class="result-score">${match.result.home} - ${match.result.away}</span>
                ${match.completed ? '<span class="result-status">✅ Fullført</span>' : '<span class="result-status live">🔴 Live</span>'}
            </div>
        `;
    }

    let tipDisplay = '';
    if (hasTip) {
        let points = 0;
        // Calculate points for both live and completed matches (if result exists)
        if (match.result && match.result.home !== null && match.result.away !== null) {
            points = calculateMatchPoints(userTip, match);
        }

        tipDisplay = `
            <div class="match-tip-display">
                <span class="tip-label">Ditt tips:</span>
                <span class="tip-score">${userTip.homeScore} - ${userTip.awayScore}</span>
                ${match.result ? `<span class="tip-points">${points.toFixed(2)} poeng${match.completed ? '' : ' (live)'}</span>` : ''}
            </div>
        `;
    } else {
        tipDisplay = '<div class="no-tip-warning">⚠️ Ikke tippet</div>';
    }

    card.innerHTML = `
        <div class="competition-match-info">
            <div class="match-teams-vertical">
                <div class="team-row">
                    ${homeLogo ? `<img src="${homeLogo}" alt="${match.homeTeam}" class="team-logo-small">` : ''}
                    <span class="team-name">${match.homeTeam}</span>
                </div>
                <div class="team-row">
                    ${awayLogo ? `<img src="${awayLogo}" alt="${match.awayTeam}" class="team-logo-small">` : ''}
                    <span class="team-name">${match.awayTeam}</span>
                </div>
            </div>
            <div class="match-status-time">
                ${statusDisplay}
                ${resultDisplay}
            </div>
            ${tipDisplay}
        </div>
    `;

    return card;
}
