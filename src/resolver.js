// Deckdown - Resolver
// Handles @import directive resolution

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, extname } from 'path';

export class Resolver {
  constructor(entryPath) {
    this.entryPath = resolve(entryPath);
    this.entryDir = dirname(this.entryPath);
    this.resolved = new Map();
    this.contentByPath = new Map();
  }

  resolve(content, baseDir = this.entryDir) {
    const importRegex = /@import\[([^\]]+)\]/g;
    let match;
    let resolved = content;
    
    // Track matches with their info for later replacement
    const matches = [];
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const fullPath = this.resolvePath(importPath, baseDir);
      const ext = extname(fullPath).toLowerCase();
      
      matches.push({ match: match[0], fullPath, ext });
      
      if (!this.resolved.has(fullPath)) {
        if (!existsSync(fullPath)) {
          throw new Error(`Import file not found: ${fullPath}`);
        }
        
        const fileContent = readFileSync(fullPath, 'utf-8');
        
        if (ext === '.md' || ext === '.markdown') {
          // Recursively resolve Markdown imports
          const recursiveResolved = this.resolve(fileContent, dirname(fullPath));
          this.resolved.set(fullPath, recursiveResolved);
          this.contentByPath.set(fullPath, fileContent);
        } else {
          // YAML or other - no recursive resolution
          this.resolved.set(fullPath, fileContent);
          this.contentByPath.set(fullPath, fileContent);
        }
      }
    }
    
    // Now do replacements
    for (const { match, fullPath, ext } of matches) {
      if (ext === '.md' || ext === '.markdown') {
        // For MD imports, include the content directly
        resolved = resolved.replace(match, this.resolved.get(fullPath));
      } else {
        // For YAML imports, remove the directive (will be merged separately)
        resolved = resolved.replace(match, '');
      }
    }
    
    return resolved;
  }

  resolvePath(importPath, baseDir) {
    // Handle relative paths
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      return resolve(baseDir, importPath);
    }
    
    // Check relative to entry directory
    const relativePath = resolve(this.entryDir, importPath);
    if (existsSync(relativePath)) {
      return relativePath;
    }
    
    // Fall back to as-is (will error later if not found)
    return resolve(importPath);
  }

  getResolvedImports() {
    return Array.from(this.contentByPath.entries()).map(([path, content]) => ({ path, content }));
  }
  
  getYAMLImports() {
    return this.getResolvedImports().filter(({ path }) => {
      const ext = extname(path).toLowerCase();
      return ext === '.yaml' || ext === '.yml' || ext === '.json';
    });
  }
}

export function resolveImports(content, entryPath) {
  const resolver = new Resolver(entryPath);
  const resolved = resolver.resolve(content);
  return {
    content: resolved,
    imports: resolver.getResolvedImports(),
    yamlImports: resolver.getYAMLImports()
  };
}