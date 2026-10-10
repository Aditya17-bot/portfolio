// Live data for the protein explorer: UniProt (gene to protein), AlphaFold DB (predicted structure and its
// per-residue confidence) and AlphaMissense (predicted pathogenicity of every single amino-acid substitution).
// All three are public, CORS-enabled APIs, called straight from the browser.

export type Protein = { accession: string; name: string; gene: string; length: number };
export type Residue = { pos: number; aa: string; x: number; y: number; z: number; plddt: number };
export type Missense = { mean: number; max: number; variants: Map<string, number> };

// AlphaMissense's published cut-offs on am_pathogenicity.
export const AM_BENIGN = 0.34;
export const AM_PATHOGENIC = 0.564;

const THREE_TO_ONE: Record<string, string> = {
  ALA: "A", ARG: "R", ASN: "N", ASP: "D", CYS: "C", GLN: "Q", GLU: "E", GLY: "G", HIS: "H", ILE: "I",
  LEU: "L", LYS: "K", MET: "M", PHE: "F", PRO: "P", SER: "S", THR: "T", TRP: "W", TYR: "Y", VAL: "V",
};

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
  return r.json() as Promise<T>;
}

/** Gene symbol to the reviewed human UniProt entry. */
export async function findProtein(gene: string): Promise<Protein> {
  const q = encodeURIComponent(`gene_exact:${gene} AND organism_id:9606 AND reviewed:true`);
  type R = { results: { primaryAccession: string; proteinDescription: { recommendedName?: { fullName: { value: string } } }; sequence: { length: number }; genes?: { geneName?: { value: string } }[] }[] };
  const d = await json<R>(`https://rest.uniprot.org/uniprotkb/search?query=${q}&fields=accession,protein_name,gene_primary,length&format=json&size=1`);
  const hit = d.results[0];
  if (!hit) throw new Error(`No reviewed human protein found for "${gene}".`);
  return {
    accession: hit.primaryAccession,
    name: hit.proteinDescription.recommendedName?.fullName.value ?? hit.primaryAccession,
    gene: hit.genes?.[0]?.geneName?.value ?? gene.toUpperCase(),
    length: hit.sequence.length,
  };
}

/** The AlphaFold model's alpha carbons, with pLDDT (stored in the B-factor column). */
export async function loadStructure(accession: string) {
  type P = { pdbUrl: string; amAnnotationsUrl?: string; uniprotEnd: number }[];
  const [entry] = await json<P>(`https://alphafold.ebi.ac.uk/api/prediction/${accession}`);
  if (!entry) throw new Error("AlphaFold has no model for this protein.");
  const r = await fetch(entry.pdbUrl);
  if (!r.ok) throw new Error(`AlphaFold model download failed (${r.status}).`);
  const residues: Residue[] = [];
  for (const line of (await r.text()).split("\n")) {
    if (!line.startsWith("ATOM") || line.slice(12, 16).trim() !== "CA") continue;
    residues.push({
      pos: Number(line.slice(22, 26)),
      aa: THREE_TO_ONE[line.slice(17, 20)] ?? "X",
      x: Number(line.slice(30, 38)),
      y: Number(line.slice(38, 46)),
      z: Number(line.slice(46, 54)),
      plddt: Number(line.slice(60, 66)),
    });
  }
  return { residues, amUrl: entry.amAnnotationsUrl };
}

/** Per-residue summary of AlphaMissense scores for all 19 possible substitutions. */
export async function loadMissense(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`AlphaMissense download failed (${r.status}).`);
  const byPos = new Map<number, Missense>();
  const lines = (await r.text()).split("\n");
  for (let i = 1; i < lines.length; i++) {
    const [variant, score] = lines[i].split(",");
    if (!variant || !score) continue;
    const pos = Number(variant.slice(1, -1));
    const s = Number(score);
    let m = byPos.get(pos);
    if (!m) byPos.set(pos, (m = { mean: 0, max: 0, variants: new Map() }));
    m.variants.set(variant, s);
    m.max = Math.max(m.max, s);
  }
  for (const m of byPos.values()) m.mean = [...m.variants.values()].reduce((a, b) => a + b, 0) / m.variants.size;
  return byPos;
}

export const distance = (a: Residue, b: Residue) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function amClass(s: number) {
  return s >= AM_PATHOGENIC ? "likely pathogenic" : s < AM_BENIGN ? "likely benign" : "ambiguous";
}

/**
 * Hotspots: pairs of strongly pathogenic positions that sit close in 3D although far apart in the sequence,
 * the pattern a 1D score track cannot show. Only confidently modelled residues count.
 */
export function hotspots(residues: Residue[], am: Map<number, Missense>, opts = { minMean: 0.8, maxDist: 8, minGap: 25, minPlddt: 70 }) {
  const strong = residues.filter((r) => (am.get(r.pos)?.mean ?? 0) >= opts.minMean && r.plddt >= opts.minPlddt);
  const pairs: { a: Residue; b: Residue; d: number }[] = [];
  for (let i = 0; i < strong.length; i++)
    for (let j = i + 1; j < strong.length; j++) {
      const a = strong[i];
      const b = strong[j];
      if (Math.abs(a.pos - b.pos) < opts.minGap) continue;
      const d = distance(a, b);
      if (d <= opts.maxDist) pairs.push({ a, b, d });
    }
  return pairs.sort((p, q) => p.d - q.d);
}
