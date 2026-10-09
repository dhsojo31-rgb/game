// 자체 제작 이야기 그림 (인라인 SVG). 외부 이미지에 의존하지 않는다.

export function moaSVG(cls = 'moa') {
  return `<svg class="${cls}" viewBox="0 0 120 160" role="img" aria-label="책갈피 도우미 모아">
    <path d="M20 6h80v148l-40-28-40 28z" fill="#f6c543" stroke="#6b4423" stroke-width="5" stroke-linejoin="round"/>
    <path d="M30 16h60v110l-30-21-30 21z" fill="#fff3c4"/>
    <circle cx="45" cy="58" r="6" fill="#3b2a1a"/><circle cx="75" cy="58" r="6" fill="#3b2a1a"/>
    <circle cx="47" cy="56" r="2" fill="#fff"/><circle cx="77" cy="56" r="2" fill="#fff"/>
    <path d="M44 80q16 14 32 0" fill="none" stroke="#3b2a1a" stroke-width="4" stroke-linecap="round"/>
    <circle cx="36" cy="74" r="5" fill="#f4a0a0" opacity=".8"/><circle cx="84" cy="74" r="5" fill="#f4a0a0" opacity=".8"/>
    <circle cx="60" cy="112" r="10" fill="none" stroke="#2f6fde" stroke-width="4"/>
    <path d="M67 119l10 10" stroke="#2f6fde" stroke-width="5" stroke-linecap="round"/>
  </svg>`;
}

export const CLUES = {
  blue: { key: 'blue', name: '파란색', item: '파란 리본', line: '첫 단서야! 열쇠가 있는 곳은 파란색인가 봐.' },
  star: { key: 'star', name: '별', item: '별 모양 쪽지', line: '두 번째 단서는 별이야!' },
  box: { key: 'box', name: '상자', item: '상자 그림 쪽지', line: '마지막 단서는 상자야!' },
};

export function clueSVG(key) {
  if (key === 'blue') return `<svg viewBox="0 0 120 120" role="img" aria-label="파란 리본">
    <path d="M20 40q40-30 80 0l-10 60q-30-12-60 0z" fill="#2f6fde" stroke="#1f4fa8" stroke-width="4" stroke-linejoin="round"/>
    <path d="M60 40v60" stroke="#1f4fa8" stroke-width="3"/>
    <ellipse cx="60" cy="40" rx="12" ry="9" fill="#5b8ff0" stroke="#1f4fa8" stroke-width="3"/>
  </svg>`;
  if (key === 'star') return `<svg viewBox="0 0 120 120" role="img" aria-label="별 모양 쪽지">
    <rect x="18" y="14" width="84" height="92" rx="8" fill="#fff" stroke="#6b4423" stroke-width="4" transform="rotate(-6 60 60)"/>
    <path d="M60 32l9 20 22 2-16 14 5 22-20-12-20 12 5-22-16-14 22-2z" fill="#f6c543" stroke="#c8961a" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;
  return `<svg viewBox="0 0 120 120" role="img" aria-label="상자 그림 쪽지">
    <rect x="18" y="14" width="84" height="92" rx="8" fill="#fff" stroke="#6b4423" stroke-width="4" transform="rotate(5 60 60)"/>
    <rect x="34" y="52" width="52" height="36" fill="#c8893a" stroke="#6b4423" stroke-width="3"/>
    <rect x="30" y="40" width="60" height="14" fill="#e0a65a" stroke="#6b4423" stroke-width="3"/>
    <path d="M60 54v34" stroke="#6b4423" stroke-width="3"/>
  </svg>`;
}

export function introPanelSVG(n) {
  const library = `<rect width="300" height="200" fill="#fff8e7"/>
    <rect x="20" y="40" width="80" height="120" fill="#c8893a"/><rect x="110" y="40" width="80" height="120" fill="#c8893a"/><rect x="200" y="40" width="80" height="120" fill="#c8893a"/>
    ${[20,110,200].map(x => [50,80,110,140].map(y => `<rect x="${x+6}" y="${y}" width="68" height="20" fill="#fff" stroke="#6b4423"/>
      <rect x="${x+8}" y="${y+2}" width="10" height="16" fill="#2f6fde"/><rect x="${x+20}" y="${y+2}" width="12" height="16" fill="#d9534f"/><rect x="${x+34}" y="${y+2}" width="9" height="16" fill="#2e9e5b"/><rect x="${x+45}" y="${y+2}" width="14" height="16" fill="#f6c543"/>`).join('')).join('')}`;
  if (n === 1) return `<svg viewBox="0 0 300 200">${library}
    <path d="M0 0h300v30H0z" fill="#f6c543" opacity=".6"/>
    ${[30,80,130,180,230].map((x,i) => `<path d="M${x} 10l12 22h-24z" fill="${['#d9534f','#2f6fde','#2e9e5b','#f6c543','#d9534f'][i]}" stroke="#6b4423"/>`).join('')}
    <text x="150" y="190" font-size="20" text-anchor="middle" font-weight="700" fill="#6b4423">책 축제</text>
  </svg>`;
  if (n === 2) return `<svg viewBox="0 0 300 200">${library}
    <path d="M30 100q40-30 80 0t80 0t80 0" fill="none" stroke="#9fc5ff" stroke-width="8" stroke-linecap="round"/>
    <path d="M20 140q40-30 80 0t80 0" fill="none" stroke="#9fc5ff" stroke-width="6" stroke-linecap="round"/>
    <g transform="translate(200 60) rotate(30)"><circle cx="0" cy="0" r="12" fill="none" stroke="#f6c543" stroke-width="7"/><path d="M12 0h40M40 0v10M30 0v8" stroke="#f6c543" stroke-width="7" stroke-linecap="round"/></g>
    <text x="250" y="40" font-size="40" font-weight="900" fill="#d9534f">?</text>
    ${[60,100,140].map(x => `<rect x="${x}" y="${150+ (x%40)/4}" width="24" height="16" fill="#fff" stroke="#6b4423" transform="rotate(${x%30 - 15} ${x} 160)"/>`).join('')}
  </svg>`;
  return `<svg viewBox="0 0 300 200">${library}
    ${[40,120,200].map((x,i) => `<rect x="${x}" y="130" width="50" height="60" fill="#fff" stroke="#6b4423" stroke-width="2" transform="rotate(${i*10-10} ${x+25} 160)"/>
      <rect x="${x+8}" y="140" width="34" height="30" fill="${['#2f6fde','#2e9e5b','#d9534f'][i]}" transform="rotate(${i*10-10} ${x+25} 160)"/>`).join('')}
    <g transform="translate(110 30) scale(.55)">${moaSVG('').replace('<svg class=""', '<svg').replace(/<svg[^>]*>/, '<g>').replace('</svg>', '</g>')}</g>
    <circle cx="195" cy="95" r="18" fill="none" stroke="#2f6fde" stroke-width="5"/><path d="M208 108l16 16" stroke="#2f6fde" stroke-width="6" stroke-linecap="round"/>
  </svg>`;
}

export function endingSceneSVG(state) {
  // state: 'closed' | 'open'
  const open = state === 'open';
  return `<svg viewBox="0 0 640 400" role="img" aria-label="${open ? '열쇠가 나온 파란 상자와 열린 축제 문' : '별이 붙은 파란 상자'}">
    <rect width="640" height="400" fill="#fff8e7"/>
    <!-- 축제 문 -->
    <rect x="240" y="40" width="160" height="200" rx="80" fill="#6b4423"/>
    <rect x="250" y="50" width="140" height="190" rx="70" fill="${open ? '#fff3c4' : '#8a5a2b'}"/>
    ${open ? `<path d="M250 240V120q70-70 140 0v120z" fill="#f6c543" opacity=".8"/>
      ${[280,320,360].map((x,i)=>`<path d="M${x} 90l6 12 13 1-10 9 3 13-12-7-12 7 3-13-10-9 13-1z" fill="${['#d9534f','#2f6fde','#2e9e5b'][i]}"/>`).join('')}
      <text x="320" y="200" font-size="22" text-anchor="middle" font-weight="900" fill="#6b4423">책 축제</text>`
      : `<circle cx="370" cy="150" r="8" fill="#f6c543"/><rect x="366" y="150" width="8" height="14" fill="#f6c543"/>`}
    <!-- 바닥 -->
    <rect x="0" y="240" width="640" height="160" fill="#e8d7b8"/>
    <!-- 다른 상자들(연출용, 선택 불가) -->
    <rect x="60" y="270" width="110" height="80" fill="#c8893a" stroke="#6b4423" stroke-width="4"/>
    <rect x="470" y="280" width="110" height="70" fill="#2e9e5b" stroke="#6b4423" stroke-width="4"/>
    <!-- 별이 붙은 파란 상자 -->
    <g class="${open ? '' : 'glow'}" style="transform-origin: 320px 310px">
      <rect x="240" y="270" width="160" height="90" fill="#2f6fde" stroke="#1f4fa8" stroke-width="5"/>
      ${open ? `<rect x="232" y="232" width="176" height="30" fill="#5b8ff0" stroke="#1f4fa8" stroke-width="5" transform="rotate(-25 232 262)"/>`
             : `<rect x="232" y="256" width="176" height="24" fill="#5b8ff0" stroke="#1f4fa8" stroke-width="5"/>`}
      <path d="M320 290l10 22 24 2-18 16 6 24-22-13-22 13 6-24-18-16 24-2z" fill="#f6c543" stroke="#c8961a" stroke-width="3" stroke-linejoin="round"/>
      ${open ? `<g transform="translate(320 250)"><circle cx="-20" cy="0" r="14" fill="none" stroke="#f6c543" stroke-width="8"/><path d="M-6 0h46M30 0v12M20 0v10" stroke="#f6c543" stroke-width="8" stroke-linecap="round"/></g>` : ''}
    </g>
    ${open ? '' : `<text x="320" y="390" font-size="20" text-anchor="middle" font-weight="700" fill="#1f4fa8">상자를 눌러 열어 봐!</text>`}
  </svg>`;
}

export function badgeSVG() {
  return `<svg viewBox="0 0 160 160" width="150" height="150" role="img" aria-label="책표지 탐정단 배지">
    <circle cx="80" cy="80" r="72" fill="#f6c543" stroke="#6b4423" stroke-width="6"/>
    <circle cx="80" cy="80" r="58" fill="#fff3c4" stroke="#6b4423" stroke-width="3" stroke-dasharray="6 5"/>
    <circle cx="72" cy="66" r="16" fill="none" stroke="#2f6fde" stroke-width="7"/>
    <path d="M84 78l16 16" stroke="#2f6fde" stroke-width="9" stroke-linecap="round"/>
    <text x="80" y="124" font-size="15" text-anchor="middle" font-weight="900" fill="#6b4423">책표지 탐정단</text>
  </svg>`;
}
