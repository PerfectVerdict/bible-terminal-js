#!/usr/bin/env node
(async () => {
  const wrapAnsi = (await import('wrap-ansi')).default;
  // rest of your code here
const blessed = require('blessed');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Constants
const allowedColors = [
  'black', 'red', 'green', 'yellow',
  'blue', 'magenta', 'cyan', 'white',
  'gray', 'grey', 'purple', 'orange'
];
const colorAliases = {
  purple: 'magenta',
  orange: 'yellow', // fallback for orange
};

const FAVORITES_PATH = path.resolve(process.env.HOME || process.env.USERPROFILE || __dirname, '.verse_favorites.json');

// State
let lastVerse = null;
let showReferences = false; // Toggle visibility of verse locations

// Helper to format aligned help text
function formatHelpLine(command, desc, totalWidth = 50) {
  const gap = totalWidth - command.length - desc.length;
  return `${command}${' '.repeat(gap > 1 ? gap : 1)}${desc}`;
}

// Homepage and help instructions
const helpLines = [
  formatHelpLine('john 3:16', 'Search a passage'),
  formatHelpLine('save', 'Favorite the last searched verse'),
  formatHelpLine('favs', 'Show saved favorites'),
  formatHelpLine('delete john 3:16', 'Remove verse from favs'),
  formatHelpLine('q', 'Quit the app'),
  formatHelpLine('help', 'Show these instructions')
];

const homepageText = `{center}{green-fg}{bold}
Welcome to Terminal Bible!

${helpLines.join('\n')}
{/bold}{/green-fg}{/center}`;

// Create screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'Bible Verse App'
});

const verseBox = blessed.box({
  top: 'center',
  left: 'center',
  width: '70%',
  height: '85%',
  content: homepageText,
  tags: true,
  border: { type: 'line' },
  style: {
    fg: 'white',
    bg: null,
    border: { fg: 'white' }
  },
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  vi: true,
  mouse: true
});

const input = blessed.textbox({
  bottom: 0,
  height: 1,
  inputOnFocus: true,
  padding: { left: 1 },
  style: {
    fg: 'white',
    bg: null,
    cursor: {
      fg: 'yellow',
      bg: null,
    },
    focus: {
      bg: null,
      fg: 'white'
    }
  }
});

function showInstructions() {
  const helpText = `{center}{green-fg}{bold}
${helpLines.join('\n')}
{/bold}{/green-fg}{/center}`;

  verseBox.setContent(helpText);
  screen.render();
}

screen.append(verseBox);
screen.append(input);
input.key('q', () => {
  screen.destroy();
  process.exit(0);
});

input.focus();

// File utils
function loadFavorites() {
  try {
    if (!fs.existsSync(FAVORITES_PATH)) return [];
    return JSON.parse(fs.readFileSync(FAVORITES_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveFavorites(favs) {
  fs.writeFileSync(FAVORITES_PATH, JSON.stringify(favs, null, 2));
}

function displayFavorites() {
  const favs = loadFavorites();
  if (favs.length === 0) {
    verseBox.setContent('{bold}{white-fg}No favorite verses saved yet.{/white-fg}{/bold}');
    screen.render();
    return;
  }

  let content = '{bold}Favorite Verses:{/bold}\n\n';
  favs.forEach((v, i) => {
    content += `{bold}${i + 1}. ${v.reference} {bold}\n{bold}${v.text.trim()}{/bold}\n\n`;
  });

  verseBox.setContent(content);
  screen.render();
}
async function fetchVerse(query) {
  try {
    const url = `https://bible-api.com/${encodeURIComponent(query)}`;
    const res = await axios.get(url);
    const data = res.data;

    const indent = '';
    const maxWidth = 75;

    function wrapAndIndent(text, width) {
      const wrapped = wrapAnsi(text, width - indent.length, { hard: true });
      return wrapped
        .split('\n')
        .map((line, i) => (i === 0 ? line : indent + line))
        .join('\n');
    }

    const verses = data.verses
      ? data.verses.map(v => {
          const ref = `{red-fg}${v.book_name} ${v.chapter}:${v.verse}{/red-fg}\n`;
          const wrappedText = wrapAndIndent(v.text.trim(), maxWidth);
          return showReferences ? ref + wrappedText : wrappedText;
        }).join('\n')
      : wrapAndIndent(data.text.trim(), maxWidth);


verseBox.setContent(`{center}{bold}${data.reference}{/bold}{/center}\n\n{center}{bold}${verses}{/bold}{/center}`);
        // When pressing `Esc`, blur the input and enable scrolling
        input.key('escape', () => {
          screen.focusPop(); // unfocus the input
          verseBox.focus();  // focus the verseBox
        });

        // Allow going back to input by pressing `i`
        verseBox.key('i', () => {
          input.focus();
        });

          screen.on('mouse', (data) => {
            if (data.action === 'wheelup') {
              verseBox.scroll(-1);
              screen.render();
            } else if (data.action === 'wheeldown') {
              verseBox.scroll(1);
              screen.render();
            }
          });

    lastVerse = {
      reference: data.reference,
      translation: data.translation_name,
      text: data.text.trim()
    };

    screen.render();
  } catch (err) {
    verseBox.setContent(`{red-fg}❌ Error:{/red-fg} ${err.response?.data?.error || err.message}`);
    screen.render();
  }
}

// Input handler
input.on('submit', async (value) => {
  const query = value.trim();
  input.clearValue();
  screen.render();

  if (!query) {
    input.focus();
    return;
  }
if (allowedColors.includes(query) || colorAliases[query]) {
  const resolvedColor = colorAliases[query] || query;
  verseBox.style.fg = resolvedColor;
  verseBox.style.border.fg = resolvedColor;
  verseBox.setContent(`{${resolvedColor}-fg}✅ Color changed to ${query}{/${resolvedColor}-fg}`);
  screen.render();
  input.focus();
  return;
} else  if (query === 'favs') {
    displayFavorites();
} else if (query === 'refs') {
  showReferences = !showReferences;
  verseBox.setContent(`{bold}Verse references ${showReferences ? 'enabled' : 'hidden'}.{\/bold}`);
  screen.render();

    } else if (query === 'help') {
    showInstructions();
  } else if (query === 'save') {
    if (!lastVerse) {
      verseBox.setContent('{bold}⚠️ No verse to save. Lookup one first.{/bold}');
    } else {
      const favorites = loadFavorites();
      const exists = favorites.some(v => v.reference.toLowerCase() === lastVerse.reference.toLowerCase());
      if (exists) {
        verseBox.setContent('{bold}⚠️ Verse already in favorites.{/bold}');
      } else {
        favorites.push(lastVerse);
        saveFavorites(favorites);
        verseBox.setContent('{bold}✅ Verse saved to favorites!{/bold}');
      }
    }
    screen.render();
  } else if (query.startsWith('delete ')) {
    const ref = query.slice(7).trim().toLowerCase();
    let favs = loadFavorites();
    const initialLen = favs.length;
    favs = favs.filter(v => v.reference.toLowerCase() !== ref);
    if (favs.length < initialLen) {
      saveFavorites(favs);
      verseBox.setContent(`{bold}🗑️ Removed ${ref} from favorites.{/bold}`);
    } else {
      verseBox.setContent(`{bold}⚠️ Could not find "${ref}" in favorites.{/bold}`);
    }
    screen.render();
  } else {
    await fetchVerse(query);
  }

  input.focus();
});

// Quit keys
screen.key(['q', 'C-c', 'escape'], () => {
  screen.destroy();
  process.exit(0);
});

screen.render();
})();

