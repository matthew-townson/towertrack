export const BELL_COLOURS = [
    '#999999', '#aa4488', '#fd99cc', '#ff8800', '#face27', '#039b16', '#44ffaa', '#fa1d1a',
    '#aa4488', '#2f27ca', '#aaaa44', '#000000', '#aa8844', '#ff8888', '#88ff88', '#680098'
];

export function generatePinSVG(bellNumber, options = {}) {
    const color = BELL_COLOURS[bellNumber - 1] || '#888888';
    const isUnringable = options.unringable || false;
    const isGrabbed = options.grabbed || false;
    const isCircled = options.circled || false;
    const isQuartered = options.quartered || false;
    const isPealed = options.pealed || false;

    const uid = Math.random().toString(36).substr(2, 9);
    const dotsId = `dots_${uid}`;
    const stripesId = `stripes_${uid}`;
    const leftClipId = `leftHalf_${uid}`;
    const rightClipId = `rightHalf_${uid}`;

    const scaleFactor = 1.4;
    const baseWidth = Math.round((isCircled ? 26 : 25) * scaleFactor);
    const baseHeight = Math.round((isGrabbed ? (isCircled ? 51 : 50) : (isCircled ? 42 : 41)) * scaleFactor);
    const viewBoxOffset = isCircled ? '-0.5 -0.5' : '0 0';
    const viewBoxWidth = isCircled ? 26 : 25;
    const viewBoxHeight = isGrabbed ? (isCircled ? 51 : 50) : (isCircled ? 42 : 41);

    const pinOffset = isGrabbed ? 9 : 0;
    const circleY = isGrabbed ? 21.5 : 12.5;
    const textY = isGrabbed ? 26 : 17;

    const strokeColor = isCircled ? '#FF6600' : 'none';
    const strokeWidth = isCircled ? 2 : 0;
    const strokeAttr = isCircled ? ` stroke="${strokeColor}" stroke-width="${strokeWidth}"` : '';

    const pinPathD = `M12.5 ${pinOffset}C5.6 ${pinOffset} 0 ${5.6 + pinOffset} 0 ${12.5 + pinOffset}C0 ${19.6 + pinOffset} 12.5 ${41 + pinOffset} 12.5 ${41 + pinOffset}S25 ${19.6 + pinOffset} 25 ${12.5 + pinOffset}C25 ${5.6 + pinOffset} 19.4 ${pinOffset} 12.5 ${pinOffset}Z`;

    let svg = `<svg width="${baseWidth}" height="${baseHeight}" viewBox="${viewBoxOffset} ${viewBoxWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg">`;

    if (isQuartered || isPealed) {
        svg += `<defs>`;
        if (isQuartered) {
            svg += `<pattern id="${dotsId}" patternUnits="userSpaceOnUse" width="4" height="4">
                    <circle cx="2" cy="2" r="1" fill="#ffffff" opacity="0.6"/></pattern>
                    <clipPath id="${leftClipId}"><rect x="0" y="${pinOffset}" width="${viewBoxWidth/2}" height="${viewBoxHeight}"/></clipPath>`;
        }
        if (isPealed) {
            svg += `<pattern id="${stripesId}" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                    <rect width="2" height="4" fill="#ffffff" opacity="0.6"/></pattern>
                    <clipPath id="${rightClipId}"><rect x="${viewBoxWidth/2}" y="${pinOffset}" width="${viewBoxWidth/2}" height="${viewBoxHeight}"/></clipPath>`;
        }
        svg += `</defs>`;
    }

    if (isGrabbed) {
        svg += '<path d="M8 3 L12 7 L17 2" stroke="black" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
        svg += '<path d="M8 3 L12 7 L17 2" stroke="#16e616ff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    }

    // base pin body
    svg += `<path d="${pinPathD}" fill="${color}"${strokeAttr}/>`;

    // patterned overlays applied to the main pin body (clipped halves)
    if (isQuartered) {
        svg += `<g clip-path="url(#${leftClipId})"><path d="${pinPathD}" fill="url(#${dotsId})" /></g>`;
    }
    if (isPealed) {
        svg += `<g clip-path="url(#${rightClipId})"><path d="${pinPathD}" fill="url(#${stripesId})" /></g>`;
    }

    const centerColor = isUnringable ? '#888888' : color;
    svg += `<circle cx="12.5" cy="${circleY}" r="10" fill="${centerColor}"/>`;

    // number / UR
    if (isUnringable) {
        const fontSize = bellNumber >= 10 ? 10 : 12;
        const urFontSize = 6;
        const numberY = textY - 2;
        const urY = textY + 4;

        svg += `<text x="12.5" y="${numberY}" text-anchor="middle" fill="black" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="bold">${bellNumber}</text>`;
        svg += `<text x="12.5" y="${urY}" text-anchor="middle" fill="black" font-family="Inter, sans-serif" font-size="${urFontSize}" font-weight="normal">UR</text>`;
    } else {
        const fontSize = bellNumber >= 10 ? 12 : 14;
        svg += `<text x="12.5" y="${textY}" text-anchor="middle" fill="white" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="bold">${bellNumber}</text>`;
    }

    svg += '</svg>';
    return svg;
}

export function convertToHundredweight(weight) {
    if (!weight) return 'Unknown';
    const weightValue = parseFloat(weight);
    
    if (isNaN(weightValue)) return 'Unknown';

    // Handle the possibility that the weight might already be in cwt-qtr-lb format
    if (typeof weight === 'string' && weight.includes('-')) {
        const parts = weight.split('-');
        if (parts.length === 3) {
            return weight; // Already in correct format
        }
    }

    const totalPounds = Math.round(weightValue);
    
    // 1 cwt = 112 pounds
    const cwt = Math.floor(totalPounds / 112);
    
    // Remaining after cwt
    const remainingAfterCwt = totalPounds % 112;
    
    // 1 qtr = 28 pounds (quarter of a hundredweight)
    const qtr = Math.floor(remainingAfterCwt / 28);
    
    // Remaining pounds
    const lb = remainingAfterCwt % 28;
    
    // Always use standard cwt-qtr-lb format
    return `${cwt}-${qtr}-${lb}`;
}

export function getPinColor(bellCount, isUnringable) {
    if (isUnringable) return 'red';
    return BELL_COLOURS[(bellCount - 1) % BELL_COLOURS.length] || '#888888';
}

export function createTowerIcon(L, bellCount, options = {}) {
    const pinSVG = generatePinSVG(bellCount, options);
    
    return L.divIcon({
        className: 'tower-pin',
        html: pinSVG,
        iconSize: [35, 57],
        iconAnchor: [17.5, 57],
        popupAnchor: [0, -57]
    });
}

export function generateTowerPopup(tower, isUnringable, pinColor) {
    return `
        <div class="tower-popup">
            <h4><strong>
                <a href="/tower/${tower.TowerID}" style="${isUnringable ? 'color: red;' : ''}">
                    ${isUnringable ? 'U/R' : ''} ${tower.Place}${tower.Dedicn ? `, ${tower.Dedicn}` : ''}
                </a>
                </strong></h4>
            <p style="${isUnringable ? 'color: red;' : ''}">${tower.County || tower.Country}</br>
                <strong style="color:${pinColor}">
                    ${tower.Bells || ''}</strong>, ${tower.Wt ? convertToHundredweight(tower.Wt) : ''} in ${tower.Note || ''}
                ${tower.Practice ? `<br>${tower.Practice}` : ''}
                ${tower.grabbed ? '<br><strong style="color: #00aa00;">✓ Grabbed</strong>' : ''}
                ${tower.quartered ? '<br><strong style="color:#0CD7DB;">✓ Quarter Pealed</strong>' : ''}
                ${tower.pealed ? '<br><strong style="color:#0a66ff;">✓ Pealed</strong>' : ''}
            </p>
            <div class="popup-actions">
                <a href="/tower/${tower.TowerID}" class="popup-link">View Details</a>
                <a href="https://dove.cccbr.org.uk/tower/${tower.TowerID}" target="_blank" rel="noopener noreferrer" class="popup-link">Dove</a>
            </div>
        </div>
    `;
}

export function createUserLocationIcon(L) {
    return L.divIcon({
        className: 'user-location-marker',
        html: '<div class="user-location-dot"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

export function filterTowersByBells(towers, bellsFilter, isMinimumBells) {
    return towers.filter(tower => {
        if (!tower.Bells) return false;
        const bellCount = parseInt(tower.Bells);
        if (isNaN(bellCount)) return false;

        if (isMinimumBells) {
            return bellCount >= bellsFilter;
        } else {
            return bellCount === bellsFilter;
        }
    });
}

export function filterTowersByUnringable(towers, showUnringable) {
    return towers.filter(tower => {
        const isUnringable = tower.UR === 1 || tower.UR === '1';
        if (isUnringable && !showUnringable) return false;
        return true;
    });
}

export function matchesPracticeNight(tower, practiceNightFilter) {
    if (!practiceNightFilter) return true;
    if (!tower.Practice || typeof tower.Practice !== 'string') return false;
    
    const nightPattern = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi;
    return tower.Practice.match(nightPattern)?.some(n => n.toLowerCase() === practiceNightFilter.toLowerCase());
}

export function matchesSpecialFilters(tower, filters) {
    const {
        includeGrabbed = false,
        excludeGrabbed = false,
        includeQuartered = false,
        excludeQuartered = false,
        includePealed = false,
        excludePealed = false
    } = filters;

    const hasGrabbed = tower.grabbed === 1 || tower.grabbed === '1' || tower.grabbed === true;
    const hasQuartered = tower.quartered === 1 || tower.quartered === '1' || tower.quartered === true;
    const hasPealed = tower.pealed === 1 || tower.pealed === '1' || tower.pealed === true;

    const anyInclude = includeGrabbed || includeQuartered || includePealed;
    const anyExclude = excludeGrabbed || excludeQuartered || excludePealed;

    // If any include flags are set, show towers that match ANY of the included attributes (OR)
    if (anyInclude) {
        const included = (includeGrabbed && hasGrabbed) ||
                         (includeQuartered && hasQuartered) ||
                         (includePealed && hasPealed);
        if (!included) return false;
        // if also excluded for some reason, ensure not excluded
        if ((excludeGrabbed && hasGrabbed) || (excludeQuartered && hasQuartered) || (excludePealed && hasPealed)) {
            return false;
        }
        return true;
    }

    // No includes: if any excludes are set, exclude towers that match ANY exclude
    if (anyExclude) {
        if ((excludeGrabbed && hasGrabbed) || (excludeQuartered && hasQuartered) || (excludePealed && hasPealed)) {
            return false;
        }
        return true;
    }

    // No include/exclude filters set -> accept all
    return true;
}

export function addDistanceToTowers(towers, center, L = null) {
    return towers.map(tower => {
        let distance;
        if (L && center.distanceTo) {
            distance = center.distanceTo([tower.Lat, tower.Long]);
        } else if (center.lat !== undefined && center.lng !== undefined) {
            const R = 6371e3; // Earth radius in metres
            const φ1 = center.lat * Math.PI / 180;
            const φ2 = tower.Lat * Math.PI / 180;
            const Δφ = (tower.Lat - center.lat) * Math.PI / 180;
            const Δλ = (tower.Long - center.lng) * Math.PI / 180;

            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                     Math.cos(φ1) * Math.cos(φ2) *
                     Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

            distance = R * c;
        } else {
            distance = 0;
        }
        
        return { ...tower, distance };
    });
}

export function extractPracticeNights(towers) {
    const nightPattern = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi;
    const nights = Array.from(
        new Set(
            towers
                .flatMap(tower => {
                    if (!tower.Practice || typeof tower.Practice !== 'string') return [];
                    return [...tower.Practice.matchAll(nightPattern)].map(m => m[1]);
                })
        )
    )
    .map(n => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase())
    .filter(Boolean)
    .sort((a, b) => {
        const order = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        return order.indexOf(a) - order.indexOf(b);
    });
    
    return nights;
}

export function initializeMap(L, container, center = [52.0, 0.0], zoom = 6) {
    const map = L.map(container).setView(center, zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    return map;
}
