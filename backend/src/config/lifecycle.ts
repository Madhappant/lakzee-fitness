let draining = false;

export function setServerDraining(nextState: boolean): void {
  draining = nextState;
}

export function isServerDraining(): boolean {
  return draining;
}
