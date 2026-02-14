// Color extraction from team logos using canvas
// Caches results to avoid re-extracting for the same logo

const colorCache = new Map();

const FALLBACK_HOME = '#16a34a';
const FALLBACK_AWAY = '#3b82f6';

/**
 * Extract the dominant color from an image URL using an offscreen canvas.
 * Skips white, near-white, very light, and transparent pixels.
 * Quantizes colors into buckets to find the most common hue.
 * @param {string} imageUrl
 * @returns {Promise<string>} hex color string
 */
export async function extractDominantColor(imageUrl) {
    if (!imageUrl) return null;
    if (colorCache.has(imageUrl)) return colorCache.get(imageUrl);

    try {
        const color = await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            const timeout = setTimeout(() => {
                reject(new Error('Image load timeout'));
            }, 5000);

            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    const size = 40; // small sample size is enough
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, size, size);

                    const imageData = ctx.getImageData(0, 0, size, size);
                    const data = imageData.data;

                    // Quantize into color buckets (reduce to ~32 levels per channel)
                    const buckets = {};
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        const a = data[i + 3];

                        // Skip transparent pixels
                        if (a < 128) continue;

                        // Skip white / near-white / very light pixels
                        if (r > 220 && g > 220 && b > 220) continue;

                        // Skip very dark / near-black pixels
                        if (r < 30 && g < 30 && b < 30) continue;

                        // Skip gray pixels (low saturation)
                        const max = Math.max(r, g, b);
                        const min = Math.min(r, g, b);
                        if (max - min < 25) continue;

                        // Quantize to 8 levels per channel
                        const qr = Math.round(r / 32) * 32;
                        const qg = Math.round(g / 32) * 32;
                        const qb = Math.round(b / 32) * 32;

                        const key = `${qr},${qg},${qb}`;
                        if (!buckets[key]) {
                            buckets[key] = { r: 0, g: 0, b: 0, count: 0 };
                        }
                        buckets[key].r += r;
                        buckets[key].g += g;
                        buckets[key].b += b;
                        buckets[key].count++;
                    }

                    // Find the most common bucket
                    let maxCount = 0;
                    let dominant = null;
                    for (const key in buckets) {
                        if (buckets[key].count > maxCount) {
                            maxCount = buckets[key].count;
                            dominant = buckets[key];
                        }
                    }

                    if (!dominant || maxCount < 3) {
                        resolve(null);
                        return;
                    }

                    // Average the actual colors in the dominant bucket
                    const avgR = Math.round(dominant.r / dominant.count);
                    const avgG = Math.round(dominant.g / dominant.count);
                    const avgB = Math.round(dominant.b / dominant.count);

                    const hex = '#' +
                        avgR.toString(16).padStart(2, '0') +
                        avgG.toString(16).padStart(2, '0') +
                        avgB.toString(16).padStart(2, '0');

                    resolve(hex);
                } catch (e) {
                    reject(e);
                }
            };

            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Image load failed'));
            };

            img.src = imageUrl;
        });

        if (color) {
            colorCache.set(imageUrl, color);
        }
        return color;
    } catch (err) {
        console.debug('Color extraction failed for', imageUrl, err.message);
        return null;
    }
}

/**
 * Get team colors for a match. Returns immediately with fallbacks,
 * then resolves actual colors asynchronously.
 * @param {string} homeLogoUrl
 * @param {string} awayLogoUrl
 * @param {function} onResolved - callback({homeColor, awayColor}) when extraction completes
 * @returns {{homeColor: string, awayColor: string}} immediate fallback colors
 */
export function getTeamColors(homeLogoUrl, awayLogoUrl, onResolved) {
    const immediate = {
        homeColor: colorCache.get(homeLogoUrl) || FALLBACK_HOME,
        awayColor: colorCache.get(awayLogoUrl) || FALLBACK_AWAY
    };

    // If both are cached, call onResolved immediately
    if (colorCache.has(homeLogoUrl) && colorCache.has(awayLogoUrl)) {
        if (onResolved) onResolved(immediate);
        return immediate;
    }

    // Extract asynchronously
    if (onResolved) {
        Promise.all([
            extractDominantColor(homeLogoUrl),
            extractDominantColor(awayLogoUrl)
        ]).then(([homeColor, awayColor]) => {
            onResolved({
                homeColor: homeColor || FALLBACK_HOME,
                awayColor: awayColor || FALLBACK_AWAY
            });
        });
    }

    return immediate;
}
