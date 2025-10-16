// Nickname database utility
// Uses the comprehensive nickname database from https://github.com/carltonnorthern/nickname-and-diminutive-names-lookup

let nicknameCache: Map<string, Set<string>> | null = null;

/**
 * Load and parse the nickname database
 * Creates a bidirectional map where each name maps to all its related names (nicknames and formal names)
 */
export async function loadNicknameDatabase(): Promise<Map<string, Set<string>>> {
  if (nicknameCache) {
    return nicknameCache;
  }

  try {
    const response = await fetch('/nicknames.csv');
    const csvText = await response.text();

    const nicknameMap = new Map<string, Set<string>>();

    // Parse CSV (skip header row)
    const lines = csvText.split('\n').slice(1);

    for (const line of lines) {
      if (!line.trim()) continue;

      const [name1, relationship, name2] = line.split(',').map(s => s.trim().toLowerCase());

      if (relationship === 'has_nickname' && name1 && name2) {
        // Add bidirectional mapping
        // name1 -> name2
        if (!nicknameMap.has(name1)) {
          nicknameMap.set(name1, new Set());
        }
        nicknameMap.get(name1)!.add(name2);

        // name2 -> name1
        if (!nicknameMap.has(name2)) {
          nicknameMap.set(name2, new Set());
        }
        nicknameMap.get(name2)!.add(name1);

        // Also add transitive relationships (if A->B and B->C, then A->C and C->A)
        const name1Nicknames = nicknameMap.get(name1)!;
        const name2Nicknames = nicknameMap.get(name2)!;

        // Add all of name2's nicknames to name1's set
        name2Nicknames.forEach(nick => {
          if (nick !== name1) {
            name1Nicknames.add(nick);
          }
        });

        // Add all of name1's nicknames to name2's set
        name1Nicknames.forEach(nick => {
          if (nick !== name2) {
            name2Nicknames.add(nick);
          }
        });
      }
    }

    nicknameCache = nicknameMap;
    return nicknameMap;
  } catch (error) {
    console.error('Failed to load nickname database:', error);
    // Return empty map on error
    return new Map();
  }
}

/**
 * Check if two names are nicknames of each other
 */
export async function areNicknames(name1: string, name2: string): Promise<boolean> {
  const db = await loadNicknameDatabase();
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  if (n1 === n2) return true;

  const n1Nicknames = db.get(n1);
  return n1Nicknames ? n1Nicknames.has(n2) : false;
}

/**
 * Get all nicknames for a given name
 */
export async function getNicknames(name: string): Promise<string[]> {
  const db = await loadNicknameDatabase();
  const nicknames = db.get(name.toLowerCase().trim());
  return nicknames ? Array.from(nicknames) : [];
}