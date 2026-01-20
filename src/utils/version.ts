// Helper for loose SemVer comparison
// Returns true if v1 > v2
export function isNewerVersion(v1: string, v2: string) {
  if (v1 === v2) return false;
  if (v1 === "Unknown" || v2 === "Unknown") return true;

  const clean = (v: string) => {
    const normalized = v.toLowerCase().replace(/^v/, "");
    const parts = normalized.split(/[._-]/);

    return parts.map((p) => {
      const n = parseInt(p);
      if (!isNaN(n)) return { type: "number", value: n } as const;

      if (p === "hotfix") return { type: "hotfix", value: 999 } as const;
      if (p === "beta") return { type: "beta", value: -2 } as const;
      if (p === "alpha") return { type: "alpha", value: -3 } as const;
      if (p === "rc") return { type: "rc", value: -1 } as const;

      return { type: "text", value: -10 } as const;
    });
  };

  const p1 = clean(v1);
  const p2 = clean(v2);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const seg1 = p1[i] ?? { type: "number", value: 0 };
    const seg2 = p2[i] ?? { type: "number", value: 0 };

    if (seg1.value > seg2.value) return true;
    if (seg1.value < seg2.value) return false;
  }

  return false;
}
