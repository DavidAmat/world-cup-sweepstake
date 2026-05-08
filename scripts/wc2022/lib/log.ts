export function step(label: string): void {
  console.log(`\n→ ${label}`);
}

export function info(label: string, value?: unknown): void {
  if (value === undefined) {
    console.log(`  ${label}`);
  } else {
    console.log(`  ${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  }
}

export function done(label: string, count?: number): void {
  if (count === undefined) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✓ ${label} (${count})`);
  }
}

export function warn(message: string): void {
  console.warn(`  ! ${message}`);
}

export function fatal(message: string, error?: unknown): never {
  console.error(`\n✗ ${message}`);
  if (error) console.error(error);
  process.exit(1);
}
