// Node.js script to create test competition with EFL Cup matches
const https = require('https');

const FIREBASE_PROJECT_ID = 'tippekonkurranse-e38a2';
const API_KEY = 'AIzaSyDxATQI0zVgHygWXlPkWvyeIfKSH-smkqY';

// Your user data (Ola)
const USER_EMAIL = 'oyvind40@hotmail.com';
const USER_UID = 'test_user_ola'; // We'll use a test UID

async function fetchEFLCupMatches() {
    console.log('🔍 Fetching EFL Cup matches for today...');

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // This would need to be called through your API endpoint
    console.log(`📅 Looking for matches on ${dateStr}`);

    // For now, return mock data structure
    return [
        { fixture: { id: 1234567 }, teams: { home: { name: 'Arsenal' }, away: { name: 'Newcastle' } } },
        { fixture: { id: 1234568 }, teams: { home: { name: 'Liverpool' }, away: { name: 'Brighton' } } },
        { fixture: { id: 1234569 }, teams: { home: { name: 'Man City' }, away: { name: 'Tottenham' } } },
        { fixture: { id: 1234570 }, teams: { home: { name: 'Chelsea' }, away: { name: 'Southampton' } } }
    ];
}

async function createFirestoreDocument(collection, docId, data) {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toISOString();
        const docData = {
            fields: {}
        };

        // Convert data to Firestore format
        for (const [key, value] of Object.entries(data)) {
            if (key === 'createdAt' || key === 'joinedAt' || key === 'updatedAt') {
                docData.fields[key] = { timestampValue: timestamp };
            } else if (typeof value === 'string') {
                docData.fields[key] = { stringValue: value };
            } else if (typeof value === 'number') {
                docData.fields[key] = { integerValue: value.toString() };
            } else if (Array.isArray(value)) {
                docData.fields[key] = {
                    arrayValue: {
                        values: value.map(v =>
                            typeof v === 'string' ? { stringValue: v } :
                            typeof v === 'number' ? { integerValue: v.toString() } :
                            { stringValue: String(v) }
                        )
                    }
                };
            }
        }

        const path = docId
            ? `/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?key=${API_KEY}`
            : `/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}?key=${API_KEY}`;

        const options = {
            hostname: 'firestore.googleapis.com',
            path: path,
            method: docId ? 'PATCH' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const result = JSON.parse(body);
                    resolve(result);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.write(JSON.stringify(docData));
        req.end();
    });
}

async function main() {
    try {
        console.log('🏆 Creating EFL Cup test competition...\n');

        // Fetch matches
        const matches = await fetchEFLCupMatches();
        console.log(`✅ Found ${matches.length} matches\n`);

        // Create competition
        const competitionId = `test_efl_cup_${Date.now()}`;
        const today = new Date().toISOString().split('T')[0];

        console.log('📝 Creating competition document...');
        const competitionData = {
            name: `EFL Cup Test - ${today}`,
            description: 'Test competition for EFL Cup matches',
            creatorId: USER_UID,
            creatorName: 'Ola',
            participants: [USER_UID],
            competitionType: 'custom',
            leagues: [48],
            matchIds: matches.map(m => m.fixture.id),
            createdAt: 'TIMESTAMP'
        };

        await createFirestoreDocument('competitions', competitionId, competitionData);
        console.log(`✅ Competition created: ${competitionId}\n`);

        // Create participant entry
        console.log('👤 Adding participant...');
        await createFirestoreDocument(
            'competitionParticipants',
            `${competitionId}_${USER_UID}`,
            {
                competitionId: competitionId,
                userId: USER_UID,
                userName: 'Ola',
                totalPoints: 0,
                joinedAt: 'TIMESTAMP'
            }
        );
        console.log('✅ Participant added\n');

        // Create tips
        console.log('📝 Creating tips (0-0 for all matches)...');
        for (const match of matches) {
            const matchId = match.fixture.id;
            const homeTeam = match.teams.home.name;
            const awayTeam = match.teams.away.name;

            const tipDocId = `${USER_UID}_${matchId}`;
            await createFirestoreDocument('tips', tipDocId, {
                matchId: matchId,
                homeScore: 0,
                awayScore: 0,
                userId: USER_UID,
                userDisplayName: 'Ola',
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                updatedAt: 'TIMESTAMP'
            });

            console.log(`  ✓ ${homeTeam} vs ${awayTeam}: 0-0`);
        }

        console.log('\n🎉 Done! Competition created successfully!');
        console.log(`🔗 View at: https://tippekonkurran.se/competition-detail.html?id=${competitionId}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
