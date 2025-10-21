// Match data - will be loaded from API or mock data
let matches = [];
let allMatches = []; // Store all matches for filtering

// User's tips - loaded from Firebase
let userTips = [];

// LocalStorage functions for league preferences
function loadSelectedLeagues() {
    try {
        const saved = localStorage.getItem('selectedLeagues');
        if (saved) {
            const leagueArray = JSON.parse(saved);
            console.log('📂 Loaded saved league preferences:', leagueArray);
            return new Set(leagueArray);
        }
    } catch (error) {
        console.warn('⚠️ Could not load league preferences:', error);
    }
    // Default: all leagues selected
    return new Set([39, 2, 140, 78, 135]);
}

function saveSelectedLeagues() {
    try {
        const leagueArray = Array.from(selectedLeagues);
        localStorage.setItem('selectedLeagues', JSON.stringify(leagueArray));
        console.log('💾 Saved league preferences:', leagueArray);
    } catch (error) {
        console.warn('⚠️ Could not save league preferences:', error);
    }
}

// Selected leagues for filtering
let selectedLeagues = loadSelectedLeagues();

// Load user tips from Firebase
async function loadUserTips() {
    console.log('📥 Loading user tips from Firebase...');
    userTips = await getCurrentUserTips();
    console.log('✅ Loaded tips:', userTips.length, userTips);
}

// UI Functions for Auth Modal
function showAuthModal(type) {
    document.getElementById('authModal').style.display = 'block';

    // Hide all forms first
    document.getElementById('signinForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('resetForm').style.display = 'none';

    // Show the requested form
    if (type === 'signin') {
        document.getElementById('signinForm').style.display = 'block';
    } else if (type === 'signup') {
        document.getElementById('signupForm').style.display = 'block';
    } else if (type === 'reset') {
        document.getElementById('resetForm').style.display = 'block';
    }
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

async function handleSignIn() {
    const email = document.getElementById('signinEmail').value;
    const password = document.getElementById('signinPassword').value;

    const result = await signIn(email, password);
    if (!result.success) {
        alert('Innlogging feilet: ' + result.error);
    }
}

async function handleSignUp() {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    if (!name || !email || !password) {
        alert('Vennligst fyll ut alle feltene');
        return;
    }

    const result = await signUp(email, password, name);
    if (!result.success) {
        alert('Registrering feilet: ' + result.error);
    }
}

async function handleResetPassword() {
    const email = document.getElementById('resetEmail').value;

    if (!email) {
        alert('Vennligst fyll inn e-postadressen din');
        return;
    }

    // Check if resetPassword function exists
    if (typeof resetPassword === 'undefined') {
        console.error('resetPassword function not found!');
        alert('Teknisk feil: Kunne ikke laste tilbakestillingsfunksjonen. Prøv å refresh siden.');
        return;
    }

    const result = await resetPassword(email);
    if (result.success) {
        alert('En e-post med tilbakestillingslenke er sendt til ' + email + '. Sjekk innboksen din!');
        closeAuthModal();
    } else {
        alert('Kunne ikke sende tilbakestillingslenke: ' + result.error);
    }
}

// Mock leaderboard data - REMOVED
const mockPlayers = [
    {
        name: "Ole",
        tips: [
            { matchId: 1, homeScore: 2, awayScore: 1 },
            { matchId: 2, homeScore: 2, awayScore: 1 },
            { matchId: 3, homeScore: 3, awayScore: 1 },
            { matchId: 4, homeScore: 1, awayScore: 1 },
            { matchId: 5, homeScore: 2, awayScore: 2 }
        ]
    },
    {
        name: "Kari",
        tips: [
            { matchId: 1, homeScore: 1, awayScore: 2 },
            { matchId: 2, homeScore: 1, awayScore: 1 },
            { matchId: 3, homeScore: 3, awayScore: 0 },
            { matchId: 4, homeScore: 2, awayScore: 1 },
            { matchId: 5, homeScore: 1, awayScore: 1 }
        ]
    },
    {
        name: "Per",
        tips: [
            { matchId: 1, homeScore: 3, awayScore: 1 },
            { matchId: 2, homeScore: 0, awayScore: 0 },
            { matchId: 3, homeScore: 2, awayScore: 1 },
            { matchId: 4, homeScore: 1, awayScore: 2 },
            { matchId: 5, homeScore: 2, awayScore: 0 }
        ]
    },
    {
        name: "Lise",
        tips: [
            { matchId: 1, homeScore: 2, awayScore: 0 },
            { matchId: 2, homeScore: 2, awayScore: 2 },
            { matchId: 3, homeScore: 3, awayScore: 0 },
            { matchId: 4, homeScore: 0, awayScore: 2 },
            { matchId: 5, homeScore: 1, awayScore: 2 }
        ]
    },
    {
        name: "Thomas",
        tips: [
            { matchId: 1, homeScore: 1, awayScore: 1 },
            { matchId: 2, homeScore: 1, awayScore: 1 },
            { matchId: 3, homeScore: 4, awayScore: 0 },
            { matchId: 4, homeScore: 2, awayScore: 2 },
            { matchId: 5, homeScore: 3, awayScore: 1 }
        ]
    }
];

// Calculate total score for a player
function calculatePlayerScore(tips) {
    let totalScore = 0;
    tips.forEach(tip => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));
        if (!match) return;

        // Add odds to tip if missing (for mock players)
        const tipWithOdds = {
            ...tip,
            odds: tip.odds || match.odds || { H: 2.0, U: 3.0, B: 3.5 }
        };

        // Ensure odds is an object with H, U, B properties
        if (!tipWithOdds.odds || typeof tipWithOdds.odds !== 'object') {
            tipWithOdds.odds = { H: 2.0, U: 3.0, B: 3.5 };
        }

        totalScore += calculatePoints(tipWithOdds, match);
    });
    return totalScore;
}

// Leaderboard is now on separate page (leaderboard.html)

// Toggle all leagues checkbox
function toggleAllLeagues(checkbox) {
    const leagueCheckboxes = document.querySelectorAll('.league-filter-checkbox');
    leagueCheckboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
    filterLeagues();
}

// Filter leagues based on checkboxes
function filterLeagues() {
    const leagueCheckboxes = document.querySelectorAll('.league-filter-checkbox');
    const allCheckbox = document.getElementById('league-all');

    selectedLeagues.clear();
    let allChecked = true;

    leagueCheckboxes.forEach(cb => {
        if (cb.checked) {
            const leagueId = parseInt(cb.id.replace('league-', ''));
            selectedLeagues.add(leagueId);
        } else {
            allChecked = false;
        }
    });

    // Update "All" checkbox state
    allCheckbox.checked = allChecked;

    // Save preferences to localStorage
    saveSelectedLeagues();

    // Filter and render matches
    applyLeagueFilter();
}

// Apply league filter to matches
function applyLeagueFilter() {
    // Get league name from league ID mapping
    const leagueNames = {
        39: 'Premier League',
        2: 'UEFA Champions League',
        140: 'La Liga',
        78: 'Bundesliga',
        135: 'Serie A',
        1: 'World Cup'
    };

    if (selectedLeagues.size === 0) {
        matches = [];
    } else {
        const now = new Date();
        matches = allMatches.filter(match => {
            // Filter out matches that have already started
            const matchDate = new Date(match.commence_time || match.date);
            if (matchDate < now) {
                return false; // Skip past matches
            }

            // Check if match league name matches any selected league
            const matchLeague = match.league;
            for (const leagueId of selectedLeagues) {
                const leagueName = leagueNames[leagueId];
                if (matchLeague && (matchLeague.includes(leagueName) ||
                    leagueName.includes(matchLeague) ||
                    matchLeague.toLowerCase().includes(leagueName.toLowerCase()))) {
                    return true;
                }
            }
            return false;
        });
    }

    renderMatches();
}

// Cache matches in localStorage for faster loading
function getCachedMatches() {
    try {
        const cached = localStorage.getItem('cachedMatches');
        const cacheTime = localStorage.getItem('cachedMatchesTime');

        if (cached && cacheTime) {
            const age = Date.now() - parseInt(cacheTime);
            // Cache valid for 5 minutes
            if (age < 5 * 60 * 1000) {
                console.log('✅ Using cached matches (age:', Math.round(age / 1000), 'seconds)');
                return JSON.parse(cached);
            }
        }
    } catch (error) {
        console.warn('⚠️ Could not load cached matches:', error);
    }
    return null;
}

function setCachedMatches(matches) {
    try {
        localStorage.setItem('cachedMatches', JSON.stringify(matches));
        localStorage.setItem('cachedMatchesTime', Date.now().toString());
        console.log('💾 Cached', matches.length, 'matches');
    } catch (error) {
        console.warn('⚠️ Could not cache matches:', error);
    }
}

// Load matches from API
async function loadMatches() {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');

    try {
        loadingMessage.style.display = 'block';
        errorMessage.style.display = 'none';

        // Try to load from cache first for instant display
        const cachedMatches = getCachedMatches();
        if (cachedMatches && cachedMatches.length > 0) {
            allMatches = cachedMatches;
            applyLeagueFilter();

            // Load user tips in parallel
            const tipsPromise = currentUser ? loadUserTips() : Promise.resolve();

            // Render immediately with cached data
            renderMatches();

            await tipsPromise;
            updateTotalScore();

            console.log('⚡ Rendered cached matches, fetching fresh data in background...');
        }

        // Fetch fresh data from API (in parallel)
        const [upcomingMatches, completedMatches] = await Promise.all([
            footballApi.getUpcomingFixtures(),
            footballApi.fetchScores().catch(error => {
                console.warn('⚠️ Could not load completed matches:', error);
                return [];
            })
        ]);

        console.log('📊 Loaded matches:', upcomingMatches.length, 'upcoming,', completedMatches.length, 'completed');

        // Deduplicate matches
        const existingIds = new Set(upcomingMatches.map(m => String(m.id)));
        const uniqueCompletedMatches = completedMatches.filter(m => {
            const id = String(m.id);
            if (existingIds.has(id)) {
                return false;
            }
            existingIds.add(id);
            return true;
        });

        console.log(`✅ Adding ${uniqueCompletedMatches.length} unique completed matches`);

        // Combine all matches
        allMatches = upcomingMatches.concat(uniqueCompletedMatches);

        // Cache the fresh data
        setCachedMatches(allMatches);

        // Apply initial filter
        applyLeagueFilter();

        // Load user tips if not already loaded
        if (currentUser && !cachedMatches) {
            await loadUserTips();
        }

        loadingMessage.style.display = 'none';

        // Re-render with fresh data
        renderMatches();
        updateTotalScore();
    } catch (error) {
        console.error('Failed to load matches:', error);
        loadingMessage.style.display = 'none';
        errorMessage.textContent = 'Kunne ikke laste kamper. Bruker mock-data.';
        errorMessage.style.display = 'block';

        // Fallback to mock data
        allMatches = await footballApi.getMockFixtures();
        applyLeagueFilter();

        // Load user tips first before rendering
        if (currentUser) {
            await loadUserTips();
        }

        renderMatches();
        updateTotalScore();
    }
}

// Initialize UI checkboxes based on saved preferences
function initializeLeagueCheckboxes() {
    const leagueCheckboxes = document.querySelectorAll('.league-filter-checkbox');
    const allCheckbox = document.getElementById('league-all');

    let allChecked = true;

    leagueCheckboxes.forEach(cb => {
        const leagueId = parseInt(cb.id.replace('league-', ''));
        cb.checked = selectedLeagues.has(leagueId);

        if (!cb.checked) {
            allChecked = false;
        }
    });

    if (allCheckbox) {
        allCheckbox.checked = allChecked;
    }

    console.log('✅ Initialized league checkboxes from saved preferences');
}

// Initialize the app
function init() {
    // Show auth buttons by default (will be hidden by onUserLoggedIn if user is logged in)
    const authSection = document.getElementById('authSection');
    if (authSection) {
        authSection.style.display = 'block';
    }

    // Initialize Firebase first
    initializeFirebase();
    // Initialize league checkboxes from saved preferences
    initializeLeagueCheckboxes();

    // Wait for auth state before loading matches
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // User is signed in, load matches
            loadMatches();
        } else {
            // User is not signed in, show message
            const matchesList = document.getElementById('matchesList');
            if (matchesList) {
                matchesList.innerHTML = '<div class="no-matches"><p>Du må være innlogget for å se kamper og legge inn tips.</p><p><a href="index.html" class="btn-primary">Logg inn</a></p></div>';
            }
        }
    });
}

// Group matches by date
function groupMatchesByDate(matches) {
    const groups = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    matches.forEach(match => {
        let matchDate;

        // Try to use commence_time first, fallback to timestamp
        if (match.commence_time) {
            matchDate = new Date(match.commence_time);
        } else if (match.timestamp) {
            // timestamp is in seconds, convert to milliseconds
            matchDate = new Date(match.timestamp * 1000);
        } else {
            console.warn('Match missing both commence_time and timestamp:', match);
            return;
        }

        // Check if date is valid
        if (isNaN(matchDate.getTime())) {
            console.warn('Invalid date for match:', match);
            return;
        }

        matchDate.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor((matchDate - today) / (1000 * 60 * 60 * 24));

        let dateLabel;
        if (daysDiff === 0) {
            dateLabel = 'I dag';
        } else if (daysDiff === 1) {
            dateLabel = 'I morgen';
        } else {
            // Format: "Fredag, 17. oktober"
            const weekday = matchDate.toLocaleDateString('nb-NO', { weekday: 'long' });
            const day = matchDate.getDate();
            const month = matchDate.toLocaleDateString('nb-NO', { month: 'long' });
            dateLabel = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day}. ${month}`;
        }

        if (!groups[dateLabel]) {
            groups[dateLabel] = [];
        }
        groups[dateLabel].push(match);
    });

    return groups;
}

// Render matches list
function renderMatches() {
    const matchesList = document.getElementById('matchesList');
    matchesList.innerHTML = '';

    console.log('🎯 Rendering matches:', matches.length);
    if (matches.length > 0) {
        console.log('First match commence_time:', matches[0].commence_time);
    }

    const groupedMatches = groupMatchesByDate(matches);

    console.log('📅 Date groups:', Object.keys(groupedMatches));

    Object.entries(groupedMatches).forEach(([dateLabel, dateMatches]) => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'date-group';

        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.textContent = dateLabel;
        dateGroup.appendChild(dateHeader);

        // Group matches by time within this date
        const matchesByTime = {};
        dateMatches.forEach(match => {
            if (!matchesByTime[match.time]) {
                matchesByTime[match.time] = [];
            }
            matchesByTime[match.time].push(match);
        });

        // Render each time group
        Object.entries(matchesByTime).forEach(([time, timeMatches]) => {
            // Filter out matches that have already started
            const upcomingMatches = timeMatches.filter(match => {
                const matchDate = match.commence_time ? new Date(match.commence_time) : (match.timestamp ? new Date(match.timestamp * 1000) : null);
                const hasStarted = matchDate && matchDate < new Date();

                if (hasStarted) {
                    console.log(`⏰ Skipping match that has started: ${match.homeTeam} vs ${match.awayTeam}`);
                }

                return !hasStarted;
            });

            // Skip this time group if no upcoming matches
            if (upcomingMatches.length === 0) {
                return;
            }

            // Create time header only if we have upcoming matches
            const timeHeader = document.createElement('div');
            timeHeader.className = 'time-header';
            // Clean time format - extract only HH:MM if it contains more
            const cleanTime = time.includes(',') ? time.split(',').pop().trim() : time;

            // Get league info from first match in this time group
            const firstMatch = upcomingMatches[0];
            const leagueLogo = firstMatch.leagueLogo ? `<img src="${firstMatch.leagueLogo}" alt="${firstMatch.league}" class="league-logo-small" onerror="this.style.display='none'">` : '';
            const leagueName = firstMatch.league ? `<span class="league-name">${firstMatch.league}</span>` : '';

            timeHeader.innerHTML = `<strong>${cleanTime}</strong> ${leagueLogo} ${leagueName}`;
            dateGroup.appendChild(timeHeader);

            // Render all upcoming matches for this time
            upcomingMatches.forEach(match => {

                const existingTip = userTips.find(tip => String(tip.matchId) === String(match.id));

                if (!existingTip && userTips.length > 0) {
                    console.log(`🔍 No tip found for match ${match.id}`);
                    console.log('Available tip matchIds:', userTips.map(t => t.matchId));
                }

                const homeScore = existingTip ? existingTip.homeScore : '?';
                const awayScore = existingTip ? existingTip.awayScore : '?';
                const hasTip = existingTip !== undefined;

                if (existingTip) {
                    console.log(`✅ Found tip for match ${match.id}: ${homeScore}-${awayScore}`);
                }

                const matchCard = document.createElement('div');
                matchCard.className = hasTip ? 'match-card has-tip' : 'match-card';

                // Get team logos - prioritize match data over cache
                const homeLogo = match.homeLogo || footballApi.getTeamLogo(match.homeTeam);
                const awayLogo = match.awayLogo || footballApi.getTeamLogo(match.awayTeam);

                // Log missing logos
                if (!homeLogo) {
                    console.log(`⚠️ Missing logo for: ${match.homeTeam}`);
                }
                if (!awayLogo) {
                    console.log(`⚠️ Missing logo for: ${match.awayTeam}`);
                }

                matchCard.innerHTML = `
                    <div class="match-info">
                        ${match.odds ? `
                            <div class="odds">
                                <div class="odds-row">
                                    <div class="odd-item">
                                        <span class="odd-label">H:</span>
                                        <span class="odd-value">${match.odds.H ? match.odds.H.toFixed(2) : '2.00'}</span>
                                    </div>
                                    <div class="odd-item">
                                        <span class="odd-label">U:</span>
                                        <span class="odd-value">${match.odds.U ? match.odds.U.toFixed(2) : '3.00'}</span>
                                    </div>
                                    <div class="odd-item">
                                        <span class="odd-label">B:</span>
                                        <span class="odd-value">${match.odds.B ? match.odds.B.toFixed(2) : '3.50'}</span>
                                    </div>
                                </div>
                            </div>
                        ` : '<div class="odds"><div class="odds-row"><span style="font-size: 11px; color: #94a3b8;">Ingen odds</span></div></div>'}

                        <div class="match-teams">
                            <div class="team home">
                                <span class="team-name-large">${match.homeTeam}</span>
                                ${homeLogo ? `<img src="${homeLogo}" alt="${match.homeTeam}" class="team-logo-large" onerror="this.style.display='none'">` : ''}
                            </div>
                            <span class="vs-separator">-</span>
                            <div class="team away">
                                ${awayLogo ? `<img src="${awayLogo}" alt="${match.awayTeam}" class="team-logo-large" onerror="this.style.display='none'">` : ''}
                                <span class="team-name-large">${match.awayTeam}</span>
                            </div>
                        </div>

                        <div class="tip-input-section">
                            <span class="tip-label">Ditt tips</span>
                            <div class="tip-score-input">
                                <div class="score-input-group">
                                    <button class="score-btn minus-btn" data-match-id="${match.id}" data-type="home" ${match.result ? 'disabled' : ''}>−</button>
                                    <span class="score-display" id="home-score-${match.id}">${homeScore}</span>
                                    <button class="score-btn plus-btn" data-match-id="${match.id}" data-type="home" ${match.result ? 'disabled' : ''}>+</button>
                                </div>
                                <span class="score-separator">-</span>
                                <div class="score-input-group">
                                    <button class="score-btn minus-btn" data-match-id="${match.id}" data-type="away" ${match.result ? 'disabled' : ''}>−</button>
                                    <span class="score-display" id="away-score-${match.id}">${awayScore}</span>
                                    <button class="score-btn plus-btn" data-match-id="${match.id}" data-type="away" ${match.result ? 'disabled' : ''}>+</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                dateGroup.appendChild(matchCard);

                // Add event listeners for +/- buttons
                if (!match.result) {
                    const buttons = matchCard.querySelectorAll('.score-btn');
                    buttons.forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const matchId = e.target.dataset.matchId; // Keep as string, don't parse
                            const type = e.target.dataset.type;
                            const isPlus = e.target.classList.contains('plus-btn');

                            console.log('Button clicked:', { matchId, type, isPlus });
                            updateScore(matchId, type, isPlus);
                        });
                    });
                }
            });
        });

        matchesList.appendChild(dateGroup);
    });
}

// Update score with +/- buttons
function updateScore(matchId, type, isPlus) {
    const scoreElement = document.getElementById(`${type}-score-${matchId}`);

    if (!scoreElement) {
        console.error(`Score element not found: ${type}-score-${matchId}`);
        return;
    }

    let currentScore = scoreElement.textContent === '?' ? 0 : parseInt(scoreElement.textContent);

    if (isPlus) {
        currentScore = Math.min(currentScore + 1, 20);
    } else {
        currentScore = Math.max(currentScore - 1, 0);
    }

    scoreElement.textContent = currentScore;

    // Auto-save after score change
    const homeScoreElement = document.getElementById(`home-score-${matchId}`);
    const awayScoreElement = document.getElementById(`away-score-${matchId}`);

    if (!homeScoreElement || !awayScoreElement) {
        console.error('Score elements not found for match', matchId);
        return;
    }

    const homeScore = homeScoreElement.textContent === '?' ? 0 : parseInt(homeScoreElement.textContent);
    const awayScore = awayScoreElement.textContent === '?' ? 0 : parseInt(awayScoreElement.textContent);

    submitTip(matchId, homeScore, awayScore);
}

// Submit a tip
async function submitTip(matchId, homeScore, awayScore) {
    if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
        return;
    }

    // Ensure matchId is the same type as match.id for comparison
    const match = matches.find(m => String(m.id) === String(matchId));

    // Create tip object
    const tip = {
        matchId: matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeScore: homeScore,
        awayScore: awayScore,
        odds: match.odds,
        timestamp: new Date().toISOString()
    };

    // Save tip to Firebase
    const saved = await saveTipToFirestore(tip);
    if (saved) {
        // Reload user tips
        await loadUserTips();
        renderMatches();
        updateTotalScore();
    }
}

// Calculate outcome (H, U, B)
function getOutcome(homeScore, awayScore) {
    if (homeScore > awayScore) return 'H';
    if (homeScore < awayScore) return 'B';
    return 'U';
}

// Calculate points for a tip
function calculatePoints(tip, match) {
    if (!match.result) return 0;

    const tipOutcome = getOutcome(tip.homeScore, tip.awayScore);
    const resultOutcome = getOutcome(match.result.home, match.result.away);

    let points = 0;

    // Correct outcome: points equal to odds
    if (tipOutcome === resultOutcome) {
        points += tip.odds[resultOutcome];
    }

    // Exact score: 3 bonus points (in addition to outcome points)
    if (tip.homeScore === match.result.home && tip.awayScore === match.result.away) {
        points += 3;
    }

    return points;
}

// Update total score
function updateTotalScore() {
    let totalScore = 0;

    console.log('💰 Calculating total score...');
    console.log(`Total user tips: ${userTips.length}`);
    console.log(`Total matches available: ${matches.length}`);

    userTips.forEach(tip => {
        const match = matches.find(m => String(m.id) === String(tip.matchId));
        if (match) {
            const points = calculatePoints(tip, match);
            if (points > 0) {
                console.log(`✅ Points earned for match ${match.homeTeam} vs ${match.awayTeam}: ${points.toFixed(2)}`);
                console.log(`   Your tip: ${tip.homeScore}-${tip.awayScore}, Result: ${match.result?.home}-${match.result?.away}`);
            } else if (match.result) {
                console.log(`❌ No points for match ${match.homeTeam} vs ${match.awayTeam}`);
                console.log(`   Your tip: ${tip.homeScore}-${tip.awayScore}, Result: ${match.result.home}-${match.result.away}`);
            }
            totalScore += points;
        } else {
            console.log(`⚠️ Match not found for tip matchId: ${tip.matchId}`);
        }
    });

    console.log(`💰 Total score: ${totalScore.toFixed(2)}`);

    const scoreElement = document.getElementById('totalScore');
    if (scoreElement) {
        scoreElement.textContent = totalScore.toFixed(2);
    }
}

// Simulate match results (for testing)
function simulateResult(matchId) {
    const match = matches.find(m => String(m.id) === String(matchId));
    if (!match) return;

    match.result = {
        home: Math.floor(Math.random() * 5),
        away: Math.floor(Math.random() * 5)
    };

    renderMatches();
    updateTotalScore();
}

// Refresh data from API (clears cache)
function refreshData() {
    footballApi.clearCache();
    // Also clear any cached data to force fresh load
    userTips = [];
    location.reload();
}

// Close auth modal when clicking outside of it (but not on modal content)
window.onclick = function(event) {
    const modal = document.getElementById('authModal');
    if (event.target === modal) {
        closeAuthModal();
    }
};

// Prevent modal content clicks from closing the modal
window.addEventListener('DOMContentLoaded', () => {
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        modalContent.addEventListener('click', function(event) {
            event.stopPropagation();
        });
    }
});

// Add button to simulate results for testing (can be removed later)
window.addEventListener('DOMContentLoaded', () => {
    init();

    // Add debug button in console
    console.log('🔥 APP VERSION: 2025-10-13-19:40 - SHOW ? FOR EMPTY TIPS!');
    console.log('Total userTips loaded:', userTips.length);
    if (userTips.length > 0) {
        console.log('Sample tip:', userTips[0]);
    }
    console.log('Tilgjengelige funksjoner:');
    console.log('- simulateResult(matchId): Simuler resultat for en kamp');
    console.log('- refreshData(): Hent nye data fra API (tømmer cache)');
    console.log('- Eksempel: simulateResult(1)');
});
